import os
from collections import Counter

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

from nodes.analyst import run_agent2


load_dotenv()

DB_URI = os.getenv("DB_URI")

if not DB_URI:
    raise ValueError("DB_URI not found in .env")

engine = create_engine(DB_URI)


# =========================================================
# CREATE AGENT 2 OUTPUT TABLE
# =========================================================

with engine.begin() as conn:

    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS analysis (
            review_id INTEGER PRIMARY KEY,

            root_cause TEXT,
            evidence TEXT,
            department VARCHAR(100),
            lead VARCHAR(100),
            confidence FLOAT,

            metrics TEXT,

            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """))


# =========================================================
# GET INVESTIGATION REVIEWS
# =========================================================

with engine.connect() as conn:

    result = conn.execute(text("""
        SELECT
            r.review_id,
            r.doctor_name,
            r.specialty,
            r.clinic___hospital,
            r.overall_rating,
            r.review_text,

            t.sentiment,
            t.severity,
            t.category,
            t.summary

        FROM reviews r

        JOIN review_triage t
            ON r.review_id = t.review_id

        WHERE t.route = 'investigation'

        ORDER BY r.review_id
    """))

    investigations = result.fetchall()


print("=" * 65)
print("AEGISCARE - AGENT 2")
print("=" * 65)

print(f"\nInvestigation reviews found: {len(investigations)}")


# =========================================================
# PROCESS EACH INVESTIGATION
# =========================================================

successful = 0
failed = 0


for index, row in enumerate(
    investigations,
    start=1
):

    print(
        f"\n[{index}/{len(investigations)}] "
        f"Processing Review {row.review_id}"
    )

    try:

        # -------------------------------------------------
        # GET DOCTOR-LEVEL METRICS
        # -------------------------------------------------

        with engine.connect() as conn:

            doctor_stats = conn.execute(
                text("""
                    SELECT
                        COUNT(*) AS investigation_count,

                        AVG(t.severity) AS avg_severity,

                        COUNT(*) FILTER (
                            WHERE t.sentiment = 'negative'
                        ) AS negative_count,

                        COUNT(*) FILTER (
                            WHERE t.category = 'wait_time'
                        ) AS wait_time_count,

                        COUNT(*) FILTER (
                            WHERE t.category = 'staff_behavior'
                        ) AS staff_behavior_count,

                        COUNT(*) FILTER (
                            WHERE t.category = 'doctor_communication'
                        ) AS doctor_communication_count,

                        COUNT(*) FILTER (
                            WHERE t.category = 'treatment_outcome'
                        ) AS treatment_outcome_count,

                        COUNT(*) FILTER (
                            WHERE t.category = 'billing_cost'
                        ) AS billing_count,

                        COUNT(*) FILTER (
                            WHERE t.category = 'cleanliness_facility'
                        ) AS cleanliness_count,

                        COUNT(*) FILTER (
                            WHERE t.category = 'appointment_process'
                        ) AS appointment_count,

                        COUNT(*) FILTER (
                            WHERE t.category = 'service_quality'
                        ) AS service_quality_count

                    FROM reviews r

                    JOIN review_triage t
                        ON r.review_id = t.review_id

                    WHERE t.route = 'investigation'
                    AND r.doctor_name = :doctor_name
                """),
                {
                    "doctor_name": row.doctor_name
                }
            ).mappings().first()


        # -------------------------------------------------
        # FORMAT METRICS
        # -------------------------------------------------

        metrics = f"""
Doctor investigation count:
{doctor_stats['investigation_count']}

Average severity:
{round(float(doctor_stats['avg_severity'] or 0), 2)}

Negative review count:
{doctor_stats['negative_count']}

Wait-time complaints:
{doctor_stats['wait_time_count']}

Staff-behavior complaints:
{doctor_stats['staff_behavior_count']}

Doctor-communication complaints:
{doctor_stats['doctor_communication_count']}

Treatment-outcome complaints:
{doctor_stats['treatment_outcome_count']}

Billing complaints:
{doctor_stats['billing_count']}

Cleanliness/facility complaints:
{doctor_stats['cleanliness_count']}

Appointment complaints:
{doctor_stats['appointment_count']}

Service-quality complaints:
{doctor_stats['service_quality_count']}
""".strip()


        # -------------------------------------------------
        # RUN AGENT 2
        # -------------------------------------------------

        result = run_agent2(

            review=row.review_text,

            doctor_name=row.doctor_name or "Unknown",

            specialty=row.specialty or "Unknown",

            clinic=row.clinic___hospital or "Unknown",

            overall_rating=row.overall_rating,

            sentiment=row.sentiment,

            severity=row.severity,

            category=row.category,

            summary=row.summary,

            metrics=metrics
        )


        # -------------------------------------------------
        # SAVE RESULT
        # -------------------------------------------------

        with engine.begin() as conn:

            conn.execute(
                text("""
                    INSERT INTO analysis (
                        review_id,
                        root_cause,
                        evidence,
                        department,
                        lead,
                        confidence,
                        metrics
                    )

                    VALUES (
                        :review_id,
                        :root_cause,
                        :evidence,
                        :department,
                        :lead,
                        :confidence,
                        :metrics
                    )

                    ON CONFLICT (review_id)

                    DO UPDATE SET
                        root_cause = EXCLUDED.root_cause,
                        evidence = EXCLUDED.evidence,
                        department = EXCLUDED.department,
                        lead = EXCLUDED.lead,
                        confidence = EXCLUDED.confidence,
                        metrics = EXCLUDED.metrics
                """),

                {
                    "review_id": row.review_id,
                    "root_cause": result.root_cause,
                    "evidence": result.evidence,
                    "department": result.department,
                    "lead": result.lead,
                    "confidence": result.confidence,
                    "metrics": result.metrics
                }
            )


        successful += 1


        # -------------------------------------------------
        # PRINT RESULT
        # -------------------------------------------------

        print(f"  Root Cause : {result.root_cause}")
        print(f"  Department : {result.department}")
        print(f"  Lead       : {result.lead}")
        print(f"  Confidence : {result.confidence}")
        print(f"  Metrics    : {result.metrics}")


    except Exception as e:

        failed += 1

        print(
            f"  ERROR: {e}"
        )


# =========================================================
# FINAL SUMMARY
# =========================================================

with engine.connect() as conn:

    saved = conn.execute(
        text("SELECT COUNT(*) FROM analysis")
    ).scalar()


print("\n" + "=" * 65)
print("AGENT 2 COMPLETE")
print("=" * 65)

print(f"\nInvestigation reviews : {len(investigations)}")
print(f"Successfully analyzed : {successful}")
print(f"Failed                : {failed}")
print(f"Saved in analysis     : {saved}")

print("=" * 65)