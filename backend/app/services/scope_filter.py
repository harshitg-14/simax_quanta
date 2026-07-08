"""
Scope Filter — pre-pipeline guard that rejects out-of-scope queries before any agents run.
Only government documents, policies, schemes, regulations, and acts are in scope.
"""
from app.services.ai_service import _call

_REFUSAL = (
    "I can only answer questions about the government documents, policies, schemes, "
    "regulations, and acts available in this system. Please ask something related to "
    "the uploaded documents."
)


def check_scope(query: str) -> dict:
    """
    Returns:
        {"in_scope": bool, "reason": str}

    Fast single LLM call. Short-circuits the entire pipeline for off-topic queries.
    """
    prompt = f"""You are a scope validator for a Government Document Intelligence system.
The system ONLY answers questions about:
- Indian government policies, schemes, acts, regulations, and circulars
- Government ministries, departments, and their documents
- Budget allocations, financial orders, and government notifications
- Legal provisions and amendments in government acts
- Beneficiaries, eligibility criteria, and implementation of government schemes
- Any follow-up or clarification about the above topics

You must return ONLY valid JSON — no markdown, no explanation:
{{"in_scope": true, "reason": "brief reason"}}

Query: "{query}"

Rules:
- Return in_scope: true for ANYTHING even loosely related to government documents, policies, schemes, or regulations
- Return in_scope: true for follow-up questions even if short (they were already rewritten to be explicit)
- Return in_scope: false ONLY for clearly unrelated topics: general trivia, personal advice, entertainment, science (not govt policy), coding help, weather, sports, jokes, creative writing, math problems, or any non-government topic
- When in doubt, return in_scope: true"""

    try:
        raw = _call(prompt).strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        import json
        result = json.loads(raw.strip())
        return {
            "in_scope": bool(result.get("in_scope", True)),
            "reason":   result.get("reason", ""),
        }
    except Exception:
        # On any failure, allow the query through — never block valid queries by mistake
        return {"in_scope": True, "reason": "filter error — defaulting to allow"}


def refusal_response() -> dict:
    """Standard out-of-scope refusal payload matching run_agent_query's return shape."""
    return {
        "answer":          _REFUSAL,
        "plan":            {},
        "agents_used":     ["scope_filter"],
        "search_mode":     "none",
        "sources":         [],
        "confidence":      "high",
        "chunks_used":     0,
        "graph_entities":  0,
        "validation":      {"scope_filter": {"in_scope": False}},
        "escalate":        False,
        "query_rewritten": False,
        "resolved_query":  "",
        "out_of_scope":    True,
    }
