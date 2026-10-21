import os
import re
import json
import smtplib
from email.message import EmailMessage
from urllib.parse import quote_plus, urlencode
import secrets
import urllib.request
import urllib.error

from playwright.sync_api import sync_playwright

from dotenv import load_dotenv

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import RedirectResponse
from starlette.middleware.sessions import SessionMiddleware

from fastapi.middleware.cors import CORSMiddleware

from pydantic import BaseModel, Field

from sqlalchemy import create_engine, text

from graph import graph

from nodes.analyst import run_agent2

from nodes.action_planner import run_agent3

load_dotenv()

DB_URI = os.getenv("DB_URI")

if not DB_URI:

    raise ValueError("DB_URI not found in .env")

engine = create_engine(DB_URI)

app = FastAPI(title="AegisCare API")

# ============================================================
# CONFIG: CORS + SESSION + GOOGLE OAUTH
# ============================================================
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/auth/google/callback")
SESSION_SECRET = os.getenv("SESSION_SECRET", "dev-only-change-me")

# With allow_credentials=True the browser REJECTS allow_origins=["*"],
# so list the real frontend origins explicitly.
_default_origins = {FRONTEND_URL, "http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173", "http://127.0.0.1:3000"}
_extra = [o.strip().rstrip("/") for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
ALLOWED_ORIGINS = sorted(_default_origins | set(_extra))

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Signed session cookie (needs: pip install itsdangerous)
app.add_middleware(
    SessionMiddleware,
    secret_key=SESSION_SECRET,
    session_cookie="aegis_session",
    max_age=60 * 60 * 24 * 7,
    same_site="lax",
    https_only=False,  # set True in production (HTTPS)
)

# ============================================================
# AUTH (Google OAuth 2.0)
# ============================================================
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"


def _http_json(url: str, data: dict | None = None, headers: dict | None = None) -> dict:
    body = urlencode(data).encode() if data is not None else None
    req = urllib.request.Request(url, data=body, headers=headers or {})
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode())



ROLES = {"patient", "doctor", "organization"}


def ensure_schema() -> None:
    """Idempotent: user table with the 'Who are you?' profile fields."""
    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS app_users (
                google_sub TEXT PRIMARY KEY,
                email TEXT, name TEXT, picture TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                last_login_at TIMESTAMPTZ DEFAULT NOW()
            )
        """))
        for col, ddl in [
            ("role", "TEXT"), ("org_name", "TEXT"), ("org_type", "TEXT"),
            ("designation", "TEXT"), ("specialty", "TEXT"), ("city", "TEXT"),
            ("onboarded", "BOOLEAN NOT NULL DEFAULT FALSE"),
        ]:
            conn.execute(text(f"ALTER TABLE app_users ADD COLUMN IF NOT EXISTS {col} {ddl}"))


@app.on_event("startup")
def _startup() -> None:
    try:
        ensure_schema()
    except Exception as exc:  # noqa: BLE001
        print(f"[startup] schema setup failed: {exc}")


def _save_user(user: dict) -> None:
    """Create/update the user row (identity only; profile fields are untouched)."""
    try:
        ensure_schema()
        with engine.begin() as conn:
            conn.execute(text("""
                INSERT INTO app_users (google_sub, email, name, picture)
                VALUES (:sub, :email, :name, :picture)
                ON CONFLICT (google_sub) DO UPDATE
                SET email = EXCLUDED.email, name = EXCLUDED.name,
                    picture = EXCLUDED.picture, last_login_at = NOW()
            """), user)
    except Exception as exc:  # noqa: BLE001
        print(f"[auth] could not save user: {exc}")


def _load_profile(sub: str) -> dict:
    empty = {"role": "", "org_name": "", "org_type": "", "designation": "",
             "specialty": "", "city": "", "onboarded": False}
    try:
        with engine.connect() as conn:
            row = conn.execute(text("""
                SELECT role, org_name, org_type, designation, specialty, city, onboarded
                FROM app_users WHERE google_sub = :sub
            """), {"sub": sub}).mappings().first()
        if not row:
            return empty
        return {k: (row[k] or "") if k != "onboarded" else bool(row[k]) for k in empty}
    except Exception as exc:  # noqa: BLE001
        print(f"[auth] could not load profile: {exc}")
        return empty


def _session_user(request: Request) -> dict:
    sess = request.session.get("user")
    if not sess or not sess.get("sub"):
        raise HTTPException(status_code=401, detail="Please sign in.")
    return sess


def _me_payload(sess: dict) -> dict:
    profile = _load_profile(sess["sub"])
    return {
        "signed_in": True,
        "email": sess.get("email", ""),
        "onboarded": profile["onboarded"],
        "role": profile["role"],
        "profile": profile,
        "user": {
            "email": sess.get("email", ""), "name": sess.get("name", ""),
            "picture": sess.get("picture", ""), "business_profile_connected": False,
        },
    }


def _fail(reason: str) -> RedirectResponse:
    return RedirectResponse(f"{FRONTEND_URL}/?google_auth=error&reason={quote_plus(reason)}")


@app.get("/api/auth/google/start")
def google_start(request: Request, mode: str = "login"):
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(
            status_code=500,
            detail="Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.",
        )
    state = secrets.token_urlsafe(24)
    request.session["oauth_state"] = state
    request.session["oauth_mode"] = mode
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "online",
        "prompt": "select_account",
    }
    return RedirectResponse(f"{GOOGLE_AUTH_URL}?{urlencode(params)}")


@app.get("/api/auth/google/callback")
def google_callback(request: Request, code: str = "", state: str = "", error: str = ""):
    if error:
        return _fail(error)
    expected = request.session.pop("oauth_state", None)
    if not code or not expected or not secrets.compare_digest(state, expected):
        return _fail("invalid_state")
    try:
        token = _http_json(GOOGLE_TOKEN_URL, data={
            "code": code,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code",
        })
        info = _http_json(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {token['access_token']}"},
        )
    except (urllib.error.URLError, KeyError, ValueError) as exc:
        print(f"[auth] Google token exchange failed: {exc}")
        return _fail("token_exchange_failed")

    user = {
        "sub": info.get("sub", ""),
        "email": info.get("email", ""),
        "name": info.get("name", ""),
        "picture": info.get("picture", ""),
    }
    if not user["sub"]:
        return _fail("no_profile")
    _save_user(user)
    request.session["user"] = user
    return RedirectResponse(f"{FRONTEND_URL}/?google_auth=success")


@app.get("/api/auth/me")
def auth_me(request: Request):
    if not request.session.get("user"):
        return {"signed_in": False}
    return _me_payload(request.session["user"])


@app.post("/api/auth/logout")
def auth_logout(request: Request):
    request.session.clear()
    return {"signed_out": True}


class ProfilePayload(BaseModel):
    role: str
    org_name: str = Field(default="", max_length=160)
    org_type: str = Field(default="", max_length=60)
    designation: str = Field(default="", max_length=120)
    specialty: str = Field(default="", max_length=120)
    city: str = Field(default="", max_length=120)


@app.post("/api/profile")
def save_profile(payload: ProfilePayload, request: Request):
    """'Who are you?' step after first sign-in (also used for later edits)."""
    sess = _session_user(request)
    role = payload.role.strip().lower()
    if role not in ROLES:
        raise HTTPException(status_code=422, detail="Choose patient, doctor, or organization.")
    data = {k: v.strip() for k, v in payload.dict().items()}
    if role == "doctor" and not data["specialty"]:
        raise HTTPException(status_code=422, detail="Enter your specialty.")
    if role == "doctor" and not data["org_name"]:
        raise HTTPException(status_code=422, detail="Enter the hospital or clinic you practise at.")
    if role == "organization" and not data["org_name"]:
        raise HTTPException(status_code=422, detail="Enter your organization's name.")
    ensure_schema()
    with engine.begin() as conn:
        conn.execute(text("""
            UPDATE app_users
            SET role=:role, org_name=:org_name, org_type=:org_type, designation=:designation,
                specialty=:specialty, city=:city, onboarded=TRUE
            WHERE google_sub=:sub
        """), {**data, "role": role, "sub": sess["sub"]})
    return _me_payload(sess)


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

        # Severity for the reviews that actually reached Agent 2 / analysis.

        average_severity = conn.execute(

            text("""

                SELECT COALESCE(AVG(t.severity), 0)

                FROM analysis a

                JOIN review_triage t

                    ON a.review_id = t.review_id

            """)

        ).scalar()

    return {

        "total_reviews": int(total_reviews or 0),

        "investigations": int(investigations or 0),

        "archived": int(archived or 0),

        "negative": int(negative or 0),

        "analysis_count": int(analysis_count or 0),

        "action_plan_count": int(action_plan_count or 0),

        "average_severity": round(float(average_severity or 0), 2),

    }

# ============================================================

# ALL REVIEWS + AGENT 1

# ============================================================

def ensure_decisions_table():
    """Create/upgrade the decision table, including email delivery tracking."""
    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS review_decisions (
                review_id INTEGER PRIMARY KEY,
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
                response TEXT NOT NULL DEFAULT '',
                email_status VARCHAR(20) NOT NULL DEFAULT 'not_sent',
                email_recipient VARCHAR(320) NOT NULL DEFAULT '',
                email_sent_at TIMESTAMP NULL,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """))
        # Safe, repeatable upgrades for installations where the table already exists.
        conn.execute(text("ALTER TABLE review_decisions ADD COLUMN IF NOT EXISTS email_status VARCHAR(20) NOT NULL DEFAULT 'not_sent'"))
        conn.execute(text("ALTER TABLE review_decisions ADD COLUMN IF NOT EXISTS email_recipient VARCHAR(320) NOT NULL DEFAULT ''"))
        conn.execute(text("ALTER TABLE review_decisions ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMP NULL"))


