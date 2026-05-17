"""
Auth routes: /login, /me
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth.service import create_token
from app.dependencies import get_current_user
from app.odoo.client import authenticate_user
from app.repositories.users import upsert_user

router = APIRouter(tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
async def login(data: LoginRequest):
    from asyncio import get_event_loop
    from concurrent.futures import ThreadPoolExecutor

    loop = get_event_loop()
    with ThreadPoolExecutor() as pool:
        result = await loop.run_in_executor(
            pool, authenticate_user, data.username, data.password
        )

    if not result:
        raise HTTPException(status_code=401, detail="Нэвтрэх нэр эсвэл нууц үг буруу")

    token_payload = {
        "uid": result["uid"],
        "password": result["password"],
        "role": result["role"],
        "name": result["name"],
        "dept_id": result.get("dept_id"),
        "dept_name": result.get("dept_name"),
        "location": result.get("location"),
    }
    token = create_token(token_payload)

    upsert_user(
        result["name"],
        result["role"],
        result.get("dept_id"),
        result.get("dept_name"),
        result.get("location"),
    )

    return {
        "success": True,
        "token": token,
        "role": result["role"],
        "name": result["name"],
        "dept_id": result.get("dept_id"),
        "dept_name": result.get("dept_name"),
        "location": result.get("location"),
    }


@router.get("/me")
async def me(session: dict = Depends(get_current_user)):
    return {
        "role": session["role"],
        "name": session["name"],
        "dept_id": session.get("dept_id"),
        "dept_name": session.get("dept_name"),
        "location": session.get("location"),
    }
