"""
Repository for the users table.

Tracks which users have logged in and their roles/departments,
so the camp_manager can view and manage them.
Uses SQLAlchemy ORM — no raw sqlite3 calls.

Upsert strategy
───────────────
PostgreSQL INSERT … ON CONFLICT DO UPDATE replaces SQLite's
INSERT OR REPLACE.  All non-PK columns are refreshed on conflict
so login metadata (role, dept, last_login) stays current.
"""
from datetime import datetime
from typing import Optional

from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.database import User, get_db


def upsert_user(
    username: str,
    role: str,
    dept_id: Optional[int] = None,
    dept_name: Optional[str] = None,
    location: Optional[str] = None,
) -> None:
    """Insert or update a user record on login."""
    now = datetime.now().isoformat()
    with get_db() as session:
        stmt = (
            pg_insert(User)
            .values(
                username=username,
                role=role,
                dept_id=dept_id,
                dept_name=dept_name,
                location=location,
                last_login=now,
            )
            .on_conflict_do_update(
                index_elements=["username"],
                set_={
                    "role":       role,
                    "dept_id":    dept_id,
                    "dept_name":  dept_name,
                    "location":   location,
                    "last_login": now,
                },
            )
        )
        session.execute(stmt)
        session.commit()


def get_all_users(roles: Optional[list[str]] = None) -> list[dict]:
    """Return all users, optionally filtered by role list."""
    with get_db() as session:
        q = session.query(User)
        if roles:
            q = q.filter(User.role.in_(roles))
        rows = q.all()

    return [
        {
            "username":   row.username,
            "role":       row.role,
            "dept_id":    row.dept_id,
            "dept_name":  row.dept_name,
            "location":   row.location,
            "last_login": row.last_login,
        }
        for row in rows
    ]
