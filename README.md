🏥 AegisCare — AI-Powered Healthcare Review Intelligence
> **Turning patient feedback into better care.**
AegisCare is an AI-powered healthcare review intelligence platform designed to help patients explore healthcare providers and help doctors, clinics, and healthcare organizations understand patient experiences.
It combines healthcare review data with a multi-agent AI workflow to classify feedback, investigate potential root causes, and generate structured action plans for service improvement.
---
📌 Project Agenda
Healthcare reviews contain valuable information about patient experiences, but feedback can be scattered across platforms and difficult to analyze systematically.
AegisCare aims to bridge the gap between patient experience and healthcare service improvement by:
Helping patients discover doctors and healthcare facilities using available review information.
Helping doctors understand feedback about their services and identify improvement opportunities.
Helping healthcare organizations analyze patient experience across doctors, departments, and locations.
Applying AI to categorize reviews, assess concerns, investigate potential root causes, and suggest improvement actions.
Supporting data-informed decisions that can improve healthcare quality, accessibility, and trust.
AegisCare supports healthcare quality improvement. It is not a substitute for professional medical advice, diagnosis, or treatment.
---
👥 User Dashboards
AegisCare is designed around three user experiences: patients, doctors, and healthcare organizations.
🧑 Patient Dashboard
The patient dashboard helps people explore healthcare providers and make informed decisions based on available information.
Features:
Search for doctors, hospitals, and clinics.
Search by doctor name, healthcare facility, disease, or medical specialization.
Narrow results using location and available provider information.
View available ratings and patient review information.
Explore patient experiences before choosing a healthcare provider.
Access a patient-focused experience.
Patient journey:
Sign up or log in.
Search for a doctor, hospital, clinic, disease, or condition.
Review matching providers and available feedback.
Compare information and make an informed decision.
Patients should consult qualified healthcare professionals for medical decisions.
🩺 Doctor Dashboard
The doctor dashboard is intended to help healthcare professionals understand feedback associated with their profile or practice.
Features:
View available reviews associated with the doctor.
Monitor patient sentiment and review trends.
Identify recurring concerns and complaint categories.
Understand potential root causes of negative feedback.
Review AI-generated corrective and preventive action plans.
Track opportunities to improve patient experience.
Doctor accounts should be linked to the appropriate doctor profile through a verification process before access to private account features is granted.
🏥 Healthcare Organization Dashboard
The organization dashboard supports hospitals, clinics, and healthcare groups that need a broader view of patient experience.
Features:
Organization-level review and patient-experience overview.
Multi-doctor and multi-department insights.
Review trends across available locations.
Identify recurring service issues and complaint categories.
Review root-cause analysis and proposed action plans.
Support quality-improvement planning and monitoring.
Organization administrators should only be able to access data belonging to their authorized organization.
---
🧠 Multi-Agent AI Workflow
AegisCare uses a sequential review-analysis workflow.
Agent	Role	Expected output
Agent 1 — Review Triage	Analyze review sentiment, severity, and complaint category.	Sentiment, severity, category, triage result
Agent 2 — Root Cause Analysis	Investigate potential underlying causes and supporting evidence.	Root cause, evidence, department or responsible role
Agent 3 — Action Planning	Generate structured improvement recommendations.	Immediate, corrective, and preventive actions; priority; timeline; success metrics
Workflow:
Retrieve matching review records from a configured source.
Normalize review information for analysis.
Agent 1 classifies the review.
Agent 2 investigates concerns requiring further analysis.
Agent 3 proposes an action plan.
Present results through the relevant dashboard or review-analysis workflow.
AI-generated insights should be reviewed by an appropriate human before being used for operational or clinical decisions.
---
🏗️ System Architecture
GitHub renders this Mermaid diagram directly in the README.
```mermaid
flowchart TB
    subgraph Sources["Review and Data Sources"]
        EX["Imported Excel / CSV datasets"]
        GBP["Google Business Profile API<br/>(where authorized)"]
        MAP["Google Maps / Places<br/>(where configured)"]
    end

    subgraph Ingestion["Data Ingestion and Processing"]
        ING["Dataset Import / Retrieval"]
        CLEAN["Cleaning, Normalization<br/>and Metadata Extraction"]
    end

    subgraph Storage["Data Layer"]
        DB[("PostgreSQL Database")]
        REV["Reviews and Imported Rows"]
        TRI["Review Triage"]
        ANA["Analysis / Root Cause Results"]
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
Architecture note: This diagram represents the platform design. Actual API availability, authentication configuration, and data-source integrations depend on the services and credentials configured for the deployment.
---
🔐 Authentication and User Roles
AegisCare is designed to provide different dashboard experiences based on user roles.
Authentication
Users can authenticate through the application's configured authentication mechanism, such as:
Email and password authentication.
Google OAuth sign-in, where configured.
Authentication establishes a user's identity. Authorization determines which resources and actions that user may access.
Role-Based Access Control
User role	Intended access
Patient	Patient dashboard, provider search, and publicly available review information
Doctor	Authorized doctor profile, associated reviews, and doctor-level insights
Organization Admin	Authorized organization, associated doctors, organization-level analytics, and action plans
Doctor and Organization Account Access
Doctor and organization access should follow a verification and authorization process:
The user creates an account or signs in.
The user selects the appropriate account type.
Doctor or organization details are submitted for verification, where required.
The account is linked to the appropriate doctor profile or organization.
The backend checks the user's role and permissions on protected requests.
The user accesses only data and actions permitted for that role.
A frontend dashboard selection alone must never be treated as proof of authorization. Role checks and ownership checks should be enforced by the backend.
---
🛡️ Privacy and Data Protection
Privacy and responsible handling of healthcare-related information are important design considerations for AegisCare.
Privacy Principles
Data minimization: Collect only information needed for the platform's functionality.
Access control: Restrict doctor and organization data to authorized users.
Authentication: Protect account access using the configured authentication system.
Credential protection: Keep database credentials, API keys, and OAuth secrets in environment variables rather than source code.
Secure transport: Use HTTPS in deployed environments.
Controlled data access: Enforce authorization checks in the backend for protected resources.
Responsible logging: Avoid logging passwords, tokens, or unnecessary sensitive information.
Review data handling: Use review data in accordance with source terms, permissions, and applicable requirements.
Public Reviews and Personal Information
Publicly visible reviews may still contain personal or sensitive information. Public availability should not be treated as unrestricted permission to reuse data.
Where possible:
Avoid storing unnecessary patient identifiers.
Do not expose private account details through public endpoints.
Restrict access to organization-specific analytics.
Review imported datasets before publishing or sharing them.
Apply appropriate retention and deletion practices.
Important Privacy Note
The privacy and security measures described here are design goals and implementation requirements. They are not a claim that the application is already certified or fully compliant with a particular regulation.
Before production deployment, review the implementation against applicable requirements, including relevant Indian data-protection law and any other laws that apply.
---
🗄️ PostgreSQL and Imported Datasets
AegisCare supports importing healthcare review datasets from Excel and CSV files into PostgreSQL.
Imported data may include reviews from sources such as Practo, Mouthshut, RateMDs, and other datasets, subject to applicable data permissions.
Imported Dataset Workflow
```mermaid
flowchart LR
    FILES["Excel / CSV Files"] --> SCRIPT["Bulk Import Script"]
    SCRIPT --> PROCESS["Read, Clean and Normalize"]
    PROCESS --> STAGING[("PostgreSQL<br/>Imported Dataset Rows")]
    STAGING --> SEARCH["Dataset Search API"]
    SEARCH --> ANALYSIS["AI Review Analysis"]
    ANALYSIS --> RESULTS["Dashboard Results"]
