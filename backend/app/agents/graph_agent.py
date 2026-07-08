"""
Graph Agent — discovers relationships, entity networks, cross-document links via Neo4j.
"""
from app.services.ai_service import _call


def graph_agent(state: dict) -> dict:
    query     = state["query"]
    graph_ctx = state.get("graph_context", {})
    entities  = graph_ctx.get("entities", [])
    relationships = graph_ctx.get("relationships", [])

    # Skip only if graph has no data at all
    if not entities and not relationships:
        return {}


    entity_list = "\n".join(
        f"- {e.get('name', '')} ({e.get('type', 'Entity')})" for e in entities[:15]
    )
    rel_list = "\n".join(
        f"- {r.get('source', '')} --[{r.get('relation', '')}]--> {r.get('target', '')} ({r.get('target_type', '')})"
        for r in relationships[:20]
    )

    prompt = f"""You are a Knowledge Graph Agent for a Government Intelligence Platform.

User Query: {query}

Entities found in the knowledge graph:
{entity_list if entity_list else "None"}

Relationships found:
{rel_list if rel_list else "None"}

Based on the knowledge graph data above:
1. ENTITY NETWORK: Describe the key entities and their types
2. RELATIONSHIPS: Explain how these entities are connected
3. CROSS-DOCUMENT LINKS: Identify which departments/schemes/policies are interrelated
4. INSIGHTS: What does this relationship network tell us about the query?

Focus on government-relevant relationships. Be concise and structured.
"""

    try:
        analysis = _call(prompt)
        outputs = dict(state.get("agent_outputs", {}))
        outputs["graph"] = analysis
        agents_used = list(state.get("agents_used", []))
        agents_used.append("graph")
        return {"agent_outputs": outputs, "agents_used": agents_used}
    except Exception as e:
        return {}
