/* ---------- scope & scans ---------- */
const ST={busy:false,dirty:false,tlOpen:new Set()};
const countryPacks=()=>Object.values(PACKS.countries||{}).sort((a,b)=>String(a.label).localeCompare(String(b.label)));
const packFor=cc=>(PACKS.countries||{})[String(cc||"").toLowerCase()]||null;

// The sources one scan reads (mirrors active_sources() in pipeline/fund/packs.py).
function activeSources(c){
  c=c||cfg();const over=c.sources||{};const on=s=>typeof over[s.id]==="boolean"?over[s.id]:s.default!==false;const out=[];
  const add=(s,pack,locked)=>out.push(Object.assign({},s,{pack,on:locked?true:on(s),locked:!!locked}));
  if(c.includeEU!==false&&PACKS.eu)PACKS.eu.sources.forEach(s=>add(s,"European Union"));
  for(const cc of arr(c.countries)){const p=packFor(cc);if(p)p.sources.forEach(s=>add(s,p.label))}
  const chosen=new Map(arr(c.institutions).map(i=>[i.id,i]));
  for(const cc of arr(c.countries)){const p=packFor(cc);if(!p)continue;for(const inst of arr(p.institutions)){const pick=chosen.get(inst.id);if(pick&&pick.role==="home"){const url=pick.fundingUrl||inst.fundingUrl;add({id:"inst-"+inst.id,label:inst.name+" (internal funds)",url:url||inst.site,how:url?"Internal funds open to members of this institution.":"The first scan finds this institution's funding page.",discover:!url},p.label,true)}}}
  for(const id of arr(c.communities)){const s=arr((PACKS.community||{}).sources).find(x=>x.id===id);if(s)add(s,"Community",true)}
  return out;
}

function renderSettings(){
  app.innerHTML=`<div class="pagehead"><div><h1>Scope &amp; scans</h1><p>What the weekly scan looks for, how calls are ranked, and what each scan found. Scans run ${esc(scheduleText())}.</p></div></div>
  <section class="block" id="st-scope">${scopeSection()}</section>
  <section class="block" id="st-sources">${sourcesSection()}</section>
  <section class="block" id="st-rank">${rankingSection()}</section>
  <section class="block" id="st-scan">${scanSection()}</section>
  <section class="block" id="st-data">${dataSection()}</section>`;
}

