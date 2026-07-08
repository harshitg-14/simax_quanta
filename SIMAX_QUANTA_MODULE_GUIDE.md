# Simax Quanta — Module Guide
**Government Knowledge Intelligence Platform**
Version 4.0 | Built with FastAPI + React + Neo4j + pgvector + LangGraph

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [System Architecture](#3-system-architecture)
4. [Backend Modules](#4-backend-modules)
   - 4.1 Authentication & RBAC (Phase 1)
   - 4.2 Document Ingestion & Chunking (Phase 1)
   - 4.3 Semantic Embedding (Phase 2)
   - 4.4 Knowledge Graph — Neo4j (Phase 3)
   - 4.5 AI Metadata Enrichment (Phase 3)
   - 4.6 Hybrid Search & RAG Chat (Phase 2+3)
   - 4.7 Multi-Agent Pipeline — LangGraph (Phase 5)
   - 4.8 Validation Layer (Phase 6)
   - 4.9 Analytics (Phase 7)
5. [Frontend Modules](#5-frontend-modules)
   - 5.1 Layout & Navigation
   - 5.2 Dashboard
   - 5.3 Documents
   - 5.4 Document Q&A (Chat)
   - 5.5 Knowledge Graph (Text Search)
   - 5.6 Graph Visualization (ReactFlow)
   - 5.7 Analytics
   - 5.8 Audit Logs
6. [RBAC Permission Matrix](#6-rbac-permission-matrix)
7. [API Reference Summary](#7-api-reference-summary)
8. [Database Schema](#8-database-schema)
9. [Data Flow — Document Upload to Query](#9-data-flow)

---

## 1. Project Overview

Simax Quanta is an enterprise-grade document intelligence platform designed for Indian government organizations. It allows authorized users to upload policy documents, government orders, schemes, and circulars — and then query them using natural language through a hybrid search system backed by a multi-agent AI pipeline.

**Core capability:** Upload a PDF/DOCX/XLSX/TXT → system automatically chunks it, embeds it semantically, extracts a knowledge graph, enriches metadata with AI — and makes it queryable via both simple RAG chat and a full 11-agent LangGraph pipeline.

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, Vite, Tailwind CSS, ReactFlow (`@xyflow/react`), Lucide icons |
| **Backend** | FastAPI (Python 3.11), Uvicorn |
| **Primary Database** | PostgreSQL + `pgvector` extension (1024-dim vector search) |
| **Graph Database** | Neo4j (entity relationships) |
| **AI Model** | Gemini 2.5 Flash (metadata extraction, entity extraction, Q&A, agents) |
| **Embeddings** | `BAAI/bge-large-en-v1.5` via SentenceTransformers — 1024-dim, CPU |
| **Agent Framework** | LangGraph (StateGraph, 11-node pipeline) |
| **Auth** | JWT (HS256, 8-hour expiry) via `python-jose` + bcrypt |
| **PDF Parsing** | PyMuPDF (`fitz`) + Tesseract OCR fallback |
| **DOCX Parsing** | `python-docx` |
| **XLSX Parsing** | `openpyxl` |
| **HTTP Client** | Axios (frontend) |

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     React Frontend (Vite)                    │
│  Dashboard │ Documents │ Chat │ Graph │ Analytics │ Audit    │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTPS (JWT Bearer)
┌───────────────────────▼─────────────────────────────────────┐
│                    FastAPI Backend                           │
│                                                             │
│  /auth     /documents     /agents     /analytics            │
│  /graph                                                     │
└──────┬──────────────┬──────────────────────────────────────┘
       │              │
┌──────▼──────┐  ┌────▼──────────────────────────────────┐
│ PostgreSQL   │  │ Neo4j Graph Database                  │
│ + pgvector   │  │ Entities, Relationships               │
│              │  │ (Ministry, Scheme, Dept, Act…)        │
│ - users      │  └───────────────────────────────────────┘
│ - documents  │
│ - doc_chunks │       ┌────────────────────────────────┐
│ - audit_logs │       │  Gemini 2.5 Flash (Google AI)  │
└─────────────┘       │  - Metadata enrichment          │
                       │  - Entity/relationship extract  │
                       │  - Q&A answer generation        │
                       │  - All 11 agent nodes           │
                       └────────────────────────────────┘
```

---

## 4. Backend Modules

### 4.1 Authentication & RBAC (Phase 1)

**File:** `backend/app/auth/security.py`
**File:** `backend/app/routes/user_routes.py`

#### What it does
Handles user registration, login, and enforces role-based access on every sensitive endpoint.

#### Roles (4 total)

| Role | Description |
|------|-------------|
| `admin` | Full access — upload, delete, analytics, agents, audit logs |
| `department_officer` | Can upload docs and use agent mode, view analytics |
| `auditor` | Read-only — can view audit logs and analytics, cannot upload or use agents |
| `reviewer` | Most restricted — can read documents and use basic RAG chat only |

#### How JWT works
1. User logs in at `POST /auth/login` with `username + password`
2. Backend verifies bcrypt hash, creates a JWT with `{ sub: username, role: role, exp: +8h }`
3. Frontend stores the token in `localStorage` and sends it as `Authorization: Bearer <token>` on every API call
4. Backend uses `get_current_user()` FastAPI dependency to decode and validate on each request
5. For role-restricted endpoints, `require_roles("admin", "department_officer")` is used as a dependency — returns HTTP 403 if role does not match

#### Key functions

```python
# Verify a password against its bcrypt hash
verify_password(plain, hashed)

# Create an 8-hour JWT
create_token({"sub": username, "role": role})

# FastAPI dependency — extracts and validates JWT from Authorization header
get_current_user(credentials)

# FastAPI dependency factory — validates role
require_roles("admin", "department_officer")
```

---

### 4.2 Document Ingestion & Chunking (Phase 1)

**File:** `backend/app/services/document_parser.py`
**Called from:** `backend/app/routes/document_routes.py` → `_process_in_background()`

#### What it does
Parses uploaded files into structured text chunks with heading-aware context. Each chunk retains its heading breadcrumb path (e.g. `"Section 3 > Eligibility Criteria"`) so retrieval has structural context.

#### Supported file types

| Type | Parser | Notes |
|------|--------|-------|
| `.pdf` | PyMuPDF (`fitz`) | Font-size detection for headings; Tesseract OCR fallback for scanned pages |
| `.docx` | `python-docx` | Uses Word heading styles (Heading 1–5) |
| `.xlsx` | `openpyxl` | Each sheet split into row-groups of 40 rows; cells joined as `col1 \| col2 \| col3` |
| `.txt` | Custom | Paragraph merging + overlap splitting |

#### Chunking parameters

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `MAX_CHUNK_CHARS` | 1200 | Split if chunk exceeds this |
| `OVERLAP_CHARS` | 150 | Overlap kept between split chunks for context continuity |
| `MIN_CHUNK_CHARS` | 40 | Discard chunks smaller than this |
| `MAX_ROWS_PER_CHUNK` | 40 | XLSX row group size |

#### Upload flow (fast path + background thread)

```
POST /documents/upload
  │
  ├─ 1. Validate file type
  ├─ 2. SHA-256 hash → check duplicate (by filename or content)
  ├─ 3. Save file to disk (uploads/ folder)
  ├─ 4. parse_document() → extract text + chunks (fast, ~1s)
  ├─ 5. Write all chunks to PostgreSQL (no embeddings yet)
  ├─ 6. Write Document record (status = "processing")
  ├─ 7. Log to AuditLog
  ├─ 8. Return immediately → document_id + chunk count
  │
  └─ Background thread (_process_in_background):
       ├─ embed_batch(chunk_texts) → BGE embeddings saved to pgvector
       ├─ enrich_metadata(extracted_text) → Gemini → summary, keywords, dept, dates, classification
       ├─ Version Intelligence: check if this doc supersedes older doc from same dept+type
       ├─ _extract_graph_by_section() → per-section Gemini entity extraction → Neo4j
       └─ Set status = "ready"
```

On server restart, any document stuck in `"processing"` status is automatically resumed via the `startup` event handler in `main.py`.

---

### 4.3 Semantic Embedding (Phase 2)

**File:** `backend/app/services/embedding_service.py`

#### What it does
Converts document chunks and search queries into 1024-dimensional vectors for semantic similarity search using pgvector's cosine distance operator (`<=>`).

#### Model
`BAAI/bge-large-en-v1.5` — one of the best English retrieval models. Loaded once at startup (lazy, on first use), runs entirely on CPU.

#### Key detail — Query prefix
BGE Large requires a specific prefix **only on queries** (not on document chunks) for optimal retrieval:
```
"Represent this sentence for searching relevant passages: <query>"
```
This is already applied inside `embed_query()`.

#### Functions

| Function | Use |
|----------|-----|
| `embed_query(text)` | Embed a search query (adds BGE prefix) |
| `embed_text(text)` | Embed a single chunk |
| `embed_batch(texts)` | Embed all chunks from a document in one pass (batch_size=64) |

---

### 4.4 Knowledge Graph — Neo4j (Phase 3)

**File:** `backend/app/services/graph_service.py`

#### What it does
Extracts named entities (ministries, schemes, departments, acts, beneficiaries) and their relationships from document text using Gemini, then stores them as a connected graph in Neo4j. This enables relationship-aware querying — e.g., "which schemes target farmers?" can leverage graph traversal.

#### Entity types
`Ministry`, `Scheme`, `Beneficiary`, `Department`, `Location`, `Organization`, `Policy`, `Act`

#### Relationship types
`FUNDS`, `TARGETS`, `IMPLEMENTS`, `LAUNCHED_BY`, `BENEFITS`, `PART_OF`, `LOCATED_IN`, `GOVERNED_BY`

#### Per-section extraction strategy
Rather than sending the whole document to Gemini at once (which would hit token limits and lose precision), the system groups chunks by top-level heading into sections, then processes up to 15 sections per document:

```
Document
  └─ Section 1 (heading + its chunks) → Gemini extraction → entities + relationships
  └─ Section 2 → Gemini extraction → entities + relationships
  ...
  └─ Section N (max 15)
       └─ Deduplicated by name → stored to Neo4j via MERGE (no duplicates)
```

#### Neo4j operations

| Function | What it does |
|----------|-------------|
| `extract_entities(text, doc_id, heading)` | Calls Gemini, returns `{entities, relationships}` JSON |
| `store_graph(doc_id, file_name, entities, rels)` | MERGE nodes + edges in Neo4j |
| `delete_document_graph(doc_id)` | Remove doc node + its exclusive entities (entities shared with other docs are kept) |
| `query_graph(entity_name)` | Get all relationships for a named entity |
| `search_graph(query)` | Fuzzy name search across all entity nodes |
| `get_document_graph(doc_id)` | Full graph (nodes + edges) for ReactFlow visualization |

---

### 4.5 AI Metadata Enrichment (Phase 3)

**File:** `backend/app/services/ai_service.py`

#### What it does
After a document is chunked, Gemini 2.5 Flash analyzes the first 15,000 characters and extracts structured metadata in a single API call.

#### Extracted fields

| Field | Description |
|-------|-------------|
| `summary` | 2–3 sentence human-readable summary |
| `keywords` | 5 comma-separated topic keywords |
| `doc_type` | `policy / circular / notification / act / order / scheme / report / other` |
| `department` | Issuing government department name |
| `version` | Amendment/version number |
| `issue_date` | Date in YYYY-MM-DD |
| `effective_date` | Date in YYYY-MM-DD |
| `classification` | `public / restricted / confidential` |

#### Reliability
The function uses JSON-only prompting (no markdown) with 3-retry exponential backoff (1s, 2s, 4s) for transient Gemini 503/429 errors. On parse failure it returns safe empty defaults so the document still saves.

#### Version Intelligence
After metadata is saved, the system checks if there is an older document from the **same department + doc_type** with an earlier `issue_date`. If found, it sets `supersedes_id` on the new document to link the version chain.

---

### 4.6 Hybrid Search & RAG Chat (Phase 2+3)

**File:** `backend/app/routes/document_routes.py` → `GET /documents/chat/ask`

#### What it does
Answers natural-language questions grounded strictly in uploaded documents. Combines three retrieval strategies then fuses rankings with **Reciprocal Rank Fusion (RRF)** before generating an answer with Gemini.

#### Retrieval pipeline

```
User question
  │
  ├─ 1. Vector search (pgvector cosine)
  │      embed_query(question) → TOP_K=30 chunks → filter >= 0.35 similarity
  │
  ├─ 2. Keyword search (SQL ILIKE)
  │      Extract non-stopword terms → match chunk_text for each → up to 8 chunks/term
  │
  ├─ 3. Graph context (Neo4j)
  │      Extract long words from question → search_graph() → query_graph()
  │      → format as "Entity --[RELATION]--> Target" strings
  │
  └─ 4. RRF Fusion
         rank vector results + keyword results by Reciprocal Rank Fusion score
         → take top 20 fused chunks
         → append graph context to prompt
         → Gemini generates final answer

Returns: answer + search_mode + chunks_used + documents_used + best_similarity
```

#### Search modes (reported in response)
- `semantic` — vector only worked well (similarity ≥ 0.35)
- `hybrid` — vector + keyword both contributed results
- `semantic_weak` — vector returned results but below similarity threshold

#### Chat memory
Conversation history is stored in `backend/app/services/chat_memory.py` (in-memory list) and injected into the Gemini prompt for context continuity within a session.

---

### 4.7 Multi-Agent Pipeline — LangGraph (Phase 5)

**Files:** `backend/app/agents/` (11 agent files + orchestrator + state)
**Entry point:** `POST /agents/query`

#### What it does
For complex queries requiring multi-domain reasoning, the system routes through an 11-node LangGraph pipeline. Each node is a specialized AI agent that adds its analysis to a shared state object, which flows to the next agent.

#### Pipeline flow

```
START
  │
  ▼
[1. Planner]        Classify query intent (legal/financial/graph/summary/calculation)
                    Build execution plan: {intent, domains, complexity, strategy}
  │
  ▼
[2. Retrieval]      Hybrid vector + keyword + graph search (same as RAG chat)
                    Fills state: vector_chunks, graph_context, sources
  │
  ▼
[3. Legal]          If query involves acts, policies, regulations → extract legal analysis
  │
  ▼
[4. Financial]      If query involves schemes, budgets, amounts → extract financial data
  │
  ▼
[5. Graph]          Use graph_context entities to find cross-document relationships
  │
  ▼
[6. Calculation]    If query involves numbers → validate/compute figures
  │
  ▼
[7. Summarization]  If query asks for summary/overview → synthesize document summaries
  │
  ▼
[8. Synthesis]      Combines all agent outputs into a coherent final answer with citations
  │
  ▼
[9. Gatekeeper]     (Phase 6) Check: is query relevant? Is answer complete?
                    Outputs: recommendation (approve/flag), flags[]
  │
  ▼
[10. Auditor]       (Phase 6) Grounding score (0–100), hallucination risk (low/medium/high)
  │
  ▼
[11. Strategist]    (Phase 6) Sensitivity assessment, escalation decision
                    Outputs: escalate (bool), sensitivity_type
  │
  ▼
END → Return {answer, plan, agents_used, confidence, validation, escalate, chunks_used, graph_entities}
```

#### Shared state (`AgentState` TypedDict)

```python
{
  "query":         str,          # original user question
  "plan":          dict,         # planner output
  "vector_chunks": list,         # retrieved document chunks
  "graph_context": dict,         # Neo4j entities + relationships
  "agent_outputs": dict,         # each agent's result keyed by name
  "final_answer":  str,          # filled by synthesis
  "search_mode":   str,
  "sources":       list,         # document IDs used
  "agents_used":   list[str],    # which agents contributed
  "confidence":    str,          # high/medium/low
  "validation":    dict,         # Phase 6 gatekeeper/auditor/strategist output
  "escalate":      bool,         # strategist escalation flag
}
```

#### Access control
Only `admin` and `department_officer` can call `POST /agents/query`. Auditors and reviewers get HTTP 403.

---

### 4.8 Validation Layer (Phase 6)

**Files:** `backend/app/agents/gatekeeper.py`, `auditor.py`, `strategist.py`

These three agents run sequentially at the end of every agent pipeline call.

| Agent | Role | Output |
|-------|------|--------|
| **Gatekeeper** | Checks whether the query is relevant to uploaded documents and if the synthesized answer is complete | `recommendation: approve/flag`, `flags: []` |
| **Auditor** | Scores how well-grounded the answer is in the actual document context | `grounding_score: 0–100`, `hallucination_risk: low/medium/high` |
| **Strategist** | Assesses sensitivity of the information, decides if escalation to a human reviewer is warranted | `escalate: bool`, `sensitivity_type: none/financial/legal/restricted` |

The Validation Panel is shown in the frontend Chat page under each agent-mode response.

---

### 4.9 Analytics (Phase 7)

**File:** `backend/app/routes/analytics_routes.py`

Three endpoints, all requiring `admin / department_officer / auditor` role:

| Endpoint | Returns |
|----------|---------|
| `GET /analytics/summary` | Total docs, chunks, queries, graph entities; breakdown by type/dept/classification; top docs by chunk count |
| `GET /analytics/queries` | Query history grouped by day; agent vs RAG split; last 20 queries with timestamps |
| `GET /analytics/agents` | Agent pipeline health — all 11 agents with phase, status, role |

---

## 5. Frontend Modules

**Stack:** React 18 + Vite + Tailwind CSS
**State:** Local `useState` / `useEffect` — no Redux
**HTTP:** Axios instance at `frontend/src/api.js` — auto-attaches Bearer token from `localStorage`

---

### 5.1 Layout & Navigation

**File:** `frontend/src/components/Layout.jsx`

The persistent sidebar + top layout wrapper. Renders for all authenticated pages.

- **Sidebar items:** Dashboard, Documents, Document Q&A, Knowledge Graph, Graph Visualization, Analytics, Audit Logs
- **Active highlight:** Blue-tinted background + blue text on current route
- **User section:** Shows name + role at bottom; Sign Out clears `localStorage` and redirects to `/login`
- **No role-based hiding in sidebar** — routes themselves enforce access; unauthorized navigation redirects to `/`

---

### 5.2 Dashboard

**File:** `frontend/src/pages/Dashboard.jsx`

Landing page after login.

- **Stat cards (4):** Documents, Total Chunks, Graph Entities, Queries Run — fetched from `GET /analytics/summary`
- **Recent Documents list:** Last 5 documents with status badge (ready/processing/failed) — fetched from `GET /documents/`
- **"View all" link** → navigates to `/documents`

---

### 5.3 Documents

**File:** `frontend/src/pages/Documents.jsx`
**Props:** `user` (from App.jsx — contains `role`)

#### Features
- **List all documents** with chunk count, department, doc_type, processing status
- **Inline summary preview** — first line of AI summary shown under filename
- **Expandable row** — click any document to expand: full summary, keywords as tag chips, metadata grid (version, issue date, effective date, classification, upload date, uploader)
- **Status badge** — green (`ready`), blue (`processing`), red (`failed`). Auto-polls every 4 seconds while any document is in `processing` state
- **Duplicate detection** — backend detects by filename OR SHA-256 content hash; frontend shows error banner

#### RBAC enforcement

| Action | Roles allowed | How enforced |
|--------|--------------|--------------|
| Upload button visible | admin, department_officer | `canUpload` flag in JSX |
| Delete button visible | admin only | `canDelete` flag in JSX |
| Backend upload | admin, department_officer | `require_roles()` returns 403 |
| Backend delete | admin only | `require_roles()` returns 403 |

---

### 5.4 Document Q&A (Chat)

**File:** `frontend/src/pages/Chat.jsx`
**Props:** `user`

#### Two modes

| Mode | Endpoint | Who can use |
|------|----------|-------------|
| **RAG mode** (default) | `GET /documents/chat/ask` | All authenticated roles |
| **Agent mode** | `POST /agents/query` | admin, department_officer only |

#### UI elements
- **Agent Mode toggle** — visible only for admin + department_officer (`canUseAgent`). Toggle switches between RAG and multi-agent pipeline
- **Agent mode banner** — yellow info strip shown when agent mode is active (only for authorized roles)
- **Message bubbles** — user messages right-aligned (blue), assistant left-aligned (gray). Bot icon turns yellow Brain icon in agent mode
- **Metadata footer under each response** — shows search mode badge, confidence badge, chunks used, docs used, similarity score for RAG, graph entities for agent mode
- **Validation Panel** — appears under agent responses showing Gatekeeper / Auditor / Strategist results (grounding score, hallucination risk, escalation)
- **Clear button** — calls `POST /documents/chat/clear` to reset conversation memory

#### Safety
If `canUseAgent` is false but `agentMode` is somehow true (stale state), the `ask()` function falls back to RAG mode. The toggle is also reset to `false` via `useEffect` when the user's role doesn't qualify.

---

### 5.5 Knowledge Graph (Text Search)

**File:** `frontend/src/pages/Graph.jsx`

Simple search interface for the Neo4j graph:
- Search by entity name → calls `GET /graph/search?query=...`
- Click a result → loads all relationships for that entity via `GET /graph/query?entity=...`
- Displays entity → relationship → target in a structured list

---

### 5.6 Graph Visualization (ReactFlow)

**File:** `frontend/src/pages/GraphViz.jsx`

Visual knowledge graph explorer:
- Document selector dropdown → fetches `GET /graph/document/{id}` to get nodes + edges
- Renders using `@xyflow/react` (ReactFlow) with:
  - Circular layout (nodes arranged in a circle, radius scales with node count)
  - Dynamic node widths — calculated from label length: `max(110, min(240, labelLen * 7 + 24))` to prevent clipping
  - Smooth-step edge type with dark label backgrounds for readability
  - MiniMap + Controls for pan/zoom
- Entity type color coding in node backgrounds

---

### 5.7 Analytics

**File:** `frontend/src/pages/Analytics.jsx`
**Access:** admin, department_officer, auditor (reviewer blocked at route level)

Dashboard-style analytics with Recharts charts:
- **Summary cards** — total docs, chunks, queries, graph entities
- **Bar chart** — documents by type
- **Pie/Donut chart** — documents by classification
- **Bar chart** — documents by department
- **Bar chart** — chunks per document (top 8)
- **Line chart** — daily query volume
- **Agent pipeline status table** — all 11 agents with phase + role

---

### 5.8 Audit Logs

**File:** `frontend/src/pages/AuditLogs.jsx`
**Access:** admin, auditor only (enforced at both route level and backend)

Table of last 100 actions:
- Columns: Timestamp, Action, User, Document ID, Query preview
- Action badges: `upload`, `delete`, `query` with neutral gray styling
- Ordered newest-first

---

## 6. RBAC Permission Matrix

| Feature | admin | department_officer | auditor | reviewer |
|---------|-------|--------------------|---------|----------|
| View documents list | Yes | Yes | Yes | Yes |
| Upload documents | Yes | Yes | No | No |
| Delete documents | Yes | No | No | No |
| Reprocess graph | Yes | No | No | No |
| RAG Chat (basic Q&A) | Yes | Yes | Yes | Yes |
| Agent Mode (11-agent pipeline) | Yes | Yes | No | No |
| View Analytics | Yes | Yes | Yes | No |
| View Audit Logs | Yes | No | Yes | No |
| Register users | Yes | No | No | No |

**Enforcement is dual-layer:**
- Frontend hides UI elements (buttons, toggles, routes)
- Backend returns HTTP 403 for unauthorized API calls regardless of frontend state

---

## 7. API Reference Summary

### Auth — `/auth`
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/auth/register` | Public | Register new user |
| POST | `/auth/login` | Public | Login, returns JWT token |

### Documents — `/documents`
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/documents/` | All roles | List all documents |
| POST | `/documents/upload` | admin, dept_officer | Upload + process document |
| GET | `/documents/{id}` | All roles | Get document detail + chunks |
| DELETE | `/documents/{id}` | admin | Delete document + graph + chunks |
| POST | `/documents/{id}/reprocess-graph` | admin | Re-extract Neo4j entities |
| GET | `/documents/chat/ask?question=` | All roles | RAG Q&A with hybrid search |
| POST | `/documents/chat/clear` | All roles | Clear conversation memory |
| GET | `/documents/audit/logs` | admin, auditor | Last 100 audit log entries |

### Graph — `/graph`
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/graph/search?query=` | All roles | Search entities by name |
| GET | `/graph/query?entity=` | All roles | Get all relationships for entity |
| GET | `/graph/document/{id}` | All roles | Full graph for ReactFlow |

### Agents — `/agents`
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/agents/query` | admin, dept_officer | 11-agent LangGraph pipeline |
| GET | `/agents/health` | All roles | Agent pipeline status |

### Analytics — `/analytics`
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/analytics/summary` | admin, dept_officer, auditor | Platform-wide stats |
| GET | `/analytics/queries` | admin, dept_officer, auditor | Query history |
| GET | `/analytics/agents` | admin, dept_officer, auditor | Agent status |

---

## 8. Database Schema

### `users` table (PostgreSQL)
| Column | Type | Notes |
|--------|------|-------|
| id | VARCHAR (UUID) | Primary key |
| username | VARCHAR | Unique |
| email | VARCHAR | |
| hashed_password | VARCHAR | bcrypt |
| role | VARCHAR | admin / department_officer / auditor / reviewer |
| created_at | TIMESTAMP | |

### `documents` table (PostgreSQL)
| Column | Type | Notes |
|--------|------|-------|
| id | VARCHAR (UUID) | Primary key |
| file_name | VARCHAR | Original filename |
| file_type | VARCHAR | pdf, docx, xlsx, txt |
| storage_path | VARCHAR | Path on disk |
| extracted_text | TEXT | Full raw text |
| file_hash | VARCHAR | SHA-256 for duplicate detection |
| ai_summary | TEXT | Gemini-generated summary (exposed as `summary` in API) |
| ai_keywords | TEXT | Comma-separated keywords |
| doc_type | VARCHAR | policy, circular, etc. |
| department | VARCHAR | Issuing department |
| version | VARCHAR | Version/amendment |
| issue_date | VARCHAR | YYYY-MM-DD |
| effective_date | VARCHAR | YYYY-MM-DD |
| classification | VARCHAR | public / restricted / confidential |
| is_duplicate | VARCHAR | "true" / "false" |
| supersedes_id | VARCHAR | FK to older document (version chain) |
| processing_status | VARCHAR | processing / ready / failed |
| uploaded_by | VARCHAR | Username from JWT |
| upload_date | TIMESTAMP | Auto-set |

### `document_chunks` table (PostgreSQL + pgvector)
| Column | Type | Notes |
|--------|------|-------|
| id | VARCHAR (UUID) | Primary key |
| document_id | VARCHAR | FK to documents |
| chunk_index | INTEGER | Order within document |
| chunk_text | TEXT | Chunk content |
| heading_path | TEXT | Breadcrumb: "Section > Sub-section" |
| chunk_type | VARCHAR | heading / paragraph / table |
| embedding | VECTOR(1024) | BGE Large embedding for cosine search |

### `audit_logs` table (PostgreSQL)
| Column | Type | Notes |
|--------|------|-------|
| id | VARCHAR (UUID) | Primary key |
| action | VARCHAR | upload / delete / query |
| user_id | VARCHAR | Username from JWT |
| document_id | VARCHAR | Nullable |
| query | TEXT | Query text (for query actions) |
| response | TEXT | First 500 chars of response |
| timestamp | TIMESTAMP | Auto-set |

### Neo4j nodes
- `Document {id, file_name}`
- `Ministry {name}`
- `Scheme {name}`
- `Department {name}`
- `Beneficiary {name}`
- `Organization {name}`
- `Policy {name}`
- `Act {name}`
- `Location {name}`

### Neo4j relationships
`CONTAINS`, `FUNDS`, `TARGETS`, `IMPLEMENTS`, `LAUNCHED_BY`, `BENEFITS`, `PART_OF`, `LOCATED_IN`, `GOVERNED_BY`

---

## 9. Data Flow

### Document Upload → Query Ready

```
1. User uploads file (admin or dept_officer)
   │
   ▼
2. Backend validates type → computes SHA-256 → checks duplicate
   │
   ▼
3. parse_document() → extracts text + structured chunks with heading paths
   │
   ▼
4. Chunks inserted to PostgreSQL (no embeddings yet), Document record created (status=processing)
   │
   ▼
5. API returns immediately (fast response to user)
   │
   Background thread continues:
   │
   ├─ embed_batch() → BGE Large encodes all chunks → stored in pgvector
   │
   ├─ enrich_metadata() → Gemini analyzes first 15k chars →
   │    summary, keywords, doc_type, department, version, dates, classification
   │
   ├─ Version Intelligence check → sets supersedes_id if older version found
   │
   ├─ _extract_graph_by_section() → groups chunks by heading →
   │    Gemini extracts entities + relationships per section →
   │    stored in Neo4j via MERGE (no duplicates)
   │
   └─ Document status → "ready"

6. User queries via Chat (RAG mode):
   question → embed_query() → pgvector cosine search (TOP_K=30)
            + keyword ILIKE search
            + Neo4j graph search
            → RRF fusion (top 20 chunks)
            → Gemini answer_question()
            → response

7. User queries via Agent Mode (admin/dept_officer only):
   question → LangGraph 11-agent pipeline:
   Planner → Retrieval → Legal → Financial → Graph →
   Calculation → Summarization → Synthesis →
   Gatekeeper → Auditor → Strategist → response
```

---

*Document generated from Simax Quanta v4.0.0 codebase.*
