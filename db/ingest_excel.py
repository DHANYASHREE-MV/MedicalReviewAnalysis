import os
import pandas as pd

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()

DB_URI = os.getenv("DB_URI")

if not DB_URI:
    raise ValueError("DB_URI not found in .env")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

EXCEL_PATH = os.path.join(
    BASE_DIR,
    "data",
    "bangalore_dermatologist_practo_data.xlsx"
)

print("=" * 60)
print("AEGISCARE - EXCEL INGESTION")
print("=" * 60)

print(f"\nReading Excel:")
print(EXCEL_PATH)

df = pd.read_excel(EXCEL_PATH)

print(f"\nRaw rows found: {len(df)}")

# ---------------------------------------------------------
# CLEAN COLUMN NAMES
# ---------------------------------------------------------

df.columns = (
    df.columns
    .str.strip()
    .str.lower()
    .str.replace(" ", "_")
    .str.replace("/", "_")
)

print("\nColumns:")
print(df.columns.tolist())

# ---------------------------------------------------------
# FORWARD-FILL DOCTOR INFORMATION
# ---------------------------------------------------------

doctor_columns = [
    "doctor_name",
    "specialty",
    "experience",
    "clinic__hospital",
    "locality",
    "consultation_fee",
    "overall_rating",
    "total_feedback",
    "city"
]

for col in doctor_columns:
    if col in df.columns:
        df[col] = df[col].ffill()

# ---------------------------------------------------------
# REMOVE EMPTY / NON-REVIEW ROWS
# ---------------------------------------------------------

df = df.dropna(
    subset=["review_text"]
)

df["review_text"] = df["review_text"].astype(str).str.strip()

# Remove "No reviews available"
df = df[
    df["review_text"].str.lower() != "no reviews available"
]

# Remove empty strings
df = df[
    df["review_text"] != ""
]

# ---------------------------------------------------------
# CREATE REVIEW ID
# ---------------------------------------------------------

df.insert(
    0,
    "review_id",
    range(1, len(df) + 1)
)

print(f"\nActual reviews after cleaning: {len(df)}")

# ---------------------------------------------------------
# POSTGRES CONNECTION
# ---------------------------------------------------------

engine = create_engine(DB_URI)

print("\nWriting reviews to PostgreSQL...")

df.to_sql(
    "reviews",
    engine,
    if_exists="replace",
    index=False
)

# ---------------------------------------------------------
# VERIFY
# ---------------------------------------------------------

with engine.connect() as conn:

    count = conn.execute(
        text("SELECT COUNT(*) FROM reviews")
    ).scalar()

    print(f"\nRows inserted into PostgreSQL: {count}")

    print("\nFirst 5 reviews:")

    result = conn.execute(
        text("""
            SELECT
                review_id,
                doctor_name,
                specialty,
                overall_rating,
                review_text
            FROM reviews
            LIMIT 5
        """)
    )

    for row in result:
        print(row)

print("\n" + "=" * 60)
print("Excel → PostgreSQL completed successfully!")
print("=" * 60)