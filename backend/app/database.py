"""
SQLAlchemy database layer.

Replaces the previous sqlite3-based implementation.

Usage in repositories:
    with get_db() as session:
        session.add(...)
        session.commit()

Engine notes
────────────
  - DATABASE_URL must be a PostgreSQL URL (Neon / Railway / Render).
  - Neon and Railway sometimes emit "postgres://" prefixed URLs;
    we normalise those to "postgresql://" so SQLAlchemy 1.4+ accepts them.
  - sslmode=require is enforced via connect_args — Neon requires SSL.
  - pool_pre_ping=True drops stale connections silently (serverless DB
    instances sleep and close idle connections frequently).

Table definitions mirror the original SQLite schema exactly so that
existing data can be migrated with a single pg_restore / COPY if needed.
"""
from __future__ import annotations

from contextlib import contextmanager

from sqlalchemy import Column, Integer, String, UniqueConstraint, create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import DATABASE_URL


# ── Engine ────────────────────────────────────────────────────────────────────

def _build_engine():
    if not DATABASE_URL:
        raise RuntimeError(
            "DATABASE_URL environment variable is not set. "
            "Add it to your .env file or deployment config.\n"
            "Format: postgresql://user:pass@host:port/dbname?sslmode=require"
        )

    url = DATABASE_URL
    # Normalise legacy "postgres://" prefix (Heroku / older Railway URLs)
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]

    return create_engine(
        url,
        connect_args={"sslmode": "require"},
        pool_pre_ping=True,      # detect broken / sleeping connections
        pool_size=5,             # keep 5 persistent connections
        max_overflow=10,         # up to 10 extra connections under burst load
        echo=False,
    )


engine = _build_engine()
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


# ── ORM models ────────────────────────────────────────────────────────────────

class Base(DeclarativeBase):
    pass


class FavoriteEmployee(Base):
    """One row per (username, employee_id) pair a user has marked as favourite."""
    __tablename__ = "favorite_employees"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    username    = Column(String, nullable=False, index=True)
    employee_id = Column(Integer, nullable=False)

    __table_args__ = (
        UniqueConstraint("username", "employee_id", name="uq_favorite_employees"),
    )


class ExtraEmployee(Base):
    """Employees added outside the normal dept roster (rental drivers, etc.)."""
    __tablename__ = "extra_employees"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    username    = Column(String, nullable=False, index=True)
    employee_id = Column(Integer, nullable=False)
    extra_type  = Column(String, nullable=False, default="")
    name        = Column(String, nullable=False, default="")
    last_name   = Column(String, nullable=False, default="")
    dept_name   = Column(String, nullable=False, default="")
    job_title   = Column(String, nullable=False, default="")
    location    = Column(String, nullable=False, default="")

    __table_args__ = (
        UniqueConstraint("username", "employee_id", name="uq_extra_employees"),
    )


class HiddenEmployee(Base):
    """Employees suppressed from the shift view for a given user."""
    __tablename__ = "hidden_employees"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    username    = Column(String, nullable=False, index=True)
    employee_id = Column(Integer, nullable=False)

    __table_args__ = (
        UniqueConstraint("username", "employee_id", name="uq_hidden_employees"),
    )


class User(Base):
    """Login registry — tracks roles and departments for camp manager oversight."""
    __tablename__ = "users"

    username   = Column(String, primary_key=True)
    role       = Column(String)
    dept_id    = Column(Integer)
    dept_name  = Column(String)
    location   = Column(String)
    last_login = Column(String)   # ISO-8601 string, kept as text to match old schema


# ── Session helper ────────────────────────────────────────────────────────────

@contextmanager
def get_db():
    """
    Yield a SQLAlchemy session and guarantee cleanup on exit.

    Usage:
        with get_db() as session:
            session.add(obj)
            session.commit()
    """
    session: Session = SessionLocal()
    try:
        yield session
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


# ── Startup ───────────────────────────────────────────────────────────────────

def init_db() -> None:
    """
    Create all tables if they do not already exist.

    Called once at application startup (FastAPI lifespan).
    Safe to call multiple times — CREATE TABLE IF NOT EXISTS semantics.
    """
    Base.metadata.create_all(bind=engine)
