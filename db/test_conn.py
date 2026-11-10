import os

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()

DB_URI = os.getenv("DB_URI")

if not DB_URI:
    raise ValueError("DB_URI not found in .env")

engine = create_engine(DB_URI)

try:
    with engine.connect() as conn:
        result = conn.execute(text("SELECT 1"))
        print("✅ PostgreSQL connection successful!")
        print("Test result:", result.scalar())

except Exception as e:
    print("❌ PostgreSQL connection failed!")
    print(e)