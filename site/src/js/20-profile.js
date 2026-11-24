/* ---------- profile ---------- */
// The profile decides eligibility and fit. It is built from the user's portfolio site, ORCID, CV and
// LinkedIn export, then confirmed here. Scans only propose changes (meta/profile.pending); they never
// overwrite a confirmed profile. Extracted file text lives in meta/profile-text, inside this radar only.
const PF={editing:false,dirty:false,draft:null,docs:[],busy:false,showHidden:false};
const SOURCE_LABEL={portfolio:"website",linkedin:"LinkedIn",cv:"CV",orcid:"ORCID",scholar:"Scholar",questionnaire:"questionnaire",manual:"edited here"};
function fromTag(f){if(!f||!f.source)return"";return `<span class="fromtag">${esc(SOURCE_LABEL[f.source]||f.source)}${f.asOf?" · "+esc(String(f.asOf).slice(0,10)):""}</span>`}
const P=()=>S.profile||{};

function renderProfile(){
  const p=P();const confirmed=!!p.confirmedAt;const empty=!arr(p.researchAreas).length&&!p.name;
  let h=`<div class="pagehead"><div><h1>Profile</h1><p>Every call is checked and ranked against this profile. Fill it from your website, ORCID, CV and LinkedIn export, answer the short questionnaire, then confirm it.</p></div></div>`;
  if(empty)h+=`<div class="notice changed">Start with <b>Where your profile comes from</b>: add your links and files, then let Claude draft the profile.</div>`;
  else if(!confirmed)h+=`<div class="notice changed" id="pf-unconfirmed">This profile is a draft. Review it below and press <b>Confirm profile</b>; scans then rank calls against it.</div>`;
  if(p.pending&&arr(p.pending.changes).length)h+=`<section class="block" id="pf-pending">${pendingSection()}</section>`;
  h+=`<section class="block" id="pf-inputs">${inputsSection()}</section>`;
  h+=`<section class="block" id="pf-q">${questionnaireSection()}</section>`;
  h+=`<section class="block" id="pf-main">${PF.editing?profileEditor():profileView()}</section>`;
  h+=`<section class="block" id="pf-pubs">${publicationsSection()}</section>`;
  app.innerHTML=h;
}

/* pending changes proposed by a scan */
function shortVal(v){if(v==null||v==="")return"(empty)";if(typeof v==="string")return v;if(Array.isArray(v))return v.map(shortVal).join("; ");if(typeof v==="object")return Object.values(v).filter(x=>x!=null&&typeof x!=="object").join(" · ");return String(v)}
function pendingSection(){
  const pd=P().pending;const ch=arr(pd.changes);
  return `<div class="notice pending"><b>${plural(ch.length,"proposed change")}</b> from your ${esc(SOURCE_LABEL[pd.from]||pd.from||"sources")}${pd.proposedAt?`, found ${fmtDate(String(pd.proposedAt).slice(0,10))}`:""}. Nothing changes until you accept it.</div>
  <ul class="pendlist">${ch.map((c,i)=>`<li><div><b style="font-weight:500">${esc(c.label||c.path)}</b><div class="val">${c.old!=null?`${esc(shortVal(c.old))} → `:""}${esc(shortVal(c.new))}</div></div><div class="btnrow"><button type="button" class="btn primary" data-pf="accept" data-i="${i}"${S.canEdit?"":" disabled"}>Accept</button><button type="button" class="btn" data-pf="reject" data-i="${i}"${S.canEdit?"":" disabled"}>Reject</button></div></li>`).join("")}</ul>
  <div class="btnrow"><button type="button" class="btn" data-pf="accept-all"${S.canEdit?"":" disabled"}>Accept all</button><button type="button" class="btn" data-pf="reject-all"${S.canEdit?"":" disabled"}>Reject all</button><span data-msg="pend">${msgLine("pend")}</span></div>`;
}
function applyChange(p,c){
  const path=String(c.path||"").split(".").filter(Boolean);if(!path.length)return p;
  const out=JSON.parse(JSON.stringify(p));let o=out;
  for(const k of path.slice(0,-1)){if(o[k]==null||typeof o[k]!=="object")o[k]={};o=o[k]}
  const last=path[path.length-1];
  if(Array.isArray(o[last])&&c.old==null&&c.new&&!Array.isArray(c.new))o[last]=o[last].concat([c.new]);
  else o[last]=c.new;
  return out;
}
async function resolvePending(which,accept){
  const p=P();const ch=arr(p.pending&&p.pending.changes);const pick=which==="all"?ch.map((_,i)=>i):[Number(which)];
  let next=Object.assign({},p);let applied=0;
  if(accept)for(const i of pick){if(ch[i]){next=applyChange(next,ch[i]);applied++}}
  const left=ch.filter((_,i)=>!pick.includes(i));
  next.pending=left.length?Object.assign({},p.pending,{changes:left}):null;
  if(applied)next.revision=(num(p.revision)||0)+1;
  try{await writeProfile(next);renderProfile();setMsg("pend",accept?`${plural(applied,"change")} accepted. The next scan rescores open calls.`:"Rejected.","ok")}
  catch(e){setMsg("pend","Couldn't save. You may not have permission to change this radar.","err")}
}

