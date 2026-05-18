"""
Repository for favorites, extra employees, and hidden employees.

All DB access is here; nothing outside this file touches these tables.
Uses SQLAlchemy ORM — no raw sqlite3 calls.

Upsert strategy
───────────────
PostgreSQL INSERT … ON CONFLICT DO NOTHING replaces SQLite's
INSERT OR IGNORE.  The dialect-specific insert is imported from
sqlalchemy.dialects.postgresql so the intent is explicit and the
ON CONFLICT clause is handled at the DB level (atomic, no race window).
"""
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.database import ExtraEmployee, FavoriteEmployee, HiddenEmployee, get_db


# ── Favorites ─────────────────────────────────────────────────────────────────

def add_favorite(username: str, employee_id: int) -> None:
    with get_db() as session:
        stmt = (
            pg_insert(FavoriteEmployee)
            .values(username=username, employee_id=employee_id)
            .on_conflict_do_nothing(constraint="uq_favorite_employees")
        )
        session.execute(stmt)
        session.commit()


def remove_favorite(username: str, employee_id: int) -> None:
    with get_db() as session:
        session.query(FavoriteEmployee).filter_by(
            username=username, employee_id=employee_id
        ).delete(synchronize_session=False)
        session.commit()


def get_favorites(username: str) -> list[int]:
    with get_db() as session:
        rows = (
            session.query(FavoriteEmployee.employee_id)
            .filter_by(username=username)
            .all()
        )
    return [row.employee_id for row in rows]


# ── Extra employees ───────────────────────────────────────────────────────────

def add_extra(
    username: str,
    employee_id: int,
    extra_type: str,
    name: str = "",
    last_name: str = "",
    dept_name: str = "",
    job_title: str = "",
    location: str = "",
) -> None:
    with get_db() as session:
        stmt = (
            pg_insert(ExtraEmployee)
            .values(
                username=username,
                employee_id=employee_id,
                extra_type=extra_type,
                name=name,
                last_name=last_name,
                dept_name=dept_name,
                job_title=job_title,
                location=location,
            )
            .on_conflict_do_nothing(constraint="uq_extra_employees")
        )
        session.execute(stmt)
        session.commit()


def remove_extra(username: str, employee_id: int) -> None:
    with get_db() as session:
        session.query(ExtraEmployee).filter_by(
            username=username, employee_id=employee_id
        ).delete(synchronize_session=False)
        session.commit()


def get_extras(username: str) -> list[dict]:
    with get_db() as session:
        rows = (
            session.query(ExtraEmployee)
            .filter_by(username=username)
            .all()
        )
    return [
        {
            "id":         row.employee_id,
            "extra_type": row.extra_type,
            "name":       row.name,
            "last_name":  row.last_name,
            "dept_name":  row.dept_name,
            "job_title":  row.job_title,
            "location":   row.location,
        }
        for row in rows
    ]


# ── Hidden employees ──────────────────────────────────────────────────────────

def add_hidden(username: str, employee_id: int) -> None:
    with get_db() as session:
        stmt = (
            pg_insert(HiddenEmployee)
            .values(username=username, employee_id=employee_id)
            .on_conflict_do_nothing(constraint="uq_hidden_employees")
        )
        session.execute(stmt)
        session.commit()


def remove_hidden(username: str, employee_id: int) -> None:
    with get_db() as session:
        session.query(HiddenEmployee).filter_by(
            username=username, employee_id=employee_id
        ).delete(synchronize_session=False)
        session.commit()


def get_hidden(username: str) -> list[int]:
    with get_db() as session:
        rows = (
            session.query(HiddenEmployee.employee_id)
            .filter_by(username=username)
            .all()
        )
    return [row.employee_id for row in rows]


# ── Clear all ─────────────────────────────────────────────────────────────────

def clear_all_user_data(username: str) -> None:
    """Delete all favorites, extras, and hidden entries for a user (shift reset)."""
    with get_db() as session:
        session.query(FavoriteEmployee).filter_by(username=username).delete(
            synchronize_session=False
        )
        session.query(ExtraEmployee).filter_by(username=username).delete(
            synchronize_session=False
        )
        session.query(HiddenEmployee).filter_by(username=username).delete(
            synchronize_session=False
        )
        session.commit()
