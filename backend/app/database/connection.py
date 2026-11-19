from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.core.config import DATABASE_URL

# Sized for 10-15 concurrent users without memory bloat
engine = create_engine(
    DATABASE_URL,
    pool_size=15,          # Keeps up to 15 active connections ready
    max_overflow=10,       # Allows surge bursts up to 25 total connections
    pool_timeout=30,       # Max seconds to wait for a connection
    pool_recycle=1800,     # Recycle connections every 30 mins to prevent memory leaks
    pool_pre_ping=True,    # Drops dead/broken connections automatically
    echo=False
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()