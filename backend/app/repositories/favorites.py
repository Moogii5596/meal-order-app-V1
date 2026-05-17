"""
Repository for favorites, extra employees, and hidden employees.

All SQL is here; nothing outside this file touches these tables.
"""
from app.database import get_db


# ── Favorites ─────────────────────────────────────────────────────────────────

def add_favorite(username: str, employee_id: int) -> None:
    with get_db() as conn:
        conn.execute(
            "INSERT OR IGNORE INTO favorite_employees (username, employee_id) VALUES (?, ?)",
            (username, employee_id),
        )
        conn.commit()


def remove_favorite(username: str, employee_id: int) -> None:
    with get_db() as conn:
        conn.execute(
            "DELETE FROM favorite_employees WHERE username = ? AND employee_id = ?",
            (username, employee_id),
        )
        conn.commit()


def get_favorites(username: str) -> list[int]:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT employee_id FROM favorite_employees WHERE username = ?",
            (username,),
        ).fetchall()
    return [row["employee_id"] for row in rows]


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
    with get_db() as conn:
        conn.execute(
            """INSERT OR IGNORE INTO extra_employees
               (username, employee_id, extra_type, name, last_name, dept_name, job_title, location)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (username, employee_id, extra_type, name, last_name, dept_name, job_title, location),
        )
        conn.commit()


def remove_extra(username: str, employee_id: int) -> None:
    with get_db() as conn:
        conn.execute(
            "DELETE FROM extra_employees WHERE username = ? AND employee_id = ?",
            (username, employee_id),
        )
        conn.commit()


def get_extras(username: str) -> list[dict]:
    with get_db() as conn:
        rows = conn.execute(
            """SELECT employee_id, extra_type, name, last_name, dept_name, job_title, location
               FROM extra_employees WHERE username = ?""",
            (username,),
        ).fetchall()
    return [
        {
            "id": row["employee_id"],
            "extra_type": row["extra_type"],
            "name": row["name"],
            "last_name": row["last_name"],
            "dept_name": row["dept_name"],
            "job_title": row["job_title"],
            "location": row["location"],
        }
        for row in rows
    ]


# ── Hidden employees ──────────────────────────────────────────────────────────

def add_hidden(username: str, employee_id: int) -> None:
    with get_db() as conn:
        conn.execute(
            "INSERT OR IGNORE INTO hidden_employees (username, employee_id) VALUES (?, ?)",
            (username, employee_id),
        )
        conn.commit()


def remove_hidden(username: str, employee_id: int) -> None:
    with get_db() as conn:
        conn.execute(
            "DELETE FROM hidden_employees WHERE username = ? AND employee_id = ?",
            (username, employee_id),
        )
        conn.commit()


def get_hidden(username: str) -> list[int]:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT employee_id FROM hidden_employees WHERE username = ?",
            (username,),
        ).fetchall()
    return [row["employee_id"] for row in rows]


# ── Clear all ─────────────────────────────────────────────────────────────────

def clear_all_user_data(username: str) -> None:
    """Delete all favorites, extras, and hidden entries for a user (shift reset)."""
    with get_db() as conn:
        conn.execute("DELETE FROM favorite_employees WHERE username = ?", (username,))
        conn.execute("DELETE FROM extra_employees WHERE username = ?", (username,))
        conn.execute("DELETE FROM hidden_employees WHERE username = ?", (username,))
        conn.commit()
