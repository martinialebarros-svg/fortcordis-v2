import os
os.environ['DATABASE_URL'] = 'sqlite:///./fortcordis.db'
os.environ['SECRET_KEY'] = 'test-secret-key'

from app.main import app
import uvicorn

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001, log_level="info")
