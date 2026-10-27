import React, { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

/* =====================================================================
   PLACEHOLDERS: swap these for real API calls.
   Dashboard numbers are computed from the review data below, so
   nothing is typed into the components by hand.
   ===================================================================== */
const API = {
  // IMPORTANT: use "localhost" (same host as the frontend) so the session cookie is sent.
  baseUrl: "http://localhost:8000/api",
  endpoints: {
    dashboard: "/dashboard",
    reviews: "/reviews",
    investigations: "/investigations",
    actionPlans: "/action-plans",
  },
};
const PLACEHOLDER = {
  totalReviewsMonitored: 0, // TODO: GET /reviews/count (0 = use sample data count)
  trend: [0, 0, 0, 0, 0, 0, 0], // TODO: weekly negative-review counts (all zeros = show sample series)
  contact: { email: "hello@your-domain.com", phone: "+91 00000 00000", address: "Your address, City, Country", hours: "Monday to Friday, 9:00 to 18:00" },
};
const TREND_LABELS = ["6w ago", "5w", "4w", "3w", "2w", "Last wk", "This wk"];

function applyTheme(theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const resolved = theme === "system"
    ? (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")
    : theme;
  root.setAttribute("data-theme", resolved || "dark");
}

const THEME_CSS = `
:root[data-theme="light"] {
  --bg: #f7f4f8 !important;
  --surface: #ffffff !important;
  --surface-2: #f2edf4 !important;
  --line: #ddd5e3 !important;
  --text: #2b2630 !important;
  --muted: #716a79 !important;
  --brand: #a34e9d !important;
  --ok: #3d8b68 !important;
  --warn: #b17b2d !important;
  --crit: #c75d57 !important;
}
:root[data-theme="dark"] {
  --bg: #120d15 !important;
  --surface: #1c1520 !important;
  --surface-2: #241b28 !important;
  --line: #352a3b !important;
  --text: #f2ebf4 !important;
  --muted: #b8aebe !important;
  --brand: #d28bc9 !important;
  --ok: #82c89f !important;
  --warn: #e0b15b !important;
  --crit: #e38d7f !important;
}
:root[data-theme="light"] body,
:root[data-theme="light"] .app { background: var(--bg) !important; color: var(--text) !important; }
:root[data-theme="dark"] body,
:root[data-theme="dark"] .app { background: var(--bg) !important; color: var(--text) !important; }
body, .app, .main { color: var(--text) !important; }
.side, .panel, .toolbar, .decision, .tabs, .home-hero > div, .three > div {
  background: var(--surface) !important;
  border-color: var(--line) !important;
  color: var(--text) !important;
}
.side { background: var(--surface) !important; }
.f, select, textarea, input {
  background: var(--surface) !important;
  color: var(--text) !important;
  border-color: var(--line) !important;
}
.f::placeholder, input::placeholder, textarea::placeholder { color: var(--muted) !important; }
.nav, .brand, .grp, .sys, .muted, .small, .phead p, .lead, .d, .n { color: var(--muted) !important; }
.nav.on { background: color-mix(in srgb, var(--brand) 18%, transparent) !important; color: var(--brand) !important; }
.seg button, .tabs button, .btn { color: var(--text) !important; border-color: var(--line) !important; background: var(--surface) !important; }
.seg button.on, .tabs button.on, .btn.pri { background: var(--brand) !important; color: #fff !important; border-color: var(--brand) !important; }
.rowline, th, td { border-color: var(--line) !important; }
.link { color: var(--brand) !important; }
.kpi .v, h1, h2, h3, h4, b, strong, .ph2 { color: var(--text) !important; }
@media (prefers-color-scheme: light) {
  :root:not([data-theme]) {
    --bg: #f7f4f8; --surface: #fff; --surface-2: #f2edf4; --line: #ddd5e3; --text: #2b2630; --muted: #716a79;
  }
}
`;

const CAT = {
  "Wait Time": "#4a86c5", "Staff Behavior": "#c4627a", "Doctor Communication": "#8d7bbd",
  "Billing": "#cf8f3a", "Service Quality": "#b0715a", "Cleanliness": "#8c9aa2",
};

const SAMPLE_REVIEWS = [
  {
    id: "AC-024", doctor: "Dr. Abhilasha", specialty: "Dermatology", clinic: "Apollo Clinic", source: "Practo", date: "2 days ago", sentiment: "Negative", severity: 4, category: "Wait Time", route: "Investigation",
    text: "I had to wait almost two hours before the consultation. The doctor was good, but the waiting time was extremely frustrating.",
    rootCause: "Possible OPD scheduling and peak-hour capacity bottleneck.", evidence: "The patient reported nearly two hours of waiting. Other wait-time complaints are linked to this doctor.",
    department: "OPD Operations", lead: "OPD Operations Manager", confidence: 0.82,
    response: "Thank you for sharing your experience. We understand that long waits are frustrating, and we are reviewing our appointment scheduling so visits start closer to the booked time.",
    actions: ["Review peak-hour appointment allocation", "Analyze OPD waiting-time patterns", "Review staffing during high-volume periods"], status: "pending"
  },
  {
    id: "AC-019", doctor: "Dr. Rahul Mehta", specialty: "Cardiology", clinic: "Manipal Hospital", source: "Google Maps", date: "3 days ago", sentiment: "Negative", severity: 3, category: "Staff Behavior", route: "Investigation",
    text: "The doctor was helpful, but the front desk staff were not very responsive and made the appointment process difficult.",
    rootCause: "Potential front-desk service quality issue.", evidence: "The review mentions unresponsive front-desk staff and a difficult appointment process.",
    department: "Patient Services", lead: "Patient Experience Manager", confidence: 0.88,
    response: "Thank you for your feedback. We are sorry the booking process was difficult and have shared your comments with our front-desk team.",
    actions: ["Review front-desk response times", "Run a short service refresher", "Add an online booking-help option"], status: "pending"
  },
  {
    id: "AC-011", doctor: "Dr. Priya Sharma", specialty: "General Medicine", clinic: "Cloudnine", source: "Practo", date: "4 days ago", sentiment: "Positive", severity: 1, category: "Service Quality", route: "Archive",
    text: "Very professional and helpful. The consultation was smooth and the doctor explained everything clearly.",
    rootCause: "No investigation required.", evidence: "The patient describes the consultation as professional, smooth and clear.",
    department: "General Medicine", lead: "Not required", confidence: 0.95,
    response: "Thank you for the kind words. We are glad your consultation went smoothly.", actions: ["Share the praise with the care team"], status: "archived"
  },
  {
    id: "AC-031", doctor: "Dr. Sneha Rao", specialty: "Dermatology", clinic: "Aster CMI", source: "Lybrate", date: "1 week ago", sentiment: "Negative", severity: 3, category: "Doctor Communication", route: "Investigation",
    text: "The treatment was explained very quickly and I had several questions after leaving the clinic.",
    rootCause: "Potential consultation communication gap.", evidence: "The patient says the explanation was brief and left questions unanswered.",
    department: "Clinical Quality", lead: "Clinical Quality Lead", confidence: 0.79,
    response: "Thank you for telling us. Every patient should leave with clear answers, and we will follow up so your questions are addressed.",
    actions: ["Add a post-visit Q&A message", "Review consultation time slots", "Provide written treatment summaries"], status: "pending"
  },
  {
    id: "AC-036", doctor: "Dr. Abhilasha", specialty: "Dermatology", clinic: "Apollo Clinic", source: "Google Maps", date: "1 week ago", sentiment: "Negative", severity: 5, category: "Wait Time", route: "Investigation",
    text: "Appointment was at 11 but I was seen after 1 pm. No one told us about the delay.",
    rootCause: "Delays are not communicated to waiting patients.", evidence: "Second wait-time complaint for this doctor this month, plus a communication failure.",
    department: "OPD Operations", lead: "OPD Operations Manager", confidence: 0.86,
    response: "We apologise for the delay and for not keeping you informed. We are introducing live wait updates for waiting patients.",
    actions: ["Introduce live wait-time updates", "Notify patients by SMS when running late"], status: "pending"
  },
  {
    id: "AC-040", doctor: "Dr. Kavita Nair", specialty: "Gynaecology", clinic: "Cloudnine", source: "Facebook", date: "2 weeks ago", sentiment: "Negative", severity: 2, category: "Billing", route: "Investigation",
    text: "The final bill had charges that were not mentioned earlier. It was confusing to understand.",
    rootCause: "Estimates and final bills are not aligned.", evidence: "The patient reports unexpected charges and an unclear bill.",
    department: "Billing", lead: "Billing Supervisor", confidence: 0.74,
    response: "Thank you for raising this. Our billing team will contact you to walk through each charge.",
    actions: ["Provide itemised estimates upfront", "Review the billing explanation process"], status: "approved"
  },
];

/* keyword rules for the Home demo; replace with a call to your Agent 1 endpoint */
function demoTriage(text) {
  const t = text.toLowerCase();
  const neg = ["wait", "rude", "delay", "bad", "slow", "late", "charged", "expensive", "unresponsive", "frustrat", "dirty", "confus"].filter(w => t.includes(w)).length;
  const pos = ["great", "good", "helpful", "professional", "excellent", "clear", "kind", "smooth"].filter(w => t.includes(w)).length;
  const sentiment = neg > pos ? "Negative" : pos > neg ? "Positive" : "Neutral";
  let category = "Service Quality";
  if (/wait|delay|late|hour/.test(t)) category = "Wait Time";
  else if (/front desk|staff|rude|reception/.test(t)) category = "Staff Behavior";
  else if (/explain|question|listen/.test(t)) category = "Doctor Communication";
  else if (/bill|charge|price|expensive/.test(t)) category = "Billing";
  else if (/dirty|clean|hygien/.test(t)) category = "Cleanliness";
  const severity = sentiment === "Negative" ? Math.min(5, 2 + neg) : 1;
  return { sentiment, category, severity, route: sentiment === "Negative" ? "Investigation" : "Archive" };
}


/* ----------------------------- live data ------------------------------ */

function formatCategory(value) {
  if (!value) return "Service Quality";
  const s = String(value).trim().toLowerCase();
  const map = {
    "wait time": "Wait Time",
    "waiting time": "Wait Time",
    "staff behavior": "Staff Behavior",
    "staff_behaviour": "Staff Behavior",
    "doctor communication": "Doctor Communication",
    "communication": "Doctor Communication",
    billing: "Billing",
    "service quality": "Service Quality",
    cleanliness: "Cleanliness",
    clean: "Cleanliness",
  };
  return map[s] || String(value).replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function firstValue(obj, keys, fallback = "") {
  for (const key of keys) {
    if (obj && obj[key] !== undefined && obj[key] !== null && obj[key] !== "") {
      return obj[key];
    }
  }
  return fallback;
}

function normalizeActionPlans(rows = []) {
  const list = getRows(rows, [
    "action_plans", "actionPlans", "plans", "results", "items", "data", "rows",
  ]);

  return list.map((p, index) => {
    const nestedReview = p?.review && typeof p.review === "object" ? p.review : {};
    const nestedCase = p?.analysis_case && typeof p.analysis_case === "object" ? p.analysis_case : {};
    const reviewId = firstValue(p, [
      "review_id", "reviewId", "reviewID", "case_id", "caseId", "analysis_case_id", "analysisCaseId",
    ], firstValue(nestedReview, ["review_id", "id"], firstValue(nestedCase, ["review_id", "id"], "")));

    return {
      ...p,
      _key: p.id || p.action_plan_id || p.actionPlanId || `${reviewId || "case"}-${index}`,
      review_id: reviewId,
      title: firstValue(p, ["title", "objective", "action_title", "plan_title", "name"], "Improvement action"),
      objective: firstValue(p, ["objective", "goal", "title", "plan_title"], "Improvement action"),
      immediate_actions: firstValue(p, ["immediate_actions", "immediate_action", "immediate", "immediate_steps"]),
      corrective_actions: firstValue(p, ["corrective_actions", "corrective_action", "corrective", "corrective_steps"]),
      preventive_actions: firstValue(p, ["preventive_actions", "preventive_action", "preventive", "preventive_steps"]),
      owner_role: firstValue(p, ["owner_role", "owner", "responsible_role", "assigned_to"]),
      timeline: firstValue(p, ["timeline", "timeframe", "due", "deadline"]),
      success_metrics: firstValue(p, ["success_metrics", "success_metric", "metrics", "measurement"]),
      action: firstValue(p, ["action", "description", "action_item", "recommendation"]),
      public_reply: firstValue(p, ["public_reply", "reply", "response"]),
    };
  });
}

function normalizeReviews(rows, actionPlans = [], investigations = []) {
  const reviewRows = getRows(rows, ["reviews", "results", "items", "data", "rows"]);
  const investigationRows = getRows(investigations, ["investigations", "results", "items", "data", "rows", "analysis_cases"]);
  const plans = normalizeActionPlans(actionPlans);

  const investigationByReview = new Map();
  investigationRows.forEach((item) => {
    const id = firstValue(item, [
      "review_id", "reviewId", "reviewID", "case_id", "caseId", "analysis_case_id", "analysisCaseId", "id"
    ]);
    if (id !== "") investigationByReview.set(String(id), item);
  });

  const plansByReview = new Map();
  plans.forEach((plan) => {
    const id = String(plan.review_id || "");
    if (!id) return;
    if (!plansByReview.has(id)) plansByReview.set(id, []);
    plansByReview.get(id).push(plan);
  });

  return reviewRows.map((r, index) => {
    const reviewId = firstValue(r, ["review_id", "reviewId", "reviewID", "id", "case_id", "caseId"], index + 1);
    const inv = investigationByReview.get(String(reviewId)) || {};
    const reviewPlans = plansByReview.get(String(reviewId)) || [];

    const routeRaw = String(firstValue(r, ["route", "status_route", "workflow_status"], "")).toLowerCase();
    const sentimentRaw = String(firstValue(r, ["sentiment", "sentiment_label", "classification"], "Neutral"));
    const sentiment = sentimentRaw
      ? sentimentRaw.charAt(0).toUpperCase() + sentimentRaw.slice(1).toLowerCase()
      : "Neutral";

    const statusRaw = String(firstValue(r, ["approval_status", "status"], "")).toLowerCase();
    const status = ["approved", "rejected", "archived", "pending"].includes(statusRaw)
      ? statusRaw
      : reviewPlans.length > 0
        ? "pending"
        : routeRaw === "archive" || routeRaw === "archived"
          ? "archived"
          : "pending";

    const actions = reviewPlans.flatMap((p) => {
      const raw = [p.immediate_actions, p.corrective_actions, p.preventive_actions, p.action].filter(Boolean);
      return raw.flatMap((value) => Array.isArray(value)
        ? value.map(String)
        : String(value).split(/\n|•|\r/).map(s => s.trim()).filter(Boolean));
    });

    const severity = Number(firstValue(
      inv,
      ["severity", "severity_score", "risk_score", "risk", "score"],
      firstValue(r, ["severity", "severity_score", "risk_score", "risk", "score"], 1)
    )) || 1;

    return {
      id: `AC-${String(reviewId).padStart(3, "0")}`,
      reviewId,
      doctor: firstValue(r, ["doctor_name", "doctor", "doctorName"], firstValue(inv, ["doctor_name", "doctor"], "Unknown Doctor")),
      specialty: firstValue(r, ["specialty", "specialisation"], firstValue(inv, ["specialty", "specialisation"], "Unknown")),
      clinic: firstValue(r, ["clinic___hospital", "clinic_hospital", "clinic", "hospital"], firstValue(inv, ["clinic", "hospital"], "Unknown")),
      source: firstValue(r, ["source", "platform"], "Google Reviews"),
      dateRaw: firstValue(r, ["time_of_review", "review_date", "date", "created_at"], ""),
      date: r.time_of_review
        ? new Date(r.time_of_review).toLocaleDateString()
        : firstValue(r, ["date", "review_date", "time_of_review"], "Unknown"),
      sentiment,
      severity,
      category: formatCategory(firstValue(inv, ["category", "negative_driver", "driver"], firstValue(r, ["category", "negative_driver", "driver"], "Service Quality"))),
      route: routeRaw === "investigation" || routeRaw === "investigate"
        ? "Investigation"
        : routeRaw === "archive" || routeRaw === "archived"
          ? "Archive"
          : sentiment === "Negative" || Number(firstValue(r, ["overall_rating", "rating"], 5)) <= 2 ||
            severity >= 4 || Object.keys(inv).length
            ? "Investigation"
            : "Archive",
      text: firstValue(r, ["review_text", "text", "review", "comment"], ""),
      summary: firstValue(inv, ["summary", "investigation_summary", "analysis", "analysis_summary"], firstValue(r, ["summary"], "")),
      rootCause: firstValue(inv, ["root_cause", "rootCause", "likely_root_cause"], firstValue(r, ["root_cause"], "Analysis pending")),
      evidence: firstValue(inv, ["evidence", "supporting_evidence"], firstValue(r, ["evidence"], "Analysis pending")),
      department: firstValue(inv, ["department", "responsible_department"], firstValue(r, ["department"], "Pending")),
      lead: firstValue(inv, ["lead", "responsible_lead", "owner"], firstValue(r, ["lead"], "Pending")),
      confidence: Number(firstValue(inv, ["confidence", "confidence_score"], firstValue(r, ["confidence"], 0))) || 0,
      triageConfidence: Number(firstValue(inv, ["triage_confidence"], firstValue(r, ["triage_confidence"], 0))) || 0,
      actionPlanConfidence: Number(firstValue(reviewPlans[0] || {}, ["confidence", "action_plan_confidence"], 0)) || 0,
      metrics: firstValue(inv, ["metrics", "success_metrics"], firstValue(r, ["metrics"], "")),
      response: firstValue(r, ["response", "public_reply", "reply"], reviewPlans[0]?.public_reply || "No public reply generated yet."),
      actions: [...new Set(actions)],
      actionPlans: reviewPlans,
      actionPlan: reviewPlans[0] || null,
      status,
    };
  });
}

function getRows(payload, keys = []) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];

  for (const key of keys) {
    if (Array.isArray(payload[key])) return payload[key];
  }

  for (const key of ["data", "result", "response", "payload"]) {
    const child = payload[key];
    if (Array.isArray(child)) return child;
    if (child && typeof child === "object") {
      const nested = getRows(child, keys);
      if (nested.length) return nested;
    }
  }

  // Some FastAPI responses wrap rows one level deeper under a named object.
  for (const value of Object.values(payload)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const nested = getRows(value, keys);
      if (nested.length) return nested;
    }
  }

  return [];
}

function getTotal(payload, fallback = 0) {
  if (Array.isArray(payload)) return payload.length;
  if (!payload || typeof payload !== "object") return fallback;

  const candidates = [
    payload.total,
    payload.count,
    payload.total_count,
    payload.total_reviews,
    payload.reviews_analyzed,
    payload.review_count,
  ];

  for (const value of candidates) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }

  const rows = getRows(payload, ["reviews", "investigations", "action_plans", "results", "items"]);
  return rows.length || fallback;
}

