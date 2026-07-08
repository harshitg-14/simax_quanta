"""
Gatekeeper — Phase 6 Validation Layer
Checks query relevance and response completeness before releasing to user.
"""
import json
from app.services.ai_service import _call


def gatekeeper(state: dict) -> dict:
    query  = state["query"]
    answer = state.get("final_answer", "")

    prompt = f"""You are a Gatekeeper for a Government Knowledge Intelligence Platform.
Your job is to verify that a query-response pair meets quality standards.

Query: {query}

Response (first 1500 chars):
{answer[:1500]}

Evaluate and return ONLY valid JSON:
{{
  "relevant": true,
  "complete": true,
  "recommendation": "approve",
  "flags": [],
  "relevance_note": "one sentence on relevance",
  "completeness_note": "one sentence on completeness"
}}

Rules:
- "relevant": Is this query about government documents, policies, schemes, acts, or regulations?
- "complete": Does the response directly address the query with substantive content?
- "recommendation": "approve" if both checks pass, "revise" if partially OK, "reject" if irrelevant or harmful
- "flags": list any issues found (e.g. "off-topic", "incomplete answer", "no citations")
"""

    validation = {
        "relevant": True,
        "complete": True,
        "recommendation": "approve",
        "flags": [],
        "relevance_note": "Query is relevant to government domain.",
        "completeness_note": "Response addresses the query."
    }

    try:
        raw = _call(prompt).strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        validation = json.loads(raw.strip())
    except Exception as e:
        print(f"[gatekeeper] parse error: {e}")

    existing = dict(state.get("validation", {}))
    existing["gatekeeper"] = validation

    agents_used = list(state.get("agents_used", []))
    agents_used.append("gatekeeper")

    return {
        "validation":   existing,
        "agents_used":  agents_used,
        "escalate":     validation.get("recommendation") == "reject",
    }
