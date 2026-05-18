"""
Camp manager routes: /camp/*

All endpoints here require the camp_manager role.
"""
from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import require_camp_manager
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
from app.repositories.users import get_all_users

router = APIRouter(prefix="/camp", tags=["camp"])


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
