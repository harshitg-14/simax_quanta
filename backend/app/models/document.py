from sqlalchemy import Column, String, Text, DateTime
from sqlalchemy.sql import func
from app.database.base import Base


class Document(Base):
    __tablename__ = "documents"

    id              = Column(String, primary_key=True)
    file_name       = Column(String, nullable=False)
    file_type       = Column(String)                   # pdf | xlsx | txt | docx
    storage_path    = Column(String, nullable=False)   # local path or S3 URL
    uploaded_by     = Column(String, nullable=False)
    upload_date     = Column(DateTime, server_default=func.now())

    # Module 1 — Document Ingestion
    extracted_text  = Column(Text)
    is_duplicate    = Column(String, default="false")
    file_hash       = Column(String, default=None)     # SHA-256 of file bytes — content-based duplicate detection

    # Module 3 — Metadata Enrichment
    ai_summary      = Column(Text)
    ai_keywords     = Column(Text)
    doc_type        = Column(String)     # policy | circular | notification | act | order | scheme | report
    department      = Column(String)
    version         = Column(String)
    issue_date      = Column(String)
    effective_date  = Column(String)
    classification  = Column(String)     # public | restricted | confidential
    processing_status = Column(String, default="ready")  # ready | processing | failed

    # Version Intelligence
    supersedes_id   = Column(String, default=None)     # ID of the older document this replaces
