import { useState, useEffect, useCallback, useRef } from "react";
import {
  supabase,
  fetchAvailability, upsertAvailability,
  fetchSchedules, upsertSchedule,
  fetchStaffSkills, upsertStaffSkill, deleteStaffSkill,
  subscribeAvailability, subscribeSchedules,
} from "./supabase.js";

// ─── Check if Supabase is configured ─────────────────────────────────────────
const SUPABASE_CONFIGURED =
  !import.meta.env.VITE_SUPABASE_URL?.includes("YOUR_PROJECT") &&
  !!import.meta.env.VITE_SUPABASE_URL;

// ─── INITIAL DATA ─────────────────────────────────────────────────────────────
const INIT_SKILLS = {
  "Aljon Padilla":    { plater:2,miso:2,host:2,supporter:2,prep:2,energy:2,leadership:2 },
  "Cole Tanaka":      { plater:1,miso:1,host:1,supporter:1,prep:1,energy:1,leadership:1 },
  "Donavan Tarpley":  { plater:2,miso:2,host:3,supporter:2,prep:2,energy:2,leadership:2 },
  "Elizabeth Nguyen": { plater:2,miso:2,host:2,supporter:2,prep:2,energy:2,leadership:2 },
  "Jayla Wada":       { plater:2,miso:2,host:2,supporter:2,prep:2,energy:2,leadership:1 },
  "Jazmin Delaney":   { plater:2,miso:3,host:2,supporter:3,prep:2,energy:2,leadership:2 },
  "Jazmin Williams":  { plater:2,miso:2,host:2,supporter:2,prep:1,energy:2,leadership:1 },
  "Martin Hu":        { plater:2,miso:2,host:2,supporter:2,prep:2,energy:1,leadership:2 },
  "Noah Rosa":        { plater:1,miso:2,host:1,supporter:1,prep:1,energy:1,leadership:1 },
  "Rafunzele Yap":    { plater:2,miso:2,host:2,supporter:2,prep:2,energy:2,leadership:2 },
  "Sean Rasay":       { plater:3,miso:3,host:3,supporter:3,prep:2,energy:3,leadership:3 },
  "Tommy Tran":       { plater:2,miso:2,host:2,supporter:2,prep:2,energy:2,leadership:2 },
  "Tyrel Maielua":    { plater:2,miso:3,host:2,supporter:3,prep:2,energy:2,leadership:2 },
  "Victor Khamkhay":  { plater:2,miso:2,host:2,supporter:2,prep:2,energy:2,leadership:2 },
  "Yangjun Liang":    { plater:2,miso:2,host:3,supporter:2,prep:2,energy:2,leadership:2 },
};
const SKILL_KEYS = ["plater","miso","host","supporter","prep","energy","leadership"];
const SKILL_LABELS = { plater:"Main Plater", miso:"Miso", host:"Host", supporter:"Supporter", prep:"Prep", energy:"Energy", leadership:"Leadership" };
function calcTotal(s){ return SKILL_KEYS.reduce((a,k)=>a+(s[k]||0),0); }

const INIT_RULES = {
  "Aljon Padilla":    { min:6,max:8,consecutive:true, avoid:"Sean Rasay" },
  "Cole Tanaka":      { min:1,max:3,consecutive:false,avoid:null },
  "Donavan Tarpley":  { min:3,max:6,consecutive:false,avoid:"Jazmin Delaney" },
  "Elizabeth Nguyen": { min:3,max:4,consecutive:false,avoid:null },
  "Jayla Wada":       { min:3,max:4,consecutive:false,avoid:null },
  "Jazmin Delaney":   { min:3,max:6,consecutive:false,avoid:"Donavan Tarpley" },
  "Jazmin Williams":  { min:2,max:4,consecutive:false,avoid:null },
  "Martin Hu":        { min:2,max:4,consecutive:false,avoid:null },
  "Noah Rosa":        { min:1,max:2,consecutive:false,avoid:null },
  "Rafunzele Yap":    { min:2,max:3,consecutive:false,avoid:null },
  "Sean Rasay":       { min:4,max:5,consecutive:true, avoid:"Aljon Padilla" },
  "Tommy Tran":       { min:2,max:5,consecutive:false,avoid:null },
  "Tyrel Maielua":    { min:3,max:5,consecutive:false,avoid:null },
  "Victor Khamkhay":  { min:2,max:4,consecutive:false,avoid:null },
  "Yangjun Liang":    { min:3,max:4,consecutive:true, avoid:null },
};

const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const POSITIONS = ["Main Plater","Miso","Host","Supporter"];

// ─── DESIGN ───────────────────────────────────────────────────────────────────
const C = {
  bg:"#f7f8fa",white:"#fff",border:"#e4e7ec",border2:"#d0d5dd",
  text:"#101828",sub:"#475467",muted:"#98a2b3",
  accent:"#0f4c81",accentL:"#e8f0fb",
  accent2:"#e86c2c",accent2L:"#fef3ec",
  green:"#039855",greenL:"#ecfdf3",
  yellow:"#b54708",yellowL:"#fffaeb",
  red:"#b42318",redL:"#fef3f2",
  sh:"0 1px 3px rgba(16,24,40,.08),0 1px 2px rgba(16,24,40,.06)",
  sh2:"0 8px 24px rgba(16,24,40,.12)",
};
const lv3c=[C.red,C.yellow,C.green,C.accent];
const lv3b=[C.redL,C.yellowL,C.greenL,C.accentL];
function lvc(l){return lv3c[Math.min(l??0,3)]??C.muted}
function lvb(l){return lv3b[Math.min(l??0,3)]??C.bg}

// ─── ATOMS ────────────────────────────────────────────────────────────────────
function Chip({children,color=C.accent,bg=C.accentL,sz=11}){
  return <span style={{background:bg,color,border:`1px solid ${color}33`,borderRadius:6,
    padding:"2px 8px",fontSize:sz,fontWeight:700,display:"inline-block",lineHeight:1.7}}>{children}</span>;
}
function LvBadge({level}){
  if(level==null) return <Chip color={C.muted} bg="#f2f4f7">—</Chip>;
  return <Chip color={lvc(level)} bg={lvb(level)}>Lv{level}</Chip>;
}
function Btn({children,color=C.accent,onClick,disabled,sm,outline,full}){
  const bg=outline?"transparent":color;
  const cl=outline?color:"#fff";
  return(
    <button onClick={onClick} disabled={disabled} style={{
      background:bg,color:cl,border:outline?`1.5px solid ${color}`:"none",
      borderRadius:9,padding:sm?"7px 14px":"10px 20px",fontWeight:700,
      fontSize:sm?12:13,cursor:disabled?"not-allowed":"pointer",
      fontFamily:"'DM Sans',sans-serif",
      boxShadow:outline?"none":`0 2px 8px ${color}33`,
      opacity:disabled?.5:1,transition:"opacity .12s",width:full?"100%":"auto",
      display:"inline-flex",alignItems:"center",justifyContent:"center",gap:5,
    }}>{children}</button>
  );
}
function Card({children,style={}}){
  return <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:14,
    boxShadow:C.sh,padding:20,...style}}>{children}</div>;
}
function SectionTitle({children}){
  return <h2 style={{fontFamily:"'Sora',sans-serif",fontSize:20,fontWeight:800,
    color:C.text,marginBottom:4}}>{children}</h2>;
}
function Label({children}){
  return <div style={{fontSize:11,fontWeight:700,color:C.sub,letterSpacing:.8,
    textTransform:"uppercase",marginBottom:6}}>{children}</div>;
}
function Input({value,onChange,placeholder,type="text",style={}}){
  return <input type={type} value={value} onChange={e=>onChange(e.target.value)}
    placeholder={placeholder}
    style={{width:"100%",background:C.white,border:`1px solid ${C.border2}`,
      borderRadius:8,padding:"9px 12px",color:C.text,fontSize:14,
      fontFamily:"'DM Sans',sans-serif",...style}}/>;
}

