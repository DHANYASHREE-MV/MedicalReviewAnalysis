import os
import json
from pathlib import Path
from datetime import date, datetime

import pandas as pd
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

# Run this script from the project/backend folder containing your .env file.
load_dotenv()

ROOT_FOLDER = Path(r"C:\Users\Admin\Pictures\Aegiscare")
DATABASE_URL = (
    os.getenv("DATABASE_URL")
    or os.getenv("DB_URI")
    or os.getenv("SQLALCHEMY_DATABASE_URL")
)

if not DATABASE_URL:
    raise RuntimeError(
        "Database connection variable not found. Check your project's .env "
        "for DATABASE_URL, DB_URI, or SQLALCHEMY_DATABASE_URL."
    )
if not ROOT_FOLDER.exists():
    raise FileNotFoundError(f"Dataset folder not found: {ROOT_FOLDER}")

engine = create_engine(DATABASE_URL, pool_pre_ping=True)


def clean_value(value):
    if value is None:
        return None
    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass
    if isinstance(value, (pd.Timestamp, datetime, date)):
        return value.isoformat()
    if hasattr(value, "item"):
        value = value.item()
    return value if isinstance(value, (str, int, float, bool)) or value is None else str(value)


def searchable_value(value):
    return "" if value is None else str(value).strip()


# Same existing table; no existing records are deleted or replaced.
with engine.begin() as conn:
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS public.imported_dataset_rows (
            id BIGSERIAL PRIMARY KEY,
            source_path TEXT NOT NULL,
            source_file TEXT NOT NULL,
            city_folder TEXT,
            sheet_name TEXT NOT NULL,
            source_row INTEGER NOT NULL,
            row_data JSONB NOT NULL,
            searchable_text TEXT NOT NULL,
            imported_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE (source_path, sheet_name, source_row)
        );
    """))
    conn.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_imported_dataset_rows_search
        ON public.imported_dataset_rows
        USING GIN (to_tsvector('simple', searchable_text));
    """))

# Recursively scans all Excel files under Aegiscare, including RateMD and city folders.
extensions = {".xlsx", ".xlsm", ".xls"}
excel_files = sorted(
    p for p in ROOT_FOLDER.rglob("*")
    if p.is_file() and p.suffix.lower() in extensions and not p.name.startswith("~$")
)
print(f"Dataset root: {ROOT_FOLDER}")
print(f"Excel files found: {len(excel_files)}")
print("Target table: public.imported_dataset_rows")
print("Existing rows will be preserved; duplicates at the same path/sheet/row are skipped.\n")

files_ok = files_failed = rows_inserted = 0
folder_counts = {}

for file_path in excel_files:
    try:
        read_engine = "xlrd" if file_path.suffix.lower() == ".xls" else "openpyxl"
        sheets = pd.read_excel(file_path, sheet_name=None, dtype=object, engine=read_engine)
        # The immediate parent label will be RateMD for files directly inside RateMD/.
        city_folder = file_path.parent.name if file_path.parent != ROOT_FOLDER else None
        inserted_for_file = 0

        for sheet_name, df in sheets.items():
            if df.empty:
                continue
            df.columns = [str(c).strip() for c in df.columns]
            df = df.dropna(how="all")

            for index, row in df.iterrows():
                data = {
                    str(column): clean_value(value)
                    for column, value in row.items()
                    if str(column).strip()
                }
                searchable_text = " ".join(
                    searchable_value(v) for v in data.values() if searchable_value(v)
                )
                if not searchable_text:
                    continue

                with engine.begin() as conn:
                    result = conn.execute(text("""
                        INSERT INTO public.imported_dataset_rows (
                            source_path, source_file, city_folder, sheet_name,
                            source_row, row_data, searchable_text
                        ) VALUES (
                            :source_path, :source_file, :city_folder, :sheet_name,
                            :source_row, CAST(:row_data AS JSONB), :searchable_text
                        )
                        ON CONFLICT (source_path, sheet_name, source_row) DO NOTHING
                    """), {
                        "source_path": str(file_path.resolve()),
                        "source_file": file_path.name,
                        "city_folder": city_folder,
                        "sheet_name": str(sheet_name),
                        "source_row": int(index) + 2,
                        "row_data": json.dumps(data, ensure_ascii=False),
                        "searchable_text": searchable_text,
                    })
                    inserted_for_file += result.rowcount

        files_ok += 1
        rows_inserted += inserted_for_file
        label = city_folder or "(root)"
        folder_counts[label] = folder_counts.get(label, 0) + inserted_for_file
        print(f"IMPORTED: {file_path.relative_to(ROOT_FOLDER)} ({inserted_for_file} new rows)")
    except Exception as exc:
        files_failed += 1
        print(f"FAILED: {file_path} -> {exc}")

print("\n========== IMPORT SUMMARY ==========")
print(f"Excel files found: {len(excel_files)}")
print(f"Files processed:   {files_ok}")
print(f"Files failed:      {files_failed}")
print(f"New rows inserted: {rows_inserted}")
print("\nNew rows by immediate parent folder:")
for folder, count in sorted(folder_counts.items()):
    print(f"  {folder}: {count}")

with engine.connect() as conn:
    total_rows = conn.execute(text("SELECT COUNT(*) FROM public.imported_dataset_rows")).scalar_one()
    total_paths = conn.execute(text(
        "SELECT COUNT(DISTINCT source_path) FROM public.imported_dataset_rows"
    )).scalar_one()
print(f"\nTotal staged rows now: {total_rows}")
print(f"Distinct source paths now: {total_paths}")
print("Existing records were preserved. Resolve any FAILED lines before deleting source files.")
