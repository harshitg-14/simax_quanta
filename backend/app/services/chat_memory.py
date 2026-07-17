"""Per-session conversation history keyed by user ID (max 10 turns each)."""

_sessions: dict[str, list[dict]] = {}
_MAX_MESSAGES = 20  # 10 user + 10 assistant turns per session


def get_history(user_id: str) -> list[dict]:
    return list(_sessions.get(user_id, []))


def get_history_text(user_id: str) -> str:
    return "\n".join(
        f"{m['role']}: {m['content']}"
        for m in _sessions.get(user_id, [])
    )


def add_message(user_id: str, role: str, content: str):
    if user_id not in _sessions:
        _sessions[user_id] = []
    _sessions[user_id].append({"role": role, "content": content})
    if len(_sessions[user_id]) > _MAX_MESSAGES:
        _sessions[user_id].pop(0)


def clear_history(user_id: str):
    _sessions.pop(user_id, None)
