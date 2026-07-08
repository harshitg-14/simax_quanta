"""
LangGraph Orchestrator — Phase 5 + Phase 6 pipeline.

Flow:
  START
    → planner
    → retrieve
    → legal → financial → graph → calculation → summarization   [Phase 5 specialists]
    → synthesis
    → gatekeeper → auditor → strategist                          [Phase 6 validators]
    → END
"""
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


def build_graph(db):
    from app.agents.retrieval import retrieve_context

    def retrieve_node(state: AgentState) -> dict:
        return retrieve_context(state, db)

    builder = StateGraph(AgentState)

    # ── Phase 5 nodes ─────────────────────────────────────────────────────────
    builder.add_node("planner",       plan_query)
    builder.add_node("retrieve",      retrieve_node)
    builder.add_node("legal",         legal_agent)
    builder.add_node("financial",     financial_agent)
    builder.add_node("graph",         graph_agent)
    builder.add_node("calculation",   calculation_agent)
    builder.add_node("summarization", summarization_agent)
    builder.add_node("synthesis",     synthesis_agent)

    # ── Phase 6 nodes ─────────────────────────────────────────────────────────
    builder.add_node("gatekeeper",    gatekeeper)
    builder.add_node("auditor",       auditor)
    builder.add_node("strategist",    strategist)

    # ── Phase 5 pipeline edges ─────────────────────────────────────────────────
    builder.set_entry_point("planner")
    builder.add_edge("planner",       "retrieve")
    builder.add_edge("retrieve",      "legal")
    builder.add_edge("legal",         "financial")
    builder.add_edge("financial",     "graph")
    builder.add_edge("graph",         "calculation")
    builder.add_edge("calculation",   "summarization")
    builder.add_edge("summarization", "synthesis")

    # ── Phase 6 pipeline edges ─────────────────────────────────────────────────
    builder.add_edge("synthesis",     "gatekeeper")
    builder.add_edge("gatekeeper",    "auditor")
    builder.add_edge("auditor",       "strategist")
    builder.add_edge("strategist",    END)

    return builder.compile()


def run_agent_query(query: str, db, history: list = None) -> dict:
    if history is None:
        history = []

    assembled = assemble(query, history)

    scope = check_scope(assembled["query"])
    if not scope["in_scope"]:
        print(f"[scope_filter] rejected: {assembled['query']!r} — {scope['reason']}")
        return refusal_response()

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

    return {
        "answer":          result.get("final_answer", ""),
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
