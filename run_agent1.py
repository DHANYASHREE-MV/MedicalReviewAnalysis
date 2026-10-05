import os

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

from graph import graph


load_dotenv()

DB_URI = os.getenv("DB_URI")

if not DB_URI:
    raise ValueError("DB_URI not found in .env")


engine = create_engine(DB_URI)


# =========================================================
# CREATE AGENT 1 OUTPUT TABLE
# =========================================================

with engine.begin() as conn:

    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS review_triage (
            review_id INTEGER PRIMARY KEY,
            sentiment VARCHAR(20),
            severity INTEGER,
            category VARCHAR(50),
            summary TEXT,
            route VARCHAR(30),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """))


# =========================================================
# GET ALL REVIEWS
# =========================================================

with engine.connect() as conn:

    result = conn.execute(text("""
        SELECT
            review_id,
            doctor_name,
            specialty,
            overall_rating,
            review_text
        FROM reviews
        ORDER BY review_id
    """))

    reviews = result.fetchall()


print("=" * 60)
print("AEGISCARE - AGENT 1")
print("=" * 60)

print(f"\nReviews found: {len(reviews)}")


# =========================================================
# PROCESS EVERY REVIEW
# =========================================================

successful = 0
failed = 0


for index, row in enumerate(reviews, start=1):

    review_id = row.review_id
    doctor_name = row.doctor_name or "Unknown"
    specialty = row.specialty or "Unknown"
    overall_rating = row.overall_rating
    review_text = row.review_text

    print(
        f"\n[{index}/{len(reviews)}] "
        f"Processing Review {review_id}"
    )

    try:

        result = graph.invoke({
            "review_id": review_id,
            "doctor_name": doctor_name,
            "specialty": specialty,
            "overall_rating": overall_rating,
            "review": review_text
        })

        # -------------------------------------------------
        # SAVE AGENT 1 OUTPUT
        # -------------------------------------------------

        with engine.begin() as conn:

            conn.execute(
                text("""
                    INSERT INTO review_triage (
                        review_id,
                        sentiment,
                        severity,
                        category,
                        summary,
                        route
                    )
                    VALUES (
                        :review_id,
                        :sentiment,
                        :severity,
                        :category,
                        :summary,
                        :route
                    )
                    ON CONFLICT (review_id)
                    DO UPDATE SET
                        sentiment = EXCLUDED.sentiment,
                        severity = EXCLUDED.severity,
                        category = EXCLUDED.category,
                        summary = EXCLUDED.summary,
                        route = EXCLUDED.route
                """),
                {
                    "review_id": review_id,
                    "sentiment": result["sentiment"],
                    "severity": result["severity"],
                    "category": result["category"],
                    "summary": result["summary"],
                    "route": result["route"]
                }
            )

        successful += 1

        print(f"  Sentiment : {result['sentiment']}")
        print(f"  Severity  : {result['severity']}")
        print(f"  Category  : {result['category']}")
        print(f"  Route     : {result['route']}")

    except Exception as e:

        failed += 1

        print(
            f"  ERROR processing Review {review_id}: {e}"
        )


# =========================================================
# FINAL RESULTS
# =========================================================

with engine.connect() as conn:

    total_saved = conn.execute(
        text("SELECT COUNT(*) FROM review_triage")
    ).scalar()

    investigation_count = conn.execute(
        text("""
            SELECT COUNT(*)
            FROM review_triage
            WHERE route = 'investigation'
        """)
    ).scalar()

    archive_count = conn.execute(
        text("""
            SELECT COUNT(*)
            FROM review_triage
            WHERE route = 'archive'
        """)
    ).scalar()


print("\n" + "=" * 60)
print("AGENT 1 COMPLETE")
print("=" * 60)

print(f"\nSuccessfully processed : {successful}")
print(f"Failed                 : {failed}")
print(f"Saved to review_triage : {total_saved}")

print(f"\nInvestigation : {investigation_count}")
print(f"Archive       : {archive_count}")

print("=" * 60)