import os
os.environ['DATABASE_URL'] = 'sqlite:///./fortcordis.db'
os.environ['SECRET_KEY'] = 'test-secret-key'

from app.main import app
from fastapi.testclient import TestClient
client = TestClient(app)

# Login
resp = client.post('/api/v1/auth/login', data={'username': 'admin@fortcordis.com', 'password': 'admin123'})
token = resp.json()['access_token']
headers = {'Authorization': f'Bearer {token}'}

# Listar todos agendamentos sem filtro
resp = client.get('/api/v1/agenda', headers=headers)
print('Status:', resp.status_code)
print('Total:', resp.json().get('total'))
for item in resp.json().get('items', []):
    print(f'  - {item["paciente"]}: {item["inicio"]} (Status: {item["status"]})')
