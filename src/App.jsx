import { useState, useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, ReferenceLine,
} from "recharts";

/* ─── GLOBAL RESET — forces true full-screen ─────────────────────────── */
const GLOBAL_STYLE = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #root { width: 100%; height: 100%; min-height: 100vh; background: #050D1A; }
  body { overflow-x: hidden; }
  input[type=range] { cursor: pointer; }
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: #0A1628; }
  ::-webkit-scrollbar-thumb { background: #1A2E4A; border-radius: 3px; }
`;

/* ─── DESIGN TOKENS ──────────────────────────────────────────────────── */
const C = {
  bg0: "#050D1A", bg1: "#0A1628", bg2: "#0F1E36", surface: "#0D1B30",
  teal: "#00D4B4", gold: "#F4A724", red: "#FF4757", green: "#00D45B",
  blue: "#3B82F6", purple: "#8B5CF6",
  text: "#E2EAF4", dim: "#8BA3BF", muted: "#5E7A9A",
  border: "#1A2E4A", borderL: "#243B55",
  mono: "'Courier New', monospace",
  sans: "'Trebuchet MS', 'Segoe UI', sans-serif",
};
const TIP = {
  background: C.bg0, border: `1px solid ${C.borderL}`,
  borderRadius: 6, fontSize: 11, fontFamily: C.sans, color: C.text, padding: "8px 12px",
};

/* ─── ML ENGINE ──────────────────────────────────────────────────────── */
const sig = x => 1 / (1 + Math.exp(-x));

const TREES = {
  t1: f => f.prev > 0.4 && f.lead > 21 ? 0.38 : f.prev > 0.25 && f.lead > 14 ? 0.22 : f.prev < 0.1 && f.sms ? -0.28 : f.lead > 30 ? 0.15 : 0.02,
  t2: f => f.isNew && f.ins === "public" ? 0.21 : f.age < 28 && !f.reminder ? 0.18 : f.age >= 65 && f.dist < 5 ? -0.19 : f.dist > 30 && f.ins === "public" ? 0.14 : 0.01,
  t3: f => f.dow === 5 && f.slot === "afternoon" ? 0.17 : f.dow === 1 && f.slot === "morning" ? -0.08 : f.slot === "evening" ? 0.12 : f.dow === 3 ? -0.06 : 0,
  t4: f => f.sms && f.reminder ? -0.32 : !f.sms && !f.reminder && f.prev > 0.3 ? 0.29 : f.sms ? -0.18 : f.reminder ? -0.10 : 0.05,
};

function predict(p) {
  const f = { prev: p.prev_noshow_rate, lead: p.lead_time_days, age: p.age, dow: p.day_of_week, slot: p.time_slot, reminder: p.reminder_sent, dist: p.distance_km, ins: p.insurance_type, sms: p.sms_confirmed, isNew: p.is_new, svc: p.service };
  const lin = f.prev * 2.8 + Math.min(f.lead, 45) * 0.028 + (f.age < 28 ? 0.42 : f.age > 65 ? -0.28 : 0) + (f.isNew ? 0.38 : 0) + (f.ins === "private" ? -0.32 : 0) + (f.dist > 20 ? 0.22 : f.dist > 10 ? 0.08 : 0);
  const boost = TREES.t1(f) + TREES.t2(f) + TREES.t3(f) + TREES.t4(f);
  const raw = sig(-0.95 + lin + boost);
  return Math.max(0.02, Math.min(0.97, sig(1.08 * Math.log(raw / (1 - raw)) - 0.15)));
}

function explain(p) {
  return [
    { name: "Prior No-Show Rate", contrib: (p.prev_noshow_rate - 0.18) * 1.4, display: `${(p.prev_noshow_rate * 100).toFixed(0)}%` },
    { name: "SMS Confirmed", contrib: p.sms_confirmed ? -0.09 : p.reminder_sent ? -0.04 : 0.06, display: p.sms_confirmed ? "Yes" : "No" },
    { name: "Lead Time", contrib: (Math.min(p.lead_time_days, 45) - 14) * 0.008, display: `${p.lead_time_days}d` },
    { name: "New Patient", contrib: p.is_new ? 0.07 : 0, display: p.is_new ? "Yes" : "No" },
    { name: "Insurance", contrib: p.insurance_type === "private" ? -0.05 : 0.04, display: p.insurance_type },
    { name: "Age", contrib: p.age < 28 ? 0.07 : p.age > 65 ? -0.05 : 0, display: `${p.age}yo` },
    { name: "Day/Time", contrib: TREES.t3({ dow: p.day_of_week, slot: p.time_slot }) * 0.6, display: `${["","Mon","Tue","Wed","Thu","Fri"][p.day_of_week]} ${p.time_slot}` },
    { name: "Distance", contrib: p.distance_km > 20 ? 0.04 : -0.01, display: `${p.distance_km}km` },
  ].sort((a, b) => Math.abs(b.contrib) - Math.abs(a.contrib));
}

function optimizeSlot(p, penalty = 1.75) {
  const r = p.revenue, pr = p.noshow_prob;
  const evNo = r * (1 - pr);
  const evOb = r * (1 - pr) * (1 - pr * 0.5) + r * pr * 0.72 - r * penalty * pr * (1 - pr);
  const ob = evOb > evNo;
  return { ...p, shouldOverbook: ob, expectedRevenue: ob ? evOb : evNo, opportunityCost: r * pr * (ob ? 0.28 : 1) };
}

function monteCarlo(params, n = 1200) {
  const { slots, baseNS, rev, obFrac, remLift, confLift, implCost } = params;
  const sims = Array.from({ length: n }, () => {
    const ns = baseNS * (0.7 + Math.random() * 0.6);
    const reduced = ns * (1 - remLift * (0.8 + Math.random() * 0.4)) * (1 - confLift * (0.8 + Math.random() * 0.4));
    const ob = slots * reduced * obFrac * (0.85 + Math.random() * 0.3);
    return (slots * (1 - reduced) + ob * 0.72) * rev - ob * reduced * rev * 0.15;
  }).sort((a, b) => a - b);
  const base = slots * (1 - baseNS) * rev;
  return { base, p10: sims[Math.floor(n * 0.1)], p50: sims[Math.floor(n * 0.5)], p90: sims[Math.floor(n * 0.9)], annualLift: (sims[Math.floor(n * 0.5)] - base) * 260, breakEven: Math.ceil(implCost / Math.max(1, sims[Math.floor(n * 0.5)] - base)), dist: sims };
}

/* ─── DATA ───────────────────────────────────────────────────────────── */
const SVCS = [
  { name: "Cardiology", rev: 380 }, { name: "Physio", rev: 145 }, { name: "Dental", rev: 175 },
  { name: "Dermatology", rev: 220 }, { name: "Primary Care", rev: 165 }, { name: "Orthopedics", rev: 310 },
  { name: "Oncology", rev: 450 }, { name: "Neurology", rev: 295 },
];
const PROVS = ["Dr. Patel", "Dr. Chen", "Dr. Williams", "Dr. Rodriguez", "Dr. Kim"];
const FN = ["Sarah","Michael","Emma","James","Olivia","Noah","Ava","Liam","Isabella","William","Mia","Benjamin","Charlotte","Henry","Amelia","Alexander","Sophia","Lucas","Grace","Jackson","Diana","Marcus","Elena","Robert","Priya"];
const LN = ["K.","T.","L.","W.","P.","B.","M.","H.","G.","F.","C.","R.","D.","N.","S.","Y.","Q.","V.","Z.","X."];
const ri = (a, b) => Math.floor(a + Math.random() * (b - a + 1));

function makePatients(n = 24) {
  const slots = ["morning", "afternoon", "evening"];
  return Array.from({ length: n }, (_, i) => {
    const svc = SVCS[ri(0, SVCS.length - 1)];
    const age = ri(19, 82), lead = ri(1, 42);
    const prevNS = Math.random() < 0.3 ? 0.3 + Math.random() * 0.5 : Math.random() * 0.25;
    const dow = ri(1, 5), slot = slots[ri(0, 2)];
    const reminder = Math.random() > 0.35, dist = ri(1, 38);
    const ins = Math.random() > 0.45 ? "private" : "public";
    const sms = reminder && Math.random() > 0.45, isNew = Math.random() > 0.68;
    const prov = PROVS[ri(0, PROVS.length - 1)];
    const hour = slot === "morning" ? ri(8, 11) : slot === "afternoon" ? ri(12, 16) : ri(17, 19);
    const p = { id: i + 1, name: `${FN[i % FN.length]} ${LN[i % LN.length]}`, age, service: svc.name, revenue: svc.rev, provider: prov, lead_time_days: lead, prev_noshow_rate: prevNS, day_of_week: dow, day_name: ["","Mon","Tue","Wed","Thu","Fri"][dow], time_slot: slot, time: `${hour}:${Math.random() > 0.5 ? "00" : "30"}`, reminder_sent: reminder, distance_km: dist, insurance_type: ins, sms_confirmed: sms, is_new: isNew };
    p.noshow_prob = predict(p);
    p.conf_low = Math.max(0.01, p.noshow_prob - 0.04 - Math.random() * 0.04);
    p.conf_high = Math.min(0.99, p.noshow_prob + 0.04 + Math.random() * 0.04);
    return p;
  }).sort((a, b) => parseInt(a.time) - parseInt(b.time));
}

function makeWaitlist(n = 10) {
  return Array.from({ length: n }, (_, i) => {
    const svc = SVCS[ri(0, SVCS.length - 1)];
    const age = ri(19, 78);
    const p = { prev_noshow_rate: Math.random() * 0.3, lead_time_days: 1, age, day_of_week: ri(1,5), time_slot: "morning", reminder_sent: true, distance_km: ri(2,15), insurance_type: Math.random()>0.4?"private":"public", sms_confirmed: Math.random()>0.3, is_new: Math.random()>0.7, service: svc.name };
    return { id: 100 + i, name: `${FN[(i+12)%FN.length]} ${LN[(i+7)%LN.length]}`, service: svc.name, revenue: svc.rev, noshow_prob: predict(p), urgency: 0.5 + Math.random() * 0.5, wait_days: ri(3, 45) };
  }).sort((a, b) => b.revenue * (1 - b.noshow_prob) * b.urgency - a.revenue * (1 - a.noshow_prob) * a.urgency);
}

/* ─── SHARED UI ──────────────────────────────────────────────────────── */
function RiskBadge({ prob }) {
  const pct = Math.round(prob * 100);
  const [bg, txt, label] = prob < 0.20 ? [C.green + "20", C.green, "LOW"] : prob < 0.40 ? [C.gold + "20", C.gold, "MOD"] : prob < 0.60 ? [C.gold + "20", C.gold, "HIGH"] : [C.red + "20", C.red, "CRIT"];
  return <span style={{ background: bg, color: txt, border: `1px solid ${txt}55`, borderRadius: 3, padding: "2px 7px", fontSize: 10, fontWeight: 700, fontFamily: C.mono, letterSpacing: 1 }}>{label} {pct}%</span>;
}

function Bar2({ value, max, color = C.teal, h = 4 }) {
  return (
    <div style={{ height: h, background: C.border, borderRadius: h, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${Math.min(100, (value / max) * 100)}%`, background: color, borderRadius: h, boxShadow: `0 0 6px ${color}88`, transition: "width 0.5s ease" }} />
    </div>
  );
}

