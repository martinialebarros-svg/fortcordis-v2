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

# Testar filtro por data de hoje (17/02/2026)
url = '/api/v1/agenda?data_inicio=2026-02-17T00:00:00&data_fim=2026-02-17T23:59:59'
print('Testando URL:', url)
resp = client.get(url, headers=headers)
print('Status:', resp.status_code)
print('Total:', resp.json().get('total'))
for item in resp.json().get('items', []):
    print(f'  - {item["paciente"]}: {item["inicio"]}')
