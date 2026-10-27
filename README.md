# AegisCare — AI-Powered Healthcare Review Intelligence

> **Turning patient feedback into better care.**

AegisCare is an AI-powered healthcare review intelligence platform designed to help patients explore healthcare providers and help doctors, clinics, and healthcare organizations understand patient experiences.

The platform combines healthcare review data with a multi-agent AI workflow to classify feedback, investigate potential root causes, and generate structured action plans for service improvement.

---

## Table of Contents

- [Project Agenda](#project-agenda)
- [Key Features](#key-features)
- [User Dashboards](#user-dashboards)
  - [Patient Dashboard](#patient-dashboard)
  - [Doctor Dashboard](#doctor-dashboard)
  - [Healthcare Organization Dashboard](#healthcare-organization-dashboard)
- [Multi-Agent AI Workflow](#multi-agent-ai-workflow)
- [System Architecture](#system-architecture)
- [Authentication and User Roles](#authentication-and-user-roles)
- [Privacy and Data Protection](#privacy-and-data-protection)
- [PostgreSQL and Dataset Integration](#postgresql-and-dataset-integration)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [API Overview](#api-overview)
- [Future Enhancements](#future-enhancements)
- [Disclaimer](#disclaimer)

---

## Project Agenda

Healthcare reviews contain valuable information about patient experiences, but feedback is often scattered across platforms and difficult to analyze systematically.

AegisCare aims to bridge the gap between **patient experience and healthcare service improvement** by:

- Helping patients discover healthcare providers using available review information.
- Helping doctors understand feedback about their services.
- Helping healthcare organizations analyze patient experience across doctors, departments, and locations.
- Applying AI to categorize reviews, assess concerns, investigate potential root causes, and suggest improvement actions.
- Supporting data-informed decisions that can improve healthcare quality, accessibility, and trust.

The central objective is to transform unstructured healthcare feedback into meaningful, actionable insights.

---

## Key Features

- Role-based dashboards for patients, doctors, and healthcare organizations.
- Search for doctors, hospitals, clinics, diseases, and medical specializations.
- PostgreSQL-based review retrieval from imported datasets.
- Review sentiment, severity, and category classification.
- AI-powered root-cause analysis.
- Structured corrective and preventive action plans.
- Review analytics and patient-experience insights.
- Google sign-in integration, where configured.
- Dataset import support for Excel and CSV files.
- Review analysis through a multi-agent AI workflow.

---

## User Dashboards

AegisCare is designed around three primary user experiences.

### Patient Dashboard

The patient dashboard helps people explore healthcare providers and make informed decisions based on available information.

**Features**

- Search for doctors, hospitals, and clinics.
- Search by doctor name, disease, condition, or medical specialization.
- Filter results using location and available provider information.
- View available ratings and patient review information.
- Explore patient experiences before choosing a healthcare provider.
- Access a patient-focused interface.

**Patient Journey**

1. Sign up or log in.
2. Search for a doctor, hospital, clinic, disease, or condition.
3. Retrieve matching information from the PostgreSQL database.
4. View available reviews and provider details.
5. Compare information and make an informed decision.

The patient dashboard is intended to support healthcare discovery, not provide medical diagnosis.

### Doctor Dashboard

The doctor dashboard helps healthcare professionals understand feedback associated with their profile or practice.

**Features**

- View reviews associated with the doctor's profile.
- Monitor patient sentiment and review trends.
- Identify recurring concerns and complaint categories.
- Understand potential root causes of negative feedback.
- Review AI-generated corrective and preventive action plans.
- Identify opportunities to improve patient experience.

Doctor accounts should be linked to the appropriate doctor profile through a verification process before access to protected account features is granted.

### Healthcare Organization Dashboard

The organization dashboard supports hospitals, clinics, and healthcare groups that need a broader view of patient experience.

**Features**

- Organization-level review and patient-experience overview.
- Multi-doctor and multi-department insights.
- Review trends across available locations.
- Identify recurring service issues and complaint categories.
- Review root-cause analysis and proposed action plans.
- Support quality-improvement planning and monitoring.

Organization administrators should only be able to access information belonging to their authorized organization.

---

## Multi-Agent AI Workflow

AegisCare uses a multi-agent workflow to transform raw patient reviews into structured insights.

| Agent | Responsibility | Expected Output |
|---|---|---|
| **Agent 1 — Review Triage** | Analyze review sentiment, severity, and complaint category. | Sentiment, severity, category, and triage result |
| **Agent 2 — Root Cause Analysis** | Investigate potential underlying causes and supporting evidence. | Root cause, evidence, and responsible department or role |
| **Agent 3 — Action Planning** | Generate structured improvement recommendations. | Immediate, corrective, and preventive actions; priority; timeline; success metrics |

### Workflow

1. Retrieve matching reviews from the configured data source.
2. Normalize review information for analysis.
3. Agent 1 classifies the review.
4. Agent 2 investigates concerns requiring further analysis.
5. Agent 3 generates a structured action plan.
6. Present the results through the relevant dashboard or review-analysis workflow.

AI-generated insights should be reviewed by an appropriate human before being used for operational or clinical decisions.

---

## System Architecture

The following diagram illustrates the high-level architecture of AegisCare.

```mermaid
flowchart TB

    subgraph Sources["Review and Data Sources"]
        EX["Imported Excel / CSV Datasets"]
        GBP["Google Business Profile API<br/>(where authorized)"]
        MAP["Google Maps / Places<br/>(where configured)"]
    end

    subgraph Ingestion["Data Ingestion and Processing"]
        ING["Dataset Import / Retrieval"]
        CLEAN["Cleaning, Normalization<br/>and Metadata Extraction"]
    end

    subgraph Storage["PostgreSQL Data Layer"]
        DB[("PostgreSQL Database")]
        REV["Reviews and Imported Rows"]
        TRI["Review Triage"]
        ANA["Analysis and Root Cause Results"]
        PLAN["Action Plans"]
    end

    subgraph Backend["AegisCare Backend"]
        API["FastAPI REST API"]
        AUTH["Authentication and<br/>Role-Based Authorization"]
        SEARCH["Review Search and Retrieval"]
        A1["Agent 1<br/>Review Triage"]
        A2["Agent 2<br/>Root Cause Analysis"]
        A3["Agent 3<br/>Action Planning"]
    end

    subgraph Frontend["React Application"]
        PAT["Patient Dashboard"]
        DOC["Doctor Dashboard"]
        ORG["Organization Dashboard"]
        TRY["Review Analysis / Try It"]
    end

    EX --> ING
    GBP --> ING
    MAP --> ING

    ING --> CLEAN
    CLEAN --> DB

    DB --> REV
    DB --> TRI
    DB --> ANA
    DB --> PLAN

    PAT --> API
    DOC --> API
    ORG --> API
    TRY --> API

    API --> AUTH
    AUTH --> SEARCH
    SEARCH <--> DB

    SEARCH --> A1
    A1 --> A2
    A2 --> A3

    A1 --> DB
    A2 --> DB
    A3 --> DB

    API --> PAT
    API --> DOC
    API --> ORG
    API --> TRY
```

### Architecture Overview

- **Frontend:** React provides separate interfaces for patients, doctors, and healthcare organizations.
- **Backend:** FastAPI handles API requests, authentication, authorization, search, and review-analysis workflows.
- **Database:** PostgreSQL stores imported review data and analysis results.
- **AI Workflow:** Multiple agents process reviews, investigate root causes, and propose action plans.
- **Data Sources:** Imported Excel and CSV datasets are supported. External integrations depend on configured credentials, permissions, and API access.

The architecture diagram represents the platform design. Actual API availability and integrations depend on the services configured for the deployment.

---

## Authentication and User Roles

AegisCare is designed to provide different dashboard experiences based on user roles.

### Authentication

Users can authenticate through the application's configured authentication mechanism, such as:

- Email and password authentication.
- Google OAuth sign-in, where configured.

Authentication establishes a user's identity. Authorization determines which resources and actions that user may access.

### Role-Based Access Control

| User Role | Intended Access |
|---|---|
| **Patient** | Patient dashboard, provider search, and publicly available review information |
| **Doctor** | Authorized doctor profile, associated reviews, and doctor-level insights |
| **Organization Admin** | Authorized organization, associated doctors, organization-level analytics, and action plans |

### Doctor and Organization Account Access

Doctor and organization access should follow a verification and authorization process:

1. The user creates an account or signs in.
2. The user selects the appropriate account type.
3. Doctor or organization details are submitted for verification, where required.
4. The account is linked to the appropriate doctor profile or organization.
5. The backend checks the user's role and permissions on protected requests.
6. The user accesses only data and actions permitted for that role.

A frontend dashboard selection alone must never be treated as proof of authorization. Role checks and ownership checks should be enforced by the backend.

---

## Privacy and Data Protection

Privacy and responsible handling of healthcare-related information are important design considerations for AegisCare.

### Privacy Principles

- **Data minimization:** Collect only information needed for the platform's functionality.
- **Access control:** Restrict doctor and organization data to authorized users.
- **Authentication:** Protect account access using the configured authentication system.
- **Credential protection:** Keep database credentials, API keys, and OAuth secrets in environment variables rather than source code.
- **Secure transport:** Use HTTPS in deployed environments.
- **Controlled data access:** Enforce authorization checks in the backend for protected resources.
- **Responsible logging:** Avoid logging passwords, tokens, or unnecessary sensitive information.
- **Review data handling:** Use review data in accordance with source terms, permissions, and applicable requirements.

### Public Reviews and Personal Information

Publicly visible reviews may still contain personal or sensitive information. Public availability should not be treated as unrestricted permission to reuse data.

Where possible:

- Avoid storing unnecessary patient identifiers.
- Do not expose private account details through public endpoints.
- Restrict access to organization-specific analytics.
- Review imported datasets before publishing or sharing them.
- Apply appropriate retention and deletion practices.

### Important Privacy Note

The privacy and security measures described here are design goals and implementation requirements. They are not a claim that the application is already certified or fully compliant with a particular regulation.

Before production deployment, review the implementation against applicable requirements, including relevant Indian data-protection law and any other laws that apply.

---

## PostgreSQL and Dataset Integration

AegisCare supports importing healthcare review datasets from Excel and CSV files into PostgreSQL.

Imported data may include reviews from sources such as Practo, Mouthshut, RateMDs, and other datasets, subject to applicable data permissions.

### Dataset Import Workflow

```mermaid
flowchart LR

    FILES["Excel / CSV Files"]
    SCRIPT["Bulk Import Script"]
    PROCESS["Read, Clean and Normalize"]
    DB[("PostgreSQL<br/>Imported Dataset Rows")]
    SEARCH["Dataset Search API"]
    ANALYSIS["AI Review Analysis"]
    RESULTS["Dashboard Results"]

    FILES --> SCRIPT
    SCRIPT --> PROCESS
    PROCESS --> DB
    DB --> SEARCH
    SEARCH --> ANALYSIS
    ANALYSIS --> RESULTS
```

### Import Script

The bulk import script used in the current workflow is:

```text
bulk_import_database.py
```

The staging table used by the import workflow is:

```text
public.imported_dataset_rows
```

Run the import script after configuring the dataset directory and PostgreSQL connection:

```bash
python bulk_import_database.py
```

The script's behavior depends on its configured root directory, database connection, and supported file formats.

---

## Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | React.js, JavaScript, Vite, CSS |
| Backend | Python, FastAPI |
| Database | PostgreSQL |
| Database Access | SQLAlchemy |
| Data Processing | Pandas, NumPy |
| AI Workflow | Multi-agent review triage, root-cause analysis, and action planning |
| Authentication | Google OAuth / configured authentication |
| Data Sources | Imported Excel / CSV datasets; Google integrations where configured |

---

## Project Structure

Example project structure:

```text
AegisCare/
│
├── api.py
├── bulk_import_database.py
├── requirements.txt
├── .env
├── README.md
│
└── aegiscare/
    ├── package.json
    ├── index.html
    └── src/
        ├── App.jsx
        ├── main.jsx
        └── ...
```

The actual structure may vary depending on the current implementation.

---

## Getting Started

### Prerequisites

- Python 3.11 or a compatible version supported by the project.
- Node.js and npm.
- PostgreSQL.
- Git.

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/AegisCare.git
cd AegisCare
```

Replace `YOUR_USERNAME` with your GitHub username.

### 2. Set Up the Backend

Create a virtual environment:

```bash
python -m venv venv
```

Activate it on Windows PowerShell:

```powershell
.\venv\Scripts\Activate.ps1
```

Install dependencies:

```bash
pip install -r requirements.txt
```

### 3. Configure Environment Variables

Create a `.env` file in the backend directory.

Example:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/aegis

GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

FRONTEND_URL=http://localhost:5173
```

Use the variable names expected by the backend code. The values above are placeholders.

**Never commit real credentials, API keys, OAuth secrets, or database passwords to GitHub.**

### 4. Start the Backend

```bash
uvicorn api:app --reload --host 0.0.0.0 --port 8000
```

Backend URL:

```text
http://localhost:8000
```

FastAPI documentation:

```text
http://localhost:8000/docs
```

### 5. Set Up the Frontend

Open a separate terminal:

```bash
cd aegiscare
npm install
npm run dev
```

Frontend URL:

```text
http://localhost:5173
```

---

## API Overview

The review-analysis workflow uses the following endpoint:

```http
POST /api/hospital/run-pipeline
```

Example doctor-search request:

```json
{
  "source": "dataset",
  "provider_type": "doctor",
  "doctor_name": "Dr. Abhishek",
  "location": "Bangalore",
  "review_count": 20
}
```

Example disease or specialization request:

```json
{
  "source": "dataset",
  "provider_type": "disease",
  "disease_query": "Gastroenterology",
  "location": "Bangalore",
  "review_count": 20
}
```

The exact request fields and response format should be verified against the current FastAPI request models.

---

## Future Enhancements

- Enhanced patient search and provider comparison.
- Improved doctor and organization verification workflows.
- Advanced city-wise and specialization-wise review analytics.
- Review trend dashboards and root-cause visualizations.
- Action-plan approval and progress tracking.
- Organization-level access management.
- Improved search normalization and spelling correction.
- Additional review-source integrations, subject to API access and data permissions.
- Stronger privacy, security, and audit controls for production deployment.

---

## Disclaimer

AegisCare is a healthcare review intelligence and service-improvement platform. It is not a medical diagnosis system and does not replace professional medical advice.

AI-generated classifications, root-cause analyses, and action plans may be incomplete or incorrect. Healthcare organizations should review AI-generated recommendations before acting on them.

---

## Project

**AegisCare — AI-Powered Healthcare Review Intelligence**

*Turning patient feedback into better care.*


