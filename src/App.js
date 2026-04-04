import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";

const supabase = createClient(
  "https://bxxnjmottokudtjgigss.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4eG5qbW90dG9rdWR0amdpZ3NzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NzAyMzgsImV4cCI6MjA5MDU0NjIzOH0.NoIADiNmtaSJd67lAWLbQ49tPHa7KcAu4VBLcAY5kgk"
);

const C = {
  bg:"#090909", surface:"#101010", card:"#151515",
  border:"rgba(255,255,255,0.06)", borderGold:"rgba(201,168,76,0.35)",
  gold:"#C9A84C", goldLight:"#E2C97E",
  red:"#C0392B", redLight:"#E05A4E", redBg:"rgba(192,57,43,0.1)",
  green:"#27AE60", greenLight:"#2ECC71", greenDim:"rgba(39,174,96,0.1)",
  amber:"#E67E22", amberBg:"rgba(230,126,34,0.1)",
  blue:"#2980B9", blueDim:"rgba(41,128,185,0.1)",
  purple:"#8E44AD", purpleDim:"rgba(142,68,173,0.1)",
  text:"#EEEAE2", textMid:"#7A7670", textDim:"#3A3835",
  mono:"'Courier New', monospace", sans:"'Helvetica Neue', Arial, sans-serif",
};

const USERS = [
  { username:"ahmed",  password:"jmf-admin-2026",  role:"admin",      name:"Ahmed (AJ)",         initials:"AJ", individualId:1 },
  { username:"nazila", password:"nazila-2026",      role:"individual", name:"Nazila Isgandarova", initials:"NI", individualId:2 },
  { username:"yasin",  password:"yasin-2026",       role:"individual", name:"Yasin Majidov",      initials:"YM", individualId:3 },
  { username:"maryam", password:"maryam-2026",      role:"individual", name:"Maryam Majidova",    initials:"MM", individualId:4 },
  { username:"akbar",  password:"akbar-2026",       role:"individual", name:"Akbar Majidov",      initials:"AM", individualId:5 },
];

// ─── REAL DATA — April 1, 2026 ───────────────────────────────────────────────
const DEFAULT = {
  lastUpdated: "April 1, 2026",

  // Ahmed personal: TD Chequing + TD Savings ONLY (business accounts removed)
  // Debts: TD VISA $200.10 + TD LOC $91,792.67 + AMEX Cobalt $6,466.62 + Student Debt $45,015
  individuals: [
    { id:1, name:"Ahmed (AJ)",         initials:"AJ",
      cash: 0,           // input via app — vault cash
      accounts: 1023,    // TD Chequing $998.85 + TD Savings $24.04
      debt: -143474,     // TD VISA + TD LOC + AMEX Cobalt + Student Debt
      securities: 46610, // market value Apr 1 2026
      crypto: 1466,      // market value Apr 1 2026
    },
    { id:2, name:"Nazila Isgandarova", initials:"NI", cash:0, accounts:47963, debt:-4383,  securities:0, crypto:0 },
    { id:3, name:"Yasin Majidov",      initials:"YM", cash:0, accounts:750,   debt:0,      securities:0, crypto:0 },
    { id:4, name:"Maryam Majidova",    initials:"MM", cash:0, accounts:671,   debt:0,      securities:0, crypto:0 },
    { id:5, name:"Akbar Majidov",      initials:"AM", cash:0, accounts:-1575, debt:-1316,  securities:0, crypto:0 },
  ],

  // Businesses — fully separated legal entities
  businesses: [
    {
      id:1, name:"Kratos Moving Inc.", role:"Operating company",
      revenue:0, expenses:0, netProfit:0,
      // Accounts: BMO Chequing $2,852 + BMO Savings $206 + RBC Chequing $149,148 + Wise $721
      cashAccounts: 152207,
      // Liabilities: AMEX Gold/Plat $13,056 + CRA Tax Payable $120,000
      liabilities: 133056,
      taxPayable: 120000,
      creditCards: 13056,
      net: 19150,
      notes:"CEO: James Bond. CRA tax payable $120K included in liabilities. Net equity $19,150.",
    },
    {
      id:2, name:"JMF Logistics Inc.", role:"Operating company",
      revenue:0, expenses:0, netProfit:0,
      cashAccounts: 2621,
      liabilities: 0,
      taxPayable: 0,
      creditCards: 0,
      net: 2621,
      notes:"RBC Chequing $2,621. No outstanding liabilities on file.",
    },
  ],

  properties: [
    { id:1, name:"27 Roytec Rd.",     status:"STRONG", purchase:750000,  market:2000000, mortgage:730000,  monthlyPayment:3200,  monthlyTax:0,    rentalIncome:0, tenant:"No tenant on file", lender:"TD Bank",        rate:"6.0%",   rateType:"Variable / Floating",   maturity:"TBC",         amort:"",                     notes:"Crown jewel. $1.27M unrealized gain." },
    { id:2, name:"3705 Farr Ave.",    status:"STRONG", purchase:250000,  market:1200000, mortgage:0,       monthlyPayment:0,     monthlyTax:0,    rentalIncome:0, tenant:"No tenant on file", lender:"None",           rate:"N/A",    rateType:"Mortgage-free",          maturity:"N/A",         amort:"",                     notes:"Completely mortgage-free. Pure equity." },
    { id:3, name:"121 Milky Way",     status:"WATCH",  purchase:3079729, market:2850000, mortgage:1826927, monthlyPayment:15013, monthlyTax:905,  rentalIncome:0, tenant:"No tenant on file", lender:"Equitable Bank", rate:"7.95%",  rateType:"12 Month Fixed Open",   maturity:"Dec 1, 2026", amort:"286 months remaining", notes:"Market below purchase. Fixed Open — refinance without penalty." },
    { id:4, name:"51 Ahchie Crt.",    status:"RISK",   purchase:2119105, market:1750000, mortgage:1533355, monthlyPayment:9339,  monthlyTax:1235, rentalIncome:0, tenant:"No tenant on file", lender:"Equitable Bank", rate:"P+0.14%",rateType:"36 Month ARM Closed",   maturity:"Mar 1, 2029", amort:"337 months remaining", notes:"Variable rate ARM. Market significantly below purchase." },
    { id:5, name:"4 New Seabury Dr.", status:"WATCH",  purchase:349000,  market:958800,  mortgage:895992,  monthlyPayment:5979,  monthlyTax:374,  rentalIncome:0, tenant:"No tenant on file", lender:"Equitable Bank", rate:"5.94%",  rateType:"60 Month Fixed Closed", maturity:"Dec 1, 2029", amort:"312 months remaining", notes:"Locked in at 5.94% until Dec 2029. Thin equity." },
  ],

  cashflow: {
    income:[
      { label:"Kratos Moving Inc.",    amount:0, note:"Add monthly net profit" },
      { label:"JMF Logistics Inc.",    amount:0, note:"Add monthly net profit" },
      { label:"Rental income (total)", amount:0, note:"Update when tenants confirmed" },
      { label:"Other income",          amount:0, note:"" },
    ],
    obligations:[
      { label:"121 Milky Way (Equitable)",  amount:15013, note:"7.95% · Fixed Open · Dec 2026" },
      { label:"51 Ahchie Crt. (Equitable)", amount:9339,  note:"P+0.14% variable · Mar 2029" },
      { label:"4 New Seabury (Equitable)",  amount:5979,  note:"5.94% fixed · Dec 2029" },
      { label:"27 Roytec Rd. (TD)",         amount:3200,  note:"~6% floating" },
      { label:"TD Line of Credit",          amount:900,   note:"Interest on $91,793" },
      { label:"Student debt",               amount:350,   note:"Est. monthly" },
      { label:"Family support (avg)",       amount:8000,  note:"2025 monthly avg" },
      { label:"Personal lifestyle",         amount:5000,  note:"Excl. RE obligations" },
    ],
  },

  // Personal net worth history (from NET WORTH sheet)
  nwHistory:[
    {m:"Sep '24", nw:184704},
    {m:"Jan '25", nw:260660},
    {m:"Mar '25", nw:279732},
    {m:"Jun '25", nw:259793},
    {m:"Aug '25", nw:267527},
    {m:"Oct '25", nw:232501},
    {m:"Dec '25", nw:139277},
    {m:"Mar '26", nw:80878},
    {m:"Apr '26", nw:-72604},
  ],
};

