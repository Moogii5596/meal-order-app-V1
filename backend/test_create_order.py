import xmlrpc.client
import ssl
from datetime import datetime

# SSL сертификат шалгах хэсгийг алгасах
context = ssl._create_unverified_context()

# Холболтын мэдээлэл
URL = "https://erp.erchmining.mn"
DB = "erchmining"
USERNAME = "moogii5596@gmail.com"
PASSWORD = "123"

def create_test_order():
    try:
        common = xmlrpc.client.ServerProxy(f'{URL}/xmlrpc/common', context=context)
        uid = common.authenticate(DB, USERNAME, PASSWORD, {})
        models = xmlrpc.client.ServerProxy(f'{URL}/xmlrpc/object', context=context)

        # ТЕСТ ДАТА: 
        # 1. Өмнө нь татсан ажилчдын жагсаалтаас нэг бодит ID ашиглана уу (Жишээ нь: 1234)
        # 2. Хэрэв ID-гаа мэдэхгүй бол эхлээд ажилтан хайж ID-г нь авна
        emp_id = 3113  # <--- ЭНД ӨӨРИЙН СИСТЕМД БАЙГАА БОДИТ АЖИЛТНЫ ID-Г БИЧНЭ ҮҮ

        # Захиалгын мэдээлэл (Толгой хэсэг)
        order_data = {
            'date': datetime.now().strftime('%Y-%m-%d'),
            'type': 'lunch',
            'state': 'draft',
            'employee_id': emp_id,  # <--- Энэ мөрийг нэмж бичээд үзээрэй
            'order_line': [
                (0, 0, {
                    'employee_id': emp_id,
                    'qty': 1,
                    'type': 'uh'
                })
            ]
        }

        # Odoo-д бичилт хийх (Create)
        new_order_id = models.execute_kw(DB, uid, PASSWORD, 'meal.order', 'create', [order_data])
        
        print(f"Амжилттай! Шинэ захиалга үүслээ. ID: {new_order_id}")
        return new_order_id

    except Exception as e:
        print(f"Захиалга үүсгэхэд алдаа гарлаа: {e}")

if __name__ == "__main__":
    create_test_order()