"""
Financial Agent — analyzes budgets, amounts, pension schemes, financial orders.
"""
from app.services.ai_service import _call


def financial_agent(state: dict) -> dict:
    if "financial" not in state.get("plan", {}).get("agents_needed", []):
        return {}

    query = state["query"]
    chunks = state.get("vector_chunks", [])
    context = _build_context(chunks)

    prompt = f"""You are a Financial Analysis Agent specializing in government finance and schemes.

Query: {query}

Document Context:
{context}

Provide a structured financial analysis:
1. KEY FINANCIAL FIGURES: Extract all monetary amounts, budgets, allocations mentioned
2. SCHEME DETAILS: Describe the financial scheme/order including eligibility and benefits
3. BENEFICIARIES: Who receives what amount and under what conditions
4. TIMELINE: Disbursement schedule, deadlines, validity periods
5. SOURCE REFERENCES: Cite heading paths where figures were found

Be precise about numbers. Format amounts clearly (e.g. ₹6000/year, ₹2000/installment).
Only use information explicitly present in the context.
"""

    try:
        analysis = _call(prompt)
        outputs = dict(state.get("agent_outputs", {}))
        outputs["financial"] = analysis
        agents_used = list(state.get("agents_used", []))
        agents_used.append("financial")
        return {"agent_outputs": outputs, "agents_used": agents_used}
    except Exception as e:
        return {}


def _build_context(chunks: list, limit: int = 6) -> str:
    parts = []
    for c in chunks[:limit]:
        prefix = f"[{c['heading_path']}]\n" if c.get("heading_path") else ""
        parts.append(f"{prefix}{c['chunk_text']}")
    return "\n\n---\n\n".join(parts) if parts else "No context available."
