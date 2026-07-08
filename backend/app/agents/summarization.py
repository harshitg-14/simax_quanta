"""
Summarization Agent — produces document summaries and executive overviews.
"""
from app.services.ai_service import _call


def summarization_agent(state: dict) -> dict:
    if "summarization" not in state.get("plan", {}).get("agents_needed", []):
        return {}

    query = state["query"]
    chunks = state.get("vector_chunks", [])
    context = _build_context(chunks[:12])

    prompt = f"""You are a Summarization Agent for a Government Knowledge Platform.

User Request: {query}

Document Content:
{context}

Provide:
1. EXECUTIVE SUMMARY: 3-4 sentence overview of the key topic
2. KEY POINTS: 5-7 bullet points of the most important facts
3. SCOPE & APPLICABILITY: Who does this affect and in what context
4. KEY DATES & DEADLINES: Any important timeline information
5. RELATED ENTITIES: Government bodies, schemes, or acts mentioned

Keep the summary clear, factual, and suitable for a government officer briefing.
Base everything strictly on the provided document content.
"""

    try:
        analysis = _call(prompt)
        outputs = dict(state.get("agent_outputs", {}))
        outputs["summarization"] = analysis
        agents_used = list(state.get("agents_used", []))
        agents_used.append("summarization")
        return {"agent_outputs": outputs, "agents_used": agents_used}
    except Exception as e:
        return {}


def _build_context(chunks: list) -> str:
    parts = []
    for c in chunks:
        prefix = f"[{c['heading_path']}]\n" if c.get("heading_path") else ""
        parts.append(f"{prefix}{c['chunk_text']}")
    return "\n\n---\n\n".join(parts) if parts else "No content available."
