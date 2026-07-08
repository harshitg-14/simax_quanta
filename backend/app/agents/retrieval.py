"""
Retrieval Node — fetches context from pgvector (semantic) and Neo4j (graph).
Always runs after planner before any specialist agent.
"""
from sqlalchemy import text
from app.services.embedding_service import embed_query
from app.services.graph_service import search_graph, query_graph


def retrieve_context(state: dict, db) -> dict:
    query = state["query"]
    plan = state.get("plan", {})
    entities = plan.get("entities", [])

    # ── Vector retrieval ──────────────────────────────────────────────────────
    vector_chunks = []
    search_mode = "keyword"
    sources = []

    try:
        q_emb = embed_query(query)
        sql = text("""
            SELECT id, document_id, chunk_text, heading_path, chunk_type,
                   1 - (embedding <=> CAST(:emb AS vector)) AS similarity
            FROM document_chunks
            WHERE embedding IS NOT NULL
            ORDER BY embedding <=> CAST(:emb AS vector)
            LIMIT 20
        """)
        rows = db.execute(sql, {"emb": str(q_emb)}).fetchall()
        if rows:
            vector_chunks = [
                {
                    "chunk_text":   r.chunk_text,
                    "heading_path": r.heading_path or "",
                    "document_id":  r.document_id,
                    "similarity":   round(float(r.similarity), 4),
                    "chunk_type":   r.chunk_type or "text",
                }
                for r in rows
            ]
            sources = list({r.document_id for r in rows})
            search_mode = "semantic"
    except Exception as e:
        print(f"Vector retrieval error: {e}")

    # ── Graph retrieval ───────────────────────────────────────────────────────
    graph_context = {"entities": [], "relationships": []}

    try:
        all_entities = []
        all_rels = []

        search_terms = entities[:3] if entities else []
        # Also extract key nouns from query
        if not search_terms:
            words = [w for w in query.split() if len(w) > 4][:3]
            search_terms = words

        for term in search_terms:
            found = search_graph(term)
            for e in found:
                if e not in all_entities:
                    all_entities.append(e)
            if all_entities:
                detail = query_graph(term)
                for r in detail.get("relationships", []):
                    if r not in all_rels:
                        all_rels.append(r)

        graph_context = {"entities": all_entities[:15], "relationships": all_rels[:20]}
    except Exception as e:
        print(f"Graph retrieval error: {e}")

    return {
        "vector_chunks": vector_chunks,
        "graph_context": graph_context,
        "search_mode":   search_mode,
        "sources":       sources,
    }