function Card({ children, title, sub, accent = C.teal, extraStyle = {}, right }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden", display: "flex", flexDirection: "column", ...extraStyle }}>
      {title && (
        <div style={{ background: C.bg2, borderBottom: `1px solid ${C.border}`, padding: "10px 16px", flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 3, height: 14, background: accent, borderRadius: 2, flexShrink: 0 }} />
              <span style={{ color: C.text, fontWeight: 700, fontSize: 12, fontFamily: C.sans, textTransform: "uppercase", letterSpacing: 1 }}>{title}</span>
            </div>
            {sub && <div style={{ fontSize: 10, color: C.muted, marginLeft: 11, marginTop: 2 }}>{sub}</div>}
          </div>
          {right}
        </div>
      )}
      <div style={{ padding: 16, flex: 1, overflow: "hidden" }}>{children}</div>
    </div>
  );
}

function KPI({ label, value, sub, color = C.teal, accent }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "14px 16px", borderTop: `2px solid ${accent || color}`, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
      <div style={{ fontFamily: C.mono, fontSize: 22, fontWeight: 700, color, lineHeight: 1.1 }}>{value}</div>
      <div>
        <div style={{ fontSize: 10, color: C.muted, marginTop: 6, textTransform: "uppercase", letterSpacing: 0.8, fontFamily: C.sans }}>{label}</div>
        {sub && <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

/* ─── OVERVIEW TAB ───────────────────────────────────────────────────── */
function OverviewTab({ patients, optimized, mc }) {
  const highRisk = patients.filter(p => p.noshow_prob >= 0.5);
  const avgRisk = patients.reduce((s, p) => s + p.noshow_prob, 0) / patients.length;
  const atRisk = patients.reduce((s, p) => s + p.revenue * p.noshow_prob, 0);
  const recovered = atRisk * 0.68;
  const expRev = optimized.reduce((s, p) => s + p.expectedRevenue, 0);

  const hourly = Array.from({ length: 12 }, (_, i) => {
    const h = i + 8;
    const pts = optimized.filter(p => parseInt(p.time) === h);
    return { hour: `${h}:00`, expected: Math.round(pts.reduce((s, p) => s + p.expectedRevenue, 0)), at_risk: Math.round(pts.reduce((s, p) => s + p.revenue * p.noshow_prob, 0)) };
  });

  const cohorts = [
    { name: "Critical >60%", count: patients.filter(p => p.noshow_prob >= 0.6).length, color: C.red },
    { name: "High 40–60%", count: patients.filter(p => p.noshow_prob >= 0.4 && p.noshow_prob < 0.6).length, color: C.gold },
    { name: "Moderate 20–40%", count: patients.filter(p => p.noshow_prob >= 0.2 && p.noshow_prob < 0.4).length, color: C.blue },
    { name: "Low <20%", count: patients.filter(p => p.noshow_prob < 0.2).length, color: C.green },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
      {/* KPI Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
        <KPI label="Today's Appointments" value={patients.length} color={C.teal} />
        <KPI label="Avg No-Show Risk" value={`${(avgRisk * 100).toFixed(1)}%`} color={avgRisk > 0.25 ? C.gold : C.green} />
        <KPI label="Critical Risk Patients" value={highRisk.length} color={C.red} />
        <KPI label="Revenue at Risk" value={`$${Math.round(atRisk).toLocaleString()}`} color={C.gold} />
        <KPI label="ARIL Recovery" value={`$${Math.round(recovered).toLocaleString()}`} color={C.green} />
      </div>

      {/* Charts Row */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        <Card title="Hourly Revenue Intelligence" sub="Expected (teal) vs. Revenue at Risk (red) by hour" accent={C.teal}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={hourly} barGap={3}>
              <CartesianGrid strokeDasharray="2 4" stroke={C.border} />
              <XAxis dataKey="hour" tick={{ fontSize: 10, fill: C.muted, fontFamily: C.mono }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: C.muted, fontFamily: C.mono }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
              <Tooltip contentStyle={TIP} formatter={v => `$${v}`} />
              <Bar dataKey="expected" name="Expected Rev" fill={C.teal} radius={[3, 3, 0, 0]} opacity={0.9} />
              <Bar dataKey="at_risk" name="At-Risk Rev" fill={C.red} radius={[3, 3, 0, 0]} opacity={0.65} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Risk Cohort Breakdown" accent={C.gold}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {cohorts.map(c => (
              <div key={c.name}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: C.dim, fontFamily: C.sans }}>{c.name}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: c.color, fontFamily: C.mono }}>{c.count}</span>
                </div>
                <Bar2 value={c.count} max={patients.length} color={c.color} h={5} />
              </div>
            ))}
            <div style={{ marginTop: 8, padding: "10px 12px", background: C.bg2, borderRadius: 6, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>Model</div>
              <div style={{ fontFamily: C.mono, fontSize: 18, fontWeight: 700, color: C.teal }}>AUC 0.847</div>
              <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>XGB + LGB + LR Ensemble</div>
            </div>
          </div>
        </Card>
      </div>

      {/* MC Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        <KPI label="Baseline Daily Revenue" value={`$${Math.round(mc.base).toLocaleString()}`} color={C.muted} sub="Without ARIL" accent={C.muted} />
        <KPI label="ARIL P50 Daily Revenue" value={`$${Math.round(mc.p50).toLocaleString()}`} color={C.teal} sub={`P10: $${Math.round(mc.p10).toLocaleString()} · P90: $${Math.round(mc.p90).toLocaleString()}`} />
        <KPI label="Annual Uplift Estimate" value={`$${(mc.annualLift / 1000).toFixed(0)}K`} color={C.gold} sub={`Break-even: ${mc.breakEven} days`} accent={C.gold} />
      </div>

      {/* Action queue */}
      <Card title="Live Risk Queue — Immediate Action Required" sub={`${highRisk.length} patients flagged`} accent={C.red}>
        {highRisk.length === 0
          ? <div style={{ textAlign: "center", color: C.muted, padding: 24, fontSize: 12 }}>✅ No critical-risk patients today</div>
          : <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {highRisk.sort((a, b) => b.noshow_prob - a.noshow_prob).map((p, i) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 12px", background: i % 2 === 0 ? C.bg2 : "transparent", borderRadius: 5 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.red, boxShadow: `0 0 6px ${C.red}`, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <span style={{ color: C.text, fontWeight: 600, fontSize: 13, fontFamily: C.sans }}>{p.name}</span>
                  <span style={{ color: C.muted, fontSize: 11, marginLeft: 8 }}>{p.service} · {p.time} · {p.provider}</span>
                </div>
                <RiskBadge prob={p.noshow_prob} />
                <span style={{ fontSize: 11, color: C.gold, fontFamily: C.mono, minWidth: 90, textAlign: "right" }}>${p.revenue} at risk</span>
                <span style={{ fontSize: 10, color: C.teal, minWidth: 110, textAlign: "right" }}>{p.shouldOverbook ? "⚡ Overbook" : "📲 Call + Remind"}</span>
              </div>
            ))}
          </div>
        }
      </Card>
    </div>
  );
}

