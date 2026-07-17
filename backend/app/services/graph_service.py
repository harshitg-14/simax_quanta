"""
Phase 3 — Knowledge Graph Service
Neo4j: entities, relationships extracted from government documents
"""
import os
import re
import json
from neo4j import GraphDatabase
from app.services.ai_service import _call
from dotenv import load_dotenv

load_dotenv()

NEO4J_URI      = os.getenv("NEO4J_URI",      "bolt://localhost:7687")
NEO4J_USER     = os.getenv("NEO4J_USER",     "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")
if not NEO4J_PASSWORD:
    raise RuntimeError("NEO4J_PASSWORD environment variable is not set")

_CONFIG_PATH = os.path.join(os.path.dirname(__file__), "../graph_config.json")

_DEFAULT_CONFIG = {
    "entity_types": [
        "Ministry", "Scheme", "Beneficiary", "Department",
        "Location", "Organization", "Policy", "Act"
    ],
    "relation_types": [
        "FUNDS", "TARGETS", "IMPLEMENTS", "LAUNCHED_BY",
        "BENEFITS", "PART_OF", "LOCATED_IN", "GOVERNED_BY"
    ],
}

_driver = None


# ── Config helpers ────────────────────────────────────────────────────────────

def get_graph_config() -> dict:
    try:
        with open(_CONFIG_PATH) as f:
            cfg = json.load(f)
        # Always ensure defaults exist
        cfg.setdefault("entity_types",   list(_DEFAULT_CONFIG["entity_types"]))
        cfg.setdefault("relation_types", list(_DEFAULT_CONFIG["relation_types"]))
        return cfg
    except Exception:
        return {k: list(v) for k, v in _DEFAULT_CONFIG.items()}


def save_graph_config(config: dict):
    with open(_CONFIG_PATH, "w") as f:
        json.dump(config, f, indent=2)


def get_configured_entity_types() -> list:
    return get_graph_config()["entity_types"]


def get_configured_relation_types() -> list:
    return get_graph_config()["relation_types"]


def _valid_neo4j_label(name: str) -> bool:
    """Neo4j labels must start with a letter and contain only letters/digits/underscores."""
    return bool(re.match(r'^[A-Za-z][A-Za-z0-9_]*$', name))


# ── Name normalisation ────────────────────────────────────────────────────────

def normalize_name(name: str) -> str:
    return re.sub(r'\s+', ' ', name.strip())


# ── Driver ───────────────────────────────────────────────────────────────────

def get_driver():
    global _driver
    if _driver is None:
        _driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
        try:
            with _driver.session() as session:
                # Migrate existing nodes: add name_lower for cross-document dedup
                session.run("""
                    MATCH (n)
                    WHERE n.name IS NOT NULL AND n.name_lower IS NULL
                    SET n.name_lower = toLower(n.name)
                """)
        except Exception:
            pass
    return _driver


# ── Entity extraction ─────────────────────────────────────────────────────────

def extract_entities(chunk_text: str, document_id: str, heading_path: str) -> dict:
    """Use Gemini to extract entities and relationships from document text."""
    entity_types   = "|".join(get_configured_entity_types())
    relation_types = "|".join(get_configured_relation_types())

    prompt = f"""You are analyzing Indian government policy documents.
Extract named entities and relationships. Return ONLY valid JSON — no markdown, no explanation.

{{
  "entities": [
    {{"name": "entity name", "type": "{entity_types}"}}
  ],
  "relationships": [
    {{"from": "entity name", "relation": "{relation_types}", "to": "entity name"}}
  ]
}}

Rules:
- Extract ONLY government entities: ministries, schemes, departments, acts, policies, beneficiaries
- Ignore coaching institutes, test series, advertisements, social media handles, phone numbers
- Keep scheme names exact and full (e.g. "PM-KISAN", "STARTUP INDIA", "PMGSY")
- Max 20 entities, max 15 relationships

Text:
{chunk_text[:4000]}
"""
    try:
        raw = _call(prompt).strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return json.loads(raw.strip())
    except Exception:
        return {"entities": [], "relationships": []}


# ── Graph storage ─────────────────────────────────────────────────────────────

