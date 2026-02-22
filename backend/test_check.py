import os
os.environ['DATABASE_URL'] = 'sqlite:///./fortcordis.db'
os.environ['SECRET_KEY'] = 'test-secret-key'

from app.main import app
from fastapi.testclient import TestClient
client = TestClient(app)

# Login
resp = client.post('/api/v1/auth/login', data={'username': 'admin@fortcordis.com', 'password': 'admin123'})
print('Login:', resp.status_code)
if resp.status_code != 200:
    print('Erro login:', resp.text)
    exit()

token = resp.json()['access_token']
headers = {'Authorization': f'Bearer {token}'}

# Testar agenda de hoje
from datetime import datetime
hoje = datetime.now().strftime('%Y-%m-%d')
url = f'/api/v1/agenda?data_inicio={hoje}T00:00:00&data_fim={hoje}T23:59:59'
print(f'Testando: {url}')
resp = client.get(url, headers=headers)
print('Status:', resp.status_code)
if resp.status_code == 200:
    data = resp.json()
    print('Total:', data.get('total'))
    for item in data.get('items', []):
        print(f"  - {item['paciente']}: {item['inicio']}")
else:
    print('Erro:', resp.text)
