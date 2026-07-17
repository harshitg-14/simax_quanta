# Simax Quanta

**Government Knowledge Intelligence Platform** — a document intelligence system for government departments that combines semantic search, a knowledge graph, and a multi-agent reasoning pipeline to answer questions grounded in uploaded policy documents, schemes, and circulars.

## What it does

Upload government documents (PDF, DOCX, XLSX, CSV) and Simax Quanta:

- Chunks them with structure-aware parsing and extracts AI-generated metadata
- Embeds content for semantic search (pgvector) and extracts entities/relationships into a knowledge graph (Neo4j)
- Answers natural-language questions through a multi-agent LangGraph pipeline that plans, retrieves, analyzes, and validates its own output before responding
- Tracks every query and document action in an audit log, with role-based access control

## Architecture

```
┌─────────────┐     ┌──────────────────────────────────────────┐
│   React      │────▶│               FastAPI Backend             │
│  (Vite +     │◀────│                                            │
│  Tailwind)   │ SSE │  ┌──────────────────────────────────────┐  │
└─────────────┘     │  │     LangGraph Multi-Agent Pipeline     │  │
                     │  │                                        │  │
                     │  │  Scope Filter → Prompt Assembler        │  │
                     │  │       ↓                                 │  │
                     │  │  Planner → [Legal | Financial | Graph |  │  │
                     │  │    Retrieval | Calculation |            │  │
                     │  │    Summarization] → Synthesis           │  │
                     │  │       ↓                                 │  │
                     │  │  Gatekeeper → Auditor → Strategist       │  │
                     │  └──────────────────────────────────────┘  │
                     └──────────┬───────────────┬─────────────────┘
                                │               │
                     ┌──────────▼───────┐  ┌────▼──────────┐
                     │ PostgreSQL        │  │    Neo4j       │
                     │ + pgvector        │  │ Knowledge Graph│
                     │ (docs, chunks,    │  │ (entities,     │
                     │  users, audit)    │  │  relationships)│
                     └───────────────────┘  └────────────────┘
                                │
                     ┌──────────▼───────┐
                     │  Upstash Redis    │
                     │  (query cache)    │
                     └───────────────────┘
```

### Agent pipeline

| Phase | Agent | Role |
|---|---|---|
| 0 | Scope Filter | Rejects out-of-scope queries before the pipeline runs |
| 0 | Prompt Assembler | Rewrites follow-up questions into standalone queries |
| 5 | Planner | Classifies the query and builds an execution plan |
| 5 | Retrieval | Hybrid vector + graph context fetching |
| 5 | Legal / Financial / Graph / Calculation / Summarization | Domain-specialist agents, run in parallel where possible |
| 5 | Synthesis | Produces the final grounded answer with citations |
| 6 | Gatekeeper | Checks relevance and completeness |
| 6 | Auditor | Checks grounding and flags hallucination risk |
| 6 | Strategist | Assesses sensitivity and escalation need |

## Tech stack

**Backend** — FastAPI, SQLAlchemy, LangGraph + LangChain, Google Gemini (`gemini-2.5-flash-lite`), PostgreSQL + pgvector, Neo4j, Upstash Redis, JWT auth (`python-jose`), `sentence-transformers` (BGE embeddings), PyMuPDF / python-docx / openpyxl for document parsing.

**Frontend** — React 18, Vite, Tailwind CSS, React Router, Recharts, `@xyflow/react` for graph visualization, Axios.

**Infrastructure** — Docker Compose (Postgres, Neo4j, backend, nginx-served frontend).

## Roles (RBAC)

| Role | Upload docs | Edit metadata | View analytics | View audit logs | Delete docs | Manage graph types | Manage users |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `admin` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `department_officer` | ✅ | ✅ | ✅ | — | — | — | — |
| `auditor` | — | — | ✅ | ✅ | — | — | — |
| `reviewer` | — | — | — | — | — | — | — |

All roles can query documents, chat, and browse the knowledge graph.

## Getting started

### Prerequisites

- Docker and Docker Compose
- A [Google AI Studio](https://aistudio.google.com/) API key (`GEMINI_API_KEY`)
- (Optional) An [Upstash](https://upstash.com/) Redis database for query caching

### Setup

1. Copy the backend environment template and fill in real values:

   ```bash
   cp backend/.env.example backend/.env
   ```

2. Set the required variables in your shell or a root-level `.env` used by `docker-compose`:

   | Variable | Description |
   |---|---|
   | `GEMINI_API_KEY` | Google Gemini API key |
   | `SECRET_KEY` | Random secret used to sign JWTs |
   | `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Optional — query cache |

3. Start the stack:

   ```bash
   docker-compose up -d --build
   ```

4. Open the app:

   - Frontend: [http://localhost:5173](http://localhost:5173)
   - Backend API docs: [http://localhost:8000/docs](http://localhost:8000/docs)
   - Neo4j Browser: [http://localhost:7474](http://localhost:7474)

5. Register the first account via `/register` — pick `admin` as the role to get full access.

### Local development (without Docker)

**Backend**

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**Frontend**

```bash
cd frontend
npm install
npm run dev
```

Set `VITE_API_URL` in `frontend/.env.local` if the backend isn't on `http://localhost:8000`.

## Project structure

```
backend/
  app/
    agents/        # LangGraph pipeline agents (planner, retrieval, legal, financial, ...)
    auth/           # JWT auth, password hashing, RBAC dependency
    database/       # SQLAlchemy engine/session setup
    models/         # ORM models (User, Document, DocumentChunk, AuditLog)
    routes/         # FastAPI routers
    services/       # AI service, graph service, chat memory, caching, scope filter
frontend/
  src/
    pages/          # Dashboard, Documents, Chat, Graph, GraphViz, Analytics, AuditLogs, UserManagement
    components/     # Layout (sidebar/header/theme toggle)
    api.js          # Axios client
```

## Security notes

- Rotate `SECRET_KEY`, database, and Neo4j credentials before any production deployment — do not reuse values from `docker-compose.yml` defaults.
- CORS is currently open (`allow_origins=["*"]`) — restrict this to your deployed frontend origin before going live.
- All destructive and admin-only routes are protected via `require_roles(...)` dependencies; see the RBAC table above.