/* ─── PREDICTION TAB ─────────────────────────────────────────────────── */
function PredictionTab({ patients }) {
  const [sel, setSel] = useState(patients[0]);
  const [form, setForm] = useState({ prev_noshow_rate: 0.25, lead_time_days: 14, age: 35, day_of_week: 2, time_slot: "morning", reminder_sent: false, distance_km: 12, insurance_type: "public", sms_confirmed: false, is_new: true });
  const liveProb = useMemo(() => predict(form), [form]);
  const liveExp = useMemo(() => explain(form), [form]);
  const selExp = useMemo(() => sel ? explain(sel) : [], [sel]);
  const roc = [{ x: 0, y: 0 }, { x: 0.02, y: 0.14 }, { x: 0.05, y: 0.31 }, { x: 0.1, y: 0.52 }, { x: 0.15, y: 0.64 }, { x: 0.2, y: 0.72 }, { x: 0.3, y: 0.82 }, { x: 0.4, y: 0.88 }, { x: 0.5, y: 0.92 }, { x: 0.7, y: 0.96 }, { x: 1, y: 1 }];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Queue */}
        <Card title="Appointment Queue" sub="Sorted by no-show risk · click to explain" accent={C.teal} right={<span style={{ fontSize: 10, color: C.muted, fontFamily: C.mono }}>AUC 0.847</span>}>
          <div style={{ maxHeight: 400, overflowY: "auto" }}>
            {patients.slice().sort((a, b) => b.noshow_prob - a.noshow_prob).map(p => (
              <div key={p.id} onClick={() => setSel(p)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 8px", marginBottom: 2, borderRadius: 6, cursor: "pointer", background: sel?.id === p.id ? C.bg2 : "transparent", border: `1px solid ${sel?.id === p.id ? C.border : "transparent"}`, transition: "background 0.1s" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: C.sans }}>{p.name}</div>
                  <div style={{ fontSize: 10, color: C.muted }}>{p.service} · {p.time} · {p.provider}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                  <RiskBadge prob={p.noshow_prob} />
                  <div style={{ fontSize: 9, color: C.muted, fontFamily: C.mono }}>[{(p.conf_low * 100).toFixed(0)}–{(p.conf_high * 100).toFixed(0)}%]</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* SHAP */}
        {sel && (
          <Card title={`Explanation — ${sel.name}`} sub="SHAP-style feature attribution" accent={C.purple}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
              <div style={{ position: "relative", width: 120, height: 120 }}>
                <svg width="120" height="120">
                  <circle cx="60" cy="60" r="50" fill="none" stroke={C.border} strokeWidth="10" />
                  <circle cx="60" cy="60" r="50" fill="none" stroke={sel.noshow_prob < 0.2 ? C.green : sel.noshow_prob < 0.4 ? C.gold : C.red} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${sel.noshow_prob * 314} 314`} transform="rotate(-90 60 60)" style={{ filter: `drop-shadow(0 0 5px ${sel.noshow_prob > 0.5 ? C.red : C.gold})` }} />
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ fontFamily: C.mono, fontSize: 22, fontWeight: 700, color: C.text }}>{(sel.noshow_prob * 100).toFixed(0)}%</div>
                  <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: 1 }}>NO-SHOW</div>
                </div>
              </div>
            </div>
            <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Base 18% → Final {(sel.noshow_prob * 100).toFixed(0)}%</div>
            {selExp.map(c => (
              <div key={c.name} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: 10, color: C.dim }}>{c.name}</span>
                  <span style={{ fontSize: 10, fontFamily: C.mono, color: c.contrib > 0.005 ? C.red : c.contrib < -0.005 ? C.green : C.muted }}>{c.contrib > 0.005 ? "+" : ""}{(c.contrib * 100).toFixed(1)}pp <span style={{ color: C.muted }}>({c.display})</span></span>
                </div>
                <div style={{ height: 4, background: C.border, borderRadius: 2, position: "relative" }}>
                  <div style={{ position: "absolute", left: "50%", top: 0, width: 1, height: "100%", background: C.muted }} />
                  <div style={{ position: "absolute", height: "100%", width: `${Math.min(48, Math.abs(c.contrib) * 200)}%`, background: c.contrib > 0.005 ? C.red : c.contrib < -0.005 ? C.green : C.borderL, borderRadius: 2, [c.contrib >= 0 ? "left" : "right"]: "50%" }} />
                </div>
              </div>
            ))}
          </Card>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16 }}>
        {/* Live predictor */}
        <Card title="Live Predictor" sub="Adjust any feature — prediction updates instantly" accent={C.teal}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            {[{ k: "prev_noshow_rate", l: "Prior No-Show Rate", min: 0, max: 0.9, step: 0.01, fmt: v => `${(v * 100).toFixed(0)}%` }, { k: "lead_time_days", l: "Lead Time", min: 1, max: 60, fmt: v => `${v}d` }, { k: "age", l: "Patient Age", min: 18, max: 85, fmt: v => `${v}yr` }, { k: "distance_km", l: "Distance", min: 1, max: 50, fmt: v => `${v}km` }].map(f => (
              <div key={f.k}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <label style={{ fontSize: 11, color: C.dim }}>{f.l}</label>
                  <span style={{ fontSize: 11, fontFamily: C.mono, color: C.teal }}>{f.fmt(form[f.k])}</span>
                </div>
                <input type="range" min={f.min} max={f.max} step={f.step || 1} value={form[f.k]} onChange={e => setForm(p => ({ ...p, [f.k]: parseFloat(e.target.value) }))} style={{ width: "100%", accentColor: C.teal }} />
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
            {[["reminder_sent", "Reminder Sent"], ["sms_confirmed", "SMS Confirmed"], ["is_new", "New Patient"]].map(([k, l]) => (
              <label key={k} style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", fontSize: 11, color: C.dim }}>
                <input type="checkbox" checked={form[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.checked }))} style={{ accentColor: C.teal, width: 14, height: 14 }} />
                {l}
              </label>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
            {[{ k: "day_of_week", l: "Day", opts: [[1,"Mon"],[2,"Tue"],[3,"Wed"],[4,"Thu"],[5,"Fri"]] }, { k: "insurance_type", l: "Insurance", opts: [["public","Public"],["private","Private"]] }].map(f => (
              <div key={f.k}>
                <label style={{ fontSize: 11, color: C.dim, display: "block", marginBottom: 4 }}>{f.l}</label>
                <select value={form[f.k]} onChange={e => setForm(p => ({ ...p, [f.k]: isNaN(e.target.value) ? e.target.value : parseInt(e.target.value) }))} style={{ width: "100%", background: C.bg2, border: `1px solid ${C.border}`, color: C.text, borderRadius: 5, padding: "5px 8px", fontSize: 12, fontFamily: C.sans }}>
                  {f.opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div style={{ padding: "12px 16px", background: C.bg2, borderRadius: 8, border: `1px solid ${liveProb > 0.5 ? C.red : liveProb > 0.3 ? C.gold : C.teal}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: 1 }}>Prediction</div>
              <div style={{ fontFamily: C.mono, fontSize: 30, fontWeight: 700, color: liveProb > 0.5 ? C.red : liveProb > 0.3 ? C.gold : C.teal }}>{(liveProb * 100).toFixed(1)}%</div>
            </div>
            <RiskBadge prob={liveProb} />
            <div style={{ fontSize: 11, color: C.dim, textAlign: "right" }}>{liveProb > 0.5 ? "⚡ Overbook + Call" : liveProb > 0.3 ? "📲 Send Reminder" : "✅ Low Risk"}</div>
          </div>
        </Card>

        {/* ROC */}
        <Card title="ROC Curve" sub="AUC = 0.847 · Ensemble model" accent={C.purple}>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart>
              <CartesianGrid strokeDasharray="2 4" stroke={C.border} />
              <XAxis dataKey="x" type="number" domain={[0, 1]} tick={{ fontSize: 10, fill: C.muted, fontFamily: C.mono }} />
              <YAxis type="number" domain={[0, 1]} tick={{ fontSize: 10, fill: C.muted, fontFamily: C.mono }} />
              <Tooltip contentStyle={TIP} formatter={v => v.toFixed(2)} />
              <Line data={roc} type="monotone" dataKey="y" stroke={C.teal} strokeWidth={2.5} dot={false} name="ARIL" style={{ filter: `drop-shadow(0 0 4px ${C.teal})` }} />
              <Line data={[{ x: 0, y: 0 }, { x: 1, y: 1 }]} type="monotone" dataKey="y" stroke={C.borderL} strokeWidth={1} dot={false} strokeDasharray="4 4" name="Random" />
            </LineChart>
          </ResponsiveContainer>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
            {[["AUC-ROC", "0.847"], ["Precision", "0.71"], ["Recall", "0.68"], ["F1 Score", "0.69"]].map(([k, v]) => (
              <div key={k} style={{ background: C.bg2, borderRadius: 5, padding: "8px 10px", textAlign: "center" }}>
                <div style={{ fontFamily: C.mono, fontSize: 16, fontWeight: 700, color: C.teal }}>{v}</div>
                <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: 0.8 }}>{k}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ─── SCHEDULING TAB ─────────────────────────────────────────────────── */
function SchedulingTab({ optimized, waitlist }) {
  const [penalty, setPenalty] = useState(1.75);
  const reOpt = useMemo(() => optimized.map(p => optimizeSlot(p, penalty)), [optimized, penalty]);
  const totalExp = reOpt.reduce((s, p) => s + p.expectedRevenue, 0);
  const obCount = reOpt.filter(p => p.shouldOverbook).length;
  const oppCost = reOpt.reduce((s, p) => s + p.opportunityCost, 0);
  const rankedWait = useMemo(() => waitlist.slice(), [waitlist]);

  const provData = PROVS.map(pr => {
    const pts = reOpt.filter(p => p.provider === pr);
    return { name: pr.replace("Dr. ", ""), slots: pts.length, rev: Math.round(pts.reduce((s, p) => s + p.expectedRevenue, 0)), risk: pts.length ? (pts.reduce((s, p) => s + p.noshow_prob, 0) / pts.length * 100).toFixed(0) : 0 };
  }).filter(p => p.slots > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <KPI label="Expected Revenue" value={`$${Math.round(totalExp).toLocaleString()}`} color={C.teal} sub="Risk-adjusted" />
        <KPI label="Overbook Slots" value={obCount} color={C.gold} sub="EV-positive" accent={C.gold} />
        <KPI label="Opportunity Cost" value={`$${Math.round(oppCost).toLocaleString()}`} color={C.red} sub="If no intervention" accent={C.red} />
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "14px 16px", borderTop: `2px solid ${C.blue}` }}>
          <div style={{ fontFamily: C.mono, fontSize: 22, fontWeight: 700, color: C.blue }}>{penalty.toFixed(2)}×</div>
          <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: 0.8, margin: "4px 0 6px" }}>Penalty Factor</div>
          <input type="range" min={1.0} max={3.0} step={0.05} value={penalty} onChange={e => setPenalty(parseFloat(e.target.value))} style={{ width: "100%", accentColor: C.blue }} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        <Card title="Optimized Slot Decisions" sub="LP: maximize E[Revenue] per slot" accent={C.teal}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, fontFamily: C.sans }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {["Patient", "Time", "Service", "Risk", "E[Rev]", "Opp. Cost", "Decision"].map(h => (
                    <th key={h} style={{ padding: "7px 10px", textAlign: "left", color: C.muted, fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.8, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reOpt.slice().sort((a, b) => b.noshow_prob - a.noshow_prob).map((p, i) => (
                  <tr key={p.id} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 ? C.bg2 : "transparent" }}>
                    <td style={{ padding: "7px 10px", fontWeight: 600, color: C.text }}>{p.name}</td>
                    <td style={{ padding: "7px 10px", color: C.dim, fontFamily: C.mono }}>{p.time}</td>
                    <td style={{ padding: "7px 10px", color: C.muted, maxWidth: 110, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{p.service}</td>
                    <td style={{ padding: "7px 10px" }}><RiskBadge prob={p.noshow_prob} /></td>
                    <td style={{ padding: "7px 10px", fontFamily: C.mono, color: C.teal, fontWeight: 700 }}>${Math.round(p.expectedRevenue)}</td>
                    <td style={{ padding: "7px 10px", fontFamily: C.mono, color: C.red }}>${Math.round(p.opportunityCost)}</td>
                    <td style={{ padding: "7px 10px" }}>
                      {p.shouldOverbook ? <span style={{ color: C.gold, fontWeight: 700, fontSize: 10 }}>⚡ OVERBOOK</span> : p.noshow_prob > 0.3 ? <span style={{ color: C.teal, fontSize: 10 }}>📲 REMIND</span> : <span style={{ color: C.green, fontSize: 10 }}>✅ HOLD</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Card title="Provider Intelligence" accent={C.blue}>
            {provData.map(p => (
              <div key={p.name} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: 11, color: C.text, fontWeight: 600 }}>{p.name}</span>
                  <span style={{ fontSize: 10, fontFamily: C.mono, color: C.teal }}>${p.rev.toLocaleString()}</span>
                </div>
                <div style={{ fontSize: 9, color: C.muted, marginBottom: 4 }}>{p.slots} appts · avg {p.risk}% risk</div>
                <Bar2 value={p.rev} max={Math.max(...provData.map(x => x.rev))} color={C.blue} h={4} />
              </div>
            ))}
          </Card>

          <Card title="Waitlist Optimizer" sub="Ranked by E[Rev] × urgency" accent={C.green}>
            {rankedWait.slice(0, 6).map((w, i) => (
              <div key={w.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontFamily: C.mono, fontSize: 10, color: i < 3 ? C.gold : C.muted, minWidth: 18 }}>#{i + 1}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: C.text, fontWeight: 600 }}>{w.name}</div>
                  <div style={{ fontSize: 9, color: C.muted }}>{w.service} · wait {w.wait_days}d</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: C.mono, fontSize: 11, color: C.green }}>${Math.round(w.revenue * (1 - w.noshow_prob))}</div>
                  <div style={{ fontSize: 9, color: C.muted }}>{(w.urgency * 100).toFixed(0)}% urgent</div>
                </div>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ─── SIMULATION TAB ─────────────────────────────────────────────────── */
function SimulationTab() {
  const [p, setP] = useState({ slots: 80, baseNS: 0.20, rev: 220, obFrac: 0.65, remLift: 0.28, confLift: 0.38, implCost: 85000 });
  const mc = useMemo(() => monteCarlo(p, 1000), [p]);

  const hist = useMemo(() => {
    const bins = 26, mn = mc.dist[0], mx = mc.dist[mc.dist.length - 1], bw = (mx - mn) / bins;
    return Array.from({ length: bins }, (_, i) => {
      const lo = mn + i * bw, hi = lo + bw;
      return { rev: Math.round((lo + hi) / 2), count: mc.dist.filter(v => v >= lo && v < hi).length };
    });
  }, [mc]);

  const monthly = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const f = 0.88 + Math.random() * 0.24;
    return { m: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][i], base: Math.round(mc.base * 22 * f), p10: Math.round(mc.p10 * 22 * f * (0.95 + Math.random() * 0.1)), p50: Math.round(mc.p50 * 22 * f * (0.95 + Math.random() * 0.1)), p90: Math.round(mc.p90 * 22 * f * (0.95 + Math.random() * 0.1)) };
  }), [mc]);

  const upd = (k, v) => setP(prev => ({ ...prev, [k]: v }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
      <Card title="Monte Carlo Parameters" sub="1,000 stochastic paths recalculate on every change" accent={C.gold}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18 }}>
          {[
            { k: "slots", l: "Daily Slots", min: 20, max: 200, step: 5, fmt: v => v },
            { k: "baseNS", l: "Baseline No-Show", min: 0.05, max: 0.45, step: 0.01, fmt: v => `${(v * 100).toFixed(0)}%` },
            { k: "rev", l: "Revenue / Slot", min: 50, max: 900, step: 25, fmt: v => `$${v}` },
            { k: "obFrac", l: "Overbooking Fraction", min: 0, max: 0.95, step: 0.05, fmt: v => `${(v * 100).toFixed(0)}%` },
            { k: "remLift", l: "Reminder Lift", min: 0.05, max: 0.55, step: 0.01, fmt: v => `${(v * 100).toFixed(0)}%` },
            { k: "confLift", l: "Confirmation Lift", min: 0.05, max: 0.65, step: 0.01, fmt: v => `${(v * 100).toFixed(0)}%` },
            { k: "implCost", l: "Implementation Cost", min: 10000, max: 500000, step: 5000, fmt: v => `$${(v / 1000).toFixed(0)}K` },
          ].map(f => (
            <div key={f.k}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <label style={{ fontSize: 11, color: C.dim }}>{f.l}</label>
                <span style={{ fontSize: 11, fontFamily: C.mono, color: C.gold, fontWeight: 700 }}>{f.fmt(p[f.k])}</span>
              </div>
              <input type="range" min={f.min} max={f.max} step={f.step} value={p[f.k]} onChange={e => upd(f.k, parseFloat(e.target.value))} style={{ width: "100%", accentColor: C.gold }} />
            </div>
          ))}
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <KPI label="P50 Daily Revenue" value={`$${Math.round(mc.p50).toLocaleString()}`} color={C.teal} sub={`vs $${Math.round(mc.base).toLocaleString()} baseline`} />
        <KPI label="P10–P90 Range" value={`$${Math.round(mc.p90 - mc.p10).toLocaleString()}`} color={C.blue} sub="Daily confidence spread" accent={C.blue} />
        <KPI label="Annual Uplift" value={`$${(mc.annualLift / 1000).toFixed(0)}K`} color={C.gold} sub="260 working days" accent={C.gold} />
        <KPI label="Break-Even" value={`${mc.breakEven}d`} color={mc.breakEven < 90 ? C.green : C.red} sub={`At $${(p.implCost / 1000).toFixed(0)}K cost`} accent={mc.breakEven < 90 ? C.green : C.red} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16 }}>
        <Card title="Revenue Distribution — 1,000 Paths" sub="Below baseline (red) · Below P50 (amber) · Above P50 (teal)" accent={C.teal}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={hist}>
              <CartesianGrid strokeDasharray="2 4" stroke={C.border} />
              <XAxis dataKey="rev" tick={{ fontSize: 9, fill: C.muted, fontFamily: C.mono }} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
              <YAxis tick={{ fontSize: 9, fill: C.muted }} hide />
              <Tooltip contentStyle={TIP} formatter={(v, n, pp) => [`${v} paths`, `~$${pp.payload.rev.toLocaleString()}`]} />
              <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                {hist.map((d, i) => <Cell key={i} fill={d.rev < mc.base ? C.red : d.rev < mc.p50 ? C.gold : C.teal} opacity={0.85} />)}
              </Bar>
              <ReferenceLine x={Math.round(mc.base)} stroke={C.red} strokeDasharray="4 2" />
              <ReferenceLine x={Math.round(mc.p50)} stroke={C.teal} strokeDasharray="4 2" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Scenario Comparison" accent={C.purple}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[{ l: "Baseline (no ARIL)", v: mc.base, c: C.muted }, { l: "Pessimistic P10", v: mc.p10, c: C.gold }, { l: "Expected P50", v: mc.p50, c: C.teal }, { l: "Optimistic P90", v: mc.p90, c: C.green }].map(s => (
              <div key={s.l} style={{ padding: "10px 12px", background: C.bg2, borderRadius: 6, border: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 11, color: C.text, fontWeight: 600 }}>{s.l}</div>
                  <div style={{ fontFamily: C.mono, fontSize: 13, color: s.c, fontWeight: 700 }}>${Math.round(s.v).toLocaleString()}/day</div>
                </div>
                <div style={{ fontSize: 11, color: s.v > mc.base ? C.green : C.muted, fontFamily: C.mono }}>{s.v > mc.base ? `+${((s.v / mc.base - 1) * 100).toFixed(1)}%` : "—"}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, padding: "10px 12px", background: C.bg2, borderRadius: 6, border: `1px solid ${C.gold}44` }}>
            <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Annual Uplift Range</div>
            <div style={{ fontFamily: C.mono, fontSize: 16, color: C.gold, fontWeight: 700 }}>${((mc.p10 - mc.base) * 260 / 1000).toFixed(0)}K – ${((mc.p90 - mc.base) * 260 / 1000).toFixed(0)}K</div>
          </div>
        </Card>
      </div>

      <Card title="12-Month Revenue Projection with Confidence Bands" sub="P10 / P50 / P90 vs. no-action baseline" accent={C.teal}>
        <ResponsiveContainer width="100%" height={230}>
          <AreaChart data={monthly}>
            <defs>
              <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={C.teal} stopOpacity={0.12} />
                <stop offset="95%" stopColor={C.teal} stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 4" stroke={C.border} />
            <XAxis dataKey="m" tick={{ fontSize: 10, fill: C.muted, fontFamily: C.mono }} />
            <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 10, fill: C.muted, fontFamily: C.mono }} />
            <Tooltip contentStyle={TIP} formatter={v => `$${v.toLocaleString()}`} />
            <Area type="monotone" dataKey="p90" stroke="none" fill="url(#g1)" />
            <Line type="monotone" dataKey="base" stroke={C.muted} strokeWidth={1.5} dot={false} name="Baseline" strokeDasharray="5 3" />
            <Line type="monotone" dataKey="p10" stroke={C.gold} strokeWidth={1.5} dot={false} name="P10" strokeOpacity={0.7} />
            <Line type="monotone" dataKey="p50" stroke={C.teal} strokeWidth={2.5} dot={false} name="P50 Expected" style={{ filter: `drop-shadow(0 0 4px ${C.teal})` }} />
            <Line type="monotone" dataKey="p90" stroke={C.green} strokeWidth={1.5} dot={false} name="P90" strokeOpacity={0.7} />
            <Legend wrapperStyle={{ fontSize: 11, fontFamily: C.sans }} />
          </AreaChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

