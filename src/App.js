import { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

// ─── SUPABASE ────────────────────────────────────────────────────────────────
const supabase = createClient(
  "https://bxxnjmottokudtjgigss.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4eG5qbW90dG9rdWR0amdpZ3NzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NzAyMzgsImV4cCI6MjA5MDU0NjIzOH0.NoIADiNmtaSJd67lAWLbQ49tPHa7KcAu4VBLcAY5kgk"
);

// ─── THEME ───────────────────────────────────────────────────────────────────
const C = {
  bg:"#090909", surface:"#101010", card:"#151515",
  border:"rgba(255,255,255,0.06)", borderGold:"rgba(201,168,76,0.35)",
  gold:"#C9A84C", goldLight:"#E2C97E",
  red:"#C0392B", redLight:"#E05A4E", redBg:"rgba(192,57,43,0.1)",
  green:"#27AE60", greenLight:"#2ECC71", greenDim:"rgba(39,174,96,0.1)",
  amber:"#E67E22", amberBg:"rgba(230,126,34,0.1)",
  blue:"#2980B9", blueDim:"rgba(41,128,185,0.1)",
  text:"#EEEAE2", textMid:"#7A7670", textDim:"#3A3835",
  mono:"'Courier New', monospace", sans:"'Helvetica Neue', Arial, sans-serif",
};

// ─── AUTH ────────────────────────────────────────────────────────────────────
const USERS = [
  { username:"ahmed",   password:"jmf-admin-2026",  role:"admin",      name:"Ahmed (AJ)",         initials:"AJ", individualId:1 },
  { username:"nazila",  password:"nazila-2026",      role:"individual", name:"Nazila Isgandarova", initials:"NI", individualId:2 },
  { username:"yasin",   password:"yasin-2026",       role:"individual", name:"Yasin Majidov",      initials:"YM", individualId:3 },
  { username:"maryam",  password:"maryam-2026",      role:"individual", name:"Maryam Majidova",    initials:"MM", individualId:4 },
  { username:"akbar",   password:"akbar-2026",       role:"individual", name:"Akbar Majidov",      initials:"AM", individualId:5 },
];

// ─── DEFAULT DATA ─────────────────────────────────────────────────────────────
const DEFAULT = {
  properties: [
    { id:1, name:"27 Roytec Rd.",     status:"STRONG", purchase:750000,  market:2000000, mortgage:730000,  monthlyPayment:3200,  monthlyTax:0,    rentalIncome:0, tenant:"No tenant on file", lender:"TD Bank",        rate:"6.0%",   rateType:"Variable / Floating",   maturity:"TBC",         amort:"",                     originalBalance:730000,  notes:"Crown jewel. $1.27M unrealized gain. Confirm TD renewal date." },
    { id:2, name:"3705 Farr Ave.",    status:"STRONG", purchase:250000,  market:1200000, mortgage:0,       monthlyPayment:0,     monthlyTax:0,    rentalIncome:0, tenant:"No tenant on file", lender:"None",           rate:"N/A",    rateType:"Mortgage-free",          maturity:"N/A",         amort:"",                     originalBalance:0,       notes:"Completely mortgage-free. Pure equity." },
    { id:3, name:"121 Milky Way",     status:"WATCH",  purchase:3079729, market:2850000, mortgage:1826927, monthlyPayment:15013, monthlyTax:905,  rentalIncome:0, tenant:"No tenant on file", lender:"Equitable Bank", rate:"7.95%",  rateType:"12 Month Fixed Open",   maturity:"Dec 1, 2026", amort:"286 months remaining", originalBalance:2000000, notes:"Market below purchase. Fixed Open — can refinance without penalty." },
    { id:4, name:"51 Ahchie Crt.",    status:"RISK",   purchase:2119105, market:1750000, mortgage:1533355, monthlyPayment:9339,  monthlyTax:1235, rentalIncome:0, tenant:"No tenant on file", lender:"Equitable Bank", rate:"P+0.14%",rateType:"36 Month ARM Closed",   maturity:"Mar 1, 2029", amort:"337 months remaining", originalBalance:1553670, notes:"Variable rate ARM. Market significantly below purchase." },
    { id:5, name:"4 New Seabury Dr.", status:"WATCH",  purchase:349000,  market:958800,  mortgage:895992,  monthlyPayment:5979,  monthlyTax:374,  rentalIncome:0, tenant:"No tenant on file", lender:"Equitable Bank", rate:"5.94%",  rateType:"60 Month Fixed Closed", maturity:"Dec 1, 2029", amort:"312 months remaining", originalBalance:960000,  notes:"Locked in at 5.94% until Dec 2029. Thin equity." },
  ],
  individuals: [
    { id:1, name:"Ahmed (AJ)",         initials:"AJ", cash:34770,  accounts:-1581, securities:46231, crypto:1459  },
    { id:2, name:"Nazila Isgandarova", initials:"NI", cash:47963,  accounts:0,     securities:0,     crypto:0     },
    { id:3, name:"Yasin Majidov",      initials:"YM", cash:750,    accounts:0,     securities:0,     crypto:0     },
    { id:4, name:"Maryam Majidova",    initials:"MM", cash:671,    accounts:0,     securities:0,     crypto:0     },
    { id:5, name:"Akbar Majidov",      initials:"AM", cash:-1575,  accounts:-1316, securities:0,     crypto:0     },
  ],
  businesses: [
    { id:1, name:"Kratos Moving Inc.", role:"Operating company", revenue:0, expenses:0, netProfit:0, cash:166000, debt:0, notes:"CEO: James Bond. Cash confirmed at $166K. Share P&L to unlock full analysis." },
    { id:2, name:"JMF Logistics",      role:"Operating company", revenue:0, expenses:0, netProfit:0, cash:0,      debt:0, notes:"Financials pending. Share monthly P&L to unlock full analysis." },
  ],
  cashflow: {
    income:[
      { label:"Kratos Moving Inc.",    amount:0, note:"Add monthly net profit" },
      { label:"JMF Logistics",         amount:0, note:"Add monthly net profit" },
      { label:"Rental income (total)", amount:0, note:"Update when tenants confirmed" },
      { label:"Other income",          amount:0, note:"" },
    ],
    obligations:[
      { label:"121 Milky Way (Equitable)",  amount:15013, note:"7.95% · Fixed Open · Dec 2026" },
      { label:"51 Ahchie Crt. (Equitable)", amount:9339,  note:"P+0.14% variable · Mar 2029" },
      { label:"4 New Seabury (Equitable)",  amount:5979,  note:"5.94% fixed · Dec 2029" },
      { label:"27 Roytec Rd. (TD)",         amount:3200,  note:"~6% floating" },
      { label:"TD Line of Credit",          amount:900,   note:"Interest est." },
      { label:"Student debt",               amount:350,   note:"Est." },
      { label:"Family support (avg)",       amount:8000,  note:"2025 monthly avg" },
      { label:"Personal lifestyle",         amount:5000,  note:"Excl. RE obligations" },
    ],
  },
  nwHistory:[
    {m:"Apr '25",nw:3960880,liq:356362},
    {m:"Jun '25",nw:3952659,liq:334364},
    {m:"Jul '25",nw:3992864,liq:357881},
    {m:"Aug '25",nw:3958053,liq:336729},
    {m:"Sep '25",nw:3637758,liq:282280},
    {m:"Oct '25",nw:3538633,liq:238388},
    {m:"Nov '25",nw:3538614,liq:178728},
    {m:"Jan '26",nw:3632436,liq:217326},
  ],
  lastUpdated: "March 31, 2026",
};

// ─── FORMATTERS ──────────────────────────────────────────────────────────────
const $K = n => { if(n==null)return"—"; const a=Math.abs(n),s=n<0?"-":""; return a>=1e6?`${s}$${(a/1e6).toFixed(2)}M`:a>=1e3?`${s}$${(a/1e3).toFixed(0)}K`:`${s}$${a.toFixed(0)}`; };
const $F = (n,d=0) => n==null?"—":new Intl.NumberFormat("en-CA",{style:"currency",currency:"CAD",maximumFractionDigits:d}).format(n);

// ─── SUPABASE HELPERS ─────────────────────────────────────────────────────────
async function loadFromDB() {
  const { data, error } = await supabase.from("dashboard_data").select("*");
  if (error || !data || data.length === 0) return null;
  const result = {};
  data.forEach(row => { result[row.key] = row.value; });
  const isEmpty = !result.individuals || result.individuals.length === 0;
  return isEmpty ? null : result;
}

async function saveToDB(key, value) {
  await supabase.from("dashboard_data").upsert({ key, value, updated_at: new Date().toISOString() });
}

// ─── SHARED COMPONENTS ───────────────────────────────────────────────────────
function SL({children,color}){return <div style={{fontSize:10,letterSpacing:"0.14em",textTransform:"uppercase",color:color||C.textDim,marginBottom:10,fontFamily:C.sans}}>{children}</div>;}
function Card({children,style}){return <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:20,...style}}>{children}</div>;}
function DR({label,children,last}){
  return(
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:last?"none":`1px solid ${C.border}`,gap:8}}>
      <span style={{fontSize:12,color:C.textMid,flexShrink:0}}>{label}</span>
      <span style={{fontSize:13,fontFamily:C.mono,textAlign:"right"}}>{children}</span>
    </div>
  );
}
function Badge({status}){
  const m={STRONG:{bg:"rgba(46,204,113,0.12)",c:"#2ECC71",b:"rgba(46,204,113,0.25)"},WATCH:{bg:"rgba(230,126,34,0.12)",c:"#E67E22",b:"rgba(230,126,34,0.25)"},RISK:{bg:"rgba(192,57,43,0.12)",c:"#E05A4E",b:"rgba(192,57,43,0.25)"}};
  const s=m[status]||m.WATCH;
  return <span style={{background:s.bg,color:s.c,border:`1px solid ${s.b}`,borderRadius:3,fontSize:9,fontWeight:700,padding:"2px 7px",letterSpacing:"0.1em"}}>{status}</span>;
}
function EditCell({value,onChange,locked}){
  const [editing,setEditing]=useState(false);
  const [v,setV]=useState(value);
  if(locked)return <span style={{color:C.textMid,fontFamily:C.mono,fontSize:13}}>{value<0?"-":""}${Math.abs(value).toLocaleString("en-CA")}</span>;
  if(editing)return(
    <input autoFocus type="number" value={v}
      onChange={e=>setV(e.target.value)}
      onBlur={()=>{onChange(Number(v));setEditing(false);}}
      onKeyDown={e=>{if(e.key==="Enter"){onChange(Number(v));setEditing(false);}}}
      style={{background:"rgba(201,168,76,0.08)",border:`1px solid ${C.gold}`,borderRadius:4,color:C.gold,padding:"2px 8px",width:100,fontSize:13,fontFamily:C.mono,outline:"none"}}
    />
  );
  return(
    <span onClick={()=>{setV(value);setEditing(true);}} title="Click to edit"
      style={{cursor:"pointer",color:value<0?C.redLight:C.goldLight,fontFamily:C.mono,fontSize:13,borderBottom:`1px dashed ${C.textDim}`}}>
      {value<0?"-":""}${Math.abs(value).toLocaleString("en-CA")}
    </span>
  );
}

