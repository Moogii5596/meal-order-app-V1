import xmlrpc.client
import ssl
import os
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

context = ssl._create_unverified_context()

URL = os.getenv("ODOO_URL")
DB = os.getenv("ODOO_DB")
USERNAME = os.getenv("ODOO_USERNAME")
PASSWORD = os.getenv("ODOO_PASSWORD")

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


# Хэрэглэгчийг Odoo-д нэвтрүүлж дүрийг access group-аар тодорхойлно
GROUP_ROLE_MAP = {
    'Кемп менежер': 'camp_manager',
    'Хоолны захиалга хянагч ТН': 'category_manager',
    'Хоолны захиалга хянагч': 'kitchen_staff',
}

def authenticate_user(username, password):
    common = xmlrpc.client.ServerProxy(f'{URL}/xmlrpc/common', context=context)
    uid = common.authenticate(DB, username, password, {})

    if not uid:
        return None

    models = xmlrpc.client.ServerProxy(f'{URL}/xmlrpc/object', context=context)

    # Хэрэглэгчийн нэр авах
    user_data = models.execute_kw(DB, uid, password,
        'res.users', 'read', [[uid]], {'fields': ['name']})

    if not user_data:
        return None

    # Зөвхөн target group-уудыг нэрээр хайх (бүх group биш)
    target_names = list(GROUP_ROLE_MAP.keys())
    matched = models.execute_kw(DB, uid, password,
        'res.groups', 'search_read',
        [[['name', 'in', target_names], ['users', 'in', [uid]]]],
        {'fields': ['name']})

    if not matched:
        return None

    matched_names = [g['name'] for g in matched]

    for group_name, role in GROUP_ROLE_MAP.items():
        if group_name in matched_names:
            # Хэрэглэгчийн хэлтсийг олох
            employee = models.execute_kw(DB, uid, password,
                'hr.employee', 'search_read',
                [[['user_id', '=', uid]]],
                {'fields': ['department_id'], 'limit': 1})
            dept_id = None
            dept_name = None
            if employee and employee[0].get('department_id'):
                dept_id = employee[0]['department_id'][0]
                dept_name = employee[0]['department_id'][1]
            return {
                'role': role,
                'name': user_data[0]['name'],
                'uid': uid,
                'password': password,
                'dept_id': dept_id,
                'dept_name': dept_name
            }

    return None


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
        {'fields': ['id', 'name', 'last_name', 'job_id', 'location']}
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
# Get orders
# -------------------------
def get_orders(state=None):
    uid, models = get_odoo_connection()
    yesterday = (datetime.today() - timedelta(days=1)).strftime('%Y-%m-%d')
    domain = [['date', '>=', yesterday]]
    if state:
        domain.append(['state', '=', state])
    orders = models.execute_kw(
        DB, uid, PASSWORD,
        'meal.order', 'search_read',
        [domain],
        {'fields': ['id', 'date', 'type', 'state', 'order_line']}
    )
    return orders


def get_order_detail(order_id):
    uid, models = get_odoo_connection()
    order = models.execute_kw(
        DB, uid, PASSWORD,
        'meal.order', 'read', [[order_id]],
        {'fields': ['id', 'date', 'type', 'state', 'order_line']}
    )
    if not order:
        return None
    line_ids = order[0]['order_line']
    employees = []
    if line_ids:
        lines = models.execute_kw(
            DB, uid, PASSWORD,
            'meal.order.line', 'read', [line_ids],
            {'fields': ['employee_id']}
        )
        employees = [
            {'id': l['employee_id'][0], 'name': l['employee_id'][1]}
            for l in lines if l['employee_id']
        ]
    return {**order[0], 'employees': employees}


def update_order_state(order_id, new_state):
    uid, models = get_odoo_connection()
    models.execute_kw(
        DB, uid, PASSWORD,
        'meal.order', 'write',
        [[order_id], {'state': new_state}]
    )


# -------------------------
# Create order
# -------------------------
def search_employees_global(query):
    uid, models = get_odoo_connection()
    domain = [['name', 'ilike', query]]
    employees = models.execute_kw(
        DB, uid, PASSWORD,
        'hr.employee', 'search_read',
        [domain],
        {'fields': ['id', 'name', 'last_name', 'job_id', 'department_id', 'location'], 'limit': 20}
    )
    for emp in employees:
        emp['is_swiped'] = False
        emp['job_title'] = emp['job_id'][1] if emp['job_id'] else 'Тодорхойгүй'
        emp['dept_name'] = emp['department_id'][1] if emp['department_id'] else 'Тодорхойгүй'
    return employees


def create_meal_order(date, meal_type, employee_ids):
    uid, models = get_odoo_connection()

    order_lines = [(0, 0, {'employee_id': emp_id}) for emp_id in employee_ids]

    order_data = {
        'date': date,
        'type': meal_type,
        'state': 'draft',
        'order_line': order_lines
    }

    return models.execute_kw(DB, uid, PASSWORD, 'meal.order', 'create', [order_data])


def get_rental_employees(query=''):
    uid, models = get_odoo_connection()
    domain = [['department_id.name', 'ilike', 'түрээс']]
    if query:
        domain.append(['name', 'ilike', query])
    employees = models.execute_kw(
        DB, uid, PASSWORD,
        'hr.employee', 'search_read',
        [domain],
        {'fields': ['id', 'name', 'last_name', 'job_id', 'department_id', 'location'], 'limit': 200}
    )
    for emp in employees:
        emp['is_swiped'] = False
        emp['job_title'] = emp['job_id'][1] if emp['job_id'] else 'Тодорхойгүй'
        emp['dept_name'] = emp['department_id'][1] if emp['department_id'] else 'Тодорхойгүй'
    return employees


def create_meal_order_as_user(date, meal_type, employee_ids, user_uid, user_password):
    models = xmlrpc.client.ServerProxy(f'{URL}/xmlrpc/object', context=context)

    order_lines = [(0, 0, {'employee_id': emp_id}) for emp_id in employee_ids]

    order_data = {
        'date': date,
        'type': meal_type,
        'state': 'draft',
        'order_line': order_lines
    }

    return models.execute_kw(DB, user_uid, user_password, 'meal.order', 'create', [order_data])