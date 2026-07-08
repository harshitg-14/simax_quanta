"""Per-session in-memory conversation history (max 10 turns)."""

_history: list[dict] = []


def add_message(role: str, content: str):
    _history.append({"role": role, "content": content})
    if len(_history) > 20:
        _history.pop(0)


def get_history() -> list[dict]:
    return _history


def get_history_text() -> str:
    return "\n".join(f"{m['role']}: {m['content']}" for m in _history)


def clear_history():
    _history.clear()