const apiFetch = (url, opts = {}) => fetch(url, { credentials: "include", ...opts });

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} — ${url}`);
  }

  return res.json();
}

async function fetchFirst(base, paths) {
  let lastError = null;

  for (const path of paths) {
    try {
      return await fetchJson(`${base}${path}`);
    } catch (error) {
      lastError = error;
      console.warn("AegisCare endpoint failed:", `${base}${path}`, error.message);
    }
  }

  throw lastError || new Error("No API endpoint available");
}

/* ---------------------------- shared bits ---------------------------- */
const ICONS = {
  home: <path d="M3 11l9-8 9 8M5 10v10h14V10" />,
  dash: <g><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></g>,
  reviews: <path d="M4 6h16M4 12h16M4 18h10" />,
  invest: <g><circle cx="11" cy="11" r="7" /><path d="M21 21l-5-5" /></g>,
  action: <path d="M9 11l3 3 9-9M20 12v7a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h9" />,
  reports: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  approval: <g><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M9 12l2 2 4-4" /></g>,
  settings: <g><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></g>,
  contact: <g><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></g>,
  flask: <g><path d="M9 3h6M10 3v6L4.5 19a1.5 1.5 0 001.3 2.2h12.4a1.5 1.5 0 001.3-2.2L14 9V3" /><path d="M7.5 15h9" /></g>,
  hospital: <g><rect x="4" y="3" width="16" height="18" rx="1.5" /><path d="M12 8v6M9 11h6M10 21v-4h4v4" /></g>,
  check: <path d="M5 12l4 4 10-10" />,
  user: <g><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></g>,
};
const Icon = ({ n, size = 18 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[n]}</svg>;
const Mark = () => <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 2.5l8 3v6.2c0 4.8-3.3 8.2-8 9.8-4.7-1.6-8-5-8-9.8V5.5z" /><path d="M12 8v6M9 11h6" /></svg>;

const sevTone = s => s >= 4 ? "crit" : s === 3 ? "warn" : "ok";
const Sev = ({ v }) => <span className={"sev " + sevTone(v)} title={`Severity ${v} of 5`}><span className="sev-bars">{[1, 2, 3, 4, 5].map(i => <i key={i} className={i <= v ? "on" : ""} />)}</span><b>{v}</b></span>;
const STATUS = { pending: "Awaiting approval", approved: "Approved", rejected: "Rejected", archived: "Archived" };
const Status = ({ s }) => <span className={"chip " + s}>{STATUS[s]}</span>;
const CatDot = ({ c }) => <span className="catl"><i style={{ background: CAT[c] }} />{c}</span>;
const PageHead = ({ title, sub, children }) => <header className="phead"><div><h1>{title}</h1>{sub && <p>{sub}</p>}</div>{children && <div className="row">{children}</div>}</header>;

/* ------------------------------- home -------------------------------- */
function DemoOutput({ title, children }) {
  return <section className="panel" style={{ marginTop: 14 }}>
    <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
      <h3 style={{ margin: 0 }}>{title}</h3>
      <span className="chip approved">Output</span>
    </div>
    {children}
  </section>;
}

function DemoField({ label, value }) {
  return <div className="rowline">
    <span className="muted">{label}</span>
    <b style={{ textAlign: "right", maxWidth: "65%" }}>{String(value)}</b>
  </div>;
}

/* ------------------------- agent demo playground -------------------- */
const AGENT_DEMO_REVIEWS = [
  {
    id: "DEMO-01",
    doctor: "Dr. Abhilasha",
    specialty: "Dermatology",
    rating: 2,
    text: "I had to wait almost two hours before the consultation. Nobody told us about the delay and the waiting time was extremely frustrating."
  },
  {
    id: "DEMO-02",
    doctor: "Dr. Rahul Mehta",
    specialty: "Cardiology",
    rating: 3,
    text: "The doctor was helpful, but the front desk staff were not responsive and the appointment process was difficult."
  },
  {
    id: "DEMO-03",
    doctor: "Dr. Sneha Rao",
    specialty: "Dermatology",
    rating: 2,
    text: "The treatment was explained very quickly and I had several questions after leaving the clinic."
  },
  {
    id: "DEMO-04",
    doctor: "Dr. Priya Sharma",
    specialty: "General Medicine",
    rating: 5,
    text: "Very professional and helpful. The consultation was smooth and the doctor explained everything clearly."
  }
];

function demoAgent1(review) {
  const t = review.text.toLowerCase();
  let category = "Service Quality";
  if (/wait|waiting|delay|late|hour/.test(t)) category = "Wait Time";
  else if (/front desk|staff|reception|appointment/.test(t)) category = "Staff Behavior";
  else if (/explain|explained|question|communication/.test(t)) category = "Doctor Communication";
  else if (/bill|billing|charge|price|cost/.test(t)) category = "Billing";
  else if (/clean|dirty|hygien/.test(t)) category = "Cleanliness";

  const negativeSignals = ["wait", "waiting", "delay", "late", "frustrat", "difficult", "not responsive", "quickly", "questions", "charged", "confus"].filter(x => t.includes(x)).length;
  const positiveSignals = ["great", "good", "helpful", "professional", "smooth", "clearly", "excellent"].filter(x => t.includes(x)).length;
  const sentiment = negativeSignals > positiveSignals ? "Negative" : positiveSignals > negativeSignals ? "Positive" : "Neutral";
  const severity = sentiment === "Negative" ? Math.min(5, Math.max(2, negativeSignals + (review.rating <= 2 ? 1 : 0))) : 1;
  const actionable = sentiment === "Negative" && severity >= 2;

  return {
    sentiment,
    severity,
    category,
    is_actionable: actionable,
    needs_investigation: actionable,
    summary: actionable
      ? `Negative ${category.toLowerCase()} complaint requiring review.`
      : "Positive/neutral experience with no immediate investigation trigger.",
    route: actionable ? "Investigation" : "Archive"
  };
}

function demoAgent2(review, triage) {
  if (!triage?.needs_investigation) return {
    root_cause: "No investigation required.",
    evidence: "Agent 1 did not identify an actionable negative complaint.",
    department: "Not required",
    lead: "Not required",
    confidence: 0.95,
    metrics: "Maintain current patient-experience standard."
  };

  const map = {
    "Wait Time": {
      root_cause: "OPD scheduling or peak-hour capacity bottleneck.",
      department: "OPD Operations",
      lead: "OPD Operations Manager",
      metrics: "Average waiting time and percentage of appointments starting within 15 minutes."
    },
    "Staff Behavior": {
      root_cause: "Front-desk service quality or appointment-process gap.",
      department: "Patient Services",
      lead: "Patient Experience Manager",
      metrics: "Front-desk response time and appointment-resolution satisfaction."
    },
    "Doctor Communication": {
      root_cause: "Consultation communication gap leaving patient questions unanswered.",
      department: "Clinical Quality",
      lead: "Clinical Quality Lead",
      metrics: "Patient understanding score and post-visit clarification requests."
    },
    Billing: {
      root_cause: "Potential mismatch between communicated estimate and final billing.",
      department: "Billing",
      lead: "Billing Supervisor",
      metrics: "Billing clarification requests and estimate-to-final-bill variance."
    },
    Cleanliness: {
      root_cause: "Facility cleanliness or housekeeping-process gap.",
      department: "Facilities",
      lead: "Facilities Manager",
      metrics: "Housekeeping audit score and repeat cleanliness complaints."
    }
  };
  const base = map[triage.category] || map["Staff Behavior"];
  return {
    root_cause: base.root_cause,
    evidence: `Review text: "${review.text}" Agent 1 classified this as ${triage.category} with severity ${triage.severity}/5.`,
    department: base.department,
    lead: base.lead,
    confidence: Math.min(0.94, 0.72 + triage.severity * 0.04),
    metrics: base.metrics
  };
}

function demoAgent3(review, triage, investigation) {
  if (!triage?.needs_investigation) return {
    objective: "No corrective action required",
    immediate_actions: ["Record the positive/neutral feedback."],
    corrective_actions: [],
    preventive_actions: ["Continue the current patient-experience practice."],
    owner_role: "Patient Experience Team",
    timeline: "Routine review",
    success_metrics: ["Maintain positive patient feedback"],
    priority: "Low"
  };

  const actions = {
    "Wait Time": ["Review peak-hour appointment allocation", "Check actual OPD waiting-time data", "Notify patients proactively when appointments are delayed"],
    "Staff Behavior": ["Review the appointment interaction", "Run a short front-desk service refresher", "Provide a clear escalation path for booking issues"],
    "Doctor Communication": ["Review consultation communication workflow", "Provide a written treatment summary", "Offer a post-visit clarification channel"],
    Billing: ["Review estimate versus final bill", "Provide itemised estimates upfront", "Add a billing clarification checkpoint"],
    Cleanliness: ["Review housekeeping audit records", "Increase checks during peak hours", "Track repeat cleanliness complaints"]
  };
  const list = actions[triage.category] || actions["Staff Behavior"];
  return {
    objective: `Reduce ${triage.category.toLowerCase()} complaints for ${review.doctor}.`,
    immediate_actions: [list[0]],
    corrective_actions: [list[1]],
    preventive_actions: [list[2]],
    owner_role: investigation.lead,
    timeline: triage.severity >= 4 ? "Within 24–48 hours" : "Within 7 days",
    success_metrics: [investigation.metrics],
    priority: triage.severity >= 4 ? "High" : triage.severity >= 3 ? "Medium" : "Low"
  };
}

/* Try It page: the only backend call is the existing pipeline endpoint below. */
const PIPELINE_ENDPOINT = "/hospital/run-pipeline";
// 500 is the limit the existing page already enforced; it is not confirmed against the backend.
const REVIEW_COUNT_MAX = 500;
const SOURCE_OPTIONS = {
  all: {
    label: "All available sources", supported: true,
    desc: "Combines the imported dataset (PostgreSQL) with Google Maps retrieval in one run. If one source comes up short, the other fills the gap."
  },
  dataset: {
    label: "Imported dataset (PostgreSQL)", supported: true,
    desc: "Searches the imported Excel rows in PostgreSQL only. It does not open Google Maps."
  },
  maps: {
    label: "Google Maps retrieval", supported: true,
    desc: "Uses the existing Google Maps scraper only. It does not search imported dataset rows."
  },
};

function AgentPlayground({ go, apiBaseUrl = API.baseUrl, role = "" }) {
  const [providerType, setProviderType] = useState("hospital");
  const [diseaseInput, setDiseaseInput] = useState("");
  const [hospitalInput, setHospitalInput] = useState("");
  const [locationInput, setLocationInput] = useState("");
  // Patient accounts start on "All available sources"; everyone else keeps Google Maps as the default.
  const [source, setSource] = useState(role === "patient" ? "all" : "maps");
  const sourceTouched = useRef(false);
  useEffect(() => { if (role === "patient" && !sourceTouched.current) setSource("all"); }, [role]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [reviewCount, setReviewCount] = useState("20");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [decision, setDecision] = useState({});
  const [planEdits, setPlanEdits] = useState({});
  const [emailDrafts, setEmailDrafts] = useState({});
  const [emailBusy, setEmailBusy] = useState({});
  const [emailErrors, setEmailErrors] = useState({});

  const base = () => String(apiBaseUrl || API.baseUrl || "").trim().replace(/\/+$/, "");

  const updateEmailDraft = (id, patch) => setEmailDrafts(current => ({
    ...current,
    [id]: { recipient: "", subject: "", body: "", sent: false, ...(current[id] || {}), ...patch }
  }));

  const savePlanDecision = async ({ id, reviewId, status, plan }) => {
    const numericId = Number(reviewId);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      setEmailErrors(current => ({ ...current, [id]: "This result has no valid database review_id. The decision cannot be saved or emailed." }));
      return false;
    }
    try {
      const res = await fetch(`${base()}/reviews/${numericId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, response: JSON.stringify({ action_plan: plan }) })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Could not save the decision to the database.");
      setDecision(current => ({ ...current, [id]: status }));
      setEmailErrors(current => ({ ...current, [id]: "" }));
      // Remove a rejected plan from the active pipeline view only after the
      // backend confirms the rejection was saved. The decision stays in the
      // database for audit/history rather than hard-deleting the source review.
      if (status === "rejected") {
        setResult(current => {
          if (!current) return current;
          const rejectedId = String(id);
          const isRejectedEntry = entry => {
            const review = entry?.review && typeof entry.review === "object" ? entry.review : {};
            return String(review.review_id ?? entry?.review_id ?? entry?.id ?? "") === rejectedId;
          };
          if (Array.isArray(current)) return current.filter(entry => !isRejectedEntry(entry));
          if (Array.isArray(current.cases)) return { ...current, cases: current.cases.filter(entry => !isRejectedEntry(entry)) };
          if (Array.isArray(current.results)) return { ...current, results: current.results.filter(entry => !isRejectedEntry(entry)) };
          return current;
        });
      }
      return true;
    } catch (e) {
      setEmailErrors(current => ({ ...current, [id]: e.message || "Could not save the decision." }));
      return false;
    }
  };

  const generateEmailDraft = async ({ id, reviewId, plan }) => {
    const numericId = Number(reviewId);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      setEmailErrors(current => ({ ...current, [id]: "This result has no valid database review_id, so the email draft cannot be generated." }));
      return;
    }
    const recipient = (emailDrafts[id]?.recipient || "").trim();
    setEmailBusy(current => ({ ...current, [id]: "generate" }));
    setEmailErrors(current => ({ ...current, [id]: "" }));
    try {
      const res = await fetch(`${base()}/reviews/${numericId}/generate-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient, action_plan: plan })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Email draft generation failed.");
      updateEmailDraft(id, { recipient: data.recipient ?? recipient, subject: data.subject || "", body: data.body || "", sent: false });
    } catch (e) { setEmailErrors(current => ({ ...current, [id]: e.message || "Email draft generation failed." })); }
    finally { setEmailBusy(current => ({ ...current, [id]: false })); }
  };

  const sendEmailDraft = async ({ id, reviewId }) => {
    const numericId = Number(reviewId);
    const draft = emailDrafts[id] || {};
    if (!Number.isInteger(numericId) || numericId <= 0) { setEmailErrors(current => ({ ...current, [id]: "This result has no valid database review_id." })); return; }
    setEmailBusy(current => ({ ...current, [id]: "send" }));
    setEmailErrors(current => ({ ...current, [id]: "" }));
    try {
      const res = await fetch(`${base()}/reviews/${numericId}/send-approval-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient: draft.recipient, subject: draft.subject, body: draft.body })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Email sending failed.");
      updateEmailDraft(id, { sent: true, recipient: data.recipient || draft.recipient });
    } catch (e) { setEmailErrors(current => ({ ...current, [id]: e.message || "Email sending failed." })); }
    finally { setEmailBusy(current => ({ ...current, [id]: false })); }
  };

  const startHospitalReviewRun = async () => {
    const value = hospitalInput.trim();
    const errs = {};
    if (providerType === "disease" ? !diseaseInput.trim() : !value) errs.provider = providerType === "doctor" ? "Enter the doctor's name." : providerType === "disease" ? "Enter a disease or condition." : "Enter a hospital / clinic name or Google Maps URL.";
    const countText = String(reviewCount).trim();
    const requestedCount = Number(countText);
    if (!countText) errs.count = "Enter the number of reviews.";
    else if (!/^\d+$/.test(countText) || !Number.isInteger(requestedCount) || requestedCount < 1) errs.count = "Enter a positive whole number (1 or more).";
    else if (requestedCount > REVIEW_COUNT_MAX) errs.count = `The current frontend limit is ${REVIEW_COUNT_MAX} reviews per run. Enter ${REVIEW_COUNT_MAX} or fewer.`;
    if (!SOURCE_OPTIONS[source].supported) errs.source = SOURCE_OPTIONS[source].unsupportedMessage;
    setFieldErrors(errs);
    if (Object.keys(errs).length) { setError(""); return; }
    setRunning(true); setError(""); setResult(null); setDecision({}); setPlanEdits({});
    const queryValue = providerType === "disease" ? diseaseInput.trim() : value;
    const isUrl = providerType !== "disease" && /^https?:\/\//i.test(value);
    const isDoctor = providerType === "doctor";
    if (role === "patient") recordSearchTopic(queryValue);
    try {
      const res = await fetch(`${base()}${PIPELINE_ENDPOINT}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Existing fields are unchanged; provider_type, doctor_name, location and source are additive.
        body: JSON.stringify({
          hospital_name: isUrl || isDoctor || providerType === "disease" ? "" : value,
          google_maps_url: isUrl ? value : "",
          review_count: requestedCount,
          input: queryValue,
          provider_type: providerType,
          doctor_name: isDoctor ? value : "",
          disease_query: providerType === "disease" ? diseaseInput.trim() : "",
          location: locationInput.trim(),
          source
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = data?.detail;
        let message = "Could not process this hospital. Check the backend pipeline endpoint.";
        if (typeof detail === "string") {
          message = detail;
        } else if (detail && typeof detail === "object") {
          const summary = detail.message || detail.error || "The server returned an error.";
          const debug = detail.debug ? `\n\nDebug details:\n${JSON.stringify(detail.debug, null, 2)}` : "";
          const nextStep = detail.next_step ? `\n\nNext step: ${detail.next_step}` : "";
          message = `${summary}${debug}${nextStep}`;
        }
        throw new Error(message);
      }
      setResult(data);
    } catch (e) { setError(e.message || "Unable to start the review analysis."); }
    finally { setRunning(false); }
  };

  const cases = Array.isArray(result?.results) ? result.results : Array.isArray(result?.reviews) ? result.reviews : Array.isArray(result?.cases) ? result.cases : [];
  const pick = (item, ...keys) => { for (const key of keys) { const value = item?.[key]; if (value !== undefined && value !== null && value !== "") return value; } return "—"; };
  const renderList = (value) => Array.isArray(value)
    ? <ul>{value.map((x, i) => <li key={i}>{typeof x === "string" ? x : JSON.stringify(x)}</li>)}</ul>
    : <p className="muted" style={{ whiteSpace: "pre-wrap" }}>{typeof value === "object" && value ? JSON.stringify(value, null, 2) : (value || "—")}</p>;

  return <>
    <header className="phead" style={{ width: "100%", boxSizing: "border-box" }}>
      <div style={{ width: "100%" }}>
        <button className="crumb" onClick={() => go("home")}>← Back to Home</button>
        <h1>Try AegisCare</h1>
        <p>Search patient reviews by hospital, doctor, or disease, then run the existing AI analysis workflow.</p>
      </div>
    </header>

    <section className="panel" style={{ marginTop: 0, width: "100%", boxSizing: "border-box", padding: "clamp(18px,3vw,36px)" }} aria-labelledby="try-form-title">
      <span className="n">START A REVIEW ANALYSIS</span>
      <h2 className="ph2" id="try-form-title" style={{ marginTop: 8 }}>Set up your analysis</h2>

      <fieldset style={{ border: 0, padding: 0, margin: "18px 0 0" }} disabled={running}>
        <legend className="fl">What do you want to analyse?</legend>
        <div role="radiogroup" aria-label="Analysis type" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12, marginTop: 8 }}>
          {[["hospital", "Hospital / Clinic", "hospital"], ["doctor", "Doctor", "user"], ["disease", "Disease / Condition", "activity"]].map(([k, l, ic]) =>
            <button type="button" key={k} role="radio" aria-checked={providerType === k} onClick={() => { setProviderType(k); setFieldErrors({}); }}
              className={"btn" + (providerType === k ? " pri" : "")}
              style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "flex-start", padding: "14px 16px", textAlign: "left", borderWidth: providerType === k ? 2 : 1 }}>
              <Icon n={ic} size={22} /><span>{l}</span>{providerType === k && <span aria-hidden="true" style={{ marginLeft: "auto" }}>✓</span>}
            </button>)}
        </div>
      </fieldset>

      <div className="grid2" style={{ gap: 14, marginTop: 18 }}>
        <div className="field" style={{ minWidth: 0 }}>
          <label className="fl" htmlFor="provider-input">{providerType === "doctor" ? "Doctor name" : providerType === "disease" ? "Disease / condition" : "Hospital / Clinic name"}</label>
          <input id="provider-input" className="f" value={providerType === "disease" ? diseaseInput : hospitalInput} onChange={e => providerType === "disease" ? setDiseaseInput(e.target.value) : setHospitalInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !running) startHospitalReviewRun(); }}
            placeholder={providerType === "doctor" ? "e.g. Dr. Priya Sharma" : providerType === "disease" ? "e.g. diabetes, asthma, cancer" : "Enter a hospital name or paste a Google Maps profile URL"} disabled={running}
            aria-invalid={Boolean(fieldErrors.provider)} aria-describedby={fieldErrors.provider ? "provider-err" : undefined} style={{ width: "100%", boxSizing: "border-box" }} />
          {fieldErrors.provider && <p id="provider-err" role="alert" className="small" style={{ color: "var(--crit)", marginTop: 6 }}>{fieldErrors.provider}</p>}
        </div>
        <div className="field" style={{ minWidth: 0 }}>
          <label className="fl" htmlFor="location-input">Location / city <span className="muted">(optional)</span></label>
          <input id="location-input" className="f" value={locationInput} onChange={e => setLocationInput(e.target.value)} placeholder="Helps when several providers share a name" disabled={running} style={{ width: "100%", boxSizing: "border-box" }} />
        </div>
      </div>

      <div className="grid2" style={{ gap: 14, marginTop: 18 }}>
        <div className="field" style={{ minWidth: 0 }}>
          <label className="fl" htmlFor="source-select">Review source</label>
          <select id="source-select" className="f" value={source} onChange={e => { sourceTouched.current = true; setSource(e.target.value); setFieldErrors(cur => ({ ...cur, source: "" })); }} disabled={running} aria-describedby="source-help" style={{ width: "100%", boxSizing: "border-box" }}>
            {Object.entries(SOURCE_OPTIONS).map(([k, o]) => <option key={k} value={k}>{o.label}</option>)}
          </select>
          <p id="source-help" className="small muted" style={{ marginTop: 7 }}>{SOURCE_OPTIONS[source].desc}</p>
          {!SOURCE_OPTIONS[source].supported && <p role="status" className="small" style={{ color: "var(--warn)", marginTop: 6 }}>Not available yet: {SOURCE_OPTIONS[source].unsupportedMessage}</p>}
          {fieldErrors.source && <p role="alert" className="small" style={{ color: "var(--crit)", marginTop: 6 }}>{fieldErrors.source}</p>}
        </div>
        <div className="field" style={{ minWidth: 0 }}>
          <label className="fl" htmlFor="review-count">Number of reviews</label>
          <input id="review-count" className="f" type="number" inputMode="numeric" min="1" step="1" value={reviewCount} onChange={e => setReviewCount(e.target.value)} placeholder="Enter number of reviews" disabled={running}
            aria-invalid={Boolean(fieldErrors.count)} aria-describedby="review-count-help" style={{ width: "100%", boxSizing: "border-box" }} />
          <p id="review-count-help" className="small muted" style={{ marginTop: 7 }}>Any whole number from 1 to {REVIEW_COUNT_MAX}. The results show how many reviews were actually found and processed.</p>
          {fieldErrors.count && <p role="alert" className="small" style={{ color: "var(--crit)", marginTop: 6 }}>{fieldErrors.count}</p>}
        </div>
      </div>

      <div className="row" style={{ marginTop: 22, alignItems: "center" }}>
        <button type="button" className="btn pri" disabled={running} onClick={startHospitalReviewRun} style={{ minHeight: 44, padding: "10px 22px" }}>
          {running ? "Analysing reviews…" : "Retrieve reviews & analyse"}
        </button>
        {running && <span className="small muted" role="status">Retrieving reviews and running Agents 1 → 3. This can take a few minutes; please keep this page open.</span>}
      </div>
      {error && <div className="panel" role="alert" style={{ marginTop: 16, borderColor: "var(--crit)", color: "var(--crit)", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{error}</div>}
    </section>

    {role === "patient" && result && <PrepTips topic={bestPrepTopic(providerType === "disease" ? diseaseInput : hospitalInput)} />}

    {result && <section className="panel" style={{ marginTop: 20 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div><span className="n">FINAL OUTPUT</span><h2 className="ph2" style={{ marginTop: 8 }}>{pick(result, "hospital_name") !== "—" ? pick(result, "hospital_name") : hospitalInput}</h2><p className="small muted">The agents ran in the background. Review the final recommendations below.</p></div>
        <span className="chip approved">READY FOR REVIEW</span>
      </div>
      <div className="three" style={{ marginBottom: 18 }}>
        <div><span className="n">Reviews found</span><h3>{pick(result, "reviews_found", "total_reviews", "count")}</h3></div>
        <div><span className="n">Processed</span><h3>{pick(result, "processed_by_agent1", "processed", "processed_count", "analysed_count")}</h3></div>
        <div><span className="n">Negative reviews</span><h3>{pick(result, "negative_reviews_selected", "negative_reviews", "negative_count") != "—" ? pick(result, "negative_reviews_selected", "negative_reviews", "negative_count") : cases.filter(item => String((item.agent1 || item.triage || item).sentiment || "").toLowerCase() === "negative" || item.is_negative_review === true).length}</h3></div>
      </div>
      {cases.length > 0 && (() => {
        const stage = (label, ok, fail, total) => <div><span className="n">{label}</span><h3>{fail ? `${fail} failed` : ok ? `${ok} / ${total} returned` : "No output"}</h3></div>;
        const neg = cases.filter(c => c.agent2 || c.analysis || c.investigation || c.agent2_error || c.agent3 || c.action_plan || c.action_plan_result || c.agent3_error);
        return <div className="three" style={{ marginBottom: 18 }}>
          {stage("Agent 1 · Triage", cases.filter(c => c.agent1 || c.triage).length, cases.filter(c => c.agent1_error).length, cases.length)}
          {stage("Agent 2 · Investigation", neg.filter(c => c.agent2 || c.analysis || c.investigation).length, neg.filter(c => c.agent2_error).length, neg.length)}
          {stage("Agent 3 · Action plans", neg.filter(c => c.agent3 || c.action_plan || c.action_plan_result).length, neg.filter(c => c.agent3_error).length, neg.length)}
        </div>;
      })()}
      {cases.length ? cases.map((item, index) => {
        const review = item.review && typeof item.review === "object" ? item.review : {};
        const id = String(review.review_id ?? item.review_id ?? item.id ?? index);
        const triage = item.agent1 || item.triage || item;
        const analysis = item.agent2 || item.analysis || item.investigation || {};
        const plan = item.agent3 || item.action_plan || item.action_plan_result || {};
        const isNegative = item.is_negative_review === true || String(triage.sentiment || item.sentiment || "").toLowerCase() === "negative" || Boolean(item.agent2 || item.analysis || item.investigation || item.agent3 || item.action_plan);
        const hasPlan = Boolean(item.agent3 || item.action_plan || item.action_plan_result);
        const status = decision[id] || item.decision || "pending";
        if (status === "rejected") return null;
        const originalPlan = (() => {
          if (typeof plan === "string") {
            try { return JSON.parse(plan); } catch { return { objective: plan }; }
          }
          return plan && typeof plan === "object" && !Array.isArray(plan) ? plan : {};
        })();
        const editablePlan = (() => {
          const edited = planEdits[id];
          if (edited && typeof edited === "object") return edited;
          if (typeof edited === "string") {
            try { return JSON.parse(edited); } catch { return originalPlan; }
          }
          return originalPlan;
        })();
        const reviewText = review.review_text ?? item.review_text ?? (typeof item.review === "string" ? item.review : "");
        const displayValue = (value) => value === undefined || value === null || value === "" ? "Not returned" : value;
        const updatePlanField = (key, value, wasArray) => setPlanEdits(current => {
          const existing = current[id] && typeof current[id] === "object" ? current[id] : originalPlan;
          let nextValue = value;
          if (wasArray) nextValue = value.split("\n").map(line => line.trim()).filter(Boolean);
          return { ...current, [id]: { ...existing, [key]: nextValue } };
        });
        const planLabel = key => key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
        const preferredPlanFields = ["objective", "priority", "immediate_actions", "corrective_actions", "preventive_actions", "owner_role", "timeline", "success_metrics"];
        const planFields = [...preferredPlanFields.filter(key => Object.prototype.hasOwnProperty.call(editablePlan, key)), ...Object.keys(editablePlan).filter(key => !preferredPlanFields.includes(key))];
        return <article className="panel" key={id} style={{ marginTop: 14, overflowWrap: "anywhere" }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}><div><span className="n">REVIEW {index + 1} · {displayValue(review.overall_rating ?? item.overall_rating)} / 5 stars</span><h3 style={{ marginTop: 6 }}>{review.reviewer_name || item.reviewer_name || `Review ${index + 1}`}</h3></div><span className={status === "approved" ? "chip approved" : status === "rejected" ? "chip pending" : "chip"}>{status.toUpperCase()}</span></div>
          <div className="lab">Patient review</div><p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{reviewText || "Review text was not returned."}</p>
          <section className="panel" style={{ marginTop: 12 }}><h3>Agent 1 · Intake &amp; triage</h3>
            <div className="rowline"><span className="muted">Sentiment</span><b>{displayValue(triage.sentiment)}</b></div>
            <div className="rowline"><span className="muted">Severity</span><b>{triage.severity !== undefined ? `${triage.severity} / 5` : "Not returned"}</b></div>
            <div className="rowline"><span className="muted">Complaint category</span><b>{displayValue(triage.category)}</b></div>
            <div className="rowline"><span className="muted">Routing</span><b>{displayValue(triage.route)}</b></div>
            <div className="lab">Summary</div>{renderList(triage.summary)}
            {item.agent1_error && <p role="alert">Agent 1 error: {item.agent1_error}</p>}
          </section>
          {isNegative && <section className="panel" style={{ marginTop: 12 }}><h3>Agent 2 · Investigation</h3>
            {item.agent2_error ? <p role="alert">Agent 2 failed: {item.agent2_error}</p> : (item.agent2 || item.analysis || item.investigation) ? <>
              <div className="lab">Root cause</div>{renderList(analysis.root_cause)}
              <div className="lab">Evidence</div>{renderList(analysis.evidence)}
              <div className="rowline"><span className="muted">Department</span><b>{displayValue(analysis.department)}</b></div>
              <div className="rowline"><span className="muted">Responsible lead</span><b>{displayValue(analysis.lead)}</b></div>
              <div className="rowline"><span className="muted">Confidence</span><b>{analysis.confidence !== undefined ? `${Math.round(Number(analysis.confidence) * 100)}%` : "Not returned"}</b></div>
              <div className="lab">Metrics / context</div>{renderList(analysis.metrics)}
            </> : <p className="muted">Agent 2 did not return an output for this review.</p>}
          </section>}
          {isNegative ? <section className="panel" style={{ marginTop: 12 }}><h3>Agent 3 · Editable action plan</h3>
            {item.agent3_error ? <p role="alert">Agent 3 failed: {item.agent3_error}</p> : hasPlan ? <>
              <p className="small muted">Edit the proposed plan before deciding. Your edits and decision remain in this page's current session.</p>
              <div className="grid2" style={{ gap: 14, marginTop: 14 }}>
                {planFields.map(key => {
                  const value = editablePlan[key];
                  const isArray = Array.isArray(value);
                  const isObject = value !== null && typeof value === "object" && !isArray;
                  const fieldValue = isArray ? value.map(entry => typeof entry === "string" ? entry : JSON.stringify(entry)).join("\n") : isObject ? JSON.stringify(value, null, 2) : (value === undefined || value === null ? "" : String(value));
                  const isLong = isArray || isObject || /action|objective|metric|evidence|description|reason|outcome|summary|response|email|prevent|correct|immediate|recommendation|risk|follow/i.test(key);
                  return <div key={key} style={{ minWidth: 0, gridColumn: isLong ? "1 / -1" : undefined }}>
                    <label className="fl" htmlFor={`agent3-${id}-${key}`}>{planLabel(key)}</label>
                    {key === "priority" ? <select id={`agent3-${id}-${key}`} className="f" value={fieldValue} disabled={status !== "pending"} onChange={e => updatePlanField(key, e.target.value, false)} style={{ width: "100%", boxSizing: "border-box" }}>
                      {!["critical", "high", "medium", "low"].includes(fieldValue.toLowerCase()) && <option value={fieldValue}>{fieldValue || "Select priority"}</option>}
                      <option value="Critical">Critical</option><option value="High">High</option><option value="Medium">Medium</option><option value="Low">Low</option>
                    </select> : <textarea id={`agent3-${id}-${key}`} className="f" aria-label={`Edit ${planLabel(key)}`} rows={isLong ? Math.min(6, Math.max(3, fieldValue.split("\n").length)) : 2} value={fieldValue} disabled={status !== "pending"} onChange={e => updatePlanField(key, e.target.value, isArray)} style={{ width: "100%", boxSizing: "border-box", resize: "vertical", lineHeight: 1.5 }} />}
                    {isArray && <div className="small muted" style={{ marginTop: 4 }}>Enter one item per line.</div>}
                  </div>;
                })}
              </div>
            </> : <p className="muted">Agent 3 did not return an action plan for this negative review.</p>}
          </section> : null}
          {isNegative && <div className="row" style={{ marginTop: 14 }}>
            <button className="btn pri" disabled={status !== "pending" || !hasPlan} onClick={() => savePlanDecision({ id, reviewId: item.database_review_id ?? review.review_id ?? item.review_id ?? item.id, status: "approved", plan: editablePlan })}>Approve edited plan</button>
            <button className="btn" disabled={status !== "pending" || !hasPlan} onClick={() => savePlanDecision({ id, reviewId: item.database_review_id ?? review.review_id ?? item.review_id ?? item.id, status: "rejected", plan: editablePlan })}>Reject plan</button>
          </div>}
          {emailErrors[id] && status !== "approved" && <p role="alert" style={{ marginTop: 10, color: "var(--crit)", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{emailErrors[id]}</p>}
          {isNegative && status === "approved" && <section className="panel" style={{ marginTop: 14 }}>
            <h3>Patient email · LLM-generated draft</h3>
            <p className="small muted">Generate a draft after approval, review/edit it, then send it explicitly. For the demo, enter your own email address. Public reviews do not expose the reviewer's email.</p>
            <div className="field" style={{ marginTop: 12 }}>
              <label className="fl" htmlFor={`email-recipient-${id}`}>Recipient email (demo: your email)</label>
              <input id={`email-recipient-${id}`} className="f" type="email" placeholder="you@example.com" value={emailDrafts[id]?.recipient || ""} onChange={e => updateEmailDraft(id, { recipient: e.target.value })} disabled={Boolean(emailBusy[id]) || Boolean(emailDrafts[id]?.sent)} />
            </div>
            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn pri" disabled={Boolean(emailBusy[id]) || Boolean(emailDrafts[id]?.sent)} onClick={() => generateEmailDraft({ id, reviewId: item.database_review_id ?? review.review_id ?? item.review_id ?? item.id, plan: editablePlan })}>{emailBusy[id] === "generate" ? "Generating email…" : "Generate Email Draft"}</button>
              {emailDrafts[id]?.subject && <span className="small muted">Draft generated — edit it before sending.</span>}
            </div>
            {emailDrafts[id]?.subject && <>
              <div className="field" style={{ marginTop: 14 }}><label className="fl" htmlFor={`email-subject-${id}`}>Subject</label><input id={`email-subject-${id}`} className="f" value={emailDrafts[id].subject} onChange={e => updateEmailDraft(id, { subject: e.target.value })} disabled={Boolean(emailBusy[id]) || Boolean(emailDrafts[id]?.sent)} /></div>
              <div className="field" style={{ marginTop: 12 }}><label className="fl" htmlFor={`email-body-${id}`}>Email body</label><textarea id={`email-body-${id}`} className="f" rows={8} value={emailDrafts[id].body} onChange={e => updateEmailDraft(id, { body: e.target.value })} disabled={Boolean(emailBusy[id]) || Boolean(emailDrafts[id]?.sent)} style={{ width: "100%", boxSizing: "border-box", resize: "vertical", lineHeight: 1.6 }} /></div>
              <div className="row" style={{ marginTop: 12, alignItems: "center" }}>
                <button className="btn pri" disabled={Boolean(emailBusy[id]) || Boolean(emailDrafts[id]?.sent) || !emailDrafts[id].recipient?.trim() || !emailDrafts[id].subject?.trim() || !emailDrafts[id].body?.trim()} onClick={() => sendEmailDraft({ id, reviewId: item.database_review_id ?? review.review_id ?? item.review_id ?? item.id })}>{emailBusy[id] === "send" ? "Sending…" : "Send Email"}</button>
                {emailDrafts[id]?.sent && <span className="chip approved">Email sent to {emailDrafts[id].recipient}</span>}
              </div>
            </>}
            {emailErrors[id] && <p role="alert" style={{ marginTop: 12, color: "var(--crit)", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{emailErrors[id]}</p>}
          </section>}
        </article>;
      }) : (<p className="muted">The pipeline returned no individual results. Check the response format from the backend.</p>)}
    </section>}
  </>;
}

function GoogleLogin({ apiBaseUrl = API.baseUrl, go, signedIn, email }) {
  const startGoogleAuth = (mode) => {
    // The session cookie is set on the host that starts sign-in, and Google returns to
    // http://localhost:8000. Using 127.0.0.1 here would cause "mismatching_state".
    const base = String(apiBaseUrl || API.baseUrl).trim().replace(/\/$/, "").replace("//127.0.0.1", "//localhost");
    // Google handles first-time account creation and returning-user sign-in in the same secure flow.
    window.location.href = base + "/auth/google/start?mode=" + encodeURIComponent(mode);
  };
  return <section className="auth-shell">
    <div className="auth-art">
      <div className="auth-brand"><Mark /><span>AegisCare AI</span></div>
      <h2>Better care starts with listening to patients.</h2>
      <HeroArt variant="patient" />
      <ul className="auth-points">
        <li><LpIcon n="shield" size={18} /><span>Sign in securely with Google. AegisCare never sees your password.</span></li>
        <li><LpIcon n="lock" size={18} /><span>Your searches and requests stay in your own account.</span></li>
        <li><LpIcon n="info" size={18} /><span>Guidance only. AegisCare does not diagnose or replace a doctor.</span></li>
      </ul>
    </div>
    <div className="auth-form">
      <p className="n" style={{ letterSpacing: ".12em" }}>WELCOME TO AEGISCARE AI</p>
      <h1 style={{ fontSize: 30, margin: "10px 0" }}>Sign in</h1>
      <p className="muted" style={{ lineHeight: 1.7, marginBottom: 24 }}>Continue with your Google account. New users are asked a few quick details (who they are, city, organization) before the dashboard.</p>
      {signedIn ? <><p className="chip approved" style={{ display: "inline-block", alignSelf: "center" }}>Signed in{email ? ` as ${email}` : ""}</p><div style={{ marginTop: 20 }}><button className="btn pri" onClick={() => go("dashboard")}>Go to dashboard →</button></div></> : <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: 12, maxWidth: 340, margin: "0 auto", width: "100%" }}>
        <button className="btn pri" onClick={() => startGoogleAuth("login")} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "12px 20px", minHeight: 46 }}>
          <span aria-hidden="true" style={{ fontWeight: 700, fontSize: 18 }}>G</span> Continue with Google
        </button>
      </div>}
      <div style={{ marginTop: 22 }}><button className="link" onClick={() => go("home")}>← Back to home</button></div>
      <p className="small muted" style={{ marginTop: 20 }}>Google is used for authentication. Google Business Profile access requires separate permission.</p>
    </div>
  </section>;
}

function Home({ explore }) {
  return <>
  <section className="landing-hero">
    <div className="hero-orb hero-orb-left" aria-hidden="true" />
    <div className="hero-orb hero-orb-right" aria-hidden="true" />
    <div className="hero-dots" aria-hidden="true" />
    <div className="hero-copy">
      <span className="hero-eyebrow">AI-POWERED PATIENT EXPERIENCE INTELLIGENCE</span>
      <h1>AegisCare <span>AI</span></h1>
      <p>Turn patient voices into clearer<br className="desktop-break" /> insights and better care.</p>
      <button className="hero-explore" onClick={explore}>Explore the platform <span aria-hidden="true">↗</span></button>
    </div>
    <div className="hero-features" id="how-it-works">
      <div><span className="feature-icon">◌</span><span>Review intelligence</span></div>
      <i />
      <div><span className="feature-icon">▤</span><span>Clinical context</span></div>
      <i />
      <div><span className="feature-icon">▥</span><span>Actionable improvements</span></div>
    </div>
  </section>
  <HomeExtras explore={explore} />
  </>;
}

/* ----------------------------- dashboard ----------------------------- */
function Trend({ data }) {
  const W = 640, H = 210, L = 34, B = 28, T = 10, R = 12;
  const top = Math.max(5, Math.ceil(Math.max(...data) / 5) * 5);
  const x = i => L + i * (W - L - R) / (data.length - 1);
  const y = v => H - B - (v / top) * (H - B - T);
  const d = data.map((v, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1)).join(" ");
  return <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Negative reviews per week">
    {[0, top / 2, top].map(t => <g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--line)" /><text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize="11.5" fill="var(--muted)">{t}</text></g>)}
    <path d={d} fill="none" stroke="var(--brand)" strokeWidth="2.2" strokeLinejoin="round" />
    {data.map((v, i) => <g key={i}><circle cx={x(i)} cy={y(v)} r="3.5" fill="var(--surface)" stroke="var(--brand)" strokeWidth="2" />
      <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="11.5" fill="var(--muted)">{TREND_LABELS[i]}</text></g>)}
  </svg>;
}

/* ---------------- dashboard chart helpers ---------------- */
const ROOT_THEMES = [
  ["Communication gaps", /communicat|explain|inform|not told|unanswered|clarif/],
  ["Billing transparency", /bill|estimate|charge|price|cost/],
  ["OPD scheduling & capacity", /schedul|capacity|peak|opd|wait|queue/],
  ["Front-desk & booking", /front.?desk|reception|booking|appointment|responsive/],
  ["Staff behaviour", /staff|behaviou?r|rude|attitude|courtesy/],
  ["Cleanliness & facilities", /clean|hygien|housekeep|facilit/],
];
function rootTheme(text) {
  const t = String(text || "").toLowerCase().trim();
  if (!t || t === "analysis pending" || t === "pending") return "Awaiting analysis";
  if (t.includes("no investigation required")) return null;
  for (const [name, re] of ROOT_THEMES) if (re.test(t)) return name;
  return "Other";
}

function startOfWeek(d) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }

function buildTimeSeries(reviews) {
  const dated = []; let undated = 0;
  reviews.forEach(r => {
    const d = r.dateRaw ? new Date(r.dateRaw) : null;
    if (d && !isNaN(d.getTime())) dated.push({ d, neg: r.sentiment === "Negative" }); else undated++;
  });
  if (!dated.length) return { points: [], mode: "week", undated };
  const times = dated.map(x => x.d.getTime());
  const minT = Math.min(...times), maxT = Math.max(...times);
  const mode = (maxT - minT) / 86400000 > 180 ? "month" : "week";
  const floor = mode === "month" ? startOfMonth : startOfWeek;
  const buckets = new Map();
  dated.forEach(({ d, neg }) => {
    const k = floor(d).getTime();
    const b = buckets.get(k) || { total: 0, neg: 0 };
    b.total++; if (neg) b.neg++;
    buckets.set(k, b);
  });
  const points = [];
  const last = floor(new Date(maxT));
  for (let c = floor(new Date(minT)); c <= last; mode === "month" ? c.setMonth(c.getMonth() + 1) : c.setDate(c.getDate() + 7)) {
    const b = buckets.get(c.getTime()) || { total: 0, neg: 0 };
    points.push({
      label: mode === "month"
        ? c.toLocaleDateString(undefined, { month: "short", year: "2-digit" })
        : c.toLocaleDateString(undefined, { day: "numeric", month: "short" }),
      total: b.total, neg: b.neg,
    });
  }
  return { points: points.slice(-26), mode, undated };
}

function TimeChart({ points }) {
  const W = 640, H = 230, L = 34, B = 34, T = 12, R = 14;
  const n = points.length;
  const top = Math.ceil(Math.max(4, ...points.map(p => p.total)) / 4) * 4;
  const x = i => n === 1 ? L + (W - L - R) / 2 : L + i * (W - L - R) / (n - 1);
  const y = v => H - B - (v / top) * (H - B - T);
  const path = k => points.map((p, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(p[k]).toFixed(1)).join(" ");
  const step = Math.max(1, Math.ceil(n / 7));
  const area = n ? path("neg") + ` L ${x(n - 1).toFixed(1)} ${y(0).toFixed(1)} L ${x(0).toFixed(1)} ${y(0).toFixed(1)} Z` : "";
  return <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Reviews received over time">
    <defs><linearGradient id="tcArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--crit)" stopOpacity=".20" /><stop offset="1" stopColor="var(--crit)" stopOpacity="0" /></linearGradient></defs>
    {[0, top / 2, top].map(t => <g key={t}>
      <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--line)" />
      <text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize="11.5" fill="var(--muted)">{t}</text>
    </g>)}
    <path className="tc-line" pathLength="1" d={path("total")} fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinejoin="round" />
    {n > 1 && <path className="tc-area" d={area} fill="url(#tcArea)" />}
    <path className="tc-line" pathLength="1" d={path("neg")} fill="none" stroke="var(--crit)" strokeWidth="2.4" strokeLinejoin="round" />
    {points.map((p, i) => <g key={i}>
      <circle className="tc-dot" style={{ "--i": i }} cx={x(i)} cy={y(p.total)} r="3" fill="var(--surface)" stroke="var(--muted)" strokeWidth="1.8"><title>{`${p.label}: ${p.total} reviews`}</title></circle>
      <circle className="tc-dot" style={{ "--i": i }} cx={x(i)} cy={y(p.neg)} r="3.5" fill="var(--surface)" stroke="var(--crit)" strokeWidth="2"><title>{`${p.label}: ${p.neg} negative`}</title></circle>
      {i % step === 0 && <text x={x(i)} y={H - 10} textAnchor="middle" fontSize="11" fill="var(--muted)">{p.label}</text>}
    </g>)}
    {n > 0 && <circle className="tc-live" cx={x(n - 1)} cy={y(points[n - 1].neg)} r="3.5" fill="var(--crit)" />}
  </svg>;
}

function BarRow({ label, value, max, suffix, color, dim }) {
  return <div className="hb">
    <div className="t"><span>{label}</span><b>{value}{suffix || ""}</b></div>
    <div className="track"><div style={{ width: Math.max(2, (value / (max || 1)) * 100) + "%", opacity: dim ? .5 : 1, ...(color ? { background: color } : {}) }} /></div>
  </div>;
}

function DonutChart({ data }) {
  const total = data.reduce((a, c) => a + c.v, 0) || 1;
  const R = 62, SW = 26, C = 2 * Math.PI * R;
  let offset = 0;
  return <svg viewBox="0 0 160 160" width="180" height="180" role="img" aria-label="Complaint category breakdown">
    <g transform="translate(80,80) rotate(-90)">
      <circle r={R} fill="none" stroke="var(--surface-2)" strokeWidth={SW} />
      {data.map((d, di) => {
        const frac = d.v / total;
        const dash = frac * C;
        const seg = <circle key={d.k} className="dn-seg" style={{ "--i": di }} r={R} fill="none" stroke={CAT[d.k] || "var(--brand)"} strokeWidth={SW}
          strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-offset} strokeLinecap="butt">
          <title>{`${d.k}: ${d.v} (${d.pct}%)`}</title>
        </circle>;
        offset += dash;
        return seg;
      })}
    </g>
    <text x="80" y="76" textAnchor="middle" fontSize="22" fontWeight="700" fill="var(--text)">{total}</text>
    <text x="80" y="94" textAnchor="middle" fontSize="11" fill="var(--muted)">negative</text>
  </svg>;
}

function Dashboard({ reviews, pipelineStats }) {
  const neg = reviews.filter(r => r.sentiment === "Negative");
  const total = Number(pipelineStats?.reviewsMonitored ?? reviews.length ?? 0);
  const analysisCases = Number(pipelineStats?.analysisCases ?? 0);
  const totalActionPlans = Number(pipelineStats?.actionPlans ?? 0);
  const severityValue = Number(pipelineStats?.averageSeverity ?? 0);
  const avg = severityValue > 0 ? severityValue.toFixed(1) : "—";

  // 1. Complaint categories (ranked)
  const categories = useMemo(() => {
    const m = {}; neg.forEach(r => m[r.category] = (m[r.category] || 0) + 1);
    return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ k, v, pct: Math.round(v / (neg.length || 1) * 100) }));
  }, [reviews]);

  // 2. Root-cause themes (Agent 2)
  const themes = useMemo(() => {
    const m = {};
    neg.forEach(r => { const t = rootTheme(r.rootCause); if (t) m[t] = (m[t] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ k, v }));
  }, [reviews]);

  // 3. Review frequency over time
  const series = useMemo(() => buildTimeSeries(reviews), [reviews]);
  const datedTotal = series.points.reduce((a, p) => a + p.total, 0);
  const perPeriod = series.points.length ? (datedTotal / series.points.length).toFixed(1) : "0";
  const peak = series.points.reduce((best, p) => p.total > (best?.total ?? -1) ? p : best, null);

  // 4. Heatmap: category x doctor
  const heat = useMemo(() => {
    const docCount = {}; neg.forEach(r => docCount[r.doctor] = (docCount[r.doctor] || 0) + 1);
    const doctors = Object.entries(docCount).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([d]) => d);
    const cats = categories.map(c => c.k);
    const cell = {}; let max = 0;
    neg.forEach(r => {
      if (!doctors.includes(r.doctor)) return;
      const key = r.category + "||" + r.doctor;
      cell[key] = (cell[key] || 0) + 1; max = Math.max(max, cell[key]);
    });
    return { doctors, cats, cell, max };
  }, [reviews, categories]);

  const kpis = [
    ["Reviews monitored", total, "Count reported by API"],
    ["Analysis cases", analysisCases, "Agent 2 cases reported by API"],
    ["Action plans", totalActionPlans, "Agent 3 plans reported by API"],
    ["Average severity", avg, "Out of 5 · analyzed cases"],
  ];
  const empty = <p className="muted" style={{ margin: 0 }}>No negative reviews yet. This chart fills in once reviews are analysed.</p>;

  return <>
    <PageHead title="Dashboard" sub="What patients are saying, and why." />
    <div className="panel kpis">
      {kpis.map(([l, v, d]) => <div className="kpi" key={l}><div className="l">{l}</div><div className="v"><KpiVal v={v} /></div><div className="d">{d}</div></div>)}
    </div>

    <div className="cols" style={{ marginTop: 20 }}>
      <section className="panel" style={{ marginTop: 0 }}>
        <h2 className="ph2">Why patients are unhappy <small>Complaint categories</small></h2>
        {categories.length ? <div className="row" style={{ gap: 22, alignItems: "center", flexWrap: "wrap" }}>
          <DonutChart data={categories} />
          <div style={{ flex: "1 1 160px", minWidth: 160 }}>
            {categories.map(c => <div className="rowline" key={c.k}><CatDot c={c.k} /><b>{c.v} · {c.pct}%</b></div>)}
          </div>
        </div> : empty}
      </section>
      <section className="panel" style={{ marginTop: 0 }}>
        <h2 className="ph2">Root causes <small>Themes from Agent 2</small></h2>
        {themes.length ? themes.map((t, i) => <BarRow key={t.k} label={t.k} value={t.v} max={themes[0].v} dim={i !== 0} />) : empty}
        <p className="small muted" style={{ marginTop: 10 }}>Root-cause text is grouped into themes by keyword.</p>
      </section>
    </div>

    <section className="panel" style={{ marginTop: 20 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div>
          <h2 className="ph2" style={{ marginBottom: 3 }}>How often reviews come in</h2>
          <div className="small muted">Reviews per {series.mode} · negative reviews highlighted</div>
        </div>
        {series.points.length > 0 && <div className="small muted" style={{ textAlign: "right" }}>
          Avg <b>{perPeriod}</b> per {series.mode}{peak ? <> · Peak <b>{peak.total}</b> ({peak.label})</> : null}
        </div>}
      </div>
      {series.points.length ? <>
        <TimeChart points={series.points} />
        <div className="legend"><span><i style={{ background: "var(--muted)" }} />All reviews</span><span><i style={{ background: "var(--crit)" }} />Negative</span></div>
        {series.undated > 0 && <p className="small muted" style={{ marginTop: 8 }}>{series.undated} review{series.undated === 1 ? "" : "s"} without a usable date are not shown.</p>}
      </> : <p className="muted" style={{ margin: 0 }}>No review dates available yet. Dates appear once reviews carry a timestamp.</p>}
    </section>

    <section className="panel" style={{ marginTop: 20 }}>
      <h2 className="ph2">Pattern map <small>Complaint category × doctor</small></h2>
      {heat.cats.length && heat.doctors.length ? <div className="scroll-x">
        <table>
          <thead><tr><th></th>{heat.doctors.map(d => <th key={d} style={{ fontSize: 12, textAlign: "center" }}>{d.split(" ").slice(0, 2).join(" ")}</th>)}</tr></thead>
          <tbody>{heat.cats.map(c => <tr key={c}>
            <td style={{ whiteSpace: "nowrap" }}><CatDot c={c} /></td>
            {heat.doctors.map(d => {
              const v = heat.cell[c + "||" + d] || 0;
              const pct = v ? Math.round(18 + 70 * v / (heat.max || 1)) : 0;
              return <td key={d} title={`${c} · ${d}: ${v}`} style={{ textAlign: "center", fontWeight: 600, background: v ? `color-mix(in srgb, var(--crit) ${pct}%, var(--surface-2))` : "transparent" }}>{v || "·"}</td>;
            })}
          </tr>)}</tbody>
        </table>
      </div> : empty}
      <p className="small muted" style={{ marginTop: 10 }}>Darker cells mean more negative reviews. Shows the top 6 doctors.</p>
    </section>
  </>;
}

/* ------------------------------ reviews ------------------------------ */
function Reviews({ reviews, open, pipelineStats }) {
  const [q, setQ] = useState(""); const [route, setRoute] = useState("All"); const [cat, setCat] = useState("All");
  const list = reviews.filter(r => (route === "All" || r.route === route) && (cat === "All" || r.category === cat) && (r.text + r.doctor + r.clinic).toLowerCase().includes(q.toLowerCase()));
  return <>
    <PageHead title="Reviews" sub="Every review, as sorted by the triage agent." />
    <div className="toolbar">
      <div><label className="fl" htmlFor="q">Search</label><input id="q" className="f" placeholder="Doctor, clinic or words in the review" value={q} onChange={e => setQ(e.target.value)} /></div>
      <div><label className="fl" htmlFor="rt">Route</label><select id="rt" className="f" value={route} onChange={e => setRoute(e.target.value)}><option>All</option><option>Investigation</option><option>Archive</option></select></div>
      <div><label className="fl" htmlFor="ct">Category</label><select id="ct" className="f" value={cat} onChange={e => setCat(e.target.value)}><option>All</option>{Object.keys(CAT).map(c => <option key={c}>{c}</option>)}</select></div>
    </div>
    <div className="panel"><div className="scroll-x"><table>
      <thead><tr><th>Review</th><th>Category</th><th>Severity</th><th>Source</th><th>Status</th></tr></thead>
      <tbody>{list.map(r => <tr key={r.id}>
        <td><button className="link" onClick={() => open(r)}>{r.doctor}</button> <span className="small muted">{r.id}</span><div className="clip">{r.text}</div></td>
        <td><CatDot c={r.category} /></td><td><Sev v={r.severity} /></td>
        <td className="muted">{r.source}<div className="small">{r.date}</div></td><td><Status s={r.status} /></td></tr>)}
        {list.length === 0 && <tr><td colSpan="5" className="muted">No live reviews match these filters. Clear filters, or check Settings → API connection and confirm GET /api/reviews returns review rows.</td></tr>}
      </tbody></table></div></div>
  </>;
}

/* ---------------------------- investigation -------------------------- */
function Investigation({ review, reviews, setStatus, setResponse, go, toast }) {
  if (!review) return <div className="panel">No case is selected. Open Reviews and select a live review. If Reviews is empty, check the API connection and confirm Agent 1 results are saved and returned by GET /api/reviews.</div>;
  const same = reviews.filter(r => r.doctor === review.doctor);
  const sameCat = same.filter(r => r.category === review.category);
  const avg = same.length ? (same.reduce((a, r) => a + r.severity, 0) / same.length).toFixed(1) : "–";
  const archived = review.route === "Archive";
  const stage = i => archived ? (i === 0 ? "done" : "skip") : i < 3 ? "done" : review.status === "approved" ? "done" : review.status === "rejected" ? "stop" : "now";
  const steps = ["Triage", "Investigation", "Action plan", "Approval"];
  return <>
    <button className="crumb" onClick={() => go("reviews")}>← Reviews</button>
    <PageHead title={review.doctor} sub={`${review.specialty}, ${review.clinic}. Case ${review.id}.`}><Status s={review.status} /></PageHead>
    <ol className="pipe" aria-label="Case progress">{steps.map((s, i) => <li key={s} className={stage(i)}><span className="n">{stage(i) === "done" ? <Icon n="check" size={14} /> : i + 1}</span>{s}</li>)}</ol>

    <div className="detail">
      <div>
        <section className="panel">
          <h2 className="ph2">Patient feedback</h2>
          <p className="quote">"{review.text}"</p>
          <p className="small muted">{review.source}, {review.date}</p>
        </section>
        <section className="panel">
          <h2 className="ph2">Triage result</h2>
          <dl className="facts" style={{ margin: 0 }}>
            <div><dt>Sentiment</dt><dd>{review.sentiment}</dd></div>
            <div><dt>Severity</dt><dd><Sev v={review.severity} /></dd></div>
            <div><dt>Category</dt><dd><CatDot c={review.category} /></dd></div>
            <div><dt>Next step</dt><dd>{review.route}</dd></div>
          </dl>
        </section>
        <section className="panel">
          <h2 className="ph2">Agent 2 — Investigation</h2>
          {review.summary && <>
            <div className="lab">Investigation summary</div>
            <p className="rootcause">{review.summary}</p>
          </>}
          <div className="lab">Likely root cause</div>
          <p className="rootcause">{review.rootCause}</p>
          <div className="lab">Evidence</div>
          <p className="muted">{review.evidence}</p>
        </section>
        <section className="panel">
          <h2 className="ph2">Agent 3 — Reply and action plans</h2>
          <div className="field"><label className="fl" htmlFor="reply">Public reply (editable)</label>
            <textarea id="reply" className="f" value={review.response} onChange={e => setResponse(review.id, e.target.value)} /></div>
          <div className="lab">Generated action plans ({review.actionPlans?.length || 0})</div>
          <ul className="checks">
            {(review.actions || []).map((a, i) =>
              <li key={`${review.id}-action-${i}`}>
                <Icon n="check" size={16} /><span>{a}</span>
              </li>
            )}
          </ul>
          {(review.actionPlans || []).map((plan, i) =>
            <div key={plan._key || i} className="rowline">
              <span>{plan.title || plan.objective || "Action plan"}</span>
              <span className="small muted">{plan.timeline || plan.owner_role || ""}{plan.confidence != null ? ` · ${Math.round(Number(plan.confidence) * 100)}% plan support` : ""}</span>
            </div>
          )}
        </section>
      </div>
      <aside>
        <section className="panel">
          <h2 className="ph2">AI confidence estimates</h2>
          <p className="small muted">Estimates only; not validated accuracy probabilities.</p>
          {[{ label: "Agent 1 · Triage consistency", value: review.triageConfidence }, { label: "Agent 2 · Root-cause assessment", value: review.confidence }, { label: "Agent 3 · Plan support", value: review.actionPlanConfidence }].map((item) => {
            const value = Math.max(0, Math.min(100, Math.round(Number(item.value || 0) * 100)));
            return <div key={item.label} style={{ marginTop: 14 }}>
              <div className="rowline" style={{ alignItems: "center", gap: 8 }}><span className="small">{item.label}</span><b>{Number(item.value || 0) > 0 ? `${value}%` : "Not available"}</b></div>
              <div className="track" style={{ margin: "7px 0 0" }}><div style={{ width: `${value}%` }} /></div>
            </div>;
          })}
          <p className="small muted" style={{ marginTop: 12 }}>Agent 1 uses review-text/rating consistency. Agent 2 uses its model-estimated root-cause confidence. Agent 3 combines Agent 2 confidence with plan completeness.</p>
        </section>
        <section className="panel">
          <h2 className="ph2">Ownership</h2>
          <div className="lab">Department</div><div><b>{review.department}</b></div>
          <div className="lab">Responsible lead</div><div><b>{review.lead}</b></div>
        </section>
        <section className="panel">
          <h2 className="ph2">Pattern for {review.doctor.split(" ").slice(0, 2).join(" ")}</h2>
          <div className="rowline"><span>Reviews on file</span><b>{same.length}</b></div>
          <div className="rowline"><span>{review.category} reviews</span><b>{sameCat.length}</b></div>
          <div className="rowline"><span>Average severity</span><b>{avg}</b></div>
          <div className="rowline"><span>Negative reviews</span><b>{same.filter(r => r.sentiment === "Negative").length}</b></div>
        </section>
      </aside>
    </div>

    <div className="decision">
      <p>{archived ? "This review needs no action." : "Nothing is sent until you decide."}</p>
      <div className="row">
        <button className="btn danger" disabled={archived} onClick={() => { setStatus(review.id, "rejected"); toast("Rejected. The case is closed."); }}>Reject</button>
        <button className="btn pri" disabled={archived} onClick={() => { setStatus(review.id, "approved"); toast("Approved. The reply is ready to send."); }}>Approve reply</button>
      </div>
    </div>
  </>;
}

/* ------------------------ action + approvals ------------------------- */
function Action({ reviews, open, actionPlans = [], pipelineStats }) {
  /*
    Agent 3 Action Center
    ---------------------
    Show the same structure as the Agent 3 output seen in Investigation,
    but for EVERY saved action-plan row returned by the backend.

    Data source:
      /api/action-plans
    No demo action plans are generated here.
  */

  const normalizedDirectPlans = normalizeActionPlans(actionPlans);

  const mappedPlans = reviews.flatMap(review =>
    (review.actionPlans || []).map((plan, index) => ({
      ...plan,
      _key: plan._key || `${review.id}-${index}`,
      reviewId: review.reviewId,
      reviewCase: review.id,
      doctor: review.doctor,
      specialty: review.specialty,
      clinic: review.clinic,
      category: review.category,
      reviewText: review.text,
      severity: review.severity,
      sentiment: review.sentiment,
      rootCause: review.rootCause,
      evidence: review.evidence,
      department: review.department,
      lead: review.lead,
      confidence: review.confidence,
      metrics: review.metrics,
    }))
  );

  const directPlans = normalizedDirectPlans.map((plan, index) => {
    const review = reviews.find(r => String(r.reviewId) === String(plan.review_id));

    return {
      ...plan,
      _key: plan._key || `${plan.review_id || "plan"}-${index}`,
      reviewId: plan.review_id,
      reviewCase: review?.id || `Case ${plan.review_id || index + 1}`,
      doctor: review?.doctor || firstValue(plan, ["doctor_name", "doctor"], "Patient case"),
      specialty: review?.specialty || firstValue(plan, ["specialty", "specialisation"], ""),
      clinic: review?.clinic || firstValue(plan, ["clinic", "hospital"], ""),
      category: review?.category || formatCategory(
        firstValue(plan, ["category", "negative_driver", "driver"], "Service Quality")
      ),
      reviewText: review?.text || "",
      severity: review?.severity || 1,
      sentiment: review?.sentiment || "Negative",
      rootCause: review?.rootCause || "",
      evidence: review?.evidence || "",
      department: review?.department || "",
      lead: review?.lead || "",
      confidence: review?.confidence || 0,
      metrics: review?.metrics || "",
    };
  });

  // Prefer the real backend rows. If the endpoint is temporarily unavailable,
  // use the action-plan rows already attached to the live reviews.
  // Never inject sample/presentation data into the live Action Center.
  // The page must reflect only rows returned by the API or plans attached to live reviews.
  const allPlans = directPlans.length ? directPlans : mappedPlans;
  const isDemo = false;

  // Group all Agent 3 outputs by review/case.
  const cases = [];
  const byReview = new Map();

  allPlans.forEach((plan, index) => {
    const key = String(plan.reviewId ?? plan.review_id ?? plan.reviewCase ?? `case-${index}`);

    if (!byReview.has(key)) {
      byReview.set(key, {
        key,
        reviewId: plan.reviewId,
        reviewCase: plan.reviewCase,
        doctor: plan.doctor,
        specialty: plan.specialty,
        clinic: plan.clinic,
        category: plan.category,
        severity: plan.severity,
        sentiment: plan.sentiment,
        reviewText: plan.reviewText,
        rootCause: plan.rootCause,
        evidence: plan.evidence,
        department: plan.department,
        lead: plan.lead,
        confidence: plan.confidence,
        metrics: plan.metrics,
        plans: [],
      });
    }

    byReview.get(key).plans.push(plan);
  });

  byReview.forEach(c => cases.push(c));

  const renderList = (value) => {
    if (!value) return <p className="muted">—</p>;

    const items = Array.isArray(value)
      ? value.map(String).filter(Boolean)
      : String(value)
        .split(/\n|•|\r/)
        .map(s => s.replace(/^[-*]\s*/, "").trim())
        .filter(Boolean);

    if (!items.length) return <p className="muted">—</p>;

    return (
      <ul style={{ margin: "8px 0 0 18px", padding: 0 }}>
        {items.map((item, i) => (
          <li key={i} style={{ marginBottom: 8, lineHeight: 1.45 }}>{item}</li>
        ))}
      </ul>
    );
  };

  const renderPlan = (plan, planIndex) => (
    <div
      key={plan._key || `${plan.reviewId}-${planIndex}`}
      className="panel"
      style={{ marginTop: 14 }}
    >
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div className="lab">ACTION PLAN {planIndex + 1}</div>
          <h3 style={{ margin: "5px 0 0" }}>
            {plan.objective || plan.title || "Improvement action"}
          </h3>
        </div>

        <span className={
          String(plan.priority || "").toLowerCase() === "high"
            ? "chip critical"
            : String(plan.priority || "").toLowerCase() === "medium"
              ? "chip pending"
              : "chip approved"
        }>
          {String(plan.priority || "UNSPECIFIED").toUpperCase()}
        </span>
      </div>

      <div className="grid3" style={{ gap: 14, marginTop: 16 }}>
        <div>
          <div className="lab">Immediate actions</div>
          {renderList(plan.immediate_actions)}
        </div>

        <div>
          <div className="lab">Corrective actions</div>
          {renderList(plan.corrective_actions)}
        </div>

        <div>
          <div className="lab">Preventive actions</div>
          {renderList(plan.preventive_actions)}
        </div>
      </div>

      <div className="grid3" style={{ gap: 14, marginTop: 16 }}>
        <div className="panel" style={{ marginTop: 0 }}>
          <div className="lab">Owner</div>
          <b>{plan.owner_role || "—"}</b>
        </div>

        <div className="panel" style={{ marginTop: 0 }}>
          <div className="lab">Timeline</div>
          <b>{plan.timeline || "—"}</b>
        </div>

        <div className="panel" style={{ marginTop: 0 }}>
          <div className="lab">Success metrics</div>
          {renderList(plan.success_metrics)}
        </div>
      </div>
    </div>
  );

  return <>
    <PageHead
      title="Action center"
      sub="Detailed Agent 3 action plans for every analyzed review."
    >
      {isDemo && <span className="chip pending">Presentation preview</span>}
    </PageHead>

    <div className="panel kpis">
      <div className="kpi">
        <div className="l">Analysis cases</div>
        <div className="v"><KpiVal v={pipelineStats?.analysisCases ?? cases.length} /></div>
        <div className="d">Reviews analyzed by Agent 2</div>
      </div>

      <div className="kpi">
        <div className="l">Action plans</div>
        <div className="v"><KpiVal v={allPlans.length} /></div>
        <div className="d">Actual Agent 3 outputs</div>
      </div>

      <div className="kpi">
        <div className="l">Plans per case</div>
        <div className="v">
          <KpiVal v={cases.length ? (allPlans.length / cases.length).toFixed(1) : "0"} />
        </div>
        <div className="d">Average generated per review</div>
      </div>

      <div className="kpi">
        <div className="l">Status</div>
        <div className="v">{allPlans.length ? "Ready" : "Waiting"}</div>
        <div className="d">Agent 3 results</div>
      </div>
    </div>

    {cases.length > 0 ? (
      <div style={{ marginTop: 20 }}>
        {cases.map((item, caseIndex) => (
          <section className="panel" key={item.key} style={{ marginBottom: 20 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div className="eyebrow">AGENT 3 · REPLY AND ACTION PLANS</div>
                <h2 className="ph2" style={{ margin: "6px 0" }}>
                  {item.doctor || "Patient case"}
                </h2>
                <div className="muted">
                  {item.reviewCase || `Case ${caseIndex + 1}`}
                  {item.specialty ? ` · ${item.specialty}` : ""}
                  {item.clinic ? ` · ${item.clinic}` : ""}
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <Sev v={Number(item.severity) || 1} />
                <div style={{ marginTop: 7 }}>
                  <CatDot c={item.category || "Service Quality"} />
                </div>
              </div>
            </div>

            {item.reviewText && (
              <div className="panel" style={{ marginTop: 16 }}>
                <div className="lab">Patient review</div>
                <p className="muted" style={{ whiteSpace: "pre-wrap", lineHeight: 1.55, marginBottom: 0 }}>
                  {item.reviewText}
                </p>
              </div>
            )}

            <div className="grid2" style={{ gap: 14, marginTop: 14 }}>
              <div className="panel" style={{ marginTop: 0 }}>
                <div className="lab">Agent 2 · Root cause</div>
                <p style={{ margin: "6px 0", lineHeight: 1.5 }}>
                  {item.rootCause || "—"}
                </p>
              </div>

              <div className="panel" style={{ marginTop: 0 }}>
                <div className="lab">Agent 2 · Evidence</div>
                <p className="muted" style={{ margin: "6px 0", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                  {item.evidence || "—"}
                </p>
              </div>
            </div>

            <div className="grid3" style={{ gap: 14, marginTop: 14 }}>
              <div>
                <div className="lab">Department</div>
                <b>{item.department || "—"}</b>
              </div>

              <div>
                <div className="lab">Responsible lead</div>
                <b>{item.lead || "—"}</b>
              </div>

              <div>
                <div className="lab">Confidence</div>
                <b>
                  {item.confidence
                    ? `${Math.round(Number(item.confidence) * 100)}%`
                    : "—"}
                </b>
              </div>
            </div>

            <div style={{ marginTop: 20 }}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0 }}>Agent 3 — Reply and action plans</h3>
                <span className="chip approved">
                  {item.plans.length} plan{item.plans.length === 1 ? "" : "s"}
                </span>
              </div>

              {item.plans.map(renderPlan)}
            </div>

            <div className="row" style={{ justifyContent: "flex-end", marginTop: 16 }}>
              <button
                className="btn"
                onClick={() => {
                  const review = reviews.find(
                    r => String(r.reviewId) === String(item.reviewId)
                  );
                  if (review) open(review);
                }}
              >
                Open investigation →
              </button>
            </div>
          </section>
        ))}
      </div>
    ) : (
      <div className="panel muted" style={{ marginTop: 20 }}>
        <b>Agent 3 output is being prepared.</b>
        <div style={{ marginTop: 6 }}>
          Connect <b>/api/action-plans</b> to replace the presentation preview with the saved Agent 3 results.
        </div>
      </div>
    )}
  </>;
}

function Approval({ reviews, setStatus, onDelete, open, toast }) {
  const [tab, setTab] = useState("pending");
  const list = reviews.filter(r => r.status === tab);
  const cnt = s => reviews.filter(r => r.status === s).length;
  const tabs = [["pending", "Awaiting approval"], ["approved", "Approved"], ["rejected", "Rejected"]];
  return <>
    <PageHead title="Approvals" sub="Check what the agents drafted before it goes out." />
    <div className="tabs" role="tablist">{tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l} ({cnt(k)})</button>)}</div>
    {list.length === 0 && <div className="panel muted">Nothing here yet.</div>}
    {list.map(r => <section key={r.id} className="panel">
      <div className="row" style={{ justifyContent: "space-between" }}><span><b>{r.doctor}</b> <span className="small muted">{r.id}</span></span><Sev v={r.severity} /></div>
      <div style={{ margin: "8px 0" }}><CatDot c={r.category} /></div>
      <p className="muted" style={{ marginBottom: 14 }}>{r.response}</p>
      <div className="row">
        {tab !== "approved" && <button className="btn pri" onClick={() => { setStatus(r.id, "approved"); toast("Approved " + r.id); }}>Approve</button>}
        {tab !== "rejected" && <button className="btn danger" onClick={() => { setStatus(r.id, "rejected"); toast("Rejected " + r.id); }}>Reject</button>}
        {tab === "rejected" && <button className="btn danger" onClick={() => onDelete(r)}>Delete permanently</button>}
        <button className="btn" onClick={() => open(r)}>Edit reply</button>
      </div></section>)}
  </>;
}

/* ------------------------------ reports ------------------------------ */
function Reports({ reviews }) {
  const by = key => { const m = {}; reviews.forEach(r => { (m[r[key]] ||= []).push(r.severity); }); return Object.entries(m).map(([k, a]) => ({ k, n: a.length, avg: a.reduce((x, y) => x + y, 0) / a.length })).sort((a, b) => b.avg - a.avg); };
  const Block = ({ title, rows }) => <section className="panel" style={{ marginTop: 0 }}><h2 className="ph2">{title}</h2>
    {rows.map(r => <div className="hb" key={r.k}><div className="t"><span>{r.k} <span className="small muted">({r.n})</span></span><b>{r.avg.toFixed(1)}</b></div><div className="track"><div style={{ width: r.avg / 5 * 100 + "%" }} /></div></div>)}</section>;
  return <>
    <PageHead title="Reports" sub="Average severity out of 5, with the number of reviews in brackets." />
    <div className="grid2"><Block title="By doctor" rows={by("doctor")} /><Block title="By clinic" rows={by("clinic")} /><Block title="By department" rows={by("department")} /><Block title="By source" rows={by("source")} /></div>
  </>;
}

/* ------------------------------ settings ----------------------------- */
function Switch({ on, onChange, label, disabled }) { return <button role="switch" aria-checked={on} aria-label={label} disabled={disabled} className="sw" onClick={() => onChange(!on)} />; }
function Settings({ settings, setSettings, toast }) {
  const [draft, setDraft] = useState(settings);
  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }));

  useEffect(() => {
    applyTheme(draft.theme);
    if (draft.theme !== "system" || !window.matchMedia) return;
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => applyTheme("system");
    media.addEventListener?.("change", onChange);
    return () => media.removeEventListener?.("change", onChange);
  }, [draft.theme]);
  const src = (k, v) => setDraft(d => ({ ...d, sources: { ...d.sources, [k]: v } }));
  return <>
    <PageHead title="Settings" sub="Choose what AegisCare watches and how it behaves." />
    <div className="panel">
      <div className="setrow"><div><h3>Organisation</h3><p>Shown on reports and in alert emails.</p></div>
        <div><div className="field"><label className="fl" htmlFor="org">Organisation name</label><input id="org" className="f" value={draft.org} onChange={e => set("org", e.target.value)} /></div>
          <div className="field"><label className="fl" htmlFor="em">Alert email</label><input id="em" type="email" className="f" placeholder="you@your-domain.com" value={draft.email} onChange={e => set("email", e.target.value)} /></div>
          <div className="field"><div className="fl">Theme</div><div className="seg">{["system", "light", "dark"].map(t => <button key={t} className={draft.theme === t ? "on" : ""} onClick={() => set("theme", t)}>{t[0].toUpperCase() + t.slice(1)}</button>)}</div></div></div></div>
      <div className="setrow"><div><h3>Review sources</h3><p>Reviews are collected from the sources you turn on.</p></div>
        <div>{Object.keys(draft.sources).map(k => <div className="tog" key={k}><span>{k}</span><Switch on={draft.sources[k]} onChange={v => src(k, v)} label={k} /></div>)}</div></div>
      <div className="setrow"><div><h3>Agents</h3><p>Control when a review is escalated and how replies are drafted.</p></div>
        <div><div className="field"><label className="fl" htmlFor="sev">Investigate reviews at severity {draft.threshold} or higher</label>
          <input id="sev" type="range" min="1" max="5" value={draft.threshold} onChange={e => set("threshold", +e.target.value)} style={{ width: "100%", accentColor: "var(--brand)" }} /></div>
          <div className="tog"><span>Draft replies automatically<small>The action agent writes a reply for each case.</small></span><Switch on={draft.autoDraft} onChange={v => set("autoDraft", v)} label="Draft replies automatically" /></div>
          <div className="tog"><span>Require human approval<small>Always on for patient-facing replies.</small></span><Switch on={true} disabled onChange={() => { }} label="Require human approval" /></div></div></div>
      <div className="setrow"><div><h3>Notifications</h3><p>Choose which emails you receive.</p></div>
        <div><div className="tog"><span>Alert me to severity 4 and 5 cases</span><Switch on={draft.notifyHigh} onChange={v => set("notifyHigh", v)} label="Severity alerts" /></div>
          <div className="tog"><span>Send a weekly summary</span><Switch on={draft.weekly} onChange={v => set("weekly", v)} label="Weekly summary" /></div></div></div>
      <div className="setrow"><div><h3>API connection</h3><p>The backend that runs the three agents.</p></div>
        <div className="field"><label className="fl" htmlFor="api">API base URL</label><input id="api" className="f" value={draft.api} onChange={e => set("api", e.target.value)} /></div></div>
    </div>
    <div className="row" style={{ marginTop: 20 }}>
      <button className="btn pri" onClick={() => { setSettings(draft); toast("Settings saved"); }}>Save settings</button>
      <button className="btn" onClick={() => setDraft(settings)}>Discard changes</button>
    </div>
  </>;
}

/* -------------------------------- about ------------------------------- */
function About({ go }) {
  return <>
    <PageHead title="About AegisCare AI" sub="Turning patient voices into clearer insights and better care." />
    <section className="panel" style={{ padding: "clamp(24px,4vw,48px)", marginBottom: 18, background: "radial-gradient(circle at 90% 10%, rgba(190,133,200,.15), transparent 34%),var(--surface)" }}>
      <span className="hero-eyebrow">OUR PURPOSE</span>
      <h2 style={{ fontSize: "clamp(28px,4vw,44px)", lineHeight: 1.15, maxWidth: 820, margin: "14px 0" }}>Better care begins with listening.</h2>
      <p className="muted" style={{ fontSize: 17, lineHeight: 1.8, maxWidth: 850 }}>AegisCare AI is a patient-experience intelligence platform designed to help healthcare teams make sense of hospital reviews. It organizes patient feedback into clear signals, highlights issues that may need attention, and helps teams plan practical service improvements.</p>
      <div className="row" style={{ marginTop: 24, flexWrap: "wrap" }}>
        <button className="btn pri" onClick={() => go("dashboard")}>Explore the dashboard <span aria-hidden="true">↗</span></button>
        <button className="btn" onClick={() => go("try")}>Try the workflow <span aria-hidden="true">→</span></button>
      </div>
    </section>
    <div className="cols" style={{ alignItems: "stretch" }}>
      <section className="panel">
        <span className="hero-eyebrow">OUR MISSION</span>
        <h2 className="ph2" style={{ marginTop: 12 }}>Make patient feedback actionable</h2>
        <p className="muted" style={{ lineHeight: 1.8 }}>Patient reviews can reveal recurring concerns about communication, waiting times, facilities, billing, and the overall care experience. AegisCare helps teams move beyond reading reviews one by one toward structured review, investigation, and follow-through.</p>
      </section>
      <section className="panel">
        <span className="hero-eyebrow">OUR APPROACH</span>
        <h2 className="ph2" style={{ marginTop: 12 }}>From feedback to follow-through</h2>
        <p className="muted" style={{ lineHeight: 1.8 }}>The platform supports a workflow that triages reviews, investigates underlying causes, and proposes corrective and preventive actions for teams to review. AI-generated insights are intended to support human decision-making, not replace clinical judgment.</p>
      </section>
    </div>
    <section className="panel" style={{ marginTop: 18 }}>
      <span className="hero-eyebrow">THE AEGISCARE WORKFLOW</span>
      <div className="cols" style={{ marginTop: 18, alignItems: "stretch" }}>
        <div><div className="feature-icon" style={{ marginBottom: 12 }}>01</div><h3>Intake &amp; triage</h3><p className="muted" style={{ lineHeight: 1.7 }}>Identify sentiment, severity, complaint category, and the appropriate route for each review.</p></div>
        <div><div className="feature-icon" style={{ marginBottom: 12 }}>02</div><h3>Investigation</h3><p className="muted" style={{ lineHeight: 1.7 }}>Examine evidence and contextual factors to identify possible root causes and accountable teams.</p></div>
        <div><div className="feature-icon" style={{ marginBottom: 12 }}>03</div><h3>Action planning</h3><p className="muted" style={{ lineHeight: 1.7 }}>Turn findings into proposed immediate, corrective, and preventive actions with ownership and measures of success.</p></div>
      </div>
    </section>
  </>;
}

/* ------------------------------ contact ------------------------------ */
function Contact() {
  const [f, setF] = useState({ name: "", email: "", topic: "Product demo", msg: "" }); const [sent, setSent] = useState(false);
  const ok = f.name && /\S+@\S+\.\S+/.test(f.email) && f.msg;
  const c = PLACEHOLDER.contact;
  return <>
    <PageHead title="Contact us" sub="Questions, a demo, or a problem with a review? Tell us." />
    <div className="cols">
      <section className="panel">
        {sent ? <div><h2 className="ph2">Message ready</h2><p className="muted" style={{ marginBottom: 14 }}>This form has no backend yet. Connect it to your API or email service to deliver messages.</p><button className="btn" onClick={() => setSent(false)}>Write another</button></div> : <>
          <div className="field"><label className="fl" htmlFor="n">Name</label><input id="n" className="f" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></div>
          <div className="field"><label className="fl" htmlFor="e">Email</label><input id="e" type="email" className="f" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></div>
          <div className="field"><label className="fl" htmlFor="t">Topic</label><select id="t" className="f" value={f.topic} onChange={e => setF({ ...f, topic: e.target.value })}><option>Product demo</option><option>Pricing</option><option>Technical support</option><option>Partnership</option></select></div>
          <div className="field"><label className="fl" htmlFor="m">Message</label><textarea id="m" className="f" rows="5" value={f.msg} onChange={e => setF({ ...f, msg: e.target.value })} /></div>
          <button className="btn pri" disabled={!ok} onClick={() => setSent(true)}>Send message</button></>}
      </section>
      <section className="panel">
        <h2 className="ph2">Details</h2>
        {[["Email", c.email], ["Phone", c.phone], ["Address", c.address], ["Hours", c.hours]].map(([l, v]) => <div key={l} className="rowline"><span className="muted">{l}</span><b style={{ textAlign: "right" }}>{v}</b></div>)}
        <p className="small muted" style={{ marginTop: 14 }}>Placeholder details. Edit them in PLACEHOLDER.contact.</p>
      </section>
    </div>
  </>;
}

/* --------------------------- accounts & roles --------------------------- */
const ROLE_LABEL = { patient: "Patient", doctor: "Doctor", organization: "Organization" };
const ROLE_OPTIONS = [
  { key: "patient", title: "Patient", desc: "I want to understand hospital and doctor reviews before choosing care." },
  { key: "doctor", title: "Doctor", desc: "I want to see what patients say about me and my clinic." },
  { key: "organization", title: "Organization", desc: "I represent a hospital, clinic or health group and manage patient feedback." },
];
const ORG_TYPES = ["Hospital", "Clinic", "Hospital group / chain", "Diagnostic centre", "Other"];
const EMPTY_AUTH = { signedIn: false, email: "", name: "", picture: "", businessConnected: false, onboarded: false, role: "", profile: {}, isAdmin: false };

function mapAuth(data) {
  const user = data?.user || {};
  return {
    signedIn: !!data?.signed_in,
    email: data?.email || user.email || "",
    name: user.name || data?.name || "",
    picture: user.picture || data?.picture || "",
    businessConnected: !!(data?.business_profile_connected || user.business_profile_connected),
    onboarded: !!data?.onboarded,
    role: data?.role || "",
    profile: data?.profile || {},
    isAdmin: !!data?.is_admin,
  };
}

// Accounts that keep seeing the original, full review-management console
// (Dashboard/Reviews/Investigation/Action center/Reports/Approvals with all
// existing data) instead of the newer, simplified Organization landing page.
const FULL_ACCESS_EMAILS = ["dhanyashreemv63@gmail.com"];
function hasFullAccess(auth) {
  return !!auth?.signedIn && FULL_ACCESS_EMAILS.includes(String(auth.email || "").trim().toLowerCase());
}

function Onboarding({ apiBaseUrl = API.baseUrl, auth, go, onSaved }) {
  const p = auth?.profile || {};
  const editing = !!auth?.onboarded;
  const [role, setRole] = useState(p.role || "");
  const [form, setForm] = useState({ org_name: p.org_name || "", org_type: p.org_type || "", designation: p.designation || "", specialty: p.specialty || "", city: p.city || "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const base = String(apiBaseUrl || API.baseUrl).trim().replace(/\/+$/, "");

  const submit = async () => {
    setErr("");
    if (!role) { setErr("Choose who you are to continue."); return; }
    if (role === "doctor" && !form.specialty.trim()) { setErr("Enter your specialty."); return; }
    if (role === "doctor" && !form.org_name.trim()) { setErr("Enter the hospital or clinic you practise at."); return; }
    if (role === "organization" && !form.org_name.trim()) { setErr("Enter your organization's name."); return; }
    const payload = role === "patient" ? { role, city: form.city, specialty: auth?.role === "patient" ? (p.specialty || "") : "" }
      : role === "doctor" ? { role, specialty: form.specialty, org_name: form.org_name, city: form.city }
        : { role, org_name: form.org_name, org_type: form.org_type, designation: form.designation, city: form.city };
    setBusy(true);
    try {
      const res = await apiFetch(`${base}/profile`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : `Could not save your profile (${res.status}).`);
      onSaved(data);
    } catch (e) { setErr(e.message || "Could not save your profile."); }
    finally { setBusy(false); }
  };

  const field = (id, label, key, placeholder) => <div className="field" style={{ textAlign: "left" }}>
    <label className="fl" htmlFor={id}>{label}</label>
    <input id={id} className="f" value={form[key]} onChange={e => set(key, e.target.value)} placeholder={placeholder} style={{ width: "100%", boxSizing: "border-box" }} />
  </div>;

  return <section className="panel" style={{ maxWidth: 640, margin: "40px auto", padding: 32 }}>
    <p className="n" style={{ letterSpacing: ".12em", textAlign: "center" }}>{editing ? "YOUR PROFILE" : "ONE LAST STEP"}</p>
    <h1 style={{ fontSize: 30, margin: "10px 0", textAlign: "center" }}>{editing ? "Edit your profile" : `Welcome${auth?.name ? ", " + auth.name.split(" ")[0] : ""}. Who are you?`}</h1>
    <p className="muted" style={{ lineHeight: 1.7, textAlign: "center", marginBottom: 22 }}>We use this to set up a dashboard that fits you. Everything you analyse stays in your own account.</p>

    <div style={{ display: "grid", gap: 12, marginBottom: 22 }} role="radiogroup" aria-label="I am a">
      {ROLE_OPTIONS.map(o => <button key={o.key} type="button" className="pfx-role" role="radio" aria-checked={role === o.key} onClick={() => setRole(o.key)}
        style={{
          textAlign: "left", padding: "14px 16px", borderRadius: 12, cursor: "pointer", color: "var(--text)", background: "var(--surface)",
          border: role === o.key ? "2px solid var(--brand)" : "1px solid var(--line)"
        }}>
        <div style={{ fontWeight: 600, fontSize: 16 }}>{o.title}</div>
        <div className="small muted" style={{ marginTop: 3 }}>{o.desc}</div>
      </button>)}
    </div>

    {role && <div style={{ display: "grid", gap: 14 }}>
      {role === "doctor" && <>
        {field("ob-specialty", "Specialty", "specialty", "e.g. Cardiology")}
        {field("ob-clinic", "Hospital / clinic you practise at", "org_name", "e.g. Apollo Clinic")}
      </>}
      {role === "organization" && <>
        {field("ob-org", "Organization name", "org_name", "e.g. City Care Hospitals")}
        <div className="field" style={{ textAlign: "left" }}>
          <label className="fl" htmlFor="ob-orgtype">Organization type</label>
          <select id="ob-orgtype" className="f" value={form.org_type} onChange={e => set("org_type", e.target.value)} style={{ width: "100%", boxSizing: "border-box" }}>
            <option value="">Select type (optional)</option>
            {ORG_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        {field("ob-designation", "Your role in the organization", "designation", "e.g. Head of Patient Experience")}
      </>}
      {field("ob-city", "City (optional)", "city", "e.g. New Delhi")}
    </div>}

    {err && <p role="alert" style={{ color: "var(--crit)", margin: "16px 0 0" }}>{err}</p>}
    <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 24 }}>
      {editing && <button className="btn" onClick={() => go("dashboard")} disabled={busy}>Cancel</button>}
      <button className="btn pri" onClick={submit} disabled={busy} style={{ minWidth: 180 }}>{busy ? "Saving…" : editing ? "Save changes" : "Continue to dashboard →"}</button>
    </div>
  </section>;
}


/* ---- small dependency-free pie chart (SVG) ---- */
const PIE_COLORS = ["#c48fc8", "#7fb2e5", "#8ccf9f", "#e5c07b", "#e58f8f", "#9d9be0"];
function PieChart({ data = [], size = 190, emptyText = "Nothing to show yet" }) {
  const items = data.filter(d => Number(d.value) > 0);
  const total = items.reduce((a, d) => a + Number(d.value), 0);
  const c = size / 2, r = size / 2 - 6;
  let angle = -Math.PI / 2;
  const pt = a => [c + r * Math.cos(a), c + r * Math.sin(a)];
  const slices = items.map((d, i) => {
    const frac = d.value / total, start = angle, end = angle + frac * 2 * Math.PI;
    angle = end;
    const [x1, y1] = pt(start), [x2, y2] = pt(end);
    return {
      ...d, frac, color: d.color || PIE_COLORS[i % PIE_COLORS.length],
      path: `M${c} ${c} L${x1.toFixed(2)} ${y1.toFixed(2)} A${r} ${r} 0 ${frac > 0.5 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`
    };
  });
  const summary = total ? slices.map(s => `${s.label}: ${s.value}`).join(", ") : emptyText;
  return <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
    <svg className="pfx-pie" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Pie chart. ${summary}`}>
      {total === 0
        ? <circle cx={c} cy={c} r={r - 7} fill="none" stroke="var(--line)" strokeWidth="14" strokeDasharray="4 6" />
        : slices.length === 1
          ? <circle cx={c} cy={c} r={r} fill={slices[0].color} />
          : slices.map(s => <path key={s.label} className="pfx-slice" style={{ transformOrigin: `${c}px ${c}px` }} d={s.path} fill={s.color} stroke="var(--surface)" strokeWidth="2" />)}
    </svg>
    <div style={{ display: "grid", gap: 8, minWidth: 160 }}>
      {total === 0 ? <span className="small muted">{emptyText}</span>
        : slices.map(s => <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <i style={{ width: 12, height: 12, borderRadius: 3, background: s.color, display: "inline-block", flexShrink: 0 }} />
          <span>{s.label}</span>
          <b style={{ marginLeft: "auto", paddingLeft: 12 }}>{s.value} <span className="small muted">({Math.round(s.frac * 100)}%)</span></b>
        </div>)}
    </div>
  </div>;
}

/* ---- separate Appointments page for patients ---- */
function PatientAppointments({ apiBaseUrl = API.baseUrl, go, prefill, clearPrefill, prefs, defaultSpecialty }) {
  const base = String(apiBaseUrl || API.baseUrl).trim().replace(/\/+$/, "");
  const blank = { provider_name: "", specialty: "", appointment_date: "", appointment_time: "", reason: "" };
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(() => ({ ...blank, provider_name: prefill?.provider_name || "", specialty: prefill?.specialty || defaultSpecialty || "", appointment_time: TIME_PREF[prefs?.patientTimePref] || "" }));
  const [hospital] = useState(() => prefill ? { name: prefill.provider_name || "", mapsUrl: prefill.maps_url || "", city: prefill.city || "" } : null);
  const [avail, setAvail] = useState(null);
  const [availBusy, setAvailBusy] = useState(false);
  const [availErr, setAvailErr] = useState("");
  const autoChecked = useRef(false);
  const safeUrl = (u) => /^https?:\/\//i.test(u || "") ? u : null;
  const checkAvailability = async (refresh = false) => {
    const nm = form.provider_name.trim();
    if (!nm) { setAvailErr("Enter a doctor or hospital name first."); return; }
    setAvailErr(""); setAvailBusy(true);
    try {
      const res = await apiFetch(`${base}/patient/hospital-availability`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: nm, city: hospital?.city || "", specialty: form.specialty || "", maps_url: hospital && hospital.name === nm ? hospital.mapsUrl : "", refresh }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || `Could not check the hospital (${res.status}).`);
      setAvail(data);
    } catch (err) { setAvailErr(err.message || "Could not check the hospital."); setAvail(null); }
    finally { setAvailBusy(false); }
  };
  const chosenDay = form.appointment_date ? new Date(form.appointment_date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long" }) : "";
  const dayRow = avail?.hours?.find(h => h.day === chosenDay);
  const dayClosed = !!dayRow && /closed/i.test(dayRow.hours);
  const [showBooking, setShowBooking] = useState(!!prefill);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const dateLabel = (v) => v ? String(v).slice(0, 10) : "—";
  const load = async () => {
    try {
      const res = await apiFetch(`${base}/appointments`);
      if (res.ok) { const d = await res.json(); setAppointments(d.items || []); }
    } catch (e) { console.warn("Appointments load failed", e); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); if (prefill && clearPrefill) clearPrefill(); }, [base]);
  useEffect(() => { if (prefs?.patientAutoCheck !== false && prefill?.provider_name && !autoChecked.current) { autoChecked.current = true; checkAvailability(false); } }, []);
  const book = async (e) => {
    e.preventDefault(); setError(""); setNotice("");
    if (!form.provider_name.trim() || !form.appointment_date || !form.appointment_time) { setError("Please enter a doctor/clinic, date, and preferred time."); return; }
    setBusy(true);
    try {
      const res = await apiFetch(`${base}/appointments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || `Could not save appointment request (${res.status}).`);
      setForm(blank); setShowBooking(false); setNotice("Your appointment request has been saved. Please confirm the slot with the hospital using the options above.");
      await load();
    } catch (err) { setError(err.message || "Could not save appointment request."); }
    finally { setBusy(false); }
  };
  return <div className="page">
    <PageHead title="Appointments" sub="Request a visit with a doctor or clinic and keep track of what you've submitted.">
      <button className="btn" onClick={() => go("patient-dashboard")}>← Back to My care</button>
    </PageHead>
    <section className="panel" style={{ marginBottom: 20 }}>
      <p className="n">HOSPITAL AVAILABILITY</p><h2 className="ph2">Check with the hospital</h2>
      <p className="small muted" style={{ lineHeight: 1.6 }}>We look up the hospital's official website, phone and opening hours. Live doctor slots can't be read automatically for most hospitals, so finish booking on their own page or by phone.</p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
        <button className="btn pri" onClick={() => checkAvailability(false)} disabled={availBusy || !form.provider_name.trim()}>{availBusy ? "Checking the hospital's website…" : "Check availability"}</button>
        {avail && !availBusy && <button className="btn" onClick={() => checkAvailability(true)}>Refresh</button>}
      </div>
      {availBusy && <p className="small muted" style={{ marginTop: 10 }}>This can take up to 30 seconds.</p>}
      {availErr && <p role="alert" style={{ color: "var(--crit)", marginTop: 10 }}>{availErr}</p>}
      {avail && avail.found === false && <p className="small muted" style={{ marginTop: 10 }}>{(avail.warnings || []).join(" ") || "No information found for this hospital."}</p>}
      {avail && avail.found && <div style={{ display: "grid", gap: 16, marginTop: 16 }}>
        <div>
          <b>{avail.hospital?.name}</b>
          {avail.hospital?.address && <div className="small muted">{avail.hospital.address}</div>}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
            {safeUrl(avail.booking_url) && <a className="btn pri" href={safeUrl(avail.booking_url)} target="_blank" rel="noopener noreferrer">Open hospital booking page ↗</a>}
            {safeUrl(avail.hospital?.website) && <a className="btn" href={safeUrl(avail.hospital.website)} target="_blank" rel="noopener noreferrer">Hospital website ↗</a>}
            {avail.hospital?.phone && <a className="btn" href={"tel:" + avail.hospital.phone.replace(/[^\d+]/g, "")}>Call {avail.hospital.phone}</a>}
            {safeUrl(avail.hospital?.maps_url) && <a className="btn" href={safeUrl(avail.hospital.maps_url)} target="_blank" rel="noopener noreferrer">Google Maps ↗</a>}
          </div>
          {!safeUrl(avail.booking_url) && <p className="small muted" style={{ marginTop: 8 }}>No online booking page was found{avail.hospital?.phone ? " — please call to book." : "."}</p>}
        </div>
        {chosenDay && dayRow && <p role="status" style={{ margin: 0, color: dayClosed ? "var(--crit)" : "var(--good)" }}>{dayClosed ? `Listed as closed on ${chosenDay}. Please choose another date.` : `Listed hours on ${chosenDay}: ${dayRow.hours}. Confirm the doctor's slot with the hospital.`}</p>}
        {avail.hours?.length > 0 && <div><b className="small">Opening hours</b><div className="small muted" style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "2px 16px", marginTop: 6 }}>{avail.hours.map(h => <React.Fragment key={h.day}><span>{h.day}</span><span>{h.hours}</span></React.Fragment>)}</div></div>}
        {avail.timings?.length > 0 && <div><b className="small">OPD timings from the hospital's website</b>{avail.timings.map((t, i) => <div key={i} className="small muted" style={{ marginTop: 4 }}>{t}</div>)}</div>}
        <div><b className="small">Doctors listed on the hospital's website</b>
          {avail.doctors?.length > 0
            ? <div style={{ display: "grid", gap: 4, marginTop: 6 }}>{avail.doctors.map(d => <div key={d.name} className="small"><b>{d.name}</b>{d.detail && <span className="muted"> · {d.detail}</span>}</div>)}
              {!avail.doctors_specialty_filtered && <span className="small muted">Couldn't match these to your specialty, so this is the start of their list.</span>}</div>
            : <p className="small muted" style={{ margin: "6px 0 0" }}>No doctor list could be read automatically.{safeUrl(avail.doctors_url) && <> <a href={safeUrl(avail.doctors_url)} target="_blank" rel="noopener noreferrer">Open their doctors page ↗</a></>}</p>}
        </div>
        {(avail.warnings || []).map((w, i) => <p key={i} className="small" style={{ margin: 0, color: "var(--warn, #e5c07b)" }}>{w}</p>)}
        <p className="small muted" style={{ margin: 0 }}>{avail.cached ? "Saved information from a recent check. Use Refresh for the latest." : "Checked just now."} AegisCare cannot confirm a doctor's slot; the hospital does.</p>
      </div>}
    </section>
    <div className="grid2" style={{ alignItems: "start", marginBottom: 20 }}>
      <section className="panel"><p className="n">BOOKING REQUEST</p><h2 className="ph2">Request an appointment</h2>
        <p className="small muted">Choose a provider from your care search or enter one manually. This saves a request; it does not confirm a real clinic booking.</p>
        {notice && !showBooking && <p role="status" style={{ color: "var(--good)", marginTop: 12 }}>{notice}</p>}
        {!showBooking && <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
          <button className="btn pri" onClick={() => { setShowBooking(true); setNotice(""); }}>Start appointment request</button>
          <button className="btn" onClick={() => go("patient-dashboard")}>Find a provider first</button>
        </div>}
        {showBooking && <form onSubmit={book} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14, marginTop: 18 }}>
          <div className="field"><label className="fl" htmlFor="ap-provider">Doctor / clinic name *</label><input id="ap-provider" className="f" value={form.provider_name} onChange={e => setField("provider_name", e.target.value)} required placeholder="e.g. Dr. Priya Sharma" /></div>
          <div className="field"><label className="fl" htmlFor="ap-spec">Specialty</label><input id="ap-spec" className="f" value={form.specialty} onChange={e => setField("specialty", e.target.value)} placeholder="e.g. ENT" /></div>
          <div className="field"><label className="fl" htmlFor="ap-date">Preferred date *</label><input id="ap-date" className="f" type="date" min={new Date().toISOString().slice(0, 10)} value={form.appointment_date} onChange={e => setField("appointment_date", e.target.value)} required /></div>
          <div className="field"><label className="fl" htmlFor="ap-time">Preferred time *</label><input id="ap-time" className="f" type="time" value={form.appointment_time} onChange={e => setField("appointment_time", e.target.value)} required /></div>
          <div className="field" style={{ gridColumn: "1/-1" }}><label className="fl" htmlFor="ap-reason">Reason for visit (optional)</label><textarea id="ap-reason" className="f" rows="3" value={form.reason} onChange={e => setField("reason", e.target.value)} placeholder="What you're experiencing, for how long, and any questions you want answered" /></div>
          {error && <p role="alert" style={{ color: "var(--crit)", gridColumn: "1/-1" }}>{error}</p>}
          <div style={{ gridColumn: "1/-1", display: "flex", gap: 10 }}><button className="btn pri" type="submit" disabled={busy}>{busy ? "Saving…" : "Save appointment request"}</button><button className="btn" type="button" onClick={() => { setShowBooking(false); setError(""); }} disabled={busy}>Cancel</button></div>
        </form>}
      </section>
      <section className="panel"><p className="n">YOUR APPOINTMENTS</p><h2 className="ph2">Recent requests</h2>
        {loading ? <p className="muted small" style={{ marginTop: 12 }}>Loading…</p>
          : appointments.length ? <div style={{ display: "grid", gap: 12, marginTop: 12 }}>{appointments.map((a, ai) => <div key={a.id} className="pfx-item" style={{ "--i": ai, borderTop: "1px solid var(--line)", paddingTop: 12 }}><b>{a.provider_name}</b><div className="small muted">{a.specialty || "Doctor / clinic"} · {dateLabel(a.appointment_date)} · {a.appointment_time}</div><span className="chip">{a.status || "requested"}</span><ApptTrack status={a.status} />{a.reason && <p className="small muted">{a.reason}</p>}</div>)}</div>
            : <EmptyArt kind="calendar" title="No appointment requests yet" text="Choose a hospital from Find care to send your first request." />}
      </section>
    </div>
    <PrepTips topic={bestPrepTopic(form.specialty, hospital?.name)} />
  </div>;
}

/* ---- "Popular for you" + creative health tips, driven by the patient's usual type of care ---- */
const CARE_TIPS = {
  "Dentist": { habit: "Brushed morning and night", tips: [
    { e: "🎵", h: "Brush to a two-minute playlist", b: "Hum a favourite song through twice, about two minutes, every morning and night. Short brushing misses more than you think." },
    { e: "🧵", h: "Floss is a daily date", b: "Your brush can't reach the tight gaps between teeth. Floss or use tiny interdental brushes once a day." },
    { e: "🥤", h: "Sip less, not longer", b: "Sugary or fizzy drinks all day keep teeth under attack. Have them with meals and chase them with water." },
    { e: "🪥", h: "Retire your brush", b: "Swap your brush head every three months, or sooner once the bristles splay out like a tired paintbrush." },
    { e: "🫧", h: "Spit, don't rinse", b: "After brushing, spit out the foam but skip the big rinse so the fluoride keeps protecting your teeth." },
  ] },
  "General Physician": { habit: "Drank enough water and moved", tips: [
    { e: "💧", h: "Pale-gold is the goal", b: "Pale yellow urine is a handy sign you're drinking enough. Keep a bottle where you can see it." },
    { e: "🌈", h: "Colour your plate", b: "Aim for several colours of fruit and vegetables each day. Each colour brings different nutrients." },
    { e: "😴", h: "Protect your sleep", b: "Most adults do best on 7 to 9 hours. A steady bedtime does more than one long lie-in." },
    { e: "📋", h: "Know your numbers", b: "Blood pressure, blood sugar and weight are worth checking regularly. Ask your doctor how often suits you." },
  ] },
  "ENT": { habit: "Gave my ears a break from loud sound", tips: [
    { e: "🎧", h: "The 60/60 rule", b: "Keep headphone volume at or below about 60% and take a break after around 60 minutes." },
    { e: "🚫", h: "Don't dig, don't poke", b: "Skip cotton buds and sharp objects inside the ear canal. Ears clean themselves." },
    { e: "👃", h: "Gentle nose, one side at a time", b: "Blow one nostril at a time and gently. Forceful blowing can push mucus towards your ears." },
    { e: "🗣️", h: "Treat your voice like an instrument", b: "Sip water, rest after long talking, and avoid shouting over noise." },
  ] },
  "Ophthalmology": { habit: "Took screen eye-breaks", tips: [
    { e: "👀", h: "20-20-20", b: "Every 20 minutes, look at something 20 feet away for 20 seconds. Your focusing muscles will thank you." },
    { e: "🕶️", h: "Sunglasses are sunscreen for eyes", b: "Choose lenses that block UV, and wear them on bright days and near water." },
    { e: "🖐️", h: "Hands off", b: "Rubbing irritates and can spread germs. Use a clean cool compress or lubricating drops if your doctor agrees." },
    { e: "😌", h: "Blink on purpose", b: "We blink less on screens. A slow, full blink now and then keeps eyes comfortable." },
  ] },
  "Dermatology": { habit: "Wore sunscreen", tips: [
    { e: "☀️", h: "Sunscreen is the daily armour", b: "Use broad-spectrum SPF 30 or higher, and reapply every two hours outdoors." },
    { e: "🚿", h: "Lukewarm, not lava", b: "Very hot showers strip skin oils. Keep them short, then moisturise while skin is still damp." },
    { e: "🗺️", h: "Map your moles", b: "Once a month, look for new spots or ones that change in size, shape or colour, and show anything unusual to a doctor." },
    { e: "🧴", h: "Less is more", b: "A gentle cleanser and a moisturiser beat a long routine of strong products." },
  ] },
  "Cardiology": { habit: "Moved for 30 minutes", tips: [
    { e: "🚶", h: "Make your heart sweat a little", b: "Brisk walking for about 150 minutes a week is a classic target. Split it into 10-minute bursts if that's easier." },
    { e: "🧂", h: "Be salt-savvy", b: "Packaged food hides a lot of salt. Check labels and taste before you add more." },
    { e: "🔢", h: "Know your pressure", b: "Blood pressure usually has no symptoms. Ask how often you should check it." },
    { e: "🚭", h: "Smoke-free is heart-friendly", b: "Stopping smoking is one of the biggest single gifts to your heart, at any age." },
  ] },
  "Gastroenterology": { habit: "Ate slowly and drank water", tips: [
    { e: "🍽️", h: "Chew like a food critic", b: "Slow, well-chewed meals are easier on your stomach and help you notice when you're full." },
    { e: "🌾", h: "Fibre plus water", b: "Fruit, vegetables, pulses and whole grains work best when you drink enough fluid with them." },
    { e: "⏰", h: "Keep a meal rhythm", b: "Regular meal times help many digestive systems settle into a pattern." },
    { e: "🌙", h: "Dinner, then dusk", b: "Leave a gap of a couple of hours between a heavy meal and lying down." },
  ] },
  "Orthopedics": { habit: "Took stretch breaks", tips: [
    { e: "⏱️", h: "Stand up every 30 to 60 minutes", b: "Set a timer, stand, roll your shoulders and walk a few steps. Joints like motion." },
    { e: "🔥", h: "Warm up before you go", b: "Five minutes of gentle movement before exercise prepares muscles and joints." },
    { e: "🥛", h: "Feed your bones", b: "Calcium-rich foods, vitamin D and weight-bearing activity all support bone strength." },
    { e: "📐", h: "Ear, shoulder, hip", b: "Imagine a line through your ear, shoulder and hip when you sit or stand. It's a quick posture check." },
  ] },
  "Neurology": { habit: "Slept 7 or more hours", tips: [
    { e: "🌙", h: "Sleep is brain maintenance", b: "Regular, sufficient sleep supports memory and mood. Keep the same bedtime when you can." },
    { e: "🧩", h: "Cross-train your brain", b: "Learn something new, read, play, or have a proper conversation. Variety keeps the mind active." },
    { e: "🪖", h: "Protect your head", b: "Wear a helmet when cycling or riding a two-wheeler, and buckle up in a car." },
    { e: "📓", h: "Keep a headache diary", b: "Note when headaches start, what you ate, slept and did. Patterns help your doctor." },
  ] },
  "Pulmonology": { habit: "Did a breathing exercise", tips: [
    { e: "🌬️", h: "Belly breathing break", b: "Place a hand on your belly and breathe slowly so it rises. A few minutes can ease tension." },
    { e: "🚭", h: "Keep the air clean", b: "Avoid smoke, including second-hand smoke, and ventilate indoor spaces." },
    { e: "🏃", h: "Grow your lungs' stamina", b: "Regular activity helps your breathing muscles work efficiently." },
    { e: "💉", h: "Ask about vaccines", b: "Flu and some other vaccines protect your lungs. Ask your doctor which are right for you." },
  ] },
  "Gynecology": { habit: "Moved my body and tracked my cycle", tips: [
    { e: "📅", h: "Know your normal", b: "Tracking your cycle helps you spot changes early and gives your doctor useful detail." },
    { e: "🩺", h: "Ask about screening", b: "Which check-ups you need depends on age and history, so ask your doctor for your schedule." },
    { e: "🌱", h: "Planning a pregnancy?", b: "Talk to your doctor beforehand. They can advise on supplements such as folic acid." },
    { e: "🧘", h: "Move gently, often", b: "Regular movement and stretching can ease many period discomforts for some people." },
  ] },
  "Pediatrics": { habit: "Handwashing and a rainbow plate", tips: [
    { e: "💉", h: "Keep the vaccine calendar", b: "Follow your paediatrician's schedule and keep the vaccination card somewhere safe." },
    { e: "🧼", h: "Sing it twice", b: "Washing hands for as long as it takes to sing Happy Birthday twice helps keep germs away." },
    { e: "🌈", h: "Build a rainbow plate", b: "Offer a new colour of fruit or vegetable often. Children may need many tries to accept it." },
    { e: "📵", h: "Screen-free zones", b: "Keep meals and bedtime screen-free so there's room for talk, play and sleep." },
  ] },
  "Urology": { habit: "Drank enough water", tips: [
    { e: "💧", h: "Keep it pale", b: "Drinking enough fluid through the day helps your kidneys and urinary system." },
    { e: "🚽", h: "Don't hold it", b: "Go when you need to. Regularly holding on can irritate the bladder." },
    { e: "🧂", h: "Go easy on salt", b: "A high-salt diet can affect kidney health, so taste before adding more." },
    { e: "🚩", h: "Don't wait on warning signs", b: "Blood in the urine, burning or pain deserves a prompt visit to a doctor." },
  ] },
  "Endocrinology": { habit: "Took a walk after a meal", tips: [
    { e: "🚶", h: "The after-dinner stroll", b: "A short walk after meals can help your body manage blood sugar." },
    { e: "🍚", h: "Steady, not spiky", b: "Regular meals with fibre and protein help avoid big swings in energy." },
    { e: "🧪", h: "Know your key tests", b: "Ask your doctor which tests, such as HbA1c or thyroid tests, you need and how often." },
    { e: "😴", h: "Sleep is hormonal too", b: "Poor sleep can affect appetite and blood sugar, so protect your rest." },
  ] },
  "Mental Health": { habit: "Did something calming", tips: [
    { e: "📦", h: "Box breathing", b: "Breathe in for 4, hold 4, out for 4, hold 4. Repeat a few rounds when you feel wound up." },
    { e: "🌤️", h: "Daylight and a walk", b: "Morning light and a little movement can lift mood and help sleep." },
    { e: "💬", h: "Text one person", b: "Reach out to one friend or family member today. Small contact counts." },
    { e: "🤝", h: "Asking for help is strength", b: "If low mood, worry or stress is affecting daily life, talking to a professional can help. If you feel unsafe, contact local emergency services or a crisis line." },
  ] },
};

const localDayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const popularScore = (h) => (Number(h.averageRating) || 0) * Math.log(2 + (Number(h.ratingCount) || 0));

const SPEC_EMOJI = { "Dentist": "🦷", "General Physician": "🩺", "ENT": "👂", "Ophthalmology": "👁️", "Dermatology": "🧴", "Cardiology": "🫀", "Gastroenterology": "🍽️", "Orthopedics": "🦴", "Neurology": "🧠", "Pulmonology": "🫁", "Gynecology": "🌸", "Pediatrics": "🧸", "Urology": "💧", "Endocrinology": "⚖️", "Mental Health": "🌿" };
const hueOf = (str) => [...String(str || "")].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
const SC_CSS = `
.sc-hero{position:relative;overflow:hidden;border-radius:22px;padding:30px;border:1px solid var(--line,#3a3445);
  background:radial-gradient(120% 150% at 0% 0%,color-mix(in srgb,var(--brand,#c48fc8) 40%,transparent),transparent 60%),
             radial-gradient(90% 120% at 100% 100%,color-mix(in srgb,#7fb2e5 28%,transparent),transparent 60%);
  display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap}
.sc-hero h2{margin:6px 0 8px;font-size:clamp(26px,4vw,40px);line-height:1.1}
.sc-float{font-size:92px;line-height:1;animation:scFloat 5s ease-in-out infinite;filter:drop-shadow(0 14px 22px rgba(0,0,0,.35))}
.sc-chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
.sc-chip{padding:6px 12px;border-radius:999px;font-size:13px;font-weight:600;background:color-mix(in srgb,var(--brand,#c48fc8) 18%,transparent);border:1px solid color-mix(in srgb,var(--brand,#c48fc8) 40%,transparent)}
.sc-title{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin:30px 0 12px;flex-wrap:wrap}
.sc-title h3{margin:0;font-size:22px}
.sc-cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:18px}
.sc-list{display:grid;gap:12px}
.sc-row{position:relative;display:grid;grid-template-columns:auto 1fr;gap:14px;align-items:center;padding:14px;border-radius:16px;border:1px solid var(--line,#3a3445);
  background:linear-gradient(145deg,color-mix(in srgb,var(--brand,#c48fc8) 10%,transparent),transparent);transition:transform .25s,box-shadow .25s,border-color .25s;animation:scRise .5s both}
.sc-row:hover{transform:translateY(-3px);box-shadow:0 12px 28px rgba(0,0,0,.28);border-color:color-mix(in srgb,var(--brand,#c48fc8) 60%,transparent)}
.sc-rank{width:46px;height:46px;border-radius:14px;display:grid;place-items:center;font-size:24px;font-weight:700;background:color-mix(in srgb,var(--brand,#c48fc8) 20%,transparent)}
.sc-avatar{width:46px;height:46px;border-radius:50%;display:grid;place-items:center;font-weight:700;color:#fff;font-size:16px}
.sc-name{display:flex;justify-content:space-between;gap:8px;align-items:baseline}
.sc-stars{position:relative;display:inline-block;letter-spacing:2px;font-size:15px;line-height:1}
.sc-stars-bg{color:color-mix(in srgb,currentColor 22%,transparent)}
.sc-stars-fg{position:absolute;left:0;top:0;overflow:hidden;white-space:nowrap;color:#f2c14e}
.sc-heat{height:5px;border-radius:99px;background:color-mix(in srgb,currentColor 12%,transparent);margin-top:8px;overflow:hidden}
.sc-heat i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#7fb2e5,var(--brand,#c48fc8),#e58f8f);transform-origin:left;animation:scGrow .9s .15s both}
.sc-skel{height:76px;border-radius:16px;background:linear-gradient(100deg,transparent 30%,color-mix(in srgb,currentColor 12%,transparent) 50%,transparent 70%),color-mix(in srgb,currentColor 6%,transparent);background-size:200% 100%;animation:scShimmer 1.3s linear infinite}
.sc-spot{position:relative;display:flex;gap:22px;align-items:center;padding:24px;border-radius:22px;border:1px solid color-mix(in srgb,var(--brand,#c48fc8) 50%,transparent);overflow:hidden;
  background:linear-gradient(135deg,color-mix(in srgb,var(--brand,#c48fc8) 26%,transparent),color-mix(in srgb,#7fb2e5 14%,transparent))}
.sc-spot::after{content:"";position:absolute;inset:-40%;background:conic-gradient(from 0deg,transparent,color-mix(in srgb,var(--brand,#c48fc8) 30%,transparent),transparent 30%);animation:scSpin 9s linear infinite;pointer-events:none}
.sc-spot>*{position:relative;z-index:1}
.sc-spot-emoji{font-size:64px;line-height:1;animation:scFloat 4s ease-in-out infinite}
.sc-fade{animation:scFade .5s both}
.sc-flipgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:16px;margin-top:16px}
.sc-card3d{perspective:900px;height:200px;background:none;border:0;padding:0;cursor:pointer;text-align:left;color:inherit;font:inherit}
.sc-inner{position:relative;width:100%;height:100%;transition:transform .6s cubic-bezier(.2,.8,.2,1);transform-style:preserve-3d}
.sc-card3d.flip .sc-inner{transform:rotateY(180deg)}
.sc-card3d:hover .sc-inner{filter:brightness(1.06)}
.sc-face{position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;border-radius:18px;padding:18px;display:flex;flex-direction:column;justify-content:space-between;
  border:1px solid hsl(var(--h) 60% 60% / .45);background:linear-gradient(150deg,hsl(var(--h) 70% 60% / .26),hsl(var(--h) 70% 45% / .07))}
.sc-back{transform:rotateY(180deg);background:linear-gradient(150deg,hsl(var(--h) 70% 55% / .38),hsl(var(--h) 70% 40% / .12));justify-content:center;gap:8px;font-size:14px;line-height:1.55;overflow:auto}
.sc-emoji{font-size:44px;line-height:1}
.sc-hint{font-size:12px;opacity:.65}
.sc-habit{position:relative;overflow:hidden;display:grid;grid-template-columns:auto 1fr;gap:26px;align-items:center;padding:26px;border-radius:22px;border:1px solid var(--line,#3a3445);
  background:linear-gradient(135deg,color-mix(in srgb,#8ccf9f 14%,transparent),color-mix(in srgb,var(--brand,#c48fc8) 12%,transparent))}
@media(max-width:720px){.sc-habit{grid-template-columns:1fr;justify-items:center;text-align:center}}
.sc-ring{position:relative;width:132px;height:132px}
.sc-ring svg{transform:rotate(-90deg)}
.sc-ring-num{position:absolute;inset:0;display:grid;place-items:center;text-align:center;font-weight:800;font-size:30px;line-height:1}
.sc-ring-num small{display:block;font-size:11px;font-weight:600;opacity:.7;margin-top:2px}
.sc-orbs{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0}
.sc-orb{width:58px;height:70px;border-radius:18px;border:1px solid var(--line,#3a3445);background:color-mix(in srgb,currentColor 5%,transparent);color:inherit;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font:inherit;transition:transform .2s,background .3s}
.sc-orb:hover{transform:translateY(-3px)}
.sc-orb .dow{font-size:11px;opacity:.7;text-transform:uppercase;letter-spacing:.5px}
.sc-orb .num{font-size:18px;font-weight:700}
.sc-orb.today{outline:2px solid var(--brand,#c48fc8);outline-offset:2px;animation:scPulse 2s ease-in-out infinite}
.sc-orb.on{background:linear-gradient(145deg,#8ccf9f,var(--brand,#c48fc8));color:#1a1420;border-color:transparent}
.sc-orb.on .num{animation:scPop .4s both}
.sc-badges{display:flex;gap:10px;flex-wrap:wrap;margin-top:6px}
.sc-badge{display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:14px;font-size:13px;font-weight:600;border:1px dashed var(--line,#3a3445);opacity:.45;filter:grayscale(1)}
.sc-badge.on{opacity:1;filter:none;border:1px solid color-mix(in srgb,#f2c14e 70%,transparent);background:color-mix(in srgb,#f2c14e 16%,transparent);animation:scPop .5s both}
.sc-confetti{position:absolute;left:50%;top:40%;pointer-events:none}
.sc-confetti i{position:absolute;width:8px;height:13px;border-radius:2px;opacity:0;animation:scConf 1.7s ease-out var(--d) forwards}
@keyframes scFloat{0%,100%{transform:translateY(0) rotate(-4deg)}50%{transform:translateY(-12px) rotate(4deg)}}
@keyframes scRise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes scGrow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes scShimmer{from{background-position:200% 0}to{background-position:-200% 0}}
@keyframes scSpin{to{transform:rotate(360deg)}}
@keyframes scFade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes scPulse{0%,100%{outline-color:var(--brand,#c48fc8)}50%{outline-color:transparent}}
@keyframes scPop{0%{transform:scale(.4)}70%{transform:scale(1.25)}100%{transform:scale(1)}}
@keyframes scConf{0%{opacity:1;transform:translate(0,0) rotate(0)}100%{opacity:0;transform:translate(var(--x),calc(var(--y) + 280px)) rotate(var(--r))}}
@media (prefers-reduced-motion:reduce){.sc-float,.sc-spot-emoji,.sc-spot::after,.sc-orb.today,.sc-row,.sc-heat i,.sc-skel,.sc-confetti i{animation:none!important}.sc-inner{transition:none}}
`;

function StarMeter({ value }) {
  const pct = Math.max(0, Math.min(5, Number(value) || 0)) / 5 * 100;
  return <span className="sc-stars" role="img" aria-label={`${Number(value || 0).toFixed(1)} out of 5`}><span className="sc-stars-bg">★★★★★</span><span className="sc-stars-fg" style={{ width: pct + "%" }}>★★★★★</span></span>;
}

function SpecialtyCare({ spec, city, base, chooseHospital, go }) {
  const info = CARE_TIPS[spec];
  const [hospitals, setHospitals] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loadingH, setLoadingH] = useState(false);
  const [loadingD, setLoadingD] = useState(false);
  const [done, setDone] = useState(() => { try { return JSON.parse(localStorage.getItem(`aegiscare_habit_${spec}`) || "[]"); } catch (e) { return []; } });
  const tipCount = (info?.tips || []).length;
  const todayIdx = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const [tipIdx, setTipIdx] = useState(tipCount ? todayIdx % tipCount : 0);
  const [flipped, setFlipped] = useState({});
  const [burst, setBurst] = useState(false);
  const confetti = useMemo(() => Array.from({ length: 32 }, () => ({ x: (Math.random() - 0.5) * 560, y: -(140 + Math.random() * 220), r: Math.random() * 720, d: Math.random() * 0.35, h: Math.floor(Math.random() * 360) })), []);

  useEffect(() => {
    if (!spec || !city) return;
    const cacheKey = `aegiscare_popular_${spec}_${city.toLowerCase()}`;
    try {
      const c = JSON.parse(sessionStorage.getItem(cacheKey) || "null");
      if (c && Date.now() - c.t < 30 * 60 * 1000) { setHospitals(c.h || []); setDoctors(c.d || []); return; }
    } catch (e) { }
    let live = true;
    const opts = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ specialty: spec, city, max_results: 8 }) };
    const got = { h: null, d: null };
    const save = () => { if (got.h && got.d) { try { sessionStorage.setItem(cacheKey, JSON.stringify({ t: Date.now(), h: got.h, d: got.d })); } catch (e) { } } };
    setLoadingH(true); setLoadingD(true);
    (async () => {
      try {
        const res = await apiFetch(`${base}/patient/hospital-search`, opts);
        const data = res.ok ? await res.json() : {};
        const list = (Array.isArray(data.hospitals) ? data.hospitals : []).sort((a, b) => popularScore(b) - popularScore(a)).slice(0, 6);
        if (live) setHospitals(list);
        got.h = list; save();
      } catch (e) { console.warn("Popular hospitals failed", e); }
      finally { if (live) setLoadingH(false); }
    })();
    (async () => {
      try {
        const res = await apiFetch(`${base}/patient/popular-doctors`, opts);
        const data = res.ok ? await res.json() : {};
        const list = (Array.isArray(data.doctors) ? data.doctors : []).slice(0, 6);
        if (live) setDoctors(list);
        got.d = list; save();
      } catch (e) { console.warn("Popular doctors failed", e); }
      finally { if (live) setLoadingD(false); }
    })();
    return () => { live = false; };
  }, [spec, city, base]);

  if (!spec) return <section style={{ marginBottom: 20 }}>
    <style>{SC_CSS}</style>
    <div className="sc-hero">
      <div style={{ maxWidth: 560 }}>
        <p className="n">POPULAR FOR YOU</p>
        <h2>Make this page yours ✨</h2>
        <p className="muted" style={{ lineHeight: 1.65 }}>Pick your usual type of care, such as Dentist, in Settings. We'll bring you popular doctors and hospitals near you, daily health tips and a habit streak to keep you going.</p>
        <button className="btn pri" style={{ marginTop: 8 }} onClick={() => go("settings")}>Choose my care type</button>
      </div>
      <div className="sc-float" aria-hidden="true">🧭</div>
    </div>
  </section>;

  const tips = info?.tips || [];
  const tip = tips.length ? tips[tipIdx % tips.length] : null;
  const last7 = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return d; });
  const todayKey = localDayKey(new Date());
  const weekCount = last7.filter(d => done.includes(localDayKey(d))).length;
  const toggleDay = (key) => {
    const adding = !done.includes(key);
    const next = adding ? [...done, key] : done.filter(k => k !== key);
    setDone(next);
    try { localStorage.setItem(`aegiscare_habit_${spec}`, JSON.stringify(next.slice(-60))); } catch (e) { }
    if (adding && last7.filter(d => next.includes(localDayKey(d))).length === 7) { setBurst(true); setTimeout(() => setBurst(false), 2400); }
  };
  let streak = 0;
  { const d = new Date(); if (!done.includes(localDayKey(d))) d.setDate(d.getDate() - 1); while (done.includes(localDayKey(d))) { streak++; d.setDate(d.getDate() - 1); } }
  const maxScoreH = Math.max(1, ...hospitals.map(popularScore));
  const medal = (i) => ["🥇", "🥈", "🥉"][i] || `#${i + 1}`;
  const C = 2 * Math.PI * 50;

  return <section style={{ marginBottom: 20 }}>
    <style>{SC_CSS}</style>

    <div className="sc-hero">
      <div style={{ flex: "1 1 360px" }}>
        <p className="n">POPULAR FOR YOU</p>
        <h2>Your {spec} corner</h2>
        <p className="muted" style={{ margin: 0, lineHeight: 1.6, maxWidth: 560 }}>{city ? `Popular care near ${city}, ` : ""}plus tiny habits that make a big difference. Updated every time you visit.</p>
        <div className="sc-chips">
          {city && <span className="sc-chip">📍 {city}</span>}
          <span className="sc-chip">🏥 {hospitals.length} place{hospitals.length === 1 ? "" : "s"}</span>
          <span className="sc-chip">👩‍⚕️ {doctors.length} doctor{doctors.length === 1 ? "" : "s"}</span>
          <span className="sc-chip">{streak > 0 ? `🔥 ${streak}-day streak` : "🌱 Start your streak"}</span>
        </div>
      </div>
      <div className="sc-float" aria-hidden="true">{SPEC_EMOJI[spec] || "🩺"}</div>
    </div>

    {!city && <p className="small muted" style={{ marginTop: 14 }}>Add your care location in Settings to see places near you. <button className="btn" onClick={() => go("settings")}>Open settings</button></p>}

    {city && <>
      <div className="sc-title"><h3>🏆 Popular near you</h3><span className="small muted">Ranked by rating and how many people rated</span></div>
      <div className="sc-cols">
        <div>
          <b>Hospitals and clinics</b>
          <div className="sc-list" style={{ marginTop: 10 }}>
            {loadingH && [0, 1, 2].map(i => <div key={i} className="sc-skel" />)}
            {loadingH && <span className="small muted">Finding popular places in {city}… this can take up to 30 seconds the first time.</span>}
            {!loadingH && hospitals.length === 0 && <span className="small muted">No places found for this area yet.</span>}
            {hospitals.map((h, i) => <div key={h.name} className="sc-row" style={{ animationDelay: `${i * 70}ms` }}>
              <div className="sc-rank" aria-label={`Rank ${i + 1}`}>{medal(i)}</div>
              <div>
                <div className="sc-name"><b>{h.name}</b>{i === 0 && <span className="sc-chip" style={{ padding: "2px 8px", fontSize: 11 }}>🔥 Trending</span>}</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 4 }}>
                  {h.averageRating != null && <><StarMeter value={h.averageRating} /><b>{Number(h.averageRating).toFixed(1)}</b></>}
                  <span className="small muted">{h.ratingCount ? `${h.ratingCount} rating${h.ratingCount === 1 ? "" : "s"} · ` : ""}{h.source && h.source !== "database" ? "Google Maps" : "AegisCare reviews"}</span>
                </div>
                <div className="small muted">{h.location || city}</div>
                <div className="sc-heat" aria-hidden="true"><i style={{ width: Math.max(8, popularScore(h) / maxScoreH * 100) + "%" }} /></div>
                <button className="btn" style={{ marginTop: 10 }} onClick={() => chooseHospital(h)}>Request appointment →</button>
              </div>
            </div>)}
          </div>
        </div>
        <div>
          <b>Doctors patients rate well</b>
          <div className="sc-list" style={{ marginTop: 10 }}>
            {loadingD && [0, 1, 2].map(i => <div key={i} className="sc-skel" />)}
            {!loadingD && doctors.length === 0 && <span className="small muted">No doctors with patient feedback in our reviews for this area yet.</span>}
            {doctors.map((d, i) => {
              const hue = hueOf(d.name);
              const initials = d.name.replace(/^Dr\.?\s+/i, "").split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();
              return <div key={d.name + d.hospital} className="sc-row" style={{ animationDelay: `${i * 70}ms` }}>
                <div className="sc-avatar" style={{ background: `linear-gradient(135deg,hsl(${hue} 70% 55%),hsl(${(hue + 50) % 360} 70% 45%))` }} aria-hidden="true">{initials}</div>
                <div>
                  <div className="sc-name"><b>{d.name}</b>{i === 0 && <span className="sc-chip" style={{ padding: "2px 8px", fontSize: 11 }}>⭐ Top rated</span>}</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 4 }}>
                    {d.averageRating != null && <><StarMeter value={d.averageRating} /><b>{Number(d.averageRating).toFixed(1)}</b></>}
                    <span className="small muted">{d.reviewCount} review{d.reviewCount === 1 ? "" : "s"}</span>
                  </div>
                  <div className="small muted">{d.hospital || "Hospital not listed"}{d.location ? ` · ${d.location}` : ""}</div>
                  {d.hospital && <button className="btn" style={{ marginTop: 10 }} onClick={() => chooseHospital({ name: d.hospital, specialties: [spec], mapsUrl: "" })}>Request at {d.hospital} →</button>}
                </div>
              </div>;
            })}
          </div>
        </div>
      </div>
    </>}

    {tips.length > 0 && <>
      <div className="sc-title"><h3>💡 Tip of the moment</h3><button className="btn" onClick={() => setTipIdx(i => (i + 1) % tips.length)}>Surprise me ↻</button></div>
      {tip && <div className="sc-spot">
        <div className="sc-spot-emoji" aria-hidden="true">{tip.e}</div>
        <div key={tipIdx} className="sc-fade"><div className="small muted">{tipIdx % tips.length === todayIdx % tips.length ? "TODAY'S PICK" : "TIP"} · {spec.toUpperCase()}</div><b style={{ fontSize: 22 }}>{tip.h}</b><p className="muted" style={{ margin: "6px 0 0", lineHeight: 1.65 }}>{tip.b}</p></div>
      </div>}

      <div className="sc-title"><h3>🃏 Flip a card</h3><span className="small muted">Tap to reveal the tip</span></div>
      <div className="sc-flipgrid">
        {tips.map((t, i) => <button key={t.h} className={"sc-card3d" + (flipped[i] ? " flip" : "")} style={{ "--h": hueOf(t.h) }} aria-pressed={!!flipped[i]} aria-label={`${t.h}. Tap to ${flipped[i] ? "hide" : "show"} the tip`} onClick={() => setFlipped(f => ({ ...f, [i]: !f[i] }))}>
          <span className="sc-inner">
            <span className="sc-face"><span className="sc-emoji" aria-hidden="true">{t.e}</span><span><b style={{ fontSize: 17 }}>{t.h}</b><br /><span className="sc-hint">Tap to flip ↻</span></span></span>
            <span className="sc-face sc-back"><b>{t.h}</b><span>{t.b}</span></span>
          </span>
        </button>)}
      </div>

      <div className="sc-title"><h3>🔥 Habit streak</h3><span className="small muted">Saved on this device</span></div>
      <div className="sc-habit">
        {burst && <div className="sc-confetti" aria-hidden="true">{confetti.map((p, i) => <i key={i} style={{ "--x": p.x + "px", "--y": p.y + "px", "--r": p.r + "deg", "--d": p.d + "s", background: `hsl(${p.h} 85% 60%)` }} />)}</div>}
        <div className="sc-ring" role="img" aria-label={`${weekCount} of 7 days done this week`}>
          <svg width="132" height="132" viewBox="0 0 132 132"><circle cx="66" cy="66" r="50" fill="none" stroke="currentColor" strokeOpacity=".12" strokeWidth="12" /><circle cx="66" cy="66" r="50" fill="none" stroke="url(#scg)" strokeWidth="12" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - weekCount / 7)} style={{ transition: "stroke-dashoffset .8s cubic-bezier(.2,.8,.2,1)" }} /><defs><linearGradient id="scg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#8ccf9f" /><stop offset="100%" stopColor="#c48fc8" /></linearGradient></defs></svg>
          <div className="sc-ring-num"><span>{weekCount}/7<small>this week</small></span></div>
        </div>
        <div>
          <b style={{ fontSize: 18 }}>{info.habit}</b>
          <div className="small muted">{weekCount === 7 ? "Perfect week! 🎉 You're a champion." : streak > 0 ? `🔥 ${streak}-day streak. Keep it going!` : "Tap a day when you've done it and watch the ring fill."}</div>
          <div className="sc-orbs">
            {last7.map(d => { const k = localDayKey(d); const on = done.includes(k); return <button key={k} className={"sc-orb" + (on ? " on" : "") + (k === todayKey ? " today" : "")} aria-pressed={on} aria-label={`${d.toDateString()}${on ? ", done" : ""}`} onClick={() => toggleDay(k)}><span className="dow">{d.toLocaleDateString("en-US", { weekday: "short" })}</span><span className="num">{on ? "✓" : d.getDate()}</span></button>; })}
          </div>
          <div className="sc-badges">
            <span className={"sc-badge" + (weekCount >= 3 ? " on" : "")}>🌱 Spark · 3 days</span>
            <span className={"sc-badge" + (weekCount >= 5 ? " on" : "")}>✨ Glow · 5 days</span>
            <span className={"sc-badge" + (weekCount >= 7 ? " on" : "")}>🏅 Champion · 7 days</span>
          </div>
        </div>
      </div>
      <p className="small muted" style={{ marginTop: 14 }}>General wellbeing tips, not medical advice. Talk to a doctor about anything that worries you.</p>
    </>}
  </section>;
}

