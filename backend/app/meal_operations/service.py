"""
Meal-operations domain service.

All Odoo interaction goes through `OdooSession` (app.odoo.executor).
No raw execute_kw calls, no _models()/_connect_as_admin() references here.

Parallel-query pattern
──────────────────────
Independent Odoo calls are batched with `session.parallel()`.  The two
parallel rounds inside `get_orders` reduce 4 sequential Odoo round-trips
to 2 wall-clock RTTs:

  Round 1 (parallel) : read_group(state counts)  +  search_read(current page)
  Round 2 (parallel) : read(order_lines)         +  search_read(swipe records)

`get_order_detail` uses one parallel round (dept read + swipe read).

Sync-architecture note
──────────────────────
All *read* functions (get_orders, get_order_detail) call `admin_session()`
which returns an OdooSession.  To serve reads from a local sync table,
replace `admin_session()` with a `SyncedSession` that satisfies the same
interface while reading from the local DB.  Write functions (create, update,
bulk ops) should continue to go to Odoo directly.
"""
from __future__ import annotations

from app.odoo.executor import OdooSession, admin_session, user_session

# ── Constants ─────────────────────────────────────────────────────────────────

_ORDER_READ_FIELDS = [
    "id", "name", "date", "type", "state",
    "order_line", "department_id",
    "order_date", "create_uid", "employee_id",
    "total_count",
]

_ORDER_DETAIL_FIELDS = _ORDER_READ_FIELDS + ["note"]


# ── Internal helpers ──────────────────────────────────────────────────────────

def _exact_pairs_domain(pairs: list[tuple[str, str]]) -> list:
    """
    OPT-5: Build an Odoo domain that matches any of the given (date, meal_type) pairs exactly.

    Uses Odoo prefix/Polish-notation domain algebra:
      N pairs  →  (N-1) OR operators  +  N AND-groups of two leaf conditions each.

    Example for pairs [(d1,t1), (d2,t2)]:
      ["|", "&", ["date","=",d1], ["meal_type","=",t1],
                 "&", ["date","=",d2], ["meal_type","=",t2]]

    This prevents the cross-product over-fetch that arises from:
      [["date", "in", all_dates], ["meal_type", "in", all_meal_types]]
    which would return swipes for (d1,t2) and (d2,t1) even if those pairs
    have no real orders on the current page.
    """
    if not pairs:
        return [["id", "=", -1]]  # guaranteed-empty domain, no Odoo round-trip wasted
    if len(pairs) == 1:
        d, t = pairs[0]
        return [["date", "=", d], ["meal_type", "=", t]]
    # (N-1) OR operators, then N AND-groups
    domain: list = ["|"] * (len(pairs) - 1)
    for d, t in pairs:
        domain += ["&", ["date", "=", d], ["meal_type", "=", t]]
    return domain


def _flatten_order(row: dict) -> None:
    """Resolve Many2one fields to plain strings in-place."""
    dept    = row.get("department_id")
    creator = row.get("create_uid")
    emp     = row.get("employee_id")
    row["department_name"] = dept[1]    if dept    else ""
    row["created_by"]      = creator[1] if creator else ""
    row["submitted_by"]    = emp[1]     if emp     else (creator[1] if creator else "")


# ── Order listing ─────────────────────────────────────────────────────────────

