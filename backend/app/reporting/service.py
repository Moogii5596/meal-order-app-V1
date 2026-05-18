"""
Reporting domain service — server-side mirror of frontend/reportingUtils.js.

Pure aggregation functions: no Odoo or HTTP dependencies.
Input: the list-level order dicts returned by meal_operations.service.get_orders().

Intended consumers:
  - Future GET /reporting/* endpoints
  - Scheduled digest jobs
  - Data export pipelines (CSV generation on the backend)

MEAL_LABELS / STATE_LABELS intentionally duplicated from the frontend constants
so the backend stays self-contained and can serve API clients that aren't the React app.
"""
from __future__ import annotations

from app.reconciliation.service import is_order_problematic

# ── Label maps ────────────────────────────────────────────────────────────────

MEAL_LABELS: dict[str, str] = {
    "breakfast": "Өглөөний цай",
    "lunch":     "Өдрийн хоол",
    "dinner":    "Оройн хоол",
    "snack":     "Завсарлага",
}

STATE_LABELS: dict[str, str] = {
    "draft":     "Ноорог",
    "done":      "Баталсан",
    "confirmed": "ТН баталсан",
    "canceled":  "Цуцалсан",
}


# ── Aggregations ──────────────────────────────────────────────────────────────

def aggregate_by_meal(orders: list[dict]) -> list[dict]:
    """
    Group orders by meal type.

    Returns a list sorted descending by order count, each entry:
      { type, label, orders, employees, swiped, problematic }
    """
    acc: dict[str, dict] = {}
    for o in orders:
        key = o.get("type") or "unknown"
        if key not in acc:
            acc[key] = {
                "type":        key,
                "label":       MEAL_LABELS.get(key, key),
                "orders":      0,
                "employees":   0,
                "swiped":      0,
                "problematic": 0,
            }
        acc[key]["orders"]    += 1
        acc[key]["employees"] += o.get("employee_count", 0)
        acc[key]["swiped"]    += o.get("swiped_count",   0)
        if is_order_problematic(o):
            acc[key]["problematic"] += 1

    return sorted(acc.values(), key=lambda r: r["orders"], reverse=True)


def aggregate_by_submitter(orders: list[dict]) -> list[dict]:
    """
    Group orders by the submitting user (kitchen staff / camp manager).

    Returns a list sorted descending by order count, each entry:
      { submitter, orders, employees, swiped, problematic }
    """
    acc: dict[str, dict] = {}
    for o in orders:
        key = o.get("submitted_by") or o.get("created_by") or "—"
        if key not in acc:
            acc[key] = {
                "submitter":   key,
                "orders":      0,
                "employees":   0,
                "swiped":      0,
                "problematic": 0,
            }
        acc[key]["orders"]    += 1
        acc[key]["employees"] += o.get("employee_count", 0)
        acc[key]["swiped"]    += o.get("swiped_count",   0)
        if is_order_problematic(o):
            acc[key]["problematic"] += 1

    return sorted(acc.values(), key=lambda r: r["orders"], reverse=True)


_STATE_SORT = ["draft", "done", "confirmed", "canceled"]


def aggregate_by_state(orders: list[dict]) -> list[dict]:
    """
    Group orders by state, sorted by canonical state order.

    Each entry: { state, label, orders, employees, swiped }
    """
    acc: dict[str, dict] = {}
    for o in orders:
        key = o.get("state") or "unknown"
        if key not in acc:
            acc[key] = {
                "state":     key,
                "label":     STATE_LABELS.get(key, key),
                "orders":    0,
                "employees": 0,
                "swiped":    0,
            }
        acc[key]["orders"]    += 1
        acc[key]["employees"] += o.get("employee_count", 0)
        acc[key]["swiped"]    += o.get("swiped_count",   0)

    def _sort_key(r):
        try:
            return _STATE_SORT.index(r["state"])
        except ValueError:
            return len(_STATE_SORT)

    return sorted(acc.values(), key=_sort_key)


def build_kpis(orders: list[dict]) -> dict:
    """
    Compute top-level operational KPIs from a list of orders.

    Returns:
        total:           int   — order count
        employees:       int   — sum of employee_count
        swiped:          int   — sum of swiped_count
        missing:         int   — employees - swiped
        swipe_pct:       int   — rounded %
        problematic:     int   — orders with incomplete swipes in active states
        avg_emp:         int   — average employees per order
        state_breakdown: dict  — { state: count }
    """
    total      = len(orders)
    employees  = sum(o.get("employee_count", 0) for o in orders)
    swiped     = sum(o.get("swiped_count",   0) for o in orders)
    missing    = employees - swiped
    swipe_pct  = round(swiped / employees * 100) if employees > 0 else 0
    problematic = sum(1 for o in orders if is_order_problematic(o))
    avg_emp    = round(employees / total) if total > 0 else 0

    state_breakdown: dict[str, int] = {}
    for o in orders:
        s = o.get("state") or "unknown"
        state_breakdown[s] = state_breakdown.get(s, 0) + 1

    return {
        "total":           total,
        "employees":       employees,
        "swiped":          swiped,
        "missing":         missing,
        "swipe_pct":       swipe_pct,
        "problematic":     problematic,
        "avg_emp":         avg_emp,
        "state_breakdown": state_breakdown,
    }
