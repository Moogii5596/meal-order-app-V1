"""
Odoo XML-RPC transport layer.

Responsibilities (this file only):
  - SSL context and socket timeout
  - Admin UID cache (1-hour TTL)
  - Raw proxy constructors: _admin_uid(), _models(), _connect_as_admin(), _connect_as_user()
  - Group → role mapping constants
  - authenticate_user() — used by auth module at login time

Domain logic (employees, orders, reporting) lives in the dedicated service modules:
  app.employees.service
  app.meal_operations.service
  app.reconciliation.service
  app.reporting.service

SSL verification is disabled because the target Odoo instance uses a self-signed
certificate — do not change this without updating the cert.
"""
import socket
import ssl
import threading
import time
import xmlrpc.client

from app.config import ODOO_DB, ODOO_PASSWORD, ODOO_URL, ODOO_USERNAME

socket.setdefaulttimeout(30)

_ssl_context = ssl._create_unverified_context()  # noqa: SLF001 — intentional (see docstring)

# ── Admin UID cache ───────────────────────────────────────────────────────────
# Odoo session UIDs are stable for the lifetime of the admin password.
# We cache the UID for 1 hour to avoid an authenticate() round-trip on every request.
# The ServerProxy (models) is NOT cached: Python's xmlrpc Transport is not
# thread-safe for concurrent calls — each call gets its own fresh proxy.

_uid_lock:  threading.Lock = threading.Lock()
_uid_cache: dict            = {"uid": None, "expires": 0.0}


def _admin_uid() -> int:
    """Return the cached admin UID, re-authenticating only when the cache expires."""
    with _uid_lock:
        if _uid_cache["uid"] is not None and time.monotonic() < _uid_cache["expires"]:
            return _uid_cache["uid"]
        common = xmlrpc.client.ServerProxy(f"{ODOO_URL}/xmlrpc/common", context=_ssl_context)
        uid    = common.authenticate(ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD, {})
        if not uid:
            raise RuntimeError("Odoo admin authentication failed — check credentials in config")
        _uid_cache["uid"]     = uid
        _uid_cache["expires"] = time.monotonic() + 3600  # 1 hour
        return uid


def _models() -> xmlrpc.client.ServerProxy:
    """Return a fresh object-endpoint proxy (one per call — thread-safe by design)."""
    return xmlrpc.client.ServerProxy(f"{ODOO_URL}/xmlrpc/object", context=_ssl_context)


def _connect_as_admin() -> tuple[int, xmlrpc.client.ServerProxy]:
    """Return (uid, models). UID is cached; proxy is fresh per call."""
    return _admin_uid(), _models()


def _connect_as_user(user_uid: int, _user_password: str) -> xmlrpc.client.ServerProxy:
    """Return a models proxy (Odoo auth happens per-request via the uid/password pair)."""
    return xmlrpc.client.ServerProxy(f"{ODOO_URL}/xmlrpc/object", context=_ssl_context)


# ── Group → role mapping ──────────────────────────────────────────────────────
GROUP_ROLE_MAP: dict[str, str] = {
    "Кемп менежер":              "camp_manager",
    "Хоолны захиалга хянагч ТН": "category_manager",
    "Хоолны захиалга хянагч":    "kitchen_staff",
}

# Rental department search keyword — change here only
RENTAL_DEPT_KEYWORD = "түрээс"

# Rental driver filter — hr.employee.status whose type = "contract"
RENTAL_DRIVER_STATUS_TYPE = "contract"


# ── Auth ──────────────────────────────────────────────────────────────────────

def authenticate_user(username: str, password: str) -> dict | None:
    """
    Authenticate a user against Odoo and return their profile dict,
    or None if authentication fails or the user has no recognised role.

    Returned keys: role, name, uid, password, dept_id, dept_name, location
    """
    common = xmlrpc.client.ServerProxy(f"{ODOO_URL}/xmlrpc/common", context=_ssl_context)
    uid    = common.authenticate(ODOO_DB, username, password, {})
    if not uid:
        return None

    models = xmlrpc.client.ServerProxy(f"{ODOO_URL}/xmlrpc/object", context=_ssl_context)

    user_data = models.execute_kw(
        ODOO_DB, uid, password, "res.users", "read", [[uid]], {"fields": ["name"]}
    )
    if not user_data:
        return None

    target_names  = list(GROUP_ROLE_MAP.keys())
    matched_groups = models.execute_kw(
        ODOO_DB, uid, password,
        "res.groups", "search_read",
        [[["name", "in", target_names], ["users", "in", [uid]]]],
        {"fields": ["name"]},
    )
    if not matched_groups:
        return None

    matched_names = [g["name"] for g in matched_groups]

    for group_name, role in GROUP_ROLE_MAP.items():
        if group_name not in matched_names:
            continue

        employee = models.execute_kw(
            ODOO_DB, uid, password,
            "hr.employee", "search_read",
            [[["user_id", "=", uid]]],
            {"fields": ["department_id", "location"], "limit": 1},
        )

        dept_id = dept_name = location = None
        if employee:
            if employee[0].get("department_id"):
                dept_id   = employee[0]["department_id"][0]
                dept_name = employee[0]["department_id"][1]
            if employee[0].get("location"):
                location  = employee[0]["location"]

        return {
            "role":      role,
            "name":      user_data[0]["name"],
            "uid":       uid,
            "password":  password,
            "dept_id":   dept_id,
            "dept_name": dept_name,
            "location":  location,
        }

    return None
