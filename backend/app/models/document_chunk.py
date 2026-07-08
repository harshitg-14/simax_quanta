from sqlalchemy import Column, String, Integer, Text
from pgvector.sqlalchemy import Vector
from app.database.base import Base


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id           = Column(String, primary_key=True)
    document_id  = Column(String, nullable=False)
    chunk_index  = Column(Integer)
    chunk_text   = Column(Text)
    heading_path = Column(Text)    # e.g. "Chapter 3 > Section 2 > Clause 4"
    chunk_type   = Column(String)  # heading | paragraph | table
    embedding    = Column(Vector(1024), nullable=True)  # Phase 2: BGE Large (1024-dim)
