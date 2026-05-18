"""
Employee and department routes.

Imports from app.employees.service (domain layer) — not from odoo.client directly.
"""
from asyncio import get_event_loop
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_current_user
from app.employees import service as emp_svc
from app.repositories.favorites import (
    add_extra,
    add_favorite,
    add_hidden,
    clear_all_user_data,
    get_extras,
    get_favorites,
    get_hidden,
    remove_extra,
    remove_favorite,
    remove_hidden,
)

router = APIRouter(tags=["employees"])

_pool = ThreadPoolExecutor(max_workers=10)


async def _run(fn, *args):
    loop = get_event_loop()
    return await loop.run_in_executor(_pool, fn, *args)


# ── Departments ───────────────────────────────────────────────────────────────

@router.get("/departments")
async def list_departments():
    return await _run(emp_svc.get_departments)


# ── Employees ─────────────────────────────────────────────────────────────────

@router.get("/employees")
async def list_employees(dept_id: int, date: str, meal_type: str):
    try:
        employees = await _run(emp_svc.get_employees_by_department, dept_id, date, meal_type)
        return {"employees": employees}
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Employee fetch failed") from exc


@router.get("/employees/search")
async def search_employees(q: str):
    return await _run(emp_svc.search_employees_global, q)


@router.get("/employees/rental")
async def get_rental_employees(q: str = ""):
    return await _run(emp_svc.get_rental_employees, q)


# ── My employees (favorites / extra / hidden) ─────────────────────────────────

@router.get("/my-employees")
async def get_my_employees(session: dict = Depends(get_current_user)):
    username = session["name"]
    return {
        "favorites":       get_favorites(username),
        "extra_employees": get_extras(username),
        "hidden":          get_hidden(username),
    }


@router.post("/my-employees/save")
async def save_my_employee(data: dict, session: dict = Depends(get_current_user)):
    employee_id = data.get("employee_id")
    if not employee_id:
        raise HTTPException(status_code=400, detail="employee_id required")
    add_favorite(session["name"], employee_id)
    return {"success": True}


@router.delete("/my-employees/remove")
async def remove_my_employee(data: dict, session: dict = Depends(get_current_user)):
    employee_id = data.get("employee_id")
    if not employee_id:
        raise HTTPException(status_code=400, detail="employee_id required")
    remove_favorite(session["name"], employee_id)
    return {"success": True}


@router.delete("/my-employees/clear-all")
async def clear_my_employees(session: dict = Depends(get_current_user)):
    """Shift reset: remove all favorites, extras, and hidden entries for the user."""
    clear_all_user_data(session["name"])
    return {"success": True}


@router.post("/my-extra-employees/save")
async def save_extra_employee(data: dict, session: dict = Depends(get_current_user)):
    employee_id = data.get("employee_id")
    extra_type  = data.get("extra_type")
    if not employee_id or not extra_type:
        raise HTTPException(status_code=400, detail="employee_id and extra_type required")
    add_extra(
        session["name"], employee_id, extra_type,
        data.get("name", ""), data.get("last_name", ""),
        data.get("dept_name", ""), data.get("job_title", ""), data.get("location", ""),
    )
    return {"success": True}


@router.delete("/my-extra-employees/remove")
async def remove_extra_employee(data: dict, session: dict = Depends(get_current_user)):
    employee_id = data.get("employee_id")
    if not employee_id:
        raise HTTPException(status_code=400, detail="employee_id required")
    remove_extra(session["name"], employee_id)
    return {"success": True}


@router.post("/my-hidden/save")
async def save_hidden_employee(data: dict, session: dict = Depends(get_current_user)):
    """Hide a department employee from the shift list."""
    employee_id = data.get("employee_id")
    if not employee_id:
        raise HTTPException(status_code=400, detail="employee_id required")
    add_hidden(session["name"], employee_id)
    return {"success": True}


@router.delete("/my-hidden/remove")
async def unhide_employee(data: dict, session: dict = Depends(get_current_user)):
    """Restore a previously hidden employee."""
    employee_id = data.get("employee_id")
    if not employee_id:
        raise HTTPException(status_code=400, detail="employee_id required")
    remove_hidden(session["name"], employee_id)
    return {"success": True}
