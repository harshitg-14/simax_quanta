from sqlalchemy import Column, String, Text, DateTime, Boolean
from sqlalchemy.sql import func
from app.database.base import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id          = Column(String, primary_key=True)
    user_id     = Column(String)
    action      = Column(String)    # upload | query | delete | login
    document_id = Column(String)
    query       = Column(Text)
    response    = Column(Text)
    escalate    = Column(Boolean, default=False)   # flagged by strategist for human review
    timestamp   = Column(DateTime, server_default=func.now())
