"""
Phase 3 + 7 — Knowledge Graph Routes
"""
import re
import json
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel

from app.auth.security import get_current_user
from app.services.graph_service import (
    query_graph, search_graph, search_by_relation,
    get_document_graph, get_driver,
    find_entity_path, get_entity_types, get_relation_types,
    export_full_graph, get_graph_config, save_graph_config,
    get_configured_entity_types, get_configured_relation_types,
    _valid_neo4j_label,
)

router = APIRouter(prefix="/graph", tags=["Knowledge Graph"])


# ── Entity search ─────────────────────────────────────────────────────────────

@router.get("/entity/{entity_name}")
def get_entity(
    entity_name: str,
    hops: int = Query(default=1, ge=1, le=3, description="Traversal depth (1–3 hops)"),
    current_user: dict = Depends(get_current_user),
):
    """Get relationships for a named entity. Use ?hops=2 for multi-hop traversal."""
    try:
        return query_graph(entity_name, hops=hops)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search")
def search_entities(
    q: str = Query(..., description="Search term"),
    type: str = Query(default=None, description="Filter by entity type (e.g. Ministry, Scheme)"),
    current_user: dict = Depends(get_current_user),
):
    """Search entities by name with optional entity type filter."""
    try:
        results = search_graph(q, entity_type=type)
        return {"query": q, "type_filter": type, "results": results, "count": len(results)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search/relationships")
def search_by_relationship_type(
    relation_type: str = Query(..., description="Relationship type e.g. FUNDS, TARGETS"),
    current_user: dict = Depends(get_current_user),
):
    """Find all entity pairs connected by a specific relationship type."""
    try:
        results = search_by_relation(relation_type.strip().upper())
        return {
            "relation_type": relation_type.upper(),
            "results": results,
            "count": len(results),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Path finding ──────────────────────────────────────────────────────────────

@router.get("/path")
def entity_path(
    from_entity: str = Query(..., description="Source entity name"),
    to_entity: str   = Query(..., description="Target entity name"),
    current_user: dict = Depends(get_current_user),
):
    """Find the shortest path between two entities (up to 6 hops)."""
    try:
        return find_entity_path(from_entity, to_entity)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Type metadata ─────────────────────────────────────────────────────────────

@router.get("/types")
def entity_types(current_user: dict = Depends(get_current_user)):
    """Return all distinct entity types present in the graph with counts."""
    try:
        return {"types": get_entity_types()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/relation-types")
def relation_types(current_user: dict = Depends(get_current_user)):
    """Return all distinct relationship types present in the graph with counts."""
    try:
        return {"relation_types": get_relation_types()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Custom types config (admin only) ─────────────────────────────────────────

class TypePayload(BaseModel):
    name: str


@router.get("/config")
def graph_config(current_user: dict = Depends(get_current_user)):
    """Return the current configured entity and relationship types."""
    return get_graph_config()


@router.post("/config/entity-types")
def add_entity_type(payload: TypePayload, current_user: dict = Depends(get_current_user)):
    """Add a custom entity type (admin only)."""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    name = payload.name.strip()
    if not name or not _valid_neo4j_label(name):
        raise HTTPException(status_code=400, detail="Invalid type name — must start with a letter, letters/digits/underscores only")
    cfg = get_graph_config()
    if name not in cfg["entity_types"]:
        cfg["entity_types"].append(name)
        save_graph_config(cfg)
    return {"message": f"Entity type '{name}' added", "entity_types": cfg["entity_types"]}


@router.delete("/config/entity-types/{type_name}")
def remove_entity_type(type_name: str, current_user: dict = Depends(get_current_user)):
    """Remove a custom entity type (admin only). Built-in types cannot be removed."""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    builtin = {"Ministry", "Scheme", "Beneficiary", "Department", "Location", "Organization", "Policy", "Act"}
    if type_name in builtin:
        raise HTTPException(status_code=400, detail=f"Cannot remove built-in type '{type_name}'")
    cfg = get_graph_config()
    if type_name in cfg["entity_types"]:
        cfg["entity_types"].remove(type_name)
        save_graph_config(cfg)
    return {"message": f"Entity type '{type_name}' removed", "entity_types": cfg["entity_types"]}


@router.post("/config/relation-types")
def add_relation_type(payload: TypePayload, current_user: dict = Depends(get_current_user)):
    """Add a custom relationship type (admin only). Must be UPPER_SNAKE_CASE."""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    name = payload.name.strip().upper()
    if not name or not re.match(r'^[A-Z][A-Z0-9_]*$', name):
        raise HTTPException(status_code=400, detail="Invalid relation type — must be UPPER_SNAKE_CASE (e.g. OVERSEES)")
    cfg = get_graph_config()
    if name not in cfg["relation_types"]:
        cfg["relation_types"].append(name)
        save_graph_config(cfg)
    return {"message": f"Relation type '{name}' added", "relation_types": cfg["relation_types"]}


@router.delete("/config/relation-types/{type_name}")
def remove_relation_type(type_name: str, current_user: dict = Depends(get_current_user)):
    """Remove a custom relationship type (admin only). Built-in types cannot be removed."""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    builtin = {"FUNDS", "TARGETS", "IMPLEMENTS", "LAUNCHED_BY", "BENEFITS", "PART_OF", "LOCATED_IN", "GOVERNED_BY"}
    if type_name.upper() in builtin:
        raise HTTPException(status_code=400, detail=f"Cannot remove built-in type '{type_name}'")
    cfg = get_graph_config()
    upper = type_name.upper()
    if upper in cfg["relation_types"]:
        cfg["relation_types"].remove(upper)
        save_graph_config(cfg)
    return {"message": f"Relation type '{upper}' removed", "relation_types": cfg["relation_types"]}


# ── Export ────────────────────────────────────────────────────────────────────

@router.get("/export")
def export_graph(current_user: dict = Depends(get_current_user)):
    """Export the full knowledge graph as a downloadable JSON file."""
    try:
        data = export_full_graph()
        content = json.dumps(data, ensure_ascii=False, indent=2)
        return Response(
            content=content,
            media_type="application/json",
            headers={"Content-Disposition": "attachment; filename=knowledge_graph.json"},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Document graph ────────────────────────────────────────────────────────────

@router.get("/document/{document_id}")
def document_graph(document_id: str, current_user: dict = Depends(get_current_user)):
    """Get full knowledge graph for a document."""
    try:
        return get_document_graph(document_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Visualization ─────────────────────────────────────────────────────────────

@router.get("/viz")
def graph_viz(
    limit: int = Query(default=80, ge=10, le=2000),
    entity_type: str = Query(default=None, description="Filter by entity type"),
    current_user: dict = Depends(get_current_user),
):
    """Return entities and relationships in React Flow node/edge format."""
    try:
        driver = get_driver()
        nodes, edges = [], []
        node_ids = set()

        all_entity_types = get_configured_entity_types()
        # Build a color map that covers built-in + any custom types
        BASE_COLORS = [
            "#3b82f6", "#8b5cf6", "#f59e0b", "#10b981",
            "#ec4899", "#06b6d4", "#f97316", "#6b7280",
            "#84cc16", "#ef4444", "#a78bfa", "#34d399",
        ]
        TYPE_COLOR = {t: BASE_COLORS[i % len(BASE_COLORS)] for i, t in enumerate(all_entity_types)}
        TYPE_COLOR.setdefault("Entity", "#374151")

        valid_entity_types = set(all_entity_types)

        with driver.session() as session:
            if entity_type and entity_type in valid_entity_types and _valid_neo4j_label(entity_type):
                result = session.run(
                    f"""
                    MATCH (n:{entity_type})-[r]-(m)
                    WHERE NOT m:Document
                    RETURN n.name AS src, labels(n) AS src_type,
                           type(r) AS rel,
                           m.name AS tgt, labels(m) AS tgt_type
                    LIMIT $lim
                    """,
                    lim=limit
                )
            else:
                result = session.run(
                    """
                    MATCH (n)-[r]-(m)
                    WHERE NOT n:Document AND NOT m:Document
                    RETURN n.name AS src, labels(n) AS src_type,
                           type(r) AS rel,
                           m.name AS tgt, labels(m) AS tgt_type
                    LIMIT $lim
                    """,
                    lim=limit
                )

            for rec in result:
                src, tgt = rec["src"], rec["tgt"]
                src_type = (rec["src_type"] or ["Entity"])[0]
                tgt_type = (rec["tgt_type"] or ["Entity"])[0]

                if src and src not in node_ids:
                    nodes.append({
                        "id":   src,
                        "data": {"label": src, "type": src_type},
                        "style": {
                            "background": TYPE_COLOR.get(src_type, "#374151"),
                            "color": "#fff", "border": "none",
                            "borderRadius": "8px", "fontSize": "11px",
                            "padding": "6px 10px",
                        }
                    })
                    node_ids.add(src)

                if tgt and tgt not in node_ids:
                    nodes.append({
                        "id":   tgt,
                        "data": {"label": tgt, "type": tgt_type},
                        "style": {
                            "background": TYPE_COLOR.get(tgt_type, "#374151"),
                            "color": "#fff", "border": "none",
                            "borderRadius": "8px", "fontSize": "11px",
                            "padding": "6px 10px",
                        }
                    })
                    node_ids.add(tgt)

                if src and tgt:
                    edges.append({
                        "id":     f"{src}__{rec['rel']}__{tgt}",
                        "source": src,
                        "target": tgt,
                        "label":  rec["rel"].replace("_", " ").title(),
                        "style":  {"stroke": "#4b5563"},
                        "labelStyle": {"fontSize": "10px", "fill": "#9ca3af"},
                    })

        return {
            "nodes": nodes,
            "edges": edges,
            "total_nodes": len(nodes),
            "total_edges": len(edges),
            "entity_type_filter": entity_type,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
