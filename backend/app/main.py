from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy import text
from app.database.base import Base
from app.database.connection import engine

# noqa: F401 — imported to register models with SQLAlchemy metadata before create_all()
from app.models.user import User  # noqa: F401
from app.models.document import Document  # noqa: F401
from app.models.document_chunk import DocumentChunk  # noqa: F401
from app.models.audit_log import AuditLog  # noqa: F401

from app.routes.user_routes import router as auth_router
from app.routes.document_routes import router as document_router
from app.routes.graph_routes import router as graph_router
from app.routes.agent_routes import router as agent_router
from app.routes.analytics_routes import router as analytics_router

Base.metadata.create_all(bind=engine)

# Add new columns to existing tables without dropping them
with engine.connect() as _conn:
    _conn.execute(text("ALTER TABLE documents ADD COLUMN IF NOT EXISTS processing_status VARCHAR DEFAULT 'ready'"))
    _conn.execute(text("ALTER TABLE documents ADD COLUMN IF NOT EXISTS supersedes_id VARCHAR DEFAULT NULL"))
    _conn.execute(text("ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_hash VARCHAR DEFAULT NULL"))
    _conn.commit()

app = FastAPI(
    title="Simax Quanta",
    description="Government Knowledge Intelligence Platform — Phases 1–6",
    version="4.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(document_router)
app.include_router(graph_router)
app.include_router(agent_router)
app.include_router(analytics_router)


@app.on_event("startup")
def resume_stuck_processing():
    """On startup, resume any documents stuck in 'processing' state (e.g. after server restart)."""
    import threading
    from app.database.connection import SessionLocal
    from app.models.document import Document
    from app.models.document_chunk import DocumentChunk
    from app.routes.document_routes import _process_in_background

    db = SessionLocal()
    try:
        stuck = db.query(Document).filter(Document.processing_status == "processing").all()
        if not stuck:
            return
        print(f"[startup] Found {len(stuck)} document(s) stuck in processing — resuming...")
        for doc in stuck:
            chunks = db.query(DocumentChunk)\
                       .filter(DocumentChunk.document_id == doc.id)\
                       .order_by(DocumentChunk.chunk_index).all()
            chunk_dicts = [{"chunk_text": c.chunk_text, "heading_path": c.heading_path, "chunk_type": c.chunk_type} for c in chunks]
            chunk_ids   = [c.id for c in chunks]
            print(f"[startup] Resuming: {doc.file_name} ({len(chunks)} chunks)")
            t = threading.Thread(
                target=_process_in_background,
                args=(doc.id, doc.extracted_text or "", chunk_dicts, chunk_ids, doc.file_name),
                daemon=True,
            )
            t.start()
    finally:
        db.close()


@app.get("/", tags=["Health"])
def health():
    return {
        "platform": "Simax Quanta",
        "version":  "4.0.0",
        "status":   "running",
        "phases": {
            "phase_1": "Foundation — JWT Auth, RBAC, Document Ingestion, Structure-Aware Chunking, AI Metadata",
            "phase_2": "Semantic Search — BGE Large Embeddings, pgvector Cosine Similarity",
            "phase_3": "Knowledge Graph — Neo4j Entity Extraction, Relationship Mapping",
            "phase_4": "React Frontend — Dashboard, Documents, Chat, Graph, Audit Logs",
            "phase_5": "Multi-Agent Layer — LangGraph Planner + Legal + Financial + Graph + Calculation + Synthesis",
            "phase_6": "Validation Layer — Gatekeeper + Auditor + Strategist"
        }
    }