def get_orders(
    state:     str | None = None,
    date_from: str | None = None,
    date_to:   str | None = None,
    limit:     int = 10,
    offset:    int = 0,
) -> dict:
    """
    Return a paginated response:
      {
        "items":        list[dict]  — current page's enriched order dicts,
        "total":        int         — total orders matching the filter,
        "state_counts": dict        — {state: count} for ALL matching orders,
      }

    Implementation: 2 parallel rounds → 4 Odoo calls in 2 wall-clock RTTs.
    """
    s = admin_session()

    # ── Build filter domains ──────────────────────────────────────────────────
    base_domain: list = []
    if date_from:
        base_domain.append(["date", ">=", date_from])
    if date_to:
        base_domain.append(["date", "<=", date_to])

    data_domain = base_domain + ([["state", "=", state]] if state else [])

    # ── Round 1: state-count aggregation + current page — parallel ────────────
    groups, orders = s.parallel(
        lambda: s.read_group(
            "meal.order", base_domain, ["state"], ["state"]
        ),
        lambda: s.search_read(
            "meal.order", data_domain, _ORDER_READ_FIELDS,
            order="date desc, id desc",
            limit=limit,
            offset=offset,
        ),
    )

    # read_group count key differs across Odoo versions
    state_counts: dict[str, int] = {
        g["state"]: (g.get("state_count") or g.get("__count") or 0)
        for g in groups
    }
    total = state_counts.get(state, 0) if state else sum(state_counts.values())

    if not orders:
        return {"items": [], "total": total, "state_counts": state_counts}

    for row in orders:
        _flatten_order(row)

    # ── Round 2: order-line employees + swipe records — parallel ──────────────
    all_line_ids = [lid for o in orders for lid in (o.get("order_line") or [])]

    # OPT-5: build exact (date, type) pairs instead of a cross-product domain.
    # A page of 10 orders covering 3 dates × 4 meal types previously fetched
    # swipes for 12 combinations; only the 3–4 real pairs are needed.
    exact_pairs = list({
        (o["date"], o["type"])
        for o in orders
        if o.get("date") and o.get("type")
    })
    swipe_domain = _exact_pairs_domain(exact_pairs)

    raw_lines, raw_swipes = s.parallel(
        lambda: (
            s.read("meal.order.line", all_line_ids, ["order_id", "employee_id"])
            if all_line_ids else []
        ),
        lambda: (
            s.search_read(
                "hr.employee.meal",
                swipe_domain,
                ["employee_id", "date", "meal_type"],
            )
            if exact_pairs else []
        ),
    )

    # order_id → set of employee_ids from order lines
    order_emp_ids: dict[int, set] = {o["id"]: set() for o in orders}
    for line in raw_lines:
        raw_order = line.get("order_id")
        raw_emp   = line.get("employee_id")
        if raw_order and raw_emp and raw_order[0] in order_emp_ids:
            order_emp_ids[raw_order[0]].add(raw_emp[0])

    # (date, meal_type) → set of swiped employee_ids
    swiped_map: dict[tuple, set] = {}
    for rec in raw_swipes:
        raw_emp = rec.get("employee_id")
        if raw_emp:
            swiped_map.setdefault(
                (rec.get("date"), rec.get("meal_type")), set()
            ).add(raw_emp[0])

    for order in orders:
        emp_ids    = order_emp_ids.get(order["id"], set())
        swiped_ids = swiped_map.get((order["date"], order["type"]), set())
        order["employee_count"] = len(emp_ids)
        order["swiped_count"]   = len(emp_ids & swiped_ids)

    return {"items": orders, "total": total, "state_counts": state_counts}


# ── Order detail ──────────────────────────────────────────────────────────────

def get_order_detail(order_id: int) -> dict | None:
    """
    Return full order detail with per-employee swipe status.
    Returns None when the order does not exist.

    The department read and swipe query run in parallel once we know the
    employee IDs from the order lines.
    """
    s = admin_session()

    rows = s.read("meal.order", [order_id], _ORDER_DETAIL_FIELDS)
    if not rows:
        return None

    row = rows[0]
    _flatten_order(row)

    line_ids  = row.get("order_line") or []
    employees: list[dict] = []

    if line_ids:
        lines       = s.read("meal.order.line", line_ids, ["employee_id", "state"])
        valid_lines = [ln for ln in lines if ln.get("employee_id")]
        emp_ids     = [ln["employee_id"][0] for ln in valid_lines]

        # Parallel: department names + swipe records
        emp_records, swiped_records = s.parallel(
            lambda: s.read("hr.employee", emp_ids, ["department_id"]) if emp_ids else [],
            lambda: (
                s.search_read(
                    "hr.employee.meal",
                    [["date", "=", row["date"]], ["meal_type", "=", row["type"]]],
                    ["employee_id"],
                )
                if row.get("date") and row.get("type") else []
            ),
        )

        dept_map: dict[int, str] = {
            e["id"]: (e["department_id"][1] if e.get("department_id") else "")
            for e in emp_records
        }
        swiped_ids: set[int] = {
            r["employee_id"][0]
            for r in swiped_records
            if r.get("employee_id")
        }

        employees = [
            {
                "id":         ln["employee_id"][0],
                "name":       ln["employee_id"][1],
                "line_id":    ln["id"],
                "dept_name":  dept_map.get(ln["employee_id"][0], ""),
                "line_state": ln.get("state") or "",
                "is_swiped":  ln["employee_id"][0] in swiped_ids,
            }
            for ln in valid_lines
        ]

    return {**row, "employees": employees}


