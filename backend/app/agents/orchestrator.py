"""
LangGraph Orchestrator — Phase 5 + Phase 6 pipeline.

Flow:
  START
    → planner
    → retrieve
    → specialists   [legal + financial + graph + calculation + summarization IN PARALLEL]
    → synthesis
    → validators    [gatekeeper + auditor + strategist IN PARALLEL]  or skip for simple queries
    → END
"""
import concurrent.futures
from langgraph.graph import StateGraph, END

from app.agents.state import AgentState
from app.agents.planner import plan_query
from app.agents.legal import legal_agent
from app.agents.financial import financial_agent
from app.agents.graph_agent import graph_agent
from app.agents.calculation import calculation_agent
from app.agents.summarization import summarization_agent
from app.agents.synthesis import synthesis_agent
from app.agents.gatekeeper import gatekeeper
from app.agents.auditor import auditor
from app.agents.strategist import strategist
from app.services.prompt_assembler import assemble
from app.services.scope_filter import check_scope, refusal_response
from app.services.cache import get_cached, set_cached

_SPECIALIST_MAP = {
    "legal":         legal_agent,
    "financial":     financial_agent,
    "graph":         graph_agent,
    "calculation":   calculation_agent,
    "summarization": summarization_agent,
}


def run_specialists_parallel(state: dict) -> dict:
    """Run only the needed specialist agents in parallel — replaces 5 sequential nodes."""
    agents_needed = state.get("plan", {}).get("agents_needed", [])

    if not agents_needed:
        return {"agent_outputs": {}, "agents_used": []}

    to_run = {k: v for k, v in _SPECIALIST_MAP.items() if k in agents_needed}
    if not to_run:
        return {"agent_outputs": {}, "agents_used": []}

    combined_outputs = {}
    agents_that_ran  = []

    executor = concurrent.futures.ThreadPoolExecutor(max_workers=len(to_run))
    try:
        futures = {name: executor.submit(fn, state) for name, fn in to_run.items()}
        for name, future in futures.items():
            try:
                result = future.result(timeout=60)
                if result and result.get("agent_outputs", {}).get(name):
                    combined_outputs[name] = result["agent_outputs"][name]
                    agents_that_ran.append(name)
            except Exception as e:
                print(f"[{name}_agent] parallel error: {e}")
    finally:
        executor.shutdown(wait=False)  # don't block on stragglers past their own timeout

    return {"agent_outputs": combined_outputs, "agents_used": agents_that_ran}


def run_validators_parallel(state: dict) -> dict:
    """Run gatekeeper + auditor + strategist in parallel.

    A slow/failed validator must never take down an already-synthesized answer —
    each result degrades independently to "validation_unavailable" on error/timeout.
    """
    validators = {"gatekeeper": gatekeeper, "auditor": auditor, "strategist": strategist}

    executor = concurrent.futures.ThreadPoolExecutor(max_workers=3)
    try:
        futures = {name: executor.submit(fn, state) for name, fn in validators.items()}
        results = {}
        for name, future in futures.items():
            try:
                results[name] = future.result(timeout=60)
            except Exception as e:
                print(f"[{name}] validator error: {e}")
                results[name] = None
    finally:
        executor.shutdown(wait=False)  # don't block on stragglers past their own timeout

    combined_validation = {}
    agents_used = list(state.get("agents_used", []))
    escalate = False

    for name, result in results.items():
        if result is None:
            combined_validation[name] = {"error": "validation_unavailable"}
            continue
        combined_validation.update(result.get("validation", {}))
        agents_used.append(name)
        escalate = escalate or result.get("escalate", False)

    return {
        "validation":  combined_validation,
        "agents_used": agents_used,
        "escalate":    escalate,
    }


def _route_after_synthesis(state: dict) -> str:
    """Skip Phase 6 for simple queries with no specialist agents — saves 3 Gemini calls."""
    plan           = state.get("plan", {})
    complexity     = plan.get("complexity", "simple")
    agents_needed  = plan.get("agents_needed", [])
    specialist_ran = any(
        a in state.get("agents_used", [])
        for a in ["legal", "financial", "graph", "calculation"]
    )
    if complexity == "simple" and not specialist_ran and not agents_needed:
        return "skip"
    return "validate"


