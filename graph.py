from typing import TypedDict

from langgraph.graph import StateGraph, START, END

from nodes.router import run_agent1, get_route


class AgentState(TypedDict, total=False):

    review_id: int

    doctor_name: str
    specialty: str
    overall_rating: float
    review: str

    sentiment: str
    severity: int
    category: str
    summary: str

    route: str


def agent1_node(state: AgentState):

    result = run_agent1(
        review=state["review"],
        doctor_name=state["doctor_name"],
        specialty=state["specialty"],
        overall_rating=state["overall_rating"]
    )

    route = get_route(
        sentiment=result.sentiment,
        severity=result.severity
    )

    return {
        "sentiment": result.sentiment,
        "severity": result.severity,
        "category": result.category,
        "summary": result.summary,
        "route": route
    }


def investigation_node(state: AgentState):

    print(
        f"\nReview {state['review_id']} -> INVESTIGATION"
    )

    print(f"Doctor   : {state['doctor_name']}")
    print(f"Sentiment: {state['sentiment']}")
    print(f"Severity : {state['severity']}")
    print(f"Category : {state['category']}")

    return {}


def archive_node(state: AgentState):

    print(
        f"\nReview {state['review_id']} -> ARCHIVE"
    )

    return {}


def route_after_agent1(state: AgentState):

    if state["route"] == "investigation":
        return "investigation"

    return "archive"


builder = StateGraph(AgentState)

builder.add_node(
    "agent1",
    agent1_node
)

builder.add_node(
    "investigation",
    investigation_node
)

builder.add_node(
    "archive",
    archive_node
)

builder.add_edge(
    START,
    "agent1"
)

builder.add_conditional_edges(
    "agent1",
    route_after_agent1,
    {
        "investigation": "investigation",
        "archive": "archive"
    }
)

builder.add_edge(
    "investigation",
    END
)

builder.add_edge(
    "archive",
    END
)

graph = builder.compile()