/* scope: countries, opportunity types, institutions, communities */
function scopeSection(){
  const c=cfg();const dis=S.canEdit?"":" disabled";const sel=arr(c.countries).map(x=>String(x).toUpperCase());
  const packed=countryPacks();const other=sel.filter(x=>!packFor(x));
  const types=arr(c.opportunityTypes);
  const chosen=new Map(arr(c.institutions).map(i=>[i.id,i]));
  const instRows=sel.map(packFor).filter(Boolean).map(p=>`<tr><th colspan="3" style="background:var(--bg)">${esc(p.label)}</th></tr>`+arr(p.institutions).map(i=>{const pick=chosen.get(i.id)||{};const url=pick.fundingUrl||i.fundingUrl;return `<tr><td>${esc(i.name)}<br><span class="muted" style="font-size:.78rem">${esc(i.kind||"")}</span></td><td><select data-inst="${esc(i.id)}" data-cc="${esc(p.country)}" aria-label="Role of ${esc(i.name)}"${dis}><option value="">Not scanned</option><option value="home"${pick.role==="home"?" selected":""}>Home institution</option><option value="target"${pick.role==="target"?" selected":""}>Target institution</option></select></td><td style="font-size:.8rem">${url?linkOut(url,"Funding page known"):`<span class="muted">Found by the first scan</span>`}</td></tr>`}).join("")).join("");
  const comm=arr((PACKS.community||{}).sources);
  return `<div class="sechead"><h2>Scope</h2><span class="muted" style="font-size:.8rem">Decides which sources are scanned</span></div>
  <form class="panel" onsubmit="return false" id="scope-form">
    <div class="q-grid">
      <div class="fld"><label>Countries</label><div class="srclist">${packed.map(p=>`<label class="chk"><input type="checkbox" data-country="${esc(p.country)}"${sel.includes(p.country)?" checked":""}${dis}> ${esc(p.label)}</label>`).join("")}
        <label class="chk"><input type="checkbox" id="sc-eu"${c.includeEU!==false?" checked":""}${dis}> European and international programmes</label></div></div>
      <div class="fld"><label for="sc-other">Other countries (ISO codes)</label><input type="text" id="sc-other" value="${esc(other.join(", "))}" placeholder="DE, NL"${dis}><span class="muted" style="font-size:.78rem">These have no source pack yet: the scan reports them, and docs/new-pack.md explains how to add one.</span></div>
      <div class="fld"><label for="sc-stage">Career stage</label><select id="sc-stage"${dis}><option value="">From my profile</option>${STAGES.map(([v,l])=>`<option value="${v}"${c.careerStage===v?" selected":""}>${l}</option>`).join("")}</select></div>
    </div>
    <div class="fld"><label>Opportunity types (none ticked: all)</label><div class="chkgrid">${TYPES.filter(t=>t[0]!=="other").map(([v,l])=>`<label class="chk"><input type="checkbox" data-otype="${v}"${types.includes(v)?" checked":""}${dis}> ${esc(l)}</label>`).join("")}</div><span class="muted" style="font-size:.78rem">Academic positions (postdoc, lecturer, professor) come in a later version.</span></div>
    <div class="fld"><label>Institutions</label>${instRows?`<p class="muted" style="margin:0 0 6px;font-size:.82rem">A <b>home</b> institution is scanned for internal funds (seed money, networking and event grants, travel grants). A <b>target</b> institution is a place you might move to; it counts as a possible host when a call requires one.</p><div class="tblwrap"><table class="insttbl"><thead><tr><th>Institution</th><th>Role</th><th>Funding page</th></tr></thead><tbody>${instRows}</tbody></table></div>`:`<p class="muted" style="margin:0;font-size:.86rem">Pick a country with a source pack to list its main universities.</p>`}</div>
    ${comm.length?`<div class="fld"><label>Research communities</label><div class="srclist">${comm.map(s=>`<label class="chk"><input type="checkbox" data-comm="${esc(s.id)}"${arr(c.communities).includes(s.id)?" checked":""}${dis}><span><b>${esc(s.label)}</b><br><span class="muted" style="font-size:.8rem">${esc(arr(s.fields).join(", "))}</span></span></label>`).join("")}</div></div>`:""}
    <div class="btnrow"><button type="button" class="btn primary" data-st="save-scope"${dis}>Save scope</button><span data-msg="scope">${msgLine("scope")}</span></div>
  </form>`;
}
function readScope(){
  const f=document.getElementById("scope-form");if(!f)return null;
  const packed=[...f.querySelectorAll("[data-country]:checked")].map(i=>i.dataset.country);
  const other=splitList((document.getElementById("sc-other")||{}).value).map(x=>x.toUpperCase()).filter(x=>/^[A-Z]{2}$/.test(x));
  const countries=[...new Set([...packed,...other])];
  const prev=new Map(arr(cfg().institutions).map(i=>[i.id,i]));
  const institutions=[...f.querySelectorAll("[data-inst]")].filter(s=>s.value&&countries.includes(s.dataset.cc)).map(s=>Object.assign({},prev.get(s.dataset.inst)||{},{id:s.dataset.inst,country:s.dataset.cc,role:s.value}));
  return{countries,includeEU:!!(document.getElementById("sc-eu")||{}).checked,careerStage:(document.getElementById("sc-stage")||{}).value||"",
    opportunityTypes:[...f.querySelectorAll("[data-otype]:checked")].map(i=>i.dataset.otype),institutions,communities:[...f.querySelectorAll("[data-comm]:checked")].map(i=>i.dataset.comm)};
}
async function saveScope(){
  const sc=readScope();if(!sc)return;
  if(!sc.countries.length&&!sc.includeEU){setMsg("scope","Pick at least one country or the European programmes.","err");return}
  try{await writeConfig(sc);ST.dirty=false;renderSettings();setMsg("scope","Scope saved. The next scan uses it.","ok")}
  catch(e){setMsg("scope","Couldn't save. You may not have permission to change this radar.","err")}
}