@app.post("/api/reviews/{review_id}/decision")
def save_review_decision(review_id: int, payload: dict):
    status = str(payload.get("status", "pending")).lower()
    response = str(payload.get("response", "") or "")
    if status not in {"pending", "approved", "rejected", "archived"}:
        raise HTTPException(status_code=422, detail="Invalid review status.")
    try:
        ensure_decisions_table()
        with engine.begin() as conn:
            if not conn.execute(text("SELECT 1 FROM reviews WHERE review_id=:rid"), {"rid": review_id}).first():
                raise HTTPException(status_code=404, detail="Review not found.")
            conn.execute(text("""
                INSERT INTO review_decisions (review_id,status,response,updated_at)
                VALUES (:rid,:status,:response,CURRENT_TIMESTAMP)
                ON CONFLICT (review_id) DO UPDATE SET
                    status=EXCLUDED.status,response=EXCLUDED.response,updated_at=CURRENT_TIMESTAMP
            """), {"rid": review_id, "status": status, "response": response})
        return {"success": True, "review_id": review_id, "status": status}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not save decision: {exc}") from exc




# ============================================================
# LLM-GENERATED EMAIL DRAFT FOR A NEGATIVE REVIEW
# ============================================================

class GenerateEmailRequest(BaseModel):
    # Optional: the reviewer’s email is not available in a public Google review.
    recipient: str = Field(default="", max_length=320)
    # If the user edited the Agent 3 plan in the UI, send that version here.
    action_plan: dict | None = None


class EmailDraftResult(BaseModel):
    subject: str = Field(description="Professional, concise email subject")
    body: str = Field(description="Empathetic, personalized plain-text email body")


@app.post("/api/reviews/{review_id}/generate-email")
def generate_review_email(review_id: int, payload: GenerateEmailRequest):
    """
    Generate an editable email draft from the original review, Agent 2 analysis,
    and Agent 3 action plan. This endpoint does not send email or save a decision.
    """
    with engine.connect() as conn:
        review = conn.execute(text("""
            SELECT r.review_id, r.doctor_name, r.specialty, r.clinic___hospital,
                   r.overall_rating, r.review_text, r.reviewer_name,
                   t.sentiment, t.severity, t.category, t.summary,
                   a.root_cause, a.evidence, a.department, a.lead, a.confidence, a.metrics
            FROM reviews r
            LEFT JOIN review_triage t ON t.review_id = r.review_id
            LEFT JOIN analysis a ON a.review_id = r.review_id
            WHERE r.review_id = :rid
        """), {"rid": review_id}).mappings().first()

        plan_row = conn.execute(text("""
            SELECT priority, objective, immediate_actions, corrective_actions,
                   preventive_actions, owner_role, timeline, success_metrics
            FROM action_plans
            WHERE review_id = :rid
            ORDER BY priority
            LIMIT 1
        """), {"rid": review_id}).mappings().first()

    if not review:
        raise HTTPException(status_code=404, detail="Review not found.")
    if not plan_row and not payload.action_plan:
        raise HTTPException(
            status_code=404,
            detail="No Agent 3 action plan was found for this review. Run Agent 3 first."
        )

    plan = payload.action_plan or dict(plan_row)
    sentiment = str(review.get("sentiment") or "").lower()
    try:
        rating = float(review.get("overall_rating") or 0)
    except (TypeError, ValueError):
        rating = 0
    if sentiment != "negative" and rating > 2:
        raise HTTPException(
            status_code=422,
            detail="Email draft generation is intended for negative or low-rated reviews."
        )

    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="GROQ_API_KEY is missing from the backend .env file."
        )

    prompt = f"""
You write careful, empathetic customer-care emails on behalf of a healthcare provider
in response to a negative patient review.

Create a draft addressed to the reviewer, using only the information below.
The email must:
- Acknowledge the experience and apologize for the distress or inconvenience, without
  admitting unverified facts or assigning blame.
- Refer naturally to the concern in the review, but do not repeat sensitive details.
- Offer a respectful next step, such as contacting the hospital's patient-relations team.
- Use the Agent 3 plan as internal context; do not expose internal root-cause analysis,
  staff names, internal metrics, or operational investigation details.
- Never claim an action has already been completed. Describe proposed actions as planned
  only if useful, and do not promise compensation, clinical outcomes, or deadlines.
- Ask the reviewer to contact the provider through its official, verified channel.
- Do not invent phone numbers, email addresses, URLs, staff names, or facts.
- Keep the body around 100-160 words, professional, warm, and plain text.
- Do not include a fake recipient email address in the body.

Provider:
Hospital/clinic: {review.get('clinic___hospital') or review.get('doctor_name') or 'Healthcare provider'}
Specialty: {review.get('specialty') or 'Not provided'}

Original review:
{review.get('review_text') or 'No review text supplied'}

Review rating: {review.get('overall_rating')}
Sentiment: {review.get('sentiment')}
Category: {review.get('category')}
Severity: {review.get('severity')}
Triage summary: {review.get('summary')}

Agent 2 analysis (internal context only):
Root cause: {review.get('root_cause')}
Evidence: {review.get('evidence')}
Department: {review.get('department')}
Responsible role: {review.get('lead')}
Confidence: {review.get('confidence')}
Metrics: {review.get('metrics')}

Agent 3 action plan (internal context only):
{json.dumps(plan, ensure_ascii=False, default=str)}

Return only the structured email subject and body.
"""
    try:
        from langchain_groq import ChatGroq
        llm = ChatGroq(
            model=os.getenv("EMAIL_LLM_MODEL", "openai/gpt-oss-120b"),
            groq_api_key=api_key,
            temperature=0.3,
        )
        structured_llm = llm.with_structured_output(EmailDraftResult)
        draft = structured_llm.invoke(prompt)
        result = draft.model_dump() if hasattr(draft, "model_dump") else draft.dict()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Email draft generation failed: {exc}") from exc

    return {
        "success": True,
        "review_id": review_id,
        "recipient": payload.recipient.strip(),
        "subject": result["subject"],
        "body": result["body"],
        "sent": False,
        "message": "Draft generated only. Review and edit it, save approval, then explicitly send it.",
    }


