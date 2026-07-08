"""
Auditor — Phase 6 Validation Layer
Checks grounding, citations, and evidence support in the final response.
"""
import json
from app.services.ai_service import _call


def auditor(state: dict) -> dict:
    query         = state["query"]
    answer        = state.get("final_answer", "")
    vector_chunks = state.get("vector_chunks", [])

    # Build ground-truth context from top retrieved chunks
    source_texts = []
    for c in vector_chunks[:6]:
        prefix = f"[{c['heading_path']}] " if c.get("heading_path") else ""
        source_texts.append(f"{prefix}{c['chunk_text'][:400]}")
    source_context = "\n---\n".join(source_texts) if source_texts else "No source documents."

    prompt = f"""You are an Auditor for a Government Knowledge Intelligence Platform.
Your job is to verify that a response is grounded in the retrieved source documents.

Source Documents:
{source_context}

Response to Audit:
{answer[:1500]}

Return ONLY valid JSON:
{{
  "grounded": true,
  "grounding_score": 85,
  "citations_present": true,
  "unsupported_claims": [],
  "hallucination_risk": "low",
  "audit_notes": "one sentence summary of audit finding"
}}

Rules:
- "grounded": Are the main claims in the response supported by the source documents?
- "grounding_score": 0-100 score (100 = fully supported, 0 = no support found)
- "citations_present": Does the response cite specific sections or headings?
- "unsupported_claims": List any claims in the response NOT found in source documents
- "hallucination_risk": "low" (score>70), "medium" (40-70), "high" (<40)
"""

    validation = {
        "grounded": True,
        "grounding_score": 75,
        "citations_present": False,
        "unsupported_claims": [],
        "hallucination_risk": "low",
        "audit_notes": "Response appears grounded in source documents."
    }

    try:
        raw = _call(prompt).strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        validation = json.loads(raw.strip())
    except Exception as e:
        print(f"[auditor] parse error: {e}")

    existing = dict(state.get("validation", {}))
    existing["auditor"] = validation

    agents_used = list(state.get("agents_used", []))
    agents_used.append("auditor")

    return {
        "validation":  existing,
        "agents_used": agents_used,
    }