def store_graph(document_id: str, file_name: str, entities: list, relationships: list, heading_path: str = ""):
    """Store entities and relationships in Neo4j with cross-document deduplication."""
    driver = get_driver()
    valid_entity_types   = set(get_configured_entity_types())
    valid_relation_types = set(get_configured_relation_types())

    with driver.session() as session:
        session.run(
            "MERGE (d:Document {id: $id}) SET d.file_name = $file_name",
            id=document_id, file_name=file_name
        )

        for ent in entities:
            raw_name    = ent.get("name", "").strip()
            entity_type = ent.get("type", "").strip()
            if not raw_name or entity_type not in valid_entity_types:
                continue
            if not _valid_neo4j_label(entity_type):
                entity_type = "Entity"

            clean_name = normalize_name(raw_name)
            name_lower = clean_name.lower()
            # Deduplicate across documents using name_lower as the unique key per type
            cypher = (
                f"MERGE (e:{entity_type} {{name_lower: $name_lower}}) "
                f"ON CREATE SET e.name = $name, e.name_lower = $name_lower "
                f"ON MATCH SET e.name = $name "
                f"WITH e "
                f"MERGE (d:Document {{id: $doc_id}}) "
                f"MERGE (d)-[:CONTAINS]->(e)"
            )
            session.run(cypher, name=clean_name, name_lower=name_lower, doc_id=document_id)

        for rel in relationships:
            from_name = normalize_name(rel.get("from", "")).lower()
            to_name   = normalize_name(rel.get("to", "")).lower()
            relation  = rel.get("relation", "").strip().upper()
            if not from_name or not to_name or relation not in valid_relation_types:
                continue
            if not re.match(r'^[A-Z][A-Z0-9_]*$', relation):
                continue
            session.run(
                f"MATCH (a {{name_lower: $from_name}}) "
                f"MATCH (b {{name_lower: $to_name}}) "
                f"MERGE (a)-[:{relation}]->(b)",
                from_name=from_name, to_name=to_name
            )


# ── Graph deletion ────────────────────────────────────────────────────────────

def delete_document_graph(document_id: str):
    driver = get_driver()
    with driver.session() as session:
        session.run("""
            MATCH (d:Document {id: $doc_id})-[:CONTAINS]->(e)
            WHERE NOT EXISTS {
                MATCH (other:Document)-[:CONTAINS]->(e)
                WHERE other.id <> $doc_id
            }
            DETACH DELETE e
        """, doc_id=document_id)
        session.run("MATCH (d:Document {id: $doc_id}) DETACH DELETE d", doc_id=document_id)


# ── Queries ───────────────────────────────────────────────────────────────────

def query_graph(entity_name: str, hops: int = 1) -> dict:
    """Find relationships for a named entity. Supports 1–3 hop traversal."""
    hops = max(1, min(hops, 3))
    driver = get_driver()
    with driver.session() as session:
        result = session.run(
            f"""
            MATCH path = (n)-[*1..{hops}]-(m)
            WHERE toLower(n.name) CONTAINS toLower($term)
              AND NOT n:Document AND NOT m:Document
            WITH n, relationships(path) AS rels, m
            UNWIND rels AS r
            WITH n, r, m
            RETURN n.name AS source,
                   labels(n) AS source_type,
                   type(r) AS relation,
                   m.name AS target,
                   labels(m) AS target_type
            LIMIT 50
            """,
            term=entity_name
        )
        relationships = []
        seen = set()
        for r in result:
            key = (r["source"], r["relation"], r["target"])
            if key in seen:
                continue
            seen.add(key)
            src_labels = [l for l in (r["source_type"] or []) if l != "Document"]
            tgt_labels = [l for l in (r["target_type"] or []) if l != "Document"]
            relationships.append({
                "source":      r["source"],
                "source_type": src_labels[0] if src_labels else "Unknown",
                "relation":    r["relation"],
                "target":      r["target"],
                "target_type": tgt_labels[0] if tgt_labels else "Unknown",
            })
        return {"entity": entity_name, "hops": hops, "relationships": relationships}


def find_entity_path(from_entity: str, to_entity: str) -> dict:
    """Find shortest path between two entities (max 6 hops)."""
    driver = get_driver()
    with driver.session() as session:
        result = session.run(
            """
            MATCH (a), (b)
            WHERE toLower(a.name) CONTAINS toLower($from_term)
              AND toLower(b.name) CONTAINS toLower($to_term)
              AND NOT a:Document AND NOT b:Document AND a <> b
            WITH a, b LIMIT 1
            MATCH path = shortestPath((a)-[*..6]-(b))
            RETURN
              [node IN nodes(path) | {name: node.name, type: labels(node)[0]}] AS path_nodes,
              [rel  IN relationships(path) | type(rel)] AS path_rels,
              length(path) AS hops
            LIMIT 1
            """,
            from_term=from_entity, to_term=to_entity
        )
        record = result.single()
        if not record:
            return {"found": False, "from": from_entity, "to": to_entity, "path": [], "relations": []}
        return {
            "found":     True,
            "from":      from_entity,
            "to":        to_entity,
            "hops":      record["hops"],
            "path":      record["path_nodes"],
            "relations": record["path_rels"],
        }


