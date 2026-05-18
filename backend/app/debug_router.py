"""
Temporary debug router — exposes Odoo model introspection at GET /debug/meal-order
Remove this file (and the include_router call in main.py) after investigation.
"""
import ssl
import xmlrpc.client
from fastapi import APIRouter

from app.config import ODOO_DB, ODOO_PASSWORD, ODOO_URL, ODOO_USERNAME

router = APIRouter(prefix="/debug", tags=["debug"])

_ctx = ssl._create_unverified_context()  # noqa: SLF001


def _connect():
    common = xmlrpc.client.ServerProxy(f"{ODOO_URL}/xmlrpc/common", context=_ctx)
    uid    = common.authenticate(ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD, {})
    models = xmlrpc.client.ServerProxy(f"{ODOO_URL}/xmlrpc/object", context=_ctx)
    return uid, models


@router.get("/meal-order")
def inspect_meal_order():
    uid, models = _connect()

    # ── 1. Key field definitions ──────────────────────────────────────────────
    key_fields = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        "meal.order", "fields_get",
        [[]],
        {"attributes": ["string", "type", "selection", "readonly",
                         "required", "states", "compute", "store"]},
    )

    # ── 2. Probe known state-transition method names ──────────────────────────
    probe_methods = [
        "action_confirm", "action_done", "action_cancel", "action_draft",
        "action_refuse", "action_validate", "action_approve",
        "confirm_order",  "cancel_order",
        "button_confirm", "button_done",  "button_cancel",
        "write",          "unlink",
    ]
    method_results = {}
    for method in probe_methods:
        try:
            models.execute_kw(
                ODOO_DB, uid, ODOO_PASSWORD,
                "meal.order", method, [[999_999_999]], {},
            )
            method_results[method] = "EXISTS (returned without AttributeError)"
        except xmlrpc.client.Fault as f:
            msg = f.faultString
            if "AttributeError" in msg or "has no attribute" in msg:
                method_results[method] = "NOT FOUND"
            else:
                # exists but failed on a dummy record ID — that's fine
                first_line = msg.split("\n")[0][:200]
                method_results[method] = f"EXISTS — error on dummy id: {first_line}"
        except Exception as e:
            method_results[method] = f"ERROR: {e}"

    # ── 3. get_method_list (Odoo 14+) ────────────────────────────────────────
    all_methods_raw = []
    try:
        all_methods_raw = models.execute_kw(
            ODOO_DB, uid, ODOO_PASSWORD,
            "meal.order", "get_method_list", [], {},
        )
    except Exception:
        pass
    keywords = ["action", "state", "confirm", "done", "cancel",
                "draft", "approve", "refuse", "validate"]
    state_methods = [m for m in sorted(all_methods_raw)
                     if any(kw in m.lower() for kw in keywords)]

    # ── 4. Real orders — actual state values ─────────────────────────────────
    orders = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        "meal.order", "search_read",
        [[]],
        {"fields": ["id", "name", "state", "date", "type"],
         "order": "id desc", "limit": 50},
    )
    state_counts: dict = {}
    for o in orders:
        s = str(o.get("state"))
        state_counts[s] = state_counts.get(s, 0) + 1

    # ── 5. meal.order.line fields ─────────────────────────────────────────────
    line_fields = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        "meal.order.line", "fields_get",
        [[]],
        {"attributes": ["string", "type", "selection", "relation"]},
    )

    return {
        "auth_uid": uid,

        "meal_order_fields": {
            fname: {k: v for k, v in fdef.items() if v not in (None, False, "", [], {})}
            for fname, fdef in sorted(key_fields.items())
        },

        "state_field_detail": key_fields.get("state", {}),

        "method_probe": method_results,

        "state_methods_from_get_method_list": state_methods,
        "get_method_list_total": len(all_methods_raw),

        "real_state_distribution": state_counts,
        "sample_orders": [
            {"id": o["id"], "name": o.get("name"), "state": o.get("state"),
             "date": o.get("date"), "type": o.get("type")}
            for o in orders[:10]
        ],

        "meal_order_line_fields": {
            fname: {k: v for k, v in fdef.items() if v not in (None, False, "", [], {})}
            for fname, fdef in sorted(line_fields.items())
        },
    }