@app.post("/api/reviews/{review_id}/send-approval-email")
def send_approval_email(review_id: int, payload: dict):
    """Send an approved plan by SMTP; requires explicit UI action and SMTP .env settings."""
    ensure_decisions_table()
    recipient = str(payload.get("recipient", "")).strip()
    subject = str(payload.get("subject", "")).strip()
    body = str(payload.get("body", "")).strip()
    if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", recipient):
        raise HTTPException(status_code=422, detail="Enter a valid recipient email address.")
    if not subject or not body:
        raise HTTPException(status_code=422, detail="Email subject and body are required.")

    with engine.connect() as conn:
        row = conn.execute(text("""
            SELECT status, response, email_status FROM review_decisions WHERE review_id=:rid
        """), {"rid": review_id}).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="No saved decision found for this review. Approve the plan first.")
    if row["status"] != "approved":
        raise HTTPException(status_code=409, detail="The action plan must be approved before its email can be sent.")
    if row.get("email_status") == "sent":
        raise HTTPException(status_code=409, detail="An approval email has already been sent for this review.")

    smtp_host = os.getenv("SMTP_HOST", "").strip()
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_username = os.getenv("SMTP_USERNAME", "").strip()
    smtp_password = os.getenv("SMTP_PASSWORD", "")
    sender = os.getenv("SMTP_FROM", smtp_username).strip()
    use_ssl = os.getenv("SMTP_USE_SSL", "false").lower() in {"1", "true", "yes"}
    use_tls = os.getenv("SMTP_USE_TLS", "true").lower() in {"1", "true", "yes"}
    if not smtp_host or not sender:
        raise HTTPException(status_code=503, detail="Email is not configured. Add SMTP_HOST, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD and SMTP_FROM to the backend .env file.")

    message = EmailMessage()
    message["From"] = sender
    message["To"] = recipient
    message["Subject"] = subject
    message.set_content(body)
    try:
        if use_ssl:
            with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=25) as server:
                if smtp_username:
                    server.login(smtp_username, smtp_password)
                server.send_message(message)
        else:
            with smtplib.SMTP(smtp_host, smtp_port, timeout=25) as server:
                server.ehlo()
                if use_tls:
                    server.starttls()
                    server.ehlo()
                if smtp_username:
                    server.login(smtp_username, smtp_password)
                server.send_message(message)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Email delivery failed: {exc}") from exc

    saved_response = {}
    try:
        saved_response = json.loads(row["response"] or "{}")
        if not isinstance(saved_response, dict):
            saved_response = {}
    except Exception:
        saved_response = {}
    saved_response["email_draft"] = {"recipient": recipient, "subject": subject, "body": body}
    with engine.begin() as conn:
        conn.execute(text("""
            UPDATE review_decisions
            SET response=:response, email_status='sent', email_recipient=:recipient,
                email_sent_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
            WHERE review_id=:rid AND status='approved'
        """), {"response": json.dumps(saved_response, ensure_ascii=False), "recipient": recipient, "rid": review_id})
    return {"success": True, "review_id": review_id, "email_status": "sent", "recipient": recipient}