/* sources */
function sourcesSection(){
  const list=activeSources();const unread=new Map(arr(S.run&&S.run.unreadSources).map(u=>[u.id,u]));const dis=S.canEdit?"":" disabled";
  let h=`<div class="sechead"><h2>Sources</h2><span class="muted" style="font-size:.8rem">From the packs for your scope</span></div>`;
  if(!list.length)return h+emptyBlock("No sources yet","Save a scope above to see which sources the scan will read.");
  const groups=[...new Set(list.map(s=>s.pack))];
  h+=`<div class="maintgrid">${groups.map(g=>`<div class="panel"><h3>${esc(g)}</h3><div class="srclist">${list.filter(s=>s.pack===g).map(s=>{const u=unread.get(s.id);return `<label class="chk"><input type="checkbox" data-src="${esc(s.id)}"${s.on?" checked":""}${s.locked?" disabled title=\"Set in the scope above\"":dis}><span><b>${esc(s.label)}</b>${u?` <span class="pill crit" title="${esc(u.reason||"")}">Not read last scan</span>`:""}${s.discover?` <span class="pill amb">Page to be found</span>`:""}<br><span class="muted" style="font-size:.8rem">${esc(s.how||"")}</span>${s.url?`<br><span style="font-size:.78rem">${linkOut(s.url)}</span>`:""}</span></label>`}).join("")}</div></div>`).join("")}</div>
  <p class="muted" style="margin:0;font-size:.8rem">Sources are read through Chrome on your computer, so it must be on during a scan. A source that asks for a sign-in or shows a bot check is skipped and listed here; check it by hand. Calls found on several sources are merged, keeping the funder's own page as the main link.</p><div data-msg="src">${msgLine("src")}</div>`;
  return h;
}
async function toggleSource(id,on){
  const src=Object.assign({},cfg().sources||{});src[id]=on;
  try{await writeConfig({sources:src});setMsg("src",`${on?"On":"Off"} for future scans.`,"ok")}
  catch(e){setMsg("src","Couldn't save. You may not have permission to change this radar.","err");const s=document.getElementById("st-sources");if(s)s.innerHTML=sourcesSection()}
}

