import xmlrpc.client
import ssl
import json

# SSL bypass
context = ssl._create_unverified_context()

URL = "https://erp.erchmining.mn"
DB = "erchmining"
USERNAME = "moogii5596@gmail.com"
PASSWORD = "123"

def save_model_structure():
    try:
        common = xmlrpc.client.ServerProxy(f'{URL}/xmlrpc/common', context=context)
        uid = common.authenticate(DB, USERNAME, PASSWORD, {})
        models = xmlrpc.client.ServerProxy(f'{URL}/xmlrpc/object', context=context)

        models_to_check = [
            'hr.employee', 
            'meal.order', 
            'hr.employee.meal', 
            'hr_timesheet_sheet.sheet',
        ]

        full_schema = {}

        for model in models_to_check:
            print(f"{model} татаж байна...")
            fields = models.execute_kw(DB, uid, PASSWORD, model, 'fields_get', [], 
                                     {'attributes': ['string', 'type', 'selection', 'relation']})
            full_schema[model] = fields

        # Үр дүнг файл болгож хадгалах
        # Үр дүнг .txt файл болгож хадгалах (NotebookLM-д зориулж)
        with open('odoo_schema.txt', 'w', encoding='utf-8') as f:
            # json.dump-ыг ашиглан файлыг уншигдахуйц текст хэлбэрээр хадгална
            f.write(json.dumps(full_schema, ensure_ascii=False, indent=4))
        
        print("\nАмжилттай! 'odoo_schema.txt' файл үүслээ. Үүнийг NotebookLM-дээ оруулна уу.")

    except Exception as e:
        print(f"Алдаа гарлаа: {e}")

if __name__ == "__main__":
    save_model_structure()