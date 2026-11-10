import os

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

from nodes.action_planner import run_agent3


load_dotenv()

DB_URI = os.getenv("DB_URI")

if not DB_URI:
    raise ValueError("DB_URI not found in .env")

engine = create_engine(DB_URI)


# ============================================================
# CREATE ACTION PLANS TABLE
# ============================================================

with engine.begin() as conn:

    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS action_plans (
            review_id INTEGER PRIMARY KEY,

            priority VARCHAR(20),

            objective TEXT,

            immediate_actions TEXT,

            corrective_actions TEXT,

            preventive_actions TEXT,

            owner_role VARCHAR(100),

            timeline VARCHAR(100),

            success_metrics TEXT,
            confidence DOUBLE PRECISION,

            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """))
    conn.execute(text("ALTER TABLE action_plans ADD COLUMN IF NOT EXISTS confidence DOUBLE PRECISION"))


# ============================================================
# GET AGENT 2 RESULTS
# ============================================================

with engine.connect() as conn:

    result = conn.execute(text("""
       SELECT
    a.review_id,
    r.doctor_name,
    r.specialty,
    r.clinic___hospital,
    a.root_cause,
    a.evidence,
    a.department,
    a.lead,
    a.confidence,
    a.metrics
FROM analysis a
JOIN reviews r
    ON a.review_id = r.review_id
LEFT JOIN action_plans p
    ON a.review_id = p.review_id
WHERE p.review_id IS NULL
ORDER BY a.review_id
    """))

    analyses = result.fetchall()


print("=" * 70)
print("AEGISCARE - AGENT 3")
print("=" * 70)

print(f"\nAnalysis cases found: {len(analyses)}")


successful = 0
failed = 0


# ============================================================
# PROCESS EACH ANALYSIS
# ============================================================

for index, row in enumerate(analyses, start=1):

    print(
        f"\n[{index}/{len(analyses)}] "
        f"Creating action plan for Review {row.review_id}"
    )

    try:

        result = run_agent3(

            doctor_name=row.doctor_name or "Unknown",

            specialty=row.specialty or "Unknown",

            clinic=row.clinic___hospital or "Unknown",

            root_cause=row.root_cause or "Unknown",

            evidence=row.evidence or "No evidence provided",

            department=row.department or "Unknown",

            lead=row.lead or "Unknown",

            confidence=float(row.confidence or 0),

            metrics=row.metrics or "No metrics provided"
        )


        # ====================================================
        # SAVE RESULT
        # ====================================================

        with engine.begin() as conn:

            conn.execute(
                text("""
                    INSERT INTO action_plans (
                        review_id,
                        priority,
                        objective,
                        immediate_actions,
                        corrective_actions,
                        preventive_actions,
                        owner_role,
                        timeline,
                        success_metrics,
                        confidence
                    )

                    VALUES (
                        :review_id,
                        :priority,
                        :objective,
                        :immediate_actions,
                        :corrective_actions,
                        :preventive_actions,
                        :owner_role,
                        :timeline,
                        :success_metrics,
                        :confidence
                    )

                    ON CONFLICT (review_id)

                    DO UPDATE SET

                        priority = EXCLUDED.priority,

                        objective = EXCLUDED.objective,

                        immediate_actions =
                            EXCLUDED.immediate_actions,

                        corrective_actions =
                            EXCLUDED.corrective_actions,

                        preventive_actions =
                            EXCLUDED.preventive_actions,

                        owner_role =
                            EXCLUDED.owner_role,

                        timeline =
                            EXCLUDED.timeline,

                        success_metrics =
                            EXCLUDED.success_metrics,
                        confidence = EXCLUDED.confidence
                """),

                {
                    "review_id": row.review_id,

                    "priority": result.priority,

                    "objective": result.objective,

                    "immediate_actions":
                        result.immediate_actions,

                    "corrective_actions":
                        result.corrective_actions,

                    "preventive_actions":
                        result.preventive_actions,

                    "owner_role":
                        result.owner_role,

                    "timeline":
                        result.timeline,

                    "success_metrics":
                        result.success_metrics,
                    "confidence": round(min(0.95, max(0.05,
                        0.35 * (sum(bool(str(v or "").strip()) for v in [
                            result.objective, result.immediate_actions, result.corrective_actions,
                            result.preventive_actions, result.owner_role, result.timeline,
                            result.success_metrics]) / 7.0)
                        + 0.65 * max(0.0, min(1.0, float(row.confidence or 0)))
                    )), 2)
                }
            )


        successful += 1


        # ====================================================
        # DISPLAY RESULT
        # ====================================================

        print(f"  Priority   : {result.priority}")

        print(f"  Objective  : {result.objective}")

        print(f"  Owner      : {result.owner_role}")

        print(f"  Timeline   : {result.timeline}")

        print(f"  Success    : {result.success_metrics}")


    except Exception as e:

        failed += 1

        print(f"  ERROR: {e}")


# ============================================================
# FINAL COUNT
# ============================================================

with engine.connect() as conn:

    saved = conn.execute(
        text("SELECT COUNT(*) FROM action_plans")
    ).scalar()


print("\n" + "=" * 70)
print("AGENT 3 COMPLETE")
print("=" * 70)

print(f"\nAnalysis cases found : {len(analyses)}")
print(f"Successfully planned : {successful}")
print(f"Failed               : {failed}")
print(f"Saved in action_plans: {saved}")

print("=" * 70)