/* ranking: weights and preparation times */
function rankingSection(){
  const w=weights();const dis=S.canEdit?"":" disabled";const prep=Object.assign({},DEFAULT_PREP,cfg().prepWeeks||{});
  const row=(k,l)=>`<div class="wrow"><label for="w-${k}">${l}</label><input type="range" id="w-${k}" data-w="${k}" min="0" max="100" step="5" value="${Math.round(w[k]*100)}"${dis}><output id="w-${k}-v">${Math.round(w[k]*100)}%</output></div>`;
  return `<div class="sechead"><h2>Ranking</h2><span class="muted" style="font-size:.8rem">Changes re-rank the catalogue at once</span></div>
  <div class="maintgrid">
    <form class="panel" onsubmit="return false"><h3>Affinity weights</h3>
      <p class="muted" style="margin:0;font-size:.84rem">Affinity = topical fit × weight + skills fit × weight + practical fit × weight. The weights always add up to 100%.</p>
      ${row("topical","Topical fit")}${row("skills","Skills fit")}${row("practical","Practical fit")}
      <div class="btnrow"><button type="button" class="btn primary" data-st="save-weights"${dis}>Save weights</button><button type="button" class="btn" data-st="reset-weights"${dis}>Reset to 50 / 30 / 20</button><span data-msg="weights">${msgLine("weights")}</span></div>
    </form>
    <form class="panel" onsubmit="return false"><h3>Preparation time (weeks)</h3>
      <p class="muted" style="margin:0;font-size:.84rem">Calls whose deadline is closer than this are flagged as tight. The deadline never changes the affinity score.</p>
      <div class="preprow">${TYPES.map(([v,l])=>`<div class="fld"><label for="pw-${v}">${esc(l)}</label><input type="number" id="pw-${v}" data-prep="${v}" min="0" max="52" value="${esc(prep[v])}"${dis}></div>`).join("")}</div>
      <div class="btnrow"><button type="button" class="btn primary" data-st="save-prep"${dis}>Save preparation times</button><span data-msg="prep">${msgLine("prep")}</span></div>
    </form>
  </div>`;
}
function readWeights(){const o={};for(const k of Object.keys(DEFAULT_WEIGHTS))o[k]=Number((document.getElementById("w-"+k)||{}).value)||0;return o}
function showWeights(){const raw=readWeights();const t=Object.values(raw).reduce((a,b)=>a+b,0)||1;for(const k in raw){const o=document.getElementById(`w-${k}-v`);if(o)o.textContent=Math.round(raw[k]/t*100)+"%"}}
async function saveWeights(reset){
  const raw=reset?{topical:50,skills:30,practical:20}:readWeights();const t=Object.values(raw).reduce((a,b)=>a+b,0);
  if(!t){setMsg("weights","At least one weight must be above zero.","err");return}
  const body={};for(const k in raw)body[k]=Math.round(raw[k]/t*1000)/1000;body.updatedAt=new Date().toISOString();
  try{await writeDoc("meta/weights",body);S.weights=body;ST.dirty=false;const s=document.getElementById("st-rank");if(s)s.innerHTML=rankingSection();setMsg("weights","Saved. The catalogue uses the new weights.","ok")}
  catch(e){setMsg("weights","Couldn't save. You may not have permission to change this radar.","err")}
}
async function savePrep(){
  const p={};document.querySelectorAll("[data-prep]").forEach(i=>{const v=Number(i.value);if(isFinite(v)&&v>=0)p[i.dataset.prep]=Math.round(v)});
  try{await writeConfig({prepWeeks:p});ST.dirty=false;setMsg("prep","Saved.","ok")}catch(e){setMsg("prep","Couldn't save.","err")}
}

