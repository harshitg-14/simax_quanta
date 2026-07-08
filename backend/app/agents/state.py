from typing import TypedDict


class AgentState(TypedDict):
    # Phase 5 — Multi-Agent
    query: str             # assembled (potentially rewritten) query
    original_query: str    # raw user input before rewriting
    history_block: str     # formatted conversation history for prompt injection
    plan: dict             # planner: intent, agents_needed, entities, query_type
    vector_chunks: list    # retrieved from pgvector
    graph_context: dict    # retrieved from neo4j
    agent_outputs: dict    # { "legal": "...", "financial": "...", ... }
    final_answer: str
    search_mode: str       # "semantic" | "keyword"
    sources: list          # document_ids used
    agents_used: list      # which agents ran
    confidence: str        # "high" | "medium" | "low"

    # Phase 6 — Validation Layer
    validation: dict       # { "gatekeeper": {...}, "auditor": {...}, "strategist": {...} }
    escalate: bool         # True if response needs human review
