"""
Synthesis Agent — merges all specialist agent outputs into a single coherent answer.
"""
from app.services.ai_service import _call

_MAX_AGENT_OUTPUT = 2000   # chars per agent output
_MAX_CONTEXT      = 6000   # chars of raw vector context


def synthesis_agent(state: dict) -> dict:
    query         = state["query"]
    history_block = state.get("history_block", "")
    plan          = state.get("plan", {})
    agent_outputs = state.get("agent_outputs", {})
    vector_chunks = state.get("vector_chunks", [])

    # Determine confidence from chunk count (before any potential failure)
    if len(vector_chunks) >= 5:
        confidence = "high"
    elif vector_chunks:
        confidence = "medium"
    else:
        confidence = "low"

    # Build combined agent section (truncate each to avoid token overflow)
    agent_sections = []
    for name, output in agent_outputs.items():
        if output:
            truncated = output[:_MAX_AGENT_OUTPUT]
            if len(output) > _MAX_AGENT_OUTPUT:
                truncated += "\n[... truncated ...]"
            agent_sections.append(f"=== {name.upper()} AGENT ===\n{truncated}")

    history_section = (
        f"\nConversation History:\n{history_block}\n"
        if history_block else ""
    )

    if not agent_sections:
        # Pure RAG fallback — no specialist agents ran
        context = _build_raw_context(vector_chunks[:8])[:_MAX_CONTEXT]
        prompt = f"""You are Simax Quanta — a Government Knowledge Intelligence assistant.
{history_section}
Answer the question below using ONLY the document context provided.
Cite section headings (e.g. "Chapter 2 > Section 4") when referencing content.
If the answer is not in the context, say: "Information not found in uploaded documents."
If the question is a follow-up, use the conversation history above to understand context.

Context:
{context}

Question: {query}"""
    else:
        combined = "\n\n".join(agent_sections)
        intent   = plan.get("intent", query)
        prompt = f"""You are Simax Quanta — a Government Knowledge Intelligence Platform.
{history_section}
User Query: {query}
Intent: {intent}

Specialist Agent Findings:
{combined}

Synthesize the above into ONE clear, well-structured answer:
1. Lead with the direct answer to the query
2. Support with specific facts and figures from the agents
3. Cite document sections/headings as evidence where mentioned
4. If this is a follow-up to the conversation history, ensure continuity with prior answers
5. Close with: CONFIDENCE: High | Medium | Low

Keep the response concise and professional. Suitable for a government officer."""

    try:
        answer = _call(prompt)
        return {"final_answer": answer, "confidence": confidence}

    except Exception as e:
        err_msg = str(e)
        print(f"[synthesis_agent] ERROR: {err_msg}")

        # Try a minimal fallback prompt
        try:
            fallback_context = _build_raw_context(vector_chunks[:5])[:3000]
            fallback_prompt = f"""Answer this government query using the document context below.
Context: {fallback_context}
Question: {query}
Give a brief, direct answer."""
            answer = _call(fallback_prompt)
            return {"final_answer": answer, "confidence": "medium"}
        except Exception as e2:
            print(f"[synthesis_agent] FALLBACK ERROR: {e2}")
            return {
                "final_answer": f"Unable to generate response. Error: {err_msg}",
                "confidence": "low"
            }


def _build_raw_context(chunks: list) -> str:
    parts = []
    for c in chunks:
        prefix = f"[{c['heading_path']}]\n" if c.get("heading_path") else ""
        parts.append(f"{prefix}{c['chunk_text']}")
    return "\n\n---\n\n".join(parts) if parts else "No documents found."
