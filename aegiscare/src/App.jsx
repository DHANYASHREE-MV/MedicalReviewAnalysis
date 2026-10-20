import React, { useState, useMemo, useEffect } from "react";
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
  { id:"AC-024", doctor:"Dr. Abhilasha", specialty:"Dermatology", clinic:"Apollo Clinic", source:"Practo", date:"2 days ago", sentiment:"Negative", severity:4, category:"Wait Time", route:"Investigation",
    text:"I had to wait almost two hours before the consultation. The doctor was good, but the waiting time was extremely frustrating.",
    rootCause:"Possible OPD scheduling and peak-hour capacity bottleneck.", evidence:"The patient reported nearly two hours of waiting. Other wait-time complaints are linked to this doctor.",
    department:"OPD Operations", lead:"OPD Operations Manager", confidence:0.82,
    response:"Thank you for sharing your experience. We understand that long waits are frustrating, and we are reviewing our appointment scheduling so visits start closer to the booked time.",
    actions:["Review peak-hour appointment allocation","Analyze OPD waiting-time patterns","Review staffing during high-volume periods"], status:"pending" },
  { id:"AC-019", doctor:"Dr. Rahul Mehta", specialty:"Cardiology", clinic:"Manipal Hospital", source:"Google Maps", date:"3 days ago", sentiment:"Negative", severity:3, category:"Staff Behavior", route:"Investigation",
    text:"The doctor was helpful, but the front desk staff were not very responsive and made the appointment process difficult.",
    rootCause:"Potential front-desk service quality issue.", evidence:"The review mentions unresponsive front-desk staff and a difficult appointment process.",
    department:"Patient Services", lead:"Patient Experience Manager", confidence:0.88,
    response:"Thank you for your feedback. We are sorry the booking process was difficult and have shared your comments with our front-desk team.",
    actions:["Review front-desk response times","Run a short service refresher","Add an online booking-help option"], status:"pending" },
  { id:"AC-011", doctor:"Dr. Priya Sharma", specialty:"General Medicine", clinic:"Cloudnine", source:"Practo", date:"4 days ago", sentiment:"Positive", severity:1, category:"Service Quality", route:"Archive",
    text:"Very professional and helpful. The consultation was smooth and the doctor explained everything clearly.",
    rootCause:"No investigation required.", evidence:"The patient describes the consultation as professional, smooth and clear.",
    department:"General Medicine", lead:"Not required", confidence:0.95,
    response:"Thank you for the kind words. We are glad your consultation went smoothly.", actions:["Share the praise with the care team"], status:"archived" },
  { id:"AC-031", doctor:"Dr. Sneha Rao", specialty:"Dermatology", clinic:"Aster CMI", source:"Lybrate", date:"1 week ago", sentiment:"Negative", severity:3, category:"Doctor Communication", route:"Investigation",
    text:"The treatment was explained very quickly and I had several questions after leaving the clinic.",
    rootCause:"Potential consultation communication gap.", evidence:"The patient says the explanation was brief and left questions unanswered.",
    department:"Clinical Quality", lead:"Clinical Quality Lead", confidence:0.79,
    response:"Thank you for telling us. Every patient should leave with clear answers, and we will follow up so your questions are addressed.",
    actions:["Add a post-visit Q&A message","Review consultation time slots","Provide written treatment summaries"], status:"pending" },
  { id:"AC-036", doctor:"Dr. Abhilasha", specialty:"Dermatology", clinic:"Apollo Clinic", source:"Google Maps", date:"1 week ago", sentiment:"Negative", severity:5, category:"Wait Time", route:"Investigation",
    text:"Appointment was at 11 but I was seen after 1 pm. No one told us about the delay.",
    rootCause:"Delays are not communicated to waiting patients.", evidence:"Second wait-time complaint for this doctor this month, plus a communication failure.",
    department:"OPD Operations", lead:"OPD Operations Manager", confidence:0.86,
    response:"We apologise for the delay and for not keeping you informed. We are introducing live wait updates for waiting patients.",
    actions:["Introduce live wait-time updates","Notify patients by SMS when running late"], status:"pending" },
  { id:"AC-040", doctor:"Dr. Kavita Nair", specialty:"Gynaecology", clinic:"Cloudnine", source:"Facebook", date:"2 weeks ago", sentiment:"Negative", severity:2, category:"Billing", route:"Investigation",
    text:"The final bill had charges that were not mentioned earlier. It was confusing to understand.",
    rootCause:"Estimates and final bills are not aligned.", evidence:"The patient reports unexpected charges and an unclear bill.",
    department:"Billing", lead:"Billing Supervisor", confidence:0.74,
    response:"Thank you for raising this. Our billing team will contact you to walk through each charge.",
    actions:["Provide itemised estimates upfront","Review the billing explanation process"], status:"approved" },
];

/* keyword rules for the Home demo; replace with a call to your Agent 1 endpoint */
function demoTriage(text){
  const t = text.toLowerCase();
  const neg = ["wait","rude","delay","bad","slow","late","charged","expensive","unresponsive","frustrat","dirty","confus"].filter(w=>t.includes(w)).length;
  const pos = ["great","good","helpful","professional","excellent","clear","kind","smooth"].filter(w=>t.includes(w)).length;
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
  home: <path d="M3 11l9-8 9 8M5 10v10h14V10"/>,
  dash: <g><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></g>,
  reviews: <path d="M4 6h16M4 12h16M4 18h10"/>,
  invest: <g><circle cx="11" cy="11" r="7"/><path d="M21 21l-5-5"/></g>,
  action: <path d="M9 11l3 3 9-9M20 12v7a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h9"/>,
  reports: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>,
  approval: <g><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></g>,
  settings: <g><path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/></g>,
  contact: <g><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></g>,
  flask: <g><path d="M9 3h6M10 3v6L4.5 19a1.5 1.5 0 001.3 2.2h12.4a1.5 1.5 0 001.3-2.2L14 9V3"/><path d="M7.5 15h9"/></g>,
  hospital: <g><rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M12 8v6M9 11h6M10 21v-4h4v4"/></g>,
  check: <path d="M5 12l4 4 10-10"/>,
  user: <g><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></g>,
};
const Icon = ({n,size=18}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[n]}</svg>;
const Mark = () => <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 2.5l8 3v6.2c0 4.8-3.3 8.2-8 9.8-4.7-1.6-8-5-8-9.8V5.5z"/><path d="M12 8v6M9 11h6"/></svg>;

const sevTone = s => s>=4 ? "crit" : s===3 ? "warn" : "ok";
const Sev = ({v}) => <span className={"sev "+sevTone(v)} title={`Severity ${v} of 5`}><span className="sev-bars">{[1,2,3,4,5].map(i=><i key={i} className={i<=v?"on":""}/>)}</span><b>{v}</b></span>;
const STATUS = { pending:"Awaiting approval", approved:"Approved", rejected:"Rejected", archived:"Archived" };
const Status = ({s}) => <span className={"chip "+s}>{STATUS[s]}</span>;
const CatDot = ({c}) => <span className="catl"><i style={{background:CAT[c]}}/>{c}</span>;
const PageHead = ({title,sub,children}) => <header className="phead"><div><h1>{title}</h1>{sub && <p>{sub}</p>}</div>{children && <div className="row">{children}</div>}</header>;

/* ------------------------------- home -------------------------------- */
function DemoOutput({title, children}){
  return <section className="panel" style={{marginTop:14}}>
    <div className="row" style={{justifyContent:"space-between",marginBottom:10}}>
      <h3 style={{margin:0}}>{title}</h3>
      <span className="chip approved">Output</span>
    </div>
    {children}
  </section>;
}

function DemoField({label, value}){
  return <div className="rowline">
    <span className="muted">{label}</span>
    <b style={{textAlign:"right",maxWidth:"65%"}}>{String(value)}</b>
  </div>;
}

/* ------------------------- agent demo playground -------------------- */
const AGENT_DEMO_REVIEWS = [
  {
    id:"DEMO-01",
    doctor:"Dr. Abhilasha",
    specialty:"Dermatology",
    rating:2,
    text:"I had to wait almost two hours before the consultation. Nobody told us about the delay and the waiting time was extremely frustrating."
  },
  {
    id:"DEMO-02",
    doctor:"Dr. Rahul Mehta",
    specialty:"Cardiology",
    rating:3,
    text:"The doctor was helpful, but the front desk staff were not responsive and the appointment process was difficult."
  },
  {
    id:"DEMO-03",
    doctor:"Dr. Sneha Rao",
    specialty:"Dermatology",
    rating:2,
    text:"The treatment was explained very quickly and I had several questions after leaving the clinic."
  },
  {
    id:"DEMO-04",
    doctor:"Dr. Priya Sharma",
    specialty:"General Medicine",
    rating:5,
    text:"Very professional and helpful. The consultation was smooth and the doctor explained everything clearly."
  }
];

function demoAgent1(review){
  const t=review.text.toLowerCase();
  let category="Service Quality";
  if(/wait|waiting|delay|late|hour/.test(t)) category="Wait Time";
  else if(/front desk|staff|reception|appointment/.test(t)) category="Staff Behavior";
  else if(/explain|explained|question|communication/.test(t)) category="Doctor Communication";
  else if(/bill|billing|charge|price|cost/.test(t)) category="Billing";
  else if(/clean|dirty|hygien/.test(t)) category="Cleanliness";

  const negativeSignals=["wait","waiting","delay","late","frustrat","difficult","not responsive","quickly","questions","charged","confus"].filter(x=>t.includes(x)).length;
  const positiveSignals=["great","good","helpful","professional","smooth","clearly","excellent"].filter(x=>t.includes(x)).length;
  const sentiment=negativeSignals>positiveSignals?"Negative":positiveSignals>negativeSignals?"Positive":"Neutral";
  const severity=sentiment==="Negative" ? Math.min(5, Math.max(2, negativeSignals + (review.rating<=2?1:0))) : 1;
  const actionable=sentiment==="Negative" && severity>=2;

  return {
    sentiment,
    severity,
    category,
    is_actionable:actionable,
    needs_investigation:actionable,
    summary: actionable
      ? `Negative ${category.toLowerCase()} complaint requiring review.`
      : "Positive/neutral experience with no immediate investigation trigger.",
    route: actionable?"Investigation":"Archive"
  };
}

