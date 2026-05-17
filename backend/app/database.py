"""
SQLite connection helper.

Usage:
    with get_db() as conn:
        conn.execute(...)
        conn.commit()

The connection is always closed when the block exits, even on exception.
"""
import sqlite3
from contextlib import contextmanager
from app.config import DB_PATH


@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # rows behave like dicts
    try:
        yield conn
    finally:
        conn.close()


def init_db() -> None:
    """Create all tables if they don't already exist. Called once at startup."""
    with get_db() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS favorite_employees (
                username     TEXT,
                employee_id  INTEGER,
                UNIQUE(username, employee_id)
            );

            CREATE TABLE IF NOT EXISTS extra_employees (
                username     TEXT,
                employee_id  INTEGER,
                extra_type   TEXT,
                name         TEXT,
                last_name    TEXT,
                dept_name    TEXT,
                job_title    TEXT,
                location     TEXT,
                UNIQUE(username, employee_id)
            );

            CREATE TABLE IF NOT EXISTS hidden_employees (
                username     TEXT,
                employee_id  INTEGER,
                UNIQUE(username, employee_id)
            );

            CREATE TABLE IF NOT EXISTS users (
                username    TEXT PRIMARY KEY,
                role        TEXT,
                dept_id     INTEGER,
                dept_name   TEXT,
                location    TEXT,
                last_login  TEXT
            );
        """)
        conn.commit()