function PatientDashboard({ auth, apiBaseUrl = API.baseUrl, go, onChooseProvider, prefs }) {
  const stored = (() => { try { return JSON.parse(sessionStorage.getItem("aegiscare_care_search") || "null") || {}; } catch (_) { return {}; } })();
  const base = String(apiBaseUrl || API.baseUrl).trim().replace(/\/+$/, "");
  const [appointments, setAppointments] = useState([]);
  const [usage, setUsage] = useState({ try_it_count: 0, appointment_requests: 0 });
  const [symptom, setSymptom] = useState(stored.symptom || "");
  const [city, setCity] = useState(auth?.profile?.city || "");
  const [careBusy, setCareBusy] = useState(false);
  const [careError, setCareError] = useState("");
  const [careNote, setCareNote] = useState(stored.note || "");
  const [careResults, setCareResults] = useState(Array.isArray(stored.results) ? stored.results : []);
  const [careSearched, setCareSearched] = useState(!!stored.searched);
  const [careUrgent, setCareUrgent] = useState(!!stored.urgent);
  const [prepTopic, setPrepTopic] = useState(stored.prepTopic || "");
  const [careSources, setCareSources] = useState({ database: 0, google: 0 });
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [activeTab, setActiveTab] = useState("find");
  useEffect(() => {
    try { sessionStorage.setItem("aegiscare_care_search", JSON.stringify({ results: careResults, searched: careSearched, note: careNote, symptom, urgent: careUrgent, prepTopic })); } catch (_) { }
  }, [careResults, careSearched, careNote, symptom, careUrgent, prepTopic]);
  const refresh = async () => {
    try {
      const [a, u] = await Promise.all([
        apiFetch(`${base}/appointments`),
        apiFetch(`${base}/usage`)
      ]);
      if (a.ok) { const d = await a.json(); setAppointments(d.items || []); }
      if (u.ok) setUsage(await u.json());
    } catch (e) { console.warn("Patient dashboard refresh failed", e); }
  };
  useEffect(() => { refresh(); }, [base]);
  const startTryIt = async () => {
    try { await apiFetch(`${base}/usage/try-it`, { method: "POST" }); await refresh(); } catch (e) { console.warn("Usage tracking failed", e); }
    go("try");
  };
  // Local keyword fallback, used only if the LLM symptom-triage endpoint
  // is unavailable (no GROQ_API_KEY, network issue, etc).
  const guessSpecialtyLocally = (text) => {
    const s = text.toLowerCase();
    const specialtyMap = [
      [/ear|hearing|earache|ear pain|tinnitus/, "ENT (Ear, Nose and Throat)"],
      [/tooth|teeth|gum|dental/, "Dentist"],
      [/eye|vision|blurred/, "Ophthalmology"],
      [/skin|rash|itch|acne/, "Dermatology"],
      [/heart|chest|palpitation/, "Cardiology"],
      [/stomach|abdomen|nausea|digestion/, "Gastroenterology"],
      [/bone|joint|back pain|knee/, "Orthopedics"],
      [/fever|cold|cough|sore throat/, "General Physician"],
      [/mental|anxiety|stress|depress/, "Mental Health Professional"],
      [/pregnan|period|menstrual/, "Gynecology"]
    ];
    const matched = specialtyMap.find(([patterns]) => patterns.some(p => p.test(s)));
    return matched?.[1] || "General Physician";
  };

  // Local DB-only fallback, used only if the merged hospital-search endpoint
  // is unavailable. Groups raw /reviews rows by hospital name client-side.
  const searchHospitalsLocally = async (recommendedSpecialty) => {
    const res = await apiFetch(`${base}/reviews`);
    if (!res.ok) throw new Error(`Could not load review data (${res.status}).`);
    const payload = await res.json();
    const rows = getRows(payload, ["reviews", "results", "items", "data", "rows"]);
    const pick = (obj, keys) => firstValue(obj, keys, "");
    const grouped = new Map();
    rows.forEach((r) => {
      const name = String(pick(r, ["hospital_name", "hospital", "clinic_name", "organization_name", "business_name", "provider_name", "business", "place_name", "name", "organization"]) || "").trim();
      if (!name) return;
      const specialty = String(pick(r, ["specialty", "department", "category", "medical_specialty"]) || "").trim();
      const location = String(pick(r, ["city", "location", "area", "address", "locality"]) || "").trim();
      const text = String(pick(r, ["review_text", "review", "text", "comment", "content", "feedback", "description"]) || "");
      const ratingRaw = pick(r, ["rating", "stars", "review_rating", "score"], null);
      const rating = Number(ratingRaw);
      const sentiment = String(pick(r, ["sentiment", "sentiment_label", "analysis_sentiment", "label"]) || "").toLowerCase();
      const key = name.toLowerCase();
      if (!grouped.has(key)) grouped.set(key, { name, location, specialties: [], ratings: [], reviewCount: 0, positive: 0, negative: 0, snippets: [] });
      const g = grouped.get(key); g.reviewCount++;
      if (location && !g.location) g.location = location;
      if (specialty && !g.specialties.includes(specialty)) g.specialties.push(specialty);
      if (Number.isFinite(rating) && rating > 0 && rating <= 5) g.ratings.push(rating);
      if (/positive|good|recommend|satisfied/.test(sentiment)) g.positive++;
      if (/negative|bad|poor|complaint|dissatisfied/.test(sentiment)) g.negative++;
      if (text && g.snippets.length < 2) g.snippets.push(text.slice(0, 180));
    });
    return [...grouped.values()].map(g => ({ ...g, averageRating: g.ratings.length ? g.ratings.reduce((a, b) => a + b, 0) / g.ratings.length : null, source: "database" }))
      .filter(g => {
        const hay = [g.name, g.location, ...g.specialties, ...g.snippets].join(" ").toLowerCase();
        const cityMatch = !city.trim() || g.location.toLowerCase().includes(city.toLowerCase());
        const specialtyMatch = !g.specialties.length || g.specialties.some(x => x.toLowerCase().includes(recommendedSpecialty.toLowerCase().split(" ")[0]) || recommendedSpecialty.toLowerCase().includes(x.toLowerCase()));
        return cityMatch && (specialtyMatch || hay.includes(recommendedSpecialty.toLowerCase().split(" ")[0]));
      })
      .sort((a, b) => (b.averageRating ?? 0) - (a.averageRating ?? 0) || b.positive - a.positive || b.reviewCount - a.reviewCount).slice(0, 8);
  };

  const careSearch = async (e) => {
    e?.preventDefault?.();
    setCareError(""); setCareNote(""); setCareResults([]); setSelectedHospital(null); setCareUrgent(false); setCareSources({ database: 0, google: 0 });
    if (!symptom.trim()) { setCareError("Describe what you are experiencing first."); return; }
    setCareBusy(true); setCareSearched(true);

    // Step 1 — understand the symptom. Prefer the LLM triage agent; fall back
    // to the local keyword guesser if that endpoint can't be reached.
    let recommendedSpecialty = "General Physician", triageExplanation = "", urgent = false, usedLocalTriage = false;
    try {
      const res = await apiFetch(`${base}/patient/symptom-triage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symptom, city }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || `Symptom triage failed (${res.status}).`);
      recommendedSpecialty = data.specialty || recommendedSpecialty;
      triageExplanation = data.explanation || "";
      urgent = !!data.urgent;
    } catch (_err) {
      usedLocalTriage = true;
      recommendedSpecialty = guessSpecialtyLocally(symptom);
    }
    setCareUrgent(urgent);
    setPrepTopic(prepTopicFor(`${symptom} ${recommendedSpecialty}`));
    recordSearchTopic(symptom, recommendedSpecialty);

    // Step 2 — find hospitals. Prefer the merged database + live Google Maps
    // search; fall back to the local database-only grouping if it's down.
    try {
      let groups = [], dbCount = 0, googleCount = 0, usedLocalHospitals = false, searchWarning = "";
      try {
        const res = await apiFetch(`${base}/patient/hospital-search`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ specialty: recommendedSpecialty, city, max_results: prefs?.patientMaxResults || 8 }) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.detail || `Hospital search failed (${res.status}).`);
        groups = Array.isArray(data.hospitals) ? data.hospitals : [];
        dbCount = data.database_matches || 0; googleCount = data.google_matches || 0; searchWarning = data.warning || "";
      } catch (_err) {
        usedLocalHospitals = true;
        groups = await searchHospitalsLocally(recommendedSpecialty);
        dbCount = groups.length;
      }
      setCareResults(groups);
      setCareSources({ database: dbCount, google: googleCount });
      const noteParts = [
        triageExplanation || `Based on your description, a ${recommendedSpecialty} may be a useful starting point.`,
        googleCount > 0 ? `${dbCount} shown from AegisCare's own reviews and ${googleCount} added from Google Maps.` : "Shown from AegisCare's own reviews.",
        searchWarning,
        (usedLocalTriage || usedLocalHospitals) ? "(Running in offline/fallback mode — some live lookups were unavailable.)" : "",
      ].filter(Boolean);
      setCareNote(noteParts.join(" "));
      if (!groups.length) setCareError("No matching hospitals were found. Try removing the city filter or check with a local healthcare directory.");
      try { await apiFetch(`${base}/usage/try-it`, { method: "POST" }); await refresh(); } catch (_) { }
    } catch (err) {
      setCareError(err.message || "Could not search for hospitals.");
      setCareNote(`Suggested care type: ${recommendedSpecialty}. This is a general navigation suggestion, not a diagnosis.`);
    } finally { setCareBusy(false); }
  };
  const chooseHospital = (h) => {
    setSelectedHospital(h);
    const prefill = { provider_name: h.name, specialty: (h.specialties && h.specialties[0]) || "", maps_url: h.mapsUrl || "", city: city || "" };
    if (onChooseProvider) onChooseProvider(prefill); else go("patient-appointments");
  };
  const dateLabel = (v) => v ? String(v).slice(0, 10) : "—";
  const tabs = [["find", "Find care"], ["activity", "My activity"]];
  const openTab = (t) => t === "appointments" ? go("patient-appointments") : setActiveTab(t);
  const searchCount = Number(usage.try_it_count || 0);
  const appointmentCount = Number(usage.appointment_requests || appointments.length || 0);
  const latestAppointment = appointments[0] || null;
  const journeyStage = appointmentCount > 0
    ? { eyebrow: "YOUR NEXT STEP", title: "Keep your care plans in one place", body: "Review your saved appointment requests and check the preferred dates you submitted.", cta: "View appointments", tab: "appointments", icon: "✓" }
    : searchCount > 0
      ? { eyebrow: "PICK UP WHERE YOU LEFT OFF", title: "Continue exploring your care options", body: "You’ve started exploring care with AegisCare. Compare the available review data or save a provider by starting an appointment request.", cta: "Find care", tab: "find", icon: "↗" }
      : { eyebrow: "A FRESH START", title: "Your care space, made for you", body: "Start with a care search. AegisCare will look through the provider feedback available in its database and keep your activity together here.", cta: "Start a care search", tab: "find", icon: "✦" };
  return <div className="page">
    <PageHead title="My care" sub="Describe what you need, compare available hospital feedback, and keep your care activity in one place.">
      <button className="btn" onClick={() => go("onboarding")}>Edit profile</button>
    </PageHead>

    <PatientHero name={auth?.name} searchCount={searchCount} appointmentCount={appointmentCount}
      onFind={() => { setActiveTab("find"); window.scrollTo({ top: 0, behavior: "smooth" }); }} onAppointments={() => go("patient-appointments")} onTry={startTryIt} />

    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
      {tabs.slice(0, 1).map(([key, label]) => <button key={key} className={"btn" + (activeTab === key ? " pri" : "")} onClick={() => setActiveTab(key)}>{label}</button>)}
      <button className="btn" onClick={() => go("patient-appointments")}>Appointments</button>
      {tabs.slice(1).map(([key, label]) => <button key={key} className={"btn" + (activeTab === key ? " pri" : "")} onClick={() => setActiveTab(key)}>{label}</button>)}
      <button className="btn" onClick={startTryIt}>Open full Try It ↗</button>
    </div>

    {activeTab === "find" && <div className="grid2" style={{ alignItems: "start", marginBottom: 20 }}>
      <section className="panel">
        <p className="n">CARE FINDER</p><h2 className="ph2">What are you experiencing?</h2>
        <p className="muted">Tell us in your own words. AegisCare will suggest a care type and look for matching providers in its available review data.</p>
        <form onSubmit={careSearch} style={{ display: "grid", gap: 12, marginTop: 16 }}>
          <div className="field"><label className="fl">Describe your concern</label><textarea className="f" rows="4" value={symptom} onChange={e => setSymptom(e.target.value)} placeholder="e.g. I am having ear pain for two days..." required /></div>
          <div className="field"><label className="fl">City or area (optional)</label><input className="f" value={city} onChange={e => setCity(e.target.value)} placeholder="e.g. Bengaluru" /></div>
          <button className="btn pri" type="submit" disabled={careBusy}>{careBusy ? "Finding options…" : "Suggest care & find hospitals"}</button>
        </form>
        {careUrgent && <div role="alert" style={{ marginTop: 14, padding: 12, borderRadius: 10, border: "1px solid var(--crit)" }}><b style={{ color: "var(--crit)" }}>This may need urgent attention</b><p className="small" style={{ margin: "6px 0 0" }}>Contact local emergency services or go to the nearest emergency department now rather than waiting for an appointment.</p></div>}
        {careNote && <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: "var(--surface-2, rgba(120,120,120,.08))" }}><b>Care guidance</b><p className="small" style={{ margin: "6px 0 0" }}>{careNote}</p></div>}
        {careError && <p role="alert" className="small" style={{ color: "var(--crit)", marginTop: 12 }}>{careError}</p>}
        <p className="small muted" style={{ marginTop: 14 }}>This is not a diagnosis or a substitute for medical care. If you have severe or rapidly worsening symptoms, seek urgent medical help. For chest pain, difficulty breathing, severe bleeding, sudden weakness, or other emergency symptoms, contact local emergency services.</p>
      </section>
      <section className="panel">
        <p className="n">HOSPITAL MATCHES</p><h2 className="ph2">Compare patient feedback</h2>
        {careBusy && <SearchProgress />}
        {!careSearched && <EmptyArt kind="search" title="No search yet" text="Your suggested hospitals will appear here after you describe your concern." />}
        {careResults.map((h, i) => <div key={h.name} className="pfx-item" style={{ "--i": i, borderTop: "1px solid var(--line)", padding: "14px 0", display: "grid", gap: 7 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}><div style={{ display: "flex", gap: 12, alignItems: "center" }}><BuildingArt seed={h.name} /><div><b>{i + 1}. {h.name}</b>{h.location && <div className="small muted">{h.location}</div>}</div></div>
            <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>{h.averageRating !== null ? <><b>★ {h.averageRating.toFixed(1)}/5</b><div className="rate-bar" aria-hidden="true"><i style={{ width: (h.averageRating / 5 * 100) + "%" }} /></div><div className="small muted">{h.ratingCount ?? h.ratings.length} ratings{h.source && h.source !== "database" ? " · Google Maps" : ""}</div></> : <span className="small muted">No rating data</span>}</div>
          </div>
          {h.specialties?.length > 0 && <div className="small muted">{h.specialties.slice(0, 3).join(" · ")}</div>}
          {(h.source === "database" || h.reviewCount > 0) && <div className="small muted">{h.reviewCount} available review{h.reviewCount === 1 ? "" : "s"}{h.positive ? ` · ${h.positive} positive-labelled` : ""}{h.negative ? ` · ${h.negative} negative-labelled` : ""}</div>}
          {h.snippets?.[0] && <p className="small" style={{ margin: 0 }}>“{h.snippets[0]}{h.snippets[0].length >= 180 ? "…" : ""}”</p>}
          <div><button className="btn" onClick={() => chooseHospital(h)}>Choose & request appointment</button></div>
        </div>)}
        {careSearched && careResults.length === 0 && !careBusy && !careError && <p className="muted small">No matching provider records were found.</p>}
      </section>
    </div>}
    {activeTab === "find" && !careBusy && careSearched && prepTopic && <PrepTips topic={prepTopic} />}
    {activeTab === "find" && <SpecialtyCare key={(auth?.profile?.specialty || "") + "|" + (auth?.profile?.city || "")} spec={auth?.profile?.specialty || ""} city={auth?.profile?.city || ""} base={base} chooseHospital={chooseHospital} go={go} />}

    {activeTab === "find" && <>
      <div className="panel kpis" style={{ marginBottom: 20 }}>
        <div className="kpi"><div className="l">Care searches</div><div className="v"><CountUp value={searchCount} /></div><div className="d">{searchCount === 0 ? "Your first search is one step away" : searchCount === 1 ? "One search started — explore again anytime" : `${searchCount} searches and Try It sessions recorded`}</div></div>
        <div className="kpi"><div className="l">Appointment requests</div><div className="v"><CountUp value={appointmentCount} /></div><div className="d">{appointmentCount === 0 ? "Your requests will appear here" : "Saved to your account"}</div></div>
        <div className="kpi"><div className="l">Your care location</div><div className="v" style={{ fontSize: 20 }}>{auth?.profile?.city || city || "Not set yet"}</div><div className="d">{auth?.profile?.city || city ? "Used to narrow database matches" : "Add a city to make matching more relevant"}</div></div>
      </div>

      <section className="panel" style={{ marginBottom: 20 }}>
        <span className="n">{journeyStage.eyebrow}</span>
        <h2 className="ph2" style={{ marginTop: 8 }}>{journeyStage.title}</h2>
        <p className="muted" style={{ maxWidth: 650, lineHeight: 1.65, margin: "10px 0 16px" }}>{journeyStage.body}</p>
        <button className="btn pri" onClick={() => openTab(journeyStage.tab)}>{journeyStage.cta} <span aria-hidden="true">↗</span></button>
        {latestAppointment && <div className="rowline" style={{ marginTop: 16 }}><span className="muted">Latest request</span><b>{latestAppointment.provider_name} · {dateLabel(latestAppointment.appointment_date)} · {latestAppointment.status || "requested"}</b></div>}
      </section>

    </>}

    {activeTab === "activity" && (() => {
      const bySpec = {};
      appointments.forEach(x => { const k = (x.specialty || "").trim() || "Not specified"; bySpec[k] = (bySpec[k] || 0) + 1; });
      const specData = Object.entries(bySpec).map(([label, value]) => ({ label, value }));
      const stageIdx = searchCount === 0 ? 0 : appointmentCount === 0 ? 3 : 4;
      const suggestions = [
        { t: "Start with how you feel", b: "Describe your symptoms in plain words under Find care. AegisCare suggests the type of doctor to look for — a starting point, not a diagnosis.", cta: "Find care", act: () => setActiveTab("find") },
        { t: "Compare before you choose", b: "Look at the average rating together with how many ratings sit behind it, and at the positive vs negative-labelled counts. A 4.6 from hundreds of ratings tells you more than a 5.0 from three.", cta: "Compare providers", act: () => setActiveTab("find") },
        { t: "Read what other patients say", b: "Open Try It to pull public reviews for a hospital or doctor and look for repeated themes such as waiting time, communication, cleanliness or billing.", cta: "Open Try It", act: startTryIt },
        { t: "Request an appointment with context", b: "Add a short reason for the visit: what you feel, how long it has lasted, medicines you take, and the questions you want answered. It helps you get more from a short consultation.", cta: "Request appointment", act: () => go("patient-appointments") },
        { t: "Keep your care in one place", b: "Check your saved requests before each visit, and after it note what the provider said and whether it matched the reviews you read. Use that to choose your next provider.", cta: "View appointments", act: () => go("patient-appointments") },
        { t: "Know when not to wait", b: "AegisCare is for planning non-urgent care. For chest pain, trouble breathing, severe bleeding, sudden weakness or confusion, contact local emergency services instead of booking online.", cta: null },
      ];
      return <div style={{ display: "grid", gap: 20 }}>
        <PrepFromHistory />
        <div className="grid2" style={{ alignItems: "start" }}>
          <section className="panel"><p className="n">YOUR ACTIVITY</p><h2 className="ph2">How you use AegisCare</h2>
            <div style={{ marginTop: 16 }}><PieChart size={190} emptyText="No activity yet. Run a care search to get started." data={[{ label: "Care searches & Try It", value: searchCount }, { label: "Appointment requests", value: appointmentCount }]} /></div>
            <p className="small muted" style={{ marginTop: 14 }}>{searchCount + appointmentCount === 0 ? "Your chart fills in as you search for care and request appointments." : `${searchCount} search${searchCount === 1 ? "" : "es"} and ${appointmentCount} appointment request${appointmentCount === 1 ? "" : "s"} recorded on your account.`}</p>
          </section>
          <section className="panel"><p className="n">APPOINTMENTS</p><h2 className="ph2">Requests by care type</h2>
            <div style={{ marginTop: 16 }}><PieChart size={190} emptyText="No appointment requests yet." data={specData} /></div>
            <p className="small muted" style={{ marginTop: 14 }}>Based on the specialty entered on each request.</p>
          </section>
        </div>

        <section className="panel"><p className="n">SUGGESTIONS</p><h2 className="ph2">Ways to use AegisCare for your health</h2>
          <div style={{ display: "grid", gap: 0, marginTop: 8 }}>
            {suggestions.map((x, i) => <div key={x.t} className="pfx-item" style={{ "--i": i, borderTop: "1px solid var(--line)", padding: "14px 0", display: "flex", gap: 14, alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 320px" }}>
                <b>{i + 1}. {x.t}</b>{i === stageIdx && <span className="chip approved" style={{ marginLeft: 10 }}>Suggested next</span>}
                <p className="small muted" style={{ margin: "6px 0 0", lineHeight: 1.6 }}>{x.b}</p>
              </div>
              {x.cta && <button className="btn" onClick={x.act}>{x.cta}</button>}
            </div>)}
          </div>
          <p className="small muted" style={{ marginTop: 6 }}>AegisCare does not diagnose conditions or replace a doctor's advice.</p>
        </section>

        <section className="panel"><p className="n">SAVED CARE OPTIONS</p><h2 className="ph2">Continue where you left off</h2>
          {careResults.length ? <div style={{ display: "grid", gap: 12, marginTop: 12 }}>{careResults.slice(0, 5).map(h => <div key={h.name} style={{ borderTop: "1px solid var(--line)", paddingTop: 10 }}><b>{h.name}</b><div className="small muted">{h.location || "Location not available"} · {h.averageRating !== null && h.averageRating !== undefined ? `★ ${Number(h.averageRating).toFixed(1)}/5` : "No rating data"}</div><button className="btn" style={{ marginTop: 8 }} onClick={() => chooseHospital(h)}>Request appointment</button></div>)}</div> : <p className="small muted" style={{ marginTop: 12 }}>Run a care search to keep provider options here.</p>}
        </section>
      </div>;
    })()}
  </div>;
}

/* ------------------------- organization / hospital dashboard ------------------------- */
function scopeReviewsToOrg(orgName, reviews) {
  const name = String(orgName || "").trim().toLowerCase();
  if (!name) return { scoped: reviews, matched: false };
  const words = name.split(/\s+/).filter(w => w.length > 2 && !["the", "and", "of", "hospital", "clinic", "hospitals", "clinics", "group", "care", "centre", "center"].includes(w));
  const matches = reviews.filter(r => {
    const clinic = String(r.clinic || "").trim().toLowerCase();
    if (!clinic) return false;
    if (clinic.includes(name) || name.includes(clinic)) return true;
    return words.length > 0 && words.some(w => clinic.includes(w));
  });
  return matches.length ? { scoped: matches, matched: true } : { scoped: reviews, matched: false };
}

function OrgDashboard({ auth, reviews, go }) {
  const profile = auth?.profile || {};
  const orgName = profile.org_name || auth?.name || "Your organization";
  const [tab, setTab] = useState("overview");

  const { scoped, matched } = useMemo(() => scopeReviewsToOrg(profile.org_name, reviews), [profile.org_name, reviews]);
  const neg = scoped.filter(r => r.sentiment === "Negative");
  const pending = scoped.filter(r => r.status === "pending");
  const avgSeverity = neg.length ? (neg.reduce((a, r) => a + r.severity, 0) / neg.length).toFixed(1) : "—";
  const totalActionPlans = scoped.reduce((a, r) => a + (r.actionPlans?.length || 0), 0);

  const categories = useMemo(() => {
    const m = {}; neg.forEach(r => m[r.category] = (m[r.category] || 0) + 1);
    return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ k, v, pct: Math.round(v / (neg.length || 1) * 100) }));
  }, [scoped]);

  const branches = useMemo(() => {
    const m = {}; scoped.forEach(r => { const c = r.clinic || "Unlisted location"; (m[c] ||= []).push(r); });
    return Object.entries(m).map(([k, rows]) => ({ name: k, count: rows.length, negative: rows.filter(r => r.sentiment === "Negative").length })).sort((a, b) => b.count - a.count);
  }, [scoped]);

  const doctors = useMemo(() => {
    const m = {}; scoped.forEach(r => { (m[r.doctor] ||= []).push(r); });
    return Object.entries(m).map(([name, rows]) => ({
      name, count: rows.length,
      negative: rows.filter(r => r.sentiment === "Negative").length,
      avgSeverity: (rows.reduce((a, r) => a + r.severity, 0) / rows.length).toFixed(1),
    })).sort((a, b) => b.negative - a.negative || b.count - a.count).slice(0, 12);
  }, [scoped]);

  const tabs = [["overview", "Overview"], ["team", "Team & branches"]];
  const quickLinks = [["reviews", "Reviews", "reviews"], ["investigation", "Investigation", "invest"], ["action", "Action center", "action"], ["reports", "Reports", "reports"], ["approval", "Approvals", "approval"]];

  return <div className="page">
    <div className="page-head">
      <div>
        <p className="n">YOUR ORGANIZATION</p>
        <h1 className="h1">Welcome{orgName ? `, ${orgName}` : ""}</h1>
        <p className="muted">{profile.org_type ? `${profile.org_type} · ` : ""}{profile.city || "Location not set"} — what your patients are saying, organized for your team.</p>
      </div>
      <button className="btn" onClick={() => go("onboarding")}>Edit profile</button>
    </div>

    {!matched && profile.org_name && <div className="panel" role="status" style={{ marginBottom: 20, borderColor: "var(--warn)" }}>
      <b>Showing all reviews</b>
      <p className="small muted" style={{ margin: "6px 0 0" }}>No reviews currently list a clinic/hospital name matching "{profile.org_name}", so this view shows the full dataset. Review clinic names will narrow this automatically once they match.</p>
    </div>}

    <div className="grid3" style={{ marginBottom: 20 }}>
      <div className="panel"><p className="small muted">Reviews monitored</p><div className="h1">{scoped.length}</div><p className="small muted">{matched ? "Matched to your organization" : "Across all monitored locations"}</p></div>
      <div className="panel"><p className="small muted">Awaiting approval</p><div className="h1">{pending.length}</div><p className="small muted">{pending.length ? "Needs a decision" : "Nothing waiting on you"}</p></div>
      <div className="panel"><p className="small muted">Action plans</p><div className="h1">{totalActionPlans}</div><p className="small muted">Avg severity {avgSeverity} / 5</p></div>
    </div>

    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
      {tabs.map(([key, label]) => <button key={key} className={"btn" + (tab === key ? " pri" : "")} onClick={() => setTab(key)}>{label}</button>)}
    </div>

    {tab === "overview" && <>
      <div className="cols" style={{ marginBottom: 20 }}>
        <section className="panel" style={{ marginTop: 0 }}>
          <h2 className="ph2">Why patients are unhappy <small>Complaint categories</small></h2>
          {categories.length ? <div className="row" style={{ gap: 22, alignItems: "center", flexWrap: "wrap" }}>
            <DonutChart data={categories} />
            <div style={{ flex: "1 1 160px", minWidth: 160 }}>
              {categories.map(c => <div className="rowline" key={c.k}><CatDot c={c.k} /><b>{c.v} · {c.pct}%</b></div>)}
            </div>
          </div> : <p className="muted" style={{ margin: 0 }}>No negative reviews in this view yet.</p>}
        </section>
        <section className="panel" style={{ marginTop: 0 }}>
          <h2 className="ph2">Top locations <small>By review volume</small></h2>
          {branches.length ? branches.slice(0, 6).map((b, i) => <BarRow key={b.name} label={b.name} value={b.count} max={branches[0].count} suffix={b.negative ? ` (${b.negative} negative)` : ""} dim={i !== 0} />) : <p className="muted" style={{ margin: 0 }}>No location data yet.</p>}
        </section>
      </div>
      <section className="panel">
        <h2 className="ph2">Jump into the workflow</h2>
        <p className="small muted" style={{ marginBottom: 14 }}>These pages work the same as before — they just weren't the first thing you saw.</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {quickLinks.map(([k, l, ic]) => <button key={k} className="btn" onClick={() => go(k)} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Icon n={ic} />{l}</button>)}
        </div>
      </section>
    </>}

    {tab === "team" && <div className="grid2" style={{ alignItems: "start" }}>
      <section className="panel">
        <p className="n">BRANCHES</p><h2 className="ph2">Locations in your data</h2>
        <p className="small muted" style={{ marginBottom: 12 }}>Derived from the clinic/hospital name on each review. Dedicated branch management (adding locations by hand) isn't connected to a backend table yet.</p>
        {branches.length ? <div style={{ display: "grid", gap: 10 }}>{branches.map(b => <div key={b.name} className="rowline"><span>{b.name}</span><b>{b.count} review{b.count === 1 ? "" : "s"}{b.negative ? ` · ${b.negative} negative` : ""}</b></div>)}</div> : <p className="muted">No locations yet.</p>}
      </section>
      <section className="panel">
        <p className="n">DOCTORS</p><h2 className="ph2">Team in your data</h2>
        <p className="small muted" style={{ marginBottom: 12 }}>Derived from reviews, ranked by negative feedback. Roles and invitations aren't wired up yet — this is a read-only view for now.</p>
        {doctors.length ? <div style={{ display: "grid", gap: 10 }}>{doctors.map(d => <div key={d.name} className="rowline"><span>{d.name}</span><b>{d.count} review{d.count === 1 ? "" : "s"} · avg sev {d.avgSeverity}</b></div>)}</div> : <p className="muted">No doctors yet.</p>}
      </section>
    </div>}
  </div>;
}