def search_graph(query: str, entity_type: str = None) -> list:
    """Search entities by name with optional entity type filter."""
    driver = get_driver()
    with driver.session() as session:
        valid_types = set(get_configured_entity_types())
        if entity_type and entity_type in valid_types and _valid_neo4j_label(entity_type):
            result = session.run(
                f"""
                MATCH (n:{entity_type})
                WHERE toLower(n.name) CONTAINS toLower($term)
                RETURN n.name AS name, labels(n) AS types
                ORDER BY n.name
                LIMIT 50
                """,
                term=query
            )
        else:
            result = session.run(
                """
                MATCH (n)
                WHERE (toLower(n.name) CONTAINS toLower($term)
                   OR any(lbl IN labels(n) WHERE toLower(lbl) CONTAINS toLower($term)))
                  AND NOT n:Document
                RETURN n.name AS name, labels(n) AS types
                ORDER BY n.name
                LIMIT 50
                """,
                term=query
            )
        return [{"name": r["name"], "type": r["types"][0] if r["types"] else "Unknown"} for r in result]


def search_by_relation(relation_type: str) -> list:
    """Find all entity pairs connected by a specific relationship type."""
    valid_relations = set(get_configured_relation_types())
    if relation_type not in valid_relations or not re.match(r'^[A-Z][A-Z0-9_]*$', relation_type):
        return []
    driver = get_driver()
    with driver.session() as session:
        result = session.run(
            f"""
            MATCH (a)-[r:{relation_type}]->(b)
            WHERE NOT a:Document AND NOT b:Document
            RETURN a.name AS source, labels(a) AS source_type,
                   type(r) AS relation,
                   b.name AS target, labels(b) AS target_type
            ORDER BY a.name
            LIMIT 100
            """,
        )
        return [
            {
                "source":      r["source"],
                "source_type": (r["source_type"] or ["Unknown"])[0],
                "relation":    r["relation"],
                "target":      r["target"],
                "target_type": (r["target_type"] or ["Unknown"])[0],
            }
            for r in result
        ]


def get_entity_types() -> list:
    """Return all distinct entity type labels present in the graph with counts."""
    driver = get_driver()
    with driver.session() as session:
        result = session.run("""
            MATCH (n)
            WHERE NOT n:Document
            UNWIND labels(n) AS lbl
            RETURN DISTINCT lbl AS type, count(*) AS cnt
            ORDER BY cnt DESC
        """)
        return [{"type": r["type"], "count": r["cnt"]} for r in result]


def get_relation_types() -> list:
    """Return all distinct user-facing relationship types (excludes CONTAINS) with counts."""
    driver = get_driver()
    with driver.session() as session:
        result = session.run("""
            MATCH (a)-[r]->(b)
            WHERE NOT a:Document AND NOT b:Document AND type(r) <> 'CONTAINS'
            RETURN DISTINCT type(r) AS relation, count(*) AS cnt
            ORDER BY cnt DESC
        """)
        return [{"relation": r["relation"], "count": r["cnt"]} for r in result]


def get_document_graph(document_id: str) -> dict:
    driver = get_driver()
    with driver.session() as session:
        nodes_result = session.run(
            """
            MATCH (d:Document {id: $doc_id})-[:CONTAINS]->(e)
            RETURN e.name AS name, labels(e) AS types
            """,
            doc_id=document_id
        )
        nodes = [{"name": r["name"], "type": r["types"][0] if r["types"] else "Unknown"} for r in nodes_result]

        edges_result = session.run(
            """
            MATCH (d:Document {id: $doc_id})-[:CONTAINS]->(a)
            MATCH (a)-[r]->(b)
            WHERE NOT b:Document
            RETURN a.name AS source, type(r) AS relation, b.name AS target
            """,
            doc_id=document_id
        )
        edges = [{"source": r["source"], "relation": r["relation"], "target": r["target"]} for r in edges_result]

        return {"document_id": document_id, "nodes": nodes, "edges": edges}


def export_full_graph() -> dict:
    """Export all graph nodes and relationships (excluding Document nodes)."""
    driver = get_driver()
    with driver.session() as session:
        nodes_result = session.run("""
            MATCH (n)
            WHERE NOT n:Document AND n.name IS NOT NULL
            RETURN DISTINCT n.name AS name, labels(n) AS types
            ORDER BY n.name
        """)
        nodes = [{"name": r["name"], "type": r["types"][0] if r["types"] else "Unknown"} for r in nodes_result]

        edges_result = session.run("""
            MATCH (a)-[r]->(b)
            WHERE NOT a:Document AND NOT b:Document
            RETURN a.name AS source, labels(a) AS source_type,
                   type(r) AS relation,
                   b.name AS target, labels(b) AS target_type
        """)
        edges = [
            {
                "source":      r["source"],
                "source_type": (r["source_type"] or ["Unknown"])[0],
                "relation":    r["relation"],
                "target":      r["target"],
                "target_type": (r["target_type"] or ["Unknown"])[0],
            }
            for r in edges_result
        ]

        return {"total_nodes": len(nodes), "total_edges": len(edges), "nodes": nodes, "edges": edges}
