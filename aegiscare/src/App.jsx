import React, { useState, useMemo, useEffect } from "react";



/* =====================================================================

   PLACEHOLDERS: swap these for real API calls.

   Dashboard numbers are computed from the review data below, so

   nothing is typed into the components by hand.

   ===================================================================== */

const API = {

  baseUrl: "http://127.0.0.1:8000/api", // TODO: your backend

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

const SAMPLE_TREND = [9, 12, 8, 14, 11, 7, 6];

const TREND_LABELS = ["6w ago", "5w", "4w", "3w", "2w", "Last wk", "This wk"];



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




function formatCategory(category) {
  if (!category) return "Service Quality";
  const names = {
    wait_time: "Wait Time",
    staff_behavior: "Staff Behavior",
    doctor_communication: "Doctor Communication",
    treatment_outcome: "Treatment Outcome",
    billing_cost: "Billing",
    cleanliness_facility: "Cleanliness",
    appointment_process: "Appointment Process",
    service_quality: "Service Quality",
    other: "Other",
  };
  return names[category] || category;
}

function normalizeReviews(rows, actionPlans = []) {
  const plans = new Map(actionPlans.map(p => [p.review_id, p]));

  return rows.map(r => {
    const plan = plans.get(r.review_id);
    const status = plan ? "pending" : (r.route === "archive" ? "archived" : "pending");

    return {
      id: `AC-${String(r.review_id).padStart(3, "0")}`,
      reviewId: r.review_id,
      doctor: r.doctor_name || "Unknown Doctor",
      specialty: r.specialty || "Unknown",
      clinic: r.clinic___hospital || "Unknown",
      source: "Google Reviews",
      date: r.time_of_review ? new Date(r.time_of_review).toLocaleDateString() : "Unknown",
      timeOfReview: r.time_of_review || null,
      sentiment: r.sentiment ? r.sentiment.charAt(0).toUpperCase() + r.sentiment.slice(1) : "Unknown",
      severity: Number(r.severity || 1),
      category: formatCategory(r.category),
      route: r.route === "investigation" ? "Investigation" : "Archive",
      text: r.review_text || "",
      summary: r.summary || "",
      rootCause: r.root_cause || "Analysis pending",
      evidence: r.evidence || "Analysis pending",
      department: r.department || "Pending",
      lead: r.lead || "Pending",
      confidence: r.confidence != null ? Number(r.confidence) : 0,
      metrics: r.metrics || "",
      response: "No public reply generated yet.",
      actions: plan
        ? [plan.immediate_actions, plan.corrective_actions, plan.preventive_actions].filter(Boolean)
        : [],
      actionPlan: plan || null,
      status,
    };
  });
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

  check: <path d="M5 12l4 4 10-10" />,

};

const Icon = ({ n, size = 18 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[n]}</svg>;

const Mark = () => <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 2.5l8 3v6.2c0 4.8-3.3 8.2-8 9.8-4.7-1.6-8-5-8-9.8V5.5z" /><path d="M12 8v6M9 11h6" /></svg>;



const sevTone = s => s >= 4 ? "crit" : s === 3 ? "warn" : "ok";

const Sev = ({ v }) => <span className={"sev " + sevTone(v)} title={\`Severity ${v} of 5\`}><span className="sev-bars">{[1, 2, 3, 4, 5].map(i => <i key={i} className={i <= v ? "on" : ""} />)}</span><b>{v}</b></span>;

const STATUS = { pending: "Awaiting approval", approved: "Approved", rejected: "Rejected", archived: "Archived" };

const Status = ({ s }) => <span className={"chip " + s}>{STATUS[s]}</span>;

const CatDot = ({ c }) => <span className="catl"><i style={{ background: CAT[c] }} />{c}</span>;

const PageHead = ({ title, sub, children }) => <header className="phead"><div><h1>{title}</h1>{sub && <p>{sub}</p>}</div>{children && <div className="row">{children}</div>}</header>;



/* ------------------------------- home -------------------------------- */

function Home({ go }) {

  const [txt, setTxt] = useState("The doctor was great, but I waited two hours and nobody told us why.");

  const [res, setRes] = useState(null);

  return <>

    <section className="home-hero">

      <div>

        <h1>Every patient review, traced to its cause.</h1>

        <p className="lead">AegisCare sorts incoming reviews, finds what is behind each complaint, and drafts the reply and the fix. Nothing is published until a person approves it.</p>

        <div className="row">

          <button className="btn pri lg" onClick={() => go("dashboard")}>Open dashboard</button>

          <button className="btn lg" onClick={() => go("contact")}>Request a demo</button>

        </div>

      </div>

      <div className="panel">

        <h2 className="ph2">Try the triage agent</h2>

        <div className="field">

          <label className="fl" htmlFor="demo">Patient review</label>

          <textarea id="demo" className="f" value={txt} onChange={e => setTxt(e.target.value)} />

        </div>

        <div className="row" style={{ marginBottom: res ? 18 : 0 }}>

          <button className="btn pri" onClick={() => setRes(demoTriage(txt))}>Classify review</button>

          <span className="small muted">Dashboard data is live; this demo box is for quick local testing.</span>

        </div>

        {res && <dl className="facts" style={{ marginBottom: 0 }}>

          <div><dt>Sentiment</dt><dd>{res.sentiment}</dd></div>

          <div><dt>Category</dt><dd><CatDot c={res.category} /></dd></div>

          <div><dt>Severity</dt><dd><Sev v={res.severity} /></dd></div>

          <div><dt>Next step</dt><dd>{res.route}</dd></div>

        </dl>}

      </div>

    </section>



    <section className="three">

      {[["Triage", "Reads each review, rates sentiment and severity, and decides whether it needs investigation or can be archived."],

      ["Investigation", "Links the complaint to a likely root cause, the evidence behind it, and the department and lead who own it."],

      ["Action plan", "Drafts a public reply and a short list of fixes for the responsible lead to review."]].map(([t, d], i) =>

        <div key={t}><span className="n">Step {i + 1}</span><h3>{t}</h3><p>{d}</p></div>)}

    </section>



    <section className="panel band">

      <div>

        <h2 className="ph2">A person signs off every reply</h2>

        <p className="muted">The agents prepare. Your team decides. Replies and action plans wait in an approval queue where they can be edited, approved or rejected.</p>

      </div>

      <ul>

        <li>Replies avoid naming treatments or confirming a patient's identity.</li>

        <li>Each root cause shows its evidence and a confidence level.</li>

        <li>Every decision is recorded with who made it and when.</li>

      </ul>

    </section>

    <p className="foot">Live results are loaded from the AegisCare PostgreSQL pipeline.</p>

  </>;

}



/* ----------------------------- dashboard ----------------------------- */

function getWeeklyNegativeTrend(reviews) {
  const now = new Date();
  const buckets = Array(7).fill(0);

  reviews.forEach(r => {
    if (r.sentiment !== "Negative" || !r.timeOfReview) return;

    const d = new Date(r.timeOfReview);
    if (Number.isNaN(d.getTime())) return;

    const daysAgo = Math.floor((now - d) / (1000 * 60 * 60 * 24));
    const weekAgo = Math.floor(daysAgo / 7);

    if (weekAgo >= 0 && weekAgo < 7) {
      buckets[6 - weekAgo] += 1;
    }
  });

  return buckets;
}

function Trend({ data }) {

  const W = 640, H = 210, L = 34, B = 28, T = 10, R = 12;

  const top = Math.max(5, Math.ceil(Math.max(...data) / 5) * 5);

  const x = i => L + i * (W - L - R) / (data.length - 1);

  const y = v => H - B - (v / top) * (H - B - T);

  const d = data.map((v, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1)).join(" ");

  return <svg viewBox={\`0 0 ${W} ${H}\`} width="100%" role="img" aria-label="Negative reviews per week">

    {[0, top / 2, top].map(t => <g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--line)" /><text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize="11.5" fill="var(--muted)">{t}</text></g>)}

    <path d={d} fill="none" stroke="var(--brand)" strokeWidth="2.2" strokeLinejoin="round" />

    {data.map((v, i) => <g key={i}><circle cx={x(i)} cy={y(v)} r="3.5" fill="var(--surface)" stroke="var(--brand)" strokeWidth="2" />

      <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="11.5" fill="var(--muted)">{TREND_LABELS[i]}</text></g>)}

  </svg>;

}



function Dashboard({ reviews, open, go }) {

  const inv = reviews.filter(r => r.route === "Investigation");

  const neg = reviews.filter(r => r.sentiment === "Negative");

  const avg = inv.length ? (inv.reduce((a, r) => a + r.severity, 0) / inv.length).toFixed(1) : "–";

  const total = reviews.length;
  const trend = getWeeklyNegativeTrend(reviews);

  const drivers = useMemo(() => {

    const m = {}; neg.forEach(r => m[r.category] = (m[r.category] || 0) + 1);

    return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ k, v, pct: Math.round(v / (neg.length || 1) * 100) }));

  }, [reviews]);

  const queue = reviews.filter(r => r.status === "pending").sort((a, b) => b.severity - a.severity).slice(0, 5);

  const sentiments = [["Negative", "var(--crit)"], ["Positive", "var(--ok)"], ["Neutral", "var(--muted)"]]

    .map(([k, c]) => ({ k, c, n: reviews.filter(r => r.sentiment === k).length }));

  const kpis = [

    ["Reviews monitored", total, "From PostgreSQL"],
    ["Open investigations", inv.length, "Flagged by Agent 1"],

    ["Negative reviews", neg.length, "Classified by Agent 1"],
    ["Average severity", avg, "Investigation cases"],

  ];

  return <>

    <PageHead title="Dashboard" sub="What patients are saying and what needs a decision." />

    <div className="panel kpis">

      {kpis.map(([l, v, d]) => <div className="kpi" key={l}><div className="l">{l}</div><div className="v">{v}</div><div className="d">{d}</div></div>)}

    </div>



    <div className="cols" style={{ marginTop: 20 }}>

      <div>

        <section className="panel">

          <h2 className="ph2">Needs a decision <small>Highest severity first</small></h2>

          <div className="scroll-x"><table>

            <thead><tr><th>Doctor</th><th>Issue</th><th>Severity</th><th>Source</th></tr></thead>

            <tbody>{queue.map(r => <tr key={r.id}>

              <td><button className="link" onClick={() => open(r)}>{r.doctor}</button><div className="small muted">{r.clinic}</div></td>

              <td><CatDot c={r.category} /></td><td><Sev v={r.severity} /></td><td className="muted">{r.source}</td></tr>)}

              {queue.length === 0 && <tr><td colSpan="4" className="muted">Nothing is waiting. New cases will appear here.</td></tr>}

            </tbody></table></div>

          <div style={{ marginTop: 14 }}><button className="btn" onClick={() => go("approval")}>Go to approvals</button></div>

        </section>

        <section className="panel">

          <h2 className="ph2">Negative reviews per week <small>Live data</small></h2>

          <Trend data={trend} />

        </section>

      </div>

      <div>

        <section className="panel">

          <h2 className="ph2">What patients complain about</h2>

          {drivers.map((d, i) => <div className="hb" key={d.k}>

            <div className="t"><CatDot c={d.k} /><b>{d.pct}%</b></div>

            <div className="track"><div style={{ width: d.pct + "%", opacity: i === 0 ? 1 : .5 }} /></div></div>)}

        </section>

        <section className="panel">

          <h2 className="ph2">Sentiment</h2>

          <div className="stack" role="img" aria-label="Sentiment split">{sentiments.filter(s => s.n).map(s => <div key={s.k} style={{ flex: s.n, background: s.c }} />)}</div>

          <div className="legend">{sentiments.map(s => <span key={s.k}><i style={{ background: s.c }} />{s.k} {s.n}</span>)}</div>

        </section>

      </div>

    </div>

  </>;

}



/* ------------------------------ reviews ------------------------------ */

function Reviews({ reviews, open }) {

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

        {list.length === 0 && <tr><td colSpan="5" className="muted">No reviews match these filters. Clear a filter to see more.</td></tr>}

      </tbody></table></div></div>

  </>;

}



/* ---------------------------- investigation -------------------------- */

function Investigation({ review, reviews, setStatus, setResponse, go, toast }) {

  if (!review) return <div className="panel">Choose a case from Reviews to begin.</div>;

  const same = reviews.filter(r => r.doctor === review\.doctor);

  const sameCat = same.filter(r => r.category === review\.category);

  const avg = same.length ? (same.reduce((a, r) => a + r.severity, 0) / same.length).toFixed(1) : "–";

  const pct = Math.round(review\.confidence * 100);

  const archived = review\.route === "Archive";

  const stage = i => archived ? (i === 0 ? "done" : "skip") : i < 3 ? "done" : review\.status === "approved" ? "done" : review\.status === "rejected" ? "stop" : "now";

  const steps = ["Triage", "Investigation", "Action plan", "Approval"];

  return <>

    <button className="crumb" onClick={() => go("reviews")}>← Reviews</button>

    <PageHead title={review\.doctor} sub={\`${review\.specialty}, ${review\.clinic}. Case ${review\.id}.\`}><Status s={review\.status} /></PageHead>

    <ol className="pipe" aria-label="Case progress">{steps.map((s, i) => <li key={s} className={stage(i)}><span className="n">{stage(i) === "done" ? <Icon n="check" size={14} /> : i + 1}</span>{s}</li>)}</ol>



    <div className="detail">

      <div>

        <section className="panel">

          <h2 className="ph2">Patient feedback</h2>

          <p className="quote">“{review\.text}”</p>

          <p className="small muted">{review\.source}, {review\.date}</p>

        </section>

        <section className="panel">

          <h2 className="ph2">Triage result</h2>

          <dl className="facts" style={{ margin: 0 }}>

            <div><dt>Sentiment</dt><dd>{review\.sentiment}</dd></div>

            <div><dt>Severity</dt><dd><Sev v={review\.severity} /></dd></div>

            <div><dt>Category</dt><dd><CatDot c={review\.category} /></dd></div>

            <div><dt>Next step</dt><dd>{review\.route}</dd></div>

          </dl>

        </section>

        <section className="panel">

          <h2 className="ph2">Likely root cause</h2>

          <p className="rootcause">{review\.rootCause}</p>

          <div className="lab">Evidence</div><p className="muted">{review\.evidence}</p>

        </section>

        <section className="panel">

          <h2 className="ph2">Reply and actions</h2>

          <div className="field"><label className="fl" htmlFor="reply">Public reply (editable)</label>

            <textarea id="reply" className="f" value={review\.response} onChange={e => setResponse(review\.id, e.target.value)} /></div>

          <div className="lab">Recommended actions</div>

          <ul className="checks">{review\.actions.map(a => <li key={a}><Icon n="check" size={16} /><span>{a}</span></li>)}</ul>

        </section>

      </div>

      <aside>

        <section className="panel">

          <h2 className="ph2">Confidence</h2>

          <div className="big">{pct}%</div>

          <div className="track" style={{ margin: "10px 0 8px" }}><div style={{ width: pct + "%" }} /></div>

          <p className="small muted">Based on the evidence in this and related reviews.</p>

        </section>

        <section className="panel">

          <h2 className="ph2">Ownership</h2>

          <div className="lab">Department</div><div><b>{review\.department}</b></div>

          <div className="lab">Responsible lead</div><div><b>{review\.lead}</b></div>

        </section>

        <section className="panel">

          <h2 className="ph2">Pattern for {review\.doctor.split(" ").slice(0, 2).join(" ")}</h2>

          <div className="rowline"><span>Reviews on file</span><b>{same.length}</b></div>

          <div className="rowline"><span>{review\.category} reviews</span><b>{sameCat.length}</b></div>

          <div className="rowline"><span>Average severity</span><b>{avg}</b></div>

          <div className="rowline"><span>Negative reviews</span><b>{same.filter(r => r.sentiment === "Negative").length}</b></div>

        </section>

      </aside>

    </div>



    <div className="decision">

      <p>{archived ? "This review needs no action." : "Nothing is sent until you decide."}</p>

      <div className="row">

        <button className="btn danger" disabled={archived} onClick={() => { setStatus(review\.id, "rejected"); toast("Rejected. The case is closed."); }}>Reject</button>

        <button className="btn pri" disabled={archived} onClick={() => { setStatus(review\.id, "approved"); toast("Approved. The reply is ready to send."); }}>Approve reply</button>

      </div>

    </div>

  </>;

}



/* ------------------------ action + approvals ------------------------- */

function Action({ reviews, open }) {
  const inv = reviews.filter(r => r.route === "Investigation" && r.actionPlan);

  return <>
    <PageHead
      title="Action center"
      sub="Live action plans generated by Agent 3 from the investigation results."
    />

    {inv.length === 0 && (
      <div className="panel muted">
        No Agent 3 action plans are currently saved. Once an action plan is
        generated and saved to PostgreSQL, it will appear here automatically.
      </div>
    )}

    <div className="grid2">
      {inv.map(r => (
        <section key={r.id} className="panel" style={{ marginTop: 0 }}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
            <div>
              <b>{r.doctor}</b>
              <div className="small muted">{r.id} · {r.specialty}</div>
            </div>
            <Status s={r.status} />
          </div>

          <div style={{ marginBottom: 10 }}>
            <CatDot c={r.category} />
          </div>

          <h3 style={{ marginBottom: 6 }}>
            {r.actionPlan.objective || "Improvement objective"}
          </h3>

          <div className="lab">Immediate actions</div>
          <p className="muted small">{r.actionPlan.immediate_actions}</p>

          <div className="lab">Corrective actions</div>
          <p className="muted small">{r.actionPlan.corrective_actions}</p>

          <div className="lab">Preventive actions</div>
          <p className="muted small">{r.actionPlan.preventive_actions}</p>

          <div className="rowline">
            <span className="muted">Owner</span>
            <b>{r.actionPlan.owner_role}</b>
          </div>

          <div className="rowline">
            <span className="muted">Timeline</span>
            <b>{r.actionPlan.timeline}</b>
          </div>

          <div className="lab">Success metrics</div>
          <p className="muted small">{r.actionPlan.success_metrics}</p>

          <button className="btn" onClick={() => open(r)}>Open case</button>
        </section>
      ))}
    </div>
  </>;
}

function Approval({ reviews, setStatus, open, toast }) {

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



/* ------------------------------ contact ------------------------------ */

function Contact() {

  const [f, setF] = useState({ name: "", email: "", topic: "Product demo", msg: "" }); const [sent, setSent] = useState(false);

  const ok = f.name && /\S+@\S+\\.\S+/.test(f.email) && f.msg;

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



/* -------------------------------- app -------------------------------- */

const NAV = [

  ["Overview", [["home", "Home", "home"], ["dashboard", "Dashboard", "dash"]]],

  ["Analysis", [["reviews", "Reviews", "reviews"], ["investigation", "Investigation", "invest"], ["action", "Action center", "action"], ["reports", "Reports", "reports"]]],

  ["Workflow", [["approval", "Approvals", "approval"]]],

  ["Account", [["settings", "Settings", "settings"], ["contact", "Contact us", "contact"]]],

];

const DEFAULTS = {

  org: "Your Hospital Group", email: "", theme: "system", threshold: 3, autoDraft: true, notifyHigh: true, weekly: false,

  api: API.baseUrl, sources: { Practo: true, "Google Maps": true, Lybrate: false, Facebook: false }

};



function App() {

  const [page, setPage] = useState("home");

  const [reviews, setReviews] = useState([]);

  const [sel, setSel] = useState(null);

  const [toastMsg, setToastMsg] = useState("");

  const [loading, setLoading] = useState(true);

  const [apiError, setApiError] = useState("");

  const [lastUpdated, setLastUpdated] = useState(null);

  const [settings, setSettings] = useState(() => { try { const s = localStorage.getItem("aegis-settings"); return s ? { ...DEFAULTS, ...JSON.parse(s) } : DEFAULTS; } catch (e) { return DEFAULTS; } });



  const loadLiveData = async () => {
    try {
      setApiError("");

      const [reviewsRes, investigationsRes, plansRes] = await Promise.all([
        fetch(`${API.baseUrl}${API.endpoints.reviews}`),
        fetch(`${API.baseUrl}${API.endpoints.investigations}`),
        fetch(`${API.baseUrl}${API.endpoints.actionPlans}`),
      ]);

      if (!reviewsRes.ok) throw new Error("Failed to load reviews");
      if (!investigationsRes.ok) throw new Error("Failed to load investigations");
      if (!plansRes.ok) throw new Error("Failed to load action plans");

      const reviewRows = await reviewsRes.json();
      const investigationRows = await investigationsRes.json();
      const planRows = await plansRes.json();

      const analysisMap = new Map(
        investigationRows.map(row => [row.review_id, row])
      );

      const enrichedRows = reviewRows.map(row => ({
        ...row,
        ...(analysisMap.get(row.review_id) || {}),
      }));

      const normalized = normalizeReviews(enrichedRows, planRows);

      setReviews(normalized);

      setSel(current => {
        if (current && normalized.some(r => r.id === current)) return current;
        return normalized[0]?.id || null;
      });

      setLastUpdated(new Date());
    } catch (error) {
      console.error("AegisCare API error:", error);
      setApiError(error.message || "Unable to connect to AegisCare API");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLiveData();

    const interval = setInterval(loadLiveData, 5000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {

    const el = document.documentElement; settings.theme === "system" ? el.removeAttribute("data-theme") : el.setAttribute("data-theme", settings.theme);

    try { localStorage.setItem("aegis-settings", JSON.stringify(settings)); } catch (e) { }

  }, [settings]);

  useEffect(() => { if (!toastMsg) return; const t = setTimeout(() => setToastMsg(""), 2400); return () => clearTimeout(t); }, [toastMsg]);

  useEffect(() => { window.scrollTo(0, 0); }, [page]);



  const setStatus = (id, s) => setReviews(rs => rs.map(r => r.id === id ? { ...r, status: s } : r));

  const setResponse = (id, t) => setReviews(rs => rs.map(r => r.id === id ? { ...r, response: t } : r));

  const open = r => { setSel(r.id); setPage("investigation"); };

  const waiting = reviews.filter(r => r.status === "pending").length;

  const review = reviews.find(r => r.id === sel);



  const view = {

    home: <Home go={setPage} />, dashboard: <Dashboard reviews={reviews} open={open} go={setPage} />, reviews: <Reviews reviews={reviews} open={open} />,

    investigation: <Investigation review={review} reviews={reviews} setStatus={setStatus} setResponse={setResponse} go={setPage} toast={setToastMsg} />,

    action: <Action reviews={reviews} open={open} />, approval: <Approval reviews={reviews} setStatus={setStatus} open={open} toast={setToastMsg} />,

    reports: <Reports reviews={reviews} />, settings: <Settings settings={settings} setSettings={setSettings} toast={setToastMsg} />, contact: <Contact />,

  }[page];



  return <div className="app">

    <nav className="side" aria-label="Main">

      <button className="brand" onClick={() => setPage("home")}><Mark />AegisCare</button>

      {NAV.map(([g, items]) => <React.Fragment key={g}><div className="grp">{g}</div>

        {items.map(([k, l, ic]) => <button key={k} className={"nav" + (page === k ? " on" : "")} aria-current={page === k ? "page" : undefined} onClick={() => setPage(k)}>

          <Icon n={ic} />{l}{k === "approval" && waiting > 0 && <span className="count">{waiting}</span>}</button>)}

      </React.Fragment>)}

      <div className="sys">
        <b>{settings.org}</b>
        <span>
          {loading
            ? "Connecting to live data..."
            : apiError
              ? "API connection error"
              : "Live database connected"}
        </span>
        {lastUpdated && (
          <small>Updated {lastUpdated.toLocaleTimeString()}</small>
        )}
      </div>

    </nav>

    <main className="main">{view}</main>

    {toastMsg && <div className="toast" role="status">{toastMsg}</div>}

  </div>;

}



export default App;