def build_graph(db):
    from app.agents.retrieval import retrieve_context

    def retrieve_node(state: AgentState) -> dict:
        return retrieve_context(state, db)

    builder = StateGraph(AgentState)

    # ── Nodes ──────────────────────────────────────────────────────────────────
    builder.add_node("planner",     plan_query)
    builder.add_node("retrieve",    retrieve_node)
    builder.add_node("specialists", run_specialists_parallel)
    builder.add_node("synthesis",   synthesis_agent)
    builder.add_node("validators",  run_validators_parallel)

    # ── Edges ──────────────────────────────────────────────────────────────────
    builder.set_entry_point("planner")
    builder.add_edge("planner",     "retrieve")
    builder.add_edge("retrieve",    "specialists")
    builder.add_edge("specialists", "synthesis")

    builder.add_conditional_edges(
        "synthesis",
        _route_after_synthesis,
        {"validate": "validators", "skip": END},
    )
    builder.add_edge("validators", END)

    return builder.compile()


def run_agent_query(query: str, db, history: list = None) -> dict:
    if history is None:
        history = []

    assembled = assemble(query, history)

    scope = check_scope(assembled["query"])
    if not scope["in_scope"]:
        print(f"[scope_filter] rejected: {assembled['query']!r} — {scope['reason']}")
        return refusal_response()

    # ── Cache check — skip full pipeline on hit ────────────────────────────────
    cached = get_cached(assembled["query"])
    if cached:
        return cached

    graph = build_graph(db)

    initial_state: AgentState = {
        "query":          assembled["query"],
        "original_query": assembled["original_query"],
        "history_block":  assembled["history_block"],
        "plan":           {},
        "vector_chunks":  [],
        "graph_context":  {},
        "agent_outputs":  {},
        "final_answer":   "",
        "search_mode":    "semantic",
        "sources":        [],
        "agents_used":    [],
        "confidence":     "medium",
        "validation":     {},
        "escalate":       False,
    }

    result = graph.invoke(initial_state)

    # ── Phase 6 enforcement ────────────────────────────────────────────────────
    validation   = result.get("validation", {})
    gk           = validation.get("gatekeeper", {})
    au           = validation.get("auditor",    {})
    st           = validation.get("strategist", {})
    final_answer = result.get("final_answer", "")

    grounding_score = au.get("grounding_score", 100)
    gk_rejected     = gk.get("recommendation") == "reject"

    # Gatekeeper reject (irrelevant/harmful) stands on its own — groundedness is a
    # separate axis (auditor) and must not be able to override a relevance/safety veto.
    if gk_rejected:
        final_answer = (
            "Your question could not be answered adequately from the available "
            "documents. Please try rephrasing your question or upload documents "
            "that cover this topic."
        )
    elif grounding_score < 5:
        final_answer = (
            "I found relevant documents but could not generate a sufficiently "
            "grounded answer. The retrieved content may be incomplete or ambiguous. "
            "Please refine your question or upload more relevant documents."
        )

    if st.get("escalate"):
        print(f"[ESCALATION REQUIRED] Query: {assembled['query']!r} — "
              f"Reason: {st.get('escalation_reason', 'sensitive content')}")

    response = {
        "answer":          final_answer,
        "plan":            result.get("plan", {}),
        "agents_used":     result.get("agents_used", []),
        "search_mode":     result.get("search_mode", "semantic"),
        "sources":         result.get("sources", []),
        "confidence":      result.get("confidence", "medium"),
        "chunks_used":     len(result.get("vector_chunks", [])),
        "graph_entities":  len(result.get("graph_context", {}).get("entities", [])),
        "validation":      result.get("validation", {}),
        "escalate":        result.get("escalate", False),
        "query_rewritten": assembled["rewritten"],
        "resolved_query":  assembled["query"],
        "out_of_scope":    False,
    }

    # Don't cache "not found" or blocked answers — these may be synthesis errors
    answer_lower = final_answer.lower()
    is_not_found = (
        "information not found" in answer_lower or
        "not found in uploaded" in answer_lower or
        "could not be answered" in answer_lower or
        "could not generate" in answer_lower
    )
    if not result.get("escalate", False) and not is_not_found:
        set_cached(assembled["query"], response)

    return response