@app.get("/api/reviews/{review_id}/decision")
def get_review_decision(review_id: int):
    """Return the saved approval status and edited action-plan JSON, if present."""
    ensure_decisions_table()
    with engine.connect() as conn:
        row = conn.execute(text("""
            SELECT review_id, status, response, email_status, email_recipient, email_sent_at, updated_at
            FROM review_decisions WHERE review_id=:rid
        """), {"rid": review_id}).mappings().first()
    if not row:
        return {"review_id": review_id, "status": "pending", "action_plan": None}
    import json
    saved = None
    try:
        saved = json.loads(row["response"] or "{}")
    except Exception:
        saved = {"response": row["response"]}
    return {"review_id": row["review_id"], "status": row["status"], "action_plan": saved.get("action_plan", saved), "email_draft": saved.get("email_draft"), "email_status": row.get("email_status", "not_sent"), "email_recipient": row.get("email_recipient", ""), "email_sent_at": str(row["email_sent_at"]) if row.get("email_sent_at") else None, "updated_at": str(row["updated_at"]) if row["updated_at"] else None}


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

    """

    Return the actual Agent 3 outputs saved in PostgreSQL.

    This endpoint is read-only. It does not generate or modify plans.

    """

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

                FROM action_plans AS p

                LEFT JOIN reviews AS r

                    ON p.review_id = r.review_id

                ORDER BY p.review_id, p.priority

            """)

        )

        # Convert SQLAlchemy RowMapping objects to plain dictionaries.

        # This makes the response reliably JSON serializable in FastAPI.

        rows = [dict(row) for row in result.mappings().all()]

    return rows

# ============================================================

# INTERACTIVE TRIAL MODE

#

# IMPORTANT:

# These endpoints DO NOT read from or write to the review_triage,

# analysis, or action_plans tables.

# They call the same real agent functions used by the batch jobs,

# but return the result directly to the React UI.

# ============================================================

class TrialReview(BaseModel):

    doctor_name: str = "Unknown"

    specialty: str = "Unknown"

    overall_rating: int = Field(default=3, ge=1, le=5)

    review_text: str = Field(min_length=1)

class TrialAgent2Request(TrialReview):

    triage: dict

class TrialAgent3Request(BaseModel):

    doctor_name: str = "Unknown"

    specialty: str = "Unknown"

    clinic: str = "Trial / Not saved"

    triage: dict

    investigation: dict

def model_to_dict(value):

    """Convert Pydantic/model/dict output into JSON-safe data."""

    if value is None:

        return None

    if isinstance(value, dict):

        return value

    if hasattr(value, "model_dump"):

        return value.model_dump()

    if hasattr(value, "dict"):

        return value.dict()

    return dict(value)

@app.post("/api/test/agent1")

def trial_agent1(payload: TrialReview):

    """Run the real Agent 1 without saving anything."""

    try:

        result = graph.invoke({

            "review_id": 0,

            "doctor_name": payload.doctor_name or "Unknown",

            "specialty": payload.specialty or "Unknown",

            "overall_rating": payload.overall_rating,

            "review": payload.review_text,

        })

        return model_to_dict(result)

    except Exception as exc:

        raise HTTPException(status_code=500, detail=f"Agent 1 failed: {exc}") from exc

@app.post("/api/test/agent2")

def trial_agent2(payload: TrialAgent2Request):

    """Run the real Agent 2 using the supplied Agent 1 result."""

    try:

        triage = payload.triage or {}

        # Agent 2 normally receives doctor-level DB metrics.

        # Trial mode deliberately does not query PostgreSQL, so provide

        # a transparent one-review metric context instead.

        metrics = (

            "TRIAL MODE - no PostgreSQL data used.\n"

            f"Current review rating: {payload.overall_rating}/5\n"

            f"Current review sentiment: {triage.get('sentiment', 'Unknown')}\n"

            f"Current review severity: {triage.get('severity', 'Unknown')}\n"

            f"Current review category: {triage.get('category', 'Unknown')}\n"

            "Historical doctor metrics: unavailable in trial mode."

        )

        result = run_agent2(

            review=payload.review_text,

            doctor_name=payload.doctor_name or "Unknown",

            specialty=payload.specialty or "Unknown",

            clinic="Trial / Not saved",

            overall_rating=payload.overall_rating,

            sentiment=triage.get("sentiment", "Unknown"),

            severity=triage.get("severity", 0),

            category=triage.get("category", "other"),

            summary=triage.get("summary", ""),

            metrics=metrics,

        )

        return model_to_dict(result)

    except Exception as exc:

        raise HTTPException(status_code=500, detail=f"Agent 2 failed: {exc}") from exc

@app.post("/api/test/agent3")

def trial_agent3(payload: TrialAgent3Request):

    """Run the real Agent 3 using the supplied Agent 2 result."""

    try:

        investigation = payload.investigation or {}

        result = run_agent3(

            doctor_name=payload.doctor_name or "Unknown",

            specialty=payload.specialty or "Unknown",

            clinic=payload.clinic or "Trial / Not saved",

            root_cause=investigation.get("root_cause", "Unknown"),

            evidence=investigation.get("evidence", "No evidence provided"),

            department=investigation.get("department", "Unknown"),

            lead=investigation.get("lead", "Unknown"),

            confidence=float(investigation.get("confidence", 0) or 0),

            metrics=investigation.get("metrics", "No metrics provided"),

        )

        return model_to_dict(result)

    except Exception as exc:

        raise HTTPException(status_code=500, detail=f"Agent 3 failed: {exc}") from exc

# ============================================================
# HOSPITAL TRIAL PIPELINE: DEMO SCRAPER + AGENT 1 ONLY
# Adapted from the working DEMO/scrape_agent1_test.py flow.
# ============================================================

class HospitalPipelineRequest(BaseModel):
    hospital_name: str = Field(default="", max_length=200)
    google_maps_url: str = Field(default="", max_length=2000)
    input: str = Field(default="", max_length=2000)
    review_count: int = Field(default=5, ge=1, le=500)
    # The selected source controls retrieval: "dataset" never opens Google Maps;
    # "maps" uses the existing Playwright scraper.
    source: str = Field(default="maps", max_length=20)
    provider_type: str = Field(default="hospital", max_length=20)
    doctor_name: str = Field(default="", max_length=200)
    location: str = Field(default="", max_length=200)
    disease_query: str = Field(default="", max_length=200)

def rating_number(value):
    """Convert labels such as 'Rated 4 stars' or '4.5 stars' to a number."""
    match = re.search(r"([1-5](?:\.\d+)?)", str(value or ""))
    return float(match.group(1)) if match else 0.0

def _visible_count(page, selector):
    try:
        return page.locator(selector).count()
    except Exception:
        return 0

def _safe_inner_text(locator, timeout=800):
    try:
        return locator.inner_text(timeout=timeout).strip()
    except Exception:
        return ""

def _safe_attribute(locator, name, timeout=800):
    try:
        return locator.get_attribute(name, timeout=timeout) or ""
    except Exception:
        return ""

def _looks_like_profile_text(value):
    """Reject Google Maps business-card/navigation text accidentally selected as a review."""
    value = re.sub(r"\s+", " ", str(value or "")).strip().lower()
    junk_phrases = (
        "get app", "search this area", "directions", "website", "open 24 hours",
        "opens at", "closes at", "hospital ·", "private hospital ·", "medical clinic ·",
        "results share", "write a review", "overview reviews about",
    )
    return not value or any(phrase in value for phrase in junk_phrases) or len(value) < 8

def _to_text(value):
    if value is None:
        return ""
    if isinstance(value, (dict, list, tuple)):
        import json
        return json.dumps(value, ensure_ascii=False)
    return str(value)


def _pick(data, *keys, default=""):
    if not isinstance(data, dict):
        return default
    for key in keys:
        if data.get(key) is not None:
            return data[key]
    return default


def _persist_pipeline_results(results, hospital_name):
    # A single transaction prevents partially saved pipeline batches.
    with engine.begin() as conn:
        next_id = int(conn.execute(text("SELECT COALESCE(MAX(review_id),0)+1 FROM reviews")).scalar() or 1)
        for item in results:
            review = item["review"]
            triage = item.get("agent1") or {}
            analysis = item.get("agent2") or {}
            action = item.get("agent3") or {}
            rid = next_id
            next_id += 1
            item["database_review_id"] = rid
            rating = float(review.get("overall_rating") or 3)
            sentiment = str(triage.get("sentiment") or "neutral").lower()
            try:
                severity = max(1, min(5, int(float(triage.get("severity") or 1))))
            except (TypeError, ValueError):
                severity = 1
            route = str(triage.get("route") or "").lower()
            if rating <= 2 or sentiment == "negative" or severity >= 4:
                route = "investigation"
            elif route not in {"investigation", "archive"}:
                route = "archive"
            triage["route"] = route
            item["agent1"] = triage

            conn.execute(text("""
                INSERT INTO reviews
                  (review_id, doctor_name, specialty, clinic___hospital, overall_rating,
                   review_text, reviewer_name, time_of_review, city)
                VALUES
                  (:rid,:doctor,:specialty,:clinic,:rating,:review,:reviewer,:review_date,:city)
            """), {
                "rid": rid,
                "doctor": str(review.get("doctor_name") or hospital_name),
                "specialty": str(review.get("specialty") or ("Doctor review" if review.get("doctor_name") else "Hospital review")),
                "clinic": str(review.get("clinic___hospital") or hospital_name),
                "rating": rating,
                "review": str(review.get("review_text") or ""),
                "reviewer": str(review.get("reviewer_name") or "Reviewer not shown"),
                "review_date": str(review.get("review_date") or ""),
                "city": str(review.get("city") or ""),
            })
            conn.execute(text("""
                INSERT INTO review_triage (review_id,sentiment,severity,category,summary,route)
                VALUES (:rid,:sentiment,:severity,:category,:summary,:route)
                ON CONFLICT (review_id) DO UPDATE SET
                  sentiment=EXCLUDED.sentiment,severity=EXCLUDED.severity,
                  category=EXCLUDED.category,summary=EXCLUDED.summary,route=EXCLUDED.route
            """), {
                "rid": rid, "sentiment": sentiment, "severity": severity,
                "category": str(triage.get("category") or "other"),
                "summary": str(triage.get("summary") or ""), "route": route,
            })
            if analysis:
                conn.execute(text("""
                    INSERT INTO analysis (review_id,root_cause,evidence,department,lead,confidence,metrics)
                    VALUES (:rid,:root,:evidence,:department,:lead,:confidence,:metrics)
                    ON CONFLICT (review_id) DO UPDATE SET
                      root_cause=EXCLUDED.root_cause,evidence=EXCLUDED.evidence,
                      department=EXCLUDED.department,lead=EXCLUDED.lead,
                      confidence=EXCLUDED.confidence,metrics=EXCLUDED.metrics
                """), {
                    "rid": rid, "root": _to_text(_pick(analysis,"root_cause")),
                    "evidence": _to_text(_pick(analysis,"evidence")),
                    "department": _to_text(_pick(analysis,"department")),
                    "lead": _to_text(_pick(analysis,"lead")),
                    "confidence": float(_pick(analysis,"confidence",default=0) or 0),
                    "metrics": _to_text(_pick(analysis,"metrics")),
                })
            plans = action if isinstance(action, list) else action.get("plans", [action]) if isinstance(action, dict) else []
            for plan in plans:
                if not isinstance(plan, dict):
                    continue
                conn.execute(text("""
                    INSERT INTO action_plans
                      (review_id,priority,objective,immediate_actions,corrective_actions,
                       preventive_actions,owner_role,timeline,success_metrics)
                    VALUES (:rid,:priority,:objective,:immediate,:corrective,:preventive,:owner,:timeline,:metrics)
                """), {
                    "rid": rid, "priority": str(_pick(plan,"priority",default="medium")),
                    "objective": _to_text(_pick(plan,"objective","title")),
                    "immediate": _to_text(_pick(plan,"immediate_actions","immediate_action")),
                    "corrective": _to_text(_pick(plan,"corrective_actions","corrective_action")),
                    "preventive": _to_text(_pick(plan,"preventive_actions","preventive_action")),
                    "owner": _to_text(_pick(plan,"owner_role","owner","lead")),
                    "timeline": _to_text(_pick(plan,"timeline","timeframe")),
                    "metrics": _to_text(_pick(plan,"success_metrics","metrics")),
                })


def _normalise_dataset_key(value):
    return re.sub(r"[^a-z0-9]", "", str(value or "").lower())


def _dataset_value(row_data, *wanted_terms):
    """Pick a value from arbitrary imported Excel column names using normalized keys."""
    if not isinstance(row_data, dict):
        return ""
    normalized = [(_normalise_dataset_key(k), v) for k, v in row_data.items()]
    # First prefer exact normalized key matches, then keys containing the desired term.
    for term in wanted_terms:
        term_norm = _normalise_dataset_key(term)
        for key, value in normalized:
            if key == term_norm and value not in (None, ""):
                return value
    for term in wanted_terms:
        term_norm = _normalise_dataset_key(term)
        for key, value in normalized:
            if term_norm in key and value not in (None, ""):
                if isinstance(value, (dict, list)):
                    continue
                return value
    return ""


def _extract_dataset_review(row_data, source_row):
    """Convert differently-shaped imported Excel rows into AegisCare's review shape."""
    if not isinstance(row_data, dict):
        return None

    # Avoid accidentally analysing doctor profile records or rows without review text.
    review_text = _dataset_value(
        row_data, "cleaned review", "review text", "review content",
        "patient review", "review", "feedback", "comment", "testimonial"
    )
    review_text = str(review_text or "").strip()
    if len(review_text) < 8:
        return None

    doctor = str(_dataset_value(row_data, "doctor name", "doctor", "physician", "practitioner") or "").strip()
    clinic = str(_dataset_value(
        row_data, "clinic hospital", "clinic", "hospital", "healthcare provider",
        "clinic name", "hospital name"
    ) or "").strip()
    specialty = str(_dataset_value(row_data, "specialty", "specialisation", "specialization", "department") or "").strip()
    reviewer = str(_dataset_value(row_data, "reviewer name", "patient name", "author", "user name", "reviewer") or "Reviewer not shown").strip()
    review_date = str(_dataset_value(row_data, "date", "review date", "time of review", "posted date") or "").strip()
    city = str(_dataset_value(row_data, "city", "location", "locality") or "").strip()
    rating_raw = _dataset_value(row_data, "overall rating", "rating", "stars", "review rating", "score")
    rating = rating_number(rating_raw)
    return {
        "review_id": int(source_row),
        "reviewer_name": reviewer or "Reviewer not shown",
        "overall_rating": rating or 3.0,
        "review_text": review_text,
        "review_date": review_date,
        "doctor_name": doctor,
        "specialty": specialty or ("Doctor review" if doctor else "Hospital review"),
        "clinic___hospital": clinic,
        "city": city,
        "source": "Imported dataset",
    }


