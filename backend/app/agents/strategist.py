"""
Strategist — Phase 6 Validation Layer
Checks for sensitive content, escalation requirements, and policy compliance.
"""
import json
from app.services.ai_service import _call


def strategist(state: dict) -> dict:
    query  = state["query"]
    answer = state.get("final_answer", "")
    plan   = state.get("plan", {})

    prompt = f"""You are a Strategic Advisor for a Government Knowledge Intelligence Platform.
Your role is to assess whether a query-response requires special handling or escalation.

Query: {query}
Query Type: {plan.get("query_type", "general")}

Response (first 800 chars):
{answer[:800]}

Return ONLY valid JSON:
{{
  "sensitive": false,
  "sensitivity_type": "none",
  "escalate": false,
  "escalation_reason": "",
  "safe_to_release": true,
  "advisory": "one sentence strategic note"
}}

Sensitivity types (choose one): "none", "financial", "legal", "political", "classified", "personal_data"
Escalate to human when:
- Query involves classified or restricted government information
- Response may have significant legal/financial implications
- Query involves personal citizen data
- Response contradicts official government policy
- Sensitive inter-departmental matters

Most queries will be safe_to_release: true with escalate: false.
"""

    validation = {
        "sensitive": False,
        "sensitivity_type": "none",
        "escalate": False,
        "escalation_reason": "",
        "safe_to_release": True,
        "advisory": "Standard government query — no special handling required."
    }

    try:
        raw = _call(prompt).strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        validation = json.loads(raw.strip())
    except Exception as e:
        print(f"[strategist] parse error: {e}")

    existing = dict(state.get("validation", {}))
    existing["strategist"] = validation

    agents_used = list(state.get("agents_used", []))
    agents_used.append("strategist")

    # If strategist flags escalation, override gatekeeper approval
    escalate = state.get("escalate", False) or validation.get("escalate", False)

    return {
        "validation":  existing,
        "agents_used": agents_used,
        "escalate":    escalate,
    }
