from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Text, ForeignKey, DateTime, Index
)
from sqlalchemy.dialects.postgresql import TSVECTOR, JSONB
from sqlalchemy.orm import relationship
from app.database.connection import Base


class UserDocument(Base):
    __tablename__ = "user_documents"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    filename = Column(String(255), nullable=False)
    doc_type = Column(String(20), nullable=False)  # 'pdf', 'docx', 'url'
    source_url = Column(String(1000), nullable=True)
    file_size_bytes = Column(Integer, default=0)
    total_pages = Column(Integer, default=1)
    chunk_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("user_documents.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    page_number = Column(Integer, default=1)
    chunk_index = Column(Integer, nullable=False)
    chunk_text = Column(Text, nullable=False)

    # 384-dim dense vector stored as JSONB (100% native, zero extension required!)
    embedding = Column(JSONB, nullable=False)

    # Sparse Lexical Vector: For PostgreSQL keyword search
    search_vector = Column(TSVECTOR)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    document = relationship("UserDocument", back_populates="chunks")


# Multi-tenant and Hybrid Performance Indexes
Index("idx_doc_chunks_user", DocumentChunk.user_id)
Index("idx_doc_chunks_doc", DocumentChunk.document_id)