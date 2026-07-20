import os
import re
import uuid
import hashlib
import threading
from typing import Optional
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.database.connection import get_db
from app.models.document import Document
from app.models.document_chunk import DocumentChunk
from app.models.audit_log import AuditLog
from app.services.document_parser import parse_document, SUPPORTED_EXTENSIONS
from app.services.ai_service import enrich_metadata, answer_question
from app.services.embedding_service import embed_query, embed_batch
from app.services.graph_service import extract_entities, store_graph, delete_document_graph, search_graph, query_graph
from app.services.chat_memory import add_message, get_history_text, clear_history
from app.services.cache import flush_all as flush_query_cache
from app.auth.security import get_current_user, require_roles

router = APIRouter(prefix="/documents", tags=["Documents"])

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

_STOP = {
    "what", "is", "are", "the", "a", "an", "of", "in", "on", "for",
    "to", "do", "does", "how", "why", "when", "where", "which", "who",
    "tell", "me", "about", "give", "and", "or", "was", "were", "has",
    "have", "had", "can", "could", "would", "should", "its", "this"
}


# ── Per-section graph extraction (paid API) ───────────────────────────────────

def _extract_graph_by_section(valid_chunks: list, document_id: str, file_name: str,
                               summary: str, all_entities: list, all_relationships: list) -> int:
    """
    Group chunks by top-level heading, run one Gemini extraction call per section.
    Accumulates results into all_entities / all_relationships and stores in Neo4j.
    Returns number of sections processed.
    """
    # Build sections: each top-level heading starts a new section
    sections = []
    current_heading = "General"
    current_chunks  = []

    for c in valid_chunks:
        if c.get("chunk_type") == "heading":
            # Save previous section if it has content
            if current_chunks:
                sections.append((current_heading, current_chunks))
            current_heading = c["chunk_text"]
            current_chunks  = [c]
        else:
            current_chunks.append(c)

    if current_chunks:
        sections.append((current_heading, current_chunks))

    # Merge very small sections with their neighbours (< 3 chunks)
    merged, buf_h, buf_c = [], None, []
    for h, chunks in sections:
        if buf_h is None:
            buf_h, buf_c = h, chunks
        elif len(buf_c) < 3:
            buf_c += chunks          # merge small section into previous
        else:
            merged.append((buf_h, buf_c))
            buf_h, buf_c = h, chunks
    if buf_h:
        merged.append((buf_h, buf_c))
    sections = merged

    # Section limit: configurable via MAX_GRAPH_SECTIONS env var (default 30)
    _max_sections = int(os.getenv("MAX_GRAPH_SECTIONS", 30))
    step = max(1, len(sections) // _max_sections)
    sections_to_process = sections[::step][:_max_sections]

    print(f"[graph] {file_name}: {len(sections)} sections → processing {len(sections_to_process)}")

    seen_entity_names = set()

    for i, (heading, chunks) in enumerate(sections_to_process):
        section_text  = f"Document context: {summary[:300]}\n\nSection: {heading}\n\n"
        section_text += "\n".join(c["chunk_text"][:300] for c in chunks[:15])
        section_text  = section_text[:5000]

        try:
            result    = extract_entities(section_text, document_id, heading)
            entities  = result.get("entities", [])
            relations = result.get("relationships", [])

            # Deduplicate entities by name (case-insensitive)
            unique_entities = []
            for e in entities:
                key = e.get("name", "").lower().strip()
                if key and key not in seen_entity_names:
                    seen_entity_names.add(key)
                    unique_entities.append(e)

            all_entities.extend(unique_entities)
            all_relationships.extend(relations)

            if unique_entities:
                store_graph(document_id, file_name, unique_entities, relations)

            print(f"[graph]   section {i+1}/{len(sections_to_process)}: "
                  f"'{heading[:40]}' → {len(unique_entities)} entities, {len(relations)} rels")

        except Exception as e:
            print(f"[graph]   section {i+1} failed: {e}")
            continue

    print(f"[graph] Done: {len(all_entities)} total entities, {len(all_relationships)} total relationships")
    return len(sections_to_process)


# ── Background processing ─────────────────────────────────────────────────────

def _process_in_background(document_id: str, extracted_text: str, valid_chunks: list,
                            chunk_ids: list, file_name: str):
    """Runs in a thread: embed chunks + enrich metadata + build graph."""
    from app.database.connection import SessionLocal
    db = SessionLocal()
    try:
        # 1. Embed all chunks in batch
        chunk_texts = [c["chunk_text"] for c in valid_chunks]
        embeddings  = embed_batch(chunk_texts) if chunk_texts else []
        for cid, emb in zip(chunk_ids, embeddings):
            db.query(DocumentChunk).filter(DocumentChunk.id == cid).update(
                {"embedding": emb}, synchronize_session=False
            )
        db.commit()

        # 2. AI metadata enrichment — save immediately so it's never lost
        meta = enrich_metadata(extracted_text)
        doc = db.query(Document).filter(Document.id == document_id).first()
        if doc:
            doc.ai_summary     = meta["summary"]
            doc.ai_keywords    = meta["keywords"]
            doc.doc_type       = meta["doc_type"]
            doc.department     = meta["department"]
            doc.version        = meta["version"]
            doc.issue_date     = meta["issue_date"]
            doc.effective_date = meta["effective_date"]
            doc.classification = meta["classification"]

            # Version Intelligence: find older doc from same dept + doc_type
            if meta["department"] and meta["issue_date"]:
                older = (
                    db.query(Document)
                    .filter(
                        Document.id         != document_id,
                        Document.department == meta["department"],
                        Document.doc_type   == meta["doc_type"],
                        Document.issue_date.isnot(None),
                        Document.issue_date != "",
                        Document.issue_date <  meta["issue_date"],
                    )
                    .order_by(Document.issue_date.desc())
                    .first()
                )
                if older:
                    doc.supersedes_id = older.id
                    print(f"[bg] Version detected: {file_name} supersedes {older.file_name}")
        db.commit()

        # 3. Per-section graph extraction — isolated, failure won't lose metadata
        all_entities, all_relationships = [], []
        try:
            _extract_graph_by_section(
                valid_chunks, document_id, file_name, meta["summary"],
                all_entities, all_relationships
            )
        except Exception as ge:
            print(f"[bg] Graph extraction error for {file_name}: {ge}")

        # 4. Mark as ready
        doc = db.query(Document).filter(Document.id == document_id).first()
        if doc:
            doc.processing_status = "ready"
        db.commit()
        print(f"[bg] {file_name}: {len(embeddings)} embeddings, {len(all_entities)} entities — done")

    except Exception as e:
        print(f"[bg] Error processing {document_id}: {e}")
        try:
            doc = db.query(Document).filter(Document.id == document_id).first()
            if doc:
                doc.processing_status = "failed"
                db.commit()
        except Exception:
            pass
    finally:
        db.close()


# ── Upload ────────────────────────────────────────────────────────────────────

@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles("admin", "department_officer"))
):
    # Sanitize filename — strip path separators, collapse whitespace
    safe_name = re.sub(r'[\\/:*?"<>|]', '_', os.path.basename(file.filename or "upload"))
    safe_name = re.sub(r'\s+', '_', safe_name).strip('._') or "upload"

    ext = ("." + safe_name.rsplit(".", 1)[-1].lower()) if "." in safe_name else ""
    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Supported: {', '.join(sorted(SUPPORTED_EXTENSIONS))}"
        )

    # Read file bytes once — used for size check, hash, and save
    file_bytes = await file.read()

    _max_bytes = int(os.getenv("MAX_UPLOAD_MB", 50)) * 1024 * 1024
    if len(file_bytes) > _max_bytes:
        max_mb = _max_bytes // (1024 * 1024)
        raise HTTPException(status_code=413, detail=f"File too large. Maximum allowed size is {max_mb} MB.")

    file_hash  = hashlib.sha256(file_bytes).hexdigest()

    # 1. Check duplicate by filename
    existing = db.query(Document).filter(Document.file_name == safe_name).first()

    # 2. Check duplicate by content hash (same content, different filename)
    if not existing:
        existing = db.query(Document).filter(Document.file_hash == file_hash).first()

    if existing:
        chunk_count = db.query(DocumentChunk).filter(DocumentChunk.document_id == existing.id).count()
        return {
            "message":           "Duplicate — document already exists",
            "document_id":       existing.id,
            "file_name":         existing.file_name,
            "is_duplicate":      "true",
            "doc_type":          existing.doc_type,
            "classification":    existing.classification,
            "summary":           existing.ai_summary,
            "chunks_created":    chunk_count,
            "processing_status": existing.processing_status or "ready",
        }

    try:
        # 1. Save file to disk
        path = os.path.join(UPLOAD_DIR, safe_name)
        with open(path, "wb") as f:
            f.write(file_bytes)

        # 2. Parse and chunk (fast — ~1 second)
        extracted_text, chunks = parse_document(path)
        valid_chunks = [c for c in chunks if c["chunk_text"].strip()]
        document_id  = str(uuid.uuid4())

        # 3. Store chunks without embeddings (fast DB insert)
        chunk_ids = []
        for i, chunk in enumerate(valid_chunks):
            cid = str(uuid.uuid4())
            chunk_ids.append(cid)
            db.add(DocumentChunk(
                id=cid,
                document_id=document_id,
                chunk_index=i,
                chunk_text=chunk["chunk_text"],
                heading_path=chunk["heading_path"],
                chunk_type=chunk["chunk_type"],
                embedding=None,
            ))

        # 4. Store document with placeholder metadata
        document = Document(
            id=document_id,
            file_name=safe_name,
            file_type=ext.lstrip("."),
            storage_path=path,
            uploaded_by=current_user.get("sub", "unknown"),
            extracted_text=extracted_text,
            is_duplicate="false",
            file_hash=file_hash,
            ai_summary="Processing…",
            ai_keywords="",
            doc_type="processing",
            department="",
            classification="public",
            processing_status="processing",
        )
        db.add(document)
        db.add(AuditLog(
            id=str(uuid.uuid4()),
            action="upload",
            user_id=current_user.get("sub"),
            document_id=document_id
        ))
        db.commit()

        # 5. Kick off heavy work in background thread — returns immediately
        t = threading.Thread(
            target=_process_in_background,
            args=(document_id, extracted_text, valid_chunks, chunk_ids, safe_name),
            daemon=True,
        )
        t.start()

        # Invalidate query cache — new document may affect existing answers
        flush_query_cache()

        return {
            "message":           "Document saved. Embeddings and metadata generating in background.",
            "document_id":       document_id,
            "file_name":         safe_name,
            "chunks_created":    len(valid_chunks),
            "processing_status": "processing",
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ── List ──────────────────────────────────────────────────────────────────────

@router.get("/")
def list_documents(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    docs = db.query(Document).all()
    return [
        {
            "id":                d.id,
            "file_name":         d.file_name,
            "file_type":         d.file_type,
            "doc_type":          d.doc_type,
            "department":        d.department,
            "version":           d.version,
            "classification":    d.classification,
            "is_duplicate":      d.is_duplicate,
            "upload_date":       str(d.upload_date),
            "uploaded_by":       d.uploaded_by,
            "summary":           d.ai_summary,
            "keywords":          d.ai_keywords,
            "processing_status": d.processing_status or "ready",
            "chunk_count":       db.query(DocumentChunk)
                                   .filter(DocumentChunk.document_id == d.id).count(),
            "supersedes_id":     d.supersedes_id,
            "issue_date":        d.issue_date,
            "effective_date":    d.effective_date,
        }
        for d in docs
    ]


# ── Detail ────────────────────────────────────────────────────────────────────

@router.get("/{document_id}")
def get_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    chunks = db.query(DocumentChunk)\
               .filter(DocumentChunk.document_id == document_id)\
               .order_by(DocumentChunk.chunk_index).all()

    return {
        "id":             doc.id,
        "file_name":      doc.file_name,
        "file_type":      doc.file_type,
        "doc_type":       doc.doc_type,
        "department":     doc.department,
        "version":        doc.version,
        "issue_date":     doc.issue_date,
        "effective_date": doc.effective_date,
        "classification": doc.classification,
        "is_duplicate":   doc.is_duplicate,
        "summary":        doc.ai_summary,
        "keywords":       doc.ai_keywords,
        "upload_date":    str(doc.upload_date),
        "uploaded_by":    doc.uploaded_by,
        "chunks": [
            {
                "index":        c.chunk_index,
                "heading_path": c.heading_path,
                "chunk_type":   c.chunk_type,
                "text":         c.chunk_text
            }
            for c in chunks
        ]
    }


# ── Metadata edit ────────────────────────────────────────────────────────────

class MetadataUpdate(BaseModel):
    summary:        Optional[str] = None
    keywords:       Optional[str] = None
    doc_type:       Optional[str] = None
    department:     Optional[str] = None
    version:        Optional[str] = None
    issue_date:     Optional[str] = None
    effective_date: Optional[str] = None
    classification: Optional[str] = None


@router.patch("/{document_id}/metadata")
def update_metadata(
    document_id: str,
    update: MetadataUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles("admin", "department_officer")),
):
    """Manually correct AI-extracted metadata for a document."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if update.summary        is not None: doc.ai_summary      = update.summary
    if update.keywords       is not None: doc.ai_keywords      = update.keywords
    if update.doc_type       is not None: doc.doc_type         = update.doc_type
    if update.department     is not None: doc.department       = update.department
    if update.version        is not None: doc.version          = update.version
    if update.issue_date     is not None: doc.issue_date       = update.issue_date
    if update.effective_date is not None: doc.effective_date   = update.effective_date
    if update.classification is not None: doc.classification   = update.classification

    db.add(AuditLog(
        id=str(uuid.uuid4()),
        action="update_metadata",
        user_id=current_user.get("sub"),
        document_id=document_id,
    ))
    db.commit()
    return {"message": "Metadata updated", "document_id": document_id}


# ── Reprocess Graph ───────────────────────────────────────────────────────────

@router.post("/{document_id}/reprocess-graph")
def reprocess_graph(
    document_id: str,
    db: Session = Depends(get_db),
    _current_user: dict = Depends(require_roles("admin"))
):
    """Re-extract knowledge graph entities for an existing document."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    chunks = db.query(DocumentChunk).filter(
        DocumentChunk.document_id == document_id
    ).order_by(DocumentChunk.chunk_index).all()
    valid_chunks = [
        {"chunk_text": c.chunk_text, "chunk_type": c.chunk_type, "heading_path": c.heading_path}
        for c in chunks
    ]

    try:
        all_entities, all_relationships = [], []
        _extract_graph_by_section(
            valid_chunks, document_id, doc.file_name,
            doc.ai_summary or "", all_entities, all_relationships
        )
        return {
            "message":         f"Graph reprocessed for '{doc.file_name}'",
            "entities_found":  len(all_entities),
            "relations_found": len(all_relationships),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Delete ────────────────────────────────────────────────────────────────────

@router.delete("/{document_id}")
def delete_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles("admin"))
):

    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Delete chunks and audit logs first (FK constraints)
    db.query(DocumentChunk).filter(DocumentChunk.document_id == document_id).delete()
    db.query(AuditLog).filter(AuditLog.document_id == document_id).delete()
    db.delete(doc)

    # Remove file from disk
    try:
        if doc.storage_path and os.path.exists(doc.storage_path):
            os.remove(doc.storage_path)
    except Exception:
        pass

    # Remove from Neo4j knowledge graph
    try:
        delete_document_graph(document_id)
    except Exception:
        pass

    db.add(AuditLog(
        id=str(uuid.uuid4()),
        action="delete",
        user_id=current_user.get("sub"),
        document_id=document_id
    ))
    db.commit()

    # Invalidate query cache — deleted document must not appear in future answers
    flush_query_cache()

    return {"message": f"Document '{doc.file_name}' deleted successfully"}


