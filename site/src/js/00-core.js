/* ---------- state ---------- */
// Shared documents (the radar's own database; nothing is ever committed to the repository):
//   calls/*, meta/config, meta/weights, meta/profile, meta/profile-text, meta/run, meta/control.
// Private per viewer: data/users/<id>/marks (interested, applying, discarded).
const S={calls:[],config:null,weights:null,profile:null,profileText:null,run:null,control:null,marks:{},loaded:{calls:false,meta:false,marks:false},dbState:"loading",db:null,canEdit:false,uid:null};
const app=document.getElementById("app");
// Filled in by site/build.py: lazy libraries from site/vendor.json and the source packs from packs/.
const VENDOR_LAZY=/*@VENDOR_LAZY@*/{};
const PACKS=/*@PACKS@*/{};

const TYPES=[["project","Project"],["fellowship","Fellowship"],["mobility","Mobility"],["networking","Networking or event"],["infrastructure","Infrastructure"],["prize","Prize"],["other","Other"]];
const VERDICTS=[["eligible","Eligible"],["check","Check"],["not_eligible","Not eligible"]];
const STATUSES=[["new","New"],["changed","Changed"],["open","Open"],["closed","Closed"]];
const DISCARD=[["unreachable","Unreachable"],["not-interesting","Not interesting"],["not-eligible","Not eligible in practice"],["other","Other reason"]];
const STAGES=[["phd","PhD student"],["postdoc","Postdoc"],["senior","Senior researcher or lecturer"],["professor","Professor"],["other","Other"]];
const DEFAULT_WEIGHTS={topical:.5,skills:.3,practical:.2};
const DEFAULT_PREP={project:10,fellowship:8,mobility:6,networking:2,infrastructure:10,prize:3,other:4};
const COUNTRY_NAMES={EU:"EU",CH:"Switzerland",DE:"Germany",AT:"Austria",FR:"France",IT:"Italy",NL:"Netherlands",BE:"Belgium",ES:"Spain",PT:"Portugal",GB:"United Kingdom",UK:"United Kingdom",IE:"Ireland",DK:"Denmark",SE:"Sweden",NO:"Norway",FI:"Finland",PL:"Poland",CZ:"Czechia",US:"United States",CA:"Canada"};
const typeLabel=t=>(TYPES.find(x=>x[0]===t)||[0,"Other"])[1];
const verdictLabel=v=>(VERDICTS.find(x=>x[0]===v)||[0,"Check"])[1];
const countryName=c=>COUNTRY_NAMES[String(c||"").toUpperCase()]||String(c||"");

