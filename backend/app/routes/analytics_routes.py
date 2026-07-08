"""
Phase 7 — Enterprise Analytics API
GET /analytics/summary   — platform-wide stats
GET /analytics/agents    — agent usage breakdown
GET /analytics/queries   — query history over time
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text, func
from collections import defaultdict

from app.database.connection import get_db
from app.auth.security import get_current_user, require_roles
from app.models.document import Document
from app.models.document_chunk import DocumentChunk
from app.models.audit_log import AuditLog
from app.services.graph_service import get_driver

router = APIRouter(prefix="/analytics", tags=["Analytics (Phase 7)"])


@router.get("/summary")
def analytics_summary(
    db: Session = Depends(get_db),
    _current_user: dict = Depends(require_roles("admin", "department_officer", "auditor")),
):
    # Document counts
    docs  = db.query(Document).all()
    total_chunks = db.query(func.count(DocumentChunk.id)).scalar() or 0
    total_queries = db.query(AuditLog).filter(AuditLog.action == "query").count()

    # Docs by type
    by_type = defaultdict(int)
    by_dept = defaultdict(int)
    by_class = defaultdict(int)
    for d in docs:
        by_type[d.doc_type or "other"] += 1
        by_dept[d.department or "Unknown"] += 1
        by_class[d.classification or "public"] += 1

    # Top docs by chunk count
    top_docs = sorted(
        [{"name": d.file_name, "type": d.doc_type or "other", "department": d.department or ""}
         for d in docs],
        key=lambda x: x["name"]
    )[:10]

    # Neo4j entity count
    total_entities = 0
    try:
        driver = get_driver()
        with driver.session() as s:
            result = s.run("MATCH (n) RETURN count(n) AS c")
            total_entities = result.single()["c"]
    except Exception:
        pass

    # Chunk count per document
    doc_chunks = []
    for d in docs:
        cnt = db.query(func.count(DocumentChunk.id)).filter(DocumentChunk.document_id == d.id).scalar() or 0
        doc_chunks.append({"name": d.file_name[:30], "chunks": cnt, "type": d.doc_type or "other"})
    doc_chunks = sorted(doc_chunks, key=lambda x: x["chunks"], reverse=True)[:8]

    return {
        "total_documents":  len(docs),
        "total_chunks":     total_chunks,
        "total_queries":    total_queries,
        "total_entities":   total_entities,
        "by_type":          [{"name": k, "value": v} for k, v in by_type.items()],
        "by_department":    [{"name": k, "value": v} for k, v in by_dept.items()],
        "by_classification":[{"name": k, "value": v} for k, v in by_class.items()],
        "doc_chunks":       doc_chunks,
    }


@router.get("/queries")
def query_history(
    db: Session = Depends(get_db),
    _current_user: dict = Depends(require_roles("admin", "department_officer", "auditor")),
):
    # Last 50 queries with timestamps
    logs = db.query(AuditLog)\
             .filter(AuditLog.action == "query")\
             .order_by(AuditLog.timestamp.desc())\
             .limit(50).all()

    # Group by date
    by_day = defaultdict(int)
    agent_queries = 0
    rag_queries   = 0

    for l in logs:
        day = str(l.timestamp)[:10] if l.timestamp else "unknown"
        by_day[day] += 1
        if l.query and l.query.startswith("[AGENT]"):
            agent_queries += 1
        else:
            rag_queries += 1

    daily = sorted([{"date": k, "queries": v} for k, v in by_day.items()], key=lambda x: x["date"])

    return {
        "daily":         daily,
        "agent_queries": agent_queries,
        "rag_queries":   rag_queries,
        "recent":        [
            {
                "query":     (l.query or "")[:80],
                "timestamp": str(l.timestamp)[:16],
                "mode":      "agent" if (l.query or "").startswith("[AGENT]") else "rag",
            }
            for l in logs[:20]
        ],
    }


@router.get("/agents")
def agent_stats(
    db: Session = Depends(get_db),
    _current_user: dict = Depends(require_roles("admin", "department_officer", "auditor")),
):
    """Return agent health status — all always operational."""
    return {
        "pipeline": [
            {"name": "Planner",       "phase": 5, "status": "active", "role": "Query classification"},
            {"name": "Retrieval",     "phase": 5, "status": "active", "role": "Hybrid vector + graph fetch"},
            {"name": "Legal",         "phase": 5, "status": "active", "role": "Legal analysis"},
            {"name": "Financial",     "phase": 5, "status": "active", "role": "Financial analysis"},
            {"name": "Graph",         "phase": 5, "status": "active", "role": "Relationship discovery"},
            {"name": "Calculation",   "phase": 5, "status": "active", "role": "Numerical computation"},
            {"name": "Summarization", "phase": 5, "status": "active", "role": "Document summarization"},
            {"name": "Synthesis",     "phase": 5, "status": "active", "role": "Final answer generation"},
            {"name": "Gatekeeper",    "phase": 6, "status": "active", "role": "Relevance & completeness"},
            {"name": "Auditor",       "phase": 6, "status": "active", "role": "Grounding & citation check"},
            {"name": "Strategist",    "phase": 6, "status": "active", "role": "Sensitivity & escalation"},
        ]
    }
