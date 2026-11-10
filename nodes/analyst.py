import os
from typing import Any

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
# AGENT 2 OUTPUT
# =========================================================

class AnalysisResult(BaseModel):

    root_cause: str = Field(
        description="Most likely underlying cause of the complaint"
    )

    evidence: str = Field(
        description="Facts from the review and available data supporting the root cause"
    )

    department: str = Field(
        description="Hospital department or function responsible for addressing the issue"
    )

    lead: str = Field(
        description="Responsible role or lead. Do not invent a person's name if no roster data exists"
    )

    confidence: float = Field(
        ge=0.0,
        le=1.0,
        description="Confidence in the root cause assessment from 0 to 1"
    )

    metrics: str = Field(
        description="Important quantitative metrics supporting the analysis"
    )


# =========================================================
# GROQ
# =========================================================

llm = ChatGroq(
    model="openai/gpt-oss-120b",
    groq_api_key=GROQ_API_KEY,
    temperature=0
)

structured_llm = llm.with_structured_output(
    AnalysisResult
)


# =========================================================
# AGENT 2 PROMPT
# =========================================================

ANALYST_PROMPT = """
You are Agent 2 of AegisCare AI.

Your job is to investigate a complaint that Agent 1
has already classified as requiring investigation.

Agent 1 has already identified:
- sentiment
- severity
- category
- summary

DO NOT redo Agent 1's job.

Your task is to determine:

1. ROOT CAUSE
   Identify the most likely underlying reason for the complaint.

2. EVIDENCE
   Separate actual facts from assumptions.
   Use the review text and available metrics.

3. DEPARTMENT
   Identify the hospital department or operational function
   that should handle the issue.

4. LEAD
   Identify the responsible ROLE.
   Do NOT invent a person's name because no staff roster is
   currently available.

5. CONFIDENCE
   Give a confidence score between 0 and 1.
   Lower the confidence when evidence is insufficient.

6. METRICS
   Report useful quantitative metrics provided to you.

IMPORTANT:

- Do not invent operational data.
- Do not claim that a root cause is confirmed unless the
  available evidence actually confirms it.
- Clearly distinguish evidence from inference.
- If evidence is insufficient, explicitly say so.
- Use the original review as the primary source.
- Agent 1's category and severity are supporting context.
- Do not include reviewer names.
- Do not expose unnecessary personal information.
- Keep the output concise and factual.


AGENT 1 ANALYSIS:

Sentiment:
{sentiment}

Severity:
{severity}

Category:
{category}

Summary:
{summary}


DOCTOR INFORMATION:

Doctor:
{doctor_name}

Specialty:
{specialty}

Clinic:
{clinic}

Doctor Overall Rating:
{overall_rating}


ORIGINAL REVIEW:

{review}


METRICS FROM DATABASE:

{metrics}
"""


# =========================================================
# RUN AGENT 2
# =========================================================

def run_agent2(
    review: str,
    doctor_name: str,
    specialty: str,
    clinic: str,
    overall_rating: Any,
    sentiment: str,
    severity: int,
    category: str,
    summary: str,
    metrics: str
) -> AnalysisResult:

    prompt = ANALYST_PROMPT.format(
        review=review,
        doctor_name=doctor_name,
        specialty=specialty,
        clinic=clinic,
        overall_rating=overall_rating,
        sentiment=sentiment,
        severity=severity,
        category=category,
        summary=summary,
        metrics=metrics
    )

    result = structured_llm.invoke(prompt)

    return result