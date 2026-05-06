import xmlrpc.client
import ssl

# SSL bypass (internal network)
context = ssl._create_unverified_context()

URL = "https://erp.erchmining.mn"
DB = "erchmining"
USERNAME = "moogii5596@gmail.com"
PASSWORD = "123"

# Cache (performance сайжруулалт)
_uid = None
_models = None

def get_odoo_connection():
    global _uid, _models

    if _uid and _models:
        return _uid, _models

    common = xmlrpc.client.ServerProxy(f'{URL}/xmlrpc/common', context=context)
    _uid = common.authenticate(DB, USERNAME, PASSWORD, {})
    _models = xmlrpc.client.ServerProxy(f'{URL}/xmlrpc/object', context=context)

    return _uid, _models


# -------------------------
# Departments
# -------------------------
def get_departments():
    uid, models = get_odoo_connection()
    return models.execute_kw(
        DB, uid, PASSWORD,
        'hr.department', 'search_read',
        [[]],
        {'fields': ['id', 'name']}
    )


# -------------------------
# Employees + swipe check
# -------------------------
def get_employees_by_department(dept_id, date, meal_type):
    uid, models = get_odoo_connection()

    # 1. Employees
    emp_domain = [('department_id', '=', int(dept_id))]
    employees = models.execute_kw(
        DB, uid, PASSWORD,
        'hr.employee', 'search_read',
        [emp_domain],
        {'fields': ['id', 'name', 'last_name', 'job_id']}
    )

    # 2. Swiped meals
    meal_domain = [
        ('date', '=', date),
        ('meal_type', '=', meal_type)
    ]

    swiped_meals = models.execute_kw(
        DB, uid, PASSWORD,
        'hr.employee.meal', 'search_read',
        [meal_domain],
        {'fields': ['employee_id']}
    )

    # зөвхөн ID авах
    swiped_ids = [
        m['employee_id'][0]
        for m in swiped_meals
        if m['employee_id']
    ]

    # 3. нэмэлт field
    for emp in employees:
        emp['is_swiped'] = emp['id'] in swiped_ids
        emp['job_title'] = emp['job_id'][1] if emp['job_id'] else "Тодорхойгүй"

    return employees


# -------------------------
# Create order
# -------------------------
def create_meal_order(date, meal_type, employee_ids):
    uid, models = get_odoo_connection()

    order_lines = []
    for emp_id in employee_ids:
        order_lines.append((0, 0, {
            'employee_id': emp_id
        }))

    order_data = {
        'date': date,
        'type': meal_type,
        'state': 'draft',
        'order_line': order_lines
    }

    order_id = models.execute_kw(
        DB, uid, PASSWORD,
        'meal.order', 'create',
        [order_data]
    )

    return order_id