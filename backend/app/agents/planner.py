"""
Planner Agent — analyzes user query and creates an execution plan.
Decides which specialist agents are needed.
"""
import json
from app.services.ai_service import _call


def plan_query(state: dict) -> dict:
    query         = state["query"]
    history_block = state.get("history_block", "")

    history_section = (
        f"\nConversation History (for context):\n{history_block}\n"
        if history_block else ""
    )

    prompt = f"""You are a Planner Agent for a Government Knowledge Intelligence Platform.

Analyze this user query and return ONLY valid JSON — no markdown, no explanation.
{history_section}
Query: "{query}"

Return:
{{
  "query_type": "legal|financial|graph|calculation|general|multi",
  "intent": "one sentence describing what the user wants",
  "agents_needed": ["list of agents from: legal, financial, graph, calculation, summarization"],
  "entities": ["key entities/terms mentioned e.g. PM-KISAN, Ministry of Finance"],
  "complexity": "simple|moderate|complex",
  "requires_calculation": false,
  "requires_cross_document": false
}}

Rules:
- Use "legal" for policy interpretation, act references, amendments, legal clauses
- Use "financial" for budgets, amounts, pension, schemes, financial orders
- Use "graph" for relationships between entities, who issued what, cross-department
- Use "calculation" for numerical computations, eligibility checks, amount calculations
- Use "summarization" for summarize/overview/explain type questions
- Multiple agents can be needed for complex queries
- For simple factual queries, agents_needed can be empty (direct synthesis)
- Use the conversation history to resolve ambiguous intent, but classify based on the current query
"""

    try:
        raw = _call(prompt).strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        plan = json.loads(raw.strip())
    except Exception:
        plan = {
            "query_type": "general",
            "intent": query,
            "agents_needed": [],
            "entities": [],
            "complexity": "simple",
            "requires_calculation": False,
            "requires_cross_document": False,
        }

    return {"plan": plan, "agents_used": []}