function demoAgent2(review, triage){
  if(!triage?.needs_investigation) return {
    root_cause:"No investigation required.",
    evidence:"Agent 1 did not identify an actionable negative complaint.",
    department:"Not required",
    lead:"Not required",
    confidence:0.95,
    metrics:"Maintain current patient-experience standard."
  };

  const map={
    "Wait Time":{
      root_cause:"OPD scheduling or peak-hour capacity bottleneck.",
      department:"OPD Operations",
      lead:"OPD Operations Manager",
      metrics:"Average waiting time and percentage of appointments starting within 15 minutes."
    },
    "Staff Behavior":{
      root_cause:"Front-desk service quality or appointment-process gap.",
      department:"Patient Services",
      lead:"Patient Experience Manager",
      metrics:"Front-desk response time and appointment-resolution satisfaction."
    },
    "Doctor Communication":{
      root_cause:"Consultation communication gap leaving patient questions unanswered.",
      department:"Clinical Quality",
      lead:"Clinical Quality Lead",
      metrics:"Patient understanding score and post-visit clarification requests."
    },
    Billing:{
      root_cause:"Potential mismatch between communicated estimate and final billing.",
      department:"Billing",
      lead:"Billing Supervisor",
      metrics:"Billing clarification requests and estimate-to-final-bill variance."
    },
    Cleanliness:{
      root_cause:"Facility cleanliness or housekeeping-process gap.",
      department:"Facilities",
      lead:"Facilities Manager",
      metrics:"Housekeeping audit score and repeat cleanliness complaints."
    }
  };
  const base=map[triage.category] || map["Staff Behavior"];
  return {
    root_cause:base.root_cause,
    evidence:`Review text: "${review.text}" Agent 1 classified this as ${triage.category} with severity ${triage.severity}/5.`,
    department:base.department,
    lead:base.lead,
    confidence:Math.min(0.94,0.72 + triage.severity*0.04),
    metrics:base.metrics
  };
}

function demoAgent3(review, triage, investigation){
  if(!triage?.needs_investigation) return {
    objective:"No corrective action required",
    immediate_actions:["Record the positive/neutral feedback."],
    corrective_actions:[],
    preventive_actions:["Continue the current patient-experience practice."],
    owner_role:"Patient Experience Team",
    timeline:"Routine review",
    success_metrics:["Maintain positive patient feedback"],
    priority:"Low"
  };

  const actions={
    "Wait Time":["Review peak-hour appointment allocation","Check actual OPD waiting-time data","Notify patients proactively when appointments are delayed"],
    "Staff Behavior":["Review the appointment interaction","Run a short front-desk service refresher","Provide a clear escalation path for booking issues"],
    "Doctor Communication":["Review consultation communication workflow","Provide a written treatment summary","Offer a post-visit clarification channel"],
    Billing:["Review estimate versus final bill","Provide itemised estimates upfront","Add a billing clarification checkpoint"],
    Cleanliness:["Review housekeeping audit records","Increase checks during peak hours","Track repeat cleanliness complaints"]
  };
  const list=actions[triage.category] || actions["Staff Behavior"];
  return {
    objective:`Reduce ${triage.category.toLowerCase()} complaints for ${review.doctor}.`,
    immediate_actions:[list[0]],
    corrective_actions:[list[1]],
    preventive_actions:[list[2]],
    owner_role:investigation.lead,
    timeline:triage.severity>=4?"Within 24–48 hours":"Within 7 days",
    success_metrics:[investigation.metrics],
    priority:triage.severity>=4?"High":triage.severity>=3?"Medium":"Low"
  };
}

/* Try It page: the only backend call is the existing pipeline endpoint below. */
const PIPELINE_ENDPOINT = "/hospital/run-pipeline";
// 500 is the limit the existing page already enforced; it is not confirmed against the backend.
const REVIEW_COUNT_MAX = 500;
const SOURCE_OPTIONS = {
  all:{ label:"All available sources", supported:false,
    desc:"Combined dataset + Google Maps retrieval is not enabled yet.",
    unsupportedMessage:"Choose Imported dataset or Google Maps. These options run independently so the selected source is respected." },
  dataset:{ label:"Imported dataset (PostgreSQL)", supported:true,
    desc:"Searches the imported Excel rows in PostgreSQL only. It does not open Google Maps." },
  maps:{ label:"Google Maps retrieval", supported:true,
    desc:"Uses the existing Google Maps scraper only. It does not search imported dataset rows." },
};