// ─── TOAST ────────────────────────────────────────────────────────────────────
function useToast(){
  const[toasts,setToasts]=useState([]);
  const push=useCallback((msg,type="info",title="")=>{
    const id=Date.now()+Math.random();
    setToasts(p=>[...p,{id,msg,type,title}]);
    setTimeout(()=>setToasts(p=>p.filter(t=>t.id!==id)),4200);
  },[]);
  return{toasts,push};
}
function Toaster({toasts}){
  return(
    <div style={{position:"fixed",top:16,right:16,zIndex:9999,display:"flex",
      flexDirection:"column",gap:8,pointerEvents:"none",maxWidth:340}}>
      {toasts.map(t=>(
        <div key={t.id} style={{background:C.white,
          borderLeft:`4px solid ${t.type==="success"?C.green:t.type==="warn"?C.yellow:C.accent}`,
          border:`1px solid ${t.type==="success"?C.green:t.type==="warn"?C.yellow:C.accent}`,
          borderRadius:10,padding:"12px 16px",boxShadow:C.sh2,
          animation:"toastIn .25s ease",display:"flex",gap:10,alignItems:"flex-start"}}>
          <span style={{fontSize:17,flexShrink:0}}>
            {t.type==="success"?"✅":t.type==="warn"?"⚠️":"🔔"}
          </span>
          <div>
            {t.title&&<div style={{fontWeight:700,fontSize:13,color:C.text,marginBottom:1}}>{t.title}</div>}
            <div style={{fontSize:12,color:C.sub}}>{t.msg}</div>
          </div>
        </div>
      ))}
      <style>{`@keyframes toastIn{from{transform:translateX(110%);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
    </div>
  );
}

// ─── NOTIF BELL ───────────────────────────────────────────────────────────────
function NotifBell({notifs,onClear}){
  const[open,setOpen]=useState(false);
  const ref=useRef();
  const unread=notifs.filter(n=>!n.read).length;
  useEffect(()=>{
    const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};
    document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);
  },[]);
  return(
    <div ref={ref} style={{position:"relative"}}>
      <button onClick={()=>setOpen(o=>!o)} style={{position:"relative",background:open?C.accentL:C.bg,
        border:`1px solid ${open?C.accent:C.border}`,borderRadius:8,
        width:36,height:36,cursor:"pointer",fontSize:17,display:"flex",
        alignItems:"center",justifyContent:"center"}}>
        🔔
        {unread>0&&<span style={{position:"absolute",top:-5,right:-5,
          background:C.red,color:"#fff",fontSize:9,fontWeight:800,
          width:17,height:17,borderRadius:"50%",display:"flex",alignItems:"center",
          justifyContent:"center",border:`2px solid ${C.white}`}}>{unread>9?"9+":unread}</span>}
      </button>
      {open&&(
        <div style={{position:"absolute",right:0,top:"calc(100% + 8px)",width:320,
          background:C.white,border:`1px solid ${C.border}`,borderRadius:14,
          boxShadow:C.sh2,zIndex:200,overflow:"hidden"}}>
          <div style={{padding:"12px 16px",borderBottom:`1px solid ${C.border}`,
            display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <span style={{fontWeight:700,fontSize:14,color:C.text}}>Notifications</span>
            {notifs.length>0&&<button onClick={()=>{onClear();setOpen(false);}}
              style={{background:"transparent",border:"none",color:C.muted,
                fontSize:11,cursor:"pointer",fontWeight:600}}>Clear all</button>}
          </div>
          <div style={{maxHeight:300,overflowY:"auto"}}>
            {notifs.length===0
              ?<div style={{padding:"24px 16px",textAlign:"center",color:C.muted,fontSize:13}}>No notifications</div>
              :notifs.slice().reverse().map((n,i)=>(
                <div key={i} style={{padding:"12px 16px",borderBottom:`1px solid ${C.border}`,
                  background:n.read?"transparent":C.accentL,display:"flex",gap:10}}>
                  <span style={{fontSize:15,flexShrink:0}}>
                    {n.type==="success"?"✅":n.type==="warn"?"⚠️":"🔔"}
                  </span>
                  <div>
                    {n.title&&<div style={{fontSize:13,fontWeight:600,color:C.text}}>{n.title}</div>}
                    <div style={{fontSize:11,color:C.sub}}>{n.msg}</div>
                    <div style={{fontSize:10,color:C.muted,marginTop:2}}>{n.time}</div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SUBMISSION STATUS BAR ────────────────────────────────────────────────────
function SubStatusBar({availability,staffSkills,currentWeek,onRemind}){
  if(!currentWeek) return null;
  const allStaff=Object.keys(staffSkills);
  const subSet=new Set(availability.filter(a=>a.week===currentWeek).map(a=>a.name));
  const done=allStaff.filter(n=>subSet.has(n));
  const pending=allStaff.filter(n=>!subSet.has(n));
  const pct=allStaff.length>0?Math.round(done.length/allStaff.length*100):0;
  return(
    <Card style={{marginBottom:20,padding:"16px 20px"}}>
      <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:12,flexWrap:"wrap"}}>
        <div style={{flex:1}}>
          <div style={{fontWeight:700,fontSize:14,color:C.text,marginBottom:2}}>
            Submission Status — Week {currentWeek}
          </div>
          <div style={{fontSize:12,color:C.muted}}>{done.length}/{allStaff.length} submitted</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontWeight:800,fontSize:22,color:pct===100?C.green:C.accent}}>{pct}%</span>
          {pending.length>0&&<Btn sm color={C.accent2} onClick={()=>onRemind(pending)}>🔔 Remind ({pending.length})</Btn>}
        </div>
      </div>
      <div style={{background:C.border,borderRadius:99,height:7,marginBottom:12,overflow:"hidden"}}>
        <div style={{height:"100%",borderRadius:99,transition:"width .6s",
          width:`${pct}%`,background:pct===100?C.green:`linear-gradient(90deg,${C.accent},#2d7dd2)`}}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div style={{background:C.greenL,border:`1px solid ${C.green}22`,borderRadius:10,padding:12}}>
          <div style={{fontWeight:700,fontSize:12,color:C.green,marginBottom:8}}>✅ Submitted ({done.length})</div>
          {done.map(n=>{
            const e=availability.find(a=>a.name===n&&a.week===currentWeek);
            const slots=e?Object.values(e.selected).filter(Boolean).length:0;
            return(
              <div key={n} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                background:C.white,borderRadius:6,padding:"5px 9px",marginBottom:4}}>
                <span style={{fontSize:12,color:C.text}}>{n}</span>
                <Chip color={C.green} bg={C.greenL} sz={10}>{slots}sl</Chip>
              </div>
            );
          })}
          {done.length===0&&<div style={{fontSize:12,color:C.muted}}>None yet</div>}
        </div>
        <div style={{background:C.redL,border:`1px solid ${C.red}22`,borderRadius:10,padding:12}}>
          <div style={{fontWeight:700,fontSize:12,color:C.red,marginBottom:8}}>⏳ Pending ({pending.length})</div>
          {pending.length===0
            ?<div style={{textAlign:"center",padding:"10px 0",color:C.green,fontWeight:600,fontSize:13}}>🎉 All done!</div>
            :pending.map(n=>(
              <div key={n} style={{background:C.white,borderRadius:6,padding:"5px 9px",marginBottom:4,fontSize:12,color:C.text}}>{n}</div>
            ))}
        </div>
      </div>
    </Card>
  );
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function LoginScreen({onLogin}){
  const[mode,setMode]=useState("staff");
  const[name,setName]=useState("");
  const[pin,setPin]=useState("");
  const[err,setErr]=useState("");
  const staffList=Object.keys(INIT_SKILLS).sort();
  const go=()=>{
    setErr("");
    if(mode==="admin"){if(pin==="1234")onLogin("admin","Manager");else setErr("Wrong PIN.");}
    else{if(!name){setErr("Please select your name.");return;}onLogin("staff",name);}
  };
  return(
    <div style={{minHeight:"100vh",background:`linear-gradient(135deg,${C.accent} 0%,#1d75c8 100%)`,
      display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap');*{box-sizing:border-box;margin:0;padding:0}`}</style>
      <div style={{background:C.white,borderRadius:20,padding:"40px 36px",width:"100%",maxWidth:420,
        boxShadow:"0 20px 60px rgba(0,0,0,.2)"}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:60,height:60,
            borderRadius:16,background:C.accent,fontSize:28,marginBottom:12,
            boxShadow:`0 6px 18px ${C.accent}55`}}>🍱</div>
          <div style={{fontFamily:"'Sora',sans-serif",fontWeight:800,fontSize:22,color:C.text}}>TOTOYA Aiea</div>
          <div style={{color:C.muted,fontSize:13,marginTop:3}}>Shift Management System</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",background:C.bg,borderRadius:10,padding:4,marginBottom:24}}>
          {[["staff","👤 Staff"],["admin","🔐 Admin"]].map(([m,l])=>(
            <button key={m} onClick={()=>{setMode(m);setErr("");}}
              style={{border:"none",borderRadius:8,padding:"10px 0",background:mode===m?C.white:"transparent",
                color:mode===m?C.text:C.muted,fontWeight:mode===m?700:500,fontSize:14,
                boxShadow:mode===m?C.sh:"none",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",
                transition:"all .15s"}}>{l}</button>
          ))}
        </div>
        {mode==="staff"?(
          <>
            <Label>Your Name</Label>
            <select value={name} onChange={e=>setName(e.target.value)}
              style={{width:"100%",background:C.white,border:`1px solid ${C.border2}`,
                borderRadius:8,padding:"10px 12px",color:C.text,fontSize:14,
                fontFamily:"'DM Sans',sans-serif",marginBottom:0}}>
              <option value="">— Select your name —</option>
              {staffList.map(n=><option key={n}>{n}</option>)}
            </select>
          </>
        ):(
          <>
            <Label>Admin PIN</Label>
            <input type="password" value={pin} onChange={e=>setPin(e.target.value)}
              placeholder="Enter PIN" onKeyDown={e=>e.key==="Enter"&&go()}
              style={{width:"100%",background:C.white,border:`1px solid ${C.border2}`,
                borderRadius:8,padding:"10px 12px",color:C.text,fontSize:14,
                fontFamily:"'DM Sans',sans-serif"}}/>
            <p style={{color:C.muted,fontSize:11,marginTop:6}}>Demo PIN: 1234</p>
          </>
        )}
        {err&&<div style={{background:C.redL,color:C.red,borderRadius:8,padding:"10px 14px",
          fontSize:13,marginTop:12}}>{err}</div>}
        <button onClick={go} style={{width:"100%",marginTop:20,background:C.accent,color:"#fff",
          border:"none",borderRadius:10,padding:"13px 0",fontSize:15,fontWeight:700,
          cursor:"pointer",fontFamily:"'DM Sans',sans-serif",
          boxShadow:`0 4px 14px ${C.accent}44`}}>
          {mode==="staff"?"Continue →":"Login as Admin →"}
        </button>
      </div>
    </div>
  );
}

// ─── STAFF: AVAILABILITY ──────────────────────────────────────────────────────
function StaffAvailability({staffName,availability,saveAvailability,currentWeek,push,staffRules}){
  const rule=staffRules[staffName];
  const existing=availability.find(a=>a.name===staffName&&a.week===currentWeek);
  const[sel,setSel]=useState(existing?.selected||{});
  const[reqs,setReqs]=useState(existing?.requests||"");
  const[done,setDone]=useState(false);
  useEffect(()=>{
    const e=availability.find(a=>a.name===staffName&&a.week===currentWeek);
    setSel(e?.selected||{});setReqs(e?.requests||"");setDone(false);
  },[currentWeek,staffName]);
  const toggle=(d,s)=>setSel(p=>({...p,[`${d}|${s}`]:!p[`${d}|${s}`]}));
  const count=Object.values(sel).filter(Boolean).length;
  const submit=()=>{
    const entry={name:staffName,week:currentWeek,selected:{...sel},requests:reqs,submittedAt:new Date().toISOString()};
    saveAvailability(entry);
    push(`${staffName} submitted for ${currentWeek}`,"success","New Submission");
    setDone(true);
  };
  if(done) return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
      minHeight:400,textAlign:"center",padding:32}}>
      <div style={{width:80,height:80,borderRadius:"50%",background:C.greenL,display:"flex",
        alignItems:"center",justifyContent:"center",fontSize:38,marginBottom:20,
        animation:"popIn .5s cubic-bezier(.34,1.56,.64,1) both"}}>✅</div>
      <h2 style={{fontFamily:"'Sora',sans-serif",fontSize:24,color:C.text,marginBottom:8}}>
        Thank you, {staffName.split(" ")[0]}! 🎉
      </h2>
      <p style={{color:C.sub,fontSize:14,maxWidth:320,marginBottom:6}}>
        Week <strong>{currentWeek}</strong> — {count} slot{count!==1?"s":""} submitted.
      </p>
      <p style={{color:C.muted,fontSize:13,marginBottom:24}}>The manager will review and publish the schedule soon 📅</p>
      <Btn onClick={()=>setDone(false)} outline color={C.accent}>Edit Submission</Btn>
      <style>{`@keyframes popIn{from{transform:scale(0);opacity:0}to{transform:scale(1);opacity:1}}`}</style>
    </div>
  );
  return(
    <div style={{maxWidth:680}}>
      <SectionTitle>Hi, {staffName.split(" ")[0]} 👋</SectionTitle>
      <p style={{color:C.sub,fontSize:14,marginBottom:20}}>Submit your availability for week <strong>{currentWeek}</strong></p>
      {rule&&(
        <div style={{background:C.accentL,border:`1px solid ${C.accent}22`,borderRadius:10,
          padding:"10px 16px",marginBottom:18,display:"flex",gap:16,flexWrap:"wrap",alignItems:"center"}}>
          <span style={{fontSize:12,color:C.accent}}>📋 <b>Min:</b> {rule.min} &nbsp;|&nbsp; <b>Max:</b> {rule.max} shifts</span>
          {rule.avoid&&<span style={{fontSize:12,color:C.accent2}}>⚠ Not with {rule.avoid}</span>}
          {rule.consecutive&&<span style={{fontSize:12,color:C.green}}>✓ Consecutive OK</span>}
        </div>
      )}
      <Card style={{padding:0,overflow:"hidden",marginBottom:16}}>
        <div style={{display:"grid",gridTemplateColumns:"88px repeat(7,1fr)",
          background:C.bg,borderBottom:`1px solid ${C.border}`}}>
          <div style={{padding:"10px 8px",borderRight:`1px solid ${C.border}`}}/>
          {DAYS.map(d=><div key={d} style={{padding:"10px 4px",textAlign:"center",
            fontSize:11,fontWeight:700,color:C.muted,letterSpacing:.5,
            textTransform:"uppercase",borderRight:`1px solid ${C.border}`}}>{d}</div>)}
        </div>
        {[["Lunch","9:00–15:00","☀️"],["Dinner","15:30–21:30","🌙"]].map(([lbl,t,ic])=>(
          <div key={lbl} style={{display:"grid",gridTemplateColumns:"88px repeat(7,1fr)",
            borderBottom:`1px solid ${C.border}`}}>
            <div style={{padding:"12px 10px",borderRight:`1px solid ${C.border}`}}>
              <div style={{fontWeight:700,fontSize:13,color:C.text}}>{ic} {lbl}</div>
              <div style={{fontSize:10,color:C.muted}}>{t}</div>
            </div>
            {DAYS.map(day=>{
              const k=`${day}|${lbl}`;const on=sel[k];
              return(
                <div key={day} onClick={()=>toggle(day,lbl)}
                  style={{borderRight:`1px solid ${C.border}`,display:"flex",alignItems:"center",
                    justifyContent:"center",cursor:"pointer",padding:8,minHeight:52,
                    background:on?C.accentL:"transparent",transition:"background .1s"}}>
                  <div style={{width:22,height:22,borderRadius:6,
                    border:`2px solid ${on?C.accent:C.border2}`,
                    background:on?C.accent:C.white,display:"flex",alignItems:"center",
                    justifyContent:"center",transition:"all .1s",
                    boxShadow:on?`0 2px 6px ${C.accent}44`:"none"}}>
                    {on&&<span style={{color:"#fff",fontSize:13,fontWeight:900}}>✓</span>}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </Card>
      <div style={{marginBottom:18}}>
        <Label>Special Requests / Notes</Label>
        <textarea value={reqs} onChange={e=>setReqs(e.target.value)}
          placeholder="e.g. prefer morning, need early finish Wed..."
          style={{width:"100%",background:C.white,border:`1px solid ${C.border2}`,
            borderRadius:8,padding:"10px 12px",color:C.text,fontSize:14,
            fontFamily:"'DM Sans',sans-serif",height:72,resize:"vertical"}}/>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        <Btn onClick={submit} color={C.accent}>Submit Availability →</Btn>
        {count>0&&<span style={{fontSize:13,color:C.muted}}>{count} slot{count!==1?"s":""} selected</span>}
        {existing&&<Chip color={C.green} bg={C.greenL}>Previously submitted</Chip>}
      </div>
    </div>
  );
}

// ─── STAFF: MY SCHEDULE ───────────────────────────────────────────────────────
function StaffMySchedule({staffName,published}){
  const mine=published.flatMap(s=>(s.shifts||[])
    .filter(sh=>sh.workers?.some(w=>w.name===staffName))
    .map(sh=>({...sh,week:s.week})));
  if(mine.length===0) return(
    <div style={{textAlign:"center",padding:"64px 32px"}}>
      <div style={{fontSize:48,marginBottom:12}}>📭</div>
      <p style={{color:C.muted}}>No published schedule yet. Check back soon.</p>
    </div>
  );
  return(
    <div style={{maxWidth:640}}>
      <SectionTitle>My Schedule</SectionTitle>
      <div style={{height:8}}/>
      {mine.map((sh,i)=>{
        const me=sh.workers?.find(w=>w.name===staffName);
        return(
          <Card key={i} style={{marginBottom:10,padding:"14px 18px",
            display:"grid",gridTemplateColumns:"1fr auto",gap:12,alignItems:"center"}}>
            <div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:4,alignItems:"center"}}>
                <span style={{fontWeight:700,color:C.text}}>{sh.week}</span>
                <Chip color={C.sub} bg={C.bg}>{sh.day}</Chip>
                <Chip color={sh.shiftType==="Lunch"?C.yellow:C.accent}
                  bg={sh.shiftType==="Lunch"?C.yellowL:C.accentL}>
                  {sh.shiftType==="Lunch"?"☀️ Lunch":"🌙 Dinner"}
                </Chip>
                {sh.leader===staffName&&<Chip color={C.accent2} bg={C.accent2L}>★ Leader</Chip>}
              </div>
              <div style={{color:C.sub,fontSize:13}}>Position: <strong>{me?.position||"TBD"}</strong></div>
            </div>
            <LvBadge level={me?.level}/>
          </Card>
        );
      })}
    </div>
  );
}

// ─── ADMIN: SHIFT BUILDER ─────────────────────────────────────────────────────
function AdminShiftBuilder({availability,published,saveSchedule,currentWeek,push,staffSkills,staffRules}){
  const[loading,setLoading]=useState(false);
  const[draft,setDraft]=useState(null);
  const weekAvail=availability.filter(a=>a.week===currentWeek);

  const generate=async()=>{
    setLoading(true);setDraft(null);
    const skills=Object.entries(staffSkills).map(([n,s])=>
      `${n}: Plater=${s.plater} Miso=${s.miso} Host=${s.host} Supp=${s.supporter} Lead=${s.leadership} Total=${calcTotal(s)}`).join("\n");
    const rules=Object.entries(staffRules).map(([n,r])=>
      `${n}: min=${r.min} max=${r.max} avoid=${r.avoid||"none"}`).join("\n");
    const avail=weekAvail.length>0
      ?weekAvail.map(a=>{const slots=Object.entries(a.selected).filter(([,v])=>v).map(([k])=>k.replace("|"," ")).join(", ");
        return`${a.name}: ${slots||"none"} | notes: ${a.requests||"none"}`;}).join("\n")
      :"No availability submitted — use rules only.";
    try{
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:4096,
          system:"Return ONLY valid compact JSON. No markdown, no explanation, no code fences.",
          messages:[{role:"user",content:`Schedule TOTOYA Aiea week ${currentWeek}.
SKILLS:\n${skills}\nRULES:\n${rules}\nAVAILABILITY:\n${avail}
CONSTRAINTS: 4 workers/shift (Main Plater,Miso,Host,Supporter), each Lv2+, if any Lv2 then others Lv3, leader=highest leadership Lv2+ no consecutive, Aljon≠Sean, Donavan≠Jazmin Delaney.
Return JSON: {"week":"${currentWeek}","shifts":[{"day":"Mon","shiftType":"Lunch","leader":"Name","workers":[{"name":"Name","position":"Main Plater","level":2}],"issues":[]}]}`}]})});
      const data=await res.json();
      const raw=data.content?.map(c=>c.text||"").join("").replace(/```json|```/g,"").trim();
      setDraft(JSON.parse(raw));
      push(`Schedule generated for ${currentWeek}`,"info","Shift Builder");
    }catch{
      setDraft({week:currentWeek,shifts:DAYS.flatMap(day=>
        ["Lunch","Dinner"].map(st=>({day,shiftType:st,leader:"Sean Rasay",
          workers:[{name:"Sean Rasay",position:"Main Plater",level:3},
            {name:"Jazmin Delaney",position:"Miso",level:3},
            {name:"Donavan Tarpley",position:"Host",level:3},
            {name:"Aljon Padilla",position:"Supporter",level:2}],issues:[]})))});
    }
    setLoading(false);
  };

  const publish=()=>{
    if(!draft)return;
    saveSchedule({...draft,publishedAt:new Date().toISOString()});
    push(`Week ${draft.week} published to staff`,"success","Schedule Published");
  };

  return(
    <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        <SectionTitle>Shift Builder</SectionTitle>
        <div style={{marginLeft:"auto",display:"flex",gap:8,flexWrap:"wrap"}}>
          <Btn color={C.accent} onClick={generate} disabled={loading}>
            {loading?"⟳ Generating...":"⚡ Auto-Generate"}
          </Btn>
          {draft&&<Btn color={C.green} onClick={publish}>📢 Publish</Btn>}
          {draft&&<Btn color={C.muted} outline onClick={()=>setDraft(null)}>Clear</Btn>}
        </div>
      </div>

      <SubStatusBar availability={availability} staffSkills={staffSkills} currentWeek={currentWeek}
        onRemind={pending=>push(`Reminder sent to ${pending.length} staff for ${currentWeek}`,"warn","Reminder Sent")}/>

      {!draft&&!loading&&(
        <div style={{background:C.white,border:`2px dashed ${C.border}`,borderRadius:14,
          padding:64,textAlign:"center"}}>
          <div style={{fontSize:48,marginBottom:12}}>📅</div>
          <p style={{color:C.muted,fontSize:15}}>Click Auto-Generate to build the optimal schedule</p>
        </div>
      )}
      {loading&&(
        <div style={{textAlign:"center",padding:64}}>
          <div style={{fontSize:36,display:"inline-block",animation:"spin 1s linear infinite"}}>⟳</div>
          <p style={{color:C.muted,marginTop:12}}>Building optimal schedule…</p>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}
      {draft&&<ScheduleGrid shifts={draft.shifts}/>}
    </div>
  );
}

// ─── SCHEDULE GRID (reusable) ─────────────────────────────────────────────────
function ScheduleGrid({shifts}){
  const[view,setView]=useState("grid"); // "grid"|"list"
  const posC={"Main Plater":[C.accent,C.accentL],"Miso":[C.green,C.greenL],
    "Host":[C.accent2,C.accent2L],"Supporter":[C.sub,C.bg]};
  return(
    <div>
      <div style={{display:"flex",gap:6,marginBottom:12}}>
        <Btn sm color={view==="grid"?C.accent:C.muted} outline={view!=="grid"} onClick={()=>setView("grid")}>⊞ Grid</Btn>
        <Btn sm color={view==="list"?C.accent:C.muted} outline={view!=="list"} onClick={()=>setView("list")}>≡ List</Btn>
      </div>
      {view==="grid"&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:8,marginBottom:16}}>
          {DAYS.map(day=>{
            const ds=(shifts||[]).filter(s=>s.day===day);
            return(
              <div key={day} style={{background:C.white,border:`1px solid ${C.border}`,
                borderRadius:12,overflow:"hidden",boxShadow:C.sh}}>
                <div style={{padding:"8px",background:C.bg,borderBottom:`1px solid ${C.border}`,
                  fontWeight:700,fontSize:13,color:C.text,textAlign:"center"}}>{day}</div>
                {ds.length===0&&<div style={{padding:16,textAlign:"center",color:C.muted,fontSize:12}}>—</div>}
                {ds.map((sh,si)=>(
                  <div key={si} style={{padding:"10px 8px",borderBottom:si<ds.length-1?`1px solid ${C.border}`:"none"}}>
                    <div style={{fontSize:10,fontWeight:700,marginBottom:6,display:"flex",justifyContent:"space-between"}}>
                      <span style={{color:sh.shiftType==="Lunch"?C.yellow:C.accent}}>
                        {sh.shiftType==="Lunch"?"☀️":"🌙"}
                      </span>
                      {sh.leader&&<span style={{color:C.accent2}}>★{sh.leader.split(" ")[0]}</span>}
                    </div>
                    {sh.workers?.map((w,wi)=>{
                      const [pc]=posC[w.position]||[C.muted];
                      return(
                        <div key={wi} style={{display:"flex",alignItems:"center",gap:3,marginBottom:3}}>
                          <div style={{width:3,height:10,borderRadius:2,background:pc,flexShrink:0}}/>
                          <span style={{fontSize:10,color:C.text,flex:1,
                            overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                            {w.name.split(" ")[0]}
                          </span>
                          <span style={{fontSize:9,fontWeight:700,color:lvc(w.level)}}>L{w.level}</span>
                        </div>
                      );
                    })}
                    {sh.issues?.length>0&&<div style={{fontSize:9,color:C.yellow,marginTop:3}}>⚠ {sh.issues.length}</div>}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
      {view==="list"&&(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {(shifts||[]).map((sh,i)=>(
            <Card key={i} style={{padding:"12px 16px",
              border:`1px solid ${sh.issues?.length?C.yellow+"66":C.border}`,
              display:"grid",gridTemplateColumns:"90px 70px 1fr 90px",gap:12,alignItems:"start"}}>
              <div>
                <div style={{fontWeight:700,color:C.text}}>{sh.day}</div>
                <Chip color={sh.shiftType==="Lunch"?C.yellow:C.accent}
                  bg={sh.shiftType==="Lunch"?C.yellowL:C.accentL} sz={10}>
                  {sh.shiftType==="Lunch"?"☀️ Lunch":"🌙 Dinner"}
                </Chip>
              </div>
              <div>
                <div style={{fontSize:10,color:C.muted,fontWeight:600,textTransform:"uppercase",marginBottom:2}}>Leader</div>
                <div style={{fontSize:11,color:C.accent2,fontWeight:700}}>★ {sh.leader?.split(" ")[0]||"—"}</div>
              </div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                {sh.workers?.map((w,wi)=>{
                  const[pc,pb]=posC[w.position]||[C.muted,C.bg];
                  return(
                    <div key={wi} style={{background:pb,border:`1px solid ${pc}22`,borderRadius:7,
                      padding:"4px 9px",display:"flex",alignItems:"center",gap:5}}>
                      <span style={{fontSize:10,color:pc,fontWeight:700}}>{w.position.split(" ")[0]}</span>
                      <span style={{fontSize:11,color:C.text}}>{w.name}</span>
                      <LvBadge level={w.level}/>
                    </div>
                  );
                })}
              </div>
              <div>
                {sh.issues?.length>0
                  ?sh.issues.map((iss,ii)=><div key={ii} style={{color:C.yellow,fontSize:10}}>{iss}</div>)
                  :<span style={{color:C.green,fontSize:11,fontWeight:600}}>✓ Valid</span>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── ADMIN: SCHEDULE VIEW ─────────────────────────────────────────────────────
function AdminScheduleView({published}){
  const[selWeek,setSelWeek]=useState("");
  const weeks=[...new Set(published.map(s=>s.week))].sort();
  useEffect(()=>{if(weeks.length>0&&!selWeek)setSelWeek(weeks[weeks.length-1]);},[weeks.length]);
  const schedule=published.find(s=>s.week===selWeek);
  return(
    <div>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20,flexWrap:"wrap"}}>
        <SectionTitle>Published Schedules</SectionTitle>
        <div style={{marginLeft:"auto"}}>
          <select value={selWeek} onChange={e=>setSelWeek(e.target.value)}
            style={{background:C.white,border:`1px solid ${C.border2}`,borderRadius:8,
              padding:"8px 12px",color:C.text,fontSize:13,fontFamily:"'DM Sans',sans-serif"}}>
            <option value="">— Select week —</option>
            {weeks.map(w=><option key={w}>{w}</option>)}
          </select>
        </div>
      </div>
      {weeks.length===0&&(
        <div style={{textAlign:"center",padding:"64px 32px"}}>
          <div style={{fontSize:48,marginBottom:12}}>📭</div>
          <p style={{color:C.muted}}>No schedules published yet.</p>
        </div>
      )}
      {selWeek&&!schedule&&<p style={{color:C.muted}}>No data for this week.</p>}
      {schedule&&(
        <>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
            <Chip color={C.green} bg={C.greenL}>Published {new Date(schedule.publishedAt).toLocaleDateString()}</Chip>
            <Chip color={C.accent} bg={C.accentL}>{(schedule.shifts||[]).length} shifts</Chip>
          </div>
          <ScheduleGrid shifts={schedule.shifts}/>
        </>
      )}
    </div>
  );
}

// ─── ADMIN: SUBMISSIONS ───────────────────────────────────────────────────────
function AdminSubmissions({availability,currentWeek,push,staffSkills}){
  const[fw,setFw]=useState(currentWeek||"");
  const weeks=[...new Set(availability.map(a=>a.week))].sort();
  const filtered=fw?availability.filter(a=>a.week===fw):availability;
  const grouped=filtered.reduce((acc,a)=>{(acc[a.week]=acc[a.week]||[]).push(a);return acc;},{});
  return(
    <div>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20,flexWrap:"wrap"}}>
        <SectionTitle>Submissions</SectionTitle>
        <div style={{marginLeft:"auto"}}>
          <select value={fw} onChange={e=>setFw(e.target.value)}
            style={{background:C.white,border:`1px solid ${C.border2}`,borderRadius:8,
              padding:"8px 12px",color:C.text,fontSize:13,fontFamily:"'DM Sans',sans-serif"}}>
            <option value="">All weeks</option>
            {weeks.map(w=><option key={w}>{w}</option>)}
          </select>
        </div>
      </div>
      {fw&&<SubStatusBar availability={availability} staffSkills={staffSkills} currentWeek={fw}
        onRemind={p=>push(`Reminder sent to ${p.length} staff for week ${fw}`,"warn","Reminder Sent")}/>}
      {availability.length===0&&(
        <div style={{textAlign:"center",padding:"64px 32px"}}>
          <div style={{fontSize:48,marginBottom:12}}>📥</div>
          <p style={{color:C.muted}}>No submissions yet.</p>
        </div>
      )}
      {Object.entries(grouped).map(([week,entries])=>(
        <div key={week} style={{marginBottom:24}}>
          <div style={{fontWeight:700,fontSize:14,color:C.accent,marginBottom:10,
            display:"flex",alignItems:"center",gap:8}}>
            📅 {week}
            <Chip color={C.green} bg={C.greenL}>{entries.length} submitted</Chip>
            <Chip color={C.red} bg={C.redL}>{Object.keys(staffSkills).length-entries.length} pending</Chip>
          </div>
          {entries.map((e,i)=>{
            const slots=Object.entries(e.selected).filter(([,v])=>v);
            return(
              <Card key={i} style={{marginBottom:8,padding:"14px 18px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",marginBottom:8}}>
                  <div style={{fontWeight:700,color:C.text}}>{e.name}</div>
                  <div style={{fontSize:11,color:C.muted}}>{new Date(e.submittedAt).toLocaleString()}</div>
                </div>
                <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:e.requests?8:0}}>
                  {slots.map(([k])=>{const[d,s]=k.split("|");
                    return <Chip key={k} color={s==="Lunch"?C.yellow:C.accent}
                      bg={s==="Lunch"?C.yellowL:C.accentL} sz={10}>{d} {s==="Lunch"?"☀️":"🌙"}</Chip>;
                  })}
                  {slots.length===0&&<span style={{color:C.muted,fontSize:12}}>No slots</span>}
                </div>
                {e.requests&&<div style={{fontSize:12,color:C.sub,background:C.bg,
                  borderRadius:6,padding:"6px 10px"}}>💬 {e.requests}</div>}
              </Card>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ─── ADMIN: LABOR COST ────────────────────────────────────────────────────────
function AdminLaborCost({published,currentWeek}){
  const[leaderH,setLeaderH]=useState(50);
  const[dailySales,setDailySales]=useState(3500);
  const LRATE=21.46,CRATE=16,INS=511.85*2,TAX=.17;

  // Count actual crew shifts from published schedule if available
  const schedule=published.find(s=>s.week===currentWeek);
  const actualShifts=schedule?(schedule.shifts||[]).reduce((a,sh)=>a+(sh.workers?.length||0),0):null;
  const[crewShifts,setCrewShifts]=useState(28);
  useEffect(()=>{if(actualShifts!==null)setCrewShifts(actualShifts);},[actualShifts]);

  const crewH=crewShifts*6;
  const leaderW=leaderH*LRATE;
  const crewW=crewH*CRATE;
  const wages=leaderW+crewW;
  const total=wages+INS+(wages*TAX);
  const weeklySales=dailySales*7;
  const pct=weeklySales>0?total/weeklySales*100:0;
  const perShift=crewShifts>0?(crewW/crewShifts):0;

  const stats=[
    {label:"Total Weekly Labor",value:`$${total.toLocaleString("en-US",{maximumFractionDigits:0})}`,color:C.accent,big:true},
    {label:"Labor %",value:`${pct.toFixed(1)}%`,color:pct>35?C.red:pct>28?C.yellow:C.green,big:true},
    {label:"Crew Hours",value:`${crewH}h`,color:C.sub},
    {label:"Cost / Shift",value:`$${perShift.toFixed(0)}`,color:C.sub},
  ];

  const rows=[
    ["Store Leader",`${leaderH}h × $${LRATE}`,leaderW],
    ["Crew Wages",`${crewH}h × $${CRATE} (${crewShifts} shifts)`,crewW],
    ["Health Insurance","2 insured × $511.85",INS],
    ["Payroll Tax 17%",`on $${wages.toFixed(0)} wages`,wages*TAX],
  ];

  return(
    <div style={{maxWidth:700}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:8}}>
        <div>
          <SectionTitle>Labor Cost</SectionTitle>
          <p style={{color:C.sub,fontSize:13,marginTop:2}}>人件費シミュレーション · Week {currentWeek}</p>
        </div>
        {actualShifts!==null&&<Chip color={C.green} bg={C.greenL}>Auto-filled from published schedule</Chip>}
      </div>

      {/* Stat cards */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:12,marginBottom:24}}>
        {stats.map(s=>(
          <Card key={s.label} style={{padding:"14px 16px",textAlign:"center"}}>
            <div style={{fontSize:s.big?26:20,fontWeight:800,color:s.color,
              fontVariantNumeric:"tabular-nums",marginBottom:4}}>{s.value}</div>
            <div style={{fontSize:11,color:C.muted}}>{s.label}</div>
          </Card>
        ))}
      </div>

      {/* Inputs */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:20}}>
        {[["Leader Hours/Wk",leaderH,setLeaderH,"h"],
          ["Crew Shifts/Wk",crewShifts,setCrewShifts,"shifts"],
          ["Daily Sales Budget",dailySales,setDailySales,"$"]].map(([l,v,s,u])=>(
          <Card key={l} style={{padding:14}}>
            <Label>{l}</Label>
            <div style={{display:"flex",alignItems:"center",gap:4}}>
              {u==="$"&&<span style={{color:C.muted,fontWeight:600}}>$</span>}
              <input type="number" value={v} onChange={e=>s(Number(e.target.value))}
                style={{width:"100%",background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,
                  padding:"8px 10px",fontSize:18,fontWeight:700,color:C.accent,
                  textAlign:"right",fontFamily:"'DM Sans',sans-serif"}}/>
              {u!=="$"&&<span style={{color:C.muted,fontSize:12,whiteSpace:"nowrap"}}>{u}</span>}
            </div>
          </Card>
        ))}
      </div>

      {/* Breakdown table */}
      <Card style={{padding:0,overflow:"hidden",marginBottom:16}}>
        {rows.map(([l,d,a],i)=>(
          <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
            padding:"14px 20px",borderBottom:`1px solid ${C.border}`}}>
            <div>
              <div style={{fontWeight:600,color:C.text,fontSize:14}}>{l}</div>
              <div style={{fontSize:11,color:C.muted}}>{d}</div>
            </div>
            <div style={{fontWeight:700,fontSize:16,color:C.text,fontVariantNumeric:"tabular-nums"}}>
              ${a.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}
            </div>
          </div>
        ))}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
          padding:"18px 20px",background:C.bg}}>
          <span style={{fontWeight:800,fontSize:15,color:C.text}}>Total Weekly Labor Cost</span>
          <span style={{fontWeight:800,fontSize:24,color:C.accent,fontVariantNumeric:"tabular-nums"}}>
            ${total.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}
          </span>
        </div>
      </Card>

      {/* Labor % bar */}
      <Card style={{padding:18}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <span style={{fontWeight:600,color:C.text}}>Labor Cost %</span>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontWeight:900,fontSize:28,color:pct>35?C.red:pct>28?C.yellow:C.green,
              fontVariantNumeric:"tabular-nums"}}>{pct.toFixed(1)}%</span>
            <Chip color={pct>35?C.red:pct>28?C.yellow:C.green}
              bg={pct>35?C.redL:pct>28?C.yellowL:C.greenL}>
              {pct>35?"High":pct>28?"Watch":"Good"}
            </Chip>
          </div>
        </div>
        <div style={{background:C.border,borderRadius:99,height:10,overflow:"hidden",marginBottom:8}}>
          <div style={{height:"100%",borderRadius:99,transition:"width .6s",
            width:`${Math.min(pct,100)}%`,
            background:pct>35?C.red:pct>28?C.yellow:C.green}}/>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:C.muted}}>
          <span>Weekly Sales: ${weeklySales.toLocaleString()}</span>
          <span>🎯 Target &lt;28%</span>
        </div>
      </Card>
    </div>
  );
}

// ─── ADMIN: SKILL EDITOR ──────────────────────────────────────────────────────
function AdminSkills({staffSkills,staffRules,saveSkill,removeSkill,push}){
  const[q,setQ]=useState("");
  const[editing,setEditing]=useState(null); // name being edited
  const[editVals,setEditVals]=useState({});
  const[editRule,setEditRule]=useState({});
  const[addMode,setAddMode]=useState(false);
  const[newName,setNewName]=useState("");

  const staff=Object.keys(staffSkills).filter(n=>n.toLowerCase().includes(q.toLowerCase()))
    .sort((a,b)=>(calcTotal(staffSkills[b])||0)-(calcTotal(staffSkills[a])||0));

  const startEdit=(name)=>{
    setEditing(name);
    setEditVals({...staffSkills[name]});
    setEditRule({...staffRules[name]||{min:2,max:4,consecutive:false,avoid:""}});
  };
  const saveEdit=()=>{
    saveSkill(editing, {...editVals}, {...editRule, avoid:editRule.avoid||null});
    push(`${editing}'s profile updated`,"success","Skills Updated");
    setEditing(null);
  };
  const addStaff=()=>{
    if(!newName.trim())return;
    const blank=SKILL_KEYS.reduce((a,k)=>({...a,[k]:0}),{});
    saveSkill(newName.trim(), blank, {min:2,max:4,consecutive:false,avoid:null});
    push(`${newName} added`,"success","Staff Added");
    setNewName("");setAddMode(false);
    startEdit(newName.trim());
  };
  const removeStaffMember=(name)=>{
    if(!window.confirm(`Remove ${name}?`))return;
    removeSkill(name);
    push(`${name} removed`,"warn","Staff Removed");
  };

  return(
    <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20,flexWrap:"wrap"}}>
        <SectionTitle>Staff Skills</SectionTitle>
        <div style={{marginLeft:"auto",display:"flex",gap:8}}>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search…"
            style={{background:C.white,border:`1px solid ${C.border2}`,borderRadius:8,
              padding:"8px 12px",fontSize:13,fontFamily:"'DM Sans',sans-serif",width:180}}/>
          <Btn sm color={C.green} onClick={()=>setAddMode(true)}>+ Add Staff</Btn>
        </div>
      </div>

      {/* Add staff form */}
      {addMode&&(
        <Card style={{marginBottom:16,padding:"14px 18px",
          border:`1px solid ${C.green}44`,background:C.greenL}}>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <Input value={newName} onChange={setNewName} placeholder="Full Name"/>
            <Btn sm color={C.green} onClick={addStaff}>Add</Btn>
            <Btn sm color={C.muted} outline onClick={()=>setAddMode(false)}>Cancel</Btn>
          </div>
        </Card>
      )}

      {/* Edit modal overlay */}
      {editing&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.4)",zIndex:300,
          display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
          <div style={{background:C.white,borderRadius:16,padding:28,width:"100%",maxWidth:560,
            maxHeight:"90vh",overflowY:"auto",boxShadow:C.sh2}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <h3 style={{fontFamily:"'Sora',sans-serif",fontSize:18,fontWeight:800,color:C.text}}>
                Edit: {editing}
              </h3>
              <button onClick={()=>setEditing(null)} style={{background:C.bg,border:`1px solid ${C.border}`,
                borderRadius:8,width:32,height:32,cursor:"pointer",fontSize:16,
                display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
            </div>

            {/* Skill sliders */}
            <div style={{marginBottom:20}}>
              <div style={{fontWeight:700,fontSize:12,color:C.sub,letterSpacing:.8,
                textTransform:"uppercase",marginBottom:12}}>Skill Levels (0–3)</div>
              {SKILL_KEYS.map(k=>(
                <div key={k} style={{display:"grid",gridTemplateColumns:"120px 1fr 40px",
                  gap:12,alignItems:"center",marginBottom:10}}>
                  <div style={{fontSize:13,fontWeight:600,color:C.text}}>{SKILL_LABELS[k]}</div>
                  <div style={{display:"flex",gap:4}}>
                    {[0,1,2,3].map(v=>(
                      <button key={v} onClick={()=>setEditVals(p=>({...p,[k]:v}))}
                        style={{flex:1,padding:"8px 0",borderRadius:7,border:"none",cursor:"pointer",
                          fontWeight:700,fontSize:13,fontFamily:"'DM Sans',sans-serif",
                          background:editVals[k]===v?lvc(v):"#f2f4f7",
                          color:editVals[k]===v?"#fff":C.muted,
                          boxShadow:editVals[k]===v?`0 2px 6px ${lvc(v)}44`:"none",
                          transition:"all .12s"}}>{v}</button>
                    ))}
                  </div>
                  <LvBadge level={editVals[k]}/>
                </div>
              ))}
              <div style={{marginTop:12,padding:"10px 14px",background:C.accentL,borderRadius:8,
                display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontWeight:700,color:C.accent}}>Total Score</span>
                <span style={{fontWeight:800,fontSize:20,color:C.accent}}>{calcTotal(editVals)}</span>
              </div>
            </div>

            {/* Rule settings */}
            <div style={{borderTop:`1px solid ${C.border}`,paddingTop:16,marginBottom:20}}>
              <div style={{fontWeight:700,fontSize:12,color:C.sub,letterSpacing:.8,
                textTransform:"uppercase",marginBottom:12}}>Shift Rules</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                <div>
                  <Label>Min Shifts / Week</Label>
                  <input type="number" value={editRule.min||0} onChange={e=>setEditRule(p=>({...p,min:Number(e.target.value)}))}
                    style={{width:"100%",background:C.white,border:`1px solid ${C.border2}`,
                      borderRadius:8,padding:"9px 12px",fontSize:14,fontFamily:"'DM Sans',sans-serif"}}/>
                </div>
                <div>
                  <Label>Max Shifts / Week</Label>
                  <input type="number" value={editRule.max||0} onChange={e=>setEditRule(p=>({...p,max:Number(e.target.value)}))}
                    style={{width:"100%",background:C.white,border:`1px solid ${C.border2}`,
                      borderRadius:8,padding:"9px 12px",fontSize:14,fontFamily:"'DM Sans',sans-serif"}}/>
                </div>
              </div>
              <div style={{marginBottom:10}}>
                <Label>Avoid Same Shift As</Label>
                <select value={editRule.avoid||""} onChange={e=>setEditRule(p=>({...p,avoid:e.target.value||null}))}
                  style={{width:"100%",background:C.white,border:`1px solid ${C.border2}`,
                    borderRadius:8,padding:"9px 12px",fontSize:14,fontFamily:"'DM Sans',sans-serif"}}>
                  <option value="">— None —</option>
                  {Object.keys(staffSkills).filter(n=>n!==editing).map(n=><option key={n}>{n}</option>)}
                </select>
              </div>
              <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",
                fontSize:13,color:C.text,fontWeight:500}}>
                <input type="checkbox" checked={!!editRule.consecutive}
                  onChange={e=>setEditRule(p=>({...p,consecutive:e.target.checked}))}
                  style={{width:16,height:16}}/>
                Allow consecutive shifts
              </label>
            </div>

            <div style={{display:"flex",gap:10}}>
              <Btn color={C.accent} onClick={saveEdit} full>Save Changes</Btn>
              <Btn color={C.muted} outline onClick={()=>setEditing(null)}>Cancel</Btn>
            </div>
          </div>
        </div>
      )}

      {/* Staff table */}
      <Card style={{padding:0,overflow:"hidden"}}>
        <div style={{display:"grid",gridTemplateColumns:"160px repeat(7,1fr) 60px 80px",
          background:C.bg,borderBottom:`1px solid ${C.border}`}}>
          {["Name","Plater","Miso","Host","Supp","Prep","Energy","Lead","Total",""].map(h=>(
            <div key={h} style={{padding:"10px 10px",color:C.muted,fontSize:11,fontWeight:700,
              letterSpacing:.5,textTransform:"uppercase"}}>{h}</div>
          ))}
        </div>
        {staff.length===0&&<div style={{padding:32,textAlign:"center",color:C.muted}}>No staff found</div>}
        {staff.map((name,i)=>{
          const s=staffSkills[name];
          const r=staffRules[name];
          const tot=calcTotal(s);
          return(
            <div key={name} style={{display:"grid",gridTemplateColumns:"160px repeat(7,1fr) 60px 80px",
              borderBottom:`1px solid ${C.border}`,background:i%2===0?C.white:"#fafbfc",
              transition:"background .1s"}}>
              <div style={{padding:"10px 12px",display:"flex",alignItems:"center",gap:5}}>
                {tot>=15&&<span style={{color:C.green,fontSize:11}}>★</span>}
                <span style={{fontSize:13,color:C.text,fontWeight:500}}>{name}</span>
              </div>
              {SKILL_KEYS.map(k=>(
                <div key={k} style={{padding:8}}><LvBadge level={s[k]}/></div>
              ))}
              <div style={{padding:8,textAlign:"center"}}>
                <span style={{fontWeight:800,fontSize:15,
                  color:tot>=18?C.green:tot>=13?C.accent:tot>=8?C.yellow:C.red}}>{tot}</span>
              </div>
              <div style={{padding:8,display:"flex",gap:4,alignItems:"center"}}>
                <button onClick={()=>startEdit(name)}
                  style={{background:C.accentL,color:C.accent,border:"none",borderRadius:6,
                    padding:"5px 10px",fontSize:11,fontWeight:700,cursor:"pointer",
                    fontFamily:"'DM Sans',sans-serif"}}>Edit</button>
                <button onClick={()=>removeStaffMember(name)}
                  style={{background:C.redL,color:C.red,border:"none",borderRadius:6,
                    padding:"5px 7px",fontSize:11,cursor:"pointer"}}>✕</button>
              </div>
            </div>
          );
        })}
      </Card>

      <div style={{display:"flex",gap:6,marginTop:12,flexWrap:"wrap"}}>
        {[[3,"Lv3 Expert"],[2,"Lv2 Proficient"],[1,"Lv1 Learning"],[0,"Lv0 New"]].map(([l,label])=>(
          <Chip key={l} color={lvc(l)} bg={lvb(l)}>{label}</Chip>
        ))}
        <Chip color={C.green} bg={C.greenL}>★ 15+ = Certified</Chip>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
const ADMIN_TABS=[
  {id:"builder",  label:"📅 Shift Builder"},
  {id:"schedule", label:"🗓 Schedule View"},
  {id:"submissions",label:"📋 Submissions"},
  {id:"labor",    label:"💰 Labor Cost"},
  {id:"skills",   label:"👥 Staff Skills"},
];
const STAFF_TABS=[
  {id:"avail",    label:"📝 My Availability"},
  {id:"schedule", label:"📅 My Schedule"},
];

export default function App(){
  const[auth,setAuth]=useState(null);
  const[activeTab,setActiveTab]=useState("builder");
  const[currentWeek,setCurrentWeek]=useState("6/7–6/13");
  const[availability,setAvailability]=useState([]);
  const[published,setPublished]=useState([]);
  const[staffSkills,setStaffSkills]=useState(INIT_SKILLS);
  const[staffRules,setStaffRules]=useState(INIT_RULES);
  const[notifs,setNotifs]=useState([]);
  const[dbLoading,setDbLoading]=useState(false);
  const{toasts,push:rawPush}=useToast();
  const navRef=useRef();

  const push=useCallback((msg,type="info",title="")=>{
    rawPush(msg,type,title);
    setNotifs(p=>[...p,{msg,type,title,time:new Date().toLocaleTimeString(),read:false}]);
  },[rawPush]);

  // ── Load from Supabase on mount ──────────────────────────────────────────
  useEffect(()=>{
    async function loadAll(){
      setDbLoading(true);
      try{
        const[avail,scheds,skillData]=await Promise.all([
          fetchAvailability(),
          fetchSchedules(),
          fetchStaffSkills(),
        ]);
        setAvailability(avail);
        setPublished(scheds);
        if(Object.keys(skillData.skills).length>0){
          setStaffSkills(skillData.skills);
          setStaffRules(skillData.rules);
        }
      }catch(e){
        console.warn("Supabase load failed, running offline:",e.message);
      }finally{
        setDbLoading(false);
      }
    }
    loadAll();
  },[]);

  // ── Realtime: re-fetch availability when any row changes ────────────────
  useEffect(()=>{
    const sub=subscribeAvailability(null, async()=>{
      const avail=await fetchAvailability().catch(()=>null);
      if(avail) setAvailability(avail);
    });
    return()=>supabase.removeChannel(sub);
  },[]);

  // ── Realtime: re-fetch schedules when published ────────────────────────
  useEffect(()=>{
    const sub=subscribeSchedules(async()=>{
      const scheds=await fetchSchedules().catch(()=>null);
      if(scheds) setPublished(scheds);
    });
    return()=>supabase.removeChannel(sub);
  },[]);

  // ── Wrapped setters that sync to Supabase ──────────────────────────────
  const saveAvailability=useCallback(async(entry)=>{
    // Optimistic update
    setAvailability(p=>[...p.filter(a=>!(a.name===entry.name&&a.week===entry.week)),entry]);
    try{ await upsertAvailability(entry); }
    catch(e){ console.warn("Failed to save availability:",e.message); }
  },[]);

  const saveSchedule=useCallback(async(schedule)=>{
    setPublished(p=>[...p.filter(s=>s.week!==schedule.week),schedule]);
    try{ await upsertSchedule(schedule); }
    catch(e){ console.warn("Failed to save schedule:",e.message); }
  },[]);

  const saveSkill=useCallback(async(name,skills,rule)=>{
    setStaffSkills(p=>({...p,[name]:skills}));
    setStaffRules(p=>({...p,[name]:rule}));
    try{ await upsertStaffSkill({name,skills,rule}); }
    catch(e){ console.warn("Failed to save skill:",e.message); }
  },[]);

  const removeSkill=useCallback(async(name)=>{
    setStaffSkills(p=>{const n={...p};delete n[name];return n;});
    setStaffRules(p=>{const n={...p};delete n[name];return n;});
    try{ await deleteStaffSkill(name); }
    catch(e){ console.warn("Failed to delete staff:",e.message); }
  },[]);

  const logout=()=>{setAuth(null);setActiveTab("builder");};

  if(!auth) return <LoginScreen onLogin={(role,name)=>{setAuth({role,name});
    setActiveTab(role==="admin"?"builder":"avail");}}/>;

  const isAdmin=auth.role==="admin";
  const tabs=isAdmin?ADMIN_TABS:STAFF_TABS;
  const submitted=!isAdmin&&!!availability.find(a=>a.name===auth.name&&a.week===currentWeek);

  return(
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'DM Sans',sans-serif",color:C.text}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        input,select,textarea{outline:none;font-family:'DM Sans',sans-serif}
        input:focus,select:focus,textarea:focus{border-color:${C.accent}!important;box-shadow:0 0 0 3px ${C.accent}18}
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-thumb{background:${C.border2};border-radius:3px}
        select option{background:${C.white}}
        button:focus{outline:none}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
      `}</style>
      <Toaster toasts={toasts}/>

      {/* TOP NAV */}
      <div ref={navRef} style={{background:C.white,borderBottom:`1px solid ${C.border}`,
        padding:"0 20px",display:"flex",alignItems:"stretch",gap:0,
        position:"sticky",top:0,zIndex:100,boxShadow:C.sh,minHeight:52}}>

        {/* Logo */}
        <div style={{display:"flex",alignItems:"center",gap:8,paddingRight:16,marginRight:8,
          borderRight:`1px solid ${C.border}`,flexShrink:0}}>
          <div style={{width:30,height:30,background:C.accent,borderRadius:8,
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:15}}>🍱</div>
          <div style={{display:"none",flexDirection:"column"}}>
            <div style={{fontFamily:"'Sora',sans-serif",fontWeight:800,fontSize:12,color:C.text,lineHeight:1.1}}>TOTOYA</div>
            <div style={{fontSize:9,color:C.muted}}>Aiea</div>
          </div>
          <div style={{fontFamily:"'Sora',sans-serif",fontWeight:800,fontSize:13,color:C.text}}>TOTOYA Aiea</div>
        </div>

        {/* Week pill (admin) */}
        {isAdmin&&(
          <div style={{display:"flex",alignItems:"center",gap:6,padding:"0 14px",
            borderRight:`1px solid ${C.border}`,flexShrink:0}}>
            <span style={{fontSize:10,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:.5}}>Week</span>
            <input value={currentWeek} onChange={e=>setCurrentWeek(e.target.value)}
              style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,
                padding:"4px 8px",fontSize:12,fontWeight:600,color:C.text,width:110}}/>
          </div>
        )}

        {/* Tabs — scrollable */}
        <div style={{display:"flex",overflowX:"auto",flex:1,
          scrollbarWidth:"none",msOverflowStyle:"none"}}>
          <style>{`.navscroll::-webkit-scrollbar{display:none}`}</style>
          <div className="navscroll" style={{display:"flex",minWidth:"max-content"}}>
            {tabs.map(t=>(
              <button key={t.id} onClick={()=>setActiveTab(t.id)}
                style={{background:"transparent",border:"none",cursor:"pointer",
                  color:activeTab===t.id?C.accent:C.sub,
                  padding:"0 14px",fontSize:13,fontWeight:activeTab===t.id?700:500,
                  borderBottom:activeTab===t.id?`2px solid ${C.accent}`:"2px solid transparent",
                  fontFamily:"'DM Sans',sans-serif",transition:"all .12s",whiteSpace:"nowrap",
                  minHeight:52}}>{t.label}</button>
            ))}
          </div>
        </div>

        {/* Right side */}
        <div style={{display:"flex",alignItems:"center",gap:8,paddingLeft:12,
          borderLeft:`1px solid ${C.border}`,flexShrink:0}}>
          {/* Staff submission dot */}
          {!isAdmin&&(
            <div style={{display:"flex",alignItems:"center",gap:5,
              background:submitted?C.greenL:C.yellowL,
              border:`1px solid ${submitted?C.green:C.yellow}33`,
              borderRadius:7,padding:"4px 9px",fontSize:11,
              color:submitted?C.green:C.yellow,fontWeight:600}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:submitted?C.green:C.yellow,
                animation:submitted?"none":"pulse 1.5s ease-in-out infinite"}}/>
              {submitted?"Submitted":"Pending"}
            </div>
          )}
          {/* Admin notif bell */}
          {isAdmin&&<NotifBell notifs={notifs} onClear={()=>setNotifs([])}/>}
          {/* Role badge */}
          <div style={{background:isAdmin?C.accent2L:C.accentL,
            color:isAdmin?C.accent2:C.accent,
            border:`1px solid ${isAdmin?C.accent2:C.accent}22`,
            borderRadius:7,padding:"4px 10px",fontSize:11,fontWeight:700,flexShrink:0}}>
            {isAdmin?"🔐 Admin":`👤 ${auth.name.split(" ")[0]}`}
          </div>
          {/* Logout */}
          <button onClick={logout}
            style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,
              padding:"5px 11px",fontSize:11,color:C.sub,cursor:"pointer",
              fontFamily:"'DM Sans',sans-serif",fontWeight:600,flexShrink:0}}>
            Logout
          </button>
        </div>
      </div>

      {/* PAGE CONTENT */}
      <div style={{padding:"24px 20px",maxWidth:1160,margin:"0 auto"}}>

        {/* DB loading indicator */}
        {dbLoading&&(
          <div style={{background:C.accentL,border:`1px solid ${C.accent}22`,borderRadius:10,
            padding:"10px 16px",marginBottom:16,display:"flex",alignItems:"center",gap:8,fontSize:13,color:C.accent}}>
            <span style={{animation:"spin 1s linear infinite",display:"inline-block"}}>⟳</span>
            Loading data from server…
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        )}

        {/* Staff status banner */}
        {!isAdmin&&(
          <div style={{background:submitted?C.greenL:C.yellowL,
            border:`1px solid ${submitted?C.green:C.yellow}33`,
            borderRadius:12,padding:"12px 16px",marginBottom:20,
            display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:20}}>{submitted?"✅":"⏰"}</span>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:13,color:submitted?C.green:C.yellow}}>
                {submitted?"Availability Submitted!":"Please Submit Your Availability"}
              </div>
              <div style={{fontSize:12,color:C.sub}}>Week {currentWeek}</div>
            </div>
          </div>
        )}

        {/* Admin views */}
        {isAdmin&&activeTab==="builder"&&(
          <AdminShiftBuilder availability={availability} published={published}
            saveSchedule={saveSchedule} currentWeek={currentWeek} push={push}
            staffSkills={staffSkills} staffRules={staffRules}/>
        )}
        {isAdmin&&activeTab==="schedule"&&(
          <AdminScheduleView published={published}/>
        )}
        {isAdmin&&activeTab==="submissions"&&(
          <AdminSubmissions availability={availability} currentWeek={currentWeek}
            push={push} staffSkills={staffSkills}/>
        )}
        {isAdmin&&activeTab==="labor"&&(
          <AdminLaborCost published={published} currentWeek={currentWeek}/>
        )}
        {isAdmin&&activeTab==="skills"&&(
          <AdminSkills staffSkills={staffSkills} staffRules={staffRules}
            saveSkill={saveSkill} removeSkill={removeSkill} push={push}/>
        )}

        {/* Staff views */}
        {!isAdmin&&activeTab==="avail"&&(
          <StaffAvailability staffName={auth.name} availability={availability}
            saveAvailability={saveAvailability} currentWeek={currentWeek}
            push={push} staffRules={staffRules}/>
        )}
        {!isAdmin&&activeTab==="schedule"&&(
          <StaffMySchedule staffName={auth.name} published={published}/>
        )}
      </div>
    </div>
  );
}