/* scans: requests, timeline, log */
function scanSection(){
  const run=S.run||{};const ctl=S.control||{};const hist=arr(run.history).slice().reverse();const dis=S.canEdit?"":" disabled";
  const stale=S.profile&&num(S.profile.revision)?S.calls.filter(c=>!isClosed(c)&&c.scoredProfileRevision!=null&&c.scoredProfileRevision<S.profile.revision).length:0;
  let h=`<div class="sechead"><h2>Scans</h2><span class="muted" style="font-size:.8rem">Runs ${esc(scheduleText())}</span></div>
  <div class="maintgrid">
    <form class="panel" onsubmit="return false"><h3>Request a scan</h3>
      ${stale?`<div class="notice changed">${plural(stale,"open call")} ${stale===1?"was":"were"} scored against an older profile. A rescore updates them.</div>`:""}
      <fieldset class="radios"><legend class="sr">Scan mode</legend>
        <label class="chk"><input type="radio" name="st-mode" value="incremental" checked${dis}><span><b>Weekly scan</b><br><span class="muted" style="font-size:.8rem">New and changed calls since the last run.</span></span></label>
        <label class="chk"><input type="radio" name="st-mode" value="rescore"${stale?" checked":""}${dis}><span><b>Rescore and scan</b><br><span class="muted" style="font-size:.8rem">Re-check eligibility and fit of every stored call against your current profile, then scan.</span></span></label>
        <label class="chk"><input type="radio" name="st-mode" value="full"${dis}><span><b>Full scan</b><br><span class="muted" style="font-size:.8rem">Read every source from scratch. Use it after changing the scope.</span></span></label>
      </fieldset>
      <div class="btnrow"><button type="button" class="btn primary" data-st="run-now"${dis}>Run now</button><button type="button" class="btn" data-st="queue"${dis}>Queue for the next scan</button></div>
      <div data-msg="scan">${msgLine("scan")}</div>
      ${ctl.status&&ctl.status!=="done"?`<p class="tpmsg" style="margin:0">Current request: ${esc(ctl.mode||"incremental")}${ctl.deriveProfile?" + profile":""}, ${esc(ctl.status)}${ctl.lastError?` (last error: ${esc(ctl.lastError)})`:""}.</p>`:ctl.lastResult?`<p class="muted" style="margin:0;font-size:.82rem">Last request: ${esc(ctl.lastResult)}</p>`:""}
    </form>
    <div class="panel"><h3>Last scan</h3>${run.lastRunAt?`<dl class="kv"><dt>Date</dt><dd>${fmtDate(String(run.lastRunAt).slice(0,10))}</dd><dt>Status</dt><dd>${esc(run.status||"—")}</dd>${run.counts?Object.entries(run.counts).map(([k,v])=>`<dt>${esc(k.replace(/([A-Z])/g," $1").toLowerCase())}</dt><dd>${esc(v)}</dd>`).join(""):""}</dl>${run.summary?`<p style="margin:0">${esc(run.summary)}</p>`:""}${arr(run.unreadSources).length?`<div class="notice"><b>Not read:</b> ${run.unreadSources.map(u=>`${esc(u.label||u.id)}${u.reason?` (${esc(u.reason)})`:""}`).join(" · ")}</div>`:""}${arr(run.issues).length?`<div class="notice"><b>Issues:</b> ${run.issues.map(esc).join(" · ")}</div>`:""}`:`<p class="muted" style="margin:0">No scans have run yet. Save your scope and profile, then press Run now.</p>`}</div>
  </div>`;
  // Scan timeline: one entry per run, with the calls first seen that day (as in Research Radar).
  const found={};for(const c of S.calls){const d=String((c.provenance||{}).firstSeen||"").slice(0,10);if(d)(found[d]=found[d]||[]).push(c)}
  const dates=[...new Set([...hist.map(r=>String(r.date||"").slice(0,10)).filter(Boolean),...Object.keys(found)])].sort((a,b)=>b.localeCompare(a));
  h+=`<div class="tlwrap"><div class="sechead"><h3>Scan timeline</h3><span class="muted" style="font-size:.8rem">What each scan found</span></div>`;
  if(!dates.length)h+=`<div class="empty"><span>No scans have run yet.</span></div>`;
  else h+=`<ol class="tline">`+dates.map(d=>{const rec=hist.find(r=>String(r.date||"").slice(0,10)===d)||{};const L=(found[d]||[]).slice().sort((x,y)=>(affinityOf(y)??-1)-(affinityOf(x)??-1));
    return `<li class="tl-item"><span class="tl-dot${rec.status==="failed"?" bad":""}" aria-hidden="true"></span><div class="tl-head"><b>${fmtDate(d)}</b>${rec.status?`<span class="pill${rec.status==="ok"?" acc":rec.status==="failed"?" crit":" amb"}">${esc(rec.status)}</span>`:""}<span class="muted">${plural(L.length,"call")} first seen${num(rec.sourcesUnread)?` · ${plural(rec.sourcesUnread,"source")} not read`:""}</span></div>${rec.note?`<p class="muted tl-note">${esc(rec.note)}</p>`:""}${L.length?`<details class="tl-list" data-tl="${esc(d)}"${ST.tlOpen.has(d)?" open":""}><summary>Show calls</summary><ul>${L.map(c=>`<li><a href="#call.${encodeURIComponent(c.id)}">${esc(c.title)}</a><span class="muted"> · ${esc(c.funder||"")}${affinityOf(c)!=null?` · ${affinityOf(c)}%`:""}</span></li>`).join("")}</ul></details>`:""}</li>`}).join("")+`</ol>`;
  return h+`</div>`;
}
async function requestScan(runNow){
  const mode=(document.querySelector('input[name="st-mode"]:checked')||{}).value||"incremental";
  ST.busy=true;setMsg("scan","Saving the request…");
  try{await writeControl({status:"queued",mode,requestedAt:new Date().toISOString(),requestedBy:"page",firedAt:null,lastError:null})}
  catch(e){ST.busy=false;setMsg("scan","Couldn't save the request. You may not have permission to change this radar.","err");return}
  if(!runNow){ST.busy=false;setMsg("scan","Queued for the next scheduled scan.","ok");return}
  setMsg("scan","Starting the scan… you may be asked to allow this page to use Claude Code Remote.");
  const r=await fireScan(`Requested from the page: mode=${mode}. Read meta/control and follow it.`);
  ST.busy=false;
  if(r.ok){try{await writeControl({firedAt:new Date().toISOString()})}catch(e){}setMsg("scan","Scan started. It runs in the background; new calls appear as they're written.","ok")}
  else setMsg("scan",r.msg+" The request stays queued for the next scheduled scan.","err");
}
// Copied from Research Radar: "Run now" fires the scheduled task through the Claude Code Remote connector.
async function fireScan(text){
  const trig=cfg().triggerId;if(!trig)return{ok:false,msg:"No scheduled task is linked to this radar."};
  let mcp=null;try{mcp=await window.claude.use("mcp")}catch(e){}
  if(!mcp)return{ok:false,msg:"Starting scans isn't available in this view."};
  try{await mcp.callTool("Claude Code Remote","fire_trigger",{trigger_id:trig,text},{cache:false});return{ok:true}}
  catch(e){
    const m={server_not_connected:"The Claude Code Remote connector isn't connected for your account. Add it in Claude's Settings → Connectors.",needs_reauth:"Reconnect Claude Code Remote in Claude's Settings → Connectors.",not_in_manifest:"This page isn't allowed to start scans. You can allow it from the page's Permissions menu.",approval_required:"The scan needs your approval to start.",blocked_by_policy:"Your organization doesn't allow pages to start scans.",tool_error:"The scheduled task refused to start"+(e&&e.message?`: ${e.message}`:"."),cancelled:"Cancelled."}[e&&e.code];
    try{await writeControl({lastError:(e&&e.code)||"error"})}catch(_){}
    return{ok:false,msg:m||"Couldn't start the scan right now."};
  }
}

