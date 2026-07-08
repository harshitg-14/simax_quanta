"""
Calculation Agent — extracts numbers and performs financial/eligibility calculations.
"""
import re
from app.services.ai_service import _call


def calculation_agent(state: dict) -> dict:
    if "calculation" not in state.get("plan", {}).get("agents_needed", []):
        return {}

    query = state["query"]
    chunks = state.get("vector_chunks", [])

    # Extract all numeric content from chunks
    numeric_chunks = []
    for c in chunks:
        text = c.get("chunk_text", "")
        if re.search(r'\d', text):
            numeric_chunks.append(c)

    context = _build_context(numeric_chunks[:6]) if numeric_chunks else _build_context(chunks[:4])

    prompt = f"""You are a Calculation Agent for a Government Financial Intelligence Platform.

User Query: {query}

Relevant Document Context:
{context}

Perform the following:
1. EXTRACT NUMBERS: List all numerical values found (amounts, percentages, dates, counts)
2. COMPUTE: If the query requires a calculation, show the working step by step
3. ELIGIBILITY CHECK: If the query asks who qualifies, list the conditions and check them
4. RESULT: Provide the final calculated answer clearly
5. FORMULA: If a formula is used, state it explicitly

Show your working. If no calculation is needed, summarize the numerical facts found.
Only use numbers explicitly stated in the context.
"""

    try:
        analysis = _call(prompt)
        outputs = dict(state.get("agent_outputs", {}))
        outputs["calculation"] = analysis
        agents_used = list(state.get("agents_used", []))
        agents_used.append("calculation")
        return {"agent_outputs": outputs, "agents_used": agents_used}
    except Exception as e:
        return {}


def _build_context(chunks: list) -> str:
    parts = []
    for c in chunks:
        prefix = f"[{c['heading_path']}]\n" if c.get("heading_path") else ""
        parts.append(f"{prefix}{c['chunk_text']}")
    return "\n\n---\n\n".join(parts) if parts else "No numerical context available."