# ── Chat / Q&A — Hybrid Search (vector + keyword) ────────────────────────────

_MIN_SIM   = 0.35   # minimum cosine similarity to trust a vector result
_TOP_K     = 30     # vector candidates to fetch
_KW_LIMIT  = 8      # keyword chunks per keyword term

@router.get("/chat/ask")
def chat(
    question: str,
    document_id: str = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    try:
        doc_filter_sql = f"AND document_id = '{document_id}'" if document_id else ""

        # ── 1. Vector search ──────────────────────────────────────────────────
        query_embedding = embed_query(question)
        sql = text(f"""
            SELECT id, document_id, chunk_text, heading_path,
                   1 - (embedding <=> CAST(:emb AS vector)) AS similarity
            FROM document_chunks
            WHERE embedding IS NOT NULL {doc_filter_sql}
            ORDER BY embedding <=> CAST(:emb AS vector)
            LIMIT :k
        """)
        all_rows  = db.execute(sql, {"emb": str(query_embedding), "k": _TOP_K}).fetchall()
        best_sim  = all_rows[0].similarity if all_rows else 0.0
        good_rows = [r for r in all_rows if r.similarity >= _MIN_SIM]

        # ── 2. Keyword search — always runs in parallel ────────────────────────
        keywords = [w for w in question.lower().split() if w not in _STOP and len(w) > 2]
        seen_ids = {r.id for r in good_rows}
        kw_chunks = []

        base = db.query(DocumentChunk).filter(DocumentChunk.embedding.isnot(None))
        if document_id:
            base = base.filter(DocumentChunk.document_id == document_id)

        for kw in keywords[:5]:
            matches = base.filter(
                DocumentChunk.chunk_text.ilike(f"%{kw}%")
            ).limit(_KW_LIMIT).all()
            for m in matches:
                if m.id not in seen_ids:
                    kw_chunks.append(m)
                    seen_ids.add(m.id)

        # ── 3. Graph context from Neo4j ────────────────────────────────────────
        graph_parts = []
        try:
            search_terms = [w for w in question.split() if len(w) > 4 and w.lower() not in _STOP]
            seen_graph_entities = set()
            for term in search_terms[:5]:
                for ent in search_graph(term):
                    if ent["name"] not in seen_graph_entities:
                        seen_graph_entities.add(ent["name"])
                        rel_data = query_graph(ent["name"])
                        for rel in rel_data.get("relationships", [])[:6]:
                            graph_parts.append(
                                f"{rel['source']} --[{rel['relation']}]--> {rel['target']} ({rel['target_type']})"
                            )
        except Exception:
            pass  # Neo4j unavailable — degrade gracefully

        # ── 4. RRF fusion — re-rank using Reciprocal Rank Fusion ──────────────
        _RRF_K = 60  # standard constant
        rrf_scores: dict[str, float] = {}
        rrf_chunks: dict[str, object] = {}

        # Vector ranking (good_rows already sorted by similarity desc)
        vec_list = good_rows if good_rows else all_rows[:15]
        for rank, row in enumerate(vec_list):
            rrf_scores[row.id] = rrf_scores.get(row.id, 0.0) + 1.0 / (_RRF_K + rank + 1)
            rrf_chunks[row.id] = row

        # Keyword ranking
        for rank, chunk in enumerate(kw_chunks):
            rrf_scores[chunk.id] = rrf_scores.get(chunk.id, 0.0) + 1.0 / (_RRF_K + rank + 1)
            rrf_chunks[chunk.id] = chunk

        if not rrf_scores:
            return {
                "question": question,
                "answer":   "No documents found. Please upload documents first.",
                "sources":  [], "documents_used": 0, "chunks_used": 0,
                "search_mode": "none", "best_similarity": 0,
            }

        # Sort by RRF score descending, take top 20
        ranked_ids = sorted(rrf_scores, key=lambda i: rrf_scores[i], reverse=True)[:20]
        fused      = [rrf_chunks[i] for i in ranked_ids]
        search_mode = "hybrid" if kw_chunks else ("semantic_weak" if not good_rows else "semantic")

        parts = []
        for c in fused:
            header = f"[{c.heading_path}]\n" if c.heading_path else ""
            parts.append(f"{header}{c.chunk_text}")

        context = "\n\n---\n\n".join(parts)

        if graph_parts:
            unique_graph = list(dict.fromkeys(graph_parts))[:20]
            context += "\n\n---\n\n[KNOWLEDGE GRAPH — Entity Relationships]\n" + "\n".join(unique_graph)

        sources     = list({c.document_id for c in fused})
        chunks_used = len(fused)

        # ── 5. Generate answer ─────────────────────────────────────────────────
        user_id = current_user.get("sub")
        answer = answer_question(context, question, get_history_text(user_id))
        add_message(user_id, "User", question)
        add_message(user_id, "Assistant", answer)

        db.add(AuditLog(
            id=str(uuid.uuid4()),
            action="query",
            user_id=current_user.get("sub"),
            query=question,
            response=answer[:500]
        ))
        db.commit()

        return {
            "question":        question,
            "answer":          answer,
            "search_mode":     search_mode,
            "sources":         sources,
            "documents_used":  len(sources),
            "chunks_used":     chunks_used,
            "best_similarity": round(best_sim, 3),
            "graph_used":      bool(graph_parts),
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/chat/clear")
def clear_chat(current_user: dict = Depends(get_current_user)):
    clear_history(current_user.get("sub"))
    return {"message": "Conversation history cleared"}


# ── Audit Log ─────────────────────────────────────────────────────────────────

@router.get("/audit/logs")
def audit_logs(
    db: Session = Depends(get_db),
    _current_user: dict = Depends(require_roles("admin", "auditor"))
):
    logs = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(100).all()
    return [
        {
            "id":          l.id,
            "action":      l.action,
            "user_id":     l.user_id,
            "document_id": l.document_id,
            "query":       l.query,
            "response":    l.response,
            "escalate":    bool(l.escalate),
            "timestamp":   str(l.timestamp)
        }
        for l in logs
    ]
