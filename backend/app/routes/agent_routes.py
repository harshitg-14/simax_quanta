"""
Unified Q&A API
POST /agents/query        — full pipeline (blocking)
POST /agents/query/stream — streaming SSE response
POST /agents/clear        — clear this user's conversation history
GET  /agents/health       — pipeline status
"""
import asyncio
import json
import uuid
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.auth.security import get_current_user
from app.models.audit_log import AuditLog
from app.agents.orchestrator import run_agent_query
from app.services.chat_memory import get_history, add_message, clear_history

router = APIRouter(prefix="/agents", tags=["Unified Q&A"])


class QueryRequest(BaseModel):
    query: str


# ── Blocking endpoint (kept for backwards compat / non-browser clients) ────────

@router.post("/query")
def agent_query(
    request: QueryRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    query   = request.query.strip()
    user_id = current_user.get("sub")
    if not query:
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    try:
        history = get_history(user_id)
        result  = run_agent_query(query, db, history)
        out_of_scope = result.get("out_of_scope", False)

        if not out_of_scope:
            add_message(user_id, "User", query)
            add_message(user_id, "Assistant", result["answer"])

        db.add(AuditLog(
            id=str(uuid.uuid4()),
            action="query" if not out_of_scope else "rejected",
            user_id=user_id,
            query=f"[AGENT] {query}",
            response=result["answer"][:500],
            escalate=result.get("escalate", False),
        ))
        db.commit()

        return _build_response(query, result)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Streaming endpoint (SSE) ───────────────────────────────────────────────────

@router.post("/query/stream")
async def agent_query_stream(
    request: QueryRequest,
    current_user: dict = Depends(get_current_user),
):
    query   = request.query.strip()
    user_id = current_user.get("sub")
    if not query:
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    history = get_history(user_id)
    result_holder: dict = {}

    def run_in_thread():
        from app.database.connection import SessionLocal
        db = SessionLocal()
        try:
            result = run_agent_query(query, db, history)
            result_holder["data"] = result

            # Write audit log so dashboard + audit logs update correctly
            out_of_scope = result.get("out_of_scope", False)
            db.add(AuditLog(
                id=str(uuid.uuid4()),
                action="rejected" if out_of_scope else "query",
                user_id=user_id,
                query=f"[AGENT] {query}",
                response=result.get("answer", "")[:500],
                escalate=result.get("escalate", False),
            ))
            db.commit()
        except Exception as exc:
            result_holder["error"] = str(exc)
        finally:
            db.close()

    async def generate():
        loop = asyncio.get_running_loop()

        # Run full pipeline in thread pool — doesn't block the event loop
        future = loop.run_in_executor(None, run_in_thread)

        # Stream progress stages while pipeline runs
        stages = [
            ("scope_check",  "Checking query scope"),
            ("planning",     "Planning query strategy"),
            ("retrieving",   "Searching documents"),
            ("analyzing",    "Analyzing content"),
            ("synthesizing", "Generating answer"),
            ("validating",   "Validating response"),
        ]
        stage_idx = 0
        tick = 0

        while not future.done():
            await asyncio.sleep(0.2)
            tick += 1
            # Emit a new stage every ~3 seconds (15 ticks × 0.2s)
            if stage_idx < len(stages) and tick % 15 == 0:
                sid, msg = stages[stage_idx]
                yield f"data: {json.dumps({'type': 'status', 'stage': sid, 'message': msg})}\n\n"
                stage_idx += 1

        await future  # ensure any exception propagates

        if "error" in result_holder:
            yield f"data: {json.dumps({'type': 'error', 'message': result_holder['error']})}\n\n"
            return

        result       = result_holder["data"]
        out_of_scope = result.get("out_of_scope", False)

        # Persist to history and audit log
        if not out_of_scope:
            add_message(user_id, "User", query)
            add_message(user_id, "Assistant", result["answer"])

        # Stream the answer word by word
        answer = result.get("answer", "")
        words  = answer.split(" ")
        for i, word in enumerate(words):
            chunk = word + (" " if i < len(words) - 1 else "")
            yield f"data: {json.dumps({'type': 'token', 'text': chunk})}\n\n"
            await asyncio.sleep(0.015)

        # Final metadata event
        yield f"data: {json.dumps({'type': 'done', 'meta': {
            'out_of_scope':    out_of_scope,
            'plan':            result.get('plan', {}),
            'agents_used':     result.get('agents_used', []),
            'search_mode':     result.get('search_mode', ''),
            'sources':         result.get('sources', []),
            'documents_used':  len(result.get('sources', [])),
            'chunks_used':     result.get('chunks_used', 0),
            'graph_entities':  result.get('graph_entities', 0),
            'confidence':      result.get('confidence', 'medium'),
            'validation':      result.get('validation', {}),
            'escalate':        result.get('escalate', False),
            'query_rewritten': result.get('query_rewritten', False),
            'resolved_query':  result.get('resolved_query', ''),
        }})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control":    "no-cache",
            "X-Accel-Buffering":"no",   # disable nginx response buffering
        },
    )


# ── Clear history ──────────────────────────────────────────────────────────────

@router.post("/clear")
def clear_chat(current_user: dict = Depends(get_current_user)):
    clear_history(current_user.get("sub"))
    return {"message": "Conversation history cleared"}


# ── Health ─────────────────────────────────────────────────────────────────────

@router.get("/health")
def agent_health():
    return {
        "status": "operational",
        "pipeline": [
            {"phase": 0, "name": "scope_filter",    "role": "Rejects out-of-scope queries before pipeline runs"},
            {"phase": 0, "name": "prompt_assembler", "role": "Rewrites follow-up queries into standalone questions"},
            {"phase": 5, "name": "planner",          "role": "Query classification and execution planning"},
            {"phase": 5, "name": "retrieval",        "role": "Hybrid vector + graph context retrieval"},
            {"phase": 5, "name": "legal",            "role": "Legal document analysis and policy interpretation"},
            {"phase": 5, "name": "financial",        "role": "Financial schemes, budgets and amounts"},
            {"phase": 5, "name": "graph",            "role": "Entity relationships and cross-document linking"},
            {"phase": 5, "name": "calculation",      "role": "Numerical validation and financial calculations"},
            {"phase": 5, "name": "summarization",    "role": "Document summarization and executive overviews"},
            {"phase": 5, "name": "synthesis",        "role": "Final answer generation with citations"},
            {"phase": 6, "name": "gatekeeper",       "role": "Query relevance and response completeness check"},
            {"phase": 6, "name": "auditor",          "role": "Grounding verification and hallucination detection"},
            {"phase": 6, "name": "strategist",       "role": "Sensitivity assessment and escalation decisions"},
        ],
        "framework": "LangGraph",
        "model":     "Gemini 2.5 Flash Lite",
    }


# ── Helpers ────────────────────────────────────────────────────────────────────

def _build_response(query: str, result: dict) -> dict:
    return {
        "question":        query,
        "resolved_query":  result["resolved_query"],
        "query_rewritten": result["query_rewritten"],
        "answer":          result["answer"],
        "out_of_scope":    result.get("out_of_scope", False),
        "plan":            result["plan"],
        "agents_used":     result["agents_used"],
        "search_mode":     result["search_mode"],
        "sources":         result["sources"],
        "documents_used":  len(result["sources"]),
        "chunks_used":     result["chunks_used"],
        "graph_entities":  result["graph_entities"],
        "confidence":      result["confidence"],
        "validation":      result["validation"],
        "escalate":        result["escalate"],
    }
