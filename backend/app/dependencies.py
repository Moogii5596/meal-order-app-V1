"""
FastAPI dependency functions.

Use these with Depends() in route handlers to enforce authentication
and role-based access — no copy-pasted boilerplate needed in routes.

Example:
    @router.get("/my-employees")
    async def get_my_employees(session: dict = Depends(get_current_user)):
        username = session["name"]
        ...
"""
from typing import Optional

from fastapi import Depends, Header, HTTPException

from app.auth.service import extract_bearer_token, get_session


def get_current_user(
    authorization: Optional[str] = Header(None),
) -> dict:
    """Return the current session dict or raise 401."""
    token = extract_bearer_token(authorization)
    session = get_session(token)
    if not session:
        raise HTTPException(status_code=401, detail="Invalid or missing token")
    return session


def require_camp_manager(
    session: dict = Depends(get_current_user),
) -> dict:
    """Return session dict only if the user is a camp_manager, else raise 403."""
    if session.get("role") != "camp_manager":
        raise HTTPException(status_code=403, detail="Camp manager эрх шаардлагатай")
    return session