/* -------------------------------- app -------------------------------- */
const NAV = [
  ["Overview", [["home", "Home", "home"], ["dashboard", "Dashboard", "dash"], ["try", "Try It", "flask"]]],
  ["Analysis", [["reviews", "Reviews", "reviews"], ["investigation", "Investigation", "invest"], ["action", "Action center", "action"], ["reports", "Reports", "reports"]]],
  ["Workflow", [["approval", "Approvals", "approval"]]],
  ["Account", [["settings", "Settings", "settings"]]],
];
const DEFAULTS = {
  org: "Your Hospital Group", email: "", theme: "system", threshold: 3, autoDraft: true, notifyHigh: true, weekly: false,
  patientMaxResults: 8, patientTimePref: "", patientAutoCheck: true,
  api: API.baseUrl, sources: { Practo: true, "Google Maps": true, Lybrate: false, Facebook: false }
};

/* ---- Settings page shown to patients (replaces the organisation settings for that role) ---- */
const PATIENT_CARE_TYPES = ["General Physician", "ENT", "Dentist", "Ophthalmology", "Dermatology", "Cardiology", "Gastroenterology", "Orthopedics", "Neurology", "Pulmonology", "Gynecology", "Pediatrics", "Urology", "Endocrinology", "Mental Health"];
const TIME_PREF = { morning: "09:00", afternoon: "14:00", evening: "17:00" };