/* inputs: links and files */
function inputsSection(){
  const inp=P().inputs||{};const files=arr(S.profileText&&S.profileText.files);const dis=S.canEdit?"":" disabled";
  return `<div class="sechead"><h2>Where your profile comes from</h2></div>
  <div class="pgrid">
    <form class="panel" onsubmit="return false"><h3>Links</h3>
      <div class="fld"><label for="pf-portfolio">Personal website or portfolio</label><input type="url" id="pf-portfolio" value="${esc(inp.portfolio||"")}" placeholder="https://your-site.example"${dis}></div>
      <div class="fld"><label for="pf-orcid">ORCID iD</label><input type="text" id="pf-orcid" value="${esc(inp.orcid||"")}" placeholder="0000-0000-0000-0000"${dis}></div>
      <div class="fld"><label for="pf-scholar">Google Scholar profile (optional)</label><input type="url" id="pf-scholar" value="${esc(inp.scholar||"")}"${dis}></div>
      <div class="fld"><label for="pf-linkedin">LinkedIn profile (optional, for reference)</label><input type="url" id="pf-linkedin" value="${esc(inp.linkedin||"")}"${dis}></div>
      <p class="muted" style="margin:0;font-size:.8rem">The scan reads your website every week and proposes changes when it lists something new. LinkedIn does not allow automated reading, so add its PDF export on the right (on your profile: More, then Save to PDF).</p>
      <div class="btnrow"><button type="button" class="btn" data-pf="save-inputs"${dis}>Save links</button><span data-msg="inputs">${msgLine("inputs")}</span></div>
    </form>
    <form class="panel" onsubmit="return false"><h3>Files</h3>
      <label class="dropzone" id="pf-drop"><b>Drop your CV or LinkedIn PDF here</b><span>or click to choose. PDF or text, read in this page.</span><input type="file" id="pf-file" accept=".pdf,.txt,.md,application/pdf,text/plain" multiple${dis}></label>
      ${files.length||PF.docs.length?`<ul class="doclist">${files.map((f,i)=>`<li><span class="nm">${esc(f.name)}</span><span class="pill">${esc(f.kind==="linkedin"?"LinkedIn":f.kind==="cv"?"CV":"Other")}</span><span class="muted" style="font-size:.78rem">${fmtDate(String(f.addedAt||"").slice(0,10))}</span><button type="button" class="icobtn" data-pf="rm-file" data-i="${i}"${dis}>Remove</button></li>`).join("")}${PF.docs.map(d=>`<li><span class="nm">${esc(d.name)}</span><span class="muted" style="font-size:.78rem">${d.state==="reading"?"Reading…":esc(d.err||"")}</span></li>`).join("")}</ul>`:""}
      <p class="muted" style="margin:0;font-size:.8rem">Only the extracted text is kept, in this radar's own store. It is never sent to the repository.</p>
    </form>
  </div>
  <div class="panel"><h3>Draft the profile</h3>
    <p class="muted" style="margin:0;font-size:.88rem">Claude can draft it now from your files and answers, or the next scan can read everything, including your website and ORCID. A draft never replaces a confirmed profile: you review it first.</p>
    <div class="btnrow"><button type="button" class="btn primary" data-pf="draft-now"${dis||(PF.busy?" disabled":"")}>Draft from my files now</button><button type="button" class="btn" data-pf="queue-derive"${dis}>Let the next scan read everything</button><button type="button" class="btn" data-pf="derive-run"${dis}>Read everything now</button><span data-msg="derive">${msgLine("derive")}</span></div>
    ${S.control&&S.control.deriveProfile&&S.control.status!=="done"?`<p class="tpmsg" style="margin:0">A profile request is ${esc(S.control.status||"queued")}.</p>`:""}
  </div>`;
}
async function saveInputs(){
  const g=id=>((document.getElementById(id)||{}).value||"").trim();
  const inputs=Object.assign({},P().inputs||{},{portfolio:g("pf-portfolio")||null,orcid:g("pf-orcid").replace(/^https?:\/\/orcid\.org\//,"")||null,scholar:g("pf-scholar")||null,linkedin:g("pf-linkedin")||null});
  for(const k of ["portfolio","scholar","linkedin"])if(inputs[k]&&!/^https?:\/\//.test(inputs[k])){setMsg("inputs","Links must start with https://","err");return false}
  if(inputs.orcid&&!/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(inputs.orcid)){setMsg("inputs","An ORCID iD looks like 0000-0002-1825-0097.","err");return false}
  try{await writeProfile(Object.assign({},P(),{inputs}));PF.dirty=false;setMsg("inputs","Saved.","ok");return true}
  catch(e){setMsg("inputs","Couldn't save. You may not have permission to change this radar.","err");return false}
}
// PDF reading, copied from Research Radar (pdf.js runs on the main thread: the page can't start cross-origin workers).
let pdfLib=null;
function loadScript(url){return new Promise((res,rej)=>{const s=document.createElement("script");s.src=url;s.onload=res;s.onerror=()=>rej(new Error("Couldn't load "+url));document.head.appendChild(s)})}
function ensurePdf(){if(!pdfLib)pdfLib=loadScript(VENDOR_LAZY["pdf.js worker"]).then(()=>loadScript(VENDOR_LAZY["pdf.js"])).then(()=>{if(!window.pdfjsLib)throw new Error("PDF reader unavailable");return window.pdfjsLib});return pdfLib}
async function readFileText(file){
  if(/\.(txt|md)$/i.test(file.name)||String(file.type).startsWith("text/"))return(await file.text()).replace(/[ \t]+/g," ").slice(0,20000);
  const lib=await ensurePdf();
  const doc=await lib.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false}).promise;
  let out="";for(let i=1;i<=Math.min(doc.numPages,8)&&out.length<20000;i++){const pg=await doc.getPage(i);const tc=await pg.getTextContent();out+=tc.items.map(x=>x.str).join(" ")+"\n"}
  out=out.replace(/[ \t]+/g," ").trim().slice(0,20000);
  if(out.length<150)throw new Error("No text found (scanned PDF?)");
  return out;
}
async function addFiles(files){
  for(const f of files){
    const d={name:f.name,state:"reading"};PF.docs.push(d);rerenderInputs();
    try{
      const text=await readFileText(f);
      const kind=/linkedin/i.test(f.name)||/linkedin\.com\/in\//i.test(text)?"linkedin":"cv";
      const cur=arr(S.profileText&&S.profileText.files).filter(x=>x.name!==f.name);
      const body={files:cur.concat([{name:f.name,kind,text,addedAt:new Date().toISOString()}]).slice(-6)};
      await writeDoc("meta/profile-text",body);S.profileText=body;PF.docs=PF.docs.filter(x=>x!==d);
    }catch(e){d.state="err";d.err=(e&&e.message)||"Couldn't read this file"}
    rerenderInputs();
  }
}
async function removeFile(i){const files=arr(S.profileText&&S.profileText.files).slice();files.splice(i,1);try{await writeDoc("meta/profile-text",{files});S.profileText={files};rerenderInputs()}catch(e){}}
function rerenderInputs(){const s=document.getElementById("pf-inputs");if(s)s.innerHTML=inputsSection()}

async function draftNow(){
  const files=arr(S.profileText&&S.profileText.files);const p=P();
  if(!files.length&&!(p.answers&&p.answers.ambitions)){setMsg("derive","Add your CV or LinkedIn PDF first, or let the next scan read your website and ORCID.","err");return}
  let sample=null;try{sample=await window.claude.use("sample")}catch(e){}
  if(!sample){setMsg("derive","Asking Claude isn't available in this view. Use “Let the next scan read everything” instead.","err");return}
  const prompt=`You help a researcher build the profile a funding radar uses to check eligibility for research funding calls and rank them by fit.
Read the documents below (a CV and/or a LinkedIn export) and the questionnaire answers, and draft the profile.
Rules:
- Use only facts the documents state. Leave a field empty ("" or []) when nothing states it. Never guess dates.
- Never include phone numbers, home addresses, dates of birth or ID numbers.
- careerStage: one of phd, postdoc, senior, professor, other.
- phdDate: YYYY, YYYY-MM or YYYY-MM-DD of the PhD (the expected date if still a PhD student; then phdExpected is true).
- researchAreas: 3 to 7, each with weight (1.0 core, 0.5-0.9 adjacent) and 5-10 keywords as they would appear in funding calls.
- skills.hard: methods, tools and technical skills; skills.soft: teaching, leadership, communication, organisation.
- Every item in researchAreas, teaching, funding and publications gets "from": {"source": "cv" or "linkedin", "asOf": the date the document shows as most recent, YYYY-MM-DD or YYYY-MM}.
- publications: title, venue, year, type (journal, conference, workshop, book chapter, preprint, other), position (sole, first, middle, last), doi (or null).
Reply with only JSON in exactly this shape:
{"name":"","headline":"","careerStage":"","phdDate":"","phdExpected":false,"employer":"","residence":"","nationalities":[],"researchAreas":[{"name":"","weight":1,"keywords":[],"from":{"source":"","asOf":""}}],"methods":[],"skills":{"hard":[],"soft":[]},"languages":[{"language":"","level":""}],"teaching":[{"course":"","role":"","years":"","from":{}}],"funding":[{"title":"","funder":"","year":"","role":"","from":{}}],"publications":[{"title":"","venue":"","year":"","type":"","position":"","doi":null,"from":{}}]}

QUESTIONNAIRE ANSWERS: ${JSON.stringify(p.answers||{})}
${files.map((f,i)=>`--- Document ${i+1}: ${f.kind==="linkedin"?"LinkedIn export":"CV"} (${f.name}) ---\n${String(f.text||"").slice(0,12000)}`).join("\n\n")}`;
  PF.busy=true;rerenderInputs();setMsg("derive","Claude is reading your files… this usually takes under a minute.");
  try{
    const r=await sample.json(prompt,{cache:false});
    if(!r||typeof r!=="object"||(!arr(r.researchAreas).length&&!r.name))throw{code:"invalid_json"};
    PF.draft=normalizeDraft(r);PF.editing=true;PF.busy=false;renderProfile();
    setMsg("edit","Claude's draft is in the editor. Check every field, then press Save and confirm.","ok");
    const el=document.getElementById("pf-main");if(el)el.scrollIntoView({block:"start"});
  }catch(e){
    PF.busy=false;rerenderInputs();
    const m={cancelled:"Stopped.",not_granted:"You didn't allow this page to ask Claude, so it can't draft the profile here.",rate_limited:"Claude is busy or you've reached a usage limit. Try again in a few minutes.",invalid_json:"Claude's answer couldn't be read. Try again.",prompt_too_large:"The files are too long. Remove one and try again."}[e&&e.code];
    setMsg("derive",m||"Couldn't get a draft. Try again.","err");
  }
}
function pubId(x){const base=x.doi?String(x.doi).toLowerCase():`${x.title||""} ${x.year||""}`;return base.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,80).replace(/-$/,"")}
function normalizeDraft(r){
  const cur=P();const keepHidden=new Map(arr(cur.publications).map(x=>[x.id,!!x.hidden]));
  const pubs=arr(r.publications).filter(x=>x&&x.title).map(x=>{const o=Object.assign({},x);o.id=o.id||pubId(o);if(keepHidden.get(o.id))o.hidden=true;return o});
  // Keep publications the scan found (ORCID) that the files don't list.
  for(const x of arr(cur.publications))if(!pubs.some(y=>y.id===x.id))pubs.push(x);
  return Object.assign({},cur,{name:r.name||cur.name||"",headline:r.headline||cur.headline||"",careerStage:r.careerStage||cur.careerStage||"",phdDate:r.phdDate||cur.phdDate||"",phdExpected:!!(r.phdExpected??cur.phdExpected),employer:r.employer||cur.employer||"",residence:r.residence||cur.residence||"",nationalities:arr(r.nationalities).length?r.nationalities:arr(cur.nationalities),researchAreas:arr(r.researchAreas).filter(x=>x&&x.name),methods:arr(r.methods),skills:{hard:arr(r.skills&&r.skills.hard),soft:arr(r.skills&&r.skills.soft)},languages:arr(r.languages).filter(x=>x&&x.language),teaching:arr(r.teaching).filter(x=>x&&x.course),funding:arr(r.funding).filter(x=>x&&x.title),publications:pubs});
}
async function queueDerive(runNow){
  if(document.getElementById("pf-portfolio")&&!(await saveInputs()))return;
  const inp=P().inputs||{};
  if(!inp.portfolio&&!inp.orcid&&!arr(S.profileText&&S.profileText.files).length){setMsg("derive","Add your website, ORCID or a file first.","err");return}
  try{await writeControl({status:"queued",deriveProfile:true,mode:(S.control&&S.control.status==="queued"&&S.control.mode)||"incremental",requestedAt:new Date().toISOString(),requestedBy:"profile page"})}
  catch(e){setMsg("derive","Couldn't save the request. You may not have permission to change this radar.","err");return}
  if(!runNow){rerenderInputs();setMsg("derive","Queued. The next scan drafts your profile; you review it here.","ok");return}
  setMsg("derive","Starting the scan… you may be asked to allow this page to use Claude Code Remote.");
  const r=await fireScan("Requested from the Profile page: deriveProfile. Read meta/control and follow it.");
  rerenderInputs();setMsg("derive",r.ok?"Scan started. The draft appears here when it is written.":r.msg+" The request stays queued for the next scheduled scan.",r.ok?"ok":"err");
}

/* questionnaire */
function questionnaireSection(){
  const a=P().answers||{};const dis=S.canEdit?"":" disabled";
  return `<div class="sechead"><h2>Questionnaire</h2><span class="muted" style="font-size:.8rem">What no CV shows</span></div>
  <form class="panel" onsubmit="return false">
    <div class="fld"><label for="q-amb">Your research ambitions for the next three to five years</label><textarea class="plain" id="q-amb" rows="3"${dis}>${esc(a.ambitions||"")}</textarea></div>
    <div class="q-grid">
      <div class="fld"><label for="q-reloc">Would you move to another country?</label><select id="q-reloc"${dis}>${[["","Not answered"],["yes","Yes"],["maybe","Maybe, for the right call"],["no","No"]].map(([v,l])=>`<option value="${v}"${(a.relocation||"")===v?" selected":""}>${l}</option>`).join("")}</select></div>
      <div class="fld"><label for="q-pref">Preferred countries (ISO codes, comma separated)</label><input type="text" id="q-pref" value="${esc(arr(a.preferredCountries).join(", "))}" placeholder="CH, DE, NL"${dis}></div>
      <div class="fld"><label for="q-teach">Languages you can teach in</label><input type="text" id="q-teach" value="${esc(arr(a.teachingLanguages).join(", "))}" placeholder="English, Spanish"${dis}></div>
      <div class="fld"><label for="q-size">Preferred grant size</label><input type="text" id="q-size" value="${esc(a.grantSize||"")}" placeholder="for example up to CHF 200,000"${dis}></div>
      <div class="fld"><label for="q-dur">Preferred duration</label><input type="text" id="q-dur" value="${esc(a.duration||"")}" placeholder="for example 1 to 3 years"${dis}></div>
      <div class="fld"><label for="q-breaks">Career breaks (months, e.g. parental leave)</label><input type="number" id="q-breaks" min="0" max="240" value="${esc(P().careerBreaksMonths??"")}"${dis}></div>
    </div>
    <div class="fld"><label for="q-avoid">Topics, funders or call types to avoid</label><input type="text" id="q-avoid" value="${esc(a.avoid||"")}"${dis}></div>
    <div class="btnrow"><button type="button" class="btn primary" data-pf="save-answers"${dis}>Save answers</button><span data-msg="answers">${msgLine("answers")}</span></div>
  </form>`;
}
const splitList=s=>String(s||"").split(/[,;\n]/).map(x=>x.trim()).filter(Boolean);
async function saveAnswers(){
  const g=id=>((document.getElementById(id)||{}).value||"").trim();
  const answers={ambitions:g("q-amb"),relocation:g("q-reloc"),preferredCountries:splitList(g("q-pref")).map(x=>x.toUpperCase()),teachingLanguages:splitList(g("q-teach")),grantSize:g("q-size"),duration:g("q-dur"),avoid:g("q-avoid")};
  const br=g("q-breaks");const p=Object.assign({},P(),{answers,careerBreaksMonths:br===""?undefined:Math.max(0,Math.round(Number(br)||0))});
  p.revision=(num(P().revision)||0)+1;
  try{await writeProfile(p);PF.dirty=false;setMsg("answers","Saved. The next scan rescores open calls.","ok")}catch(e){setMsg("answers","Couldn't save. You may not have permission to change this radar.","err")}
}

/* profile view and editor */
function profileView(){
  const p=P();if(!p.name&&!arr(p.researchAreas).length)return `<div class="sechead"><h2>Your profile</h2></div>${emptyBlock("No profile yet","Draft it from your files or let the next scan read your website and ORCID. You can also write it yourself.",S.canEdit?`<button type="button" class="btn" data-pf="edit">Write it myself</button>`:"")}`;
  const list=(t,xs)=>xs.length?`<div><div class="eyebrow">${t}</div><div class="chips">${xs.map(x=>`<span class="pill">${esc(x)}</span>`).join("")}</div></div>`:"";
  const stage=(STAGES.find(s=>s[0]===p.careerStage)||[0,p.careerStage||"—"])[1];
  return `<div class="sechead"><h2>Your profile</h2><span class="muted" style="font-size:.8rem">Revision ${esc(p.revision??1)}${p.confirmedAt?` · confirmed ${fmtDate(String(p.confirmedAt).slice(0,10))}`:" · not confirmed"}</span></div>
  <div class="pgrid">
    <div class="panel"><h3>${esc(p.name||"Name not set")}</h3>${p.headline?`<p class="muted" style="margin:0">${esc(p.headline)}</p>`:""}
      <dl class="kv"><dt>Career stage</dt><dd style="font-family:var(--f-body)">${esc(stage)}</dd><dt>PhD</dt><dd>${esc(p.phdDate||"—")}${p.phdExpected?" (expected)":""}</dd><dt>Career breaks</dt><dd>${num(p.careerBreaksMonths)?esc(p.careerBreaksMonths)+" months":"none stated"}</dd><dt>Employer</dt><dd style="font-family:var(--f-body)">${esc(p.employer||"—")}</dd><dt>Residence</dt><dd>${esc(p.residence?countryName(p.residence):"—")}</dd><dt>Nationality</dt><dd>${esc(arr(p.nationalities).map(countryName).join(", ")||"—")}</dd></dl>
      ${arr(p.languages).length?`<div><div class="eyebrow">Languages</div><div class="chips">${p.languages.map(l=>`<span class="pill">${esc(l.language)}${l.level?" · "+esc(l.level):""}</span>`).join("")}</div></div>`:""}
    </div>
    <div class="panel"><h3>Research areas</h3>${arr(p.researchAreas).map(r=>`<div class="ra"><b style="font-weight:500">${esc(r.name)} <span class="muted mono" style="font-size:.78rem">${num(r.weight)!=null?"weight "+r.weight:""}</span></b><span class="muted" style="font-size:.82rem">${esc(arr(r.keywords).join(", "))}</span>${fromTag(r.from)}</div>`).join("")||`<p class="muted" style="margin:0">None yet.</p>`}</div>
    <div class="panel"><h3>Skills and methods</h3>${list("Methods",arr(p.methods))}${list("Hard skills",arr(p.skills&&p.skills.hard))}${list("Soft skills",arr(p.skills&&p.skills.soft))}</div>
    <div class="panel"><h3>Teaching and funding</h3>
      ${arr(p.teaching).length?`<div><div class="eyebrow">Teaching</div><ul style="margin:0;padding-left:1.1em">${p.teaching.map(t=>`<li>${esc(t.course)}${t.role?` · ${esc(t.role)}`:""}${t.years?` · ${esc(t.years)}`:""} ${fromTag(t.from)}</li>`).join("")}</ul></div>`:`<p class="muted" style="margin:0">No teaching listed.</p>`}
      ${arr(p.funding).length?`<div><div class="eyebrow">Funding received</div><ul style="margin:0;padding-left:1.1em">${p.funding.map(t=>`<li>${esc(t.title)}${t.funder?` · ${esc(t.funder)}`:""}${t.year?` · ${esc(t.year)}`:""}${t.role?` · ${esc(t.role)}`:""} ${fromTag(t.from)}</li>`).join("")}</ul></div>`:`<p class="muted" style="margin:0">No funding listed.</p>`}
    </div>
  </div>
  <div class="btnrow">${S.canEdit?`<button type="button" class="btn" data-pf="edit">Edit profile</button>${p.confirmedAt?"":`<button type="button" class="btn primary" data-pf="confirm">Confirm profile</button>`}`:""}<span data-msg="edit">${msgLine("edit")}</span></div>`;
}
function linesOf(xs,fmt){return arr(xs).map(fmt).join("\n")}
function profileEditor(){
  const p=PF.draft||P();
  const opt=(v,l,cur)=>`<option value="${v}"${cur===v?" selected":""}>${l}</option>`;
  return `<div class="sechead"><h2>Edit your profile</h2>${PF.draft?`<span class="pill acc">Draft from Claude</span>`:""}</div>
  <form class="panel" onsubmit="return false" id="pf-editor">
    <div class="q-grid">
      <div class="fld"><label for="e-name">Name</label><input type="text" id="e-name" value="${esc(p.name||"")}"></div>
      <div class="fld"><label for="e-head">Headline</label><input type="text" id="e-head" value="${esc(p.headline||"")}"></div>
      <div class="fld"><label for="e-stage">Career stage</label><select id="e-stage">${opt("","Not set",p.careerStage||"")}${STAGES.map(([v,l])=>opt(v,l,p.careerStage)).join("")}</select></div>
      <div class="fld"><label for="e-phd">PhD date (YYYY, YYYY-MM or full date)</label><input type="text" id="e-phd" value="${esc(p.phdDate||"")}"></div>
      <div class="fld"><label class="chk" style="text-transform:none;letter-spacing:0;font-weight:400;font-size:.88rem;margin-top:22px"><input type="checkbox" id="e-phdexp"${p.phdExpected?" checked":""}> PhD not yet obtained (expected date)</label></div>
      <div class="fld"><label for="e-emp">Employer</label><input type="text" id="e-emp" value="${esc(p.employer||"")}"></div>
      <div class="fld"><label for="e-res">Country of residence (ISO code)</label><input type="text" id="e-res" value="${esc(p.residence||"")}" maxlength="2"></div>
      <div class="fld"><label for="e-nat">Nationalities (ISO codes, comma separated)</label><input type="text" id="e-nat" value="${esc(arr(p.nationalities).join(", "))}"></div>
    </div>
    <div class="fld"><label for="e-areas">Research areas, one per line: Name (weight): keyword, keyword</label><textarea id="e-areas" rows="6">${esc(linesOf(p.researchAreas,r=>`${r.name}${num(r.weight)!=null?` (${r.weight})`:""}: ${arr(r.keywords).join(", ")}`))}</textarea></div>
    <div class="q-grid">
      <div class="fld"><label for="e-methods">Methods (comma separated)</label><textarea class="plain" id="e-methods" rows="3">${esc(arr(p.methods).join(", "))}</textarea></div>
      <div class="fld"><label for="e-hard">Hard skills</label><textarea class="plain" id="e-hard" rows="3">${esc(arr(p.skills&&p.skills.hard).join(", "))}</textarea></div>
      <div class="fld"><label for="e-soft">Soft skills</label><textarea class="plain" id="e-soft" rows="3">${esc(arr(p.skills&&p.skills.soft).join(", "))}</textarea></div>
    </div>
    <div class="fld"><label for="e-lang">Languages, one per line: Language: level</label><textarea id="e-lang" rows="3">${esc(linesOf(p.languages,l=>`${l.language}${l.level?": "+l.level:""}`))}</textarea></div>
    <div class="fld"><label for="e-teach">Teaching, one per line: Course | role | years</label><textarea id="e-teach" rows="3">${esc(linesOf(p.teaching,t=>[t.course,t.role,t.years].map(x=>x||"").join(" | ")))}</textarea></div>
    <div class="fld"><label for="e-fund">Funding received, one per line: Title | funder | year | role</label><textarea id="e-fund" rows="3">${esc(linesOf(p.funding,t=>[t.title,t.funder,t.year,t.role].map(x=>x??"").join(" | ")))}</textarea></div>
    <div class="btnrow"><button type="button" class="btn primary" data-pf="save-confirm">Save and confirm</button><button type="button" class="btn" data-pf="cancel-edit">Cancel</button><span data-msg="edit">${msgLine("edit")}</span></div>
  </form>`;
}
function keepFrom(oldList,key,item){const o=arr(oldList).find(x=>String(x[key]||"").toLowerCase()===String(item[key]||"").toLowerCase());return o&&o.from?Object.assign(item,{from:o.from}):Object.assign(item,{from:{source:"manual",asOf:today()}})}
function readEditor(){
  const base=PF.draft||P();const g=id=>((document.getElementById(id)||{}).value||"");
  const lines=id=>g(id).split("\n").map(x=>x.trim()).filter(Boolean);
  const areas=lines("e-areas").map(l=>{const m=l.match(/^(.*?)(?:\s*\(([\d.]+)\))?\s*:\s*(.*)$/);const name=(m?m[1]:l).trim(),w=m&&m[2]?clamp(Number(m[2]),0,1):1;return keepFrom(base.researchAreas,"name",{name,weight:w,keywords:m?splitList(m[3]):[]})}).filter(x=>x.name);
  const bars=id=>lines(id).map(l=>l.split("|").map(x=>x.trim()));
  return Object.assign({},base,{
    name:g("e-name").trim(),headline:g("e-head").trim(),careerStage:g("e-stage"),phdDate:g("e-phd").trim(),phdExpected:!!(document.getElementById("e-phdexp")||{}).checked,
    employer:g("e-emp").trim(),residence:g("e-res").trim().toUpperCase(),nationalities:splitList(g("e-nat")).map(x=>x.toUpperCase()),
    researchAreas:areas,methods:splitList(g("e-methods")),skills:{hard:splitList(g("e-hard")),soft:splitList(g("e-soft"))},
    languages:lines("e-lang").map(l=>{const [a,...b]=l.split(":");return{language:a.trim(),level:b.join(":").trim()}}),
    teaching:bars("e-teach").map(([course,role,years])=>keepFrom(base.teaching,"course",{course:course||"",role:role||"",years:years||""})).filter(x=>x.course),
    funding:bars("e-fund").map(([title,funder,year,role])=>keepFrom(base.funding,"title",{title:title||"",funder:funder||"",year:year||"",role:role||""})).filter(x=>x.title),
  });
}
async function saveProfileEdits(){
  const p=readEditor();
  if(p.phdDate&&!/^\d{4}(-\d{2}(-\d{2})?)?$/.test(p.phdDate)){setMsg("edit","Write the PhD date as YYYY, YYYY-MM or YYYY-MM-DD.","err");return}
  if(!p.researchAreas.length){setMsg("edit","Add at least one research area.","err");return}
  p.revision=(num(P().revision)||0)+1;p.confirmedAt=new Date().toISOString();
  try{await writeProfile(p);PF.editing=false;PF.draft=null;renderProfile();setMsg("edit","Profile saved and confirmed. The next scan rescores open calls.","ok")}
  catch(e){setMsg("edit","Couldn't save. You may not have permission to change this radar.","err")}
}
async function confirmProfile(){
  const p=Object.assign({},P(),{confirmedAt:new Date().toISOString()});
  try{await writeProfile(p);renderProfile();setMsg("edit","Confirmed.","ok")}catch(e){setMsg("edit","Couldn't save.","err")}
}

/* publications: the full list by default; hidden ones are ignored in matching */
function publicationsSection(){
  const pubs=arr(P().publications).slice().sort((a,b)=>String(b.year||"").localeCompare(String(a.year||"")));
  const hidden=pubs.filter(x=>x.hidden).length;const shown=PF.showHidden?pubs:pubs.filter(x=>!x.hidden);
  let h=`<div class="sechead"><h2>Publications</h2><span class="muted" style="font-size:.8rem">${plural(pubs.length,"publication")}${hidden?` · ${hidden} hidden from matching`:""}</span></div>`;
  if(!pubs.length)return h+emptyBlock("No publications yet","The scan reads them from ORCID and your website, and Claude's draft takes them from your CV.");
  h+=`<div class="toggles"><label><input type="checkbox" id="pf-showhidden"${PF.showHidden?" checked":""}> Show hidden (${hidden})</label><span class="muted" style="font-size:.82rem">Hide a publication to keep it out of eligibility checks and scoring, for example an old paper outside your current field.</span></div>`;
  h+=`<div class="tblwrap"><table><thead><tr><th>Year</th><th>Title</th><th>Venue</th><th>Type</th><th>Position</th><th>From</th><th></th></tr></thead><tbody>${shown.map(x=>`<tr class="pubrow${x.hidden?" hidden-pub":""}"><td class="num">${esc(x.year||"—")}</td><td>${x.doi?linkOut("https://doi.org/"+x.doi,x.title):esc(x.title)}</td><td>${esc(x.venue||"—")}</td><td>${esc(x.type||"—")}</td><td>${esc(x.position||"—")}</td><td>${fromTag(x.from)}</td><td><button type="button" class="icobtn" data-pub="${esc(x.id||pubId(x))}" aria-pressed="${!!x.hidden}"${S.canEdit?"":" disabled"}>${x.hidden?"Show":"Hide"}</button></td></tr>`).join("")}</tbody></table></div>`;
  return h;
}
async function togglePub(id){
  const p=P();const pubs=arr(p.publications).map(x=>(x.id||pubId(x))===id?Object.assign({},x,{id:x.id||pubId(x),hidden:!x.hidden}):x);
  try{await writeProfile(Object.assign({},p,{publications:pubs,revision:(num(p.revision)||0)+1}));const s=document.getElementById("pf-pubs");if(s)s.innerHTML=publicationsSection()}catch(e){}
}
