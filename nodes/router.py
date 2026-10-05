import os
from typing import Literal

from dotenv import load_dotenv
from pydantic import BaseModel, Field
from langchain_groq import ChatGroq

load_dotenv()


# =========================================================
# GROQ API KEY
# =========================================================

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY not found in .env")


# =========================================================
# AGENT 1 OUTPUT SCHEMA
# =========================================================

class TriageResult(BaseModel):

    sentiment: Literal[
        "positive",
        "neutral",
        "mixed",
        "negative"
    ] = Field(
        description="Sentiment of the individual review"
    )

    severity: int = Field(
        ge=1,
        le=5,
        description="Severity of the issue described in the review"
    )

    category: Literal[
        "wait_time",
        "staff_behavior",
        "doctor_communication",
        "treatment_outcome",
        "billing_cost",
        "cleanliness_facility",
        "appointment_process",
        "service_quality",
        "other"
    ] = Field(
        description="Primary issue category"
    )

    summary: str = Field(
        description="Short factual summary of the review"
    )


# =========================================================
# GROQ LLM
# =========================================================

llm = ChatGroq(
    model="openai/gpt-oss-120b",
    groq_api_key=GROQ_API_KEY,
    temperature=0
)


# =========================================================
# STRUCTURED OUTPUT
# =========================================================

structured_llm = llm.with_structured_output(TriageResult)


# =========================================================
# AGENT 1 PROMPT
# =========================================================

TRIAGE_PROMPT = """
You are Agent 1 of AegisCare AI.

Your task is to analyze ONE individual healthcare review.

You have two important inputs:

1. REVIEW TEXT
2. DOCTOR OVERALL RATING

Use the REVIEW TEXT as the PRIMARY evidence.

Use the DOCTOR OVERALL RATING as SUPPORTING CONTEXT.

IMPORTANT:

The Overall Rating represents the doctor's overall rating
across reviews. It is NOT necessarily the rating given by
this individual reviewer.

Therefore:

- Do NOT assume a 5.0 Overall Rating means this individual
  review is positive.
- Do NOT assume a low Overall Rating means this individual
  review is negative.
- Analyze the actual Review Text first.
- Use Overall Rating only as additional context when
  evaluating the overall situation.


DETERMINE:

1. Sentiment
2. Severity from 1 to 5
3. Primary complaint category
4. Short factual summary


SEVERITY SCALE:

1 = Positive review / no meaningful problem

2 = Very minor issue

3 = Moderate issue requiring attention

4 = Serious issue requiring investigation

5 = Very serious issue requiring urgent investigation


CATEGORIES:

- wait_time
- staff_behavior
- doctor_communication
- treatment_outcome
- billing_cost
- cleanliness_facility
- appointment_process
- service_quality
- other


RULES:

- Base the analysis primarily on the individual Review Text.
- Consider the Doctor Overall Rating as supporting context.
- Never treat Overall Rating as the rating of this individual review.
- Do not invent facts.
- Do not infer medical conditions that are not explicitly stated.
- If the review is clearly positive, classify sentiment as positive.
- If the review contains a clear complaint, identify it.
- If multiple complaints exist, select the primary issue.
- Severity should reflect how serious the issue described in
  the review is.
- Keep the summary concise and factual.
- Do not include the reviewer's name.
- Do not include unnecessary personal information.
- Do not decide the archive/investigation route.
  The application determines routing separately.


DOCTOR:
{doctor_name}

SPECIALTY:
{specialty}

DOCTOR OVERALL RATING:
{overall_rating}

REVIEW:
{review}
"""


# =========================================================
# RUN AGENT 1
# =========================================================

def run_agent1(
    review: str,
    doctor_name: str,
    specialty: str,
    overall_rating
) -> TriageResult:

    prompt = TRIAGE_PROMPT.format(
        review=review,
        doctor_name=doctor_name,
        specialty=specialty,
        overall_rating=overall_rating
    )

    result = structured_llm.invoke(prompt)

    return result


# =========================================================
# ROUTING LOGIC
# =========================================================

def get_route(
    sentiment: str,
    severity: int
) -> str:

    # Send the review for investigation when:
    # 1. The review is negative
    # OR
    # 2. The issue has severity >= 3

    if sentiment == "negative" or severity >= 3:
        return "investigation"

    return "archive"