function PatientSettings({ auth, apiBaseUrl = API.baseUrl, settings, setSettings, toast, onProfileSaved, onLogout, go }) {
  const base = String(apiBaseUrl || API.baseUrl).trim().replace(/\/+$/, "");
  const [draft, setDraft] = useState(settings);
  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }));
  const [city, setCity] = useState(auth?.profile?.city || "");
  const [usual, setUsual] = useState(auth?.profile?.specialty || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [stats, setStats] = useState(null);

  useEffect(() => {
    applyTheme(draft.theme);
    if (draft.theme !== "system" || !window.matchMedia) return;
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => applyTheme("system");
    media.addEventListener?.("change", onChange);
    return () => media.removeEventListener?.("change", onChange);
  }, [draft.theme]);

  useEffect(() => {
    (async () => {
      try {
        const [a, u] = await Promise.all([apiFetch(`${base}/appointments`), apiFetch(`${base}/usage`)]);
        const ad = a.ok ? await a.json() : {};
        const ud = u.ok ? await u.json() : {};
        setStats({ appointments: ud.appointment_requests ?? (ad.items || []).length, searches: ud.try_it_count || 0 });
      } catch (e) { setStats(null); }
    })();
  }, [base]);

  const saveProfile = async () => {
    setErr(""); setBusy(true);
    try {
      const res = await apiFetch(`${base}/profile`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: "patient", city: city.trim(), specialty: usual }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : `Could not save your profile (${res.status}).`);
      onProfileSaved(data);
    } catch (e) { setErr(e.message || "Could not save your profile."); }
    finally { setBusy(false); }
  };
  const clearSearches = () => {
    try { sessionStorage.removeItem("aegiscare_care_search"); } catch (e) { }
    toast("Saved search results cleared on this device");
  };
  const segBtn = (key, val, label) => <button key={String(val)} className={draft[key] === val ? "on" : ""} onClick={() => set(key, val)}>{label}</button>;

  return <>
    <PageHead title="Settings" sub="Your profile, care preferences and privacy." />
    <div className="panel">
      <div className="setrow"><div><h3>My profile</h3><p>Used to find care near you and to pre-fill appointment requests.</p></div>
        <div>
          <div className="field"><div className="fl">Signed in as</div><div><b>{auth?.name || "Your account"}</b><div className="small muted">{auth?.email}</div></div></div>
          <div className="field"><label className="fl" htmlFor="ps-city">Care location (city or area)</label><input id="ps-city" className="f" value={city} onChange={e => setCity(e.target.value)} placeholder="e.g. Kochi" /><div className="small muted" style={{ marginTop: 4 }}>A city gives more precise results than a state.</div></div>
          <div className="field"><label className="fl" htmlFor="ps-spec">Usual type of care (optional)</label>
            <select id="ps-spec" className="f" value={usual} onChange={e => setUsual(e.target.value)}><option value="">No preference</option>{PATIENT_CARE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
          {err && <p role="alert" style={{ color: "var(--crit)" }}>{err}</p>}
          <div className="row"><button className="btn pri" onClick={saveProfile} disabled={busy}>{busy ? "Saving…" : "Save profile"}</button><button className="btn" onClick={() => go("onboarding")}>Edit profile</button></div>
        </div></div>

      <div className="setrow"><div><h3>Care preferences</h3><p>How Find care and appointment requests behave for you.</p></div>
        <div>
          <div className="field"><div className="fl">Hospitals shown per search</div><div className="seg">{[5, 8, 12].map(n => segBtn("patientMaxResults", n, String(n)))}</div></div>
          <div className="field"><div className="fl">Preferred appointment time</div><div className="seg">{[["", "No preference"], ["morning", "Morning"], ["afternoon", "Afternoon"], ["evening", "Evening"]].map(([v, l]) => segBtn("patientTimePref", v, l))}</div></div>
          <div className="tog"><span>Check hospital availability automatically<small>Looks up the hospital's website, phone and hours when you choose it. Takes up to 30 seconds.</small></span><Switch on={draft.patientAutoCheck !== false} onChange={v => set("patientAutoCheck", v)} label="Check hospital availability automatically" /></div>
        </div></div>

      <div className="setrow"><div><h3>Appearance</h3><p>Choose how AegisCare looks.</p></div>
        <div className="field"><div className="fl">Theme</div><div className="seg">{["system", "light", "dark"].map(t => segBtn("theme", t, t[0].toUpperCase() + t.slice(1)))}</div></div></div>

      <div className="setrow"><div><h3>Privacy and my data</h3><p>What AegisCare keeps for your account.</p></div>
        <div>
          <p style={{ marginTop: 0 }}>{stats ? `${stats.searches} search${stats.searches === 1 ? "" : "es"} and Try It session${stats.searches === 1 ? "" : "s"} · ${stats.appointments} appointment request${stats.appointments === 1 ? "" : "s"} saved to your account.` : "Your usage totals will appear here."}</p>
          <div className="row"><button className="btn" onClick={clearSearches}>Clear saved search results</button></div>
          <p className="small muted" style={{ lineHeight: 1.6 }}>This clears the results remembered on this device. Your account totals and appointment requests are kept.</p>
          <p className="small muted" style={{ lineHeight: 1.6 }}>AegisCare suggests types of care and shows public hospital information. It does not diagnose conditions or replace a doctor, and it is not for emergencies. In an emergency, contact local emergency services.</p>
          <div className="row"><button className="btn" onClick={onLogout}>Sign out</button></div>
        </div></div>
    </div>
    <div className="row" style={{ marginTop: 20 }}>
      <button className="btn pri" onClick={() => { setSettings(draft); toast("Preferences saved"); }}>Save preferences</button>
      <button className="btn" onClick={() => setDraft(settings)}>Discard changes</button>
    </div>
  </>;
}