// ─── SAVED INDICATOR ─────────────────────────────────────────────────────────
function SavedBadge({saved}){
  return saved?(
    <span style={{fontSize:10,color:C.greenLight,background:C.greenDim,border:`1px solid rgba(39,174,96,0.25)`,borderRadius:4,padding:"2px 8px",fontFamily:C.sans,marginLeft:8}}>
      ✓ Saved
    </span>
  ):null;
}

// ─── LOGIN SCREEN ─────────────────────────────────────────────────────────────
function LoginScreen({onLogin}){
  const [username,setUsername]=useState("");
  const [password,setPassword]=useState("");
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(false);
  const handleLogin=()=>{
    setLoading(true);setError("");
    setTimeout(()=>{
      const user=USERS.find(u=>u.username===username.toLowerCase().trim()&&u.password===password);
      if(user){onLogin(user);}else{setError("Invalid username or password.");setLoading(false);}
    },600);
  };
  const inp={width:"100%",padding:"12px 16px",background:"#1A1A1A",border:`1px solid ${C.border}`,borderRadius:8,color:C.text,fontSize:14,fontFamily:C.sans,outline:"none",boxSizing:"border-box"};
  return(
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:C.sans,padding:24}}>
      <div style={{marginBottom:40,textAlign:"center"}}>
        <div style={{fontSize:32,fontWeight:800,color:C.gold,letterSpacing:"0.15em",marginBottom:8}}>JMF</div>
        <div style={{fontSize:12,color:C.textDim,letterSpacing:"0.12em",textTransform:"uppercase"}}>Family Office · Command Center</div>
      </div>
      <div style={{width:"100%",maxWidth:380,background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:32}}>
        <div style={{fontSize:18,fontWeight:600,color:C.text,marginBottom:6}}>Sign in</div>
        <div style={{fontSize:12,color:C.textMid,marginBottom:28}}>Enter your credentials to access the dashboard.</div>
        <div style={{marginBottom:16}}>
          <label style={{fontSize:11,color:C.textDim,letterSpacing:"0.1em",textTransform:"uppercase",display:"block",marginBottom:8}}>Username</label>
          <input type="text" placeholder="e.g. ahmed" value={username} onChange={e=>setUsername(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")handleLogin();}} style={inp}/>
        </div>
        <div style={{marginBottom:24}}>
          <label style={{fontSize:11,color:C.textDim,letterSpacing:"0.1em",textTransform:"uppercase",display:"block",marginBottom:8}}>Password</label>
          <input type="password" placeholder="••••••••••" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")handleLogin();}} style={inp}/>
        </div>
        {error&&<div style={{background:C.redBg,border:`1px solid rgba(192,57,43,0.25)`,borderRadius:6,padding:"10px 14px",marginBottom:16,fontSize:12,color:C.redLight}}>{error}</div>}
        <button onClick={handleLogin} disabled={loading} style={{width:"100%",padding:"13px",background:C.gold,border:"none",borderRadius:8,color:"#0A0A0A",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:C.sans,opacity:loading?0.7:1}}>
          {loading?"Signing in…":"Sign In"}
        </button>
        <div style={{marginTop:24,padding:"14px 16px",background:"rgba(255,255,255,0.02)",borderRadius:8,border:`1px solid ${C.border}`}}>
          <div style={{fontSize:10,color:C.textDim,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:10}}>Access Levels</div>
          {[{role:"Admin",desc:"Full access · edit everything",col:C.gold},{role:"Member",desc:"Edit own numbers only",col:C.greenLight}].map((r,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:i===0?8:0}}>
              <span style={{fontSize:9,fontWeight:700,color:r.col,background:`${r.col}15`,border:`1px solid ${r.col}30`,borderRadius:3,padding:"2px 7px",flexShrink:0}}>{r.role.toUpperCase()}</span>
              <span style={{fontSize:11,color:C.textDim}}>{r.desc}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{marginTop:24,fontSize:11,color:C.textDim}}>JMF Group · Private &amp; Confidential</div>
    </div>
  );
}

