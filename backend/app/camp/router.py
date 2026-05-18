"""
Camp manager routes: /camp/*

All endpoints here require the camp_manager role.
"""
from asyncio import get_event_loop
from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import require_camp_manager
from app.meal_operations import service as meal_svc
from app.repositories.favorites import (
    add_extra,
    add_favorite,
    clear_all_user_data,
    get_extras,
    get_favorites,
    get_hidden,
    remove_extra,
    remove_favorite,
)
from app.repositories.managed_orders import (
    check_duplicate,
    create_managed_order,
    get_managed_orders,
    mark_failed,
    mark_submitted,
)
from app.repositories.users import get_all_users

router = APIRouter(prefix="/camp", tags=["camp"])

_pool = ThreadPoolExecutor(max_workers=4)


async def _run(fn, *args):
    loop = get_event_loop()
    return await loop.run_in_executor(_pool, fn, *args)


@router.get("/users")
async def camp_get_users(session: dict = Depends(require_camp_manager)):
    """List all kitchen_staff and category_manager users with their fav/extra counts."""
    users = get_all_users(roles=["kitchen_staff", "category_manager"])
    for user in users:
        user["fav_count"] = len(get_favorites(user["username"]))
        user["extra_count"] = len(get_extras(user["username"]))
    return users


@router.get("/user-data/{username}")
async def camp_get_user_data(
    username: str,
    session: dict = Depends(require_camp_manager),
):
    return {
        "favorites": get_favorites(username),
        "extra_employees": get_extras(username),
        "hidden": get_hidden(username),
    }


@router.post("/user-data/{username}/fav/save")
async def camp_save_user_fav(
    username: str,
    data: dict,
    session: dict = Depends(require_camp_manager),
):
    employee_id = data.get("employee_id")
    if not employee_id:
        raise HTTPException(status_code=400, detail="employee_id required")
    add_favorite(username, employee_id)
    return {"success": True}


@router.delete("/user-data/{username}/fav/remove")
async def camp_remove_user_fav(
    username: str,
    data: dict,
    session: dict = Depends(require_camp_manager),
):
    employee_id = data.get("employee_id")
    if not employee_id:
        raise HTTPException(status_code=400, detail="employee_id required")
    remove_favorite(username, employee_id)
    return {"success": True}


@router.post("/user-data/{username}/extra/save")
async def camp_save_user_extra(
    username: str,
    data: dict,
    session: dict = Depends(require_camp_manager),
):
    employee_id = data.get("employee_id")
    extra_type = data.get("extra_type", "rental")
    if not employee_id:
        raise HTTPException(status_code=400, detail="employee_id required")
    add_extra(
        username, employee_id, extra_type,
        data.get("name", ""), data.get("last_name", ""),
        data.get("dept_name", ""), data.get("job_title", ""), data.get("location", ""),
    )
    return {"success": True}


@router.delete("/user-data/{username}/extra/remove")
async def camp_remove_user_extra(
    username: str,
    data: dict,
    session: dict = Depends(require_camp_manager),
):
    employee_id = data.get("employee_id")
    if not employee_id:
        raise HTTPException(status_code=400, detail="employee_id required")
    remove_extra(username, employee_id)
    return {"success": True}


@router.delete("/user-data/{username}/clear")
async def camp_clear_user_data(
    username: str,
    session: dict = Depends(require_camp_manager),
):
    clear_all_user_data(username)
    return {"success": True}


# ── Managed order creation ─────────────────────────────────────────────────────

@router.post("/create-managed-order")
async def camp_create_managed_order(
    data: dict,
    session: dict = Depends(require_camp_manager),
):
    """
    Camp manager creates a NEW draft meal.order on behalf of a kitchen staff user.

    Body:
        source_user        : str        — kitchen staff username (FAV template)
        meal_type          : str        — breakfast | lunch | dinner | night
        date               : str        — YYYY-MM-DD
        employees          : list[int]  — final list of employee IDs
        employee_snapshot  : list[dict] — [{id, name, last_name, dept_name, job_title}]
        note               : str        — optional annotation

    Response variants (always HTTP 200):
        SUCCESS   : { "success": true,  "managed_order_id": N, "odoo_order_id": M }
        DUPLICATE : { "success": false, "reason": "duplicate_draft",
                      "existing_id": N, "existing_status": "submitted" }
        ERP_FAIL  : { "success": false, "reason": "erp_failed",
                      "managed_order_id": N, "message": "..." }

    Status lifecycle:
        draft_local → submitted  (ERP call OK)
        draft_local → failed     (ERP call failed — row kept for audit + retry)

    NEVER overwrites existing Odoo orders — always creates a fresh draft.
    """
    source_user       = data.get("source_user", "").strip()
    meal_type         = data.get("meal_type", "").strip()
    date              = data.get("date", "").strip()
    employee_ids      = data.get("employees", [])
    employee_snapshot = data.get("employee_snapshot", [])
    note              = data.get("note", "Camp manager managed order")

    # ── Input validation ──────────────────────────────────────────────────────
    if not source_user or not meal_type or not date:
        raise HTTPException(
            status_code=400,
            detail="source_user, meal_type, and date are required",
        )
    if not employee_ids or not isinstance(employee_ids, list):
        raise HTTPException(status_code=400, detail="employees must be a non-empty list of IDs")

    camp_manager = session.get("name", "")

    # ── Duplicate prevention ──────────────────────────────────────────────────
    conflict = check_duplicate(source_user, date, meal_type)
    if conflict:
        return {
            "success":         False,
            "reason":          "duplicate_draft",
            "existing_id":     conflict["id"],
            "existing_status": conflict["status"],
            "odoo_order_id":   conflict.get("odoo_order_id"),
            "created_at":      conflict.get("created_at"),
        }

    # ── 1. Insert local audit row (status = draft_local) ─────────────────────
    # Snapshot falls back to IDs-only dicts if the frontend omitted it.
    if not employee_snapshot:
        employee_snapshot = [{"id": eid} for eid in employee_ids]

    managed_id = create_managed_order(
        source_username   = source_user,
        meal_type         = meal_type,
        order_date        = date,
        managed_by        = camp_manager,
        employee_snapshot = employee_snapshot,
        note              = note,
    )

    # ── 2. Attempt ERP draft creation ─────────────────────────────────────────
    try:
        odoo_order_id = await _run(
            meal_svc.create_meal_order,
            date, meal_type, employee_ids,
        )
    except Exception as exc:
        # Record failure — row survives for audit and future retry
        mark_failed(managed_id, str(exc))
        return {
            "success":          False,
            "reason":           "erp_failed",
            "managed_order_id": managed_id,
            "message":          str(exc),
        }

    # ── 3. Mark submitted ─────────────────────────────────────────────────────
    mark_submitted(managed_id, odoo_order_id)

    return {
        "success":          True,
        "managed_order_id": managed_id,
        "odoo_order_id":    odoo_order_id,
    }


# ── Managed orders list ────────────────────────────────────────────────────────

@router.get("/managed-orders")
async def camp_list_managed_orders(
    source_username: str | None = None,
    page: int = 1,
    page_size: int = 20,
    session: dict = Depends(require_camp_manager),
):
    """
    Return paginated list of managed orders (newest first).
    Scoped to orders created by the requesting camp manager.
    Optionally filter by source_username (kitchen staff user).
    """
    limit  = max(1, min(page_size, 100))
    offset = (max(1, page) - 1) * limit

    result = get_managed_orders(
        managed_by      = session.get("name", ""),
        source_username = source_username or None,
        limit           = limit,
        offset          = offset,
    )
    return result