def _search_imported_dataset(search_term, target_count, provider_type, location="", disease_query=""):
    """Search imported PostgreSQL rows only, then normalize/filter candidate reviews in Python."""
    search_term = str(search_term or "").strip()
    location = str(location or "").strip()
    disease_query = str(disease_query or "").strip()
    provider_type = str(provider_type or "hospital").strip().lower()
    if not search_term:
        raise HTTPException(status_code=400, detail="Enter a doctor, clinic, hospital, or disease/condition.")

    # Search both the precomputed text and JSONB itself. Some imported files have
    # incomplete searchable_text values, while row_data still contains the provider.
    pattern = f"%{search_term}%"
    location_pattern = f"%{location}%" if location else None
    try:
        with engine.connect() as conn:
            rows = conn.execute(text("""
                SELECT id, city_folder, source_file, sheet_name, source_row,
                       row_data, searchable_text
                FROM public.imported_dataset_rows
                WHERE (
                    searchable_text ILIKE :pattern
                    OR COALESCE(row_data::text, '') ILIKE :pattern
                )
                AND (
                    CAST(:location_pattern AS TEXT) IS NULL
                    OR city_folder ILIKE :location_pattern
                    OR COALESCE(searchable_text, '') ILIKE :location_pattern
                    OR COALESCE(row_data::text, '') ILIKE :location_pattern
                )
                ORDER BY id
                LIMIT :limit_count
            """), {
                "pattern": pattern,
                "location_pattern": location_pattern,
                # Allow for non-review/profile rows and rows later rejected by filters.
                "limit_count": min(max(int(target_count) * 30, int(target_count), 300), 12000),
            }).mappings().all()
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=("Could not search public.imported_dataset_rows. Check DB_URI, table permissions, "
                    f"and the row_data/searchable_text columns. Database error: {exc}")
        ) from exc

    def norm(value):
        return re.sub(r"[^a-z0-9]", "", str(value or "").casefold())

    wanted_provider = norm(search_term)
    wanted_disease = norm(disease_query or (search_term if provider_type == "disease" else ""))
    wanted_location = norm(location)
    reviews = []
    seen = set()
    for row in rows:
        row_data = row.get("row_data")
        if isinstance(row_data, str):
            try:
                import json
                row_data = json.loads(row_data)
            except Exception:
                row_data = {}
        extracted = _extract_dataset_review(row_data, row["id"])
        if not extracted:
            continue

        actual_doctor = str(extracted.get("doctor_name") or "").strip()
        actual_clinic = str(extracted.get("clinic___hospital") or "").strip()
        city = str(extracted.get("city") or "").strip()
        city_folder = str(row.get("city_folder") or "").strip()
        source_file = str(row.get("source_file") or "").strip()
        row_text = str(row.get("searchable_text") or "")

        # If the city was supplied, require it to be evidenced by city metadata,
        # folder/file metadata, or the row itself. This blocks cross-city name matches.
        if wanted_location:
            location_evidence = " ".join((city, city_folder, source_file, row_text))
            if wanted_location not in norm(location_evidence):
                continue

        # Disease mode searches the actual review and specialty text, not the
        # provider name. Doctor and hospital modes keep provider-specific filtering.
        if provider_type == "disease":
            disease_evidence = norm(" ".join((extracted.get("review_text", ""), extracted.get("specialty", ""), row_text, str(row_data))))
            if not wanted_disease or wanted_disease not in disease_evidence:
                continue
        elif provider_type == "doctor":
            if actual_doctor and wanted_provider not in norm(actual_doctor) and norm(actual_doctor) not in wanted_provider:
                continue
            if not actual_doctor and wanted_provider not in norm(row_text + " " + str(row_data)):
                continue
        elif provider_type in {"hospital", "clinic"}:
            actual_provider = actual_clinic
            if actual_provider and wanted_provider not in norm(actual_provider) and norm(actual_provider) not in wanted_provider:
                if wanted_provider not in norm(row_text + " " + source_file + " " + str(row_data)):
                    continue

        fingerprint = re.sub(r"\s+", " ", extracted["review_text"]).casefold()
        if fingerprint in seen:
            continue
        seen.add(fingerprint)
        extracted["source_row_id"] = row["id"]
        extracted["source_file"] = source_file
        extracted["city_folder"] = city_folder
        extracted["sheet_name"] = row.get("sheet_name") or ""
        # Prefer the folder as city when the source row has no city column.
        if not extracted.get("city") and city_folder:
            extracted["city"] = city_folder
        reviews.append(extracted)
        if len(reviews) >= int(target_count):
            break
    return reviews