# ── State transitions ─────────────────────────────────────────────────────────

def update_order_state(order_id: int, new_state: str) -> None:
    """
    Transition a single order's state.

    meal.order.state is readonly — direct write() is rejected by Odoo.
    Button methods are used instead:
      → "done"      : button_confirm
      → "canceled"  : button_cancel
      → anything else (e.g. "confirmed") : admin write() (no button found)
    """
    s = admin_session()
    if new_state == "done":
        s.call("meal.order", "button_confirm", order_id)
    elif new_state == "canceled":
        s.call("meal.order", "button_cancel", order_id)
    else:
        s.write("meal.order", order_id, {"state": new_state})


# ── Order lines ───────────────────────────────────────────────────────────────

def update_order_lines(order_id: int, employee_ids: list[int]) -> bool:
    """
    Reconcile the employee list on an order.
    Lines for removed employees are deleted (ORM cmd 2).
    Lines for new employees are created (ORM cmd 0).
    Returns False if the order does not exist.
    """
    s = admin_session()

    rows = s.read("meal.order", [order_id], ["order_line"])
    if not rows:
        return False

    current_line_ids = rows[0]["order_line"]
    emp_to_line: dict[int, int] = {}
    if current_line_ids:
        lines = s.read("meal.order.line", current_line_ids, ["employee_id"])
        emp_to_line = {
            ln["employee_id"][0]: ln["id"]
            for ln in lines
            if ln.get("employee_id")
        }

    to_delete = set(emp_to_line) - set(employee_ids)
    to_add    = set(employee_ids) - set(emp_to_line)

    commands = (
        [(2, emp_to_line[eid], 0) for eid in to_delete]
        + [(0, 0, {"employee_id": eid}) for eid in to_add]
    )

    if commands:
        s.write("meal.order", order_id, {"order_line": commands})
    return True


# ── Order creation ────────────────────────────────────────────────────────────

def _do_create_order(
    s: OdooSession,
    date: str,
    meal_type: str,
    employee_ids: list[int],
) -> int:
    """Create a meal.order with lines and return the new order ID."""
    return s.create("meal.order", {
        "date":       date,
        "type":       meal_type,
        # state is readonly — omit it; Odoo defaults to 'draft'
        "order_line": [(0, 0, {"employee_id": eid}) for eid in employee_ids],
    })


def create_meal_order(date: str, meal_type: str, employee_ids: list[int]) -> int:
    """Create an order as the admin service account."""
    return _do_create_order(admin_session(), date, meal_type, employee_ids)


def create_meal_order_as_user(
    date: str,
    meal_type: str,
    employee_ids: list[int],
    user_uid: int,
    user_password: str,
) -> int:
    """Create an order authenticated as the logged-in user (for Odoo audit trail)."""
    return _do_create_order(user_session(user_uid, user_password), date, meal_type, employee_ids)


# ── Bulk operations ───────────────────────────────────────────────────────────

def bulk_approve_orders(order_ids: list[int]) -> None:
    """Set state → done for a list of orders via button_confirm."""
    admin_session().call("meal.order", "button_confirm", order_ids)


def bulk_cancel_orders(order_ids: list[int]) -> None:
    """Set state → canceled for a list of orders via button_cancel."""
    admin_session().call("meal.order", "button_cancel", order_ids)


def bulk_delete_orders(order_ids: list[int]) -> None:
    """Permanently delete a list of orders (unlink — no recycle bin)."""
    admin_session().unlink("meal.order", order_ids)
