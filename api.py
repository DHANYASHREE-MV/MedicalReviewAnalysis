import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, text

load_dotenv()

DB_URI = os.getenv("DB_URI")

if not DB_URI:
    raise ValueError("DB_URI not found in .env")

engine = create_engine(DB_URI)

app = FastAPI(title="AegisCare API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# DASHBOARD
# ============================================================

@app.get("/api/dashboard")
def dashboard():

    with engine.connect() as conn:

        total_reviews = conn.execute(
            text("SELECT COUNT(*) FROM reviews")
        ).scalar()

        investigations = conn.execute(
            text("""
                SELECT COUNT(*)
                FROM review_triage
                WHERE route = 'investigation'
            """)
        ).scalar()

        archived = conn.execute(
            text("""
                SELECT COUNT(*)
                FROM review_triage
                WHERE route = 'archive'
            """)
        ).scalar()

        negative = conn.execute(
            text("""
                SELECT COUNT(*)
                FROM review_triage
                WHERE sentiment = 'negative'
            """)
        ).scalar()

        analysis_count = conn.execute(
            text("SELECT COUNT(*) FROM analysis")
        ).scalar()

        action_plan_count = conn.execute(
            text("SELECT COUNT(*) FROM action_plans")
        ).scalar()

    return {
        "total_reviews": total_reviews,
        "investigations": investigations,
        "archived": archived,
        "negative": negative,
        "analysis_count": analysis_count,
        "action_plan_count": action_plan_count,
    }


# ============================================================
# ALL REVIEWS + AGENT 1
# ============================================================

@app.get("/api/reviews")
def reviews():

    with engine.connect() as conn:

        result = conn.execute(
            text("""
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
                    t.summary,
                    t.route

                FROM reviews r

                LEFT JOIN review_triage t
                    ON r.review_id = t.review_id

                ORDER BY r.review_id
            """)
        )

        rows = result.mappings().all()

    return rows


# ============================================================
# INVESTIGATIONS + AGENT 1 + AGENT 2
# ============================================================

@app.get("/api/investigations")
def investigations():

    with engine.connect() as conn:

        result = conn.execute(
            text("""
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
                    t.summary,
                    t.route,

                    a.root_cause,
                    a.evidence,
                    a.department,
                    a.lead,
                    a.confidence,
                    a.metrics

                FROM reviews r

                JOIN review_triage t
                    ON r.review_id = t.review_id

                LEFT JOIN analysis a
                    ON r.review_id = a.review_id

                WHERE t.route = 'investigation'

                ORDER BY t.severity DESC, r.review_id
            """)
        )

        rows = result.mappings().all()

    return rows


# ============================================================
# AGENT 3 ACTION PLANS
# ============================================================

@app.get("/api/action-plans")
def action_plans():

    with engine.connect() as conn:

        result = conn.execute(
            text("""
                SELECT
                    p.review_id,

                    r.doctor_name,
                    r.specialty,
                    r.clinic___hospital,

                    p.priority,
                    p.objective,
                    p.immediate_actions,
                    p.corrective_actions,
                    p.preventive_actions,
                    p.owner_role,
                    p.timeline,
                    p.success_metrics

                FROM action_plans p

                JOIN reviews r
                    ON p.review_id = r.review_id

                ORDER BY p.review_id
            """)
        )

        rows = result.mappings().all()

    return rows