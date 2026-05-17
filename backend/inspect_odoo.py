"""
Standalone Odoo model inspector.
Run from backend/ folder:
    python inspect_odoo.py

Outputs:
  - meal.order  state field definition (selection values, readonly flag)
  - meal.order  action_* / state-transition methods
  - meal.order  last-20 real state values
  - meal.order.line  all field names + types
"""
import ssl
import sys
import xmlrpc.client

ODOO_URL      = "https://erp.erchmining.mn"
ODOO_DB       = "erchmining"
ODOO_USERNAME = "moogii5596@gmail.com"
ODOO_PASSWORD = "12345"

ctx = ssl._create_unverified_context()

# ── connect ───────────────────────────────────────────────────────────────────
common = xmlrpc.client.ServerProxy(f"{ODOO_URL}/xmlrpc/common", context=ctx)
uid    = common.authenticate(ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD, {})
if not uid:
    print("AUTH FAILED — check credentials"); sys.exit(1)

models = xmlrpc.client.ServerProxy(f"{ODOO_URL}/xmlrpc/object", context=ctx)
print(f"Authenticated  uid={uid}\n{'='*60}")


# ── 1. state field definition ─────────────────────────────────────────────────
print("\n[1] meal.order — KEY FIELD DEFINITIONS")
fields = models.execute_kw(
    ODOO_DB, uid, ODOO_PASSWORD,
    "meal.order", "fields_get",
    [["state", "type", "order_line", "date", "name", "categ_id"]],
    {"attributes": ["string", "type", "selection", "readonly", "required",
                    "states", "help", "compute", "store"]},
)
for fname, fdef in fields.items():
    print(f"\n  [{fname}]  type={fdef.get('type')}")
    for k, v in fdef.items():
        if k == "type":
            continue
        if v not in (None, False, "", [], {}):
            print(f"    {k}: {v}")


# ── 2. find action / state methods ───────────────────────────────────────────
print(f"\n\n{'='*60}")
print("[2] meal.order — STATE-TRANSITION METHODS")

# Odoo 14+ supports get_method_list; older may not
try:
    all_methods = models.execute_kw(
        ODOO_DB, uid, ODOO_PASSWORD,
        "meal.order", "get_method_list", [], {},
    )
    keywords = ["action", "state", "confirm", "done", "cancel",
                "draft", "approve", "refuse", "validate", "send", "reset"]
    found = [m for m in sorted(all_methods)
             if any(kw in m.lower() for kw in keywords)]
    print(f"  Found {len(found)} relevant methods:")
    for m in found:
        print(f"    {m}")
    print(f"  (total model methods: {len(all_methods)})")
except Exception as exc:
    print(f"  get_method_list unavailable ({exc})")
    print("  Trying known common method names by calling 'help' introspection...")

    # fallback: probe known method names
    probe = [
        "action_confirm", "action_done", "action_cancel", "action_draft",
        "action_refuse", "action_validate", "action_approve",
        "confirm_order", "cancel_order",
        "button_confirm", "button_done", "button_cancel",
    ]
    for method in probe:
        try:
            # call with empty ID list — if method exists it will raise a
            # RecordNotFound rather than AttributeError
            models.execute_kw(
                ODOO_DB, uid, ODOO_PASSWORD,
                "meal.order", method, [[999999999]], {},
            )
            print(f"    ✓ {method}  (exists — call returned without AttributeError)")
        except xmlrpc.client.Fault as f:
            msg = str(f.faultString)
            if "AttributeError" in msg or "object has no attribute" in msg:
                print(f"    ✗ {method}  (does NOT exist)")
            else:
                # method exists but failed for a different reason (e.g. record not found)
                short = msg.split("\n")[0][:120]
                print(f"    ✓ {method}  (exists — error on dummy ID: {short})")
        except Exception as e:
            print(f"    ? {method}  ({e})")


# ── 3. real state values in the database ─────────────────────────────────────
print(f"\n\n{'='*60}")
print("[3] meal.order — ACTUAL STATE VALUES (last 50 orders)")
orders = models.execute_kw(
    ODOO_DB, uid, ODOO_PASSWORD,
    "meal.order", "search_read",
    [[]],
    {"fields": ["id", "name", "state", "date", "type"],
     "order": "id desc", "limit": 50},
)
if not orders:
    print("  No orders found in Odoo.")
else:
    counts: dict = {}
    for o in orders:
        s = str(o.get("state"))
        counts[s] = counts.get(s, 0) + 1
    print(f"  State distribution across last {len(orders)} orders:")
    for s, n in sorted(counts.items()):
        print(f"    '{s}': {n}")
    print("\n  First 5 rows:")
    for o in orders[:5]:
        print(f"    id={o['id']:>6}  state={str(o.get('state')):>12}  "
              f"date={o.get('date')}  type={o.get('type')}  name={o.get('name')}")


# ── 4. meal.order.line fields ─────────────────────────────────────────────────
print(f"\n\n{'='*60}")
print("[4] meal.order.line — ALL FIELDS")
lf = models.execute_kw(
    ODOO_DB, uid, ODOO_PASSWORD,
    "meal.order.line", "fields_get",
    [[]],
    {"attributes": ["string", "type", "selection", "relation"]},
)
for fname, fdef in sorted(lf.items()):
    sel = f"  selection={fdef['selection']}" if fdef.get("selection") else ""
    rel = f"  → {fdef['relation']}"           if fdef.get("relation") else ""
    print(f"  [{fname}]  {fdef.get('type'):12}  '{fdef.get('string')}'{sel}{rel}")


# ── 5. meal.order — ALL fields overview ──────────────────────────────────────
print(f"\n\n{'='*60}")
print("[5] meal.order — ALL FIELDS OVERVIEW")
all_fields = models.execute_kw(
    ODOO_DB, uid, ODOO_PASSWORD,
    "meal.order", "fields_get",
    [[]],
    {"attributes": ["string", "type", "selection", "relation"]},
)
for fname, fdef in sorted(all_fields.items()):
    sel = f"  selection={fdef['selection']}" if fdef.get("selection") else ""
    rel = f"  → {fdef['relation']}"           if fdef.get("relation") else ""
    print(f"  [{fname}]  {fdef.get('type'):12}  '{fdef.get('string')}'{sel}{rel}")

print(f"\n{'='*60}")
print("Inspection complete.")
