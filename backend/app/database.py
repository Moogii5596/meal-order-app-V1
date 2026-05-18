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

from sqlalchemy import Column, DateTime, Integer, String, Text, UniqueConstraint, create_engine, func, text
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


class ManagedOrder(Base):
    """
    Audit trail for orders created by a camp manager on behalf of kitchen staff.

    Status lifecycle:
        draft_local → submitted   (ERP draft created successfully)
        draft_local → failed      (ERP call failed; error recorded)

    Columns added in Phase 1.5 hardening (applied via run_migrations() on startup):
        employee_count    — number of employees at submission time
        employee_snapshot — JSON array: [{id, name, last_name, dept_name, job_title}]
        error_message     — error text if ERP submission failed
        failed_at         — timestamp when the failure was recorded
    """
    __tablename__ = "managed_orders"

    id                  = Column(Integer, primary_key=True, autoincrement=True)
    source_username     = Column(String, nullable=False, index=True)
    meal_type           = Column(String, nullable=False)
    order_date          = Column(String, nullable=False)               # YYYY-MM-DD
    odoo_order_id       = Column(Integer, nullable=True)               # set after Odoo create
    managed_by          = Column(String, nullable=False, default="")   # camp manager username
    created_at          = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    status              = Column(String, nullable=False, default="draft_local")
    note                = Column(String, nullable=False, default="")
    # Phase 1.5 additions — nullable so existing rows survive without ALTER TABLE rewrite
    employee_count      = Column(Integer, nullable=True)
    employee_snapshot   = Column(Text, nullable=True)                  # JSON string
    error_message       = Column(String, nullable=True)
    failed_at           = Column(DateTime(timezone=True), nullable=True)


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

# Phase 1.5: idempotent DDL migrations.
# Each entry is a SQL statement that is safe to run repeatedly.
# ALTER TABLE … ADD COLUMN IF NOT EXISTS is a PostgreSQL extension (≥9.6).
_MIGRATIONS: list[str] = [
    # Rename created_by → managed_by (only if created_by still exists)
    # PostgreSQL does not support IF EXISTS on RENAME COLUMN before PG ≥11,
    # so we guard with a DO block.
    """
    DO $$
    BEGIN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name='managed_orders' AND column_name='created_by'
        ) AND NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name='managed_orders' AND column_name='managed_by'
        ) THEN
            ALTER TABLE managed_orders RENAME COLUMN created_by TO managed_by;
        END IF;
    END$$;
    """,
    # Phase 1.5 new columns
    "ALTER TABLE managed_orders ADD COLUMN IF NOT EXISTS employee_count   INTEGER;",
    "ALTER TABLE managed_orders ADD COLUMN IF NOT EXISTS employee_snapshot TEXT;",
    "ALTER TABLE managed_orders ADD COLUMN IF NOT EXISTS error_message    VARCHAR;",
    "ALTER TABLE managed_orders ADD COLUMN IF NOT EXISTS failed_at        TIMESTAMPTZ;",
    # Backfill managed_by default for rows that somehow slipped through without it
    "UPDATE managed_orders SET managed_by='' WHERE managed_by IS NULL;",
    # Update legacy 'draft' status → 'draft_local' for consistency
    "UPDATE managed_orders SET status='draft_local' WHERE status='draft';",
]


def init_db() -> None:
    """
    1. Create all tables that do not exist yet (CREATE TABLE IF NOT EXISTS semantics).
    2. Run idempotent column migrations for the managed_orders table.

    Called once at application startup (FastAPI lifespan).
    Safe to call multiple times.
    """
    Base.metadata.create_all(bind=engine)
    _run_migrations()


def _run_migrations() -> None:
    """
    Apply the Phase 1.5 DDL migrations against an already-created managed_orders
    table.  Each statement is idempotent — safe to run on every startup.
    """
    with engine.begin() as conn:
        for stmt in _MIGRATIONS:
            try:
                conn.execute(text(stmt))
            except Exception:
                # Log but don't crash — a missing column is caught at runtime,
                # not silently skipped.  On a fresh DB all ADD IF NOT EXISTS
                # statements will succeed without error anyway.
                pass
