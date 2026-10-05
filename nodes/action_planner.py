import os
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from langchain_groq import ChatGroq

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY not found in .env")


class ActionPlanResult(BaseModel):

    priority: str = Field(
        description="Priority of the action: low, medium, high, or critical"
    )

    objective: str = Field(
        description="Main objective for improving the identified issue"
    )

    immediate_actions: str = Field(
        description="Actions that should be taken immediately"
    )

    corrective_actions: str = Field(
        description="Actions that address the underlying problem"
    )

    preventive_actions: str = Field(
        description="Actions that prevent the issue from recurring"
    )

    owner_role: str = Field(
        description="Role responsible for executing the action plan"
    )

    timeline: str = Field(
        description="Recommended implementation timeline"
    )

    success_metrics: str = Field(
        description="Measurable indicators that can be used to determine whether the intervention worked"
    )


llm = ChatGroq(
    model="openai/gpt-oss-120b",
    groq_api_key=GROQ_API_KEY,
    temperature=0
)

structured_llm = llm.with_structured_output(ActionPlanResult)


ACTION_PLAN_PROMPT = """
You are Agent 3 of AegisCare AI.

Your job is to convert the investigation performed by Agent 2
into a practical hospital improvement action plan.

DO NOT redo the review analysis.

DO NOT invent facts, staff names, policies, or operational data.

Use Agent 2's findings as the primary input.

Your action plan must answer:

1. What should the hospital improve?
2. What should be done immediately?
3. What corrective action addresses the root cause?
4. What preventive action reduces recurrence?
5. Who should own the intervention?
6. How quickly should it be implemented?
7. How will success be measured?

IMPORTANT:

- Base recommendations on the identified root cause.
- Do not claim that an action has already been implemented.
- Do not invent numerical targets unless they are clearly
  presented as recommended targets.
- Use roles rather than employee names.
- Keep recommendations realistic for a hospital environment.
- Prioritize patient experience and operational improvement.
- If evidence is weak, recommend validation before major intervention.
- Keep the output concise and actionable.

AGENT 2 INVESTIGATION

Doctor:
{doctor_name}

Specialty:
{specialty}

Clinic:
{clinic}

Root Cause:
{root_cause}

Evidence:
{evidence}

Department:
{department}

Responsible Lead Role:
{lead}

Confidence:
{confidence}

Metrics:
{metrics}
"""


def run_agent3(
    doctor_name: str,
    specialty: str,
    clinic: str,
    root_cause: str,
    evidence: str,
    department: str,
    lead: str,
    confidence: float,
    metrics: str
) -> ActionPlanResult:

    prompt = ACTION_PLAN_PROMPT.format(
        doctor_name=doctor_name,
        specialty=specialty,
        clinic=clinic,
        root_cause=root_cause,
        evidence=evidence,
        department=department,
        lead=lead,
        confidence=confidence,
        metrics=metrics
    )

    result = structured_llm.invoke(prompt)

    return result