function AgentPlayground({go, apiBaseUrl = API.baseUrl}){
  const [providerType,setProviderType]=useState("hospital");
  const [diseaseInput,setDiseaseInput]=useState("");
  const [hospitalInput,setHospitalInput]=useState("");
  const [locationInput,setLocationInput]=useState("");
  const [source,setSource]=useState("maps");
  const [fieldErrors,setFieldErrors]=useState({});
  const [reviewCount,setReviewCount]=useState("20");
  const [running,setRunning]=useState(false);
  const [error,setError]=useState("");
  const [result,setResult]=useState(null);
  const [decision,setDecision]=useState({});
  const [planEdits,setPlanEdits]=useState({});
  const [emailDrafts,setEmailDrafts]=useState({});
  const [emailBusy,setEmailBusy]=useState({});
  const [emailErrors,setEmailErrors]=useState({});

  const base=()=>String(apiBaseUrl || API.baseUrl || "").trim().replace(/\/+$/,"");

  const updateEmailDraft=(id, patch)=>setEmailDrafts(current=>({
    ...current,
    [id]:{recipient:"",subject:"",body:"",sent:false,...(current[id]||{}),...patch}
  }));

  const savePlanDecision=async({id,reviewId,status,plan})=>{
    const numericId=Number(reviewId);
    if(!Number.isInteger(numericId)||numericId<=0){
      setEmailErrors(current=>({...current,[id]:"This result has no valid database review_id. The decision cannot be saved or emailed."}));
      return false;
    }
    try{
      const res=await fetch(`${base()}/reviews/${numericId}/decision`,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({status,response:JSON.stringify({action_plan:plan})})
      });
      const data=await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(data.detail||"Could not save the decision to the database.");
      setDecision(current=>({...current,[id]:status}));
      setEmailErrors(current=>({...current,[id]:""}));
      // Remove a rejected plan from the active pipeline view only after the
      // backend confirms the rejection was saved. The decision stays in the
      // database for audit/history rather than hard-deleting the source review.
      if(status === "rejected") {
        setResult(current => {
          if(!current) return current;
          const rejectedId = String(id);
          const isRejectedEntry = entry => {
            const review = entry?.review && typeof entry.review === "object" ? entry.review : {};
            return String(review.review_id ?? entry?.review_id ?? entry?.id ?? "") === rejectedId;
          };
          if(Array.isArray(current)) return current.filter(entry => !isRejectedEntry(entry));
          if(Array.isArray(current.cases)) return {...current, cases: current.cases.filter(entry => !isRejectedEntry(entry))};
          if(Array.isArray(current.results)) return {...current, results: current.results.filter(entry => !isRejectedEntry(entry))};
          return current;
        });
      }
      return true;
    }catch(e){
      setEmailErrors(current=>({...current,[id]:e.message||"Could not save the decision."}));
      return false;
    }
  };

  const generateEmailDraft=async({id,reviewId,plan})=>{
    const numericId=Number(reviewId);
    if(!Number.isInteger(numericId)||numericId<=0){
      setEmailErrors(current=>({...current,[id]:"This result has no valid database review_id, so the email draft cannot be generated."}));
      return;
    }
    const recipient=(emailDrafts[id]?.recipient||"").trim();
    setEmailBusy(current=>({...current,[id]:"generate"}));
    setEmailErrors(current=>({...current,[id]:""}));
    try{
      const res=await fetch(`${base()}/reviews/${numericId}/generate-email`,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({recipient,action_plan:plan})
      });
      const data=await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(data.detail||"Email draft generation failed.");
      updateEmailDraft(id,{recipient:data.recipient??recipient,subject:data.subject||"",body:data.body||"",sent:false});
    }catch(e){setEmailErrors(current=>({...current,[id]:e.message||"Email draft generation failed."}));}
    finally{setEmailBusy(current=>({...current,[id]:false}));}
  };

  const sendEmailDraft=async({id,reviewId})=>{
    const numericId=Number(reviewId);
    const draft=emailDrafts[id]||{};
    if(!Number.isInteger(numericId)||numericId<=0){setEmailErrors(current=>({...current,[id]:"This result has no valid database review_id."}));return;}
    setEmailBusy(current=>({...current,[id]:"send"}));
    setEmailErrors(current=>({...current,[id]:""}));
    try{
      const res=await fetch(`${base()}/reviews/${numericId}/send-approval-email`,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({recipient:draft.recipient,subject:draft.subject,body:draft.body})
      });
      const data=await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(data.detail||"Email sending failed.");
      updateEmailDraft(id,{sent:true,recipient:data.recipient||draft.recipient});
    }catch(e){setEmailErrors(current=>({...current,[id]:e.message||"Email sending failed."}));}
    finally{setEmailBusy(current=>({...current,[id]:false}));}
  };

  const startHospitalReviewRun=async()=>{
    const value=hospitalInput.trim();
    const errs={};
    if(providerType === "disease" ? !diseaseInput.trim() : !value) errs.provider=providerType==="doctor"?"Enter the doctor's name.":providerType==="disease"?"Enter a disease or condition.":"Enter a hospital / clinic name or Google Maps URL.";
    const countText=String(reviewCount).trim();
    const requestedCount=Number(countText);
    if(!countText) errs.count="Enter the number of reviews.";
    else if(!/^\d+$/.test(countText)||!Number.isInteger(requestedCount)||requestedCount<1) errs.count="Enter a positive whole number (1 or more).";
    else if(requestedCount>REVIEW_COUNT_MAX) errs.count=`The current frontend limit is ${REVIEW_COUNT_MAX} reviews per run. Enter ${REVIEW_COUNT_MAX} or fewer.`;
    if(!SOURCE_OPTIONS[source].supported) errs.source=SOURCE_OPTIONS[source].unsupportedMessage;
    setFieldErrors(errs);
    if(Object.keys(errs).length){setError("");return;}
    setRunning(true); setError(""); setResult(null); setDecision({}); setPlanEdits({});
    const queryValue=providerType === "disease" ? diseaseInput.trim() : value;
    const isUrl=providerType !== "disease" && /^https?:\/\//i.test(value);
    const isDoctor=providerType==="doctor";
    try{
      const res=await fetch(`${base()}${PIPELINE_ENDPOINT}`,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        // Existing fields are unchanged; provider_type, doctor_name, location and source are additive.
        body:JSON.stringify({
          hospital_name:isUrl||isDoctor||providerType==="disease" ? "" : value,
          google_maps_url:isUrl ? value : "",
          review_count:requestedCount,
          input:queryValue,
          provider_type:providerType,
          doctor_name:isDoctor ? value : "",
          disease_query:providerType === "disease" ? diseaseInput.trim() : "",
          location:locationInput.trim(),
          source
        })
      });
      const data=await res.json().catch(()=>({}));
      if(!res.ok) {
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
    }catch(e){setError(e.message || "Unable to start the review analysis.");}
    finally{setRunning(false);}
  };

  const cases=Array.isArray(result?.results)?result.results:Array.isArray(result?.reviews)?result.reviews:Array.isArray(result?.cases)?result.cases:[];
  const pick=(item,...keys)=>{for(const key of keys){const value=item?.[key];if(value!==undefined&&value!==null&&value!=="")return value;}return "—";};
  const renderList=(value)=>Array.isArray(value)
    ? <ul>{value.map((x,i)=><li key={i}>{typeof x==="string"?x:JSON.stringify(x)}</li>)}</ul>
    : <p className="muted" style={{whiteSpace:"pre-wrap"}}>{typeof value==="object"&&value?JSON.stringify(value,null,2):(value||"—")}</p>;

  return <>
    <header className="phead" style={{width:"100%",boxSizing:"border-box"}}>
      <div style={{width:"100%"}}>
        <button className="crumb" onClick={()=>go("home")}>← Back to Home</button>
        <h1>Try AegisCare</h1>
        <p>Search patient reviews by hospital, doctor, or disease, then run the existing AI analysis workflow.</p>
      </div>
    </header>

    <section className="panel" style={{marginTop:0,width:"100%",boxSizing:"border-box",padding:"clamp(18px,3vw,36px)"}} aria-labelledby="try-form-title">
      <span className="n">START A REVIEW ANALYSIS</span>
      <h2 className="ph2" id="try-form-title" style={{marginTop:8}}>Set up your analysis</h2>

      <fieldset style={{border:0,padding:0,margin:"18px 0 0"}} disabled={running}>
        <legend className="fl">What do you want to analyse?</legend>
        <div role="radiogroup" aria-label="Analysis type" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12,marginTop:8}}>
          {[["hospital","Hospital / Clinic","hospital"],["doctor","Doctor","user"],["disease","Disease / Condition","activity"]].map(([k,l,ic])=>
            <button type="button" key={k} role="radio" aria-checked={providerType===k} onClick={()=>{setProviderType(k);setFieldErrors({});}}
              className={"btn"+(providerType===k?" pri":"")}
              style={{display:"flex",alignItems:"center",gap:10,justifyContent:"flex-start",padding:"14px 16px",textAlign:"left",borderWidth:providerType===k?2:1}}>
              <Icon n={ic} size={22}/><span>{l}</span>{providerType===k&&<span aria-hidden="true" style={{marginLeft:"auto"}}>✓</span>}
            </button>)}
        </div>
      </fieldset>

      <div className="grid2" style={{gap:14,marginTop:18}}>
        <div className="field" style={{minWidth:0}}>
          <label className="fl" htmlFor="provider-input">{providerType==="doctor"?"Doctor name":providerType==="disease"?"Disease / condition":"Hospital / Clinic name"}</label>
          <input id="provider-input" className="f" value={providerType==="disease"?diseaseInput:hospitalInput} onChange={e=>providerType==="disease"?setDiseaseInput(e.target.value):setHospitalInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!running)startHospitalReviewRun();}}
            placeholder={providerType==="doctor"?"e.g. Dr. Priya Sharma":providerType==="disease"?"e.g. diabetes, asthma, cancer":"Enter a hospital name or paste a Google Maps profile URL"} disabled={running}
            aria-invalid={Boolean(fieldErrors.provider)} aria-describedby={fieldErrors.provider?"provider-err":undefined} style={{width:"100%",boxSizing:"border-box"}}/>
          {fieldErrors.provider&&<p id="provider-err" role="alert" className="small" style={{color:"var(--crit)",marginTop:6}}>{fieldErrors.provider}</p>}
        </div>
        <div className="field" style={{minWidth:0}}>
          <label className="fl" htmlFor="location-input">Location / city <span className="muted">(optional)</span></label>
          <input id="location-input" className="f" value={locationInput} onChange={e=>setLocationInput(e.target.value)} placeholder="Helps when several providers share a name" disabled={running} style={{width:"100%",boxSizing:"border-box"}}/>
        </div>
      </div>

      <div className="grid2" style={{gap:14,marginTop:18}}>
        <div className="field" style={{minWidth:0}}>
          <label className="fl" htmlFor="source-select">Review source</label>
          <select id="source-select" className="f" value={source} onChange={e=>{setSource(e.target.value);setFieldErrors(cur=>({...cur,source:""}));}} disabled={running} aria-describedby="source-help" style={{width:"100%",boxSizing:"border-box"}}>
            {Object.entries(SOURCE_OPTIONS).map(([k,o])=><option key={k} value={k}>{o.label}</option>)}
          </select>
          <p id="source-help" className="small muted" style={{marginTop:7}}>{SOURCE_OPTIONS[source].desc}</p>
          {!SOURCE_OPTIONS[source].supported&&<p role="status" className="small" style={{color:"var(--warn)",marginTop:6}}>Not available yet: {SOURCE_OPTIONS[source].unsupportedMessage}</p>}
          {fieldErrors.source&&<p role="alert" className="small" style={{color:"var(--crit)",marginTop:6}}>{fieldErrors.source}</p>}
        </div>
        <div className="field" style={{minWidth:0}}>
          <label className="fl" htmlFor="review-count">Number of reviews</label>
          <input id="review-count" className="f" type="number" inputMode="numeric" min="1" step="1" value={reviewCount} onChange={e=>setReviewCount(e.target.value)} placeholder="Enter number of reviews" disabled={running}
            aria-invalid={Boolean(fieldErrors.count)} aria-describedby="review-count-help" style={{width:"100%",boxSizing:"border-box"}}/>
          <p id="review-count-help" className="small muted" style={{marginTop:7}}>Any whole number from 1 to {REVIEW_COUNT_MAX}. The results show how many reviews were actually found and processed.</p>
          {fieldErrors.count&&<p role="alert" className="small" style={{color:"var(--crit)",marginTop:6}}>{fieldErrors.count}</p>}
        </div>
      </div>

      <div className="row" style={{marginTop:22,alignItems:"center"}}>
        <button type="button" className="btn pri" disabled={running} onClick={startHospitalReviewRun} style={{minHeight:44,padding:"10px 22px"}}>
          {running?"Analysing reviews…":"Retrieve reviews & analyse"}
        </button>
        {running&&<span className="small muted" role="status">Retrieving reviews and running Agents 1 → 3. This can take a few minutes; please keep this page open.</span>}
      </div>
      {error&&<div className="panel" role="alert" style={{marginTop:16,borderColor:"var(--crit)",color:"var(--crit)",whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{error}</div>}
    </section>

    {result&&<section className="panel" style={{marginTop:20}}>
      <div className="row" style={{justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
        <div><span className="n">FINAL OUTPUT</span><h2 className="ph2" style={{marginTop:8}}>{pick(result,"hospital_name")!=="—"?pick(result,"hospital_name"):hospitalInput}</h2><p className="small muted">The agents ran in the background. Review the final recommendations below.</p></div>
        <span className="chip approved">READY FOR REVIEW</span>
      </div>
      <div className="three" style={{marginBottom:18}}>
        <div><span className="n">Reviews found</span><h3>{pick(result,"reviews_found","total_reviews","count")}</h3></div>
        <div><span className="n">Processed</span><h3>{pick(result,"processed_by_agent1","processed","processed_count","analysed_count")}</h3></div>
        <div><span className="n">Negative reviews</span><h3>{pick(result,"negative_reviews_selected","negative_reviews","negative_count")!="—"?pick(result,"negative_reviews_selected","negative_reviews","negative_count"):cases.filter(item=>String((item.agent1||item.triage||item).sentiment||"").toLowerCase()==="negative" || item.is_negative_review===true).length}</h3></div>
      </div>
      {cases.length>0&&(()=>{
        const stage=(label,ok,fail,total)=><div><span className="n">{label}</span><h3>{fail?`${fail} failed`:ok?`${ok} / ${total} returned`:"No output"}</h3></div>;
        const neg=cases.filter(c=>c.agent2||c.analysis||c.investigation||c.agent2_error||c.agent3||c.action_plan||c.action_plan_result||c.agent3_error);
        return <div className="three" style={{marginBottom:18}}>
          {stage("Agent 1 · Triage",cases.filter(c=>c.agent1||c.triage).length,cases.filter(c=>c.agent1_error).length,cases.length)}
          {stage("Agent 2 · Investigation",neg.filter(c=>c.agent2||c.analysis||c.investigation).length,neg.filter(c=>c.agent2_error).length,neg.length)}
          {stage("Agent 3 · Action plans",neg.filter(c=>c.agent3||c.action_plan||c.action_plan_result).length,neg.filter(c=>c.agent3_error).length,neg.length)}
        </div>;
      })()}
      {cases.length?cases.map((item,index)=>{
        const review = item.review && typeof item.review === "object" ? item.review : {};
        const id=String(review.review_id??item.review_id??item.id??index);
        const triage=item.agent1||item.triage||item;
        const analysis=item.agent2||item.analysis||item.investigation||{};
        const plan=item.agent3||item.action_plan||item.action_plan_result||{};
        const isNegative = item.is_negative_review === true || String(triage.sentiment||item.sentiment||"").toLowerCase()==="negative" || Boolean(item.agent2 || item.analysis || item.investigation || item.agent3 || item.action_plan);
        const hasPlan = Boolean(item.agent3 || item.action_plan || item.action_plan_result);
        const status=decision[id]||item.decision||"pending";
        if(status === "rejected") return null;
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
        const reviewText=review.review_text??item.review_text??(typeof item.review==="string"?item.review:"");
        const displayValue=(value)=>value===undefined||value===null||value===""?"Not returned":value;
        const updatePlanField = (key, value, wasArray) => setPlanEdits(current => {
          const existing = current[id] && typeof current[id] === "object" ? current[id] : originalPlan;
          let nextValue = value;
          if (wasArray) nextValue = value.split("\n").map(line => line.trim()).filter(Boolean);
          return {...current, [id]: {...existing, [key]: nextValue}};
        });
        const planLabel = key => key.replace(/_/g," ").replace(/\b\w/g, c => c.toUpperCase());
        const preferredPlanFields = ["objective","priority","immediate_actions","corrective_actions","preventive_actions","owner_role","timeline","success_metrics"];
        const planFields = [...preferredPlanFields.filter(key => Object.prototype.hasOwnProperty.call(editablePlan,key)), ...Object.keys(editablePlan).filter(key => !preferredPlanFields.includes(key))];
        return <article className="panel" key={id} style={{marginTop:14,overflowWrap:"anywhere"}}>
          <div className="row" style={{justifyContent:"space-between",alignItems:"flex-start"}}><div><span className="n">REVIEW {index+1} · {displayValue(review.overall_rating??item.overall_rating)} / 5 stars</span><h3 style={{marginTop:6}}>{review.reviewer_name||item.reviewer_name||`Review ${index+1}`}</h3></div><span className={status==="approved"?"chip approved":status==="rejected"?"chip pending":"chip"}>{status.toUpperCase()}</span></div>
          <div className="lab">Patient review</div><p style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{reviewText||"Review text was not returned."}</p>
          <section className="panel" style={{marginTop:12}}><h3>Agent 1 · Intake &amp; triage</h3>
            <div className="rowline"><span className="muted">Sentiment</span><b>{displayValue(triage.sentiment)}</b></div>
            <div className="rowline"><span className="muted">Severity</span><b>{triage.severity!==undefined?`${triage.severity} / 5`:"Not returned"}</b></div>
            <div className="rowline"><span className="muted">Complaint category</span><b>{displayValue(triage.category)}</b></div>
            <div className="rowline"><span className="muted">Routing</span><b>{displayValue(triage.route)}</b></div>
            <div className="lab">Summary</div>{renderList(triage.summary)}
            {item.agent1_error&&<p role="alert">Agent 1 error: {item.agent1_error}</p>}
          </section>
          {isNegative && <section className="panel" style={{marginTop:12}}><h3>Agent 2 · Investigation</h3>
            {item.agent2_error?<p role="alert">Agent 2 failed: {item.agent2_error}</p>:(item.agent2||item.analysis||item.investigation)? <>
              <div className="lab">Root cause</div>{renderList(analysis.root_cause)}
              <div className="lab">Evidence</div>{renderList(analysis.evidence)}
              <div className="rowline"><span className="muted">Department</span><b>{displayValue(analysis.department)}</b></div>
              <div className="rowline"><span className="muted">Responsible lead</span><b>{displayValue(analysis.lead)}</b></div>
              <div className="rowline"><span className="muted">Confidence</span><b>{analysis.confidence!==undefined?`${Math.round(Number(analysis.confidence)*100)}%`:"Not returned"}</b></div>
              <div className="lab">Metrics / context</div>{renderList(analysis.metrics)}
            </>:<p className="muted">Agent 2 did not return an output for this review.</p>}
          </section>}
          {isNegative ? <section className="panel" style={{marginTop:12}}><h3>Agent 3 · Editable action plan</h3>
            {item.agent3_error?<p role="alert">Agent 3 failed: {item.agent3_error}</p>:hasPlan? <>
              <p className="small muted">Edit the proposed plan before deciding. Your edits and decision remain in this page's current session.</p>
              <div className="grid2" style={{gap:14,marginTop:14}}>
                {planFields.map(key => {
                  const value = editablePlan[key];
                  const isArray = Array.isArray(value);
                  const isObject = value !== null && typeof value === "object" && !isArray;
                  const fieldValue = isArray ? value.map(entry => typeof entry === "string" ? entry : JSON.stringify(entry)).join("\n") : isObject ? JSON.stringify(value, null, 2) : (value === undefined || value === null ? "" : String(value));
                  const isLong = isArray || isObject || /action|objective|metric|evidence|description|reason|outcome|summary|response|email|prevent|correct|immediate|recommendation|risk|follow/i.test(key);
                  return <div key={key} style={{minWidth:0,gridColumn:isLong ? "1 / -1" : undefined}}>
                    <label className="fl" htmlFor={`agent3-${id}-${key}`}>{planLabel(key)}</label>
                    {key === "priority" ? <select id={`agent3-${id}-${key}`} className="f" value={fieldValue} disabled={status!=="pending"} onChange={e=>updatePlanField(key,e.target.value,false)} style={{width:"100%",boxSizing:"border-box"}}>
                      {!["critical","high","medium","low"].includes(fieldValue.toLowerCase()) && <option value={fieldValue}>{fieldValue || "Select priority"}</option>}
                      <option value="Critical">Critical</option><option value="High">High</option><option value="Medium">Medium</option><option value="Low">Low</option>
                    </select> : <textarea id={`agent3-${id}-${key}`} className="f" aria-label={`Edit ${planLabel(key)}`} rows={isLong ? Math.min(6, Math.max(3, fieldValue.split("\n").length)) : 2} value={fieldValue} disabled={status!=="pending"} onChange={e=>updatePlanField(key,e.target.value,isArray)} style={{width:"100%",boxSizing:"border-box",resize:"vertical",lineHeight:1.5}} />}
                    {isArray && <div className="small muted" style={{marginTop:4}}>Enter one item per line.</div>}
                  </div>;
                })}
              </div>
            </>:<p className="muted">Agent 3 did not return an action plan for this negative review.</p>}
          </section> : null}
          {isNegative && <div className="row" style={{marginTop:14}}>
            <button className="btn pri" disabled={status!=="pending"||!hasPlan} onClick={()=>savePlanDecision({id,reviewId:item.database_review_id??review.review_id??item.review_id??item.id, status:"approved",plan:editablePlan})}>Approve edited plan</button>
            <button className="btn" disabled={status!=="pending"||!hasPlan} onClick={()=>savePlanDecision({id,reviewId:item.database_review_id??review.review_id??item.review_id??item.id,status:"rejected",plan:editablePlan})}>Reject plan</button>
          </div>}
          {emailErrors[id] && status!=="approved" && <p role="alert" style={{marginTop:10,color:"var(--crit)",whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{emailErrors[id]}</p>}
          {isNegative && status==="approved" && <section className="panel" style={{marginTop:14}}>
            <h3>Patient email · LLM-generated draft</h3>
            <p className="small muted">Generate a draft after approval, review/edit it, then send it explicitly. For the demo, enter your own email address. Public reviews do not expose the reviewer's email.</p>
            <div className="field" style={{marginTop:12}}>
              <label className="fl" htmlFor={`email-recipient-${id}`}>Recipient email (demo: your email)</label>
              <input id={`email-recipient-${id}`} className="f" type="email" placeholder="you@example.com" value={emailDrafts[id]?.recipient||""} onChange={e=>updateEmailDraft(id,{recipient:e.target.value})} disabled={Boolean(emailBusy[id])||Boolean(emailDrafts[id]?.sent)} />
            </div>
            <div className="row" style={{marginTop:12}}>
              <button className="btn pri" disabled={Boolean(emailBusy[id])||Boolean(emailDrafts[id]?.sent)} onClick={()=>generateEmailDraft({id,reviewId:item.database_review_id??review.review_id??item.review_id??item.id,plan:editablePlan})}>{emailBusy[id]==="generate"?"Generating email…":"Generate Email Draft"}</button>
              {emailDrafts[id]?.subject && <span className="small muted">Draft generated — edit it before sending.</span>}
            </div>
            {emailDrafts[id]?.subject && <>
              <div className="field" style={{marginTop:14}}><label className="fl" htmlFor={`email-subject-${id}`}>Subject</label><input id={`email-subject-${id}`} className="f" value={emailDrafts[id].subject} onChange={e=>updateEmailDraft(id,{subject:e.target.value})} disabled={Boolean(emailBusy[id])||Boolean(emailDrafts[id]?.sent)} /></div>
              <div className="field" style={{marginTop:12}}><label className="fl" htmlFor={`email-body-${id}`}>Email body</label><textarea id={`email-body-${id}`} className="f" rows={8} value={emailDrafts[id].body} onChange={e=>updateEmailDraft(id,{body:e.target.value})} disabled={Boolean(emailBusy[id])||Boolean(emailDrafts[id]?.sent)} style={{width:"100%",boxSizing:"border-box",resize:"vertical",lineHeight:1.6}} /></div>
              <div className="row" style={{marginTop:12,alignItems:"center"}}>
                <button className="btn pri" disabled={Boolean(emailBusy[id])||Boolean(emailDrafts[id]?.sent)||!emailDrafts[id].recipient?.trim()||!emailDrafts[id].subject?.trim()||!emailDrafts[id].body?.trim()} onClick={()=>sendEmailDraft({id,reviewId:item.database_review_id??review.review_id??item.review_id??item.id})}>{emailBusy[id]==="send"?"Sending…":"Send Email"}</button>
                {emailDrafts[id]?.sent && <span className="chip approved">Email sent to {emailDrafts[id].recipient}</span>}
              </div>
            </>}
            {emailErrors[id] && <p role="alert" style={{marginTop:12,color:"var(--crit)",whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{emailErrors[id]}</p>}
          </section>}
        </article>;
      }):(<p className="muted">The pipeline returned no individual results. Check the response format from the backend.</p>)}
    </section>}
  </>;
}

function GoogleLogin({apiBaseUrl=API.baseUrl,go,signedIn,email}){
  const startGoogleAuth = (mode) => {
    const base=String(apiBaseUrl||API.baseUrl).trim().replace(/\/$/,"");
    // Google handles first-time account creation and returning-user sign-in in the same secure flow.
    window.location.href=base+"/auth/google/start?mode="+encodeURIComponent(mode);
  };
  return <section className="panel" style={{maxWidth:560,margin:"56px auto",padding:32,textAlign:"center"}}>
    <div style={{fontSize:34,marginBottom:10}} aria-hidden="true">✦</div>
    <p className="n" style={{letterSpacing:".12em"}}>WELCOME TO AEGISCARE AI</p>
    <h1 style={{fontSize:32,margin:"10px 0"}}>Sign in</h1>
    <p className="muted" style={{lineHeight:1.7,marginBottom:24}}>Continue with your Google account to access the AegisCare dashboard. New users are registered automatically.</p>
    {signedIn ? <><p className="chip approved" style={{display:"inline-block"}}>Signed in{email?` as ${email}`:""}</p><div style={{marginTop:20}}><button className="btn pri" onClick={()=>go("dashboard")}>Go to dashboard →</button></div></> : <div style={{display:"flex",flexDirection:"column",alignItems:"stretch",gap:12,maxWidth:340,margin:"0 auto"}}>
      <button className="btn pri" onClick={()=>startGoogleAuth("login")} style={{display:"inline-flex",alignItems:"center",justifyContent:"center",gap:10,padding:"12px 20px",minHeight:46}}>
        <span aria-hidden="true" style={{fontWeight:700,fontSize:18}}>G</span> Continue with Google
      </button>
    </div>}
    <div style={{marginTop:22}}><button className="link" onClick={()=>go("home")}>← Back to home</button></div>
    <p className="small muted" style={{marginTop:20}}>Google is used for authentication. Google Business Profile access requires separate permission.</p>
  </section>;
}

function Home({go}){
  return <section className="landing-hero">
    <div className="hero-orb hero-orb-left" aria-hidden="true"/>
    <div className="hero-orb hero-orb-right" aria-hidden="true"/>
    <div className="hero-dots" aria-hidden="true"/>
    <div className="hero-copy">
      <span className="hero-eyebrow">AI-POWERED PATIENT EXPERIENCE INTELLIGENCE</span>
      <h1>AegisCare <span>AI</span></h1>
      <p>Turn patient voices into clearer<br className="desktop-break"/> insights and better care.</p>
      <button className="hero-explore" onClick={()=>go("login")}>Explore the platform <span aria-hidden="true">↗</span></button>
    </div>
    <div className="hero-features" id="how-it-works">
      <div><span className="feature-icon">◌</span><span>Review intelligence</span></div>
      <i/>
      <div><span className="feature-icon">▤</span><span>Clinical context</span></div>
      <i/>
      <div><span className="feature-icon">▥</span><span>Actionable improvements</span></div>
    </div>
  </section>;
}

/* ----------------------------- dashboard ----------------------------- */
function Trend({data}){
  const W=640,H=210,L=34,B=28,T=10,R=12;
  const top = Math.max(5, Math.ceil(Math.max(...data)/5)*5);
  const x = i => L + i*(W-L-R)/(data.length-1);
  const y = v => H-B - (v/top)*(H-B-T);
  const d = data.map((v,i)=>(i?"L":"M")+x(i).toFixed(1)+" "+y(v).toFixed(1)).join(" ");
  return <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Negative reviews per week">
    {[0,top/2,top].map(t=><g key={t}><line x1={L} x2={W-R} y1={y(t)} y2={y(t)} stroke="var(--line)"/><text x={L-8} y={y(t)+4} textAnchor="end" fontSize="11.5" fill="var(--muted)">{t}</text></g>)}
    <path d={d} fill="none" stroke="var(--brand)" strokeWidth="2.2" strokeLinejoin="round"/>
    {data.map((v,i)=><g key={i}><circle cx={x(i)} cy={y(v)} r="3.5" fill="var(--surface)" stroke="var(--brand)" strokeWidth="2"/>
      <text x={x(i)} y={H-8} textAnchor="middle" fontSize="11.5" fill="var(--muted)">{TREND_LABELS[i]}</text></g>)}
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
function rootTheme(text){
  const t = String(text || "").toLowerCase().trim();
  if (!t || t === "analysis pending" || t === "pending") return "Awaiting analysis";
  if (t.includes("no investigation required")) return null;
  for (const [name, re] of ROOT_THEMES) if (re.test(t)) return name;
  return "Other";
}

function startOfWeek(d){ const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
function startOfMonth(d){ return new Date(d.getFullYear(), d.getMonth(), 1); }

function buildTimeSeries(reviews){
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

function TimeChart({ points }){
  const W = 640, H = 230, L = 34, B = 34, T = 12, R = 14;
  const n = points.length;
  const top = Math.ceil(Math.max(4, ...points.map(p => p.total)) / 4) * 4;
  const x = i => n === 1 ? L + (W - L - R) / 2 : L + i * (W - L - R) / (n - 1);
  const y = v => H - B - (v / top) * (H - B - T);
  const path = k => points.map((p, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(p[k]).toFixed(1)).join(" ");
  const step = Math.max(1, Math.ceil(n / 7));
  return <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Reviews received over time">
    {[0, top / 2, top].map(t => <g key={t}>
      <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--line)"/>
      <text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize="11.5" fill="var(--muted)">{t}</text>
    </g>)}
    <path d={path("total")} fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinejoin="round"/>
    <path d={path("neg")} fill="none" stroke="var(--crit)" strokeWidth="2.4" strokeLinejoin="round"/>
    {points.map((p, i) => <g key={i}>
      <circle cx={x(i)} cy={y(p.total)} r="3" fill="var(--surface)" stroke="var(--muted)" strokeWidth="1.8"><title>{`${p.label}: ${p.total} reviews`}</title></circle>
      <circle cx={x(i)} cy={y(p.neg)} r="3.5" fill="var(--surface)" stroke="var(--crit)" strokeWidth="2"><title>{`${p.label}: ${p.neg} negative`}</title></circle>
      {i % step === 0 && <text x={x(i)} y={H - 10} textAnchor="middle" fontSize="11" fill="var(--muted)">{p.label}</text>}
    </g>)}
  </svg>;
}

function BarRow({ label, value, max, suffix, color, dim }){
  return <div className="hb">
    <div className="t"><span>{label}</span><b>{value}{suffix || ""}</b></div>
    <div className="track"><div style={{ width: Math.max(2, (value / (max || 1)) * 100) + "%", opacity: dim ? .5 : 1, ...(color ? { background: color } : {}) }}/></div>
  </div>;
}

function DonutChart({ data }){
  const total = data.reduce((a, c) => a + c.v, 0) || 1;
  const R = 62, SW = 26, C = 2 * Math.PI * R;
  let offset = 0;
  return <svg viewBox="0 0 160 160" width="180" height="180" role="img" aria-label="Complaint category breakdown">
    <g transform="translate(80,80) rotate(-90)">
      <circle r={R} fill="none" stroke="var(--surface-2)" strokeWidth={SW}/>
      {data.map(d => {
        const frac = d.v / total;
        const dash = frac * C;
        const seg = <circle key={d.k} r={R} fill="none" stroke={CAT[d.k] || "var(--brand)"} strokeWidth={SW}
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

function Dashboard({reviews, pipelineStats}){
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
  const empty = <p className="muted" style={{margin:0}}>No negative reviews yet. This chart fills in once reviews are analysed.</p>;

  return <>
    <PageHead title="Dashboard" sub="What patients are saying, and why."/>
    <div className="panel kpis">
      {kpis.map(([l, v, d]) => <div className="kpi" key={l}><div className="l">{l}</div><div className="v">{v}</div><div className="d">{d}</div></div>)}
    </div>

    <div className="cols" style={{marginTop:20}}>
      <section className="panel" style={{marginTop:0}}>
        <h2 className="ph2">Why patients are unhappy <small>Complaint categories</small></h2>
        {categories.length ? <div className="row" style={{gap:22,alignItems:"center",flexWrap:"wrap"}}>
          <DonutChart data={categories}/>
          <div style={{flex:"1 1 160px",minWidth:160}}>
            {categories.map(c => <div className="rowline" key={c.k}><CatDot c={c.k}/><b>{c.v} · {c.pct}%</b></div>)}
          </div>
        </div> : empty}
      </section>
      <section className="panel" style={{marginTop:0}}>
        <h2 className="ph2">Root causes <small>Themes from Agent 2</small></h2>
        {themes.length ? themes.map((t, i) => <BarRow key={t.k} label={t.k} value={t.v} max={themes[0].v} dim={i !== 0}/>) : empty}
        <p className="small muted" style={{marginTop:10}}>Root-cause text is grouped into themes by keyword.</p>
      </section>
    </div>

    <section className="panel" style={{marginTop:20}}>
      <div className="row" style={{justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
        <div>
          <h2 className="ph2" style={{marginBottom:3}}>How often reviews come in</h2>
          <div className="small muted">Reviews per {series.mode} · negative reviews highlighted</div>
        </div>
        {series.points.length > 0 && <div className="small muted" style={{textAlign:"right"}}>
          Avg <b>{perPeriod}</b> per {series.mode}{peak ? <> · Peak <b>{peak.total}</b> ({peak.label})</> : null}
        </div>}
      </div>
      {series.points.length ? <>
        <TimeChart points={series.points}/>
        <div className="legend"><span><i style={{background:"var(--muted)"}}/>All reviews</span><span><i style={{background:"var(--crit)"}}/>Negative</span></div>
        {series.undated > 0 && <p className="small muted" style={{marginTop:8}}>{series.undated} review{series.undated === 1 ? "" : "s"} without a usable date are not shown.</p>}
      </> : <p className="muted" style={{margin:0}}>No review dates available yet. Dates appear once reviews carry a timestamp.</p>}
    </section>

    <section className="panel" style={{marginTop:20}}>
      <h2 className="ph2">Pattern map <small>Complaint category × doctor</small></h2>
      {heat.cats.length && heat.doctors.length ? <div className="scroll-x">
        <table>
          <thead><tr><th></th>{heat.doctors.map(d => <th key={d} style={{fontSize:12,textAlign:"center"}}>{d.split(" ").slice(0, 2).join(" ")}</th>)}</tr></thead>
          <tbody>{heat.cats.map(c => <tr key={c}>
            <td style={{whiteSpace:"nowrap"}}><CatDot c={c}/></td>
            {heat.doctors.map(d => {
              const v = heat.cell[c + "||" + d] || 0;
              const pct = v ? Math.round(18 + 70 * v / (heat.max || 1)) : 0;
              return <td key={d} title={`${c} · ${d}: ${v}`} style={{textAlign:"center",fontWeight:600,background: v ? `color-mix(in srgb, var(--crit) ${pct}%, var(--surface-2))` : "transparent"}}>{v || "·"}</td>;
            })}
          </tr>)}</tbody>
        </table>
      </div> : empty}
      <p className="small muted" style={{marginTop:10}}>Darker cells mean more negative reviews. Shows the top 6 doctors.</p>
    </section>
  </>;
}

/* ------------------------------ reviews ------------------------------ */
function Reviews({reviews, open, pipelineStats}){
  const [q,setQ] = useState(""); const [route,setRoute] = useState("All"); const [cat,setCat] = useState("All");
  const list = reviews.filter(r=>(route==="All"||r.route===route)&&(cat==="All"||r.category===cat)&&(r.text+r.doctor+r.clinic).toLowerCase().includes(q.toLowerCase()));
  return <>
    <PageHead title="Reviews" sub="Every review, as sorted by the triage agent."/>
    <div className="toolbar">
      <div><label className="fl" htmlFor="q">Search</label><input id="q" className="f" placeholder="Doctor, clinic or words in the review" value={q} onChange={e=>setQ(e.target.value)}/></div>
      <div><label className="fl" htmlFor="rt">Route</label><select id="rt" className="f" value={route} onChange={e=>setRoute(e.target.value)}><option>All</option><option>Investigation</option><option>Archive</option></select></div>
      <div><label className="fl" htmlFor="ct">Category</label><select id="ct" className="f" value={cat} onChange={e=>setCat(e.target.value)}><option>All</option>{Object.keys(CAT).map(c=><option key={c}>{c}</option>)}</select></div>
    </div>
    <div className="panel"><div className="scroll-x"><table>
      <thead><tr><th>Review</th><th>Category</th><th>Severity</th><th>Source</th><th>Status</th></tr></thead>
      <tbody>{list.map(r=><tr key={r.id}>
        <td><button className="link" onClick={()=>open(r)}>{r.doctor}</button> <span className="small muted">{r.id}</span><div className="clip">{r.text}</div></td>
        <td><CatDot c={r.category}/></td><td><Sev v={r.severity}/></td>
        <td className="muted">{r.source}<div className="small">{r.date}</div></td><td><Status s={r.status}/></td></tr>)}
        {list.length===0 && <tr><td colSpan="5" className="muted">No live reviews match these filters. Clear filters, or check Settings → API connection and confirm GET /api/reviews returns review rows.</td></tr>}
      </tbody></table></div></div>
  </>;
}

/* ---------------------------- investigation -------------------------- */
function Investigation({review, reviews, setStatus, setResponse, go, toast}){
  if(!review) return <div className="panel">No case is selected. Open Reviews and select a live review. If Reviews is empty, check the API connection and confirm Agent 1 results are saved and returned by GET /api/reviews.</div>;
  const same = reviews.filter(r=>r.doctor===review.doctor);
  const sameCat = same.filter(r=>r.category===review.category);
  const avg = same.length ? (same.reduce((a,r)=>a+r.severity,0)/same.length).toFixed(1) : "–";
  const archived = review.route==="Archive";
  const stage = i => archived ? (i===0?"done":"skip") : i<3 ? "done" : review.status==="approved" ? "done" : review.status==="rejected" ? "stop" : "now";
  const steps = ["Triage","Investigation","Action plan","Approval"];
  return <>
    <button className="crumb" onClick={()=>go("reviews")}>← Reviews</button>
    <PageHead title={review.doctor} sub={`${review.specialty}, ${review.clinic}. Case ${review.id}.`}><Status s={review.status}/></PageHead>
    <ol className="pipe" aria-label="Case progress">{steps.map((s,i)=><li key={s} className={stage(i)}><span className="n">{stage(i)==="done"?<Icon n="check" size={14}/>:i+1}</span>{s}</li>)}</ol>

    <div className="detail">
      <div>
        <section className="panel">
          <h2 className="ph2">Patient feedback</h2>
          <p className="quote">"{review.text}"</p>
          <p className="small muted">{review.source}, {review.date}</p>
        </section>
        <section className="panel">
          <h2 className="ph2">Triage result</h2>
          <dl className="facts" style={{margin:0}}>
            <div><dt>Sentiment</dt><dd>{review.sentiment}</dd></div>
            <div><dt>Severity</dt><dd><Sev v={review.severity}/></dd></div>
            <div><dt>Category</dt><dd><CatDot c={review.category}/></dd></div>
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
            <textarea id="reply" className="f" value={review.response} onChange={e=>setResponse(review.id,e.target.value)}/></div>
          <div className="lab">Generated action plans ({review.actionPlans?.length || 0})</div>
          <ul className="checks">
            {(review.actions || []).map((a,i)=>
              <li key={`${review.id}-action-${i}`}>
                <Icon n="check" size={16}/><span>{a}</span>
              </li>
            )}
          </ul>
          {(review.actionPlans || []).map((plan,i)=>
            <div key={plan._key || i} className="rowline">
              <span>{plan.title || plan.objective || "Action plan"}</span>
              <span className="small muted">{plan.timeline || plan.owner_role || ""}{plan.confidence != null ? ` · ${Math.round(Number(plan.confidence)*100)}% plan support` : ""}</span>
            </div>
          )}
        </section>
      </div>
      <aside>
        <section className="panel">
          <h2 className="ph2">AI confidence estimates</h2>
          <p className="small muted">Estimates only; not validated accuracy probabilities.</p>
          {[{label:"Agent 1 · Triage consistency",value:review.triageConfidence},{label:"Agent 2 · Root-cause assessment",value:review.confidence},{label:"Agent 3 · Plan support",value:review.actionPlanConfidence}].map((item) => {
            const value = Math.max(0, Math.min(100, Math.round(Number(item.value || 0) * 100)));
            return <div key={item.label} style={{marginTop:14}}>
              <div className="rowline" style={{alignItems:"center",gap:8}}><span className="small">{item.label}</span><b>{Number(item.value || 0) > 0 ? `${value}%` : "Not available"}</b></div>
              <div className="track" style={{margin:"7px 0 0"}}><div style={{width:`${value}%`}}/></div>
            </div>;
          })}
          <p className="small muted" style={{marginTop:12}}>Agent 1 uses review-text/rating consistency. Agent 2 uses its model-estimated root-cause confidence. Agent 3 combines Agent 2 confidence with plan completeness.</p>
        </section>
        <section className="panel">
          <h2 className="ph2">Ownership</h2>
          <div className="lab">Department</div><div><b>{review.department}</b></div>
          <div className="lab">Responsible lead</div><div><b>{review.lead}</b></div>
        </section>
        <section className="panel">
          <h2 className="ph2">Pattern for {review.doctor.split(" ").slice(0,2).join(" ")}</h2>
          <div className="rowline"><span>Reviews on file</span><b>{same.length}</b></div>
          <div className="rowline"><span>{review.category} reviews</span><b>{sameCat.length}</b></div>
          <div className="rowline"><span>Average severity</span><b>{avg}</b></div>
          <div className="rowline"><span>Negative reviews</span><b>{same.filter(r=>r.sentiment==="Negative").length}</b></div>
        </section>
      </aside>
    </div>

    <div className="decision">
      <p>{archived ? "This review needs no action." : "Nothing is sent until you decide."}</p>
      <div className="row">
        <button className="btn danger" disabled={archived} onClick={()=>{setStatus(review.id,"rejected");toast("Rejected. The case is closed.");}}>Reject</button>
        <button className="btn pri" disabled={archived} onClick={()=>{setStatus(review.id,"approved");toast("Approved. The reply is ready to send.");}}>Approve reply</button>
      </div>
    </div>
  </>;
}

/* ------------------------ action + approvals ------------------------- */
function Action({reviews, open, actionPlans = [], pipelineStats}){
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
      <ul style={{margin:"8px 0 0 18px",padding:0}}>
        {items.map((item, i) => (
          <li key={i} style={{marginBottom:8,lineHeight:1.45}}>{item}</li>
        ))}
      </ul>
    );
  };

  const renderPlan = (plan, planIndex) => (
    <div
      key={plan._key || `${plan.reviewId}-${planIndex}`}
      className="panel"
      style={{marginTop:14}}
    >
      <div className="row" style={{justifyContent:"space-between",alignItems:"flex-start"}}>
        <div>
          <div className="lab">ACTION PLAN {planIndex + 1}</div>
          <h3 style={{margin:"5px 0 0"}}>
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

      <div className="grid3" style={{gap:14,marginTop:16}}>
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

      <div className="grid3" style={{gap:14,marginTop:16}}>
        <div className="panel" style={{marginTop:0}}>
          <div className="lab">Owner</div>
          <b>{plan.owner_role || "—"}</b>
        </div>

        <div className="panel" style={{marginTop:0}}>
          <div className="lab">Timeline</div>
          <b>{plan.timeline || "—"}</b>
        </div>

        <div className="panel" style={{marginTop:0}}>
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
        <div className="v">{pipelineStats?.analysisCases ?? cases.length}</div>
        <div className="d">Reviews analyzed by Agent 2</div>
      </div>

      <div className="kpi">
        <div className="l">Action plans</div>
        <div className="v">{allPlans.length}</div>
        <div className="d">Actual Agent 3 outputs</div>
      </div>

      <div className="kpi">
        <div className="l">Plans per case</div>
        <div className="v">
          {cases.length ? (allPlans.length / cases.length).toFixed(1) : "0"}
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
      <div style={{marginTop:20}}>
        {cases.map((item, caseIndex) => (
          <section className="panel" key={item.key} style={{marginBottom:20}}>
            <div className="row" style={{justifyContent:"space-between",alignItems:"flex-start"}}>
              <div>
                <div className="eyebrow">AGENT 3 · REPLY AND ACTION PLANS</div>
                <h2 className="ph2" style={{margin:"6px 0"}}>
                  {item.doctor || "Patient case"}
                </h2>
                <div className="muted">
                  {item.reviewCase || `Case ${caseIndex + 1}`}
                  {item.specialty ? ` · ${item.specialty}` : ""}
                  {item.clinic ? ` · ${item.clinic}` : ""}
                </div>
              </div>

              <div style={{textAlign:"right"}}>
                <Sev v={Number(item.severity) || 1}/>
                <div style={{marginTop:7}}>
                  <CatDot c={item.category || "Service Quality"}/>
                </div>
              </div>
            </div>

            {item.reviewText && (
              <div className="panel" style={{marginTop:16}}>
                <div className="lab">Patient review</div>
                <p className="muted" style={{whiteSpace:"pre-wrap",lineHeight:1.55,marginBottom:0}}>
                  {item.reviewText}
                </p>
              </div>
            )}

            <div className="grid2" style={{gap:14,marginTop:14}}>
              <div className="panel" style={{marginTop:0}}>
                <div className="lab">Agent 2 · Root cause</div>
                <p style={{margin:"6px 0",lineHeight:1.5}}>
                  {item.rootCause || "—"}
                </p>
              </div>

              <div className="panel" style={{marginTop:0}}>
                <div className="lab">Agent 2 · Evidence</div>
                <p className="muted" style={{margin:"6px 0",lineHeight:1.5,whiteSpace:"pre-wrap"}}>
                  {item.evidence || "—"}
                </p>
              </div>
            </div>

            <div className="grid3" style={{gap:14,marginTop:14}}>
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

            <div style={{marginTop:20}}>
              <div className="row" style={{justifyContent:"space-between",alignItems:"center"}}>
                <h3 style={{margin:0}}>Agent 3 — Reply and action plans</h3>
                <span className="chip approved">
                  {item.plans.length} plan{item.plans.length === 1 ? "" : "s"}
                </span>
              </div>

              {item.plans.map(renderPlan)}
            </div>

            <div className="row" style={{justifyContent:"flex-end",marginTop:16}}>
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
      <div className="panel muted" style={{marginTop:20}}>
        <b>Agent 3 output is being prepared.</b>
        <div style={{marginTop:6}}>
          Connect <b>/api/action-plans</b> to replace the presentation preview with the saved Agent 3 results.
        </div>
      </div>
    )}
  </>;
}

function Approval({reviews, setStatus, onDelete, open, toast}){
  const [tab,setTab] = useState("pending");
  const list = reviews.filter(r=>r.status===tab);
  const cnt = s => reviews.filter(r=>r.status===s).length;
  const tabs = [["pending","Awaiting approval"],["approved","Approved"],["rejected","Rejected"]];
  return <>
    <PageHead title="Approvals" sub="Check what the agents drafted before it goes out."/>
    <div className="tabs" role="tablist">{tabs.map(([k,l])=><button key={k} role="tab" aria-selected={tab===k} className={tab===k?"on":""} onClick={()=>setTab(k)}>{l} ({cnt(k)})</button>)}</div>
    {list.length===0 && <div className="panel muted">Nothing here yet.</div>}
    {list.map(r=><section key={r.id} className="panel">
      <div className="row" style={{justifyContent:"space-between"}}><span><b>{r.doctor}</b> <span className="small muted">{r.id}</span></span><Sev v={r.severity}/></div>
      <div style={{margin:"8px 0"}}><CatDot c={r.category}/></div>
      <p className="muted" style={{marginBottom:14}}>{r.response}</p>
      <div className="row">
        {tab!=="approved" && <button className="btn pri" onClick={()=>{setStatus(r.id,"approved");toast("Approved "+r.id);}}>Approve</button>}
        {tab!=="rejected" && <button className="btn danger" onClick={()=>{setStatus(r.id,"rejected");toast("Rejected "+r.id);}}>Reject</button>}
        {tab==="rejected" && <button className="btn danger" onClick={()=>onDelete(r)}>Delete permanently</button>}
        <button className="btn" onClick={()=>open(r)}>Edit reply</button>
      </div></section>)}
  </>;
}

/* ------------------------------ reports ------------------------------ */
function Reports({reviews}){
  const by = key => { const m={}; reviews.forEach(r=>{(m[r[key]] ||= []).push(r.severity);}); return Object.entries(m).map(([k,a])=>({k,n:a.length,avg:a.reduce((x,y)=>x+y,0)/a.length})).sort((a,b)=>b.avg-a.avg); };
  const Block = ({title,rows}) => <section className="panel" style={{marginTop:0}}><h2 className="ph2">{title}</h2>
    {rows.map(r=><div className="hb" key={r.k}><div className="t"><span>{r.k} <span className="small muted">({r.n})</span></span><b>{r.avg.toFixed(1)}</b></div><div className="track"><div style={{width:r.avg/5*100+"%"}}/></div></div>)}</section>;
  return <>
    <PageHead title="Reports" sub="Average severity out of 5, with the number of reviews in brackets."/>
    <div className="grid2"><Block title="By doctor" rows={by("doctor")}/><Block title="By clinic" rows={by("clinic")}/><Block title="By department" rows={by("department")}/><Block title="By source" rows={by("source")}/></div>
  </>;
}

/* ------------------------------ settings ----------------------------- */
function Switch({on,onChange,label,disabled}){ return <button role="switch" aria-checked={on} aria-label={label} disabled={disabled} className="sw" onClick={()=>onChange(!on)}/>; }
function Settings({settings, setSettings, toast}){
  const [draft,setDraft] = useState(settings);
  const set = (k,v) => setDraft(d=>({...d,[k]:v}));

  useEffect(()=>{
    applyTheme(draft.theme);
    if (draft.theme !== "system" || !window.matchMedia) return;
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => applyTheme("system");
    media.addEventListener?.("change", onChange);
    return () => media.removeEventListener?.("change", onChange);
  }, [draft.theme]);
  const src = (k,v) => setDraft(d=>({...d,sources:{...d.sources,[k]:v}}));
  return <>
    <PageHead title="Settings" sub="Choose what AegisCare watches and how it behaves."/>
    <div className="panel">
      <div className="setrow"><div><h3>Organisation</h3><p>Shown on reports and in alert emails.</p></div>
        <div><div className="field"><label className="fl" htmlFor="org">Organisation name</label><input id="org" className="f" value={draft.org} onChange={e=>set("org",e.target.value)}/></div>
          <div className="field"><label className="fl" htmlFor="em">Alert email</label><input id="em" type="email" className="f" placeholder="you@your-domain.com" value={draft.email} onChange={e=>set("email",e.target.value)}/></div>
          <div className="field"><div className="fl">Theme</div><div className="seg">{["system","light","dark"].map(t=><button key={t} className={draft.theme===t?"on":""} onClick={()=>set("theme",t)}>{t[0].toUpperCase()+t.slice(1)}</button>)}</div></div></div></div>
      <div className="setrow"><div><h3>Review sources</h3><p>Reviews are collected from the sources you turn on.</p></div>
        <div>{Object.keys(draft.sources).map(k=><div className="tog" key={k}><span>{k}</span><Switch on={draft.sources[k]} onChange={v=>src(k,v)} label={k}/></div>)}</div></div>
      <div className="setrow"><div><h3>Agents</h3><p>Control when a review is escalated and how replies are drafted.</p></div>
        <div><div className="field"><label className="fl" htmlFor="sev">Investigate reviews at severity {draft.threshold} or higher</label>
          <input id="sev" type="range" min="1" max="5" value={draft.threshold} onChange={e=>set("threshold",+e.target.value)} style={{width:"100%",accentColor:"var(--brand)"}}/></div>
          <div className="tog"><span>Draft replies automatically<small>The action agent writes a reply for each case.</small></span><Switch on={draft.autoDraft} onChange={v=>set("autoDraft",v)} label="Draft replies automatically"/></div>
          <div className="tog"><span>Require human approval<small>Always on for patient-facing replies.</small></span><Switch on={true} disabled onChange={()=>{}} label="Require human approval"/></div></div></div>
      <div className="setrow"><div><h3>Notifications</h3><p>Choose which emails you receive.</p></div>
        <div><div className="tog"><span>Alert me to severity 4 and 5 cases</span><Switch on={draft.notifyHigh} onChange={v=>set("notifyHigh",v)} label="Severity alerts"/></div>
          <div className="tog"><span>Send a weekly summary</span><Switch on={draft.weekly} onChange={v=>set("weekly",v)} label="Weekly summary"/></div></div></div>
      <div className="setrow"><div><h3>API connection</h3><p>The backend that runs the three agents.</p></div>
        <div className="field"><label className="fl" htmlFor="api">API base URL</label><input id="api" className="f" value={draft.api} onChange={e=>set("api",e.target.value)}/></div></div>
    </div>
    <div className="row" style={{marginTop:20}}>
      <button className="btn pri" onClick={()=>{setSettings(draft);toast("Settings saved");}}>Save settings</button>
      <button className="btn" onClick={()=>setDraft(settings)}>Discard changes</button>
    </div>
  </>;
}

/* -------------------------------- about ------------------------------- */
function About({go}){
  return <>
    <PageHead title="About AegisCare AI" sub="Turning patient voices into clearer insights and better care."/>
    <section className="panel" style={{padding:"clamp(24px,4vw,48px)",marginBottom:18,background:"radial-gradient(circle at 90% 10%, rgba(190,133,200,.15), transparent 34%),var(--surface)"}}>
      <span className="hero-eyebrow">OUR PURPOSE</span>
      <h2 style={{fontSize:"clamp(28px,4vw,44px)",lineHeight:1.15,maxWidth:820,margin:"14px 0"}}>Better care begins with listening.</h2>
      <p className="muted" style={{fontSize:17,lineHeight:1.8,maxWidth:850}}>AegisCare AI is a patient-experience intelligence platform designed to help healthcare teams make sense of hospital reviews. It organizes patient feedback into clear signals, highlights issues that may need attention, and helps teams plan practical service improvements.</p>
      <div className="row" style={{marginTop:24,flexWrap:"wrap"}}>
        <button className="btn pri" onClick={()=>go("dashboard")}>Explore the dashboard <span aria-hidden="true">↗</span></button>
        <button className="btn" onClick={()=>go("try")}>Try the workflow <span aria-hidden="true">→</span></button>
      </div>
    </section>
    <div className="cols" style={{alignItems:"stretch"}}>
      <section className="panel">
        <span className="hero-eyebrow">OUR MISSION</span>
        <h2 className="ph2" style={{marginTop:12}}>Make patient feedback actionable</h2>
        <p className="muted" style={{lineHeight:1.8}}>Patient reviews can reveal recurring concerns about communication, waiting times, facilities, billing, and the overall care experience. AegisCare helps teams move beyond reading reviews one by one toward structured review, investigation, and follow-through.</p>
      </section>
      <section className="panel">
        <span className="hero-eyebrow">OUR APPROACH</span>
        <h2 className="ph2" style={{marginTop:12}}>From feedback to follow-through</h2>
        <p className="muted" style={{lineHeight:1.8}}>The platform supports a workflow that triages reviews, investigates underlying causes, and proposes corrective and preventive actions for teams to review. AI-generated insights are intended to support human decision-making, not replace clinical judgment.</p>
      </section>
    </div>
    <section className="panel" style={{marginTop:18}}>
      <span className="hero-eyebrow">THE AEGISCARE WORKFLOW</span>
      <div className="cols" style={{marginTop:18,alignItems:"stretch"}}>
        <div><div className="feature-icon" style={{marginBottom:12}}>01</div><h3>Intake &amp; triage</h3><p className="muted" style={{lineHeight:1.7}}>Identify sentiment, severity, complaint category, and the appropriate route for each review.</p></div>
        <div><div className="feature-icon" style={{marginBottom:12}}>02</div><h3>Investigation</h3><p className="muted" style={{lineHeight:1.7}}>Examine evidence and contextual factors to identify possible root causes and accountable teams.</p></div>
        <div><div className="feature-icon" style={{marginBottom:12}}>03</div><h3>Action planning</h3><p className="muted" style={{lineHeight:1.7}}>Turn findings into proposed immediate, corrective, and preventive actions with ownership and measures of success.</p></div>
      </div>
    </section>
  </>;
}

/* ------------------------------ contact ------------------------------ */
function Contact(){
  const [f,setF] = useState({name:"",email:"",topic:"Product demo",msg:""}); const [sent,setSent] = useState(false);
  const ok = f.name && /\S+@\S+\.\S+/.test(f.email) && f.msg;
  const c = PLACEHOLDER.contact;
  return <>
    <PageHead title="Contact us" sub="Questions, a demo, or a problem with a review? Tell us."/>
    <div className="cols">
      <section className="panel">
        {sent ? <div><h2 className="ph2">Message ready</h2><p className="muted" style={{marginBottom:14}}>This form has no backend yet. Connect it to your API or email service to deliver messages.</p><button className="btn" onClick={()=>setSent(false)}>Write another</button></div> : <>
          <div className="field"><label className="fl" htmlFor="n">Name</label><input id="n" className="f" value={f.name} onChange={e=>setF({...f,name:e.target.value})}/></div>
          <div className="field"><label className="fl" htmlFor="e">Email</label><input id="e" type="email" className="f" value={f.email} onChange={e=>setF({...f,email:e.target.value})}/></div>
          <div className="field"><label className="fl" htmlFor="t">Topic</label><select id="t" className="f" value={f.topic} onChange={e=>setF({...f,topic:e.target.value})}><option>Product demo</option><option>Pricing</option><option>Technical support</option><option>Partnership</option></select></div>
          <div className="field"><label className="fl" htmlFor="m">Message</label><textarea id="m" className="f" rows="5" value={f.msg} onChange={e=>setF({...f,msg:e.target.value})}/></div>
          <button className="btn pri" disabled={!ok} onClick={()=>setSent(true)}>Send message</button></>}
      </section>
      <section className="panel">
        <h2 className="ph2">Details</h2>
        {[["Email",c.email],["Phone",c.phone],["Address",c.address],["Hours",c.hours]].map(([l,v])=><div key={l} className="rowline"><span className="muted">{l}</span><b style={{textAlign:"right"}}>{v}</b></div>)}
        <p className="small muted" style={{marginTop:14}}>Placeholder details. Edit them in PLACEHOLDER.contact.</p>
      </section>
    </div>
  </>;
}

/* -------------------------------- app -------------------------------- */
const NAV = [
  ["Overview",[["home","Home","home"],["dashboard","Dashboard","dash"],["try","Try It","flask"]]],
  ["Analysis",[["reviews","Reviews","reviews"],["investigation","Investigation","invest"],["action","Action center","action"],["reports","Reports","reports"]]],
  ["Workflow",[["approval","Approvals","approval"]]],
  ["Account",[["settings","Settings","settings"]]],
];
const DEFAULTS = { org:"Your Hospital Group", email:"", theme:"system", threshold:3, autoDraft:true, notifyHigh:true, weekly:false,
  api:API.baseUrl, sources:{ Practo:true, "Google Maps":true, Lybrate:false, Facebook:false } };

function App(){
  const [page,setPage] = useState("home");
  const [googleAuth,setGoogleAuth] = useState({signedIn:false,email:"",name:"",picture:"",businessConnected:false});
  const [reviews,setReviews] = useState([]);
  const [actionPlans,setActionPlans] = useState([]);
  const [sel,setSel] = useState("");
  const [toastMsg,setToastMsg] = useState("");
  const [loading,setLoading] = useState(true);
  const [apiError,setApiError] = useState("");
  const [lastUpdated,setLastUpdated] = useState(null);
  const [pipelineStats,setPipelineStats] = useState({
    reviewsMonitored: 0,
    analysisCases: 0,
    actionPlans: 0,
    averageSeverity: 0,
    failed: 0,
  });
  const [settings,setSettings] = useState(()=>{
    try{
      const s = localStorage.getItem("aegis-settings");
      const merged = s ? {...DEFAULTS,...JSON.parse(s)} : DEFAULTS;
      // Migrate a stale 127.0.0.1 API URL so the session cookie host matches the frontend.
      if (String(merged.api || "").includes("127.0.0.1")) merged.api = API.baseUrl;
      return merged;
    }catch(e){ return DEFAULTS; }
  });

  useEffect(()=>{
    const base = String(settings.api || API.baseUrl).trim().replace(/\/$/, "");
    const params = new URLSearchParams(window.location.search);
    const returnedFromGoogle = params.get("google_auth") === "success";

    // Remove the callback flag from the address bar, but keep this render's
    // returnedFromGoogle value so we can route only after checking the session.
    if (returnedFromGoogle) {
      window.history.replaceState({}, document.title, window.location.pathname);
      setToastMsg("Google sign-in successful");
    }

    fetch(base + "/auth/me", {credentials:"include"})
      .then(r => {
        if (!r.ok) throw new Error("Could not verify sign-in session");
        return r.json();
      })
      .then(data => {
        const user = data?.user || {};
        const auth = {
          signedIn: !!data?.signed_in,
          email: data?.email || user.email || "",
          name: user.name || data?.name || "",
          picture: user.picture || data?.picture || "",
          businessConnected: !!(data?.business_profile_connected || user.business_profile_connected),
        };
        setGoogleAuth(auth);
        // Successful OAuth return always opens the dashboard. Also recover if
        // the session is already valid but the callback flag was lost.
        if (returnedFromGoogle) {
          setPage(auth.signedIn ? "dashboard" : "login");
        } else if (auth.signedIn) {
          setPage(current => current === "login" ? "dashboard" : current);
        }
      })
      .catch(() => {
        if (returnedFromGoogle) setPage("login");
      });
  },[settings.api]);

  // If the session is confirmed while the login view is open, move directly
  // to the dashboard rather than leaving the user on the sign-in screen.
  useEffect(()=>{
    if (googleAuth.signedIn && page === "login") setPage("dashboard");
  },[googleAuth.signedIn, page]);

  useEffect(()=>{
    applyTheme(settings.theme);
    if (settings.theme === "system" && window.matchMedia) {
      const media = window.matchMedia("(prefers-color-scheme: light)");
      const onChange = () => applyTheme("system");
      media.addEventListener?.("change", onChange);
      try{ localStorage.setItem("aegis-settings",JSON.stringify(settings)); }catch(e){}
      return () => media.removeEventListener?.("change", onChange);
    }
    try{ localStorage.setItem("aegis-settings",JSON.stringify(settings)); }catch(e){}
  },[settings]);
  useEffect(()=>{ if(!toastMsg) return; const t = setTimeout(()=>setToastMsg(""),2400); return ()=>clearTimeout(t); },[toastMsg]);
  useEffect(()=>{ window.scrollTo(0,0); },[page]);

  useEffect(()=>{
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
          fetchFirst(base, [API.endpoints.dashboard, "/dashboard/" ]),
          fetchFirst(base, [API.endpoints.reviews, "/review", "/reviews/" ]),
          fetchFirst(base, [API.endpoints.investigations, "/investigations/", "/analysis", "/analysis-cases"]),
          fetchFirst(base, [API.endpoints.actionPlans, "/action_plans", "/action-plans/", "/action_plans/"] ),
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
  const [profileOpen,setProfileOpen] = useState(false);
  const profileRef = React.useRef(null);
  const menuRef = React.useRef(null);
  const [menuPos,setMenuPos] = useState({top:64,right:16});
  const placeMenu = () => {
    const r = profileRef.current?.getBoundingClientRect();
    if(r) setMenuPos({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) });
  };
  useEffect(()=>{
    if(!profileOpen) return;
    placeMenu();
    const onDown = e => {
      if(profileRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
      setProfileOpen(false);
    };
    window.addEventListener("resize", placeMenu);
    window.addEventListener("scroll", placeMenu, true);
    const onKey = e => { if(e.key === "Escape") setProfileOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return ()=>{
      document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", placeMenu); window.removeEventListener("scroll", placeMenu, true);
    };
  },[profileOpen]);

  const logout = async () => {
    const base = String(settings.api || API.baseUrl || "").trim().replace(/\/+$/, "");
    try{ await fetch(base + "/auth/logout", { method:"POST", credentials:"include" }); }catch(e){ console.warn("Logout request failed:", e); }
    setGoogleAuth({signedIn:false,email:"",name:"",picture:"",businessConnected:false});
    setProfileOpen(false);
    setPage("home");
    setToastMsg("Logged out");
  };

  const open = r => { setSel(r.id); setPage("investigation"); };
  const waiting = reviews.filter(r=>r.status==="pending").length;
  const review = reviews.find(r=>r.id===sel);

  const view = {
    home:<Home go={setPage}/>, login:<GoogleLogin apiBaseUrl={settings.api} go={setPage} signedIn={googleAuth.signedIn} email={googleAuth.email}/>, try:<AgentPlayground go={setPage} apiBaseUrl={settings.api}/>, dashboard:<Dashboard reviews={reviews} open={open} go={setPage} pipelineStats={pipelineStats}/>, reviews:<Reviews reviews={reviews} open={open} pipelineStats={pipelineStats}/>,
    investigation:<Investigation review={review} reviews={reviews} setStatus={setStatus} setResponse={setResponse} go={setPage} toast={setToastMsg}/>,
    action:<Action reviews={reviews} open={open} actionPlans={actionPlans} pipelineStats={pipelineStats}/>, approval:<Approval reviews={reviews} setStatus={setStatus} onDelete={deleteRejectedReview} open={open} toast={setToastMsg}/>,
    reports:<Reports reviews={reviews}/>, settings:<Settings settings={settings} setSettings={setSettings} toast={setToastMsg}/>, about:<About go={setPage}/>, contact:<Contact/>,
  }[page];

  return <>
    <style>{THEME_CSS}</style>
    <div className="app">
      <header className={"topbar"+((page==="home"||page==="login"||page==="about"||page==="contact")?" landing-nav":" app-nav")}>
        <button className="brand" onClick={()=>setPage("home")} aria-label="AegisCare home">
          <Mark/><span>AegisCare</span>{page!=="home" && <span className="brand-ai">AI</span>}
        </button>
        {(page==="home" || page==="login" || page==="about" || page==="contact") ? <>
          {(page==="home" || page==="about" || page==="contact") && <nav className="marketing-nav" aria-label="Public navigation">
            <button onClick={()=>setPage("about")}>About</button>
            <button onClick={()=>setPage("contact")}>Contact</button>
          </nav>}
          {page==="home" && <button className="nav-get-started" onClick={()=>setPage("login")}>Explore the platform <span>↗</span></button>}
          {(page==="about" || page==="contact") && <button className="nav-get-started" onClick={()=>setPage("home")}>Back to home <span>↗</span></button>}
        </> : <>
          <nav className="top-nav" aria-label="Main navigation">
            {NAV.flatMap(([group,items])=>items).filter(([k])=>k!=="home" && k!=="settings").map(([k,l,ic])=>
              <button key={k}
                className={"nav"+(page===k?" on":"")}
                aria-current={page===k?"page":undefined}
                onClick={()=>setPage(k)}
                title={l}>
                <Icon n={ic}/><span>{l}</span>
                {k==="approval" && waiting>0 && <span className="count">{waiting}</span>}
              </button>
            )}
          </nav>
          <div ref={profileRef} style={{position:"relative"}}>
            <button
              className="btn profile-button"
              onClick={()=> googleAuth.signedIn ? setProfileOpen(o=>!o) : setPage("login")}
              title={googleAuth.signedIn ? `Signed in${googleAuth.email ? ` as ${googleAuth.email}` : ""}` : "Sign in to your AegisCare account"}
              aria-label="Profile menu"
              aria-haspopup="menu"
              aria-expanded={profileOpen}
              style={{display:"inline-flex",alignItems:"center",justifyContent:"center",gap:8,whiteSpace:"nowrap",padding:"8px 12px",minHeight:40}}
            >
              {googleAuth.picture ? <img src={googleAuth.picture} alt="" referrerPolicy="no-referrer" style={{width:26,height:26,borderRadius:"50%",objectFit:"cover"}} /> : <Icon n="user"/>}
              <span>{googleAuth.signedIn ? (googleAuth.name || "Profile") : "Sign in"}</span>
              {googleAuth.signedIn && <span aria-hidden="true" style={{fontSize:10,opacity:.7}}>{profileOpen ? "▲" : "▼"}</span>}
            </button>
            {profileOpen && googleAuth.signedIn && createPortal(<div ref={menuRef} role="menu" style={{position:"fixed",right:menuPos.right,top:menuPos.top,minWidth:230,background:"var(--surface)",border:"1px solid var(--line)",borderRadius:12,boxShadow:"0 12px 32px rgba(0,0,0,.35)",padding:8,zIndex:100000}}>
              <div style={{padding:"8px 10px 10px",borderBottom:"1px solid var(--line)",marginBottom:6}}>
                <div style={{fontWeight:600,color:"var(--text)"}}>{googleAuth.name || "Signed in"}</div>
              </div>
              <button role="menuitem" className="nav" onClick={()=>{ setPage("settings"); setProfileOpen(false); }} style={{display:"flex",alignItems:"center",gap:10,width:"100%",textAlign:"left",padding:"9px 10px",background:"transparent",border:0,cursor:"pointer",color:"var(--text)"}}>
                <Icon n="settings"/><span>Settings</span>
              </button>
              <button role="menuitem" className="nav" onClick={logout} style={{display:"flex",alignItems:"center",gap:10,width:"100%",textAlign:"left",padding:"9px 10px",background:"transparent",border:0,cursor:"pointer",color:"var(--crit)"}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg><span>Log out</span>
              </button>
            </div>, document.body)}
          </div>
        </>}
      </header>
      <main className={"main"+(page==="home"?" landing-main":"")}>
        {apiError && page !== "settings" && page !== "login" && <div className="panel" role="status" style={{marginBottom:16,borderColor:"var(--danger, #bd7777)"}}><b>Backend connection issue</b><p className="small" style={{margin:"6px 0 0"}}>{apiError}. Check Settings → API connection and verify the dashboard, reviews, investigations, and action-plans endpoints.</p><button className="btn" style={{marginTop:10}} onClick={()=>setPage("settings")}>Open API settings</button></div>}
        {view}
      </main>
      {page!=="home" && page!=="login" && page!=="about" && page!=="contact" && <footer className="app-status">
        <span>{settings.org}</span>
        <span>{loading ? "Connecting to backend…" : apiError ? `Backend issue · ${apiError}` : "Live backend connected"}</span>
        {lastUpdated && <span>Updated {lastUpdated.toLocaleTimeString()}</span>}
      </footer>}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </div>
  </>;
}

export default App;