```
The imported dataset table used by the current import workflow is:
```text
public.imported_dataset_rows
```
The import script is:
```text
bulk_import_database.py
```
Run the script after configuring the dataset directory and PostgreSQL connection:
```bash
python bulk_import_database.py
```
The script's behavior depends on its configured root directory, database connection, and supported file formats.
---
🛠️ Technology Stack
Layer	Technologies
Frontend	React.js, JavaScript, Vite, CSS
Backend	Python, FastAPI
Database	PostgreSQL
ORM / Database Access	SQLAlchemy
Data Processing	Pandas, NumPy
AI Workflow	Multi-agent review triage, root-cause analysis, and action planning
Authentication	Google OAuth / configured authentication
Data Sources	Imported Excel / CSV datasets; Google integrations where configured
---
📂 Project Structure
Example structure (adjust to match the repository):
```text
AegisCare/
├── api.py
├── bulk_import_database.py
├── requirements.txt
├── .env
├── README.md
└── aegiscare/
    ├── package.json
    ├── index.html
    └── src/
        ├── App.jsx
        ├── main.jsx
        └── ...
```
---
🚀 Getting Started
Prerequisites
Python 3.11 or a compatible version supported by the project.
Node.js and npm.
PostgreSQL.
Git.
1. Clone the Repository
```bash
git clone https://github.com/YOUR_USERNAME/AegisCare.git
cd AegisCare
```
Replace `YOUR_USERNAME` with your GitHub username.
2. Set Up the Backend
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
3. Configure Environment Variables
Create a `.env` file in the backend directory. Example:
```env
DATABASE_URL=postgresql://username:password@localhost:5432/aegis

GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

FRONTEND_URL=http://localhost:5173
```
Use the variable names expected by the backend code. The values above are placeholders.
Never commit real credentials, API keys, OAuth secrets, or database passwords to GitHub.
4. Start the Backend
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
5. Set Up the Frontend
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
🔌 Review Analysis API
The review-analysis workflow uses this endpoint:
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
🔮 Future Enhancements
Enhanced patient search and provider comparison.
Improved doctor and organization verification workflows.
Advanced city-wise and specialization-wise review analytics.
Review trend dashboards and root-cause visualizations.
Action-plan approval and progress tracking.
Organization-level access management.
Improved search normalization and spelling correction.
Additional review-source integrations, subject to API access and data permissions.
Stronger privacy, security, and audit controls for production deployment.
---
⚠️ Disclaimer
AegisCare is a healthcare review intelligence and service-improvement platform. It is not a medical diagnosis system and does not replace professional medical advice.
AI-generated classifications, root-cause analyses, and action plans may be incomplete or incorrect. Healthcare organizations should review AI-generated recommendations before acting on them.
---
👩‍💻 Project
AegisCare — AI-Powered Healthcare Review Intelligence
Turning patient feedback into better care.
---
📄 License
Add a license after deciding how the source code and datasets may be used and distributed. Do not include third-party datasets in the repository unless their terms permit redistribution.