const $K = n => { if(n==null)return"—"; const a=Math.abs(n),s=n<0?"-":""; return a>=1e6?`${s}$${(a/1e6).toFixed(2)}M`:a>=1e3?`${s}$${(a/1e3).toFixed(0)}K`:`${s}$${a.toFixed(0)}`; };
const $F = (n,d=0) => n==null?"—":new Intl.NumberFormat("en-CA",{style:"currency",currency:"CAD",maximumFractionDigits:d}).format(n);

async function loadFromDB(){
  try {
    const {data,error}=await supabase.from("dashboard_data").select("*");
    if(error||!data||data.length===0)return null;
    const result={};
    data.forEach(row=>{result[row.key]=row.value;});
    return (result.individuals&&result.individuals.length>0)?result:null;
  } catch(e){ return null; }
}

async function saveToDB(key,value){
  try { await supabase.from("dashboard_data").upsert({key,value,updated_at:new Date().toISOString()}); }
  catch(e){ console.error("Save failed",e); }
}

// ─── COMPONENTS ──────────────────────────────────────────────────────────────
function SL({children,color}){return <div style={{fontSize:10,letterSpacing:"0.12em",textTransform:"uppercase",color:color||C.textDim,marginBottom:8,fontFamily:C.sans}}>{children}</div>;}
function Card({children,style}){return <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:16,...style}}>{children}</div>;}
function Badge({status}){
  const m={STRONG:{bg:"rgba(46,204,113,0.12)",c:"#2ECC71",b:"rgba(46,204,113,0.25)"},WATCH:{bg:"rgba(230,126,34,0.12)",c:"#E67E22",b:"rgba(230,126,34,0.25)"},RISK:{bg:"rgba(192,57,43,0.12)",c:"#E05A4E",b:"rgba(192,57,43,0.25)"}};
  const s=m[status]||m.WATCH;
  return <span style={{background:s.bg,color:s.c,border:`1px solid ${s.b}`,borderRadius:3,fontSize:9,fontWeight:700,padding:"2px 6px",letterSpacing:"0.08em"}}>{status}</span>;
}
function SavedBadge({saved}){
  return saved?<span style={{fontSize:10,color:C.greenLight,background:C.greenDim,border:`1px solid rgba(39,174,96,0.25)`,borderRadius:4,padding:"2px 8px",fontFamily:C.sans}}>✓ Saved</span>:null;
}
function EditCell({value,onChange,locked,color}){
  const [editing,setEditing]=useState(false);
  const [v,setV]=useState(value);
  const col=color||(value<0?C.redLight:C.goldLight);
  if(locked)return <span style={{color:C.textMid,fontFamily:C.mono,fontSize:13}}>{value<0?"-":""}${Math.abs(value).toLocaleString("en-CA")}</span>;
  if(editing)return(
    <input autoFocus type="number" value={v}
      onChange={e=>setV(e.target.value)}
      onBlur={()=>{onChange(Number(v));setEditing(false);}}
      onKeyDown={e=>{if(e.key==="Enter"){onChange(Number(v));setEditing(false);}}}
      style={{background:"rgba(201,168,76,0.08)",border:`1px solid ${C.gold}`,borderRadius:4,color:C.gold,padding:"2px 8px",width:110,fontSize:13,fontFamily:C.mono,outline:"none"}}
    />
  );
  return(
    <span onClick={()=>{setV(value);setEditing(true);}} title="Click to edit"
      style={{cursor:"pointer",color:col,fontFamily:C.mono,fontSize:13,borderBottom:`1px dashed ${C.textDim}`}}>
      {value<0?"-":""}${Math.abs(value).toLocaleString("en-CA")}
    </span>
  );
}