/* =====================================================================
   PATIENT EXPERIENCE FX: animation layer for the patient-facing pages.
   Pure CSS + tiny hooks (no extra dependencies). Respects reduced-motion.
   ===================================================================== */
const PX_CSS = `
/* ---------- fixes (all roles) ---------- */
.app input:-webkit-autofill,.app input:-webkit-autofill:hover,.app input:-webkit-autofill:focus,
.app textarea:-webkit-autofill,.app select:-webkit-autofill{
  -webkit-text-fill-color:var(--text) !important;caret-color:var(--text);
  -webkit-box-shadow:0 0 0 1000px var(--surface) inset !important;box-shadow:0 0 0 1000px var(--surface) inset !important;
  transition:background-color 9999s ease-in-out 0s}
.app select option{background:var(--surface);color:var(--text)}
/* flip cards: spans must be blocks or the card faces collapse */
.sc-card3d{display:block;width:100%}
.sc-inner{display:block}
.sc-face{box-sizing:border-box}

/* ---------- calm ambient background ---------- */
.app.pfx{position:relative;isolation:isolate}
html:has(.app.pfx){scroll-behavior:smooth;scrollbar-width:thin;scrollbar-color:color-mix(in srgb,var(--brand) 45%,transparent) transparent}
.pfx ::selection{background:color-mix(in srgb,var(--brand) 35%,transparent)}
.pfx :focus-visible{outline:2px solid var(--brand);outline-offset:2px}
.pfx-aurora{position:fixed;inset:0;z-index:-1;pointer-events:none;overflow:hidden}
.pfx-aurora i{position:absolute;border-radius:50%;filter:blur(120px)}
.pfx-aurora i:nth-child(1){width:44vmax;height:44vmax;left:-14vmax;top:-16vmax;background:var(--brand);opacity:.12;animation:pfxDrift1 40s ease-in-out infinite alternate}
.pfx-aurora i:nth-child(2){width:36vmax;height:36vmax;right:-14vmax;top:22vh;background:#6fa8e8;opacity:.07;animation:pfxDrift2 46s ease-in-out infinite alternate}
.pfx-aurora i:nth-child(3){width:32vmax;height:32vmax;left:26vw;bottom:-22vmax;background:#7fd1a8;opacity:.05;animation:pfxDrift3 44s ease-in-out infinite alternate}
:root[data-theme="light"] .pfx-aurora i{opacity:.06!important}
.pfx-scroll{position:fixed;left:0;top:0;height:2px;width:100%;transform-origin:left;transform:scaleX(0);z-index:100001;pointer-events:none;background:var(--brand)}

/* ---------- page + nav ---------- */
.pfx main.main{animation:pfxPage .5s cubic-bezier(.2,.8,.2,1) backwards}
.pfx .top-nav .nav{position:relative;transition:transform .25s,color .25s,background .25s;animation:pfxDrop .5s cubic-bezier(.2,.8,.2,1) backwards;animation-delay:calc(var(--n,0)*50ms)}
.pfx .top-nav .nav:nth-child(1){--n:1}.pfx .top-nav .nav:nth-child(2){--n:2}.pfx .top-nav .nav:nth-child(3){--n:3}.pfx .top-nav .nav:nth-child(4){--n:4}
.pfx .top-nav .nav:nth-child(5){--n:5}.pfx .top-nav .nav:nth-child(6){--n:6}.pfx .top-nav .nav:nth-child(7){--n:7}.pfx .top-nav .nav:nth-child(8){--n:8}
.pfx .top-nav .nav:nth-child(9){--n:9}.pfx .top-nav .nav:nth-child(10){--n:10}
.pfx .top-nav .nav:hover{transform:translateY(-1px)}
.pfx .top-nav .nav svg{transition:transform .3s cubic-bezier(.3,1.5,.5,1)}
.pfx .top-nav .nav:hover svg{transform:scale(1.15)}
.pfx .top-nav .nav.on::after{content:"";position:absolute;left:16%;right:16%;bottom:-3px;height:2px;border-radius:2px;background:var(--brand);opacity:.85}
.pfx .toast{animation:pfxToast .45s cubic-bezier(.2,1.2,.4,1) backwards}

/* ---------- reveal on scroll ---------- */
.pfx .pfx-rv{opacity:0;transform:translateY(18px)}
.pfx .pfx-rv.pfx-in{opacity:1;transform:none;
  transition:opacity .6s cubic-bezier(.2,.8,.2,1) var(--pfx-d,0ms),transform .6s cubic-bezier(.2,.8,.2,1) var(--pfx-d,0ms)}

/* ---------- cards ---------- */
.pfx .panel,.pfx .kpi{position:relative;transition:transform .3s cubic-bezier(.2,.8,.2,1),border-color .3s}
.pfx .panel::before,.pfx .kpi::before{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;opacity:0;transition:opacity .3s;
  background:radial-gradient(380px circle at var(--mx,50%) var(--my,50%),color-mix(in srgb,var(--brand) 7%,transparent),transparent 60%)}
.pfx .panel:hover::before,.pfx .kpi:hover::before{opacity:1}
.pfx .panel:hover{border-color:color-mix(in srgb,var(--brand) 35%,var(--line)) !important}
.pfx .kpi:hover{transform:translateY(-2px)}
.pfx .kpi .v{font-variant-numeric:tabular-nums}
.pfx .pfx-item{animation:pfxSlide .5s cubic-bezier(.2,.8,.2,1) backwards;animation-delay:calc(var(--i,0)*70ms);transition:background .25s}
.pfx .pfx-item:hover{background:color-mix(in srgb,var(--brand) 5%,transparent)}
.pfx .rowline{transition:background .25s}
.pfx .rowline:hover{background:color-mix(in srgb,var(--brand) 5%,transparent)}
.pfx tbody tr{animation:pfxSlide .45s cubic-bezier(.2,.8,.2,1) backwards;transition:background .2s}
.pfx tbody tr:hover{background:color-mix(in srgb,var(--brand) 5%,transparent)}
.pfx tbody tr:nth-child(2){animation-delay:.04s}.pfx tbody tr:nth-child(3){animation-delay:.08s}.pfx tbody tr:nth-child(4){animation-delay:.12s}
.pfx tbody tr:nth-child(5){animation-delay:.16s}.pfx tbody tr:nth-child(6){animation-delay:.2s}.pfx tbody tr:nth-child(7){animation-delay:.24s}
.pfx tbody tr:nth-child(8){animation-delay:.28s}.pfx tbody tr:nth-child(9){animation-delay:.32s}.pfx tbody tr:nth-child(n+10){animation-delay:.36s}
.pfx .track>div{transform-origin:left;animation:pfxGrow .9s cubic-bezier(.2,.8,.2,1) .1s backwards}

/* ---------- buttons & inputs (matte) ---------- */
.pfx .btn{position:relative;overflow:hidden;transition:transform .2s,filter .25s,background .25s,border-color .25s}
.pfx .btn:hover{transform:translateY(-1px)}
.pfx .btn.pri:hover{filter:brightness(1.07)}
.pfx .btn:active{transform:scale(.98)}
.pfx .btn::before{content:"";position:absolute;left:var(--rx,50%);top:var(--ry,50%);width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;
  background:rgba(255,255,255,.3);opacity:0;pointer-events:none}
.pfx .btn.pfx-rip::before{animation:pfxRipple .6s ease-out}
.pfx .seg button{transition:transform .2s,background .25s}
.pfx .seg button.on{animation:pfxPop .3s both}
.pfx .chip.approved{animation:pfxPop .4s both}
.pfx .f,.pfx select,.pfx textarea,.pfx input{transition:box-shadow .25s,border-color .25s}
.pfx .f:focus,.pfx select:focus,.pfx textarea:focus,.pfx input:focus{outline:none;border-color:var(--brand) !important;box-shadow:0 0 0 3px color-mix(in srgb,var(--brand) 18%,transparent)}
.pfx .pfx-spark{display:inline-block;color:var(--brand);animation:pfxSpark 6s ease-in-out infinite}
.pfx .pfx-role{transition:transform .25s,border-color .25s}
.pfx .pfx-role:hover{transform:translateY(-2px)}
.pfx .pfx-role[aria-checked="true"]{animation:pfxPop .3s both}
.pfx .pfx-pie{animation:pfxSpin .8s cubic-bezier(.2,.8,.2,1) backwards}
.pfx .pfx-slice{transition:transform .25s;cursor:pointer}
.pfx .pfx-slice:hover{transform:scale(1.04)}

/* ---------- welcome hero ---------- */
.pfx-hero{position:relative;overflow:hidden;display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);gap:32px;align-items:center;border-radius:20px;
  padding:clamp(22px,3.5vw,40px);margin-bottom:22px;border:1px solid var(--line);background:var(--surface)}
.pfx-hero-copy{position:relative;z-index:1;max-width:620px}
.pfx-hero h2{font-size:clamp(26px,3.6vw,38px);line-height:1.15;margin:8px 0 10px;letter-spacing:-.01em}
.pfx-grad-text{color:var(--brand)}
.pfx-lead{font-size:clamp(15px,1.6vw,17px);line-height:1.65;margin:0;max-width:52ch}
.pfx-hero-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px}
.pfx-hero-stats{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}
.pfx-stat{padding:6px 14px;border-radius:999px;font-size:13px;border:1px solid var(--line);background:var(--surface-2)}
.pfx-stat b{font-size:15px}
.pfx-hero-art{min-width:0}
@media (max-width:900px){.pfx-hero{grid-template-columns:1fr}.pfx-hero-art{display:none}}

/* ---------- illustrations / photos ---------- */
.art-stage{position:relative;aspect-ratio:520/420;width:100%;max-width:520px;margin-inline:auto}
.art-scene,.art-photo{position:absolute;inset:0;width:100%;height:100%;border-radius:22px;display:block}
.art-photo{object-fit:cover}
.art-card{position:absolute;display:flex;gap:10px;align-items:center;padding:10px 14px;border-radius:14px;background:var(--surface);border:1px solid var(--line);
  box-shadow:0 8px 22px -14px rgba(0,0,0,.4);font-size:13px;line-height:1.35;color:var(--text);animation:artFloat 9s ease-in-out infinite alternate}
.art-card.a{left:-3%;top:12%}
.art-card.b{right:-3%;bottom:10%;animation-delay:-4s}
.art-card small{display:block;color:var(--muted);font-size:12px}
.art-card .ic{width:32px;height:32px;border-radius:10px;display:grid;place-items:center;flex:none;color:var(--brand);background:color-mix(in srgb,var(--brand) 14%,transparent)}
.art-bars{display:grid;gap:4px;width:92px;margin-top:5px}
.art-bars i{display:block;height:5px;border-radius:3px;background:var(--brand);opacity:.8}
.art-tile{display:grid;place-items:center;flex:none;border-radius:12px;color:hsl(var(--h) 55% 62%);background:hsl(var(--h) 55% 55% / .15);border:1px solid hsl(var(--h) 55% 55% / .3)}
.art-empty{display:grid;justify-items:center;gap:6px;text-align:center;padding:22px 10px}
.art-empty b{color:var(--text)}

/* ---------- sign-in ---------- */
.auth-shell{display:grid;grid-template-columns:1.05fr 1fr;max-width:1000px;margin:40px auto;border:1px solid var(--line);border-radius:22px;overflow:hidden;background:var(--surface)}
.auth-art{padding:34px;background:var(--surface-2);border-right:1px solid var(--line);display:flex;flex-direction:column;gap:18px}
.auth-brand{display:flex;align-items:center;gap:10px;font-weight:700;font-size:18px;color:var(--text)}
.auth-art h2{font-size:clamp(21px,2.4vw,28px);line-height:1.25;margin:0;letter-spacing:-.01em}
.auth-points{list-style:none;margin:0;padding:0;display:grid;gap:10px}
.auth-points li{display:flex;gap:10px;align-items:flex-start;font-size:14px;color:var(--muted);line-height:1.5}
.auth-points svg{flex:none;color:var(--brand);margin-top:2px}
.auth-form{padding:clamp(26px,4vw,46px);display:flex;flex-direction:column;justify-content:center;text-align:center}
@media (max-width:820px){.auth-shell{grid-template-columns:1fr}.auth-art{display:none}}

/* ---------- landing sections ---------- */
.lp{max-width:1120px;margin:0 auto;padding:80px 24px 40px;color:var(--text);text-align:left}
.lp section{margin-bottom:96px}
.lp-eyebrow{font-size:12px;letter-spacing:.14em;font-weight:700;color:var(--brand);margin:0;text-align:inherit}
.lp h2{font-size:clamp(26px,3.2vw,36px);line-height:1.2;margin:10px 0 12px;letter-spacing:-.01em;text-align:center}
.lp section>.lp-eyebrow{text-align:center}
.lp-sub{color:var(--muted);line-height:1.7;max-width:620px;margin:0 auto 34px;text-align:center}
.lp-steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:20px}
.lp-card{border:1px solid var(--line);background:var(--surface);border-radius:16px;padding:26px;transition:transform .25s,border-color .25s}
.lp-card:hover{transform:translateY(-3px);border-color:color-mix(in srgb,var(--brand) 40%,var(--line))}
.lp-card h3{margin:6px 0 8px;font-size:18px}
.lp-card p{margin:0;color:var(--muted);line-height:1.65;font-size:15px}
.lp-ico{display:grid;place-items:center;width:46px;height:46px;border-radius:12px;margin-bottom:14px;color:var(--brand);background:color-mix(in srgb,var(--brand) 14%,transparent)}
.lp-num{font-size:11px;letter-spacing:.14em;font-weight:700;color:var(--muted)}
.lp-split{display:grid;grid-template-columns:1fr 1fr;gap:56px;align-items:center}
.lp-split.rev>*:first-child{order:2}
.lp-list{list-style:none;margin:0;padding:0;display:grid;gap:12px}
.lp-list li{display:flex;gap:10px;align-items:flex-start;line-height:1.55}
.lp-list svg{flex:none;color:var(--ok);margin-top:2px}
.lp-foot{text-align:center;font-size:13px;color:var(--muted);max-width:640px;margin:0 auto;line-height:1.6}
@media (max-width:860px){.lp-split{grid-template-columns:1fr;gap:32px}.lp-split.rev>*:first-child{order:0}}

.pfx-hero-art{position:relative;z-index:1}

/* doctor / org top nav carries 9 items: tighter spacing, icon-only for inactive items on narrower screens */
.top-nav.dense{gap:2px;min-width:0}
.top-nav.dense .nav{padding-left:10px!important;padding-right:10px!important;gap:6px!important;font-size:14px!important}
@media (max-width:1560px){.top-nav.dense .nav:not(.on) span:not(.count){display:none}}

/* ---------- data-driven dashboard motion ---------- */
.pfx .tc-line{stroke-dasharray:1;stroke-dashoffset:1;animation:pfxDraw 1.6s cubic-bezier(.4,.1,.2,1) .15s forwards}
.pfx .tc-area{opacity:0;animation:pfxFade .9s ease 1.1s forwards}
.pfx .tc-dot{transform-box:fill-box;transform-origin:center;animation:pfxDot .45s cubic-bezier(.3,1.6,.5,1) backwards;animation-delay:calc(.5s + var(--i,0)*70ms)}
.pfx .tc-live{transform-box:fill-box;transform-origin:center;animation:pfxPing 2.2s ease-out infinite}
.pfx .dn-seg{animation:pfxArc 1.1s cubic-bezier(.3,.1,.2,1) backwards;animation-delay:calc(var(--i,0)*.18s)}
.pfx .top-nav .count{animation:pfxBadge 2.6s ease-in-out infinite}
.pfx-live{position:relative;overflow:hidden;display:flex;align-items:center;gap:14px;padding:12px 18px;margin-bottom:22px;border:1px solid var(--line);border-radius:14px;background:var(--surface)}
.live-tag{display:inline-flex;align-items:center;gap:8px;flex:none;font-size:11px;font-weight:700;letter-spacing:.12em;color:var(--muted)}
.live-tag i{width:8px;height:8px;border-radius:50%;background:var(--ok);animation:pfxLive 1.8s infinite}
.live-body{display:flex;align-items:center;gap:10px;min-width:0;flex:1;animation:pfxFeedIn .5s cubic-bezier(.2,.8,.2,1)}
.live-body .chip{flex:none}
.live-who{flex:none;font-size:13px}
.live-text{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text)}
.live-count{flex:none;font-size:12px;color:var(--muted)}
.live-bar{position:absolute;left:0;bottom:0;height:2px;width:100%;background:var(--brand);transform-origin:left;animation:pfxTick 5s linear forwards}
@media (max-width:720px){.live-who{display:none}}
.rate-bar{height:5px;min-width:96px;margin:6px 0 4px;border-radius:3px;background:var(--line);overflow:hidden}
.rate-bar i{display:block;height:100%;border-radius:3px;background:linear-gradient(90deg,var(--brand),var(--ok));transform-origin:left;animation:pfxGrow 1s cubic-bezier(.2,.8,.2,1) .25s backwards}
.trk{display:flex;align-items:flex-start;margin:12px 0 2px}
.trk-s{position:relative;flex:1;display:flex;flex-direction:column;align-items:flex-start;gap:6px;font-size:12px;color:var(--muted)}
.trk-s:last-child{flex:0 0 auto}
.trk-s:not(:last-child)::before,.trk-s:not(:last-child)::after{content:"";position:absolute;left:16px;right:4px;top:5px;height:2px;border-radius:2px;background:var(--line)}
.trk-s.fill:not(:last-child)::after{background:var(--brand);transform-origin:left;animation:pfxGrow .9s cubic-bezier(.2,.8,.2,1) .4s backwards}
.trk-s:not(.fill)::after{display:none}
.trk-dot{position:relative;z-index:2;width:12px;height:12px;border-radius:50%;background:var(--surface);border:2px solid var(--line)}
.trk-s.on .trk-dot{background:var(--brand);border-color:var(--brand)}
.trk-s.cur .trk-dot{animation:pfxCur 2s ease-out infinite}
.trk-s.on{color:var(--text)}
.pfx-journey{margin-top:22px;max-width:540px}
.sp{display:grid;gap:14px;padding:6px 0 4px}
.sp-steps{list-style:none;margin:0;padding:0;display:grid;gap:9px}
.sp-steps li{display:flex;align-items:center;gap:10px;font-size:14px;color:var(--muted);transition:color .3s}
.sp-steps li.now{color:var(--text);font-weight:600}
.sp-steps li.done{color:var(--text)}
.sp-dot{width:18px;height:18px;border-radius:50%;display:grid;place-items:center;font-size:11px;border:2px solid var(--line);color:#fff;transition:background .3s,border-color .3s}
.sp-steps li.now .sp-dot{border-color:var(--brand);border-top-color:transparent;animation:pfxSpinDot .8s linear infinite}
.sp-steps li.done .sp-dot{background:var(--ok);border-color:var(--ok)}
.sp-dots{display:inline-flex;gap:3px;margin-left:2px}
.sp-dots i{width:4px;height:4px;border-radius:50%;background:var(--brand);animation:pfxBlink 1.2s infinite}
.sp-dots i:nth-child(2){animation-delay:.2s}.sp-dots i:nth-child(3){animation-delay:.4s}
.sp-skel{display:flex;gap:12px;align-items:center;padding:12px 0;border-top:1px solid var(--line)}
.sk-tile{width:44px;height:44px;border-radius:12px;flex:none}
.sk-lines{display:grid;gap:8px;flex:1}
.sk-lines i{display:block;height:9px;border-radius:5px}
.sk-lines i+i{width:60%}
.sk-tile,.sk-lines i{background:linear-gradient(90deg,var(--surface-2) 25%,color-mix(in srgb,var(--text) 10%,var(--surface-2)) 50%,var(--surface-2) 75%);background-size:200% 100%;animation:pfxShimmer 1.4s linear infinite}
@keyframes pfxDraw{to{stroke-dashoffset:0}}
@keyframes pfxFade{to{opacity:1}}
@keyframes pfxDot{from{opacity:0;transform:scale(0)}}
@keyframes pfxPing{0%{opacity:.7;transform:scale(1)}100%{opacity:0;transform:scale(3.2)}}
@keyframes pfxArc{from{stroke-dasharray:0 1000}}
@keyframes pfxBadge{0%,100%{scale:1}50%{scale:1.12}}
@keyframes pfxLive{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--ok) 55%,transparent)}70%,100%{box-shadow:0 0 0 8px transparent}}
@keyframes pfxCur{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--brand) 55%,transparent)}70%,100%{box-shadow:0 0 0 8px transparent}}
@keyframes pfxFeedIn{from{opacity:0;translate:0 10px}}
@keyframes pfxTick{from{transform:scaleX(1)}to{transform:scaleX(0)}}
@keyframes pfxSpinDot{to{transform:rotate(360deg)}}
@keyframes pfxBlink{0%,80%,100%{opacity:.25}40%{opacity:1}}
@keyframes pfxShimmer{to{background-position:-200% 0}}
@media (prefers-reduced-motion:reduce){.pfx .tc-line{stroke-dashoffset:0!important}.pfx .tc-area{opacity:1!important}.sk-tile,.sk-lines i,.live-bar,.rate-bar i,.trk-s *{animation:none!important}}

/* ---------- health prep tips ---------- */
.prep{margin-top:20px}
.prep-head{display:flex;gap:14px;align-items:center}
.prep-head>div:nth-child(2){flex:1;min-width:0}
.prep-ico{width:48px;height:48px;border-radius:14px;display:grid;place-items:center;font-size:24px;flex:none;background:color-mix(in srgb,var(--brand) 14%,transparent);border:1px solid color-mix(in srgb,var(--brand) 30%,transparent)}
.prep-ring{position:relative;width:56px;height:56px;flex:none}
.prep-ring svg{transform:rotate(-90deg)}
.prep-ring b{position:absolute;inset:0;display:grid;place-items:center;font-size:12px}
.prep-ring .arc{transition:stroke-dashoffset .6s cubic-bezier(.2,.8,.2,1)}
.prep-bar{height:4px;border-radius:2px;background:var(--line);margin:14px 0 20px;overflow:hidden}
.prep-bar i{display:block;height:100%;background:linear-gradient(90deg,var(--brand),var(--ok));transition:width .5s cubic-bezier(.2,.8,.2,1)}
.prep-cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:28px}
.prep h3{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin:0 0 12px}
.prep-list,.prep-ask{list-style:none;margin:0;padding:0;display:grid;gap:11px}
.prep-list li{animation:pfxSlide .45s cubic-bezier(.2,.8,.2,1) backwards;animation-delay:calc(var(--i,0)*60ms)}
.prep-list label{display:flex;gap:10px;align-items:flex-start;cursor:pointer;line-height:1.55;font-size:14.5px}
.prep-list input{accent-color:var(--brand);margin-top:4px;flex:none;width:16px;height:16px}
.prep-list label:has(input:checked) span{opacity:.55;text-decoration:line-through}
.prep-ask li{position:relative;padding-left:20px;line-height:1.55;font-size:14.5px}
.prep-ask li::before{content:"?";position:absolute;left:0;color:var(--brand);font-weight:700}
.prep-urgent{margin-top:24px;padding:14px 16px;border-radius:12px;border:1px solid color-mix(in srgb,var(--crit) 55%,transparent);background:color-mix(in srgb,var(--crit) 8%,transparent)}
.prep-urgent b{color:var(--crit)}
.prep-urgent ul{margin:8px 0 0;padding-left:20px;display:grid;gap:4px;font-size:14px;line-height:1.5}
.prep-chips{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}
.prep-chips .btn{display:inline-flex;flex-direction:column;align-items:flex-start;gap:2px;text-align:left}
.prep-chips small{opacity:.75;font-weight:400;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
@media (prefers-reduced-motion:reduce){.prep-list li,.prep-ring .arc,.prep-bar i{animation:none!important;transition:none!important}}

@keyframes artFloat{to{translate:0 -8px}}
@media (prefers-reduced-motion:reduce){.art-card{animation:none!important}.lp-card{transition:none}}

@keyframes pfxDrift1{to{transform:translate(10vw,8vh) scale(1.1)}}
@keyframes pfxDrift2{to{transform:translate(-12vw,-6vh) scale(1.12)}}
@keyframes pfxDrift3{to{transform:translate(8vw,-10vh) scale(.92)}}
@keyframes pfxPage{from{opacity:0;translate:0 12px}}
@keyframes pfxDrop{from{opacity:0;translate:0 -10px}}
@keyframes pfxRipple{from{opacity:.7;transform:scale(1)}to{opacity:0;transform:scale(26)}}
@keyframes pfxToast{from{opacity:0;scale:.9;translate:0 16px}}
@keyframes pfxPop{0%{transform:scale(.85)}70%{transform:scale(1.05)}100%{transform:scale(1)}}
@keyframes pfxSpin{from{opacity:0;transform:rotate(-90deg) scale(.8)}}
@keyframes pfxSlide{from{opacity:0;translate:-14px 0}}
@keyframes pfxGrow{from{transform:scaleX(0)}}
@keyframes pfxSpark{0%,100%{transform:rotate(0) scale(1)}50%{transform:rotate(90deg) scale(1.12)}}
@keyframes pfxOrb{to{transform:translate(-30px,24px) scale(1.12)}}
@keyframes pfxPlus{0%{opacity:0;transform:translateY(0) rotate(0)}12%{opacity:.25}85%{opacity:.15}100%{opacity:0;transform:translateY(-240px) rotate(180deg)}}
@keyframes pfxWave{0%,60%,100%{transform:rotate(0)}10%,30%{transform:rotate(14deg)}20%,40%{transform:rotate(-8deg)}50%{transform:rotate(6deg)}}
@keyframes pfxCaret{50%{border-color:transparent}}
@keyframes pfxEcg{to{stroke-dashoffset:-1100}}
@media (max-width:720px){.pfx .top-nav .nav.on::after{display:none}}
@media (prefers-reduced-motion:reduce){
  .pfx *,.pfx *::before,.pfx *::after,.pfx-hero *,.pfx-aurora *{animation:none!important;transition:none!important}
  .pfx .pfx-rv{opacity:1!important;transform:none!important}
}
`;

