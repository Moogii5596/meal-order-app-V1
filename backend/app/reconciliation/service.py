"""
Reconciliation domain service — server-side mirror of the frontend reconciliationUtils.js.

Functions here operate on plain dicts (the shapes returned by meal_operations.service)
and contain no Odoo / HTTP dependencies, making them trivially testable.

Intended consumers:
  - Future /reconciliation/* API endpoints
  - Reporting aggregations that need the "problematic order" definition
  - Background tasks / scheduled integrity checks
"""
from __future__ import annotations


# ── Order-level helpers ───────────────────────────────────────────────────────

def is_order_problematic(order: dict) -> bool:
    """
    True when an order has employees but not all of them have swiped,
    AND the order is in an active (non-terminal) state.

    Matches the JS `isOrderProblematic` in frontend/reconciliationUtils.js.
    """
    terminal_states = {"canceled", "draft"}
    return (
        order.get("employee_count", 0) > 0
        and order.get("swiped_count", 0) < order.get("employee_count", 0)
        and order.get("state") not in terminal_states
    )


def filter_problematic_orders(orders: list[dict]) -> list[dict]:
    """Return only orders where is_order_problematic is True."""
    return [o for o in orders if is_order_problematic(o)]


def aggregate_swipe_stats(orders: list[dict]) -> dict:
    """
    Compute swipe statistics across a list of orders.

    Returns:
        total_employees:    int  — sum of employee_count
        total_swiped:       int  — sum of swiped_count
        missing_count:      int  — employees - swiped
        problematic_orders: int  — count of problematic orders
    """
    total_employees = sum(o.get("employee_count", 0) for o in orders)
    total_swiped    = sum(o.get("swiped_count",   0) for o in orders)
    return {
        "total_employees":    total_employees,
        "total_swiped":       total_swiped,
        "missing_count":      total_employees - total_swiped,
        "problematic_orders": sum(1 for o in orders if is_order_problematic(o)),
    }


# ── Employee-level helpers (used when full employee lists are available) ───────

def detect_missing_swipes(employees: list[dict]) -> list[dict]:
    """
    Return employees that were on the order but have not swiped.
    Excludes employees marked isNew (added on the fly, not from Odoo).
    """
    return [e for e in employees if not e.get("isNew") and not e.get("is_swiped")]


def detect_unexpected_swipes(
    employees: list[dict],
    confirmed_ids: list[int],
) -> list[dict]:
    """
    Return employees that swiped but were NOT in the confirmed order list.
    """
    id_set = set(confirmed_ids)
    return [e for e in employees if e.get("is_swiped") and e.get("id") not in id_set]


def detect_duplicates(employees: list[dict]) -> list[dict]:
    """
    Return employees whose ID appears more than once.
    Only the first occurrence of each duplicate ID is included.
    """
    seen:   set[int]  = set()
    dupes:  set[int]  = set()
    result: list[dict] = []

    for emp in employees:
        eid = emp.get("id")
        if eid is None:
            continue
        if eid in seen:
            if eid not in dupes:
                dupes.add(eid)
                result.append(emp)
        else:
            seen.add(eid)

    return result


def swipe_ratio(swiped: int, total: int) -> dict:
    """
    Compute a swipe ratio and status label.

    Returns:
        pct:    int    — rounded percentage (0-100)
        status: str    — "full" | "partial" | "none" | "empty"
    """
    if total == 0:
        return {"pct": 0, "status": "empty"}
    pct = round(swiped / total * 100)
    if pct >= 100:
        status = "full"
    elif pct > 0:
        status = "partial"
    else:
        status = "none"
    return {"pct": pct, "status": status}


def build_mismatch_summary(
    employees: list[dict],
    confirmed_ids: list[int],
) -> dict:
    """
    Full mismatch report for an order's employee list.

    Returns:
        total:            int
        swiped:           int
        missing_swipes:   list[dict]
        unexpected_swipes: list[dict]
        duplicates:       list[dict]
        has_mismatches:   bool
        ratio:            dict — see swipe_ratio()
    """
    total   = len(employees)
    swiped  = sum(1 for e in employees if e.get("is_swiped"))
    missing = detect_missing_swipes(employees)
    unexpected = detect_unexpected_swipes(employees, confirmed_ids)
    dupes   = detect_duplicates(employees)

    return {
        "total":             total,
        "swiped":            swiped,
        "missing_swipes":    missing,
        "unexpected_swipes": unexpected,
        "duplicates":        dupes,
        "has_mismatches":    bool(missing or unexpected or dupes),
        "ratio":             swipe_ratio(swiped, total),
    }