// ─── CASH INPUT PANEL ────────────────────────────────────────────────────────
function CashInputPanel({data,onSave}){
  const [cash,setCash]=useState(data.individuals.find(f=>f.id===1)?.cash||0);
  const [saving,setSaving]=useState(false);
  const [saved,setSaved]=useState(false);
  const handleSave=async()=>{
    setSaving(true);
    onSave(cash);
    setSaved(true);
    setSaving(false);
    setTimeout(()=>setSaved(false),3000);
  };
  return(
    <div style={{background:`linear-gradient(135deg,rgba(201,168,76,0.08),rgba(201,168,76,0.03))`,border:`1px solid ${C.borderGold}`,borderRadius:10,padding:20,marginBottom:20}}>
      <SL color={C.gold}>Cash Vault — Monthly Input</SL>
      <div style={{fontSize:12,color:C.textMid,marginBottom:16,lineHeight:1.6}}>
        Enter your current physical cash amount. This saves to the database and updates the consolidated net worth immediately.
      </div>
      <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:200}}>
          <label style={{fontSize:11,color:C.textDim,display:"block",marginBottom:6,letterSpacing:"0.08em",textTransform:"uppercase"}}>Current vault cash</label>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:18,color:C.textMid,fontFamily:C.mono}}>$</span>
            <input type="number" value={cash} onChange={e=>setCash(Number(e.target.value))}
              style={{flex:1,background:"#1A1A1A",border:`1px solid ${C.borderGold}`,borderRadius:6,color:C.gold,padding:"10px 14px",fontSize:18,fontFamily:C.mono,outline:"none"}}
            />
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          <button onClick={handleSave} disabled={saving}
            style={{padding:"10px 24px",background:C.gold,border:"none",borderRadius:6,color:"#0A0A0A",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:C.sans,opacity:saving?0.7:1}}>
            {saving?"Saving...":"Save Cash"}
          </button>
          {saved&&<span style={{fontSize:11,color:C.greenLight,textAlign:"center"}}>✓ Saved to database</span>}
        </div>
      </div>
      <div style={{marginTop:12,fontSize:11,color:C.textDim}}>
        Last known: $34,770 (March 3, 2026) · Not yet recorded for April 2026
      </div>
    </div>
  );
}

// ─── LOGIN ───────────────────────────────────────────────────────────────────
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
  return(
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:C.sans,padding:20}}>
      <div style={{marginBottom:32,textAlign:"center"}}>
        <div style={{fontSize:36,fontWeight:800,color:C.gold,letterSpacing:"0.15em",marginBottom:6}}>JMF</div>
        <div style={{fontSize:11,color:C.textDim,letterSpacing:"0.14em",textTransform:"uppercase"}}>Family Office · Command Center</div>
      </div>
      <div style={{width:"100%",maxWidth:360,background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:28}}>
        <div style={{fontSize:17,fontWeight:600,color:C.text,marginBottom:4}}>Sign in</div>
        <div style={{fontSize:12,color:C.textMid,marginBottom:24}}>Enter your credentials to continue.</div>
        {["Username","Password"].map((label,i)=>(
          <div key={i} style={{marginBottom:i===0?14:20}}>
            <label style={{fontSize:10,color:C.textDim,letterSpacing:"0.1em",textTransform:"uppercase",display:"block",marginBottom:6}}>{label}</label>
            <input type={i===0?"text":"password"} placeholder={i===0?"e.g. ahmed":"••••••••••"}
              value={i===0?username:password}
              onChange={e=>i===0?setUsername(e.target.value):setPassword(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter")handleLogin();}}
              style={{width:"100%",padding:"11px 14px",background:"#1A1A1A",border:`1px solid ${C.border}`,borderRadius:7,color:C.text,fontSize:14,fontFamily:C.sans,outline:"none",boxSizing:"border-box"}}
            />
          </div>
        ))}
        {error&&<div style={{background:C.redBg,border:`1px solid rgba(192,57,43,0.25)`,borderRadius:6,padding:"9px 13px",marginBottom:14,fontSize:12,color:C.redLight}}>{error}</div>}
        <button onClick={handleLogin} disabled={loading}
          style={{width:"100%",padding:"12px",background:C.gold,border:"none",borderRadius:7,color:"#0A0A0A",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:C.sans,opacity:loading?0.7:1}}>
          {loading?"Signing in…":"Sign In"}
        </button>
      </div>
      <div style={{marginTop:20,fontSize:11,color:C.textDim}}>JMF Group · Private &amp; Confidential</div>
    </div>
  );
}