function useFx(enabled, page) {
  React.useLayoutEffect(() => {
    if (!enabled || typeof window === "undefined") return undefined;
    const reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const undo = [];
    window.scrollTo(0, 0);

    // scroll progress bar
    const bar = document.querySelector(".pfx-scroll");
    let ticking = false;
    const onScroll = () => {
      if (ticking) return; ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const h = document.documentElement.scrollHeight - window.innerHeight;
        if (bar) bar.style.transform = `scaleX(${h > 0 ? Math.min(1, window.scrollY / h) : 0})`;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true }); onScroll();
    undo.push(() => window.removeEventListener("scroll", onScroll));

    if (!reduce) {
      // cursor spotlight on cards
      const onMove = (e) => {
        const el = e.target.closest && e.target.closest(".panel, .kpi");
        if (!el) return;
        const r = el.getBoundingClientRect();
        el.style.setProperty("--mx", (e.clientX - r.left) + "px");
        el.style.setProperty("--my", (e.clientY - r.top) + "px");
      };
      document.addEventListener("pointermove", onMove, { passive: true });
      undo.push(() => document.removeEventListener("pointermove", onMove));

      // click ripple on buttons
      const onClick = (e) => {
        const b = e.target.closest && e.target.closest(".btn");
        if (!b || b.disabled) return;
        const r = b.getBoundingClientRect();
        b.style.setProperty("--rx", (e.clientX - r.left) + "px");
        b.style.setProperty("--ry", (e.clientY - r.top) + "px");
        b.classList.remove("pfx-rip"); void b.offsetWidth; b.classList.add("pfx-rip");
        setTimeout(() => b.classList.remove("pfx-rip"), 700);
      };
      document.addEventListener("click", onClick);
      undo.push(() => document.removeEventListener("click", onClick));

      // staggered reveal as sections scroll into view
      const main = document.querySelector("main.main");
      if (main && "IntersectionObserver" in window) {
        const SEL = ".panel, .kpi, .phead, .page-head, .sc-hero, .sc-spot, .sc-habit, .setrow, .decision, .pfx-hero";
        const timers = [];
        const io = new IntersectionObserver((entries) => {
          let n = 0;
          entries.forEach((en) => {
            if (!en.isIntersecting) return;
            const el = en.target; io.unobserve(el);
            const d = Math.min(n++, 8) * 70;
            el.style.setProperty("--pfx-d", d + "ms");
            requestAnimationFrame(() => el.classList.add("pfx-in"));
            timers.push(setTimeout(() => { el.classList.remove("pfx-rv", "pfx-in"); el.style.removeProperty("--pfx-d"); }, 1100 + d));
          });
        }, { threshold: 0.06, rootMargin: "0px 0px -30px 0px" });
        const prep = (root) => {
          const list = [];
          if (root.matches && root.matches(SEL)) list.push(root);
          if (root.querySelectorAll) root.querySelectorAll(SEL).forEach((x) => list.push(x));
          list.forEach((el) => { if (el.dataset.pfx) return; el.dataset.pfx = "1"; el.classList.add("pfx-rv"); io.observe(el); });
        };
        prep(main);
        const mo = new MutationObserver((muts) => muts.forEach((m) => m.addedNodes.forEach((nd) => { if (nd.nodeType === 1) prep(nd); })));
        mo.observe(main, { childList: true, subtree: true });
        undo.push(() => { io.disconnect(); mo.disconnect(); timers.forEach(clearTimeout); });
      }
    }
    return () => undo.forEach((fn) => fn());
  }, [enabled, page]);
}

function CountUp({ value, duration = 900, decimals = 0 }) {
  const target = Number(value) || 0;
  const [n, setN] = useState(0);
  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || target === 0) { setN(target); return undefined; }
    let raf, start = null;
    const step = (ts) => {
      if (start === null) start = ts;
      const p = Math.min(1, (ts - start) / duration);
      setN(+(target * (1 - Math.pow(1 - p, 3))).toFixed(decimals));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, decimals]);
  return <>{decimals ? Number(n).toFixed(decimals) : n}</>;
}

/* =====================================================================
   VISUALS: illustrations + optional real photos.
   To use real photos, put licensed images in /public/images and set the
   paths below, e.g. patient: "/images/patient-hero.jpg". Empty = illustration shown.
   ===================================================================== */
const PHOTOS = { patient: "", provider: "" };   // patient hero / doctor + organization hero

function Photo({ slot, alt = "", fallback = null }) {
  const [bad, setBad] = useState(false);
  const src = PHOTOS[slot];
  if (!src || bad) return fallback;
  return <img className="art-photo" src={src} alt={alt} loading="lazy" onError={() => setBad(true)} />;
}

const LP_ICONS = {
  search: <path d="M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-4.3-4.3" />,
  compare: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4M16 3v4M3 10h18M9 15l2 2 4-4" /></>,
  shield: <path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6zM9 12l2 2 4-4" />,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v4h1" /></>,
  star: <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />,
  check: <><circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-6" /></>,
  bars: <path d="M5 20V12M12 20V5M19 20v-6" />,
};
const LpIcon = ({ n, size = 22 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{LP_ICONS[n]}</svg>;

function PatientScene() {
  const stars = (x, y, n) => Array.from({ length: 5 }, (_, i) => <use key={i} href="#artStar" x={x + i * 13} y={y} fill={i < n ? "#f2b84b" : "var(--line)"} />);
  return <svg className="art-scene" viewBox="0 0 520 420" role="img" aria-label="Illustration of a patient comparing hospitals on a phone">
    <defs>
      <linearGradient id="artBgP" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="var(--brand)" stopOpacity=".20" /><stop offset="1" stopColor="#7fd1a8" stopOpacity=".16" /></linearGradient>
      <clipPath id="artClipP"><rect width="520" height="420" rx="22" /></clipPath>
      <path id="artStar" d="M6 0l1.9 4 4.1.6-3 2.9.7 4.2L6 9.7 2.3 11.7l.7-4.2-3-2.9 4.1-.6z" />
    </defs>
    <g clipPath="url(#artClipP)">
      <rect width="520" height="420" fill="url(#artBgP)" />
      <circle cx="120" cy="92" r="64" fill="var(--brand)" opacity=".09" />
      <rect x="0" y="362" width="520" height="58" fill="var(--surface-2)" opacity=".9" />
      <rect x="276" y="48" width="188" height="318" rx="30" fill="var(--surface)" stroke="var(--line)" strokeWidth="3" />
      <rect x="350" y="58" width="40" height="7" rx="3.5" fill="var(--line)" />
      <rect x="294" y="84" width="152" height="30" rx="15" fill="var(--surface-2)" stroke="var(--line)" />
      <circle cx="312" cy="99" r="6" fill="none" stroke="var(--muted)" strokeWidth="2" /><path d="M317 104l5 5" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" />
      <rect x="330" y="96" width="70" height="6" rx="3" fill="var(--line)" />
      {[0, 1, 2].map(i => <g key={i}>
        <rect x="294" y={128 + i * 74} width="152" height="64" rx="14" fill="var(--surface-2)" stroke="var(--line)" />
        <rect x="304" y={140 + i * 74} width="38" height="38" rx="10" fill="var(--brand)" opacity={0.35 + i * 0.15} />
        <path d={`M323 ${150 + i * 74}v18M314 ${159 + i * 74}h18`} stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
        <rect x="352" y={144 + i * 74} width="84" height="7" rx="3.5" fill="var(--line)" />
        <rect x="352" y={157 + i * 74} width="56" height="6" rx="3" fill="var(--line)" opacity=".7" />
        {stars(352, 168 + i * 74, [5, 4, 4][i])}
      </g>)}
      <ellipse cx="150" cy="366" rx="94" ry="9" fill="#000" opacity=".14" />
      <path d="M62 366C62 292 104 252 150 252s88 40 88 114z" fill="var(--brand)" />
      <path d="M212 288q36 6 62 14" stroke="#c98a63" strokeWidth="20" strokeLinecap="round" fill="none" />
      <rect x="138" y="222" width="24" height="34" rx="10" fill="#b9774f" />
      <circle cx="150" cy="190" r="38" fill="#c98a63" />
      <path d="M110 190c-6-44 36-62 64-52 24 8 34 30 28 52-6-18-22-30-46-30-20 0-38 8-46 30z" fill="#241a22" />
      <circle cx="116" cy="172" r="14" fill="#241a22" /><circle cx="184" cy="168" r="15" fill="#241a22" /><circle cx="150" cy="148" r="18" fill="#241a22" />
      <circle cx="138" cy="194" r="3" fill="#241a22" /><circle cx="162" cy="194" r="3" fill="#241a22" />
      <path d="M139 207q11 8 22 0" stroke="#7a3f2c" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path transform="translate(70 70)" d="M16 27C6 20 2 15 2 10a7 7 0 0114-3 7 7 0 0114 3c0 5-4 10-14 17z" fill="#e56b7f" />
      <g transform="translate(222 40)"><path d="M14 36C4 24 0 18 0 12a14 14 0 0128 0c0 6-4 12-14 24z" fill="var(--brand)" /><circle cx="14" cy="12" r="5" fill="#fff" /></g>
    </g>
  </svg>;
}

function ProviderScene() {
  return <svg className="art-scene" viewBox="0 0 520 420" role="img" aria-label="Illustration of a dashboard turning negative reviews into positive ones">
    <defs>
      <linearGradient id="artBgD" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#6fa8e8" stopOpacity=".20" /><stop offset="1" stopColor="var(--brand)" stopOpacity=".14" /></linearGradient>
      <linearGradient id="artTrend" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="var(--crit)" /><stop offset=".5" stopColor="var(--brand)" /><stop offset="1" stopColor="var(--ok)" /></linearGradient>
      <clipPath id="artClipD"><rect width="520" height="420" rx="22" /></clipPath>
    </defs>
    <g clipPath="url(#artClipD)">
      <rect width="520" height="420" fill="url(#artBgD)" />
      <rect x="0" y="362" width="520" height="58" fill="var(--surface-2)" opacity=".9" />
      <rect x="236" y="320" width="48" height="22" fill="var(--line)" />
      <rect x="190" y="338" width="140" height="10" rx="5" fill="var(--line)" />
      <rect x="50" y="58" width="420" height="262" rx="16" fill="var(--surface)" stroke="var(--line)" strokeWidth="3" />
      <path d="M50 88V74a16 16 0 0116-16h388a16 16 0 0116 16v14z" fill="var(--surface-2)" />
      <circle cx="72" cy="73" r="4" fill="var(--crit)" /><circle cx="88" cy="73" r="4" fill="#f2b84b" /><circle cx="104" cy="73" r="4" fill="var(--ok)" />
      <rect x="68" y="102" width="236" height="150" rx="12" fill="var(--surface-2)" stroke="var(--line)" />
      <rect x="84" y="114" width="72" height="6" rx="3" fill="var(--line)" />
      <path d="M84 148H288M84 184H288M84 220H288" stroke="var(--line)" opacity=".6" />
      <path d="M84 228C130 224 150 200 184 188S250 142 288 126V240H84z" fill="url(#artTrend)" opacity=".16" />
      <path d="M84 228C130 224 150 200 184 188S250 142 288 126" fill="none" stroke="url(#artTrend)" strokeWidth="4" strokeLinecap="round" />
      <circle cx="84" cy="228" r="11" fill="var(--crit)" /><rect x="78" y="226.5" width="12" height="3" rx="1.5" fill="#fff" />
      <circle cx="288" cy="126" r="11" fill="var(--ok)" /><rect x="282" y="124.5" width="12" height="3" rx="1.5" fill="#fff" /><rect x="286.5" y="120" width="3" height="12" rx="1.5" fill="#fff" />
      <rect x="318" y="102" width="136" height="100" rx="12" fill="var(--surface-2)" stroke="var(--line)" />
      <g transform="rotate(-90 358 152)" fill="none" strokeWidth="12">
        <circle cx="358" cy="152" r="28" stroke="var(--line)" />
        <circle cx="358" cy="152" r="28" stroke="var(--ok)" strokeDasharray="95 81" />
        <circle cx="358" cy="152" r="28" stroke="var(--brand)" strokeDasharray="50 126" strokeDashoffset="-95" />
        <circle cx="358" cy="152" r="28" stroke="var(--crit)" strokeDasharray="31 145" strokeDashoffset="-145" />
      </g>
      <rect x="398" y="132" width="42" height="6" rx="3" fill="var(--line)" /><rect x="398" y="152" width="34" height="6" rx="3" fill="var(--line)" /><rect x="398" y="172" width="26" height="6" rx="3" fill="var(--line)" />
      <rect x="318" y="212" width="136" height="94" rx="12" fill="var(--surface-2)" stroke="var(--line)" />
      {[80, 62, 46, 30].map((w, i) => <g key={i}><rect x="334" y={226 + i * 18} width="104" height="8" rx="4" fill="var(--line)" /><rect x="334" y={226 + i * 18} width={w} height="8" rx="4" fill="var(--brand)" opacity={0.9 - i * 0.14} /></g>)}
      {[68, 154, 240].map((x, i) => <g key={x}><rect x={x} y="262" width="70" height="44" rx="10" fill="var(--surface-2)" stroke="var(--line)" /><circle cx={x + 16} cy="278" r="5" fill={["var(--ok)", "var(--brand)", "var(--crit)"][i]} /><rect x={x + 28} y="275" width="30" height="6" rx="3" fill="var(--line)" /><rect x={x + 12} y="292" width="44" height="5" rx="2.5" fill="var(--line)" opacity=".7" /></g>)}
      <g transform="translate(436 26)"><circle cx="22" cy="22" r="22" fill="var(--brand)" /><path d="M22 11l9 3.5v6.5c0 5.5-3.8 9.6-9 11-5.2-1.4-9-5.5-9-11v-6.5z" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinejoin="round" /><path d="M18 22l3 3 6-6" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></g>
    </g>
  </svg>;
}

function HeroArt({ variant = "patient" }) {
  const provider = variant === "provider";
  return <div className="art-stage">
    <Photo slot={provider ? "provider" : "patient"} fallback={provider ? <ProviderScene /> : <PatientScene />} />
    <div className="art-card a">
      <span className="ic"><LpIcon n={provider ? "bars" : "star"} size={18} /></span>
      {provider
        ? <span><b>Feedback themes</b><span className="art-bars"><i style={{ width: "100%" }} /><i style={{ width: "70%" }} /><i style={{ width: "45%" }} /></span></span>
        : <span><b>Compare providers</b><small>Ratings from real patients</small></span>}
    </div>
    <div className="art-card b">
      <span className="ic"><LpIcon n="check" size={18} /></span>
      <span><b>{provider ? "Action plan ready" : "Request sent"}</b><small>{provider ? "Review and approve" : "Track its status here"}</small></span>
    </div>
  </div>;
}

function BuildingArt({ seed = "", size = 44 }) {
  let h = 0; for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return <span className="art-tile" style={{ width: size, height: size, "--h": h }} aria-hidden="true">
    <svg viewBox="0 0 24 24" width={size * 0.55} height={size * 0.55} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 21V7l8-4 8 4v14M2 21h20M12 9v6M9 12h6M9 21v-3h6v3" /></svg>
  </span>;
}

function EmptyArt({ kind = "search", title, text }) {
  return <div className="art-empty">
    <svg viewBox="0 0 120 90" width="120" height="90" aria-hidden="true">
      <rect x="14" y="12" width="92" height="66" rx="10" fill="var(--surface-2)" stroke="var(--line)" strokeWidth="2" />
      {kind === "calendar"
        ? <><rect x="14" y="12" width="92" height="18" rx="10" fill="var(--brand)" opacity=".35" /><path d="M32 46h12M54 46h12M76 46h12M32 60h12M54 60h12" stroke="var(--line)" strokeWidth="5" strokeLinecap="round" /><circle cx="88" cy="62" r="11" fill="var(--brand)" /><path d="M83 62l4 4 7-8" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" /></>
        : <><path d="M28 34h40M28 48h28" stroke="var(--line)" strokeWidth="5" strokeLinecap="round" /><circle cx="80" cy="54" r="15" fill="var(--surface)" stroke="var(--brand)" strokeWidth="4" /><path d="M91 65l11 11" stroke="var(--brand)" strokeWidth="5" strokeLinecap="round" /></>}
    </svg>
    {title && <b>{title}</b>}
    {text && <p className="small muted" style={{ margin: 0, maxWidth: 340 }}>{text}</p>}
  </div>;
}

function HomeExtras({ explore }) {
  const steps = [
    ["search", "Describe what you need", "Tell AegisCare how you feel in plain words. It suggests the type of care to look for, as a starting point and never a diagnosis."],
    ["compare", "Compare real feedback", "See ratings and what other patients say about hospitals and doctors, so you choose with more than a star count."],
    ["calendar", "Request your appointment", "Send a request with context and keep every request and its status together in your account."],
  ];
  const trust = [
    ["shield", "Secure sign-in", "Continue with Google. AegisCare never sees your password."],
    ["lock", "Your data stays yours", "Searches and appointment requests are kept in your own account."],
    ["info", "Guidance, not diagnosis", "AegisCare does not replace a doctor and is not for emergencies."],
  ];
  const Bullets = ({ items }) => <ul className="lp-list">{items.map(x => <li key={x}><LpIcon n="check" size={18} /><span>{x}</span></li>)}</ul>;
  return <div className="lp">
    <section>
      <p className="lp-eyebrow">HOW IT WORKS</p>
      <h2>From “something feels wrong” to the right appointment</h2>
      <p className="lp-sub">Three simple steps, built around what patients actually experience.</p>
      <div className="lp-steps">{steps.map(([ic, h, b], i) => <div className="lp-card" key={h}>
        <span className="lp-ico"><LpIcon n={ic} /></span><span className="lp-num">STEP {i + 1}</span><h3>{h}</h3><p>{b}</p></div>)}</div>
    </section>
    <section className="lp-split">
      <div><p className="lp-eyebrow">FOR PATIENTS</p><h2 style={{ textAlign: "left" }}>Choose care with confidence</h2>
        <p className="lp-sub" style={{ textAlign: "left", margin: "0 0 18px" }}>Hospital and doctor feedback in one place, so you can compare before you book.</p>
        <Bullets items={["Care type suggestions from your own words", "Ratings and review themes side by side", "Appointment requests saved to your account"]} />
        <button className="hero-explore" style={{ marginTop: 22 }} onClick={explore}>Get started <span aria-hidden="true">↗</span></button></div>
      <HeroArt variant="patient" />
    </section>
    <section className="lp-split rev">
      <div><p className="lp-eyebrow">FOR DOCTORS AND HOSPITALS</p><h2 style={{ textAlign: "left" }}>Turn patient feedback into action</h2>
        <p className="lp-sub" style={{ textAlign: "left", margin: "0 0 18px" }}>AI reads every review, finds the root cause and drafts an action plan your team can approve.</p>
        <Bullets items={["Reviews triaged by sentiment, severity and theme", "Root-cause analysis with supporting evidence", "Action plans reviewed by your team before anything is sent"]} />
      </div>
      <HeroArt variant="provider" />
    </section>
    <section>
      <p className="lp-eyebrow">BUILT ON TRUST</p><h2>Designed to be careful with health information</h2>
      <div className="lp-steps" style={{ marginTop: 28 }}>{trust.map(([ic, h, b]) => <div className="lp-card" key={h}>
        <span className="lp-ico"><LpIcon n={ic} /></span><h3>{h}</h3><p>{b}</p></div>)}</div>
    </section>
    <p className="lp-foot">AegisCare AI provides general information and public review insights. It is not medical advice. In an emergency, contact local emergency services.</p>
  </div>;
}

/* =====================================================================
   BEFORE YOUR APPOINTMENT: general wellness prep tips based on what the
   patient searched for. Guidance only, never a diagnosis.
   ===================================================================== */
const PG = (icon, title, match, intro, todo, bring, ask, urgent) => ({ icon, title, match, intro, todo, bring, ask, urgent });
const PREP_GUIDE = {
  cancer: PG("🎗️", "Cancer care", /cancer|oncolog|tumou?r|chemo|radiation|lymphoma|leuk(a)?emia|carcinoma|biops|mammogra|lump/,
    "Being prepared makes cancer care easier to navigate. These general steps can help while you wait for your appointment. They don't replace your oncologist's advice.",
    ["Book the earliest slot you can, and don't wait for symptoms to settle on their own", "Keep a simple symptom diary: what you notice, when it started and whether it is changing", "Eat small, regular, balanced meals and drink plenty of fluids. Note any weight loss or poor appetite for your doctor", "Avoid tobacco and limit alcohol. Ask your doctor for help if quitting feels hard", "Stay gently active with short walks and protect your sleep", "Don't start new supplements, herbal remedies or special diets without checking with your doctor", "It is normal to feel anxious. Talk to someone you trust, or ask about counselling and support groups"],
    ["Earlier scans, biopsy or pathology reports and blood tests", "A list of all medicines and supplements, with doses", "ID and insurance or payment documents", "A family member or friend to support you and help remember what is said"],
    ["What do my results mean, and which tests do I need next?", "What are my treatment options, and what side effects should I expect?", "Would a second opinion help, and what will the care cost?"],
    ["Fever with chills, especially if you are already on treatment", "Heavy bleeding, severe pain or trouble breathing", "Confusion, or being unable to keep fluids down"]),
  heart: PG("❤️", "Heart health", /\bheart\b|cardi|chest pain|blood pressure|hypertens|palpitat|cholesterol|angina/,
    "Small daily habits protect your heart while you wait to be seen. This is general guidance and does not replace your cardiologist's advice.",
    ["If you have a monitor, check and note your blood pressure and pulse at the same time each day", "Cut back on salt, fried and processed food", "Walk gently if you feel well, and stop and rest if you get chest discomfort or breathlessness", "Avoid smoking and limit alcohol", "Take prescribed medicines on time and don't stop them on your own", "Note when symptoms happen: at rest, on exertion or after meals"],
    ["Earlier ECG, echo and blood test reports", "A list of your medicines with doses", "Your blood pressure log", "Family history of heart disease, if any"],
    ["Which tests (ECG, echo, blood tests) do I need?", "Which activities are safe for me right now?", "Which medicines do I need, and for how long?"],
    ["Chest pain or pressure, especially with sweating, nausea or pain spreading to the arm or jaw", "Sudden breathlessness or fainting", "Sudden weakness, a drooping face or trouble speaking"]),
  diabetes: PG("🩸", "Diabetes and hormones", /diabet|sugar|thyroid|endocrin|insulin|hba1c|obesity/,
    "Steady habits make a visit more useful. This is general guidance and does not replace your doctor's plan.",
    ["Check blood sugar as advised and write down the readings", "Choose whole grains, vegetables and lean protein, and limit sweets and sugary drinks", "Walk for 20 to 30 minutes after meals if you can", "Stay hydrated and keep a regular sleep routine", "Take medicines and insulin exactly as prescribed", "Check your feet daily for cuts or sores"],
    ["Your blood sugar log and any HbA1c reports", "A list of medicines and insulin doses", "Recent blood tests, and eye or kidney reports if you have them"],
    ["What blood sugar range should I aim for?", "Do my medicines or diet need to change?", "Which regular checks do I need (HbA1c, eyes, kidneys, feet)?"],
    ["Very high or very low sugar with confusion, shakiness or sweating", "Persistent vomiting or being unable to drink", "Fast breathing or fruity-smelling breath"]),
  ortho: PG("🦴", "Bones and joints", /bone|joint|knee|\bhip\b|spine|back pain|orthop|fractur|arthrit|shoulder|neck pain|ligament|sprain/,
    "A few simple habits can ease pain and protect the area until you are seen. This does not replace an orthopaedic assessment.",
    ["Rest the painful area, but keep gently moving and avoid sitting for long stretches", "Use a cold pack on fresh injuries and warmth on stiff muscles, 15 to 20 minutes at a time", "Avoid heavy lifting and movements that sharpen the pain", "Wear supportive footwear and aim for a healthy weight to ease the load on joints", "Note what makes the pain better or worse", "Don't keep taking strong painkillers without advice"],
    ["X-ray or MRI reports and the images if you have them", "A list of medicines", "Notes on when the pain happens and what you tried"],
    ["Do I need imaging or physiotherapy?", "Which movements should I avoid for now?", "What treatment options are there besides surgery?"],
    ["Pain after a fall with a visible deformity, or you can't put weight on the limb", "Numbness, weakness, or loss of bladder or bowel control", "A hot, red, swollen joint with fever"]),
  neuro: PG("🧠", "Brain and nerves", /neuro|headache|migraine|seizure|epilep|stroke|dizz|numb|memory|parkinson|tremor/,
    "Good notes help a neurologist a lot. This is general guidance and does not replace a medical assessment.",
    ["Keep a symptom diary with time, triggers and how long each episode lasts", "Keep regular sleep and meal times and drink enough water", "Limit screens, caffeine and alcohol if they seem to trigger symptoms", "Note medicines you have taken and how well they worked", "Ask someone who saw an episode to describe it, or record a short video if it is safe to do so", "Avoid driving or climbing heights if you feel dizzy or have blacked out"],
    ["Earlier scans and reports", "A list of medicines", "Your symptom diary and any video of episodes"],
    ["What could be causing this, and which tests will help?", "How can I reduce my triggers?", "When should I come back, and when should I seek help sooner?"],
    ["A sudden, severe headache, or weakness or numbness on one side, a drooping face or trouble speaking", "A seizure lasting more than 5 minutes, or seizures that keep repeating", "Confusion, or a headache after a head injury"]),
  lung: PG("🫁", "Lungs and breathing", /lung|asthma|breath|cough|pulmon|copd|tubercul|wheez|bronch/,
    "Protecting your airways now can make breathing easier. This is general guidance and does not replace your doctor's advice.",
    ["Avoid smoke, dust and strong fumes, and stay away from smokers", "Keep your inhaler handy and use it as prescribed", "Sip warm fluids and rest", "Practise slow, deep breathing a few times a day", "Note your cough pattern, phlegm colour and what triggers breathlessness", "Sleep with your head slightly raised if lying flat is uncomfortable"],
    ["Chest X-ray or breathing test reports", "Your inhalers and medicines", "Notes on your triggers"],
    ["Which tests do I need (X-ray, spirometry)?", "How should I use my inhaler and medicines?", "Which triggers should I avoid?"],
    ["Severe breathlessness or trouble speaking in full sentences", "Blue or grey lips or fingertips", "Coughing up blood, or chest pain when you breathe"]),
  gastro: PG("🍽️", "Digestive health", /stomach|heartburn|gastro|digest|liver|acidity|ulcer|abdom|bowel|constipat|diarrh|vomit|hepat|gerd|colon/,
    "Gentle eating habits can calm your gut while you wait. This is general guidance and does not replace your doctor's advice.",
    ["Eat smaller, lighter meals and avoid very spicy, oily or late-night food", "Drink plenty of clean water, and use oral rehydration solution if you have loose motions", "Note which foods trigger discomfort", "Avoid alcohol and smoking", "Don't lie down right after eating", "Avoid frequent painkillers on an empty stomach"],
    ["Earlier endoscopy, ultrasound or blood reports", "A list of medicines", "Notes on your food and symptoms"],
    ["What could be causing this, and which tests do I need?", "Which foods should I avoid?", "How long should I try treatment before coming back?"],
    ["Vomiting blood, or black, tarry stools", "Severe or worsening abdominal pain", "Being unable to keep fluids down, or signs of dehydration"]),
  skin: PG("🧴", "Skin and hair", /\bskin\b|derma|rash|acne|eczema|psoria|itch|\bhair\b|fungal/,
    "Gentle care and good photos help your dermatologist. This is general guidance and does not replace a medical assessment.",
    ["Avoid scratching, keep the skin clean and moisturised", "Use sunscreen and cover up in strong sun", "Hold off on new creams, steroids or home remedies until you've been seen", "Take a photo of the area now and then so your doctor can see changes", "Wear loose, breathable cotton clothes", "Note possible triggers: foods, products, plants or stress"],
    ["Photos showing how the area has changed", "The creams and products you have used", "A list of medicines"],
    ["What is this, and is it contagious?", "Which products should I avoid?", "How long until I should see an improvement?"],
    ["A rash with fever, or one that is spreading fast", "Swelling of the lips or face, or trouble breathing", "A mole that changes, bleeds or grows quickly (get seen soon)"]),
  eye: PG("👁️", "Eye care", /\beyes?\b|vision|ophthal|cataract|glaucoma|retina|squint/,
    "Looking after your eyes now can prevent strain. This is general guidance and does not replace an eye examination.",
    ["Rest your eyes: every 20 minutes look at something 20 feet away for 20 seconds", "Don't rub your eyes, and wash hands before touching them", "Skip eye drops that weren't prescribed for you", "Wear sunglasses outdoors", "Note any changes in vision, pain or redness"],
    ["Your current glasses and prescription", "Earlier eye reports", "The names of any eye drops you use"],
    ["Has my vision changed, and why?", "Do I need glasses, drops or further tests?", "How often should I have my eyes checked?"],
    ["Sudden vision loss, or new flashes of light or floaters", "Severe eye pain, or a chemical splash in the eye", "Any injury to the eye"]),
  ent: PG("👂", "Ear, nose and throat", /\bears?\b|\bnose\b|\bthroat\b|\bent\b|sinus|tonsil|hearing|snoring/,
    "Gentle care helps while you wait. This is general guidance and does not replace an ENT examination.",
    ["Don't put cotton buds or objects in your ears", "Warm saltwater gargles or steam may soothe the throat and nose", "Keep ears dry and avoid loud noise", "Drink warm fluids and rest your voice", "Note hearing changes, ringing or any discharge", "Avoid dust and cold drinks if they make symptoms worse"],
    ["Earlier hearing tests or reports", "A list of medicines", "Notes on when symptoms started"],
    ["What is causing this, and do I need a hearing test or scan?", "What can I do at home to ease it?", "When should I come back?"],
    ["Sudden hearing loss", "Difficulty breathing or swallowing", "A nosebleed that doesn't stop after 15 minutes of firm pressure"]),
  dental: PG("🦷", "Dental care", /\bdent|tooth|teeth|\bgums?\b|cavity|molar|root canal/,
    "Gentle mouth care protects your teeth until the visit. This is general guidance and does not replace a dental examination.",
    ["Brush twice a day with fluoride toothpaste and floss gently", "Avoid very hot, cold or sugary food and drinks", "Rinse with warm salt water", "Chew on the other side if one side hurts", "Don't place medicines directly on the gum", "Note what sets the pain off and how long it lasts"],
    ["Earlier dental X-rays or treatment records", "A list of medicines", "Details of any allergies"],
    ["What is causing this, and what are my treatment options?", "How many visits will it take, and what will it cost?", "How can I prevent it coming back?"],
    ["Facial swelling, or fever with tooth pain", "Trouble swallowing or breathing", "Bleeding that doesn't stop"]),
  child: PG("🧒", "Child health", /child|pediatr|paediatr|\bbaby\b|infant|newborn|toddler|vaccin|\bkids?\b/,
    "A calm, prepared parent helps the doctor a lot. This is general guidance and does not replace your paediatrician's advice.",
    ["Offer fluids often and light foods", "Note fever readings with the times you took them", "Keep the vaccination card handy", "Let your child rest, and keep them home if unwell", "Don't give medicines without the doctor's or pharmacist's advice on the right dose", "Write down feeding, sleep and wet-nappy or toilet changes"],
    ["Vaccination card and growth or birth records", "A list of medicines given, with times", "Notes on fever, feeding and sleep"],
    ["What is causing this, and how long should it last?", "Which signs mean I should come back sooner?", "Is my child's vaccination schedule up to date?"],
    ["Any fever in a baby under 3 months", "Fast breathing, unusual drowsiness, or refusing to feed", "Signs of dehydration, such as no urine for 8 hours or no tears when crying"]),
  women: PG("🌸", "Women's health", /pregnan|gyn|obstet|period|menstru|pcos|pcod|menopaus|uter|ovar|fertil|antenatal/,
    "Tracking helps your doctor see the pattern. This is general guidance and does not replace a medical assessment.",
    ["Note your cycle dates and symptoms for the last few months", "Eat iron- and folate-rich foods and drink enough water", "If you are pregnant or trying, take only supplements that were prescribed or advised", "Avoid self-medicating with hormonal pills", "Keep gently active and sleep well", "Note pain, and any change in bleeding"],
    ["Cycle notes or a tracking app screenshot", "Earlier scans and reports", "A list of medicines and supplements"],
    ["What could be causing this, and which tests do I need?", "Are my treatment options safe if I am planning a pregnancy?", "What should I track before my next visit?"],
    ["Heavy bleeding, soaking a pad in an hour", "Severe pelvic pain, or pain with fainting", "In pregnancy: bleeding, leaking fluid or reduced baby movements"]),
  urology: PG("💧", "Kidney and urinary health", /kidney|urin|urolog|prostat|renal|stone|bladder|dialysis/,
    "Good habits protect your kidneys and bladder. This is general guidance and does not replace your doctor's advice.",
    ["Drink water through the day unless you've been told to limit fluids", "Cut back on salt", "Don't hold urine for long periods", "Avoid unprescribed painkillers such as NSAIDs", "Note urine colour, frequency and any burning", "Keep blood pressure and sugar in check if you have them"],
    ["Earlier urine, kidney or ultrasound reports", "A list of medicines", "Notes on your symptoms"],
    ["Which tests do I need (urine, blood, ultrasound)?", "Should I change how much I drink or what I eat?", "What treatment options do I have?"],
    ["Severe flank pain with fever or vomiting", "Being unable to pass urine", "Blood in the urine"]),
  mental: PG("💭", "Mental wellbeing", /anxiet|depress|mental|stress|psychi|panic|insomnia|counsel|mood/,
    "Looking after yourself is part of getting help. This is general guidance and does not replace support from a professional.",
    ["Keep regular sleep and wake times", "Get a short walk and some daylight each day", "Talk to someone you trust about how you feel", "Limit alcohol and caffeine", "Note your mood and sleep in a simple diary", "Be kind to yourself. Reaching out for help is a strong step"],
    ["Notes on your mood, sleep and what affects them", "A list of medicines", "A trusted person to come with you, if you'd like"],
    ["What could be behind how I feel, and what support is available?", "What can I do day to day to feel better?", "How soon should I check in again?"],
    ["Thoughts of harming yourself or ending your life: contact local emergency services or someone you trust right away", "Not being able to look after yourself", "Feeling unsafe"]),
  general: PG("🩺", "Your visit", /$^/,
    "A little preparation helps you get more from your appointment. This is general guidance and does not replace your doctor's advice.",
    ["Write down your symptoms and when they started", "Drink water, rest and eat balanced meals", "Avoid self-medicating while you wait", "Note your allergies and the medicines you take", "Arrange transport and, if you can, someone to come with you"],
    ["ID and any insurance or payment documents", "Earlier reports and prescriptions", "A list of your medicines"],
    ["What could be causing this?", "Which tests do I need, if any?", "When should I follow up?"],
    ["Chest pain, or severe trouble breathing", "Fainting or confusion", "Bleeding that doesn't stop"]),
};
const PREP_ORDER = ["cancer", "heart", "diabetes", "ortho", "neuro", "lung", "gastro", "skin", "eye", "ent", "dental", "child", "women", "urology", "mental"];
const SEARCH_HIST_KEY = "aegiscare_search_history";

function prepTopicFor(text) {
  const s = String(text || "").toLowerCase();
  if (!s.trim()) return "general";
  for (const k of PREP_ORDER) if (PREP_GUIDE[k].match.test(s)) return k;
  return "general";
}
function readSearchHistory() {
  try { const a = JSON.parse(localStorage.getItem(SEARCH_HIST_KEY) || "[]"); return Array.isArray(a) ? a : []; } catch (_) { return []; }
}
function recordSearchTopic(query, extra = "") {
  const q = String(query || "").trim();
  if (!q) return;
  const topic = prepTopicFor(q + " " + extra);
  if (topic === "general") return;
  try {
    const next = [{ q: q.slice(0, 80), topic, at: Date.now() }, ...readSearchHistory().filter(h => !(h.topic === topic && h.q === q))].slice(0, 12);
    localStorage.setItem(SEARCH_HIST_KEY, JSON.stringify(next));
  } catch (_) { }
}
function bestPrepTopic(...texts) {
  for (const x of texts) { const k = prepTopicFor(x); if (k !== "general") return k; }
  const h = readSearchHistory()[0];
  return h ? h.topic : "general";
}

function PrepTips({ topic = "general" }) {
  const g = PREP_GUIDE[topic] || PREP_GUIDE.general;
  const key = "aegiscare_prep_" + topic;
  const read = () => { try { const a = JSON.parse(localStorage.getItem(key) || "[]"); return Array.isArray(a) ? a : []; } catch (_) { return []; } };
  const [done, setDone] = useState(read);
  useEffect(() => { setDone(read()); }, [key]);
  const toggle = (id) => setDone(cur => {
    const next = cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id];
    try { localStorage.setItem(key, JSON.stringify(next)); } catch (_) { }
    return next;
  });
  const ids = [...g.todo.map((_, i) => "t" + i), ...g.bring.map((_, i) => "b" + i)];
  const count = ids.filter(id => done.includes(id)).length;
  const pct = ids.length ? Math.round(count / ids.length * 100) : 0;
  const C = 2 * Math.PI * 23;
  return <section className="panel prep" aria-label="Prepare for your appointment">
    <div className="prep-head">
      <span className="prep-ico" aria-hidden="true">{g.icon}</span>
      <div><p className="n">BEFORE YOUR APPOINTMENT</p><h2 className="ph2" style={{ margin: "4px 0 0" }}>{g.title}: looking after yourself in the meantime</h2></div>
      <div className="prep-ring" role="img" aria-label={`${count} of ${ids.length} steps done`}>
        <svg width="56" height="56" viewBox="0 0 56 56"><circle cx="28" cy="28" r="23" fill="none" stroke="var(--line)" strokeWidth="5" /><circle className="arc" cx="28" cy="28" r="23" fill="none" stroke="var(--brand)" strokeWidth="5" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)} /></svg>
        <b>{count}/{ids.length}</b>
      </div>
    </div>
    <p className="small muted" style={{ margin: "12px 0 0", lineHeight: 1.6 }}>{g.intro}</p>
    <div className="prep-bar"><i style={{ width: pct + "%" }} /></div>
    <div className="prep-cols">
      <div>
        <h3>Things to follow now</h3>
        <ul className="prep-list">{g.todo.map((x, i) => <li key={i} style={{ "--i": i }}><label><input type="checkbox" checked={done.includes("t" + i)} onChange={() => toggle("t" + i)} /><span>{x}</span></label></li>)}</ul>
      </div>
      <div style={{ display: "grid", gap: 22, alignContent: "start" }}>
        <div>
          <h3>Bring to your appointment</h3>
          <ul className="prep-list">{g.bring.map((x, i) => <li key={i} style={{ "--i": i }}><label><input type="checkbox" checked={done.includes("b" + i)} onChange={() => toggle("b" + i)} /><span>{x}</span></label></li>)}</ul>
        </div>
        <div>
          <h3>Questions to ask your doctor</h3>
          <ul className="prep-ask">{g.ask.map(x => <li key={x}>{x}</li>)}</ul>
        </div>
      </div>
    </div>
    <div className="prep-urgent" role="note">
      <b>Get urgent help if you notice</b>
      <ul>{g.urgent.map(x => <li key={x}>{x}</li>)}</ul>
      <p className="small" style={{ margin: "8px 0 0" }}>In an emergency, contact local emergency services right away instead of waiting for your appointment.</p>
    </div>
    <p className="small muted" style={{ margin: "14px 0 0" }}>General wellness guidance only. It is not a diagnosis or medical advice and does not replace your doctor. Always follow the instructions your doctor gives you.</p>
  </section>;
}