/* ---------- utils (shared with Research Radar) ---------- */
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const arr=v=>Array.isArray(v)?v:[];
const num=v=>typeof v==="number"&&isFinite(v)?v:null;
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const today=()=>new Date().toISOString().slice(0,10);
function fmtDate(d){if(!d)return"—";const t=Date.parse(String(d).length===10?d+"T12:00:00":d);if(isNaN(t))return esc(d);return new Date(t).toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"})}
function daysUntil(d){const t=Date.parse(String(d).slice(0,10)+"T23:59:59");return isNaN(t)?null:Math.ceil((t-Date.now())/864e5)}
function lsGet(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}}
function lsSet(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}
function ring(v,size){size=size||44;if(v==null)return `<svg class="ring lo${size>60?" big":""}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="Not scored yet"><circle cx="${size/2}" cy="${size/2}" r="${size/2-4}" class="trk"/><text x="50%" y="50%" dy=".35em" text-anchor="middle">–</text></svg>`;v=clamp(+v||0,0,100);const r=size/2-4,c=2*Math.PI*r,off=c*(1-v/100),cls=v>=75?"hi":v>=50?"mid":"lo";return `<svg class="ring ${cls}${size>60?" big":""}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="Affinity ${Math.round(v)} percent"><circle cx="${size/2}" cy="${size/2}" r="${r}" class="trk"/><circle cx="${size/2}" cy="${size/2}" r="${r}" class="val" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}" transform="rotate(-90 ${size/2} ${size/2})"/><text x="50%" y="50%" dy=".35em" text-anchor="middle">${Math.round(v)}</text></svg>`}
function linkOut(url,label){return /^https?:\/\//.test(url||"")?`<a href="${esc(url)}" target="_blank" rel="noopener">${esc(label||url.replace(/^https?:\/\//,"").slice(0,60))}</a>`:esc(label||url||"")}
function plural(n,one,many){return `${n} ${n===1?one:(many||one+"s")}`}

/* ---------- rules (mirrored in pipeline/fund/scoring.py and eligibility.py) ---------- */
function cfg(){return S.config||{}}
function siteName(){return cfg().siteName||"Fund Radar"}
function scheduleText(){return cfg().scheduleText||"weekly"}
function weights(){
  const w=Object.assign({},DEFAULT_WEIGHTS,S.weights||{});const v={};let t=0;
  for(const k of Object.keys(DEFAULT_WEIGHTS)){v[k]=Math.max(0,Number(w[k])||0);t+=v[k]}
  if(t<=0)return Object.assign({},DEFAULT_WEIGHTS);
  for(const k in v)v[k]=v[k]/t;return v;
}
// Weighted affinity 0-100 from the stored components; null when the call isn't fully scored.
function affinityOf(c,w){
  const s=c&&c.scores;if(!s)return null;w=w||weights();let a=0;
  for(const k of Object.keys(DEFAULT_WEIGHTS)){const v=num(s[k]);if(v==null)return null;a+=w[k]*clamp(v,0,100)}
  return Math.round(clamp(a+clamp(num(s.adjust)||0,-10,10),0,100));
}
// Accept the shapes a scan may write: eligibility as {items, verdict}, why/gaps inside scores.
function normalizeCall(c){
  const e=c.eligibility;
  if(e&&!Array.isArray(e)&&typeof e==="object"){c.eligibility=arr(e.items||e.conditions);if(!c.verdict&&e.verdict)c.verdict=e.verdict}
  const s=c.scores;
  if(s&&typeof s==="object"){if(!c.why&&typeof s.why==="string")c.why=s.why;if(!arr(c.gaps).length&&Array.isArray(s.gaps))c.gaps=s.gaps}
  if(!c.verdict)c.verdict=verdictOf(c.eligibility);
  return c;
}
function verdictOf(conds){const m=arr(conds).map(c=>c.mark||"unclear");if(!m.length)return"check";if(m.includes("not_met"))return"not_eligible";return m.every(x=>x==="met")?"eligible":"check"}
function nextDeadline(c){
  let best=null;const t=today();
  for(const d of arr(c.deadlines)){const v=String(d.date||"").slice(0,10);if(v&&v>=t&&(!best||v<best.date))best={date:v,stage:d.stage||"deadline"}}
  if(best)return best;if(c.rolling)return{date:null,stage:"rolling"};return null;
}
function prepWeeks(type){const p=Object.assign({},DEFAULT_PREP,cfg().prepWeeks||{});return num(p[type])??p.other}
function tooClose(c){const nd=nextDeadline(c);if(!nd||!nd.date)return false;const n=daysUntil(nd.date);return n!=null&&n<prepWeeks(c.type)*7}
function isClosed(c){return c.status==="closed"||!nextDeadline(c)}
function dueHtml(c){
  const nd=nextDeadline(c);
  if(!nd)return`<span class="due muted">Closed</span>`;
  if(!nd.date)return`<span class="due muted" title="Submission at any time or at recurring committee dates">Rolling</span>`;
  const n=daysUntil(nd.date),close=tooClose(c);
  const cls=close?"prep":n<=14?"soon":n<=45?"near":"";
  return `<span class="due ${cls}" title="${esc(nd.stage)} due ${esc(nd.date)}${close?` · less than your ${prepWeeks(c.type)}-week preparation time for a ${esc(typeLabel(c.type).toLowerCase())}`:""}">${fmtDate(nd.date)} · ${n===0?"today":n+"d left"}${close?" · tight":""}</span>`;
}
function amountText(c){const a=c.amount;if(!a)return"";if(a.text)return a.text;const f=v=>Number(v).toLocaleString();if(num(a.max)!=null&&num(a.min)!=null)return `${a.currency||""} ${f(a.min)}–${f(a.max)}`.trim();if(num(a.max)!=null)return `Up to ${a.currency||""} ${f(a.max)}`.replace("  "," ");return""}
function verdictBadge(v){v=v||"check";return `<span class="vd ${esc(v)}">${esc(verdictLabel(v))}</span>`}
function partsHtml(c){const s=c.scores||{};const p=(k,l)=>num(s[k])==null?"":`<span class="part" title="${l} fit ${Math.round(s[k])}"><span>${l[0]}</span><i style="--v:${clamp(s[k],0,100)}%"></i></span>`;return `<span class="parts" aria-label="Topical, skills and practical fit">${p("topical","Topical")}${p("skills","Skills")}${p("practical","Practical")}</span>`}
function isNewCall(c){return c.status==="new"}

/* ---------- writes ---------- */
const PR={msg:{}};
function msgLine(k){const m=PR.msg[k];return m?`<span class="tpmsg ${m.kind||""}" role="status">${esc(m.text)}</span>`:`<span class="tpmsg" role="status"></span>`}
function setMsg(k,text,kind){PR.msg[k]={text,kind};document.querySelectorAll(`[data-msg="${k}"]`).forEach(el=>{el.innerHTML=msgLine(k)})}
async function writeDoc(path,body){await S.db.doc(path).set(body);return body}
async function writeConfig(patch){const body=Object.assign({},S.config||{},patch,{updatedAt:new Date().toISOString()});await writeDoc("meta/config",body);S.config=body;return body}
async function writeControl(patch){const body=Object.assign({},S.control||{},patch);await writeDoc("meta/control",body);S.control=body;return body}
async function writeProfile(p,by){const body=Object.assign({},p,{updatedAt:new Date().toISOString(),updatedBy:by||"page"});await writeDoc("meta/profile",body);S.profile=body;return body}

/* ---------- shared blocks ---------- */
function loadingBlock(){return `<div class="empty"><span>Loading…</span></div>`}
function emptyBlock(t,s,extra){return `<div class="empty"><b>${esc(t)}</b><span style="max-width:58ch">${esc(s)}</span>${extra||""}</div>`}
// Checkbox dropdown (as in Research Radar's Contributions filters). sel = array of chosen values.
function mselSummary(opts,sel,allLabel){if(!sel.length)return allLabel;const names=sel.map(v=>(opts.find(o=>o[0]===v)||[0,v])[1]);return names.length<=2?names.join(" or "):`${names.length} selected`}
function msel(id,label,opts,sel,allLabel){
  const on=sel.length>0;const sum=mselSummary(opts,sel,allLabel);
  return `<div class="fld"><label>${esc(label)}</label><details class="msel${on?" on":""}" id="${id}"><summary>${esc(sum)}</summary><div class="mselbox">${opts.map(([v,l])=>`<label><input type="checkbox" data-msel="${id}" value="${esc(v)}"${sel.includes(v)?" checked":""}> ${esc(l)}</label>`).join("")||`<span class="muted" style="font-size:.84rem;padding:4px 6px">Nothing to pick yet</span>`}</div></details></div>`;
}
