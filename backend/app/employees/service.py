"""
Employees domain service.

All employee and department queries against Odoo go through `OdooSession`
(app.odoo.executor) — never raw execute_kw.

Caching strategy
────────────────
  get_departments()            → cache 10 min ("departments")
  get_rental_employees(q="")   → cache  5 min ("rental_employees")
  get_employees_by_department  → NOT cached  (swipe status changes every minute)
  search_employees_global      → NOT cached  (arbitrary user query)
  get_rental_employees(q=...)  → NOT cached  (dynamic filter)

Cache invalidation is time-based only.  If HR restructures mid-shift, the
old department list will clear in ≤ 10 minutes.  Call
`odoo_cache.delete("departments")` after a manual HR change if needed.

Sync-architecture note
──────────────────────
The two read-only functions that are cached (get_departments,
get_rental_employees) are the first candidates to be served from a local
sync table in a future sync architecture.
"""
from __future__ import annotations

from app.odoo.cache import odoo_cache
from app.odoo.client import RENTAL_DEPT_KEYWORD, RENTAL_DRIVER_STATUS_TYPE
from app.odoo.executor import admin_session


# ── Departments ───────────────────────────────────────────────────────────────

def get_departments() -> list[dict]:
    """
    Return all hr.department records (id, name).
    Result is cached for 10 minutes — departments change infrequently.
    """
    return odoo_cache.get_or_set(
        "departments",
        lambda: admin_session().search_read("hr.department", [], ["id", "name"]),
        ttl=600,
    )


# ── Employees ─────────────────────────────────────────────────────────────────

def get_employees_by_department(dept_id: int, date: str, meal_type: str) -> list[dict]:
    """
    Return employees in a department annotated with `is_swiped` for the
    given date and meal type.

    The department employee list and the swipe records are fetched in
    parallel (two independent Odoo calls → one wall-clock RTT).
    """
    s = admin_session()

    employees, swiped_meals = s.parallel(
        lambda: s.search_read(
            "hr.employee",
            [["department_id", "=", int(dept_id)]],
            ["id", "name", "last_name", "job_id", "location"],
        ),
        lambda: s.search_read(
            "hr.employee.meal",
            [["date", "=", date], ["meal_type", "=", meal_type]],
            ["employee_id"],
        ),
    )

    swiped_ids = {m["employee_id"][0] for m in swiped_meals if m["employee_id"]}
    for emp in employees:
        emp["is_swiped"] = emp["id"] in swiped_ids
        emp["job_title"] = emp["job_id"][1] if emp["job_id"] else "Тодорхойгүй"

    return employees


def search_employees_global(query: str) -> list[dict]:
    """
    Full-text employee search across all departments (max 20 results).
    Not cached — result depends on the user-supplied query string.
    """
    employees = admin_session().search_read(
        "hr.employee",
        [["name", "ilike", query]],
        ["id", "name", "last_name", "job_id", "department_id", "location"],
        limit=20,
    )
    for emp in employees:
        emp["is_swiped"] = False
        emp["job_title"] = emp["job_id"][1]        if emp["job_id"]        else "Тодорхойгүй"
        emp["dept_name"] = emp["department_id"][1] if emp["department_id"] else "Тодорхойгүй"
    return employees


def get_rental_employees(query: str = "") -> list[dict]:
    """
    Return employees whose hr.employee.status has type = RENTAL_DRIVER_STATUS_TYPE
    (i.e. state_id.type = "contract" — Түрээсийн жолооч).

    Unfiltered roster (query="") is cached for 5 minutes — the cohort is
    stable within a shift.  Name-filtered requests bypass the cache.
    """
    base_domain = [["state_id.type", "=", RENTAL_DRIVER_STATUS_TYPE]]

    if query:
        # Dynamic — not cached; search both name and last_name
        name_filter = [
            "|",
            ["name", "ilike", query],
            ["last_name", "ilike", query],
        ]
        raw = admin_session().search_read(
            "hr.employee",
            base_domain + name_filter,
            ["id", "name", "last_name", "job_id", "department_id", "location", "state_id"],
            limit=500,
        )
        return _annotate(raw)

    # Full roster — cache the annotated result
    return odoo_cache.get_or_set(
        "rental_driver_employees",
        lambda: _annotate(
            admin_session().search_read(
                "hr.employee",
                base_domain,
                ["id", "name", "last_name", "job_id", "department_id", "location", "state_id"],
                limit=500,
            )
        ),
        ttl=300,
    )


# ── Internal helpers ──────────────────────────────────────────────────────────

def _annotate(employees: list[dict]) -> list[dict]:
    """Add is_swiped / job_title / dept_name / status_name fields to a raw employee list."""
    for emp in employees:
        emp["is_swiped"]    = False
        emp["job_title"]    = emp["job_id"][1]        if emp["job_id"]        else "Тодорхойгүй"
        emp["dept_name"]    = emp["department_id"][1] if emp["department_id"] else "Тодорхойгүй"
        emp["status_name"]  = emp["state_id"][1]      if emp.get("state_id")  else ""
    return employees
