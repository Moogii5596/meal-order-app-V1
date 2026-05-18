import ssl
import sys
import xmlrpc.client

# =========================================================
# ODOO CONFIG
# =========================================================
ODOO_URL = "https://erp.erchmining.mn"
ODOO_DB = "erchmining"
ODOO_USERNAME = "moogii5596@gmail.com"
ODOO_PASSWORD = "12345"

# =========================================================
# SSL FIX
# =========================================================
ctx = ssl._create_unverified_context()

# =========================================================
# CONNECT
# =========================================================
common = xmlrpc.client.ServerProxy(
    f"{ODOO_URL}/xmlrpc/common",
    context=ctx
)

uid = common.authenticate(
    ODOO_DB,
    ODOO_USERNAME,
    ODOO_PASSWORD,
    {}
)

if not uid:
    print("AUTH FAILED")
    sys.exit(1)

print(f"Authenticated UID = {uid}")

models = xmlrpc.client.ServerProxy(
    f"{ODOO_URL}/xmlrpc/object",
    context=ctx
)

print("=" * 60)

# =========================================================
# HR.EMPLOYEE FIELDS (MONGOLIAN)
# =========================================================
print("\n[hr.employee.status FIELD LIST]\n")

fields = models.execute_kw(
    ODOO_DB,
    uid,
    ODOO_PASSWORD,
    "hr.employee.status",
    "fields_get",
    [[]],
    {
        "attributes": [
            "string",
            "type",
            "relation",
            "selection"
        ],
        "context": {
            "lang": "mn_MN"
        }
    }
)

for fname, fdef in sorted(fields.items()):

    field_type = fdef.get("type")
    field_string = fdef.get("string")

    relation = ""
    if fdef.get("relation"):
        relation = f" -> {fdef.get('relation')}"

    selection = ""
    if fdef.get("selection"):
        selection = f" | selection={fdef.get('selection')}"

    print(
        f"[{fname}] "
        f"{field_type} "
        f"=> {field_string}"
        f"{relation}"
        f"{selection}"
    )

print("\n" + "=" * 60)

# =========================================================
# SAMPLE EMPLOYEES
# =========================================================
print("\n[SAMPLE EMPLOYEES]\n")

employees = models.execute_kw(
    ODOO_DB,
    uid,
    ODOO_PASSWORD,
    "hr.employee.status",
    "search_read",
    [[]],
    {
        "limit": 5,
        "context": {
            "lang": "mn_MN"
        }
    }
)
print("\n[EMPLOYEE STATUS LIST]\n")

statuses = models.execute_kw(
    ODOO_DB,
    uid,
    ODOO_PASSWORD,
    "hr.employee.status",
    "search_read",
    [[]],
    {
        "context": {
            "lang": "mn_MN"
        }
    }
)

for status in statuses:
    print(status)

for emp in employees:

    print("\n" + "-" * 40)

    for key, value in emp.items():

        mongol_name = fields.get(
            key,
            {}
        ).get(
            "string",
            key
        )

        print(f"{mongol_name}: {value}")

print("\n" + "=" * 60)
print("DONE")