/* your data */
function dataSection(){
  const trig=cfg().triggerId||"<task id>";
  return `<div class="sechead"><h2>Your data</h2></div>
  <div class="maintgrid">
    <div class="panel"><h3>Export</h3><p class="muted" style="margin:0;font-size:.84rem">One file with your scope, weights, profile, scan log, every call and your marks. It stays on your computer; nothing is committed to the repository.</p><div class="btnrow"><button type="button" class="btn" data-st="export">Download all data (JSON)</button><span data-msg="export">${msgLine("export")}</span></div></div>
    <div class="panel"><h3>Stop or delete</h3><p class="muted" style="margin:0;font-size:.84rem">A page cannot pause or delete its scheduled task. Send one of these messages in the artifact chat:</p>
      <div class="msgbox">Pause the scheduled task ${esc(trig)} for my Fund Radar "${esc(siteName())}".</div>
      <div class="msgbox">Delete the scheduled task ${esc(trig)} for my Fund Radar "${esc(siteName())}". Keep the artifact and its data.</div></div>
  </div>`;
}
async function exportData(){
  let dl=null;try{dl=await window.claude.use("downloads")}catch(e){}
  if(!dl){setMsg("export","Downloads aren't available in this view.","err");return}
  const data={format:"fund-radar/v1",exportedAt:new Date().toISOString(),site:{name:siteName()},config:S.config,weights:S.weights,profile:S.profile,run:S.run,calls:S.calls,marks:S.marks};
  try{await dl.save({filename:`fund-radar-${today()}.json`,data:JSON.stringify(data,null,1),mimeType:"application/json"});setMsg("export","Downloaded.","ok")}
  catch(e){setMsg("export","Couldn't download.","err")}
}
