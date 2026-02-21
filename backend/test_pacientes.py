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

# Listar pacientes
resp = client.get('/api/v1/pacientes', headers=headers)
print('Status:', resp.status_code)
for item in resp.json().get('items', []):
    print(f"  - {item['nome']}: Tutor={item['tutor']}")
