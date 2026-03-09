import { useState, useMemo, useEffect, useRef } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, ReferenceLine,
} from "recharts";

/* ─────────────────────────────────────────────────────────────────
   GLOBAL CSS — injected once at root
   Background: rich deep navy-slate (NOT pitch black)
   Cards: slightly lighter with visible borders
   Text: 3-tier contrast system — all WCAG AA compliant
───────────────────────────────────────────────────────────────── */
const G = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');

  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  html,body,#root{
    width:100%;min-height:100vh;
    background:#0B1120;
    overflow-x:hidden;
    font-family:'Space Grotesk',system-ui,sans-serif;
  }

  /* ── Scrollbar ── */
  ::-webkit-scrollbar{width:5px;height:5px}
  ::-webkit-scrollbar-track{background:transparent}
  ::-webkit-scrollbar-thumb{background:#2A3A5C;border-radius:4px}

  /* ── Keyframes ── */
  @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
  @keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}
  @keyframes sweep{0%{transform:translateY(-100%)}100%{transform:translateY(600%)}}
  @keyframes spin-slow{from{transform:rotate(0)}to{transform:rotate(360deg)}}
  @keyframes shimmer-line{0%{opacity:.4}50%{opacity:1}100%{opacity:.4}}

  /* ── Cards ── */
  .aril-card{
    background:#111827;
    border:1px solid #1E2D4A;
    border-radius:14px;
    overflow:hidden;
    transition:border-color .2s;
  }
  .aril-card:hover{border-color:#2E4172}

  .aril-card-header{
    background:linear-gradient(90deg,#131D33,#111827);
    border-bottom:1px solid #1E2D4A;
    padding:13px 18px;
    display:flex;justify-content:space-between;align-items:center;
  }

  /* ── KPI Card ── */
  .kpi{
    background:linear-gradient(145deg,#111827 0%,#131D33 100%);
    border:1px solid #1E2D4A;
    border-radius:14px;
    padding:20px;
    position:relative;
    overflow:hidden;
    transition:all .2s;
  }
  .kpi::after{
    content:'';position:absolute;inset:0;
    background:linear-gradient(135deg,rgba(255,255,255,.012),transparent);
    pointer-events:none;
  }
  .kpi:hover{transform:translateY(-2px);border-color:#2E4172;box-shadow:0 12px 40px rgba(0,0,0,.4)}

  /* ── Tab buttons ── */
  .tab{
    background:none;border:none;
    color:#7A8DB5;
    padding:10px 18px;
    cursor:pointer;font-size:12.5px;font-weight:500;
    font-family:'Space Grotesk',sans-serif;
    display:flex;align-items:center;gap:7px;
    border-bottom:2px solid transparent;
    transition:all .15s;letter-spacing:.2px;
    white-space:nowrap;
  }
  .tab:hover{color:#C5D1E8}
  .tab.on{color:#E8EDFA;border-bottom-color:#5B6AF0;font-weight:600}

  /* ── Range inputs ── */
  input[type=range]{-webkit-appearance:none;width:100%;height:3px;border-radius:2px;background:#1E2D4A;outline:none;cursor:pointer}
  input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:#5B6AF0;cursor:pointer;box-shadow:0 0 0 3px rgba(91,106,240,.2)}
  input[type=checkbox]{accent-color:#5B6AF0;width:13px;height:13px;cursor:pointer}

  select{
    background:#0F1729;border:1px solid #1E2D4A;
    color:#C5D1E8;border-radius:7px;padding:7px 10px;
    font-size:12px;font-family:'Space Grotesk',sans-serif;
    outline:none;cursor:pointer;width:100%;
  }
  select:focus{border-color:#5B6AF0;outline:2px solid rgba(91,106,240,.15)}

  table{width:100%;border-collapse:collapse}
  thead tr{border-bottom:1px solid #1E2D4A}
  tbody tr{border-bottom:1px solid #131D33;transition:background .1s}
  tbody tr:hover{background:rgba(91,106,240,.05)}
  th{padding:9px 14px;text-align:left;font-size:10px;font-weight:600;
     color:#5A6E96;text-transform:uppercase;letter-spacing:.9px;
     font-family:'JetBrains Mono',monospace}
  td{padding:10px 14px;font-size:12.5px;color:#B8C7E0}

  /* ── Sweep line on risk queue ── */
  .sweep{position:absolute;left:0;right:0;height:80px;
    background:linear-gradient(transparent,rgba(91,106,240,.03),transparent);
    animation:sweep 5s linear infinite;pointer-events:none}

  /* ── Badge ── */
  .badge{
    display:inline-flex;align-items:center;gap:5px;
    border-radius:5px;padding:3px 9px;
    font-size:10.5px;font-weight:700;letter-spacing:.7px;
    font-family:'JetBrains Mono',monospace;
  }
`;

/* ─────────────────────────────────────────────────────────────────
   DESIGN TOKENS  — carefully tuned contrast ratios
───────────────────────────────────────────────────────────────── */
const T = {
  /* backgrounds — layered from darkest to lightest */
  bg0: "#0B1120",   /* page bg */
  bg1: "#0F1729",   /* elevated bg */
  bg2: "#111827",   /* card bg */
  bg3: "#131D33",   /* card header */
  bg4: "#172036",   /* subtle hover / inset */

  /* primary accent — electric blue-violet */
  p:   "#5B6AF0",
  pL:  "#818CF8",   /* lighter for text on dark */
  pLL: "#A5B0FF",   /* very light for secondary text */

  /* secondary accent — vibrant teal */
  s:   "#06C8D6",
  sL:  "#34D3E0",

  /* semantic — all bright enough to read on bg2 */
  g:   "#10C97A",   /* green */
  gL:  "#4ADDA0",
  a:   "#F0A500",   /* amber */
  aL:  "#F5BE45",
  r:   "#F0365A",   /* red */
  rL:  "#FF6B87",

  /* ── TEXT — the key fix ── */
  t1:  "#EEF2FF",   /* primary text — near white, slightly cool */
  t2:  "#A8B8D4",   /* secondary — clearly readable */
  t3:  "#6A7FA8",   /* tertiary — labels, captions — no longer invisible */
  t4:  "#3D506E",   /* disabled / decorative only — not used for readable copy */

  /* borders */
  b1:  "#1E2D4A",
  b2:  "#2A3A5C",

  mono: "'JetBrains Mono',monospace",
  sans: "'Space Grotesk',system-ui,sans-serif",
};

const TIP = {
  background:"#0F1729",border:`1px solid ${T.b2}`,
  borderRadius:9,fontSize:11,fontFamily:T.sans,
  color:T.t1,padding:"9px 13px",
  boxShadow:"0 12px 40px rgba(0,0,0,.6)",
};

/* ─────────────────────────────────────────────────────────────────
   ML ENGINE
───────────────────────────────────────────────────────────────── */
const sig = x => 1 / (1 + Math.exp(-x));
const TREES = {
  t1: f => f.prev>0.4&&f.lead>21?0.38:f.prev>0.25&&f.lead>14?0.22:f.prev<0.1&&f.sms?-0.28:f.lead>30?0.15:0.02,
  t2: f => f.isNew&&f.ins==="public"?0.21:f.age<28&&!f.rem?0.18:f.age>=65&&f.dist<5?-0.19:f.dist>30&&f.ins==="public"?0.14:0.01,
  t3: f => f.dow===5&&f.slot==="afternoon"?0.17:f.dow===1&&f.slot==="morning"?-0.08:f.slot==="evening"?0.12:f.dow===3?-0.06:0,
  t4: f => f.sms&&f.rem?-0.32:!f.sms&&!f.rem&&f.prev>0.3?0.29:f.sms?-0.18:f.rem?-0.10:0.05,
};
function predict(p){
  const f={prev:p.prev_noshow_rate,lead:p.lead_time_days,age:p.age,dow:p.day_of_week,slot:p.time_slot,rem:p.reminder_sent,dist:p.distance_km,ins:p.insurance_type,sms:p.sms_confirmed,isNew:p.is_new};
  const lin=f.prev*2.8+Math.min(f.lead,45)*0.028+(f.age<28?0.42:f.age>65?-0.28:0)+(f.isNew?0.38:0)+(f.ins==="private"?-0.32:0)+(f.dist>20?0.22:f.dist>10?0.08:0);
  const boost=TREES.t1(f)+TREES.t2(f)+TREES.t3(f)+TREES.t4(f);
  return Math.max(0.02,Math.min(0.97,sig(1.08*Math.log(Math.max(0.001,sig(-0.95+lin+boost))/(1-Math.min(0.999,sig(-0.95+lin+boost))))-0.15)));
}
function explain(p){
  return [
    {name:"Prior No-Show Rate", contrib:(p.prev_noshow_rate-0.18)*1.4, display:`${(p.prev_noshow_rate*100).toFixed(0)}%`},
    {name:"SMS Confirmed",      contrib:p.sms_confirmed?-0.09:p.reminder_sent?-0.04:0.06, display:p.sms_confirmed?"Yes":"No"},
    {name:"Lead Time",          contrib:(Math.min(p.lead_time_days,45)-14)*0.008, display:`${p.lead_time_days}d`},
    {name:"New Patient",        contrib:p.is_new?0.07:0, display:p.is_new?"Yes":"No"},
    {name:"Insurance",          contrib:p.insurance_type==="private"?-0.05:0.04, display:p.insurance_type},
    {name:"Age Profile",        contrib:p.age<28?0.07:p.age>65?-0.05:0, display:`${p.age}yo`},
    {name:"Day / Time",         contrib:TREES.t3({dow:p.day_of_week,slot:p.time_slot})*0.6, display:`${["","Mon","Tue","Wed","Thu","Fri"][p.day_of_week]} ${p.time_slot}`},
    {name:"Distance",           contrib:p.distance_km>20?0.04:-0.01, display:`${p.distance_km}km`},
  ].sort((a,b)=>Math.abs(b.contrib)-Math.abs(a.contrib));
}
function optSlot(p,pen=1.75){
  const r=p.revenue,pr=p.noshow_prob;
  const evNo=r*(1-pr);
  const evOb=r*(1-pr)*(1-pr*0.5)+r*pr*0.72-r*pen*pr*(1-pr);
  const ob=evOb>evNo;
  return{...p,shouldOverbook:ob,expectedRevenue:ob?evOb:evNo,opportunityCost:r*pr*(ob?0.28:1)};
}
function monteCarlo(params,n=900){
  const{slots,baseNS,rev,obFrac,remLift,confLift,implCost}=params;
  const sims=Array.from({length:n},()=>{
    const ns=baseNS*(0.7+Math.random()*0.6);
    const red=ns*(1-remLift*(0.8+Math.random()*0.4))*(1-confLift*(0.8+Math.random()*0.4));
    const ob=slots*red*obFrac*(0.85+Math.random()*0.3);
    return(slots*(1-red)+ob*0.72)*rev-ob*red*rev*0.15;
  }).sort((a,b)=>a-b);
  const base=slots*(1-baseNS)*rev;
  return{base,p10:sims[Math.floor(n*.1)],p50:sims[Math.floor(n*.5)],p90:sims[Math.floor(n*.9)],
    annualLift:(sims[Math.floor(n*.5)]-base)*260,
    breakEven:Math.ceil(implCost/Math.max(1,sims[Math.floor(n*.5)]-base)),dist:sims};
}

/* ─────────────────────────────────────────────────────────────────
   DATA GENERATION
───────────────────────────────────────────────────────────────── */
const SVCS=[{n:"Cardiology",r:380},{n:"Physio",r:145},{n:"Dental",r:175},{n:"Dermatology",r:220},{n:"Primary Care",r:165},{n:"Orthopedics",r:310},{n:"Oncology",r:450},{n:"Neurology",r:295}];
const PROVS=["Dr. Patel","Dr. Chen","Dr. Williams","Dr. Rodriguez","Dr. Kim"];
const FN=["Sarah","Michael","Emma","James","Olivia","Noah","Ava","Liam","Isabella","William","Mia","Benjamin","Charlotte","Henry","Amelia","Alexander","Sophia","Lucas","Grace","Jackson","Diana","Marcus","Elena","Robert","Priya"];
const LN=["K.","T.","L.","W.","P.","B.","M.","H.","G.","F.","C.","R.","D.","N.","S.","Y.","Q.","V."];
const ri=(a,b)=>Math.floor(a+Math.random()*(b-a+1));

function makePatients(n=24){
  const SL=["morning","afternoon","evening"];
  return Array.from({length:n},(_,i)=>{
    const svc=SVCS[ri(0,SVCS.length-1)];
    const age=ri(19,82),lead=ri(1,42);
    const prevNS=Math.random()<0.3?0.3+Math.random()*0.5:Math.random()*0.25;
    const dow=ri(1,5),slot=SL[ri(0,2)];
    const rem=Math.random()>0.35,dist=ri(1,38);
    const ins=Math.random()>0.45?"private":"public";
    const sms=rem&&Math.random()>0.45,isNew=Math.random()>0.68;
    const prov=PROVS[ri(0,PROVS.length-1)];
    const hour=slot==="morning"?ri(8,11):slot==="afternoon"?ri(12,16):ri(17,19);
    const p={id:i+1,name:`${FN[i%FN.length]} ${LN[i%LN.length]}`,age,
      service:svc.n,revenue:svc.r,provider:prov,
      lead_time_days:lead,prev_noshow_rate:prevNS,
      day_of_week:dow,day_name:["","Mon","Tue","Wed","Thu","Fri"][dow],
      time_slot:slot,time:`${hour}:${Math.random()>0.5?"00":"30"}`,
      reminder_sent:rem,distance_km:dist,insurance_type:ins,
      sms_confirmed:sms,is_new:isNew};
    p.noshow_prob=predict(p);
    p.conf_lo=Math.max(0.01,p.noshow_prob-0.04-Math.random()*0.04);
    p.conf_hi=Math.min(0.99,p.noshow_prob+0.04+Math.random()*0.04);
    return p;
  }).sort((a,b)=>parseInt(a.time)-parseInt(b.time));
}
function makeWaitlist(n=10){
  return Array.from({length:n},(_,i)=>{
    const svc=SVCS[ri(0,SVCS.length-1)];
    const fp={prev_noshow_rate:Math.random()*0.3,lead_time_days:1,age:ri(19,78),day_of_week:ri(1,5),time_slot:"morning",reminder_sent:true,distance_km:ri(2,15),insurance_type:Math.random()>0.4?"private":"public",sms_confirmed:Math.random()>0.3,is_new:Math.random()>0.7};
    return{id:100+i,name:`${FN[(i+12)%FN.length]} ${LN[(i+7)%LN.length]}`,
      service:svc.n,revenue:svc.r,noshow_prob:predict(fp),
      urgency:0.5+Math.random()*0.5,wait_days:ri(3,45)};
  }).sort((a,b)=>b.revenue*(1-b.noshow_prob)*b.urgency-a.revenue*(1-a.noshow_prob)*a.urgency);
}

/* ─────────────────────────────────────────────────────────────────
   SHARED COMPONENTS
───────────────────────────────────────────────────────────────── */

/* Animated number counter */
function Num({val,pre="",suf="",dec=0}){
  const [d,setD]=useState(0);
  const ref=useRef(0);
  useEffect(()=>{
    const tgt=parseFloat(val)||0,start=ref.current,t0=performance.now();
    const tick=now=>{
      const p=Math.min(1,(now-t0)/700),e=1-Math.pow(1-p,3);
      setD(start+e*(tgt-start));
      if(p<1)requestAnimationFrame(tick);else{setD(tgt);ref.current=tgt;}
    };
    requestAnimationFrame(tick);
  },[val]);
  return <span>{pre}{dec>0?d.toFixed(dec):Math.round(d).toLocaleString()}{suf}</span>;
}

/* Risk badge */
function RB({prob,lg}){
  const pct=Math.round(prob*100);
  const[bg,fg,lbl]=prob<.2?[T.g+"22",T.gL,"LOW"]:prob<.4?[T.a+"22",T.aL,"MOD"]:prob<.6?[T.a+"30",T.a,"HIGH"]:[T.r+"22",T.rL,"CRIT"];
  return(
    <span className="badge" style={{background:bg,color:fg,border:`1px solid ${fg}50`,
      fontSize:lg?12:10,padding:lg?"4px 12px":"2px 8px"}}>
      <span style={{width:5,height:5,borderRadius:"50%",background:fg,display:"inline-block",boxShadow:`0 0 6px ${fg}`}}/>
      {lbl} {pct}%
    </span>
  );
}

/* Progress bar */
function Bar({val,max,col=T.p,h=4}){
  return(
    <div style={{height:h,background:T.b1,borderRadius:h,overflow:"hidden"}}>
      <div style={{height:"100%",width:`${Math.min(100,(val/max)*100)}%`,
        background:`linear-gradient(90deg,${col},${col}CC)`,borderRadius:h,
        boxShadow:`0 0 8px ${col}50`,transition:"width .7s cubic-bezier(.4,0,.2,1)"}}/>
    </div>
  );
}

/* Card wrapper */
function Card({children,title,sub,accent=T.p,sx={},right,flat}){
  return(
    <div className="aril-card" style={sx}>
      {title&&(
        <div className="aril-card-header">
          <div>
            <div style={{display:"flex",alignItems:"center",gap:9}}>
              <div style={{width:3,height:16,borderRadius:2,
                background:`linear-gradient(180deg,${accent},${accent}66)`,
                boxShadow:`0 0 10px ${accent}50`}}/>
              <span style={{color:T.t1,fontWeight:600,fontSize:12,
                fontFamily:T.sans,textTransform:"uppercase",letterSpacing:"1px"}}>
                {title}
              </span>
            </div>
            {sub&&<div style={{fontSize:10.5,color:T.t3,marginLeft:12,marginTop:3,fontFamily:T.sans}}>{sub}</div>}
          </div>
          {right}
        </div>
      )}
      <div style={flat?{}:{padding:18}}>{children}</div>
    </div>
  );
}

/* KPI tile */
function KPI({label,val,sub,col=T.p,icon,delta}){
  return(
    <div className="kpi" style={{borderTop:`2px solid ${col}`}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
        <span style={{fontSize:20}}>{icon}</span>
        {delta!=null&&(
          <span style={{fontSize:10,fontFamily:T.mono,fontWeight:600,
            color:delta>=0?T.gL:T.rL,
            background:delta>=0?"rgba(16,201,122,.12)":"rgba(240,54,90,.12)",
            padding:"2px 7px",borderRadius:8}}>
            {delta>=0?"▲":"▼"}{Math.abs(delta)}%
          </span>
        )}
      </div>
      <div style={{fontFamily:T.mono,fontSize:26,fontWeight:700,color:col,lineHeight:1.1,letterSpacing:"-0.5px"}}>{val}</div>
      <div style={{fontSize:11,color:T.t2,marginTop:7,fontWeight:500,textTransform:"uppercase",letterSpacing:".8px"}}>{label}</div>
      {sub&&<div style={{fontSize:10.5,color:T.t3,marginTop:3}}>{sub}</div>}
    </div>
  );
}

/* Chip/tag */
function Chip({children,col=T.p}){
  return(
    <span style={{background:`${col}18`,color:col,border:`1px solid ${col}40`,
      borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:600,
      fontFamily:T.mono,letterSpacing:".6px"}}>
      {children}
    </span>
  );
}

/* Custom chart tooltip */
const CTip=({active,payload,label,fmt})=>{
  if(!active||!payload?.length)return null;
  return(
    <div style={TIP}>
      <div style={{color:T.t3,fontSize:10,marginBottom:6,fontFamily:T.mono,letterSpacing:".5px"}}>{label}</div>
      {payload.map((p,i)=>(
        <div key={i} style={{display:"flex",gap:8,alignItems:"center",marginBottom:3}}>
          <div style={{width:8,height:8,borderRadius:2,background:p.color||p.stroke,flexShrink:0}}/>
          <span style={{color:T.t2,fontSize:11}}>{p.name}:</span>
          <span style={{color:T.t1,fontWeight:600,fontSize:11,fontFamily:T.mono}}>
            {fmt?fmt(p.value):p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

const axTick={fontSize:10.5,fill:T.t3,fontFamily:T.mono};
const grid=<CartesianGrid strokeDasharray="2 8" stroke={T.b1} vertical={false}/>;

/* ═════════════════════════════════════════════════════════════════
   OVERVIEW TAB
═════════════════════════════════════════════════════════════════*/
function OverviewTab({patients,optimized,mc}){
  const highRisk=patients.filter(p=>p.noshow_prob>=0.5);
  const avgRisk=patients.reduce((s,p)=>s+p.noshow_prob,0)/patients.length;
  const atRisk=patients.reduce((s,p)=>s+p.revenue*p.noshow_prob,0);
  const recovered=atRisk*0.68;

  const hourly=Array.from({length:12},(_,i)=>{
    const h=i+8,pts=optimized.filter(p=>parseInt(p.time)===h);
    return{hour:`${h}:00`,
      expected:Math.round(pts.reduce((s,p)=>s+p.expectedRevenue,0)),
      atRisk:Math.round(pts.reduce((s,p)=>s+p.revenue*p.noshow_prob,0))};
  });

  const cohorts=[
    {name:"Critical ≥60%",n:patients.filter(p=>p.noshow_prob>=.6).length,c:T.r},
    {name:"High 40–60%",  n:patients.filter(p=>p.noshow_prob>=.4&&p.noshow_prob<.6).length,c:T.a},
    {name:"Moderate 20–40%",n:patients.filter(p=>p.noshow_prob>=.2&&p.noshow_prob<.4).length,c:T.s},
    {name:"Low <20%",     n:patients.filter(p=>p.noshow_prob<.2).length,c:T.g},
  ];

  return(
    <div style={{display:"flex",flexDirection:"column",gap:20,animation:"fadeUp .35s ease"}}>

      {/* ── KPI Row ── */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:14}}>
        <KPI icon="🗓" label="Appointments Today" val={<Num val={patients.length}/>} col={T.p} sub="Full day schedule"/>
        <KPI icon="📉" label="Avg No-Show Risk" val={<Num val={avgRisk*100} dec={1} suf="%"/>} col={avgRisk>.25?T.a:T.g} delta={-8}/>
        <KPI icon="🚨" label="Critical Risk" val={<Num val={highRisk.length}/>} col={T.r} sub="Prob above 50%"/>
        <KPI icon="💸" label="Revenue at Risk" val={<Num val={Math.round(atRisk)} pre="$"/>} col={T.a} sub="Without intervention"/>
        <KPI icon="💰" label="ARIL Recovery Est." val={<Num val={Math.round(recovered)} pre="$"/>} col={T.g} delta={12}/>
      </div>

      {/* ── Charts row ── */}
      <div style={{display:"grid",gridTemplateColumns:"2.3fr 1fr",gap:16}}>

        <Card title="Hourly Revenue Intelligence" sub="Expected revenue recovery vs. at-risk revenue block by block" accent={T.p}>
          <ResponsiveContainer width="100%" height={215}>
            <BarChart data={hourly} barGap={3} barCategoryGap="28%">
              <defs>
                <linearGradient id="gE" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={T.p}/><stop offset="100%" stopColor={T.pL} stopOpacity={.5}/>
                </linearGradient>
                <linearGradient id="gR" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={T.r}/><stop offset="100%" stopColor={T.rL} stopOpacity={.4}/>
                </linearGradient>
              </defs>
              {grid}
              <XAxis dataKey="hour" tick={axTick} axisLine={false} tickLine={false}/>
              <YAxis tick={axTick} axisLine={false} tickLine={false} tickFormatter={v=>`$${v}`}/>
              <Tooltip content={<CTip fmt={v=>`$${v.toLocaleString()}`}/>}/>
              <Bar dataKey="expected" name="Expected Rev" fill="url(#gE)" radius={[4,4,0,0]}/>
              <Bar dataKey="atRisk"   name="At-Risk Rev"  fill="url(#gR)" radius={[4,4,0,0]} opacity={.8}/>
            </BarChart>
          </ResponsiveContainer>
          <div style={{display:"flex",gap:18,paddingTop:10,borderTop:`1px solid ${T.b1}`}}>
            {[[T.p,"Expected Revenue"],[T.r,"At-Risk Revenue"]].map(([c,l])=>(
              <div key={l} style={{display:"flex",alignItems:"center",gap:6}}>
                <div style={{width:10,height:10,borderRadius:2,background:c}}/>
                <span style={{fontSize:11,color:T.t2}}>{l}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Risk Cohorts" accent={T.s}>
          <div style={{display:"flex",flexDirection:"column",gap:15,paddingTop:4}}>
            {cohorts.map(c=>(
              <div key={c.name}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                  <div style={{display:"flex",alignItems:"center",gap:7}}>
                    <div style={{width:8,height:8,borderRadius:2,background:c.c}}/>
                    <span style={{fontSize:11.5,color:T.t2}}>{c.name}</span>
                  </div>
                  <span style={{fontSize:16,fontWeight:700,color:c.c,fontFamily:T.mono}}>{c.n}</span>
                </div>
                <Bar val={c.n} max={patients.length} col={c.c} h={5}/>
              </div>
            ))}
            <div style={{marginTop:8,padding:"12px 14px",background:T.bg4,borderRadius:10,border:`1px solid ${T.b2}`}}>
              <div style={{fontSize:9,color:T.t3,textTransform:"uppercase",letterSpacing:"1.8px",marginBottom:3,fontFamily:T.mono}}>Model · AUC-ROC</div>
              <div style={{fontFamily:T.mono,fontSize:24,fontWeight:700,
                background:`linear-gradient(135deg,${T.p},${T.s})`,
                WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
                0.847
              </div>
              <div style={{fontSize:10.5,color:T.t3,marginTop:3}}>XGBoost + LightGBM + LR</div>
            </div>
          </div>
        </Card>
      </div>

      {/* ── MC summary strip ── */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
        {[
          {icon:"📊",label:"Baseline Daily Revenue",val:`$${Math.round(mc.base).toLocaleString()}`,sub:"No-ARIL scenario",col:T.t3},
          {icon:"🎯",label:"ARIL P50 Daily Revenue",val:`$${Math.round(mc.p50).toLocaleString()}`,sub:`P10 $${Math.round(mc.p10).toLocaleString()} · P90 $${Math.round(mc.p90).toLocaleString()}`,col:T.p},
          {icon:"📈",label:"Annual Revenue Uplift",val:`$${(mc.annualLift/1000).toFixed(0)}K`,sub:`Break-even in ${mc.breakEven} days`,col:T.a},
        ].map(k=>(
          <div key={k.label} className="kpi" style={{borderLeft:`3px solid ${k.col}`,borderTop:"none",display:"flex",gap:14,alignItems:"center"}}>
            <span style={{fontSize:28,flexShrink:0}}>{k.icon}</span>
            <div>
              <div style={{fontFamily:T.mono,fontSize:22,fontWeight:700,color:k.col,letterSpacing:"-.5px"}}>{k.val}</div>
              <div style={{fontSize:11,color:T.t2,textTransform:"uppercase",letterSpacing:".8px",marginTop:4}}>{k.label}</div>
              <div style={{fontSize:10.5,color:T.t3,marginTop:2}}>{k.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Risk Queue ── */}
      <Card title="Live Intervention Queue" sub="Patients requiring immediate action — sorted by risk severity"
        accent={T.r}
        right={<Chip col={T.r}>{highRisk.length} CRITICAL</Chip>}>
        <div style={{position:"relative",overflow:"hidden"}}>
          <div className="sweep"/>
          {highRisk.length===0
            ?<div style={{textAlign:"center",color:T.t3,padding:32}}>
               <div style={{fontSize:26,marginBottom:8}}>✅</div>
               <div style={{fontSize:13,color:T.t2}}>No critical-risk patients today</div>
             </div>
            :<div>
              {highRisk.sort((a,b)=>b.noshow_prob-a.noshow_prob).map((p,i)=>(
                <div key={p.id} style={{display:"flex",alignItems:"center",gap:14,
                  padding:"11px 14px",borderRadius:8,
                  background:i%2===0?T.bg4:"transparent",transition:"background .1s"}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:T.r,
                    boxShadow:`0 0 10px ${T.r}`,flexShrink:0,
                    animation:"blink 1.8s ease infinite"}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <span style={{color:T.t1,fontWeight:600,fontSize:13}}>{p.name}</span>
                    <span style={{color:T.t3,fontSize:11,marginLeft:10}}>{p.service} · {p.time} · {p.provider}</span>
                  </div>
                  <RB prob={p.noshow_prob}/>
                  <span style={{fontFamily:T.mono,fontSize:12,color:T.aL,minWidth:95,textAlign:"right",fontWeight:600}}>${p.revenue} at risk</span>
                  <span style={{fontSize:11.5,color:T.s,minWidth:115,textAlign:"right",fontWeight:500}}>
                    {p.shouldOverbook?"⚡ Overbook":"📲 Call + Remind"}
                  </span>
                </div>
              ))}
            </div>
          }
        </div>
      </Card>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════
   PREDICTION TAB
═════════════════════════════════════════════════════════════════*/
function PredictionTab({patients}){
  const[sel,setSel]=useState(patients[0]);
  const[form,setForm]=useState({prev_noshow_rate:.25,lead_time_days:14,age:35,day_of_week:2,time_slot:"morning",reminder_sent:false,distance_km:12,insurance_type:"public",sms_confirmed:false,is_new:true});
  const live=useMemo(()=>predict(form),[form]);
  const selExp=useMemo(()=>sel?explain(sel):[],[sel]);
  const roc=[{x:0,y:0},{x:.02,y:.14},{x:.05,y:.31},{x:.1,y:.52},{x:.15,y:.64},{x:.2,y:.72},{x:.3,y:.82},{x:.4,y:.88},{x:.5,y:.92},{x:.7,y:.96},{x:1,y:1}];
  const rc=p=>p<.2?T.g:p<.4?T.s:p<.6?T.a:T.r;

  return(
    <div style={{display:"flex",flexDirection:"column",gap:18,animation:"fadeUp .35s ease"}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>

        {/* ── Patient Queue ── */}
        <Card title="Appointment Queue" sub="Click any row to view SHAP-style risk explanation" accent={T.p}
          right={<Chip col={T.p}>AUC 0.847</Chip>}>
          <div style={{maxHeight:420,overflowY:"auto",paddingRight:2}}>
            {patients.slice().sort((a,b)=>b.noshow_prob-a.noshow_prob).map(p=>(
              <div key={p.id} onClick={()=>setSel(p)}
                style={{display:"flex",alignItems:"center",gap:11,padding:"10px 12px",
                  marginBottom:3,borderRadius:9,cursor:"pointer",
                  border:`1px solid ${sel?.id===p.id?T.p+"60":"transparent"}`,
                  background:sel?.id===p.id?`${T.p}0F`:T.bg1+"40",
                  transition:"all .12s"}}>
                <div style={{width:33,height:33,borderRadius:"50%",flexShrink:0,
                  background:`linear-gradient(135deg,${T.p}30,${T.s}18)`,
                  border:`1px solid ${T.b2}`,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:12,fontWeight:700,color:T.pL,fontFamily:T.mono}}>
                  {p.name[0]}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:600,color:T.t1}}>{p.name}</div>
                  <div style={{fontSize:10.5,color:T.t3,marginTop:1}}>{p.service} · {p.time} · {p.provider}</div>
                </div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:3}}>
                  <RB prob={p.noshow_prob}/>
                  <span style={{fontSize:9,color:T.t3,fontFamily:T.mono}}>[{(p.conf_lo*100).toFixed(0)}–{(p.conf_hi*100).toFixed(0)}%]</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* ── SHAP Explanation ── */}
        {sel&&(
          <Card title={`Risk Breakdown · ${sel.name}`} sub="SHAP-style feature attribution — which factors drive risk" accent={T.s}>
            {/* Gauge */}
            <div style={{display:"flex",justifyContent:"center",marginBottom:16}}>
              <div style={{position:"relative",width:130,height:130}}>
                <svg width="130" height="130" style={{overflow:"visible"}}>
                  <circle cx="65" cy="65" r="52" fill="none" stroke={T.b1} strokeWidth="9"/>
                  <circle cx="65" cy="65" r="52" fill="none"
                    stroke={rc(sel.noshow_prob)} strokeWidth="9" strokeLinecap="round"
                    strokeDasharray={`${sel.noshow_prob*327} 327`}
                    transform="rotate(-90 65 65)"
                    style={{filter:`drop-shadow(0 0 10px ${rc(sel.noshow_prob)}90)`,
                      transition:"stroke-dasharray .6s ease"}}/>
                </svg>
                <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",
                  alignItems:"center",justifyContent:"center"}}>
                  <div style={{fontFamily:T.mono,fontSize:27,fontWeight:700,
                    color:rc(sel.noshow_prob),letterSpacing:"-1px"}}>
                    {(sel.noshow_prob*100).toFixed(0)}%
                  </div>
                  <div style={{fontSize:9,color:T.t3,textTransform:"uppercase",letterSpacing:"1.3px",marginTop:2}}>
                    NO-SHOW RISK
                  </div>
                </div>
              </div>
            </div>

            {/* Waterfall bars */}
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:12,
              fontSize:9,color:T.t3,textTransform:"uppercase",letterSpacing:"1.5px",fontFamily:T.mono}}>
              <span>Base 18%</span>
              <div style={{flex:1,height:1,background:T.b1}}/>
              <span style={{color:rc(sel.noshow_prob)}}>→ Final {(sel.noshow_prob*100).toFixed(0)}%</span>
            </div>
            {selExp.map(c=>(
              <div key={c.name} style={{marginBottom:9}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                  <span style={{fontSize:11.5,color:T.t2}}>{c.name}</span>
                  <span style={{fontSize:10,fontFamily:T.mono,fontWeight:600,
                    color:c.contrib>.005?T.rL:c.contrib<-.005?T.gL:T.t3}}>
                    {c.contrib>.005?"+":""}{(c.contrib*100).toFixed(1)}pp
                    <span style={{color:T.t3,fontWeight:400}}> ({c.display})</span>
                  </span>
                </div>
                <div style={{height:5,background:T.b1,borderRadius:3,position:"relative",overflow:"hidden"}}>
                  <div style={{position:"absolute",left:"50%",top:0,width:1,height:"100%",background:T.b2}}/>
                  <div style={{position:"absolute",height:"100%",
                    width:`${Math.min(48,Math.abs(c.contrib)*200)}%`,
                    background:c.contrib>.005?T.r:c.contrib<-.005?T.g:T.b2,
                    borderRadius:3,[c.contrib>=0?"left":"right"]:"50%",
                    boxShadow:Math.abs(c.contrib)>.01?`0 0 6px ${c.contrib>0?T.r:T.g}80`:undefined}}/>
                </div>
              </div>
            ))}
          </Card>
        )}
      </div>

      {/* ── Live predictor + ROC ── */}
      <div style={{display:"grid",gridTemplateColumns:"1.6fr 1fr",gap:16}}>
        <Card title="Live Prediction Engine" sub="Adjust any feature — ensemble model recalculates in real-time" accent={T.p}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
            {[
              {k:"prev_noshow_rate",l:"Prior No-Show Rate",min:0,max:.9,step:.01,fmt:v=>`${(v*100).toFixed(0)}%`,col:T.r},
              {k:"lead_time_days",  l:"Lead Time (days)",  min:1,max:60,fmt:v=>`${v}d`,col:T.a},
              {k:"age",             l:"Patient Age",        min:18,max:85,fmt:v=>`${v}yr`,col:T.s},
              {k:"distance_km",    l:"Distance (km)",     min:1,max:50,fmt:v=>`${v}km`,col:T.p},
            ].map(f=>(
              <div key={f.k}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                  <label style={{fontSize:11.5,color:T.t2}}>{f.l}</label>
                  <span style={{fontSize:11,fontFamily:T.mono,color:f.col,fontWeight:700}}>{f.fmt(form[f.k])}</span>
                </div>
                <input type="range" min={f.min} max={f.max} step={f.step||1} value={form[f.k]}
                  onChange={e=>setForm(p=>({...p,[f.k]:parseFloat(e.target.value)}))}
                  style={{accentColor:f.col}}/>
              </div>
            ))}
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:16}}>
            {[["reminder_sent","Reminder Sent","📲"],["sms_confirmed","SMS Confirmed","✅"],["is_new","New Patient","🆕"]].map(([k,l,ic])=>(
              <label key={k} style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",
                padding:"9px 11px",borderRadius:9,transition:"all .12s",
                background:form[k]?`${T.p}14`:T.bg4,
                border:`1px solid ${form[k]?T.p+"50":T.b1}`}}>
                <input type="checkbox" checked={form[k]} onChange={e=>setForm(p=>({...p,[k]:e.target.checked}))}/>
                <span style={{fontSize:11,color:form[k]?T.pLL:T.t2}}>{ic} {l}</span>
              </label>
            ))}
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
            {[
              {k:"day_of_week",l:"Day of Week",opts:[[1,"Monday"],[2,"Tuesday"],[3,"Wednesday"],[4,"Thursday"],[5,"Friday"]]},
              {k:"insurance_type",l:"Insurance",opts:[["public","Public / Medicare"],["private","Private Insurance"]]},
            ].map(f=>(
              <div key={f.k}>
                <label style={{fontSize:11.5,color:T.t2,display:"block",marginBottom:5}}>{f.l}</label>
                <select value={form[f.k]} onChange={e=>setForm(p=>({...p,[f.k]:isNaN(e.target.value)?e.target.value:parseInt(e.target.value)}))}>
                  {f.opts.map(([v,l])=><option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            ))}
          </div>

          {/* Result box */}
          <div style={{padding:"16px 20px",borderRadius:12,
            border:`2px solid ${rc(live)}50`,
            background:`linear-gradient(135deg,${rc(live)}0A,${rc(live)}05)`,
            display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div>
              <div style={{fontSize:10,color:T.t3,textTransform:"uppercase",letterSpacing:"1.8px",fontFamily:T.mono,marginBottom:4}}>Ensemble Output</div>
              <div style={{fontFamily:T.mono,fontSize:38,fontWeight:700,color:rc(live),letterSpacing:"-2px",lineHeight:1}}>
                {(live*100).toFixed(1)}%
              </div>
            </div>
            <div style={{textAlign:"right"}}>
              <RB prob={live} lg/>
              <div style={{fontSize:12,color:T.t2,marginTop:9}}>
                {live>.5?"⚡ Overbook + Call Now":live>.3?"📲 Send SMS Reminder":"✅ Standard Monitoring"}
              </div>
            </div>
          </div>
        </Card>

        <Card title="ROC Curve" sub="Ensemble model discrimination · AUC = 0.847" accent={T.s}>
          <ResponsiveContainer width="100%" height={234}>
            <LineChart margin={{top:8,right:8,bottom:24,left:0}}>
              <defs>
                <linearGradient id="rocG" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={T.p}/><stop offset="100%" stopColor={T.s}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 8" stroke={T.b1}/>
              <XAxis dataKey="x" type="number" domain={[0,1]} tick={axTick}
                label={{value:"False Positive Rate",position:"insideBottom",offset:-10,fontSize:10,fill:T.t3}}/>
              <YAxis type="number" domain={[0,1]} tick={axTick}/>
              <Tooltip contentStyle={TIP} formatter={v=>v.toFixed(3)}/>
              <Line data={roc} type="monotone" dataKey="y" stroke="url(#rocG)" strokeWidth={2.5} dot={false} name="ARIL" style={{filter:`drop-shadow(0 0 6px ${T.p}80)`}}/>
              <Line data={[{x:0,y:0},{x:1,y:1}]} type="monotone" dataKey="y" stroke={T.b2} strokeWidth={1} dot={false} strokeDasharray="5 4" name="Random"/>
            </LineChart>
          </ResponsiveContainer>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:6}}>
            {[["AUC-ROC","0.847",T.p],["Precision","0.71",T.s],["Recall","0.68",T.g],["F1 Score","0.69",T.a]].map(([k,v,c])=>(
              <div key={k} style={{background:T.bg4,borderRadius:8,padding:"10px 12px",textAlign:"center",border:`1px solid ${T.b1}`}}>
                <div style={{fontFamily:T.mono,fontSize:19,fontWeight:700,color:c,letterSpacing:"-.5px"}}>{v}</div>
                <div style={{fontSize:9.5,color:T.t3,textTransform:"uppercase",letterSpacing:"1px",marginTop:2}}>{k}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════
   SCHEDULING TAB
═════════════════════════════════════════════════════════════════*/
function SchedulingTab({optimized,waitlist}){
  const[pen,setPen]=useState(1.75);
  const reOpt=useMemo(()=>optimized.map(p=>optSlot(p,pen)),[optimized,pen]);
  const totalExp=reOpt.reduce((s,p)=>s+p.expectedRevenue,0);
  const obCount=reOpt.filter(p=>p.shouldOverbook).length;
  const oppCost=reOpt.reduce((s,p)=>s+p.opportunityCost,0);
  const provData=PROVS.map(pr=>{
    const pts=reOpt.filter(p=>p.provider===pr);
    return{name:pr.replace("Dr. ",""),slots:pts.length,rev:Math.round(pts.reduce((s,p)=>s+p.expectedRevenue,0)),risk:pts.length?(pts.reduce((s,p)=>s+p.noshow_prob,0)/pts.length*100).toFixed(0):0};
  }).filter(p=>p.slots>0);

  return(
    <div style={{display:"flex",flexDirection:"column",gap:18,animation:"fadeUp .35s ease"}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14}}>
        <KPI icon="💰" label="Expected Revenue" val={<Num val={Math.round(totalExp)} pre="$"/>} col={T.p} sub="Risk-adjusted"/>
        <KPI icon="⚡" label="Overbook Slots" val={<Num val={obCount}/>} col={T.a} sub="EV-positive decisions"/>
        <KPI icon="🔥" label="Opportunity Cost" val={<Num val={Math.round(oppCost)} pre="$"/>} col={T.r} sub="If no action taken"/>
        <div className="kpi" style={{borderTop:`2px solid ${T.s}`}}>
          <div style={{fontSize:20,marginBottom:8}}>🎛️</div>
          <div style={{fontFamily:T.mono,fontSize:24,fontWeight:700,color:T.s}}>{pen.toFixed(2)}×</div>
          <div style={{fontSize:10.5,color:T.t2,textTransform:"uppercase",letterSpacing:".8px",margin:"5px 0 8px"}}>Penalty Factor</div>
          <input type="range" min={1.0} max={3.0} step={0.05} value={pen} onChange={e=>setPen(parseFloat(e.target.value))} style={{accentColor:T.s}}/>
          <div style={{fontSize:10,color:T.t3,marginTop:4}}>Overbooking aggressiveness</div>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:16}}>
        <Card title="Optimized Slot Decisions" sub="LP expected value per slot · penalty-adjusted overbooking" accent={T.p} flat>
          <div style={{overflowX:"auto"}}>
            <table>
              <thead><tr>
                <th>Patient</th><th>Time</th><th>Service</th><th>Risk</th>
                <th>E[Revenue]</th><th>Opp. Cost</th><th>Decision</th>
              </tr></thead>
              <tbody>
                {reOpt.slice().sort((a,b)=>b.noshow_prob-a.noshow_prob).map(p=>(
                  <tr key={p.id}>
                    <td>
                      <div style={{fontWeight:600,color:T.t1,fontSize:13}}>{p.name}</div>
                      <div style={{fontSize:10.5,color:T.t3,marginTop:1}}>{p.provider}</div>
                    </td>
                    <td style={{fontFamily:T.mono,color:T.pLL,fontWeight:500}}>{p.time}</td>
                    <td style={{color:T.t2}}>{p.service}</td>
                    <td><RB prob={p.noshow_prob}/></td>
                    <td style={{fontFamily:T.mono,color:T.gL,fontWeight:700}}>${Math.round(p.expectedRevenue).toLocaleString()}</td>
                    <td style={{fontFamily:T.mono,color:T.rL}}>${Math.round(p.opportunityCost).toLocaleString()}</td>
                    <td>
                      {p.shouldOverbook
                        ?<Chip col={T.a}>⚡ OVERBOOK</Chip>
                        :p.noshow_prob>.3
                        ?<Chip col={T.s}>📲 REMIND</Chip>
                        :<Chip col={T.g}>✅ HOLD</Chip>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <Card title="Provider Analytics" accent={T.s}>
            {provData.map(p=>(
              <div key={p.name} style={{marginBottom:16}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                  <div style={{display:"flex",alignItems:"center",gap:9}}>
                    <div style={{width:30,height:30,borderRadius:"50%",
                      background:`linear-gradient(135deg,${T.p}28,${T.s}18)`,
                      border:`1px solid ${T.b2}`,
                      display:"flex",alignItems:"center",justifyContent:"center",
                      fontSize:11,fontWeight:700,color:T.pL,fontFamily:T.mono}}>
                      {p.name[0]}
                    </div>
                    <div>
                      <div style={{fontSize:12.5,fontWeight:600,color:T.t1}}>{p.name}</div>
                      <div style={{fontSize:10,color:T.t3}}>{p.slots} appts · {p.risk}% avg risk</div>
                    </div>
                  </div>
                  <span style={{fontFamily:T.mono,fontSize:12,color:T.s,fontWeight:600}}>${p.rev.toLocaleString()}</span>
                </div>
                <Bar val={p.rev} max={Math.max(...provData.map(x=>x.rev))} col={T.p} h={4}/>
              </div>
            ))}
          </Card>

          <Card title="Waitlist Optimizer" sub="Ranked by E[Rev] × urgency" accent={T.g}>
            {waitlist.slice(0,6).map((w,i)=>(
              <div key={w.id} style={{display:"flex",alignItems:"center",gap:10,
                padding:"8px 0",borderBottom:`1px solid ${T.b1}`}}>
                <span style={{fontFamily:T.mono,fontSize:11,color:i<3?T.aL:T.t3,minWidth:20,fontWeight:700}}>#{i+1}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12.5,color:T.t1,fontWeight:600}}>{w.name}</div>
                  <div style={{fontSize:10,color:T.t3}}>{w.service} · {w.wait_days}d wait</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontFamily:T.mono,fontSize:12,color:T.gL,fontWeight:600}}>${Math.round(w.revenue*(1-w.noshow_prob))}</div>
                  <div style={{fontSize:10,color:T.t3}}>{(w.urgency*100).toFixed(0)}% urgent</div>
                </div>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════
   SIMULATION TAB
═════════════════════════════════════════════════════════════════*/
function SimulationTab(){
  const[p,setP]=useState({slots:80,baseNS:.20,rev:220,obFrac:.65,remLift:.28,confLift:.38,implCost:85000});
  const mc=useMemo(()=>monteCarlo(p,900),[p]);
  const upd=(k,v)=>setP(pr=>({...pr,[k]:v}));

  const hist=useMemo(()=>{
    const bins=26,mn=mc.dist[0],mx=mc.dist[mc.dist.length-1],bw=(mx-mn)/bins;
    return Array.from({length:bins},(_,i)=>{
      const lo=mn+i*bw,hi=lo+bw;
      return{rev:Math.round((lo+hi)/2),n:mc.dist.filter(v=>v>=lo&&v<hi).length};
    });
  },[mc]);

  const monthly=useMemo(()=>["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map(m=>{
    const f=.88+Math.random()*.24;
    return{m,base:Math.round(mc.base*22*f),p10:Math.round(mc.p10*22*f*(.95+Math.random()*.1)),p50:Math.round(mc.p50*22*f*(.95+Math.random()*.1)),p90:Math.round(mc.p90*22*f*(.95+Math.random()*.1))};
  }),[mc]);

  return(
    <div style={{display:"flex",flexDirection:"column",gap:18,animation:"fadeUp .35s ease"}}>
      <Card title="Monte Carlo Simulation Parameters" sub="900 stochastic revenue paths · recalculates live on every change" accent={T.a}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:20}}>
          {[
            {k:"slots",l:"Daily Slots",min:20,max:200,step:5,fmt:v=>v,icon:"📅"},
            {k:"baseNS",l:"Baseline No-Show",min:.05,max:.45,step:.01,fmt:v=>`${(v*100).toFixed(0)}%`,icon:"⚠️"},
            {k:"rev",l:"Revenue / Slot",min:50,max:900,step:25,fmt:v=>`$${v}`,icon:"💰"},
            {k:"obFrac",l:"Overbooking Rate",min:0,max:.95,step:.05,fmt:v=>`${(v*100).toFixed(0)}%`,icon:"⚡"},
            {k:"remLift",l:"Reminder Lift",min:.05,max:.55,step:.01,fmt:v=>`${(v*100).toFixed(0)}%`,icon:"📲"},
            {k:"confLift",l:"Confirmation Lift",min:.05,max:.65,step:.01,fmt:v=>`${(v*100).toFixed(0)}%`,icon:"✅"},
            {k:"implCost",l:"Impl. Cost",min:10000,max:500000,step:5000,fmt:v=>`$${(v/1000).toFixed(0)}K`,icon:"🏗️"},
          ].map(f=>(
            <div key={f.k}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                <label style={{fontSize:11.5,color:T.t2,display:"flex",alignItems:"center",gap:5}}>
                  <span>{f.icon}</span>{f.l}
                </label>
                <span style={{fontSize:11,fontFamily:T.mono,color:T.aL,fontWeight:700}}>{f.fmt(p[f.k])}</span>
              </div>
              <input type="range" min={f.min} max={f.max} step={f.step} value={p[f.k]}
                onChange={e=>upd(f.k,parseFloat(e.target.value))} style={{accentColor:T.a}}/>
            </div>
          ))}
        </div>
      </Card>

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14}}>
        <KPI icon="🎯" label="P50 Daily Revenue" val={<Num val={Math.round(mc.p50)} pre="$"/>} col={T.p} sub={`vs $${Math.round(mc.base).toLocaleString()} baseline`}/>
        <KPI icon="📊" label="P10–P90 Range" val={<Num val={Math.round(mc.p90-mc.p10)} pre="$"/>} col={T.s} sub="Daily confidence spread"/>
        <KPI icon="📈" label="Annual Uplift" val={<Num val={Math.round(mc.annualLift/1000)} pre="$" suf="K"/>} col={T.a} delta={Math.round((mc.p50/mc.base-1)*100)}/>
        <KPI icon="⏱" label="Break-Even" val={<Num val={mc.breakEven} suf="d"/>} col={mc.breakEven<90?T.g:T.r} sub={`At $${(p.implCost/1000).toFixed(0)}K cost`}/>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1.6fr 1fr",gap:16}}>
        <Card title="Revenue Distribution — 900 Paths" sub="Red = below baseline · Amber = below P50 · Blue = above P50" accent={T.p}>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={hist} barCategoryGap="5%">
              {grid}
              <XAxis dataKey="rev" tick={axTick} tickFormatter={v=>`$${(v/1000).toFixed(0)}K`}/>
              <YAxis hide/>
              <Tooltip contentStyle={TIP} formatter={(v,n,pp)=>[`${v} paths`,`~$${pp.payload.rev.toLocaleString()}`]}/>
              <Bar dataKey="n" radius={[3,3,0,0]}>
                {hist.map((d,i)=><Cell key={i} fill={d.rev<mc.base?T.r:d.rev<mc.p50?T.a:T.p} opacity={.85}/>)}
              </Bar>
              <ReferenceLine x={Math.round(mc.base)} stroke={T.r}  strokeDasharray="4 2" strokeWidth={1.5}/>
              <ReferenceLine x={Math.round(mc.p50)} stroke={T.pL} strokeDasharray="4 2" strokeWidth={1.5}/>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Scenario Comparison" accent={T.s}>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {[
              {l:"Baseline (No ARIL)",v:mc.base,c:T.t3,i:"📉"},
              {l:"Pessimistic P10",   v:mc.p10, c:T.a, i:"⚠️"},
              {l:"Expected P50",      v:mc.p50, c:T.p, i:"🎯"},
              {l:"Optimistic P90",    v:mc.p90, c:T.g, i:"🚀"},
            ].map(s=>(
              <div key={s.l} style={{padding:"11px 14px",background:T.bg4,borderRadius:10,
                border:`1px solid ${T.b1}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:18}}>{s.i}</span>
                  <div>
                    <div style={{fontSize:12.5,color:T.t1,fontWeight:600}}>{s.l}</div>
                    <div style={{fontFamily:T.mono,fontSize:14,color:s.c,fontWeight:700}}>${Math.round(s.v).toLocaleString()}/day</div>
                  </div>
                </div>
                <span style={{fontSize:12,color:s.v>mc.base?T.gL:T.t3,fontFamily:T.mono,fontWeight:600}}>
                  {s.v>mc.base?`+${((s.v/mc.base-1)*100).toFixed(1)}%`:"—"}
                </span>
              </div>
            ))}
          </div>
          <div style={{marginTop:12,padding:"12px 14px",
            background:`linear-gradient(135deg,${T.a}0A,${T.p}0A)`,
            borderRadius:10,border:`1px solid ${T.a}30`}}>
            <div style={{fontSize:9,color:T.t3,textTransform:"uppercase",letterSpacing:"1.8px",marginBottom:5,fontFamily:T.mono}}>Annual Uplift Range</div>
            <div style={{fontFamily:T.mono,fontSize:18,fontWeight:700,
              background:`linear-gradient(90deg,${T.a},${T.p})`,
              WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
              ${((mc.p10-mc.base)*260/1000).toFixed(0)}K – ${((mc.p90-mc.base)*260/1000).toFixed(0)}K
            </div>
          </div>
        </Card>
      </div>

      <Card title="12-Month Revenue Projection with Confidence Bands" sub="P10 / P50 / P90 vs. no-action baseline · monthly view" accent={T.p}>
        <ResponsiveContainer width="100%" height={245}>
          <AreaChart data={monthly}>
            <defs>
              <linearGradient id="aG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={T.p} stopOpacity={.14}/>
                <stop offset="95%" stopColor={T.p} stopOpacity={.01}/>
              </linearGradient>
            </defs>
            {grid}
            <XAxis dataKey="m" tick={axTick}/>
            <YAxis tickFormatter={v=>`$${(v/1000).toFixed(0)}K`} tick={axTick}/>
            <Tooltip contentStyle={TIP} formatter={v=>`$${v.toLocaleString()}`}/>
            <Area type="monotone" dataKey="p90" stroke="none" fill="url(#aG)"/>
            <Line type="monotone" dataKey="base" stroke={T.b2} strokeWidth={1.5} dot={false} name="Baseline" strokeDasharray="5 4"/>
            <Line type="monotone" dataKey="p10"  stroke={T.a}  strokeWidth={1.5} dot={false} name="P10" strokeOpacity={.8}/>
            <Line type="monotone" dataKey="p50"  stroke={T.p}  strokeWidth={2.5} dot={false} name="P50 Expected" style={{filter:`drop-shadow(0 0 6px ${T.p}80)`}}/>
            <Line type="monotone" dataKey="p90"  stroke={T.g}  strokeWidth={1.5} dot={false} name="P90" strokeOpacity={.8}/>
            <Legend wrapperStyle={{fontSize:11}} formatter={v=><span style={{color:T.t2}}>{v}</span>}/>
          </AreaChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════
   ANALYTICS TAB
═════════════════════════════════════════════════════════════════*/
function AnalyticsTab({patients}){
  const dayData=["Mon","Tue","Wed","Thu","Fri"].map((d,i)=>{
    const pts=patients.filter(p=>p.day_of_week===i+1);
    return{day:d,risk:pts.length?(pts.reduce((s,p)=>s+p.noshow_prob,0)/pts.length*100).toFixed(1):0};
  });
  const leadData=[
    {b:"1–7d",  f:p=>p.lead_time_days<=7},
    {b:"8–14d", f:p=>p.lead_time_days>7&&p.lead_time_days<=14},
    {b:"15–30d",f:p=>p.lead_time_days>14&&p.lead_time_days<=30},
    {b:"31d+",  f:p=>p.lead_time_days>30},
  ].map(({b,f})=>{const pts=patients.filter(f);return{bucket:b,risk:pts.length?(pts.reduce((s,p)=>s+p.noshow_prob,0)/pts.length*100).toFixed(1):0};});
  const cohorts=[
    {name:"Critical ≥60%",v:patients.filter(p=>p.noshow_prob>=.6).length,c:T.r},
    {name:"High 40–60%",  v:patients.filter(p=>p.noshow_prob>=.4&&p.noshow_prob<.6).length,c:T.a},
    {name:"Moderate",     v:patients.filter(p=>p.noshow_prob>=.2&&p.noshow_prob<.4).length,c:T.s},
    {name:"Low <20%",     v:patients.filter(p=>p.noshow_prob<.2).length,c:T.g},
  ];
  const scatter=patients.map(p=>({x:p.lead_time_days,y:+(p.noshow_prob*100).toFixed(1),prob:p.noshow_prob}));
  const roi=[
    {name:"SMS Reminder",   red:18,cost:2,  roi:420,  c:T.s},
    {name:"Call + SMS",     red:31,cost:8,  roi:890,  c:T.p},
    {name:"AI Overbooking", red:45,cost:12, roi:1240, c:T.a},
    {name:"Full ARIL Suite",red:62,cost:18, roi:2100, c:T.g},
  ];
  const svcData=SVCS.map(svc=>{
    const pts=patients.filter(p=>p.service===svc.n);
    return{name:svc.n,risk:pts.length?(pts.reduce((s,p)=>s+p.noshow_prob,0)/pts.length*100).toFixed(1):0,n:pts.length};
  }).filter(s=>s.n>0);

  return(
    <div style={{display:"flex",flexDirection:"column",gap:18,animation:"fadeUp .35s ease"}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16}}>
        <Card title="Population Risk Cohorts" accent={T.p}>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={cohorts.map(c=>({name:c.name,value:c.v}))} cx="50%" cy="50%"
                innerRadius={54} outerRadius={80} paddingAngle={4} dataKey="value" strokeWidth={0}>
                {cohorts.map((c,i)=><Cell key={i} fill={c.c}/>)}
              </Pie>
              <Tooltip contentStyle={TIP}/>
              <Legend wrapperStyle={{fontSize:10.5}} formatter={v=><span style={{color:T.t2}}>{v}</span>}/>
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Risk by Day of Week" accent={T.a}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dayData} barCategoryGap="35%">
              {grid}
              <XAxis dataKey="day" tick={axTick} axisLine={false} tickLine={false}/>
              <YAxis tick={axTick} axisLine={false} tickLine={false} tickFormatter={v=>`${v}%`}/>
              <Tooltip contentStyle={TIP} formatter={v=>`${v}%`}/>
              <Bar dataKey="risk" name="Avg Risk" radius={[4,4,0,0]}>
                {dayData.map((d,i)=><Cell key={i} fill={parseFloat(d.risk)>30?T.r:parseFloat(d.risk)>22?T.a:T.p}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Risk by Lead Time" accent={T.s}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={leadData} barCategoryGap="35%">
              {grid}
              <XAxis dataKey="bucket" tick={axTick} axisLine={false} tickLine={false}/>
              <YAxis tick={axTick} axisLine={false} tickLine={false} tickFormatter={v=>`${v}%`}/>
              <Tooltip contentStyle={TIP} formatter={v=>`${v}%`}/>
              <Bar dataKey="risk" name="Avg Risk" radius={[4,4,0,0]}>
                {leadData.map((d,i)=><Cell key={i} fill={[T.g,T.s,T.a,T.r][i]}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1.4fr 1fr",gap:16}}>
        <Card title="Lead Time vs. No-Show Risk" sub="Each point = one patient · color = risk tier" accent={T.p}>
          <ResponsiveContainer width="100%" height={240}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="2 8" stroke={T.b1}/>
              <XAxis dataKey="x" name="Lead Time" tick={axTick}
                label={{value:"Lead Time (days)",position:"insideBottom",offset:-8,fontSize:10.5,fill:T.t3}}/>
              <YAxis dataKey="y" name="No-Show Risk" tick={axTick} tickFormatter={v=>`${v}%`}/>
              <Tooltip contentStyle={TIP} formatter={(v,n)=>n==="No-Show Risk"?`${v}%`:v}/>
              <Scatter data={scatter} name="Patients">
                {scatter.map((d,i)=><Cell key={i} fill={d.prob<.2?T.g:d.prob<.4?T.s:d.prob<.6?T.a:T.r} fillOpacity={.8}/>)}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Intervention ROI" sub="Revenue recovery per $1 invested" accent={T.g}>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {roi.map(d=>(
              <div key={d.name} style={{padding:"12px 14px",background:T.bg4,borderRadius:10,border:`1px solid ${T.b1}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                  <span style={{fontSize:12.5,color:T.t1,fontWeight:600}}>{d.name}</span>
                  <Chip col={T.a}>{d.roi}% ROI</Chip>
                </div>
                <div style={{display:"flex",gap:16,marginBottom:7}}>
                  <span style={{fontSize:10.5,color:T.gL}}>▲ {d.red}% reduction</span>
                  <span style={{fontSize:10.5,color:T.t3}}>${d.cost}/patient</span>
                </div>
                <Bar val={d.roi} max={2200} col={d.c} h={4}/>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="No-Show Risk by Service Line" sub="High revenue × high risk = priority intervention target" accent={T.a}>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={svcData} layout="vertical" barCategoryGap="28%">
            {grid}
            <XAxis type="number" tickFormatter={v=>`${v}%`} tick={axTick} axisLine={false} tickLine={false}/>
            <YAxis type="category" dataKey="name" tick={{fontSize:11.5,fill:T.t2,fontFamily:T.sans}} axisLine={false} tickLine={false} width={95}/>
            <Tooltip contentStyle={TIP} formatter={v=>`${v}%`}/>
            <Bar dataKey="risk" name="Avg Risk %" radius={[0,4,4,0]}>
              {svcData.map((d,i)=><Cell key={i} fill={parseFloat(d.risk)>25?T.r:parseFloat(d.risk)>18?T.a:T.p}/>)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════
   ROOT APPLICATION
═════════════════════════════════════════════════════════════════*/
export default function ARIL(){
  const[tab,setTab]=useState("overview");
  const[patients]=useState(()=>makePatients(24));
  const[waitlist]=useState(()=>makeWaitlist(10));
  const[clock,setClock]=useState(new Date());

  useEffect(()=>{const t=setInterval(()=>setClock(new Date()),1000);return()=>clearInterval(t);},[]);

  const optimized=useMemo(()=>patients.map(p=>optSlot(p,1.75)),[patients]);
  const mc=useMemo(()=>monteCarlo({slots:80,baseNS:.20,rev:220,obFrac:.65,remLift:.28,confLift:.38,implCost:85000},600),[]);

  const avgRisk=patients.reduce((s,p)=>s+p.noshow_prob,0)/patients.length;
  const critical=patients.filter(p=>p.noshow_prob>=.5).length;
  const atRisk=patients.reduce((s,p)=>s+p.revenue*p.noshow_prob,0);
  const expRev=optimized.reduce((s,p)=>s+p.expectedRevenue,0);

  const TABS=[
    {id:"overview",  label:"Intelligence Overview", icon:"◈"},
    {id:"prediction",label:"Prediction Engine",     icon:"⬡"},
    {id:"scheduling",label:"Schedule Optimizer",    icon:"⬢"},
    {id:"simulation",label:"Revenue Simulation",    icon:"◉"},
    {id:"analytics", label:"Analytics",             icon:"⬟"},
  ];

  return(
    <>
      <style>{G}</style>
      <div style={{width:"100%",minHeight:"100vh",background:T.bg0,color:T.t1,
        fontFamily:T.sans,display:"flex",flexDirection:"column",position:"relative"}}>

        {/* ── Ambient gradient background ── */}
        <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0,
          backgroundImage:`
            radial-gradient(ellipse 60% 40% at 15% 10%, rgba(91,106,240,.07) 0%, transparent 60%),
            radial-gradient(ellipse 50% 40% at 85% 85%, rgba(6,200,214,.05) 0%, transparent 60%)
          `}}/>

        {/* ── Subtle grid ── */}
        <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0,opacity:.4,
          backgroundImage:`linear-gradient(${T.b1} 1px,transparent 1px),linear-gradient(90deg,${T.b1} 1px,transparent 1px)`,
          backgroundSize:"52px 52px"}}/>

        {/* ══════════ HEADER ══════════ */}
        <header style={{position:"sticky",top:0,zIndex:100,
          background:"rgba(11,17,32,.92)",backdropFilter:"blur(18px)",
          borderBottom:`1px solid ${T.b1}`,width:"100%",flexShrink:0}}>

          <div style={{maxWidth:1640,margin:"0 auto",padding:"0 28px"}}>

            {/* Top bar */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",height:60}}>

              {/* Brand mark */}
              <div style={{display:"flex",alignItems:"center",gap:14}}>
                {/* Hexagon logo */}
                <div style={{position:"relative",width:38,height:38,flexShrink:0}}>
                  <svg viewBox="0 0 38 38" width="38" height="38">
                    <defs>
                      <linearGradient id="lgHex" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor={T.p}/>
                        <stop offset="100%" stopColor={T.s}/>
                      </linearGradient>
                    </defs>
                    <polygon points="19,2 36,10.5 36,27.5 19,36 2,27.5 2,10.5" fill="url(#lgHex)" opacity=".15"/>
                    <polygon points="19,2 36,10.5 36,27.5 19,36 2,27.5 2,10.5" fill="none" stroke="url(#lgHex)" strokeWidth="1.5"/>
                    <text x="19" y="24" textAnchor="middle" fontSize="16" fill={T.pL} fontWeight="700">⚡</text>
                  </svg>
                </div>

                <div>
                  <div style={{fontFamily:T.mono,fontSize:19,fontWeight:700,letterSpacing:"3px",lineHeight:1,
                    background:`linear-gradient(120deg,${T.pLL},${T.sL})`,
                    WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
                    ARIL
                  </div>
                  <div style={{fontSize:9.5,color:T.t3,letterSpacing:"1.8px",textTransform:"uppercase",marginTop:1}}>
                    AI Revenue Intelligence Layer
                  </div>
                </div>

                <div style={{width:1,height:32,background:T.b1,margin:"0 12px"}}/>

                {/* Live indicator */}
                <div style={{display:"flex",alignItems:"center",gap:7}}>
                  <div style={{width:7,height:7,borderRadius:"50%",background:T.g,
                    boxShadow:`0 0 10px ${T.g}`,animation:"blink 2.2s ease infinite"}}/>
                  <span style={{fontSize:11,color:T.t3}}>Live</span>
                  <span style={{color:T.b2,margin:"0 2px"}}>·</span>
                  <span style={{fontFamily:T.mono,fontSize:11,color:T.t2}}>
                    {clock.toLocaleTimeString()}
                  </span>
                  <span style={{color:T.b2,margin:"0 2px"}}>·</span>
                  <span style={{fontSize:11,color:T.t3}}>Ensemble v2.4</span>
                </div>
              </div>

              {/* Live metrics bar */}
              <div style={{display:"flex",gap:28,alignItems:"center"}}>
                {[
                  {l:"Appointments",   v:patients.length,                         c:T.pLL},
                  {l:"Avg Risk",       v:`${(avgRisk*100).toFixed(1)}%`,           c:avgRisk>.28?T.aL:T.sL},
                  {l:"Critical",       v:critical,                                 c:critical>3?T.rL:T.aL},
                  {l:"Revenue at Risk",v:`$${Math.round(atRisk).toLocaleString()}`,c:T.aL},
                  {l:"Expected Rev",   v:`$${Math.round(expRev).toLocaleString()}`,c:T.pLL},
                ].map(m=>(
                  <div key={m.l} style={{textAlign:"center"}}>
                    <div style={{fontFamily:T.mono,fontSize:14,fontWeight:700,color:m.c,lineHeight:1,letterSpacing:"-.3px"}}>{m.v}</div>
                    <div style={{fontSize:9,color:T.t3,textTransform:"uppercase",letterSpacing:".9px",marginTop:3}}>{m.l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tab row */}
            <div style={{display:"flex",borderTop:`1px solid ${T.b1}`}}>
              {TABS.map(t=>(
                <button key={t.id} onClick={()=>setTab(t.id)}
                  className={`tab${tab===t.id?" on":""}`}>
                  <span style={{fontFamily:T.mono,fontSize:14,
                    color:tab===t.id?T.p:T.t3,transition:"color .15s"}}>
                    {t.icon}
                  </span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* ══════════ CONTENT ══════════ */}
        <main style={{flex:1,width:"100%",overflowY:"auto",overflowX:"hidden",position:"relative",zIndex:1}}>
          <div style={{maxWidth:1640,margin:"0 auto",padding:"24px 28px 64px"}}>
            {tab==="overview"   &&<OverviewTab    patients={patients} optimized={optimized} mc={mc}/>}
            {tab==="prediction" &&<PredictionTab  patients={patients}/>}
            {tab==="scheduling" &&<SchedulingTab  optimized={optimized} waitlist={waitlist}/>}
            {tab==="simulation" &&<SimulationTab/>}
            {tab==="analytics"  &&<AnalyticsTab   patients={patients}/>}
          </div>
        </main>
      </div>
    </>
  );
}