function PrepFromHistory() {
  const hist = readSearchHistory();
  const topics = [];
  hist.forEach(h => { if (PREP_GUIDE[h.topic] && !topics.find(x => x.topic === h.topic)) topics.push(h); });
  const [sel, setSel] = useState(topics[0] ? topics[0].topic : "");
  if (!topics.length) return <section className="panel"><p className="n">BEFORE YOUR APPOINTMENT</p><h2 className="ph2">Health prep from your searches</h2>
    <EmptyArt kind="search" title="Nothing to prepare for yet" text="Search for care and AegisCare will suggest what to follow and what to bring, based on what you looked up." /></section>;
  return <>
    <section className="panel"><p className="n">BASED ON YOUR SEARCHES</p><h2 className="ph2">Health prep for your recent topics</h2>
      <div className="prep-chips">{topics.map(h => <button key={h.topic} type="button" className={"btn" + (sel === h.topic ? " pri" : "")} onClick={() => setSel(h.topic)}>
        <span>{PREP_GUIDE[h.topic].icon} {PREP_GUIDE[h.topic].title}</span><small>“{h.q}”</small></button>)}</div></section>
    {sel && <PrepTips topic={sel} />}
  </>;
}

/* Animated KPI value: counts up for numbers (including decimals), leaves text alone. */
function KpiVal({ v }) {
  if (typeof v === "number") return <CountUp value={v} />;
  const n = Number(v);
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(n)) return <CountUp value={n} decimals={(v.split(".")[1] || "").length} />;
  return <>{v}</>;
}

/* Latest patient feedback ticker for doctor / organization dashboards (cycles through real reviews). */
function LiveFeed({ reviews = [] }) {
  const items = useMemo(() => reviews.filter(r => r && (r.text || r.review)).slice(0, 8), [reviews]);
  const [i, setI] = useState(0);
  useEffect(() => {
    if (items.length < 2) return undefined;
    const timer = setInterval(() => setI(n => (n + 1) % items.length), 5000);
    return () => clearInterval(timer);
  }, [items.length]);
  if (!items.length) return null;
  const k = i % items.length, r = items[k];
  const neg = r.sentiment === "Negative";
  return <div className="pfx-live" role="status" aria-live="off">
    <span className="live-tag"><i />LATEST FEEDBACK</span>
    <div className="live-body" key={String(r.id) + "-" + k}>
      <span className="chip" style={neg ? { color: "var(--crit)", borderColor: "var(--crit)" } : { color: "var(--ok)", borderColor: "var(--ok)" }}>{r.sentiment || "Review"}</span>
      {r.category && <b>{r.category}</b>}
      <span className="muted live-who">{[r.doctor, r.clinic].filter(Boolean).join(" · ")}</span>
      <span className="live-text">“{r.text || r.review}”</span>
    </div>
    {items.length > 1 && <span className="live-count">{k + 1}/{items.length}</span>}
    {items.length > 1 && <span className="live-bar" key={"bar-" + k} />}
  </div>;
}

/* Step tracker (appointment status, patient journey). idx = furthest step reached. */
function Track({ labels, idx }) {
  return <div className="trk" role="img" aria-label={"Progress: " + labels[Math.min(idx, labels.length - 1)]}>
    {labels.map((l, i) => <div key={l} className={"trk-s" + (i <= idx ? " on" : "") + (i < idx ? " fill" : "") + (i === idx ? " cur" : "")}>
      <span className="trk-dot" /><span className="trk-l">{l}</span></div>)}
  </div>;
}
function ApptTrack({ status }) {
  const s = String(status || "requested").toLowerCase();
  if (/cancel|declin|reject/.test(s)) return null;
  const idx = /complet|done|visited/.test(s) ? 2 : /confirm|approv|accept|schedul/.test(s) ? 1 : 0;
  return <Track labels={["Requested", "Confirmed", "Visit done"]} idx={idx} />;
}

/* Shown while a care search is running: staged progress + skeleton cards. */
function SearchProgress() {
  const steps = ["Understanding your concern", "Matching the right type of care", "Searching hospital records", "Comparing patient feedback"];
  const [k, setK] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setK(n => Math.min(n + 1, steps.length - 1)), 1500);
    return () => clearInterval(timer);
  }, []);
  return <div className="sp" role="status" aria-live="polite">
    <ul className="sp-steps">{steps.map((s, i) => <li key={s} className={i < k ? "done" : i === k ? "now" : ""}>
      <span className="sp-dot">{i < k ? "✓" : ""}</span>{s}{i === k && <em className="sp-dots" aria-hidden="true"><i /><i /><i /></em>}</li>)}</ul>
    {[0, 1].map(i => <div key={i} className="sp-skel"><span className="sk-tile" /><span className="sk-lines"><i /><i /></span></div>)}
  </div>;
}

function PatientHero({ name = "", searchCount = 0, appointmentCount = 0, onFind, onAppointments, onTry, eyebrow = "YOUR CARE SPACE", subtitle, art = "patient", stats, actions }) {
  const hour = new Date().getHours();
  const greet = hour < 5 ? "Hello" : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : hour < 22 ? "Good evening" : "Hello";
  const first = String(name || "").trim().split(/\s+/)[0];
  const acts = actions || [
    { label: "Find care", pri: true, onClick: onFind },
    { label: "My appointments", onClick: onAppointments },
    { label: "Read patient reviews ↗", onClick: onTry },
  ];
  const chips = stats || [{ label: "care searches", value: searchCount }, { label: "appointment requests", value: appointmentCount }];
  return <section className="pfx-hero" aria-label="Welcome">
    <div className="pfx-hero-copy">
      <span className="n">{eyebrow}</span>
      <h2>{greet}{first ? <>, <span className="pfx-grad-text">{first}</span></> : null}</h2>
      <p className="muted pfx-lead">{subtitle || "Describe what you need, compare feedback from other patients, and keep your appointment requests in one place."}</p>
      <div className="pfx-hero-actions">
        {acts.map(a => <button key={a.label} type="button" className={"btn" + (a.pri ? " pri" : "")} onClick={a.onClick}>{a.label}</button>)}
      </div>
      <div className="pfx-hero-stats">
        {chips.map(c => <span key={c.label} className="pfx-stat"><b><CountUp value={c.value} /></b> {c.label}</span>)}
      </div>
      {!stats && <div className="pfx-journey"><Track labels={["Describe your concern", "Compare hospitals", "Request an appointment", "Visit"]} idx={appointmentCount > 0 ? 2 : searchCount > 0 ? 1 : 0} /></div>}
    </div>
    <div className="pfx-hero-art"><HeroArt variant={art} /></div>
  </section>;
}

function App() {
  const [page, setPage] = useState("home");
  const [googleAuth, setGoogleAuth] = useState(EMPTY_AUTH);
  const [apptPrefill, setApptPrefill] = useState(null);
  const chooseProvider = (p) => { setApptPrefill(p); setPage("patient-appointments"); };
  const [authChecked, setAuthChecked] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [actionPlans, setActionPlans] = useState([]);
  const [sel, setSel] = useState("");
  const [toastMsg, setToastMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [pipelineStats, setPipelineStats] = useState({
    reviewsMonitored: 0,
    analysisCases: 0,
    actionPlans: 0,
    averageSeverity: 0,
    failed: 0,
  });
  const [settings, setSettings] = useState(() => {
    try {
      const s = localStorage.getItem("aegis-settings");
      const merged = s ? { ...DEFAULTS, ...JSON.parse(s) } : { ...DEFAULTS };
      // Use the local FastAPI backend running on this laptop.
      merged.api = API.baseUrl;
      return merged;
    } catch (e) { return DEFAULTS; }
  });

  useEffect(() => {
    const base = String(settings.api || API.baseUrl).trim().replace(/\/$/, "");
    const params = new URLSearchParams(window.location.search);
    const returnedFromGoogle = params.get("google_auth") === "success";

    // Remove the callback flag from the address bar, but keep this render's
    // returnedFromGoogle value so we can route only after checking the session.
    if (returnedFromGoogle) {
      window.history.replaceState({}, document.title, window.location.pathname);
      setToastMsg("Google sign-in successful");
    }
    if (params.get("google_auth") === "error") {
      window.history.replaceState({}, document.title, window.location.pathname);
      setToastMsg("Google sign-in failed: " + (params.get("reason") || "unknown error"));
      setPage("login");
    }

    fetch(base + "/auth/me", { credentials: "include" })
      .then(r => {
        if (!r.ok) throw new Error("Could not verify sign-in session");
        return r.json();
      })
      .then(data => {
        const auth = mapAuth(data);
        setGoogleAuth(auth);
        // The homepage "Explore the platform" click is the entry point for
        // sign-in: it routes to login/onboarding/dashboard based on auth state.
        if (returnedFromGoogle) {
          setPage(auth.signedIn ? (auth.onboarded ? (auth.role === "patient" ? "patient-dashboard" : "dashboard") : "onboarding") : "login");
        } else if (auth.signedIn && auth.onboarded) {
          setPage(current => current === "login" ? (auth.role === "patient" ? "patient-dashboard" : "dashboard") : current);
        }
      })
      .catch(() => {
        if (returnedFromGoogle) setPage("login");
      })
      .finally(() => setAuthChecked(true));
  }, [settings.api]);

  useEffect(() => {
    applyTheme(settings.theme);
    if (settings.theme === "system" && window.matchMedia) {
      const media = window.matchMedia("(prefers-color-scheme: light)");
      const onChange = () => applyTheme("system");
      media.addEventListener?.("change", onChange);
      try { localStorage.setItem("aegis-settings", JSON.stringify(settings)); } catch (e) { }
      return () => media.removeEventListener?.("change", onChange);
    }
    try { localStorage.setItem("aegis-settings", JSON.stringify(settings)); } catch (e) { }
  }, [settings]);
  useEffect(() => { if (!toastMsg) return; const t = setTimeout(() => setToastMsg(""), 2400); return () => clearTimeout(t); }, [toastMsg]);
  useEffect(() => { window.scrollTo(0, 0); }, [page]);

  useEffect(() => {
    let cancelled = false;

    const loadLiveData = async () => {
      const configuredBase = String(settings.api || API.baseUrl || "").trim();
      const base = configuredBase.replace(/\/$/, "");

      if (!base || base.includes("YOUR-API-HOST")) {
        setApiError("Set the FastAPI URL in Settings → API connection.");
        setLoading(false);
        return;
      }

      try {
        setApiError("");

        const [dashboardResult, reviewsResult, investigationsResult, plansResult] = await Promise.allSettled([
          fetchFirst(base, [API.endpoints.dashboard, "/dashboard/"]),
          fetchFirst(base, [API.endpoints.reviews, "/review", "/reviews/"]),
          fetchFirst(base, [API.endpoints.investigations, "/investigations/", "/analysis", "/analysis-cases"]),
          fetchFirst(base, [API.endpoints.actionPlans, "/action_plans", "/action-plans/", "/action_plans/"]),
        ]);

        if (cancelled) return;

        const dashboardPayload = dashboardResult.status === "fulfilled" ? dashboardResult.value : {};
        const reviewsPayload = reviewsResult.status === "fulfilled" ? reviewsResult.value : [];
        const investigationsPayload = investigationsResult.status === "fulfilled" ? investigationsResult.value : [];
        const plansPayload = plansResult.status === "fulfilled" ? plansResult.value : [];

        const reviewRows = getRows(reviewsPayload, ["reviews", "results", "items"]);
        const investigationRows = getRows(investigationsPayload, ["investigations", "results", "items"]);
        const planRows = getRows(plansPayload, ["action_plans", "actionPlans", "plans", "results", "items", "rows"]);
        setActionPlans(normalizeActionPlans(planRows));

        // The archive contains 283 reviews, while only the selected analysis cases
        // flow through the downstream agents. Keep these as separate live metrics.
        const dashboard = dashboardPayload && typeof dashboardPayload === "object" ? dashboardPayload : {};
        const dashboardData = dashboard.data && typeof dashboard.data === "object" ? dashboard.data : dashboard;

        const readNumber = (obj, keys, fallback = 0) => {
          for (const key of keys) {
            const value = obj?.[key];
            const n = Number(value);
            if (Number.isFinite(n)) return n;
          }
          return fallback;
        };

        const reviewsCount = readNumber(dashboardData,
          ["total_reviews", "reviews_monitored", "review_count", "total", "count", "archive_count", "total_review_archive"],
          getTotal(reviewsPayload, reviewRows.length)
        );

        const analysisCases = readNumber(dashboardData,
          ["analysis_cases", "analysis_cases_found", "analyzed_cases", "analyzed", "cases_analyzed", "investigations"],
          getTotal(investigationsPayload, investigationRows.length)
        );

        const actionPlansCount = readNumber(dashboardData,
          ["action_plans", "action_plan_count", "total_action_plans", "plans_generated", "saved_in_action_plans"],
          getTotal(plansPayload, planRows.length)
        );

        const severityFromRows = investigationRows
          .map(item => Number(firstValue(item, ["severity", "severity_score", "risk_score", "risk", "score"], NaN)))
          .filter(Number.isFinite);
        const severityFromReviewRows = reviewRows
          .map(item => Number(firstValue(item, ["severity", "severity_score", "risk_score", "risk", "score"], NaN)))
          .filter(Number.isFinite);
        const severityValues = severityFromRows.length ? severityFromRows : severityFromReviewRows;
        const averageSeverity = readNumber(dashboardData,
          ["average_severity", "avg_severity", "severity_average", "mean_severity"],
          severityValues.length
            ? severityValues.reduce((a, b) => a + b, 0) / severityValues.length
            : 0
        );

        const failedCount = readNumber(dashboardData, ["failed", "failed_count", "failures"],
          (reviewsResult.status === "rejected" || investigationsResult.status === "rejected" || plansResult.status === "rejected")
            ? 1
            : 0
        );

        console.log("AEGISCARE LIVE PIPELINE", {
          reviewsMonitored: reviewsCount,
          analysisCases,
          actionPlans: actionPlansCount,
          averageSeverity,
          failed: failedCount,
        });

        const normalized = normalizeReviews(
          reviewRows,
          planRows,
          investigationRows
        );

        setReviews(normalized);
        setSel(current =>
          normalized.some(r => r.id === current)
            ? current
            : (normalized[0]?.id || "")
        );

        setPipelineStats({
          reviewsMonitored: reviewsCount,
          analysisCases,
          actionPlans: actionPlansCount,
          averageSeverity,
          failed: failedCount,
        });

        setLastUpdated(new Date());
        setLoading(false);

      } catch (error) {
        if (cancelled) return;
        console.error("AegisCare live API error:", error);
        setApiError(error.message || "API unavailable");
        setLoading(false);
      }
    };

    loadLiveData();
    const timer = setInterval(loadLiveData, 5000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [settings.api]);

  const saveDecision = async (review, status, response) => {
    const configuredBase = String(settings.api || API.baseUrl || "").trim().replace(/\/+$/, "");
    const reviewId = Number(review?.reviewId);
    if (!configuredBase || !Number.isFinite(reviewId) || reviewId <= 0) return;
    try {
      const res = await fetch(`${configuredBase}/reviews/${reviewId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, response: response || "" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Decision save failed (${res.status})`);
      }
    } catch (error) {
      console.error("Could not persist review decision:", error);
      setApiError(`Decision was not saved: ${error.message}`);
      setToastMsg("Could not save decision to PostgreSQL.");
    }
  };

  const setStatus = (id, status) => {
    const target = reviews.find(r => r.id === id);
    setReviews(current => current.map(r => r.id === id ? { ...r, status } : r));
    if (target) saveDecision({ ...target, status }, status, target.response);
  };

  const deleteRejectedReview = async (review) => {
    if (!review || review.status !== "rejected") {
      setToastMsg("Only rejected reviews can be permanently deleted.");
      return;
    }
    const reviewId = Number(review.reviewId ?? review.database_review_id ?? review.id);
    if (!Number.isInteger(reviewId) || reviewId <= 0) {
      setToastMsg("Cannot delete: this item has no valid database review ID.");
      return;
    }
    if (!window.confirm(`Permanently delete rejected review ${reviewId} and its saved analyses/action plans? This cannot be undone.`)) return;
    const configuredBase = String(settings.api || API.baseUrl || "").trim().replace(/\/+$/, "");
    try {
      const res = await fetch(`${configuredBase}/reviews/${reviewId}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.detail || `Delete failed (${res.status})`);
      setReviews(current => current.filter(item => Number(item.reviewId ?? item.database_review_id ?? item.id) !== reviewId));
      setToastMsg(`Rejected review ${reviewId} permanently deleted.`);
    } catch (error) {
      setToastMsg(`Delete failed: ${error.message}`);
      setApiError(`Could not delete rejected review: ${error.message}`);
    }
  };

  const responseSaveTimer = React.useRef(null);
  const setResponse = (id, response) => {
    const target = reviews.find(r => r.id === id);
    setReviews(current => current.map(r => r.id === id ? { ...r, response } : r));
    if (target) {
      if (responseSaveTimer.current) clearTimeout(responseSaveTimer.current);
      responseSaveTimer.current = setTimeout(() => {
        saveDecision({ ...target, response }, target.status || "pending", response);
      }, 700);
    }
  };
  /* ---------- profile dropdown (Settings + Log out) ---------- */
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = React.useRef(null);
  const menuRef = React.useRef(null);
  const [menuPos, setMenuPos] = useState({ top: 64, right: 16 });
  const placeMenu = () => {
    const r = profileRef.current?.getBoundingClientRect();
    if (r) setMenuPos({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) });
  };
  useEffect(() => {
    if (!profileOpen) return;
    placeMenu();
    const onDown = e => {
      if (profileRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
      setProfileOpen(false);
    };
    window.addEventListener("resize", placeMenu);
    window.addEventListener("scroll", placeMenu, true);
    const onKey = e => { if (e.key === "Escape") setProfileOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", placeMenu); window.removeEventListener("scroll", placeMenu, true);
    };
  }, [profileOpen]);

  const logout = async () => {
    const base = String(settings.api || API.baseUrl || "").trim().replace(/\/+$/, "");
    try { await fetch(base + "/auth/logout", { method: "POST", credentials: "include" }); } catch (e) { console.warn("Logout request failed:", e); }
    setGoogleAuth(EMPTY_AUTH);
    try { localStorage.removeItem(SEARCH_HIST_KEY); } catch (e) { }
    setProfileOpen(false);
    setPage("home");
    setToastMsg("Logged out");
  };

  const open = r => { setSel(r.id); setPage("investigation"); };
  // Entry point for sign-in: the homepage "Explore the platform" click decides
  // where to send the person, rather than leaving sign-in to be discovered
  // later from inside the dashboard's profile menu.
  const handleExplore = () => {
    if (!googleAuth.signedIn) { setPage("login"); return; }
    if (!googleAuth.onboarded) { setPage("onboarding"); return; }
    setPage(googleAuth.role === "patient" ? "patient-dashboard" : "dashboard");
  };
  const inApp = googleAuth.signedIn && !!googleAuth.role;
  const landingLike = ["home", "login", "onboarding"].includes(page) || (["about", "contact"].includes(page) && !inApp);
  // Animation layer: every signed-in role (patient, doctor, organization) inside the app, plus login / onboarding.
  const fx = (inApp && page !== "home") || ["login", "onboarding"].includes(page);
  useFx(fx, page);
  const waiting = reviews.filter(r => r.status === "pending").length;
  const review = reviews.find(r => r.id === sel);
  // dhanyashreemv63@gmail.com keeps the original full review-management console;
  // every other organization/hospital account gets the newer landing page.
  const fullAccess = hasFullAccess(googleAuth);
  const dashboardView = googleAuth.role === "patient"
    ? <PatientDashboard auth={googleAuth} apiBaseUrl={settings.api} go={setPage} onChooseProvider={chooseProvider} prefs={settings} />
    : (googleAuth.role === "organization" && !fullAccess)
      ? <OrgDashboard auth={googleAuth} reviews={reviews} go={setPage} />
      : <Dashboard reviews={reviews} open={open} go={setPage} pipelineStats={pipelineStats} />;

  const view = {
    home: <Home explore={handleExplore} />, "patient-appointments": <PatientAppointments apiBaseUrl={settings.api} go={setPage} prefill={apptPrefill} clearPrefill={() => setApptPrefill(null)} prefs={settings} defaultSpecialty={googleAuth.profile?.specialty || ""} />, "patient-dashboard": <PatientDashboard auth={googleAuth} apiBaseUrl={settings.api} go={setPage} onChooseProvider={chooseProvider} prefs={settings} />, onboarding: <Onboarding apiBaseUrl={settings.api} auth={googleAuth} go={setPage} onSaved={d => { const nextAuth = mapAuth(d); setGoogleAuth(nextAuth); setPage(nextAuth.role === "patient" ? "patient-dashboard" : "dashboard"); setToastMsg("Profile saved"); }} />, login: <GoogleLogin apiBaseUrl={settings.api} go={setPage} signedIn={googleAuth.signedIn} email={googleAuth.email} />, try: <AgentPlayground go={next => { if (next === "try") return; setPage(next); }} apiBaseUrl={settings.api} role={googleAuth.role} />, dashboard: dashboardView, reviews: <Reviews reviews={reviews} open={open} pipelineStats={pipelineStats} />,
    investigation: <Investigation review={review} reviews={reviews} setStatus={setStatus} setResponse={setResponse} go={setPage} toast={setToastMsg} />,
    action: <Action reviews={reviews} open={open} actionPlans={actionPlans} pipelineStats={pipelineStats} />, approval: <Approval reviews={reviews} setStatus={setStatus} onDelete={deleteRejectedReview} open={open} toast={setToastMsg} />,
    reports: <Reports reviews={reviews} />, settings: googleAuth.role === "patient"
      ? <PatientSettings auth={googleAuth} apiBaseUrl={settings.api} settings={settings} setSettings={setSettings} toast={setToastMsg} go={setPage} onLogout={logout} onProfileSaved={d => { setGoogleAuth(mapAuth(d)); setToastMsg("Profile saved"); }} />
      : <Settings settings={settings} setSettings={setSettings} toast={setToastMsg} />, about: <About go={setPage} />, contact: <Contact />,
  }[page];

  return <>
    <style>{THEME_CSS}</style>
    <style>{PX_CSS}</style>
    <div className={"app" + (fx ? " pfx" : "")}>
      {fx && <><div className="pfx-aurora" aria-hidden="true"><i /><i /><i /></div><div className="pfx-scroll" aria-hidden="true" /></>}
      <header className={"topbar" + (landingLike ? " landing-nav" : " app-nav")}>
        <button className="brand" onClick={() => setPage("home")} aria-label="AegisCare home">
          <Mark /><span>AegisCare</span>{page !== "home" && <span className="brand-ai">AI</span>}
        </button>
        {landingLike ? <>
          {(page === "home" || page === "about" || page === "contact") && <nav className="marketing-nav" aria-label="Public navigation">
            <button onClick={() => setPage("about")}>About</button>
            <button onClick={() => setPage("contact")}>Contact</button>
          </nav>}
          {page === "home" && <button className="nav-get-started" onClick={handleExplore}>Explore the platform <span>↗</span></button>}
          {(page === "about" || page === "contact") && <button className="nav-get-started" onClick={() => setPage("home")}>Back to home <span>↗</span></button>}
          {page === "onboarding" && <button className="nav-get-started" onClick={logout}>Sign out <span>↗</span></button>}
        </> : <>
          <nav className={"top-nav" + (googleAuth.role === "patient" ? "" : " dense")} aria-label="Main navigation">
            {(googleAuth.role === "patient"
              ? [["patient-dashboard", "My care", "dash"], ["patient-appointments", "Appointments", "check"], ["try", "Try It", "flask"], ["settings", "Settings", "settings"], ["contact", "Contact us", "contact"]]
              : [...NAV.flatMap(([group, items]) => items).filter(([k]) => k !== "home"), ["contact", "Contact us", "contact"]]
            ).map(([k, l, ic]) =>
              <button key={k}
                className={"nav" + ((page === k || (k === "patient-dashboard" && page === "dashboard")) ? " on" : "")}
                aria-current={page === k ? "page" : undefined}
                onClick={() => setPage(k === "patient-dashboard" ? "patient-dashboard" : k)}
                title={l}>
                <Icon n={ic} /><span>{l}</span>
                {k === "approval" && waiting > 0 && <span className="count">{waiting}</span>}
              </button>
            )}
          </nav>
          <div ref={profileRef} style={{ position: "relative" }}>
            <button
              className="btn profile-button"
              onClick={() => googleAuth.signedIn ? setProfileOpen(o => !o) : setPage("login")}
              title={googleAuth.signedIn ? `Signed in${googleAuth.email ? ` as ${googleAuth.email}` : ""}` : "Sign in to your AegisCare account"}
              aria-label="Profile menu"
              aria-haspopup="menu"
              aria-expanded={profileOpen}
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, whiteSpace: "nowrap", padding: "8px 12px", minHeight: 40 }}
            >
              {googleAuth.picture ? <img src={googleAuth.picture} alt="" referrerPolicy="no-referrer" style={{ width: 26, height: 26, borderRadius: "50%", objectFit: "cover" }} /> : <Icon n="user" />}
              <span>{googleAuth.signedIn ? (googleAuth.name || "Profile") : "Sign in"}</span>
              {googleAuth.signedIn && <span aria-hidden="true" style={{ fontSize: 10, opacity: .7 }}>{profileOpen ? "▲" : "▼"}</span>}
            </button>
            {profileOpen && googleAuth.signedIn && createPortal(<div ref={menuRef} role="menu" style={{ position: "fixed", right: menuPos.right, top: menuPos.top, minWidth: 230, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, boxShadow: "0 12px 32px rgba(0,0,0,.35)", padding: 8, zIndex: 100000 }}>
              <div style={{ padding: "8px 10px 10px", borderBottom: "1px solid var(--line)", marginBottom: 6 }}>
                <div style={{ fontWeight: 600, color: "var(--text)" }}>{googleAuth.name || "Signed in"}</div>
                {googleAuth.role && <div className="small muted" style={{ marginTop: 2 }}>{ROLE_LABEL[googleAuth.role]}{googleAuth.profile?.org_name ? ` · ${googleAuth.profile.org_name}` : ""}</div>}
              </div>
              <button role="menuitem" className="nav" onClick={() => { setPage("onboarding"); setProfileOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", padding: "9px 10px", background: "transparent", border: 0, cursor: "pointer", color: "var(--text)" }}>
                <Icon n="user" /><span>Edit profile</span>
              </button>
              <button role="menuitem" className="nav" onClick={() => { setPage("settings"); setProfileOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", padding: "9px 10px", background: "transparent", border: 0, cursor: "pointer", color: "var(--text)" }}>
                <Icon n="settings" /><span>Settings</span>
              </button>
              <button role="menuitem" className="nav" onClick={logout} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", padding: "9px 10px", background: "transparent", border: 0, cursor: "pointer", color: "var(--crit)" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" /></svg><span>Log out</span>
              </button>
            </div>, document.body)}
          </div>
        </>}
      </header>
      <main key={fx ? page : "static"} className={"main" + (page === "home" ? " landing-main" : "")}>
        {apiError && page !== "settings" && page !== "login" && page !== "onboarding" && <div className="panel" role="status" style={{ marginBottom: 16, borderColor: "var(--danger, #bd7777)" }}><b>Backend connection issue</b><p className="small" style={{ margin: "6px 0 0" }}>{apiError}. Check Settings → API connection and verify the dashboard, reviews, investigations, and action-plans endpoints.</p><button className="btn" style={{ marginTop: 10 }} onClick={() => setPage("settings")}>Open API settings</button></div>}
        {fx && page === "dashboard" && (googleAuth.role === "doctor" || googleAuth.role === "organization") && <PatientHero
          name={googleAuth.name}
          eyebrow={googleAuth.role === "doctor" ? "YOUR PRACTICE" : "YOUR ORGANIZATION"}
          subtitle="See what patients are saying, spot problems early, and turn feedback into action." art="provider"
          actions={[{ label: "View reviews", pri: true, onClick: () => setPage("reviews") }, { label: "Action plans", onClick: () => setPage("action") }, { label: "Approvals", onClick: () => setPage("approval") }]}
          stats={[{ label: "reviews monitored", value: reviews.length }, { label: "awaiting approval", value: waiting }]} />}
        {fx && page === "dashboard" && (googleAuth.role === "doctor" || googleAuth.role === "organization") && <LiveFeed reviews={reviews} />}
        {view}
      </main>
      {!landingLike && <footer className="app-status">
        <span>{settings.org}</span>
        <span>{loading ? "Connecting to backend…" : apiError ? `Backend issue · ${apiError}` : "Live backend connected"}</span>
        {lastUpdated && <span>Updated {lastUpdated.toLocaleTimeString()}</span>}
      </footer>}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </div>
  </>;
}

export default App;