def _run_agent_pipeline_for_reviews(reviews, provider_name, provider_type, source_name):
    """Run the existing Agent 1 -> Agent 2 -> Agent 3 functions on normalized reviews."""
    results = []
    for index, review in enumerate(reviews, start=1):
        review["review_id"] = index  # temporary ID for agent state; persistence assigns DB IDs
        rating = float(review.get("overall_rating") or 3.0)
        doctor_name = str(review.get("doctor_name") or (provider_name if provider_type == "doctor" else ""))
        clinic_name = str(review.get("clinic___hospital") or (provider_name if provider_type != "doctor" else ""))
        specialty = str(review.get("specialty") or ("Doctor review" if provider_type == "doctor" else "Hospital review"))
        try:
            triage_raw = graph.invoke({
                "review_id": index,
                "doctor_name": doctor_name or provider_name,
                "specialty": specialty,
                "overall_rating": rating,
                "review": review["review_text"],
            })
            triage = model_to_dict(triage_raw) or {}
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Agent 1 failed for imported review {index}: {exc}") from exc

        item = {"review": review, "agent1": triage, "agent2": None, "agent3": None, "status": "triaged"}
        try:
            severity = float(triage.get("severity", 0) or 0)
        except (TypeError, ValueError):
            severity = 0
        sentiment = str(triage.get("sentiment", "")).lower()
        route = str(triage.get("route", "")).lower()
        needs_investigation = route == "investigation" or rating <= 2 or sentiment == "negative" or severity >= 4
        triage["route"] = "investigation" if needs_investigation else "archive"

        if needs_investigation:
            try:
                analysis_raw = run_agent2(
                    review=review["review_text"],
                    doctor_name=doctor_name or provider_name,
                    specialty=specialty,
                    clinic=clinic_name or provider_name,
                    overall_rating=rating,
                    sentiment=triage.get("sentiment", "negative"),
                    severity=severity or 3,
                    category=triage.get("category", "other"),
                    summary=triage.get("summary", ""),
                    metrics={
                        "context": f"{source_name} review; no internal provider records supplied",
                        "provider": provider_name,
                        "review_rating": rating,
                        "review_date": review.get("review_date", ""),
                        "source_file": review.get("source_file", ""),
                    },
                )
                analysis = model_to_dict(analysis_raw) or {}
                item["agent2"] = analysis
                try:
                    action_raw = run_agent3(
                        doctor_name=doctor_name or provider_name,
                        specialty=specialty,
                        clinic=clinic_name or provider_name,
                        root_cause=analysis.get("root_cause", "Unknown"),
                        evidence=analysis.get("evidence", "No evidence provided"),
                        department=analysis.get("department", "Unknown"),
                        lead=analysis.get("lead", "Unknown"),
                        confidence=float(analysis.get("confidence", 0) or 0),
                        metrics=analysis.get("metrics", {"provider": provider_name, "review_rating": rating}),
                    )
                    item["agent3"] = model_to_dict(action_raw)
                    item["status"] = "action_plan_ready"
                except Exception as exc:
                    item["agent3_error"] = str(exc)
                    item["status"] = "agent3_failed"
            except Exception as exc:
                item["agent2_error"] = str(exc)
                item["status"] = "agent2_failed"
        else:
            item["status"] = "triaged_no_escalation"
        results.append(item)

    _persist_pipeline_results(results, provider_name)
    return results


