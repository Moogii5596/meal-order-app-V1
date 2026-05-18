"""
Repository for managed_orders — camp-manager-created orders.

All DB access for the managed_orders table goes here.
Nothing outside this file touches the managed_orders table.

Status lifecycle
────────────────
  draft_local  — row created locally; ERP call not yet attempted
  submitted    — ERP meal.order created successfully
  failed       — ERP call failed; error_message + failed_at recorded

Duplicate prevention
────────────────────
`check_duplicate()` queries for any row with the same
(source_username, order_date, meal_type) whose status is NOT 'failed'.
A 'failed' row does NOT block a retry.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone

from app.database import ManagedOrder, get_db

# Statuses that block a new submission (a 'failed' row is always retryable)
_BLOCKING_STATUSES = ("draft_local", "submitted")


# ── Duplicate prevention ──────────────────────────────────────────────────────

def check_duplicate(
    source_username: str,
    order_date: str,
    meal_type: str,
) -> dict | None:
    """
    Return the conflicting row as a dict if a non-failed managed order
    already exists for this (source_username, order_date, meal_type).
    Returns None if safe to proceed.
    """
    with get_db() as session:
        row = (
            session.query(ManagedOrder)
            .filter(
                ManagedOrder.source_username == source_username,
                ManagedOrder.order_date      == order_date,
                ManagedOrder.meal_type       == meal_type,
                ManagedOrder.status.in_(_BLOCKING_STATUSES),
            )
            .order_by(ManagedOrder.created_at.desc())
            .first()
        )
    if row is None:
        return None
    return {
        "id":             row.id,
        "status":         row.status,
        "odoo_order_id":  row.odoo_order_id,
        "created_at":     row.created_at.isoformat() if row.created_at else None,
        "managed_by":     row.managed_by,
        "employee_count": row.employee_count,
    }


# ── Create ────────────────────────────────────────────────────────────────────

def create_managed_order(
    source_username: str,
    meal_type: str,
    order_date: str,
    managed_by: str,
    employee_snapshot: list[dict],
    note: str = "",
) -> int:
    """
    Insert a managed_order row with status='draft_local' and return its id.
    The employee_snapshot is serialised to JSON before storage.
    odoo_order_id is set later via mark_submitted() or mark_failed().
    """
    snapshot_json  = json.dumps(employee_snapshot, ensure_ascii=False)
    employee_count = len(employee_snapshot)

    with get_db() as session:
        row = ManagedOrder(
            source_username   = source_username,
            meal_type         = meal_type,
            order_date        = order_date,
            managed_by        = managed_by,
            status            = "draft_local",
            note              = note,
            employee_count    = employee_count,
            employee_snapshot = snapshot_json,
        )
        session.add(row)
        session.commit()
        session.refresh(row)
        return row.id


# ── State transitions ─────────────────────────────────────────────────────────

def mark_submitted(managed_order_id: int, odoo_order_id: int) -> None:
    """ERP call succeeded — record the Odoo order id and flip status."""
    with get_db() as session:
        row = session.query(ManagedOrder).filter_by(id=managed_order_id).first()
        if row:
            row.odoo_order_id = odoo_order_id
            row.status        = "submitted"
            row.error_message = None
            row.failed_at     = None
            session.commit()


def mark_failed(managed_order_id: int, error_message: str) -> None:
    """
    ERP call failed — record error details and flip status to 'failed'.
    The row remains in the DB as an audit trail; the camp manager can retry.
    """
    with get_db() as session:
        row = session.query(ManagedOrder).filter_by(id=managed_order_id).first()
        if row:
            row.status        = "failed"
            row.error_message = error_message[:1000]  # guard against very long tracebacks
            row.failed_at     = datetime.now(timezone.utc)
            session.commit()


# ── List / read ───────────────────────────────────────────────────────────────

def get_managed_orders(
    managed_by: str | None = None,
    source_username: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> dict:
    """
    Return managed order rows as dicts, newest first.
    Optionally filter by managed_by (camp manager) or source_username.
    Returns { "items": [...], "total": int }.
    """
    with get_db() as session:
        q = session.query(ManagedOrder)
        if managed_by:
            q = q.filter(ManagedOrder.managed_by == managed_by)
        if source_username:
            q = q.filter(ManagedOrder.source_username == source_username)

        total = q.count()
        rows  = (
            q.order_by(ManagedOrder.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )

    items = [_row_to_dict(row) for row in rows]
    return {"items": items, "total": total}


def _row_to_dict(row: ManagedOrder) -> dict:
    """Serialise a ManagedOrder ORM row to a plain dict."""
    snapshot = None
    if row.employee_snapshot:
        try:
            snapshot = json.loads(row.employee_snapshot)
        except (json.JSONDecodeError, TypeError):
            snapshot = []

    return {
        "id":                row.id,
        "source_username":   row.source_username,
        "meal_type":         row.meal_type,
        "order_date":        row.order_date,
        "odoo_order_id":     row.odoo_order_id,
        "managed_by":        row.managed_by,
        "created_at":        row.created_at.isoformat() if row.created_at else None,
        "status":            row.status,
        "note":              row.note,
        "employee_count":    row.employee_count,
        "employee_snapshot": snapshot,
        "error_message":     row.error_message,
        "failed_at":         row.failed_at.isoformat() if row.failed_at else None,
    }
