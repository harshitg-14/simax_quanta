"""
Legal Agent — analyzes queries involving acts, policies, amendments, legal clauses.
"""
from app.services.ai_service import _call


def legal_agent(state: dict) -> dict:
    if "legal" not in state.get("plan", {}).get("agents_needed", []):
        return {}

    query = state["query"]
    chunks = state.get("vector_chunks", [])
    context = _build_context(chunks)

    prompt = f"""You are a Legal Analysis Agent specializing in government policy and law.

Query: {query}

Document Context:
{context}

Provide a structured legal analysis:
1. RELEVANT LEGAL PROVISIONS: Cite specific acts, sections, clauses from the context
2. POLICY INTERPRETATION: Explain what the law/policy means in plain language
3. AMENDMENTS & VERSIONS: Note any amendments or version references found
4. APPLICABILITY: Who does this apply to and under what conditions
5. CITATIONS: List exact heading paths where this information was found

Be precise. Only reference what is explicitly in the provided context.
If the context doesn't contain legal content for this query, say so clearly.
"""

    try:
        analysis = _call(prompt)
        outputs = dict(state.get("agent_outputs", {}))
        outputs["legal"] = analysis
        agents_used = list(state.get("agents_used", []))
        agents_used.append("legal")
        return {"agent_outputs": outputs, "agents_used": agents_used}
    except Exception as e:
        return {}


def _build_context(chunks: list, limit: int = 6) -> str:
    parts = []
    for c in chunks[:limit]:
        prefix = f"[{c['heading_path']}]\n" if c.get("heading_path") else ""
        parts.append(f"{prefix}{c['chunk_text']}")
    return "\n\n---\n\n".join(parts) if parts else "No context available."