@app.post("/api/hospital/run-pipeline")
def run_hospital_pipeline(payload: HospitalPipelineRequest):
    """Run the selected retrieval source, then the existing AegisCare agent pipeline."""
    source = (payload.source or "maps").strip().lower()
    provider_type = (payload.provider_type or "hospital").strip().lower()
    if source not in {"dataset", "maps"}:
        raise HTTPException(
            status_code=422,
            detail="Choose either Imported dataset or Google Maps. Combined-source retrieval is not enabled in this endpoint."
        )
    if provider_type not in {"doctor", "hospital", "clinic", "disease"}:
        raise HTTPException(status_code=422, detail="provider_type must be doctor, clinic, hospital, or disease.")

    if source == "dataset":
        provider_name = (payload.disease_query if provider_type == "disease" else (payload.doctor_name or payload.hospital_name or payload.input)).strip()
        if not provider_name:
            raise HTTPException(status_code=400, detail="Enter a doctor, clinic, hospital, or disease/condition.")
        reviews = _search_imported_dataset(provider_name, payload.review_count, provider_type, payload.location, payload.disease_query)
        if not reviews:
            return {
                "success": True, "mode": "dataset_search", "source": "Imported dataset",
                "hospital_name": provider_name, "search_query": provider_name, "requested_review_count": payload.review_count,
                "reviews_found": 0, "processed_by_agent1": 0, "investigation_cases": 0,
                "action_plan_cases": 0, "results": [],
                "message": "No suitable review-text rows matched this search in the imported datasets. Google Maps was not searched because Imported dataset was selected."
            }
        try:
            results = _run_agent_pipeline_for_reviews(reviews, provider_name, provider_type, "Imported dataset")
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Imported dataset pipeline failed: {exc}") from exc
        return {
            "success": True, "mode": "dataset_search", "source": "Imported dataset",
            "hospital_name": provider_name, "search_query": provider_name, "requested_review_count": payload.review_count,
            "reviews_found": len(reviews), "processed_by_agent1": len(results),
            "investigation_cases": sum(1 for x in results if x.get("agent2") is not None),
            "action_plan_cases": sum(1 for x in results if x.get("agent3") is not None),
            "agent2_failures": sum(1 for x in results if x.get("status") == "agent2_failed"),
            "agent3_failures": sum(1 for x in results if x.get("status") == "agent3_failed"),
            "results": results,
            "message": "Imported-dataset reviews and available Agent 1/2/3 results were saved to PostgreSQL. Validate recommendations before acting."
        }

    # Google Maps selected: preserve the existing scraper path; do not search the imported dataset.
    candidates = [payload.google_maps_url, payload.input, payload.hospital_name, payload.doctor_name]
    raw_input = next((str(v).strip() for v in candidates if v and str(v).strip()), "")
    if not raw_input:
        raise HTTPException(status_code=400, detail="Enter a provider name or Google Maps profile URL.")
    is_maps_url = raw_input.lower().startswith(("http://", "https://"))
    if is_maps_url and not any(domain in raw_input.lower() for domain in ("google.", "maps.app.goo.gl", "goo.gl/maps")):
        raise HTTPException(status_code=400, detail="Paste a valid Google Maps URL.")
    hospital_name = (payload.doctor_name or payload.hospital_name).strip() or ("Google Maps provider" if is_maps_url else raw_input)
    target_count = payload.review_count
    search_query = " ".join(part for part in [raw_input, payload.location.strip()] if part)
    search_url = raw_input if is_maps_url else f"https://www.google.com/maps/search/?api=1&query={quote_plus(search_query)}"
    reviews = []
    debug = {"requested_url": search_url, "source": "Google Maps", "workflow": "profile -> Reviews tab -> review cards"}

    try:
        with sync_playwright() as p:
            # The supplied demo succeeds in a visible browser. Keep that behavior so
            # Google Maps can fully render its profile/reviews panel on this machine.
            browser = p.chromium.launch(headless=False)
            page = browser.new_page(viewport={"width": 1400, "height": 900}, locale="en-US")
            try:
                page.goto(search_url, wait_until="domcontentloaded", timeout=60000)
                page.wait_for_timeout(5000)
                debug["search_page_title"] = page.title()
                debug["search_page_url"] = page.url

                # For a name search, open a place result first, just as the demo does.
                if not is_maps_url or "/maps/search" in page.url:
                    business_opened = False
                    for selector in ['a[href*="/maps/place/"]', 'a[href*="/place/"]', 'div[role="article"] a']:
                        try:
                            elements = page.locator(selector)
                            for i in range(min(elements.count(), 10)):
                                element = elements.nth(i)
                                try:
                                    if element.is_visible(timeout=1000):
                                        element.click(timeout=5000)
                                        business_opened = True
                                        break
                                except Exception:
                                    continue
                            if business_opened:
                                break
                        except Exception:
                            continue
                    debug["business_profile_opened"] = business_opened
                    page.wait_for_timeout(5000)

                debug["profile_page_title"] = page.title()
                debug["profile_url"] = page.url

                # Open Reviews tab/button. The profile must be open before card selectors run.
                reviews_opened = False
                review_selectors = [
                    'button:has-text("Reviews")',
                    'button[aria-label*="Reviews"]',
                    'div[role="button"]:has-text("Reviews")',
                    '[role="tab"]:has-text("Reviews")',
                ]
                for selector in review_selectors:
                    try:
                        buttons = page.locator(selector)
                        for i in range(min(buttons.count(), 10)):
                            button = buttons.nth(i)
                            try:
                                if button.is_visible(timeout=1000):
                                    button.click(timeout=4000)
                                    reviews_opened = True
                                    page.wait_for_timeout(3000)
                                    break
                            except Exception:
                                continue
                        if reviews_opened:
                            break
                    except Exception:
                        continue
                debug["reviews_tab_clicked"] = reviews_opened

                # Use the same card selectors as the demo, with dedicated text extraction.
                seen = set()
                previous_count = 0
                no_change_count = 0
                card_selectors = ['div[data-review-id]', 'div[jsaction*="review"]']
                for scroll_number in range(max(20, min(target_count * 4, 80))):
                    if len(reviews) >= target_count:
                        break
                    blocks = page.locator(card_selectors[0])
                    count = blocks.count()
                    used_selector = card_selectors[0]
                    if count == 0:
                        blocks = page.locator(card_selectors[1])
                        count = blocks.count()
                        used_selector = card_selectors[1]

                    debug["last_card_selector"] = used_selector
                    debug["last_visible_card_count"] = count

                    for i in range(count):
                        if len(reviews) >= target_count:
                            break
                        try:
                            block = blocks.nth(i)
                            original_id = _safe_attribute(block, "data-review-id") or f"{scroll_number}_{i}"
                            if original_id in seen:
                                continue

                            reviewer_name = _safe_inner_text(block.locator('a[href*="/maps/contrib/"]').first)
                            rating_label = _safe_attribute(block.locator('[role="img"][aria-label*="star"]').first, "aria-label")
                            if not rating_label:
                                rating_label = _safe_attribute(block.locator('[aria-label*="stars"]').first, "aria-label")
                            review_text = _safe_inner_text(block.locator('.wiI7pd').first, timeout=1000)
                            if not review_text:
                                review_text = _safe_inner_text(block.locator('.MyEned').first, timeout=1000)
                            # Unlike the old trial scraper, never use the whole page/profile card as review text.
                            review_text = re.sub(r"\s+", " ", review_text).strip()
                            if not review_text or _looks_like_profile_text(review_text):
                                continue
                            try:
                                date_text = _safe_inner_text(block.locator('.rsqaWe').first)
                            except Exception:
                                date_text = ""

                            # Need at least a star label to reduce accidental non-review matches.
                            rating = rating_number(rating_label)
                            if not rating:
                                continue
                            fingerprint = (reviewer_name, rating, review_text[:240], date_text)
                            if fingerprint in seen:
                                continue
                            seen.add(original_id)
                            seen.add(fingerprint)
                            reviews.append({
                                "review_id": len(reviews) + 1,
                                "reviewer_name": reviewer_name or "Reviewer not shown",
                                "overall_rating": rating,
                                "review_text": review_text,
                                "review_date": date_text,
                                "clinic___hospital": hospital_name,
                                "source": "Google Maps",
                            })
                        except Exception:
                            continue

                    current_count = len(reviews)
                    no_change_count = no_change_count + 1 if current_count == previous_count else 0
                    previous_count = current_count
                    if current_count >= target_count or no_change_count >= 6:
                        break

                    # Scroll the likely review pane first; mouse-wheel fallback mirrors demo behavior.
                    scrolled = False
                    for selector in ['div[role="feed"]', 'div.m6QErb[aria-label*="Reviews"]', 'div[role="main"]']:
                        try:
                            panel = page.locator(selector).first
                            if panel.count() and panel.is_visible(timeout=500):
                                panel.evaluate("el => el.scrollBy(0, 1500)")
                                scrolled = True
                                break
                        except Exception:
                            continue
                    if not scrolled:
                        page.mouse.wheel(0, 1500)
                    page.wait_for_timeout(1500)

                debug["final_url"] = page.url
                debug["page_title"] = page.title()
                debug["review_card_counts"] = {selector: _visible_count(page, selector) for selector in card_selectors}
                debug["reviews_extracted"] = len(reviews)
                if not reviews:
                    try:
                        debug["body_preview"] = page.locator("body").inner_text(timeout=1500)[:1800]
                    except Exception:
                        debug["body_preview"] = "Could not read page body."
            finally:
                browser.close()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail={"message": f"Google Maps extraction failed: {exc}", "debug": debug}) from exc

    if not reviews:
        raise HTTPException(status_code=422, detail={
            "message": "Google Maps opened, but no individual review cards were extracted.",
            "debug": debug,
            "next_step": "Check whether the Reviews tab opened and whether Google Maps requires consent/sign-in. The browser is visible so you can see the page state during the run.",
        })

    results = []
    for review in reviews[:target_count]:
        rating = float(review.get("overall_rating") or 3.0)
        try:
            triage_raw = graph.invoke({
                "review_id": review["review_id"],
                "doctor_name": payload.doctor_name.strip() or hospital_name,
                "specialty": "Doctor review" if provider_type == "doctor" else "Hospital review",
                "overall_rating": rating,
                "review": review["review_text"],
            })
            triage = model_to_dict(triage_raw) or {}
        except Exception as exc:
            raise HTTPException(status_code=500, detail={
                "message": f"Agent 1 failed for review {review['review_id']}: {exc}",
                "reviews_extracted": len(reviews),
                "review_sample": review,
            }) from exc

        item = {"review": review, "agent1": triage, "agent2": None, "agent3": None,
                "status": "triaged"}
        route = str(triage.get("route", "")).strip().lower()
        sentiment = str(triage.get("sentiment", "")).strip().lower()
        try:
            severity = float(triage.get("severity", 0) or 0)
        except (TypeError, ValueError):
            severity = 0

        # Prefer Agent 1's explicit route. Fallback is conservative: investigate
        # low-star or negative/high-severity reviews only.
        needs_investigation = (
            route == "investigation" or rating <= 2
            or sentiment == "negative" or severity >= 4
        )
        triage["route"] = "investigation" if needs_investigation else "archive"

        if needs_investigation:
            try:
                analysis_raw = run_agent2(
                    review=review["review_text"],
                    doctor_name=payload.doctor_name.strip() or hospital_name,
                    specialty="Doctor review" if provider_type == "doctor" else "Hospital review",
                    clinic=hospital_name,
                    overall_rating=rating,
                    sentiment=triage.get("sentiment", "negative"),
                    severity=severity or 3,
                    category=triage.get("category", "other"),
                    summary=triage.get("summary", ""),
                    metrics={
                        "context": "Google Maps public review; no internal hospital records supplied",
                        "hospital": hospital_name,
                        "review_rating": rating,
                        "review_date": review.get("review_date", ""),
                    },
                )
                analysis = model_to_dict(analysis_raw) or {}
                item["agent2"] = analysis
                item["status"] = "analysed"
            except Exception as exc:
                item["agent2_error"] = str(exc)
                item["status"] = "agent2_failed"
                results.append(item)
                continue

            try:
                action_raw = run_agent3(
                    doctor_name=payload.doctor_name.strip() or hospital_name,
                    specialty="Doctor review" if provider_type == "doctor" else "Hospital review",
                    clinic=hospital_name,
                    root_cause=analysis.get("root_cause", "Unknown"),
                    evidence=analysis.get("evidence", "No evidence provided"),
                    department=analysis.get("department", "Unknown"),
                    lead=analysis.get("lead", "Unknown"),
                    confidence=float(analysis.get("confidence", 0) or 0),
                    metrics=analysis.get("metrics", {
                        "hospital": hospital_name,
                        "review_rating": rating,
                    }),
                )
                item["agent3"] = model_to_dict(action_raw)
                item["status"] = "action_plan_ready"
            except Exception as exc:
                item["agent3_error"] = str(exc)
                item["status"] = "agent3_failed"
        else:
            item["status"] = "triaged_no_escalation"

        results.append(item)

    try:
        _persist_pipeline_results(results, hospital_name)
    except Exception as exc:
        raise HTTPException(status_code=500, detail={
            "message": f"Agent run completed but PostgreSQL save failed: {exc}",
            "stage": "database_persistence",
        }) from exc

    investigation_cases = [x for x in results if x.get("agent2") is not None]
    action_plan_cases = [x for x in results if x.get("agent3") is not None]
    return {
        "success": True,
        "mode": "saved_to_postgres",
        "stage_completed": "agent1_agent2_agent3",
        "hospital_name": hospital_name,
        "requested_review_count": target_count,
        "reviews_found": len(reviews[:target_count]),
        "processed_by_agent1": len(results),
        "investigation_cases": len(investigation_cases),
        "action_plan_cases": len(action_plan_cases),
        "agent2_failures": sum(1 for x in results if x.get("status") == "agent2_failed"),
        "agent3_failures": sum(1 for x in results if x.get("status") == "agent3_failed"),
        "results": results,
        "debug": debug,
        "message": "Reviews and available Agent 1/2/3 results were saved to PostgreSQL. Validate recommendations before acting.",
    }
