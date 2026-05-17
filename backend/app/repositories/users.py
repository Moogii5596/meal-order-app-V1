"""
Repository for the users table.

Tracks which users have logged in and their roles/departments,
so the camp_manager can view and manage them.
"""
from datetime import datetime
from typing import Optional
from app.database import get_db


def upsert_user(
    username: str,
    role: str,
    dept_id: Optional[int] = None,
    dept_name: Optional[str] = None,
    location: Optional[str] = None,
) -> None:
    """Insert or update a user record on login."""
    with get_db() as conn:
        conn.execute(
            """INSERT OR REPLACE INTO users
               (username, role, dept_id, dept_name, location, last_login)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (username, role, dept_id, dept_name, location, datetime.now().isoformat()),
        )
        conn.commit()


def get_all_users(roles: Optional[list[str]] = None) -> list[dict]:
    """Return all users, optionally filtered by role list."""
    with get_db() as conn:
        if roles:
            placeholders = ",".join("?" for _ in roles)
            rows = conn.execute(
                f"SELECT username, role, dept_id, dept_name, location, last_login "
                f"FROM users WHERE role IN ({placeholders})",
                roles,
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT username, role, dept_id, dept_name, location, last_login FROM users"
            ).fetchall()

    return [
        {
            "username": row["username"],
            "role": row["role"],
            "dept_id": row["dept_id"],
            "dept_name": row["dept_name"],
            "location": row["location"],
            "last_login": row["last_login"],
        }
        for row in rows
    ]