// ─── MEMBER VIEW ─────────────────────────────────────────────────────────────
function MemberView({user,data,onUpdate,onLogout}){
  const [saved,setSaved]=useState(false);
  const f=data.individuals.find(x=>x.id===user.individualId);
  if(!f)return null;
  const net=f.cash+f.accounts+f.securities+f.crypto;
  const col=net>10000?C.gold:net>0?C.greenLight:C.redLight;
  const totalNW=data.properties.reduce((s,p)=>s+(p.market-p.mortgage),0)+data.individuals.reduce((s,x)=>s+Math.max(0,x.cash+x.accounts+x.securities+x.crypto),0)+data.businesses.reduce((s,b)=>s+b.cash,0);

  const handleUpdate=(id,field,val)=>{
    onUpdate(id,field,val);
    setSaved(true);
    setTimeout(()=>setSaved(false),3000);
  };

  return(
    <div style={{background:C.bg,minHeight:"100vh",fontFamily:C.sans,color:C.text}}>
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"0 24px",display:"flex",alignItems:"center",justifyContent:"space-between",height:52}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:16,fontWeight:800,color:C.gold,letterSpacing:"0.15em"}}>JMF</span>
          <span style={{width:1,height:18,background:C.border,display:"inline-block"}}/>
          <span style={{fontSize:11,color:C.textMid}}>My Financial Snapshot</span>
          <SavedBadge saved={saved}/>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          <span style={{fontSize:12,color:C.textMid}}>{f.name}</span>
          <button onClick={onLogout} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:6,color:C.textMid,fontSize:11,padding:"5px 12px",cursor:"pointer",fontFamily:C.sans}}>Sign out</button>
        </div>
      </div>
      <div style={{padding:24,maxWidth:600,margin:"0 auto"}}>
        <div style={{textAlign:"center",padding:"32px 0 24px"}}>
          <div style={{fontSize:10,color:C.textDim,letterSpacing:"0.2em",textTransform:"uppercase",marginBottom:8}}>Your Net Worth</div>
          <div style={{fontSize:52,fontWeight:800,fontFamily:C.mono,color:col,letterSpacing:-1}}>{$K(net)}</div>
          <div style={{fontSize:12,color:C.textDim,marginTop:8}}>Last updated: {data.lastUpdated}</div>
        </div>
        <Card style={{marginBottom:20}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
            <div style={{width:44,height:44,borderRadius:"50%",background:`${col}15`,border:`1.5px solid ${col}35`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:700,color:col}}>{f.initials}</div>
            <div>
              <div style={{fontSize:16,fontWeight:600,color:C.text}}>{f.name}</div>
              <div style={{fontSize:12,color:C.textMid}}>Click any value to update · changes save automatically</div>
            </div>
          </div>
          {[{l:"Cash / Vault",fi:"cash",desc:"Physical cash or savings"},{l:"Accounts (net)",fi:"accounts",desc:"Bank accounts minus credit cards"},{l:"Securities",fi:"securities",desc:"TFSA, investments, Wealthsimple"},{l:"Crypto",fi:"crypto",desc:"Crypto portfolio market value"}].map(row=>(
            <div key={row.fi} style={{padding:"12px 0",borderBottom:`1px solid ${C.border}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontSize:13,color:C.text,marginBottom:2}}>{row.l}</div>
                  <div style={{fontSize:11,color:C.textDim}}>{row.desc}</div>
                </div>
                <EditCell value={f[row.fi]} onChange={v=>handleUpdate(f.id,row.fi,v)}/>
              </div>
            </div>
          ))}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 0 0"}}>
            <span style={{fontSize:14,fontWeight:600,color:C.textMid}}>Total</span>
            <span style={{fontSize:22,fontFamily:C.mono,fontWeight:700,color:col}}>{$K(net)}</span>
          </div>
        </Card>
        <Card>
          <SL>JMF Group Snapshot</SL>
          <div style={{fontSize:12,color:C.textMid,lineHeight:1.7,marginBottom:14}}>Summary view only. Contact Ahmed for full group financials.</div>
          {[{label:"Group Net Worth",val:$K(totalNW)},{label:"Properties",val:`${data.properties.length} holdings`},{label:"Business entities",val:`${data.businesses.length} companies`}].map((r,i)=>(
            <DR key={i} label={r.label} last={i===2}><span style={{color:C.text}}>{r.val}</span></DR>
          ))}
        </Card>
      </div>
    </div>
  );
}

// ─── PROPERTY CARD ───────────────────────────────────────────────────────────
function PropCard({prop,onUpdate,isAdmin}){
  const [open,setOpen]=useState(false);
  const equity=prop.market-prop.mortgage;
  const ltv=prop.mortgage>0?(prop.mortgage/prop.market*100).toFixed(1):"0";
  const gainAmt=prop.market-prop.purchase;
  const gainPct=((gainAmt/prop.purchase)*100).toFixed(1);
  const cf=prop.rentalIncome-prop.monthlyPayment;
  const eqCol=equity>500000?C.gold:equity>100000?C.amber:C.redLight;
  return(
    <div style={{background:C.card,border:`1px solid ${open?C.borderGold:C.border}`,borderRadius:10,overflow:"hidden",marginBottom:10,transition:"border 0.2s"}}>
      <div onClick={()=>setOpen(o=>!o)} style={{padding:"16px 20px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",background:open?"rgba(201,168,76,0.03)":"transparent"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <Badge status={prop.status}/>
          <span style={{fontSize:15,fontWeight:600,color:C.text}}>{prop.name}</span>
          <span style={{fontSize:10,color:C.textDim}}>{prop.lender} · {prop.rate}</span>
          {prop.maturity!=="N/A"&&prop.maturity!=="TBC"&&prop.maturity&&<span style={{fontSize:10,color:C.amber,background:C.amberBg,padding:"2px 7px",borderRadius:3}}>Renews {prop.maturity}</span>}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:20}}>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:10,color:C.textDim,marginBottom:2}}>Equity</div>
            <div style={{fontSize:19,fontFamily:C.mono,fontWeight:700,color:eqCol}}>{$K(equity)}</div>
          </div>
          <span style={{color:open?C.gold:C.textDim,fontSize:12}}>{open?"▲":"▼"}</span>
        </div>
      </div>
      {open&&(
        <div style={{borderTop:`1px solid ${C.border}`,padding:20}}>
          <p style={{fontSize:12,color:C.textMid,fontStyle:"italic",lineHeight:1.7,marginBottom:18}}>{prop.notes}</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:20}}>
            <div>
              <SL>Valuation</SL>
              <DR label="Purchase price"><span style={{color:C.textMid}}>{$F(prop.purchase)}</span></DR>
              <DR label="Market value"><EditCell value={prop.market} onChange={v=>onUpdate("market",v)} locked={!isAdmin}/></DR>
              <DR label="Mortgage balance"><span style={{color:C.redLight,fontFamily:C.mono}}>{$F(prop.mortgage)}</span></DR>
              <DR label="Equity"><span style={{color:eqCol,fontWeight:700}}>{$F(equity)}</span></DR>
              <DR label="vs purchase" last><span style={{color:gainAmt>=0?C.greenLight:C.redLight}}>{gainAmt>=0?"+":""}{gainPct}% ({$K(gainAmt)})</span></DR>
            </div>
            <div>
              <SL>Mortgage</SL>
              <DR label="Lender"><span style={{color:C.text}}>{prop.lender}</span></DR>
              <DR label="Rate"><span style={{color:C.amber}}>{prop.rate}</span></DR>
              <DR label="Type"><span style={{color:C.text,fontSize:12}}>{prop.rateType}</span></DR>
              <DR label="Maturity"><span style={{color:C.text}}>{prop.maturity}</span></DR>
              <DR label="Monthly P+I"><EditCell value={prop.monthlyPayment} onChange={v=>onUpdate("monthlyPayment",v)} locked={!isAdmin}/></DR>
              <DR label="LTV" last><span style={{color:parseFloat(ltv)>80?C.redLight:parseFloat(ltv)>65?C.amber:C.greenLight,fontWeight:700}}>{ltv}%</span></DR>
            </div>
            <div>
              <SL>Rental</SL>
              <DR label="Monthly rent"><EditCell value={prop.rentalIncome} onChange={v=>onUpdate("rentalIncome",v)} locked={!isAdmin}/></DR>
              <DR label="Tenant"><span style={{color:C.textMid,fontSize:12}}>{prop.tenant}</span></DR>
              <DR label="Net cash flow"><span style={{color:cf>=0?C.greenLight:C.redLight,fontWeight:700}}>{cf>=0?"+":""}{$F(cf)}/mo</span></DR>
              <DR label="Amort" last><span style={{color:C.textMid,fontSize:12}}>{prop.amort||"—"}</span></DR>
            </div>
          </div>
          <div style={{display:"flex",gap:10,marginTop:16}}>
            {[{label:"Annual mortgage",val:$F(prop.monthlyPayment*12),col:C.redLight,bg:C.redBg},{label:"Annual rental",val:$F(prop.rentalIncome*12),col:C.greenLight,bg:C.greenDim},{label:"Annual net",val:$F((prop.rentalIncome-prop.monthlyPayment)*12),col:cf>=0?C.greenLight:C.redLight,bg:cf>=0?C.greenDim:C.redBg}].map((chip,i)=>(
              <div key={i} style={{background:chip.bg,borderRadius:6,padding:"10px 14px",flex:1,textAlign:"center"}}>
                <div style={{fontSize:9,color:C.textDim,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:4}}>{chip.label}</div>
                <div style={{fontSize:15,fontFamily:C.mono,fontWeight:700,color:chip.col}}>{chip.val}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BizCard({biz}){
  const [open,setOpen]=useState(false);
  return(
    <div style={{background:C.card,border:`1px solid ${open?C.borderGold:C.border}`,borderRadius:10,overflow:"hidden",marginBottom:10}}>
      <div onClick={()=>setOpen(o=>!o)} style={{padding:"16px 20px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",background:open?"rgba(201,168,76,0.03)":"transparent"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <span style={{background:C.blueDim,color:C.blue,border:`1px solid rgba(41,128,185,0.25)`,borderRadius:3,fontSize:9,fontWeight:700,padding:"2px 7px",letterSpacing:"0.1em"}}>ENTITY</span>
          <div>
            <div style={{fontSize:15,fontWeight:600,color:C.text}}>{biz.name}</div>
            <div style={{fontSize:11,color:C.textMid,marginTop:1}}>{biz.role}</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:20}}>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:10,color:C.textDim,marginBottom:2}}>Net profit / mo</div>
            <div style={{fontSize:19,fontFamily:C.mono,fontWeight:700,color:biz.netProfit>0?C.gold:C.amber}}>{biz.netProfit>0?$K(biz.netProfit):"Pending"}</div>
          </div>
          <span style={{color:open?C.gold:C.textDim,fontSize:12}}>{open?"▲":"▼"}</span>
        </div>
      </div>
      {open&&(
        <div style={{borderTop:`1px solid ${C.border}`,padding:20}}>
          <p style={{fontSize:12,color:C.textMid,fontStyle:"italic",lineHeight:1.7,marginBottom:16}}>{biz.notes}</p>
          <div style={{background:C.amberBg,border:`1px solid rgba(230,126,34,0.2)`,borderRadius:8,padding:"16px 20px",textAlign:"center"}}>
            <div style={{fontSize:12,color:C.amber,marginBottom:6}}>Financial data not yet loaded</div>
            <div style={{fontSize:11,color:C.textMid,lineHeight:1.7}}>Share monthly revenue, expenses and net profit to unlock full analysis.</div>
          </div>
          {biz.cash>0&&(
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:C.greenDim,border:`1px solid rgba(39,174,96,0.2)`,borderRadius:8,padding:"12px 16px",marginTop:10}}>
              <span style={{fontSize:13,color:C.textMid}}>Cash on hand (confirmed)</span>
              <span style={{fontSize:18,fontFamily:C.mono,fontWeight:700,color:C.greenLight}}>{$F(biz.cash)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── ADMIN DASHBOARD ─────────────────────────────────────────────────────────
function AdminDashboard({user,data,setData,onLogout}){
  const [tab,setTab]=useState("overview");
  const [saved,setSaved]=useState(false);

  const showSaved=()=>{ setSaved(true); setTimeout(()=>setSaved(false),3000); };

  const indNet=f=>f.cash+f.accounts+f.securities+f.crypto;
  const totalREEquity=data.properties.reduce((s,p)=>s+(p.market-p.mortgage),0);
  const totalREValue=data.properties.reduce((s,p)=>s+p.market,0);
  const totalREDebt=data.properties.reduce((s,p)=>s+p.mortgage,0);
  const totalPersonal=data.individuals.reduce((s,f)=>s+Math.max(0,indNet(f)),0);
  const totalBizCash=data.businesses.reduce((s,b)=>s+b.cash,0);
  const totalNW=totalREEquity+totalPersonal+totalBizCash;
  const totalIncome=data.cashflow.income.reduce((s,i)=>s+i.amount,0);
  const totalOblig=data.cashflow.obligations.reduce((s,o)=>s+o.amount,0);
  const gap=totalIncome-totalOblig;
  const totalMtgOut=data.properties.reduce((s,p)=>s+p.monthlyPayment,0);

  const updProp=useCallback((id,f,v)=>{
    setData(d=>{
      const props=d.properties.map(p=>p.id===id?{...p,[f]:v}:p);
      saveToDB("properties",props);
      showSaved();
      return{...d,properties:props};
    });
  },[]);

  const updInd=useCallback((id,f,v)=>{
    setData(d=>{
      const inds=d.individuals.map(x=>x.id===id?{...x,[f]:v}:x);
      saveToDB("individuals",inds);
      showSaved();
      return{...d,individuals:inds};
    });
  },[]);

  const updCF=useCallback((type,idx,v)=>{
    setData(d=>{
      const a=[...d.cashflow[type]];
      a[idx]={...a[idx],amount:Number(v)};
      const cf={...d.cashflow,[type]:a};
      saveToDB("cashflow",cf);
      showSaved();
      return{...d,cashflow:cf};
    });
  },[]);

  const TABS=[{id:"overview",label:"Overview"},{id:"realestate",label:"Real Estate"},{id:"individuals",label:"Individuals"},{id:"businesses",label:"Businesses"},{id:"cashflow",label:"Cash Flow"}];

  return(
    <div style={{background:C.bg,minHeight:"100vh",color:C.text,fontFamily:C.sans}}>
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"0 24px",display:"flex",alignItems:"center",justifyContent:"space-between",height:52,position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:16,fontWeight:800,color:C.gold,letterSpacing:"0.15em"}}>JMF</span>
          <span style={{width:1,height:18,background:C.border,display:"inline-block"}}/>
          <span style={{fontSize:11,color:C.textMid,letterSpacing:"0.07em"}}>Family Office · Command Center</span>
          <SavedBadge saved={saved}/>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          <span style={{fontSize:9,fontWeight:700,color:C.gold,background:"rgba(201,168,76,0.12)",border:`1px solid rgba(201,168,76,0.25)`,borderRadius:3,padding:"2px 8px",letterSpacing:"0.08em"}}>ADMIN</span>
          <span style={{fontSize:12,color:C.textMid}}>{user.name}</span>
          <button onClick={onLogout} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:6,color:C.textMid,fontSize:11,padding:"5px 12px",cursor:"pointer",fontFamily:C.sans}}>Sign out</button>
        </div>
      </div>

      <div style={{background:`linear-gradient(160deg,${C.surface} 0%,${C.bg} 100%)`,padding:"32px 24px 22px",textAlign:"center",borderBottom:`1px solid ${C.border}`}}>
        <div style={{fontSize:10,color:C.textDim,letterSpacing:"0.22em",textTransform:"uppercase",marginBottom:10}}>JMF Consolidated Net Worth</div>
        <div style={{fontSize:56,fontWeight:800,fontFamily:C.mono,color:C.gold,letterSpacing:-2,lineHeight:1}}>{$K(totalNW)}</div>
        <div style={{fontSize:12,color:C.textDim,marginTop:10}}>Real estate equity + personal + business cash · {data.lastUpdated}</div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))",borderBottom:`1px solid ${C.border}`}}>
        {[
          {label:"RE Equity",val:$K(totalREEquity),sub:`${((totalREEquity/totalNW)*100).toFixed(0)}% of net worth`,col:C.gold},
          {label:"Personal Liquid",val:$K(totalPersonal),sub:"All individuals",col:C.greenLight},
          {label:"Business Cash",val:$K(totalBizCash),sub:"Kratos + JMF",col:C.blue},
          {label:"Monthly Mortgages",val:$K(totalMtgOut),sub:`$${(totalMtgOut*12/1000).toFixed(0)}K/yr`,col:C.redLight},
          {label:"Monthly Gap",val:totalIncome===0?"Add income":$K(gap),sub:totalIncome===0?"Income fields empty":gap<0?"Deficit":"Surplus",col:totalIncome===0?C.amber:gap<0?C.redLight:C.greenLight},
        ].map((k,i)=>(
          <div key={i} style={{padding:"14px 16px",borderRight:i<4?`1px solid ${C.border}`:"none",background:C.surface}}>
            <div style={{fontSize:9,color:C.textDim,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:5}}>{k.label}</div>
            <div style={{fontSize:19,fontWeight:700,fontFamily:C.mono,color:k.col}}>{k.val}</div>
            <div style={{fontSize:10,color:C.textDim,marginTop:3}}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div style={{padding:"0 24px",display:"flex",gap:2,borderBottom:`1px solid ${C.border}`,background:C.surface}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"9px 18px 11px",fontSize:11,fontWeight:600,letterSpacing:"0.09em",textTransform:"uppercase",border:"none",cursor:"pointer",fontFamily:C.sans,borderRadius:"6px 6px 0 0",background:tab===t.id?C.bg:"transparent",color:tab===t.id?C.gold:C.textMid,borderBottom:tab===t.id?`2px solid ${C.gold}`:"2px solid transparent",transition:"all 0.15s"}}>{t.label}</button>
        ))}
      </div>

      <div style={{padding:24,maxWidth:1120,margin:"0 auto"}}>

        {tab==="overview"&&(
          <div style={{display:"grid",gridTemplateColumns:"minmax(0,1.55fr) minmax(0,1fr)",gap:20}}>
            <Card>
              <SL>Net Worth Trend</SL>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={data.nwHistory} margin={{right:8}}>
                  <XAxis dataKey="m" tick={{fill:C.textDim,fontSize:10}} axisLine={false} tickLine={false}/>
                  <YAxis tickFormatter={v=>`$${(v/1e6).toFixed(1)}M`} tick={{fill:C.textDim,fontSize:10}} axisLine={false} tickLine={false}/>
                  <Tooltip formatter={v=>[$K(v)]} contentStyle={{background:C.card,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,fontSize:12}}/>
                  <Line type="monotone" dataKey="nw" stroke={C.gold} strokeWidth={2} dot={{fill:C.gold,r:3}} name="Net Worth"/>
                  <Line type="monotone" dataKey="liq" stroke={C.greenLight} strokeWidth={1.5} strokeDasharray="4 3" dot={{fill:C.greenLight,r:2}} name="Liquid"/>
                </LineChart>
              </ResponsiveContainer>
            </Card>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <Card style={{flex:1}}>
                <SL>Wealth Breakdown</SL>
                {[{label:"Real Estate Equity",val:totalREEquity,col:C.gold},{label:"Personal Liquid",val:totalPersonal,col:C.greenLight},{label:"Business Cash",val:totalBizCash,col:C.blue},{label:"Securities (AJ)",val:46231,col:C.amber}].map((a,i)=>(
                  <div key={i} style={{marginBottom:11}}>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}>
                      <span style={{color:C.textMid}}>{a.label}</span>
                      <span style={{color:C.text,fontFamily:C.mono}}>{$K(a.val)}</span>
                    </div>
                    <div style={{height:3,background:"#1C1C1C",borderRadius:2}}>
                      <div style={{height:3,width:`${Math.max(2,(a.val/totalNW)*100)}%`,background:a.col,borderRadius:2}}/>
                    </div>
                  </div>
                ))}
              </Card>
              <div style={{background:C.redBg,border:"1px solid rgba(192,57,43,0.2)",borderRadius:10,padding:16}}>
                <SL color={C.redLight}>Concentration Risk</SL>
                <div style={{fontSize:24,fontFamily:C.mono,color:C.redLight,fontWeight:700}}>{((totalREEquity/totalNW)*100).toFixed(0)}%</div>
                <div style={{fontSize:11,color:C.textMid,marginTop:4,lineHeight:1.7}}>of net worth in real estate. Target: grow liquid above $500K.</div>
              </div>
            </div>
            <Card style={{gridColumn:"1 / -1"}}>
              <SL>Portfolio at a Glance</SL>
              <div style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))",gap:10,marginBottom:16}}>
                {data.properties.map(p=>{
                  const eq=p.market-p.mortgage;
                  return(
                    <div key={p.id} onClick={()=>setTab("realestate")} style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:14,cursor:"pointer"}} onMouseEnter={e=>e.currentTarget.style.borderColor=C.borderGold} onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
                      <div style={{fontSize:11,fontWeight:600,color:C.text,marginBottom:6,lineHeight:1.4}}>{p.name}</div>
                      <Badge status={p.status}/>
                      <div style={{fontSize:17,fontFamily:C.mono,fontWeight:700,marginTop:10,color:eq>500000?C.gold:eq>0?C.amber:C.redLight}}>{$K(eq)}</div>
                      <div style={{fontSize:10,color:C.textDim,marginTop:3}}>{p.rate}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{borderTop:`1px solid ${C.border}`,paddingTop:14}}>
                <SL>Business Entities</SL>
                <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10}}>
                  {data.businesses.map(b=>(
                    <div key={b.id} onClick={()=>setTab("businesses")} style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:14,cursor:"pointer"}} onMouseEnter={e=>e.currentTarget.style.borderColor="rgba(41,128,185,0.35)"} onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
                      <div style={{fontSize:12,fontWeight:600,color:C.text,marginBottom:6}}>{b.name}</div>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:11}}>
                        <span style={{color:C.textDim}}>Cash on hand</span>
                        <span style={{fontFamily:C.mono,color:C.greenLight}}>{$K(b.cash)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        )}

        {tab==="realestate"&&(
          <div>
            <Card style={{marginBottom:20}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))"}}>
                {[{label:"Portfolio Value",val:$K(totalREValue),col:C.text},{label:"Total Debt",val:$K(totalREDebt),col:C.redLight},{label:"Total Equity",val:$K(totalREEquity),col:C.gold},{label:"Monthly Mortgages",val:$K(totalMtgOut),col:C.redLight}].map((s,i)=>(
                  <div key={i} style={{textAlign:"center",padding:"6px 0",borderRight:i<3?`1px solid ${C.border}`:"none"}}>
                    <div style={{fontSize:9,color:C.textDim,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:5}}>{s.label}</div>
                    <div style={{fontSize:20,fontFamily:C.mono,fontWeight:700,color:s.col}}>{s.val}</div>
                  </div>
                ))}
              </div>
            </Card>
            <div style={{fontSize:11,color:C.textDim,marginBottom:14}}>Click any property to expand · Gold values are editable · Changes save automatically</div>
            {data.properties.map(p=><PropCard key={p.id} prop={p} onUpdate={(f,v)=>updProp(p.id,f,v)} isAdmin={true}/>)}
          </div>
        )}

        {tab==="individuals"&&(
          <div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:14,marginBottom:20}}>
              {data.individuals.map(f=>{
                const net=indNet(f);
                const col=net>10000?C.gold:net>0?C.greenLight:C.redLight;
                return(
                  <Card key={f.id}>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
                      <div style={{width:40,height:40,borderRadius:"50%",background:`${col}15`,border:`1.5px solid ${col}35`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:col,flexShrink:0}}>{f.initials}</div>
                      <div>
                        <div style={{fontSize:14,fontWeight:600,color:C.text}}>{f.name}</div>
                        <div style={{fontSize:19,fontFamily:C.mono,fontWeight:700,color:col}}>{$K(net)}</div>
                      </div>
                    </div>
                    {[{l:"Cash / Vault",fi:"cash"},{l:"Accounts (net)",fi:"accounts"},{l:"Securities",fi:"securities"},{l:"Crypto",fi:"crypto"}].map(row=>(
                      <div key={row.fi} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:`1px solid ${C.border}`,fontSize:12}}>
                        <span style={{color:C.textMid}}>{row.l}</span>
                        <EditCell value={f[row.fi]} onChange={v=>updInd(f.id,row.fi,v)} locked={false}/>
                      </div>
                    ))}
                  </Card>
                );
              })}
            </div>
            <Card>
              <SL>2025 Family Support Flow — from Ahmed</SL>
              <ResponsiveContainer width="100%" height={130}>
                <BarChart layout="vertical" data={[{n:"Nazila",v:179900},{n:"Akbar",v:73700},{n:"Younger",v:36500},{n:"Mustafa",v:16800}]}>
                  <XAxis type="number" tickFormatter={v=>`$${(v/1000).toFixed(0)}K`} tick={{fill:C.textDim,fontSize:10}} axisLine={false} tickLine={false}/>
                  <YAxis type="category" dataKey="n" tick={{fill:C.textMid,fontSize:12}} axisLine={false} tickLine={false} width={58}/>
                  <Tooltip formatter={v=>[$F(v)]} contentStyle={{background:C.card,border:`1px solid ${C.border}`,fontSize:12,color:C.text}}/>
                  <Bar dataKey="v" radius={[0,4,4,0]}>{[C.gold,C.amber,C.textMid,C.textDim].map((c,i)=><Cell key={i} fill={c}/>)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {tab==="businesses"&&(
          <div>
            <Card style={{marginBottom:20}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))"}}>
                {[{label:"Total Business Cash",val:$K(totalBizCash),col:C.greenLight},{label:"Combined Profit/mo",val:"Pending",col:C.amber},{label:"Entities",val:"2",col:C.text}].map((s,i)=>(
                  <div key={i} style={{textAlign:"center",padding:"6px 0",borderRight:i<2?`1px solid ${C.border}`:"none"}}>
                    <div style={{fontSize:9,color:C.textDim,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:5}}>{s.label}</div>
                    <div style={{fontSize:20,fontFamily:C.mono,fontWeight:700,color:s.col}}>{s.val}</div>
                  </div>
                ))}
              </div>
            </Card>
            {data.businesses.map(b=><BizCard key={b.id} biz={b}/>)}
          </div>
        )}

        {tab==="cashflow"&&(
          <div>
            <div style={{borderRadius:10,padding:"24px 28px",marginBottom:20,textAlign:"center",background:gap>=0?C.greenDim:C.redBg,border:`1px solid ${gap>=0?"rgba(46,204,113,0.2)":"rgba(192,57,43,0.2)"}`}}>
              <div style={{fontSize:10,color:C.textMid,letterSpacing:"0.16em",textTransform:"uppercase",marginBottom:8}}>Monthly Cash Flow Position</div>
              <div style={{fontSize:48,fontFamily:C.mono,fontWeight:800,color:gap>=0?C.greenLight:C.redLight}}>{gap>=0?"+":""}{$F(gap)}</div>
              <div style={{fontSize:13,color:C.textMid,marginTop:10}}>{totalIncome===0?"Add Kratos Moving net profit to see your true position.":gap<0?`Need ${$F(Math.abs(gap))} more/month to break even.`:`${$F(gap)}/month surplus.`}</div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:20}}>
              <Card>
                <div style={{fontSize:11,color:C.greenLight,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:14}}>↑ Monthly Income</div>
                {data.cashflow.income.map((item,i)=>(
                  <div key={i} style={{padding:"9px 0",borderBottom:`1px solid ${C.border}`}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span style={{fontSize:13,color:C.text}}>{item.label}</span>
                      <EditCell value={item.amount} onChange={v=>updCF("income",i,v)}/>
                    </div>
                    {item.note&&<div style={{fontSize:10,color:C.amber,marginTop:3}}>{item.note}</div>}
                  </div>
                ))}
                <div style={{display:"flex",justifyContent:"space-between",padding:"12px 0 0",fontWeight:700}}>
                  <span style={{color:C.textMid}}>Total in</span>
                  <span style={{fontFamily:C.mono,fontSize:15,color:C.greenLight}}>{$F(totalIncome)}</span>
                </div>
              </Card>
              <Card>
                <div style={{fontSize:11,color:C.redLight,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:14}}>↓ Monthly Obligations</div>
                {data.cashflow.obligations.map((item,i)=>(
                  <div key={i} style={{padding:"9px 0",borderBottom:`1px solid ${C.border}`}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span style={{fontSize:13,color:C.text}}>{item.label}</span>
                      <EditCell value={item.amount} onChange={v=>updCF("obligations",i,v)}/>
                    </div>
                    {item.note&&<div style={{fontSize:10,color:C.textDim,marginTop:3}}>{item.note}</div>}
                  </div>
                ))}
                <div style={{display:"flex",justifyContent:"space-between",padding:"12px 0 0",fontWeight:700}}>
                  <span style={{color:C.textMid}}>Total out</span>
                  <span style={{fontFamily:C.mono,fontSize:15,color:C.redLight}}>{$F(totalOblig)}</span>
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function App(){
  const [currentUser,setCurrentUser]=useState(null);
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    loadFromDB().then(dbData=>{
      if(dbData){
        setData({...DEFAULT, ...dbData, nwHistory:DEFAULT.nwHistory, lastUpdated:DEFAULT.lastUpdated});
      } else {
        // First time — save defaults to DB
        saveToDB("individuals", DEFAULT.individuals);
        saveToDB("properties",  DEFAULT.properties);
        saveToDB("businesses",  DEFAULT.businesses);
        saveToDB("cashflow",    DEFAULT.cashflow);
        setData(DEFAULT);
      }
      setLoading(false);
    });
  },[]);

  const updInd=(id,f,v)=>{
    setData(d=>{
      const inds=d.individuals.map(x=>x.id===id?{...x,[f]:v}:x);
      saveToDB("individuals",inds);
      return{...d,individuals:inds};
    });
  };

  const logout=()=>setCurrentUser(null);

  if(loading) return(
    <div style={{minHeight:"100vh",background:"#090909",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"'Helvetica Neue', Arial, sans-serif"}}>
      <div style={{fontSize:28,fontWeight:800,color:"#C9A84C",letterSpacing:"0.15em",marginBottom:16}}>JMF</div>
      <div style={{fontSize:12,color:"#3A3835",letterSpacing:"0.1em"}}>Loading...</div>
    </div>
  );

  if(!currentUser) return <LoginScreen onLogin={setCurrentUser}/>;
  if(currentUser.role==="individual") return <MemberView user={currentUser} data={data} onUpdate={updInd} onLogout={logout}/>;
  return <AdminDashboard user={currentUser} data={data} setData={setData} onLogout={logout}/>;
}