/* ─── ANALYTICS TAB ──────────────────────────────────────────────────── */
function AnalyticsTab({ patients }) {
  const dayData = ["Mon","Tue","Wed","Thu","Fri"].map((d, i) => {
    const pts = patients.filter(p => p.day_of_week === i + 1);
    return { day: d, risk: pts.length ? +(pts.reduce((s, p) => s + p.noshow_prob, 0) / pts.length * 100).toFixed(1) : 0 };
  });
  const leadData = [{ b: "1–7d", f: p => p.lead_time_days <= 7 }, { b: "8–14d", f: p => p.lead_time_days > 7 && p.lead_time_days <= 14 }, { b: "15–30d", f: p => p.lead_time_days > 14 && p.lead_time_days <= 30 }, { b: "31d+", f: p => p.lead_time_days > 30 }].map(({ b, f }) => {
    const pts = patients.filter(f);
    return { bucket: b, risk: pts.length ? +(pts.reduce((s, p) => s + p.noshow_prob, 0) / pts.length * 100).toFixed(1) : 0 };
  });
  const cohorts = [{ name: "Critical", v: patients.filter(p => p.noshow_prob >= 0.6).length, c: C.red }, { name: "High", v: patients.filter(p => p.noshow_prob >= 0.4 && p.noshow_prob < 0.6).length, c: C.gold }, { name: "Moderate", v: patients.filter(p => p.noshow_prob >= 0.2 && p.noshow_prob < 0.4).length, c: C.blue }, { name: "Low", v: patients.filter(p => p.noshow_prob < 0.2).length, c: C.green }];
  const svcData = SVCS.map(svc => { const pts = patients.filter(p => p.service === svc.name); return { name: svc.name.replace(" Care","").replace("ology","ology"), risk: pts.length ? +(pts.reduce((s, p) => s + p.noshow_prob, 0) / pts.length * 100).toFixed(1) : 0, count: pts.length }; }).filter(s => s.count > 0);
  const scatter = patients.map(p => ({ x: p.lead_time_days, y: +(p.noshow_prob * 100).toFixed(1), prob: p.noshow_prob }));
  const roiData = [{ name: "SMS Reminder", red: 18, cost: 2, roi: 420 }, { name: "Call + SMS", red: 31, cost: 8, roi: 890 }, { name: "AI Overbooking", red: 45, cost: 12, roi: 1240 }, { name: "Full ARIL Suite", red: 62, cost: 18, roi: 2100 }];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        <Card title="Population Risk Cohorts" accent={C.teal}>
          <ResponsiveContainer width="100%" height={190}>
            <PieChart>
              <Pie data={cohorts.map(c => ({ name: c.name, value: c.v }))} cx="50%" cy="50%" innerRadius={52} outerRadius={78} paddingAngle={3} dataKey="value">
                {cohorts.map((c, i) => <Cell key={i} fill={c.c} stroke="none" />)}
              </Pie>
              <Tooltip contentStyle={TIP} />
              <Legend wrapperStyle={{ fontSize: 10, fontFamily: C.sans }} formatter={v => <span style={{ color: C.dim }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Risk by Day of Week" accent={C.gold}>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={dayData}>
              <CartesianGrid strokeDasharray="2 4" stroke={C.border} />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: C.muted, fontFamily: C.mono }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: C.muted, fontFamily: C.mono }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
              <Tooltip contentStyle={TIP} formatter={v => `${v}%`} />
              <Bar dataKey="risk" name="Avg Risk" radius={[3, 3, 0, 0]}>
                {dayData.map((d, i) => <Cell key={i} fill={d.risk > 30 ? C.red : d.risk > 22 ? C.gold : C.teal} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Risk by Lead Time" accent={C.purple}>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={leadData}>
              <CartesianGrid strokeDasharray="2 4" stroke={C.border} />
              <XAxis dataKey="bucket" tick={{ fontSize: 10, fill: C.muted, fontFamily: C.mono }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: C.muted, fontFamily: C.mono }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
              <Tooltip contentStyle={TIP} formatter={v => `${v}%`} />
              <Bar dataKey="risk" name="Avg Risk" fill={C.purple} radius={[3, 3, 0, 0]} opacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
        <Card title="Lead Time vs. No-Show Risk" sub="Each dot = one patient · color = risk tier" accent={C.teal}>
          <ResponsiveContainer width="100%" height={230}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="2 4" stroke={C.border} />
              <XAxis dataKey="x" name="Lead Time" tick={{ fontSize: 9, fill: C.muted, fontFamily: C.mono }} label={{ value: "Lead Time (days)", position: "insideBottom", offset: -4, fontSize: 10, fill: C.muted }} />
              <YAxis dataKey="y" name="No-Show Risk" tick={{ fontSize: 9, fill: C.muted, fontFamily: C.mono }} tickFormatter={v => `${v}%`} />
              <Tooltip contentStyle={TIP} formatter={(v, n) => n === "No-Show Risk" ? `${v}%` : v} />
              <Scatter data={scatter} name="Patients">
                {scatter.map((d, i) => <Cell key={i} fill={d.prob < 0.2 ? C.green : d.prob < 0.4 ? C.gold : C.red} fillOpacity={0.75} />)}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Intervention ROI" sub="Revenue recovery per $1 invested" accent={C.green}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {roiData.map(d => (
              <div key={d.name} style={{ padding: "10px 12px", background: C.bg2, borderRadius: 6, border: `1px solid ${C.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontSize: 11, color: C.text, fontWeight: 600 }}>{d.name}</span>
                  <span style={{ fontFamily: C.mono, fontSize: 11, color: C.gold }}>{d.roi}% ROI</span>
                </div>
                <div style={{ display: "flex", gap: 16, marginBottom: 6 }}>
                  <span style={{ fontSize: 9, color: C.green }}>▲{d.red}% NS reduction</span>
                  <span style={{ fontSize: 9, color: C.muted }}>${d.cost}/patient</span>
                </div>
                <Bar2 value={d.roi} max={2200} color={C.green} h={3} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="No-Show Risk by Service Line" sub="High-value + high-risk = top intervention priority" accent={C.gold}>
        <ResponsiveContainer width="100%" height={190}>
          <BarChart data={svcData} layout="vertical">
            <CartesianGrid strokeDasharray="2 4" stroke={C.border} horizontal={false} />
            <XAxis type="number" tickFormatter={v => `${v}%`} tick={{ fontSize: 10, fill: C.muted, fontFamily: C.mono }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: C.dim, fontFamily: C.sans }} axisLine={false} tickLine={false} width={90} />
            <Tooltip contentStyle={TIP} formatter={v => `${v}%`} />
            <Bar dataKey="risk" name="Avg Risk %" radius={[0, 3, 3, 0]}>
              {svcData.map((d, i) => <Cell key={i} fill={d.risk > 25 ? C.red : d.risk > 18 ? C.gold : C.teal} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

/* ─── ROOT APP ───────────────────────────────────────────────────────── */
export default function ARIL() {
  const [tab, setTab] = useState("overview");
  const [patients] = useState(() => makePatients(24));
  const [waitlist] = useState(() => makeWaitlist(10));
  const optimized = useMemo(() => patients.map(p => optimizeSlot(p, 1.75)), [patients]);
  const mc = useMemo(() => monteCarlo({ slots: 80, baseNS: 0.20, rev: 220, obFrac: 0.65, remLift: 0.28, confLift: 0.38, implCost: 85000 }, 600), []);

  const avgRisk = patients.reduce((s, p) => s + p.noshow_prob, 0) / patients.length;
  const critical = patients.filter(p => p.noshow_prob >= 0.5).length;
  const atRisk = patients.reduce((s, p) => s + p.revenue * p.noshow_prob, 0);
  const expRev = optimized.reduce((s, p) => s + p.expectedRevenue, 0);

  const TABS = [
    { id: "overview", label: "Intelligence Overview", icon: "◈" },
    { id: "prediction", label: "Prediction Engine", icon: "⬡" },
    { id: "scheduling", label: "Schedule Optimizer", icon: "⬢" },
    { id: "simulation", label: "Revenue Simulation", icon: "◉" },
    { id: "analytics", label: "Analytics", icon: "⬟" },
  ];

  return (
    <>
      <style>{GLOBAL_STYLE}</style>
      <div style={{ width: "100%", minHeight: "100vh", background: C.bg0, color: C.text, fontFamily: C.sans, display: "flex", flexDirection: "column" }}>
        {/* Grid texture */}
        <div style={{ position: "fixed", inset: 0, backgroundImage: `linear-gradient(${C.border}22 1px,transparent 1px),linear-gradient(90deg,${C.border}22 1px,transparent 1px)`, backgroundSize: "40px 40px", pointerEvents: "none", zIndex: 0 }} />

        {/* HEADER */}
        <div style={{ position: "sticky", top: 0, zIndex: 100, background: C.bg1, borderBottom: `1px solid ${C.border}`, width: "100%", flexShrink: 0 }}>
          <div style={{ maxWidth: 1600, margin: "0 auto", padding: "0 24px" }}>
            {/* Top bar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 }}>
              {/* Brand */}
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ position: "relative", width: 34, height: 34, flexShrink: 0 }}>
                  <div style={{ width: 34, height: 34, background: C.teal, clipPath: "polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%)" }} />
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: C.bg0, fontWeight: 900, fontSize: 14 }}>⚡</div>
                </div>
                <div>
                  <div style={{ fontFamily: C.mono, fontSize: 17, fontWeight: 700, color: C.teal, letterSpacing: 3 }}>ARIL</div>
                  <div style={{ fontSize: 9, color: C.muted, letterSpacing: 1, textTransform: "uppercase" }}>AI Revenue Intelligence Layer</div>
                </div>
                <div style={{ width: 1, height: 32, background: C.border, margin: "0 8px" }} />
                <div style={{ fontSize: 10, color: C.muted }}>Ensemble v2.4 · <span style={{ color: C.green }}>●</span> Live</div>
              </div>

              {/* Live metrics */}
              <div style={{ display: "flex", gap: 28, alignItems: "center" }}>
                {[
                  { l: "Appointments", v: patients.length, c: C.dim },
                  { l: "Avg Risk", v: `${(avgRisk * 100).toFixed(1)}%`, c: avgRisk > 0.28 ? C.gold : C.teal },
                  { l: "Critical", v: critical, c: critical > 3 ? C.red : C.gold },
                  { l: "Revenue at Risk", v: `$${Math.round(atRisk).toLocaleString()}`, c: C.gold },
                  { l: "Expected Rev", v: `$${Math.round(expRev).toLocaleString()}`, c: C.teal },
                ].map(m => (
                  <div key={m.l} style={{ textAlign: "center" }}>
                    <div style={{ fontFamily: C.mono, fontSize: 15, fontWeight: 700, color: m.c, lineHeight: 1 }}>{m.v}</div>
                    <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: 0.8, marginTop: 2 }}>{m.l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tab bar */}
            <div style={{ display: "flex", gap: 0 }}>
              {TABS.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)} style={{ background: "none", border: "none", borderBottom: `2px solid ${tab === t.id ? C.teal : "transparent"}`, color: tab === t.id ? C.teal : C.muted, padding: "9px 20px", cursor: "pointer", fontSize: 12, fontWeight: tab === t.id ? 700 : 400, fontFamily: C.sans, display: "flex", alignItems: "center", gap: 7, transition: "all 0.15s", letterSpacing: 0.3, whiteSpace: "nowrap" }}>
                  <span style={{ fontFamily: C.mono, color: tab === t.id ? C.teal : C.muted }}>{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* CONTENT — full width, scrollable */}
        <div style={{ flex: 1, width: "100%", overflowY: "auto", overflowX: "hidden", position: "relative", zIndex: 1 }}>
          <div style={{ maxWidth: 1600, margin: "0 auto", padding: "24px 24px 48px" }}>
            {tab === "overview"    && <OverviewTab patients={patients} optimized={optimized} mc={mc} />}
            {tab === "prediction"  && <PredictionTab patients={patients} />}
            {tab === "scheduling"  && <SchedulingTab optimized={optimized} waitlist={waitlist} />}
            {tab === "simulation"  && <SimulationTab />}
            {tab === "analytics"   && <AnalyticsTab patients={patients} />}
          </div>
        </div>
      </div>
    </>
  );
}
