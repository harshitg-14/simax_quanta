"""
Prompt Assembler — resolves follow-up references and injects conversation history.
Sits between the API route and the agent orchestrator.
"""
from app.services.ai_service import _call

_MAX_HISTORY_TURNS = 6  # last 3 user+assistant pairs


def assemble(raw_query: str, history: list[dict]) -> dict:
    """
    Args:
        raw_query: the user's latest message
        history:   list of {"role": str, "content": str} dicts (most recent last)

    Returns:
        {
            "query":          str,   # rewritten (standalone) query, or original
            "original_query": str,   # raw user input, always unchanged
            "rewritten":      bool,  # True if the query was rewritten
            "history_block":  str,   # formatted history for injection into prompts
        }
    """
    if not history:
        return {
            "query":          raw_query,
            "original_query": raw_query,
            "rewritten":      False,
            "history_block":  "",
        }

    recent_history = history[-_MAX_HISTORY_TURNS:]
    history_block  = _format_history(recent_history)
    rewritten      = _rewrite_if_needed(raw_query, history_block)

    return {
        "query":          rewritten,
        "original_query": raw_query,
        "rewritten":      rewritten.strip().lower() != raw_query.strip().lower(),
        "history_block":  history_block,
    }


def _format_history(history: list[dict]) -> str:
    lines = []
    for msg in history:
        role    = msg.get("role", "unknown").capitalize()
        content = msg.get("content", "").strip()
        if content:
            lines.append(f"{role}: {content}")
    return "\n".join(lines)


def _rewrite_if_needed(query: str, history_block: str) -> str:
    prompt = f"""You are a query resolver for a government document intelligence system.

Conversation so far:
{history_block}

New user query: "{query}"

Task: Decide if this query is a follow-up that depends on the conversation above.

A query IS a follow-up if it:
- Uses pronouns (it, its, they, their, that, this, those, these) referring to something from the conversation
- Uses phrases like "tell me more", "what about", "how about", "and the", "also", "expand on that"
- Is too short or ambiguous to understand without the prior context
- References "the previous", "the above", "the mentioned", "the same"

If it IS a follow-up: rewrite it as a fully self-contained, explicit question by expanding all pronouns
and implicit references using the conversation context. The rewritten query must be answerable by a search
engine that has never seen the conversation.

If it is NOT a follow-up (already a standalone, complete question): return it exactly unchanged.

Return ONLY the final query text — no explanation, no quotes, no prefix, nothing else."""

    try:
        result = _call(prompt).strip()
        # Safety guard: reject if LLM returns an empty or absurdly long result
        if not result or len(result) > len(query) * 8:
            return query
        return result
    except Exception:
        return query