// ─── MEMBER VIEW ─────────────────────────────────────────────────────────────
function MemberView({user,data,onUpdate,onLogout}){
  const f=data.individuals.find(x=>x.id===user.individualId);
  if(!f)return null;
  const net=f.cash+f.accounts+f.debt+f.securities+f.crypto;
  const col=net>10000?C.gold:net>0?C.greenLight:C.redLight;
  const totalNW=data.properties.reduce((s,p)=>s+(p.market-p.mortgage),0)+data.individuals.reduce((s,x)=>s+Math.max(0,x.cash+x.accounts+x.debt+x.securities+x.crypto),0)+data.businesses.reduce((s,b)=>s+b.net,0);
  const [saved,setSaved]=useState(false);
  const handleUpdate=(id,field,val)=>{onUpdate(id,field,val);setSaved(true);setTimeout(()=>setSaved(false),3000);};
  return(
    <div style={{background:C.bg,minHeight:"100vh",fontFamily:C.sans,color:C.text}}>
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"0 16px",display:"flex",alignItems:"center",justifyContent:"space-between",height:50}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:15,fontWeight:800,color:C.gold,letterSpacing:"0.12em"}}>JMF</span>
          <span style={{width:1,height:16,background:C.border,display:"inline-block"}}/>
          <span style={{fontSize:11,color:C.textMid}}>My Snapshot</span>
          <SavedBadge saved={saved}/>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:11,color:C.textMid}}>{f.name}</span>
          <button onClick={onLogout} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:5,color:C.textMid,fontSize:10,padding:"4px 10px",cursor:"pointer"}}>Out</button>
        </div>
      </div>
      <div style={{padding:16,maxWidth:560,margin:"0 auto"}}>
        <div style={{textAlign:"center",padding:"28px 0 20px"}}>
          <div style={{fontSize:10,color:C.textDim,letterSpacing:"0.18em",textTransform:"uppercase",marginBottom:6}}>Your Net Worth</div>
          <div style={{fontSize:48,fontWeight:800,fontFamily:C.mono,color:col,letterSpacing:-1}}>{$K(net)}</div>
          <div style={{fontSize:11,color:C.textDim,marginTop:6}}>{data.lastUpdated}</div>
        </div>
        <Card style={{marginBottom:14}}>
          <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:14}}>{f.name} · Click any value to update</div>
          {[
            {l:"Cash / Vault",    fi:"cash",       desc:"Physical cash — input monthly"},
            {l:"Bank accounts",  fi:"accounts",   desc:"Total accounts net of overdraft"},
            {l:"Debt owed",       fi:"debt",       desc:"Credit cards, LOC, loans (negative)"},
            {l:"Securities",     fi:"securities", desc:"TFSA, investments, Wealthsimple"},
            {l:"Crypto",         fi:"crypto",     desc:"Crypto market value"},
          ].map(row=>(
            <div key={row.fi} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${C.border}`}}>
              <div>
                <div style={{fontSize:13,color:C.text}}>{row.l}</div>
                <div style={{fontSize:10,color:C.textDim,marginTop:2}}>{row.desc}</div>
              </div>
              <EditCell value={f[row.fi]} onChange={v=>handleUpdate(f.id,row.fi,v)} color={f[row.fi]<0?C.redLight:C.goldLight}/>
            </div>
          ))}
          <div style={{display:"flex",justifyContent:"space-between",padding:"12px 0 0"}}>
            <span style={{fontSize:14,fontWeight:600,color:C.textMid}}>Net worth</span>
            <span style={{fontSize:20,fontFamily:C.mono,fontWeight:700,color:col}}>{$K(net)}</span>
          </div>
        </Card>
        <Card>
          <SL>JMF Group — Summary</SL>
          <div style={{fontSize:11,color:C.textMid,marginBottom:12}}>Contact Ahmed for full group financials.</div>
          {[{label:"Group net worth",val:$K(totalNW)},{label:"Properties",val:`${data.properties.length} holdings`},{label:"Entities",val:`${data.businesses.length} companies`}].map((r,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:i<2?`1px solid ${C.border}`:"none",fontSize:13}}>
              <span style={{color:C.textMid}}>{r.label}</span>
              <span style={{fontFamily:C.mono,color:C.text}}>{r.val}</span>
            </div>
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
    <div style={{background:C.card,border:`1px solid ${open?C.borderGold:C.border}`,borderRadius:10,overflow:"hidden",marginBottom:10}}>
      <div onClick={()=>setOpen(o=>!o)} style={{padding:"14px 16px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",background:open?"rgba(201,168,76,0.03)":"transparent"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0,flex:1}}>
          <Badge status={prop.status}/>
          <div style={{minWidth:0}}>
            <div style={{fontSize:14,fontWeight:600,color:C.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{prop.name}</div>
            <div style={{fontSize:10,color:C.textDim}}>{prop.lender} · {prop.rate}</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:14,flexShrink:0}}>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:9,color:C.textDim,marginBottom:2}}>Equity</div>
            <div style={{fontSize:16,fontFamily:C.mono,fontWeight:700,color:eqCol}}>{$K(equity)}</div>
          </div>
          <span style={{color:open?C.gold:C.textDim,fontSize:11}}>{open?"▲":"▼"}</span>
        </div>
      </div>
      {open&&(
        <div style={{borderTop:`1px solid ${C.border}`,padding:16}}>
          <p style={{fontSize:12,color:C.textMid,fontStyle:"italic",lineHeight:1.6,marginBottom:16}}>{prop.notes}</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <div>
              <SL>Valuation</SL>
              {[
                {label:"Purchase",val:<span style={{color:C.textMid,fontFamily:C.mono}}>{$F(prop.purchase)}</span>},
                {label:"Market value",val:<EditCell value={prop.market} onChange={v=>onUpdate("market",v)} locked={!isAdmin}/>},
                {label:"Mortgage",val:<span style={{color:C.redLight,fontFamily:C.mono}}>{$F(prop.mortgage)}</span>},
                {label:"Equity",val:<span style={{color:eqCol,fontWeight:700,fontFamily:C.mono}}>{$F(equity)}</span>},
                {label:"vs purchase",val:<span style={{color:gainAmt>=0?C.greenLight:C.redLight,fontFamily:C.mono}}>{gainAmt>=0?"+":""}{gainPct}%</span>},
                {label:"LTV",val:<span style={{color:parseFloat(ltv)>80?C.redLight:parseFloat(ltv)>65?C.amber:C.greenLight,fontFamily:C.mono,fontWeight:700}}>{ltv}%</span>},
              ].map((r,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid ${C.border}`,fontSize:12}}>
                  <span style={{color:C.textMid}}>{r.label}</span>{r.val}
                </div>
              ))}
            </div>
            <div>
              <SL>Mortgage</SL>
              {[
                {label:"Lender",val:<span style={{color:C.text,fontFamily:C.mono,fontSize:12}}>{prop.lender}</span>},
                {label:"Rate",val:<span style={{color:C.amber,fontFamily:C.mono}}>{prop.rate}</span>},
                {label:"Type",val:<span style={{color:C.text,fontFamily:C.sans,fontSize:11}}>{prop.rateType}</span>},
                {label:"Maturity",val:<span style={{color:C.text,fontFamily:C.mono,fontSize:12}}>{prop.maturity}</span>},
                {label:"Monthly P+I",val:<EditCell value={prop.monthlyPayment} onChange={v=>onUpdate("monthlyPayment",v)} locked={!isAdmin}/>},
              ].map((r,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid ${C.border}`,fontSize:12}}>
                  <span style={{color:C.textMid}}>{r.label}</span>{r.val}
                </div>
              ))}
              <SL style={{marginTop:14}}>Rental</SL>
              <div style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid ${C.border}`,fontSize:12}}>
                <span style={{color:C.textMid}}>Monthly rent</span>
                <EditCell value={prop.rentalIncome} onChange={v=>onUpdate("rentalIncome",v)} locked={!isAdmin}/>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",padding:"7px 0",fontSize:12}}>
                <span style={{color:C.textMid}}>Net cash flow</span>
                <span style={{color:cf>=0?C.greenLight:C.redLight,fontFamily:C.mono,fontWeight:700}}>{cf>=0?"+":""}{$F(cf)}/mo</span>
              </div>
            </div>
          </div>
          <div style={{display:"flex",gap:8,marginTop:14,flexWrap:"wrap"}}>
            {[{label:"Annual mortgage",val:$F(prop.monthlyPayment*12),col:C.redLight,bg:C.redBg},{label:"Annual rental",val:$F(prop.rentalIncome*12),col:C.greenLight,bg:C.greenDim},{label:"Annual net",val:$F((prop.rentalIncome-prop.monthlyPayment)*12),col:cf>=0?C.greenLight:C.redLight,bg:cf>=0?C.greenDim:C.redBg}].map((chip,i)=>(
              <div key={i} style={{background:chip.bg,borderRadius:6,padding:"8px 12px",flex:1,textAlign:"center",minWidth:100}}>
                <div style={{fontSize:9,color:C.textDim,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:3}}>{chip.label}</div>
                <div style={{fontSize:13,fontFamily:C.mono,fontWeight:700,color:chip.col}}>{chip.val}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── BUSINESS CARD ───────────────────────────────────────────────────────────
function BizCard({biz,onUpdate,isAdmin}){
  const [open,setOpen]=useState(false);
  return(
    <div style={{background:C.card,border:`1px solid ${open?C.borderGold:C.border}`,borderRadius:10,overflow:"hidden",marginBottom:10}}>
      <div onClick={()=>setOpen(o=>!o)} style={{padding:"14px 16px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",background:open?"rgba(201,168,76,0.03)":"transparent"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{background:C.blueDim,color:C.blue,border:`1px solid rgba(41,128,185,0.25)`,borderRadius:3,fontSize:9,fontWeight:700,padding:"2px 6px",letterSpacing:"0.08em"}}>CORP</span>
          <div>
            <div style={{fontSize:14,fontWeight:600,color:C.text}}>{biz.name}</div>
            <div style={{fontSize:10,color:C.textMid,marginTop:1}}>{biz.role}</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:14,flexShrink:0}}>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:9,color:C.textDim,marginBottom:2}}>Corp. equity</div>
            <div style={{fontSize:16,fontFamily:C.mono,fontWeight:700,color:biz.net>=0?C.gold:C.redLight}}>{$K(biz.net)}</div>
          </div>
          <span style={{color:open?C.gold:C.textDim,fontSize:11}}>{open?"▲":"▼"}</span>
        </div>
      </div>
      {open&&(
        <div style={{borderTop:`1px solid ${C.border}`,padding:16}}>
          <p style={{fontSize:12,color:C.textMid,fontStyle:"italic",lineHeight:1.6,marginBottom:16}}>{biz.notes}</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <div>
              <SL>Assets</SL>
              {[
                {label:"Cash & accounts",val:<EditCell value={biz.cashAccounts} onChange={v=>onUpdate("cashAccounts",v)} locked={!isAdmin} color={C.greenLight}/>},
                {label:"Monthly revenue",val:<EditCell value={biz.revenue} onChange={v=>onUpdate("revenue",v)} locked={!isAdmin} color={C.greenLight}/>},
                {label:"Monthly expenses",val:<EditCell value={biz.expenses} onChange={v=>onUpdate("expenses",v)} locked={!isAdmin} color={C.redLight}/>},
                {label:"Net profit/mo",val:<span style={{color:biz.netProfit>0?C.gold:C.amber,fontFamily:C.mono}}>{$F(biz.netProfit)}</span>},
              ].map((r,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid ${C.border}`,fontSize:12}}>
                  <span style={{color:C.textMid}}>{r.label}</span>{r.val}
                </div>
              ))}
            </div>
            <div>
              <SL>Liabilities</SL>
              {[
                {label:"Total liabilities",val:<span style={{color:C.redLight,fontFamily:C.mono}}>{$F(biz.liabilities)}</span>},
                {label:"CRA tax payable",val:<EditCell value={biz.taxPayable} onChange={v=>onUpdate("taxPayable",v)} locked={!isAdmin} color={C.redLight}/>},
                {label:"Credit cards",val:<span style={{color:C.redLight,fontFamily:C.mono}}>{$F(biz.creditCards)}</span>},
                {label:"Corporate equity",val:<span style={{color:biz.net>=0?C.gold:C.redLight,fontFamily:C.mono,fontWeight:700}}>{$F(biz.net)}</span>},
              ].map((r,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:i<3?`1px solid ${C.border}`:"none",fontSize:12}}>
                  <span style={{color:C.textMid}}>{r.label}</span>{r.val}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ADMIN DASHBOARD ─────────────────────────────────────────────────────────
function AdminDashboard({user,data,setData,onLogout}){
  const [tab,setTab]=useState("overview");
  const [saved,setSaved]=useState(false);
  const showSaved=()=>{setSaved(true);setTimeout(()=>setSaved(false),3000);};

  const indNet=f=>f.cash+f.accounts+f.debt+f.securities+f.crypto;
  const totalREEquity=data.properties.reduce((s,p)=>s+(p.market-p.mortgage),0);
  const totalREValue=data.properties.reduce((s,p)=>s+p.market,0);
  const totalREDebt=data.properties.reduce((s,p)=>s+p.mortgage,0);
  const totalPersonal=data.individuals.reduce((s,f)=>s+indNet(f),0);
  const totalBizNet=data.businesses.reduce((s,b)=>s+b.net,0);
  const totalNW=totalREEquity+totalPersonal+totalBizNet;
  const totalIncome=data.cashflow.income.reduce((s,i)=>s+i.amount,0);
  const totalOblig=data.cashflow.obligations.reduce((s,o)=>s+o.amount,0);
  const gap=totalIncome-totalOblig;
  const totalMtgOut=data.properties.reduce((s,p)=>s+p.monthlyPayment,0);
  const aj=data.individuals.find(f=>f.id===1);
  const ajNet=aj?indNet(aj):0;

  function updProp(id,f,v){const props=data.properties.map(p=>p.id===id?{...p,[f]:v}:p);saveToDB("properties",props);setData(d=>({...d,properties:props}));showSaved();}
  function updInd(id,f,v){const inds=data.individuals.map(x=>x.id===id?{...x,[f]:v}:x);saveToDB("individuals",inds);setData(d=>({...d,individuals:inds}));showSaved();}
  function updBiz(id,f,v){
    const bizs=data.businesses.map(b=>{
      if(b.id!==id)return b;
      const updated={...b,[f]:v};
      updated.net=updated.cashAccounts-updated.liabilities;
      return updated;
    });
    saveToDB("businesses",bizs);setData(d=>({...d,businesses:bizs}));showSaved();
  }
  function updCF(type,idx,v){const a=[...data.cashflow[type]];a[idx]={...a[idx],amount:Number(v)};const cf={...data.cashflow,[type]:a};saveToDB("cashflow",cf);setData(d=>({...d,cashflow:cf}));showSaved();}
  function saveCash(val){const inds=data.individuals.map(x=>x.id===1?{...x,cash:val}:x);saveToDB("individuals",inds);setData(d=>({...d,individuals:inds}));showSaved();}

  const TABS=[{id:"overview",label:"Overview"},{id:"realestate",label:"Real Estate"},{id:"individuals",label:"Individuals"},{id:"businesses",label:"Businesses"},{id:"cashflow",label:"Cash Flow"}];

  return(
    <div style={{background:C.bg,minHeight:"100vh",color:C.text,fontFamily:C.sans}}>

      {/* NAV */}
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"0 16px",display:"flex",alignItems:"center",justifyContent:"space-between",height:50,position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:15,fontWeight:800,color:C.gold,letterSpacing:"0.15em"}}>JMF</span>
          <span style={{width:1,height:16,background:C.border,display:"inline-block"}}/>
          <span style={{fontSize:10,color:C.textMid,letterSpacing:"0.06em",display:"none"}}>Family Office</span>
          <SavedBadge saved={saved}/>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:9,fontWeight:700,color:C.gold,background:"rgba(201,168,76,0.12)",border:`1px solid rgba(201,168,76,0.25)`,borderRadius:3,padding:"2px 6px"}}>ADMIN</span>
          <span style={{fontSize:11,color:C.textMid}}>{user.name}</span>
          <button onClick={onLogout} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:5,color:C.textMid,fontSize:10,padding:"4px 10px",cursor:"pointer"}}>Out</button>
        </div>
      </div>

      {/* HERO */}
      <div style={{background:`linear-gradient(160deg,${C.surface} 0%,${C.bg} 100%)`,padding:"24px 16px 18px",textAlign:"center",borderBottom:`1px solid ${C.border}`}}>
        <div style={{fontSize:9,color:C.textDim,letterSpacing:"0.2em",textTransform:"uppercase",marginBottom:8}}>JMF Consolidated Net Worth</div>
        <div style={{fontSize:48,fontWeight:800,fontFamily:C.mono,color:totalNW<0?C.redLight:C.gold,letterSpacing:-1,lineHeight:1}}>{$K(totalNW)}</div>
        <div style={{fontSize:11,color:C.textDim,marginTop:8}}>RE equity + personal liquid + business equity · {data.lastUpdated}</div>
      </div>

      {/* KPI STRIP — scrollable on mobile */}
      <div style={{overflowX:"auto",borderBottom:`1px solid ${C.border}`,background:C.surface}}>
        <div style={{display:"flex",minWidth:"max-content"}}>
          {[
            {label:"RE Equity",    val:$K(totalREEquity), sub:`${((totalREEquity/Math.max(1,Math.abs(totalNW)))*100).toFixed(0)}% of NW`, col:C.gold},
            {label:"AJ Personal",  val:$K(ajNet),         sub:ajNet<0?"Deficit — see below":"Personal net",                               col:ajNet<0?C.redLight:C.greenLight},
            {label:"Biz Equity",   val:$K(totalBizNet),   sub:"Kratos + JMF net",                                                         col:C.blue},
            {label:"RE Mortgages", val:$K(totalMtgOut),   sub:`$${(totalMtgOut*12/1000).toFixed(0)}K/yr`,                                 col:C.redLight},
            {label:"Monthly Gap",  val:totalIncome===0?"Add income":$K(gap), sub:totalIncome===0?"No income set":gap<0?"Deficit":"Surplus", col:totalIncome===0?C.amber:gap<0?C.redLight:C.greenLight},
          ].map((k,i)=>(
            <div key={i} style={{padding:"12px 16px",borderRight:`1px solid ${C.border}`,minWidth:120,flexShrink:0}}>
              <div style={{fontSize:9,color:C.textDim,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:4,whiteSpace:"nowrap"}}>{k.label}</div>
              <div style={{fontSize:16,fontWeight:700,fontFamily:C.mono,color:k.col,whiteSpace:"nowrap"}}>{k.val}</div>
              <div style={{fontSize:9,color:C.textDim,marginTop:3,whiteSpace:"nowrap"}}>{k.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* TAB BAR — scrollable on mobile */}
      <div style={{overflowX:"auto",borderBottom:`1px solid ${C.border}`,background:C.surface}}>
        <div style={{display:"flex",minWidth:"max-content",padding:"0 16px"}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"9px 14px 11px",fontSize:11,fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase",border:"none",cursor:"pointer",fontFamily:C.sans,background:"transparent",color:tab===t.id?C.gold:C.textMid,borderBottom:tab===t.id?`2px solid ${C.gold}`:"2px solid transparent",whiteSpace:"nowrap",flexShrink:0}}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* CONTENT */}
      <div style={{padding:16,maxWidth:1100,margin:"0 auto"}}>

        {/* ── OVERVIEW ── */}
        {tab==="overview"&&(
          <div>
            {/* AJ Personal Alert */}
            {ajNet<0&&(
              <div style={{background:C.redBg,border:`1px solid rgba(192,57,43,0.25)`,borderRadius:10,padding:16,marginBottom:16}}>
                <SL color={C.redLight}>Ahmed Personal Position — Action Required</SL>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10}}>
                  {[
                    {label:"Bank accounts",val:$K(aj?.accounts||0),col:C.text},
                    {label:"Debt owed",val:$K(aj?.debt||0),col:C.redLight},
                    {label:"Securities",val:$K(aj?.securities||0),col:C.greenLight},
                    {label:"Net (ex. cash & RE)",val:$K(ajNet),col:C.redLight},
                  ].map((s,i)=>(
                    <div key={i} style={{background:"rgba(192,57,43,0.08)",borderRadius:6,padding:"10px 12px"}}>
                      <div style={{fontSize:9,color:C.textDim,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.08em"}}>{s.label}</div>
                      <div style={{fontSize:15,fontFamily:C.mono,fontWeight:700,color:s.col}}>{s.val}</div>
                    </div>
                  ))}
                </div>
                <div style={{fontSize:11,color:"rgba(224,90,78,0.7)",marginTop:12,lineHeight:1.6}}>
                  TD LOC at $91,793 + Student debt $45,015 are the primary drivers. Input cash vault below to see complete picture.
                </div>
              </div>
            )}

            {/* Cash Input */}
            <CashInputPanel data={data} onSave={saveCash}/>

            <div style={{display:"grid",gridTemplateColumns:"minmax(0,1.5fr) minmax(0,1fr)",gap:16,marginBottom:16}}>
              <Card>
                <SL>AJ Personal Net Worth — Sep 2024 → Apr 2026</SL>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={data.nwHistory} margin={{right:8,left:-10}}>
                    <XAxis dataKey="m" tick={{fill:C.textDim,fontSize:9}} axisLine={false} tickLine={false}/>
                    <YAxis tickFormatter={v=>`$${(v/1000).toFixed(0)}K`} tick={{fill:C.textDim,fontSize:9}} axisLine={false} tickLine={false}/>
                    <Tooltip formatter={v=>[$K(v)]} contentStyle={{background:C.card,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,fontSize:11}}/>
                    <Line type="monotone" dataKey="nw" stroke={C.gold} strokeWidth={2} dot={{fill:C.gold,r:3}} name="Personal NW"/>
                  </LineChart>
                </ResponsiveContainer>
              </Card>
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                <Card style={{flex:1}}>
                  <SL>JMF Wealth Breakdown</SL>
                  {[
                    {label:"RE Equity",  val:totalREEquity, col:C.gold},
                    {label:"Personal",   val:totalPersonal, col:totalPersonal<0?C.redLight:C.greenLight},
                    {label:"Biz equity", val:totalBizNet,   col:C.blue},
                  ].map((a,i)=>(
                    <div key={i} style={{marginBottom:10}}>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}>
                        <span style={{color:C.textMid}}>{a.label}</span>
                        <span style={{color:a.col,fontFamily:C.mono}}>{$K(a.val)}</span>
                      </div>
                      <div style={{height:3,background:"#1C1C1C",borderRadius:2}}>
                        <div style={{height:3,width:`${Math.max(2,Math.abs(a.val)/Math.max(1,Math.abs(totalREEquity))*100)}%`,background:a.col,borderRadius:2}}/>
                      </div>
                    </div>
                  ))}
                </Card>
                <div style={{background:C.redBg,border:"1px solid rgba(192,57,43,0.2)",borderRadius:10,padding:14}}>
                  <SL color={C.redLight}>RE Concentration</SL>
                  <div style={{fontSize:22,fontFamily:C.mono,color:C.redLight,fontWeight:700}}>{((totalREEquity/Math.max(1,Math.abs(totalNW)))*100).toFixed(0)}%</div>
                  <div style={{fontSize:10,color:C.textMid,marginTop:3,lineHeight:1.6}}>of NW in real estate. Target: grow liquid above $500K.</div>
                </div>
              </div>
            </div>

            {/* Property + Biz mini grid */}
            <Card>
              <SL>Portfolio at a Glance</SL>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:8,marginBottom:14}}>
                {data.properties.map(p=>{
                  const eq=p.market-p.mortgage;
                  return(
                    <div key={p.id} onClick={()=>setTab("realestate")} style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:12,cursor:"pointer"}} onMouseEnter={e=>e.currentTarget.style.borderColor=C.borderGold} onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
                      <div style={{fontSize:10,fontWeight:600,color:C.text,marginBottom:5,lineHeight:1.3}}>{p.name}</div>
                      <Badge status={p.status}/>
                      <div style={{fontSize:15,fontFamily:C.mono,fontWeight:700,marginTop:8,color:eq>500000?C.gold:eq>0?C.amber:C.redLight}}>{$K(eq)}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{borderTop:`1px solid ${C.border}`,paddingTop:12}}>
                <SL>Business Entities</SL>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:8}}>
                  {data.businesses.map(b=>(
                    <div key={b.id} onClick={()=>setTab("businesses")} style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:12,cursor:"pointer"}} onMouseEnter={e=>e.currentTarget.style.borderColor="rgba(41,128,185,0.35)"} onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
                      <div style={{fontSize:11,fontWeight:600,color:C.text,marginBottom:8}}>{b.name}</div>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:11}}>
                        <span style={{color:C.textDim}}>Cash</span>
                        <span style={{fontFamily:C.mono,color:C.greenLight}}>{$K(b.cashAccounts)}</span>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginTop:4}}>
                        <span style={{color:C.textDim}}>Liabilities</span>
                        <span style={{fontFamily:C.mono,color:C.redLight}}>{$K(b.liabilities)}</span>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginTop:6,paddingTop:6,borderTop:`1px solid ${C.border}`}}>
                        <span style={{color:C.textMid,fontWeight:600}}>Net equity</span>
                        <span style={{fontFamily:C.mono,color:b.net>=0?C.gold:C.redLight,fontWeight:700}}>{$K(b.net)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* ── REAL ESTATE ── */}
        {tab==="realestate"&&(
          <div>
            <Card style={{marginBottom:16}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:0}}>
                {[{label:"Portfolio Value",val:$K(totalREValue),col:C.text},{label:"Total Debt",val:$K(totalREDebt),col:C.redLight},{label:"Total Equity",val:$K(totalREEquity),col:C.gold},{label:"Monthly Mortgages",val:$K(totalMtgOut),col:C.redLight}].map((s,i,arr)=>(
                  <div key={i} style={{textAlign:"center",padding:"10px 8px",borderRight:i<arr.length-1?`1px solid ${C.border}`:"none"}}>
                    <div style={{fontSize:9,color:C.textDim,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:4}}>{s.label}</div>
                    <div style={{fontSize:16,fontFamily:C.mono,fontWeight:700,color:s.col}}>{s.val}</div>
                  </div>
                ))}
              </div>
            </Card>
            <div style={{fontSize:10,color:C.textDim,marginBottom:12}}>Click any property to expand · Gold values are editable</div>
            {data.properties.map(p=><PropCard key={p.id} prop={p} onUpdate={(f,v)=>updProp(p.id,f,v)} isAdmin={true}/>)}
          </div>
        )}

        {/* ── INDIVIDUALS ── */}
        {tab==="individuals"&&(
          <div>
            <CashInputPanel data={data} onSave={saveCash}/>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:12,marginBottom:16}}>
              {data.individuals.map(f=>{
                const net=indNet(f);
                const col=net>10000?C.gold:net>0?C.greenLight:C.redLight;
                return(
                  <Card key={f.id}>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
                      <div style={{width:38,height:38,borderRadius:"50%",background:`${col}15`,border:`1.5px solid ${col}35`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:col,flexShrink:0}}>{f.initials}</div>
                      <div>
                        <div style={{fontSize:13,fontWeight:600,color:C.text}}>{f.name}</div>
                        <div style={{fontSize:16,fontFamily:C.mono,fontWeight:700,color:col}}>{$K(net)}</div>
                      </div>
                    </div>
                    {[{l:"Cash / Vault",fi:"cash"},{l:"Bank accounts",fi:"accounts"},{l:"Debt owed",fi:"debt"},{l:"Securities",fi:"securities"},{l:"Crypto",fi:"crypto"}].map(row=>(
                      <div key={row.fi} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0",borderBottom:`1px solid ${C.border}`,fontSize:12}}>
                        <span style={{color:C.textMid}}>{row.l}</span>
                        <EditCell value={f[row.fi]} onChange={v=>updInd(f.id,row.fi,v)} color={f[row.fi]<0?C.redLight:C.goldLight}/>
                      </div>
                    ))}
                  </Card>
                );
              })}
            </div>
            <Card>
              <SL>2025 Family Support Flow — from Ahmed</SL>
              <ResponsiveContainer width="100%" height={120}>
                <BarChart layout="vertical" data={[{n:"Nazila",v:179900},{n:"Akbar",v:73700},{n:"Younger",v:36500},{n:"Mustafa",v:16800}]}>
                  <XAxis type="number" tickFormatter={v=>`$${(v/1000).toFixed(0)}K`} tick={{fill:C.textDim,fontSize:9}} axisLine={false} tickLine={false}/>
                  <YAxis type="category" dataKey="n" tick={{fill:C.textMid,fontSize:11}} axisLine={false} tickLine={false} width={52}/>
                  <Tooltip formatter={v=>[$F(v)]} contentStyle={{background:C.card,border:`1px solid ${C.border}`,fontSize:11,color:C.text}}/>
                  <Bar dataKey="v" radius={[0,4,4,0]}>{[C.gold,C.amber,C.textMid,C.textDim].map((c,i)=><Cell key={i} fill={c}/>)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {/* ── BUSINESSES ── */}
        {tab==="businesses"&&(
          <div>
            <Card style={{marginBottom:16}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:0}}>
                {[
                  {label:"Total Corp Cash",  val:$K(data.businesses.reduce((s,b)=>s+b.cashAccounts,0)), col:C.greenLight},
                  {label:"Total Corp Liab.", val:$K(data.businesses.reduce((s,b)=>s+b.liabilities,0)), col:C.redLight},
                  {label:"Total Corp Equity",val:$K(totalBizNet),                                       col:C.gold},
                  {label:"CRA Payable",      val:$K(data.businesses.reduce((s,b)=>s+b.taxPayable,0)),  col:C.amber},
                ].map((s,i,arr)=>(
                  <div key={i} style={{textAlign:"center",padding:"10px 8px",borderRight:i<arr.length-1?`1px solid ${C.border}`:"none"}}>
                    <div style={{fontSize:9,color:C.textDim,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:4}}>{s.label}</div>
                    <div style={{fontSize:16,fontFamily:C.mono,fontWeight:700,color:s.col}}>{s.val}</div>
                  </div>
                ))}
              </div>
            </Card>
            <div style={{background:C.amberBg,border:`1px solid rgba(230,126,34,0.2)`,borderRadius:8,padding:14,marginBottom:16,fontSize:12,color:C.textMid,lineHeight:1.7}}>
              <strong style={{color:C.amber}}>Note:</strong> Business accounts and liabilities are legally separate from Ahmed's personal finances. CRA tax payable of $120K is included in Kratos liabilities. Share monthly P&L to unlock profit tracking.
            </div>
            {data.businesses.map(b=><BizCard key={b.id} biz={b} onUpdate={(f,v)=>updBiz(b.id,f,v)} isAdmin={true}/>)}
          </div>
        )}

        {/* ── CASH FLOW ── */}
        {tab==="cashflow"&&(
          <div>
            <div style={{borderRadius:10,padding:"20px 16px",marginBottom:16,textAlign:"center",background:gap>=0?C.greenDim:C.redBg,border:`1px solid ${gap>=0?"rgba(46,204,113,0.2)":"rgba(192,57,43,0.2)"}`}}>
              <div style={{fontSize:9,color:C.textMid,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:6}}>Monthly Cash Flow Position</div>
              <div style={{fontSize:42,fontFamily:C.mono,fontWeight:800,color:gap>=0?C.greenLight:C.redLight}}>{gap>=0?"+":""}{$F(gap)}</div>
              <div style={{fontSize:12,color:C.textMid,marginTop:8}}>{totalIncome===0?"Add Kratos Moving net profit to see your true position.":gap<0?`Need ${$F(Math.abs(gap))} more/month to break even.`:`${$F(gap)}/month surplus.`}</div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
              <Card>
                <div style={{fontSize:10,color:C.greenLight,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:12}}>↑ Monthly Income</div>
                {data.cashflow.income.map((item,i)=>(
                  <div key={i} style={{padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span style={{fontSize:12,color:C.text}}>{item.label}</span>
                      <EditCell value={item.amount} onChange={v=>updCF("income",i,v)}/>
                    </div>
                    {item.note&&<div style={{fontSize:10,color:C.amber,marginTop:2}}>{item.note}</div>}
                  </div>
                ))}
                <div style={{display:"flex",justifyContent:"space-between",padding:"10px 0 0",fontWeight:700}}>
                  <span style={{color:C.textMid,fontSize:13}}>Total in</span>
                  <span style={{fontFamily:C.mono,fontSize:14,color:C.greenLight}}>{$F(totalIncome)}</span>
                </div>
              </Card>
              <Card>
                <div style={{fontSize:10,color:C.redLight,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:12}}>↓ Monthly Obligations</div>
                {data.cashflow.obligations.map((item,i)=>(
                  <div key={i} style={{padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span style={{fontSize:12,color:C.text}}>{item.label}</span>
                      <EditCell value={item.amount} onChange={v=>updCF("obligations",i,v)}/>
                    </div>
                    {item.note&&<div style={{fontSize:10,color:C.textDim,marginTop:2}}>{item.note}</div>}
                  </div>
                ))}
                <div style={{display:"flex",justifyContent:"space-between",padding:"10px 0 0",fontWeight:700}}>
                  <span style={{color:C.textMid,fontSize:13}}>Total out</span>
                  <span style={{fontFamily:C.mono,fontSize:14,color:C.redLight}}>{$F(totalOblig)}</span>
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
        setData({...DEFAULT,...dbData,nwHistory:DEFAULT.nwHistory,lastUpdated:DEFAULT.lastUpdated});
      } else {
        saveToDB("individuals",DEFAULT.individuals);
        saveToDB("properties",DEFAULT.properties);
        saveToDB("businesses",DEFAULT.businesses);
        saveToDB("cashflow",DEFAULT.cashflow);
        setData(DEFAULT);
      }
      setLoading(false);
    });
  },[]);

  function updInd(id,f,v){const inds=data.individuals.map(x=>x.id===id?{...x,[f]:v}:x);saveToDB("individuals",inds);setData(d=>({...d,individuals:inds}));}
  const logout=()=>setCurrentUser(null);

  if(loading)return(
    <div style={{minHeight:"100vh",background:"#090909",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"'Helvetica Neue', Arial, sans-serif"}}>
      <div style={{fontSize:28,fontWeight:800,color:"#C9A84C",letterSpacing:"0.15em",marginBottom:12}}>JMF</div>
      <div style={{fontSize:11,color:"#3A3835",letterSpacing:"0.1em"}}>Loading your financial data...</div>
    </div>
  );

  if(!currentUser)return <LoginScreen onLogin={setCurrentUser}/>;
  if(currentUser.role==="individual")return <MemberView user={currentUser} data={data} onUpdate={updInd} onLogout={logout}/>;
  return <AdminDashboard user={currentUser} data={data} setData={setData} onLogout={logout}/>;
}