"""
Unified Q&A API
POST /agents/query  — full pipeline: scope filter → prompt assembler → LangGraph (planner + specialists + validators)
GET  /agents/health — agent system status
"""
import uuid
from fastapi import APIRouter, Depends, HTTPException
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


@router.post("/query")
def agent_query(
    request: QueryRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    query = request.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    try:
        history = get_history()
        result  = run_agent_query(query, db, history)

        out_of_scope = result.get("out_of_scope", False)

        # Do not pollute conversation history with out-of-scope turns
        if not out_of_scope:
            add_message("User", query)
            add_message("Assistant", result["answer"])

        db.add(AuditLog(
            id=str(uuid.uuid4()),
            action="query" if not out_of_scope else "rejected",
            user_id=current_user.get("sub"),
            query=f"[AGENT] {query}",
            response=result["answer"][:500],
        ))
        db.commit()

        return {
            "question":        query,
            "resolved_query":  result["resolved_query"],
            "query_rewritten": result["query_rewritten"],
            "answer":          result["answer"],
            "out_of_scope":    out_of_scope,
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

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/clear")
def clear_chat(current_user: dict = Depends(get_current_user)):
    clear_history()
    return {"message": "Conversation history cleared"}


@router.get("/health")
def agent_health():
    return {
        "status": "operational",
        "pipeline": [
            {"phase": 0, "name": "scope_filter",   "role": "Rejects out-of-scope queries before pipeline runs"},
            {"phase": 0, "name": "prompt_assembler","role": "Rewrites follow-up queries into standalone questions"},
            {"phase": 5, "name": "planner",         "role": "Query classification and execution planning"},
            {"phase": 5, "name": "retrieval",       "role": "Hybrid vector + graph context retrieval"},
            {"phase": 5, "name": "legal",           "role": "Legal document analysis and policy interpretation"},
            {"phase": 5, "name": "financial",       "role": "Financial schemes, budgets and amounts"},
            {"phase": 5, "name": "graph",           "role": "Entity relationships and cross-document linking"},
            {"phase": 5, "name": "calculation",     "role": "Numerical validation and financial calculations"},
            {"phase": 5, "name": "summarization",   "role": "Document summarization and executive overviews"},
            {"phase": 5, "name": "synthesis",       "role": "Final answer generation with citations"},
            {"phase": 6, "name": "gatekeeper",      "role": "Query relevance and response completeness check"},
            {"phase": 6, "name": "auditor",         "role": "Grounding verification and hallucination detection"},
            {"phase": 6, "name": "strategist",      "role": "Sensitivity assessment and escalation decisions"},
        ],
        "framework": "LangGraph",
        "model": "Gemini 2.5 Flash",
    }
