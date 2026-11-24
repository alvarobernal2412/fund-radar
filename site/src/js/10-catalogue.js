/* ---------- catalogue ---------- */
// Everything is shown by default except calls the user is not eligible for and calls they discarded;
// both stay stored and come back with one tick.
const F_DEFAULT={q:"",type:[],country:[],verdict:["eligible","check"],status:[],window:"any",minAff:0,sort:"affinity",showDiscarded:false,onlyMarked:false,showClosed:false};
const F=Object.assign({},F_DEFAULT,lsGet("fr-filters",{}));
for(const k of ["type","country","verdict","status"])if(!Array.isArray(F[k]))F[k]=F_DEFAULT[k].slice();
function saveFilters(){lsSet("fr-filters",F)}
const markOf=id=>S.marks[id]||{};

function summaryStrip(){
  const live=S.calls.filter(c=>!isClosed(c)&&!markOf(c.id).discarded);
  const fresh=live.filter(isNewCall).length;
  const soon=live.filter(c=>{const nd=nextDeadline(c);return nd&&nd.date&&daysUntil(nd.date)<=28&&c.verdict!=="not_eligible"}).length;
  const marked=live.filter(c=>markOf(c.id).interested||markOf(c.id).applying).length;
  const unread=arr(S.run&&S.run.unreadSources).length;
  const elig=live.filter(c=>c.verdict==="eligible").length;
  return `<div class="strip">
    <a class="stat" href="#calls" data-quick="new"><b>${fresh}</b><span>new since the last scan</span></a>
    <a class="stat" href="#calls" data-quick="soon"><b>${soon}</b><span>deadlines in the next 4 weeks</span></a>
    <a class="stat" href="#calls" data-quick="eligible"><b>${elig}</b><span>open calls you are eligible for</span></a>
    <a class="stat" href="#calls" data-quick="marked"><b>${marked}</b><span>marked interested or applying</span></a>
    <a class="stat${unread?" warn":""}" href="#settings"><b>${unread}</b><span>${unread===1?"source":"sources"} not read in the last scan</span></a>
  </div>`;
}
function renderCatalogShell(){
  const countries=[...new Set(S.calls.flatMap(c=>arr(c.countries)))].sort().map(c=>[c,countryName(c)]);
  const types=TYPES.filter(([t])=>S.calls.some(c=>c.type===t)||F.type.includes(t));
  app.innerHTML=`<div class="pagehead"><div><h1>Calls</h1><p>Open calls from your sources, checked against your profile and ranked by affinity. Weights and preparation times are set on <a href="#settings">Scope &amp; scans</a>.</p></div></div>
  <section class="block" id="cat-strip">${summaryStrip()}</section>
  <section class="block">
    <form class="toolbar" id="cat-tools" onsubmit="return false" role="search">
      <div class="fld wide"><label for="flt-q">Search</label><input type="search" id="flt-q" value="${esc(F.q)}" placeholder="Title, funder, programme or summary"></div>
      ${msel("flt-type","Type",types,F.type,"All types")}
      ${msel("flt-country","Country",countries,F.country,"All countries")}
      ${msel("flt-verdict","Eligibility",VERDICTS,F.verdict,"Any eligibility")}
      ${msel("flt-status","Status",STATUSES.filter(s=>s[0]!=="closed"),F.status,"Any status")}
      <div class="fld"><label for="flt-win">Deadline</label><select id="flt-win">${[["any","Any time"],["28","Next 4 weeks"],["90","Next 3 months"],["180","Next 6 months"]].map(([v,l])=>`<option value="${v}"${F.window===v?" selected":""}>${l}</option>`).join("")}</select></div>
      <div class="fld"><label for="flt-aff">Minimum affinity <output id="flt-aff-v">${F.minAff}</output></label><input type="range" id="flt-aff" min="0" max="100" step="5" value="${F.minAff}"></div>
      <div class="fld"><label for="flt-sort">Sort by</label><select id="flt-sort">${[["affinity","Affinity"],["deadline","Deadline"],["newest","Newest first"]].map(([v,l])=>`<option value="${v}"${F.sort===v?" selected":""}>${l}</option>`).join("")}</select></div>
      <div class="toggles wide">
        <label><input type="checkbox" id="flt-marked"${F.onlyMarked?" checked":""}> Only interested or applying</label>
        <label><input type="checkbox" id="flt-disc"${F.showDiscarded?" checked":""}> Show discarded&nbsp;(<span id="flt-disc-n">0</span>)</label>
        <label><input type="checkbox" id="flt-closed"${F.showClosed?" checked":""}> Show closed</label>
        <button type="button" class="btn" id="flt-reset" style="margin-left:auto">Clear filters</button>
      </div>
    </form>
    <div class="selbar"><span class="rescount" id="rescount"></span></div>
    <div id="cat-list"></div>
  </section>`;
}
function filteredCalls(){
  const q=F.q.trim().toLowerCase(),w=weights();
  const out=[];let discarded=0;
  for(const c of S.calls){
    const m=markOf(c.id);
    if(m.discarded){discarded++;if(!F.showDiscarded)continue}
    if(isClosed(c)&&!F.showClosed)continue;
    if(F.onlyMarked&&!(m.interested||m.applying))continue;
    if(F.type.length&&!F.type.includes(c.type))continue;
    if(F.country.length&&!arr(c.countries).some(x=>F.country.includes(x)))continue;
    if(F.verdict.length&&!F.verdict.includes(c.verdict||"check"))continue;
    if(F.status.length&&!F.status.includes(c.status))continue;
    if(F.window!=="any"){const nd=nextDeadline(c);if(!nd||!nd.date||daysUntil(nd.date)>Number(F.window))continue}
    const a=affinityOf(c,w);if(F.minAff>0&&(a==null||a<F.minAff))continue;
    if(q&&![c.title,c.funder,c.programme,c.summary,c.reference].some(x=>String(x||"").toLowerCase().includes(q)))continue;
    out.push({c,a});
  }
  const dl=x=>{const nd=nextDeadline(x.c);return nd&&nd.date?nd.date:"9999"};
  if(F.sort==="deadline")out.sort((x,y)=>dl(x).localeCompare(dl(y))||(y.a??-1)-(x.a??-1));
  else if(F.sort==="newest")out.sort((x,y)=>String((y.c.provenance||{}).firstSeen||"").localeCompare(String((x.c.provenance||{}).firstSeen||""))||(y.a??-1)-(x.a??-1));
  else out.sort((x,y)=>(y.a??-1)-(x.a??-1)||dl(x).localeCompare(dl(y)));
  return{rows:out,discarded};
}
function callRow({c,a}){
  const m=markOf(c.id);const closed=isClosed(c);
  const st=c.status==="new"?`<span class="pill acc">New</span>`:c.status==="changed"?`<span class="pill amb" title="Deadline, eligibility or amount changed since the last scan">Changed</span>`:"";
  const where=arr(c.countries).map(countryName).join(", ");
  const disc=m.discarded?`<button type="button" class="icobtn" data-restore="${esc(c.id)}">Restore</button>`:`<details class="disc"><summary class="icobtn">Discard…</summary><div class="discbox">${DISCARD.map(([v,l])=>`<button type="button" data-discard="${esc(c.id)}" data-reason="${v}">${esc(l)}</button>`).join("")}</div></details>`;
  return `<article class="crow${m.discarded?" discarded":""}${closed?" closed":""}" data-id="${esc(c.id)}">
    <div>${ring(a)}</div>
    <div class="cbody">
      <a class="ptitle" href="#call.${encodeURIComponent(c.id)}">${esc(c.title||"Untitled call")}</a>
      <div class="cfund">${esc(c.funder||"Unknown funder")}${c.programme?` · ${esc(c.programme)}`:""}</div>
      <div class="cmeta">${verdictBadge(c.verdict)}${st}<span class="pill">${esc(typeLabel(c.type))}</span>${where?`<span class="pill">${esc(where)}</span>`:""}${amountText(c)?`<span class="pill">${esc(amountText(c))}</span>`:""}${c.partial?`<span class="pill amb" title="Read from a listing only: unstated details are unknown">Partial</span>`:""}${m.discarded?`<span class="pill crit">Discarded: ${esc((DISCARD.find(d=>d[0]===m.discarded)||[0,m.discarded])[1])}</span>`:""}</div>
      <div class="cmeta">${dueHtml(c)}${partsHtml(c)}</div>
      ${c.why?`<p class="cwhy">${esc(c.why)}</p>`:""}
    </div>
    <div class="cact">
      <button type="button" class="icobtn" data-mark="interested" data-id="${esc(c.id)}" aria-pressed="${!!m.interested}">${m.interested?"Interested ✓":"Interested"}</button>
      <button type="button" class="icobtn" data-mark="applying" data-id="${esc(c.id)}" aria-pressed="${!!m.applying}">${m.applying?"Applying ✓":"Applying"}</button>
      ${disc}
    </div>
  </article>`;
}
function updateCatalog(){
  const list=document.getElementById("cat-list");if(!list)return;
  const strip=document.getElementById("cat-strip");if(strip)strip.innerHTML=summaryStrip();
  if(!S.loaded.calls){list.innerHTML=loadingBlock();return}
  const {rows,discarded}=filteredCalls();
  const dn=document.getElementById("flt-disc-n");if(dn)dn.textContent=discarded;
  const notElig=S.calls.filter(c=>c.verdict==="not_eligible"&&!isClosed(c)).length;
  const rc=document.getElementById("rescount");
  if(rc)rc.textContent=`${plural(rows.length,"call")} shown of ${S.calls.length} stored${discarded?` · ${discarded} discarded`:""}${notElig&&!F.verdict.includes("not_eligible")&&F.verdict.length?` · ${notElig} not eligible hidden by the Eligibility filter`:""}`;
  if(!S.calls.length){list.innerHTML=emptyBlock("No calls yet","The radar is empty until the first scan has run. Check your scope and profile, then start a scan from Scope & scans.",`<a href="#settings">Go to Scope &amp; scans</a>`);return}
  if(!rows.length){list.innerHTML=emptyBlock("No calls match these filters","Clear the filters or tick Show discarded or Show closed.");return}
  list.innerHTML=`<div class="clist">${rows.map(callRow).join("")}</div>`;
}
function readFilters(){
  const v=id=>document.getElementById(id);
  F.q=(v("flt-q")||{}).value||"";F.window=(v("flt-win")||{}).value||"any";F.sort=(v("flt-sort")||{}).value||"affinity";
  F.minAff=Number((v("flt-aff")||{}).value)||0;const o=v("flt-aff-v");if(o)o.textContent=F.minAff;
  F.onlyMarked=!!(v("flt-marked")||{}).checked;F.showDiscarded=!!(v("flt-disc")||{}).checked;F.showClosed=!!(v("flt-closed")||{}).checked;
  for(const [id,k] of [["flt-type","type"],["flt-country","country"],["flt-verdict","verdict"],["flt-status","status"]]){
    const box=v(id);if(!box)continue;F[k]=[...box.querySelectorAll("input:checked")].map(i=>i.value);
    const opts=[...box.querySelectorAll("input")].map(i=>[i.value,i.parentElement.textContent.trim()]);
    const sum=box.querySelector("summary");box.classList.toggle("on",F[k].length>0);
    if(sum)sum.textContent=mselSummary(opts,F[k],({type:"All types",country:"All countries",verdict:"Any eligibility",status:"Any status"})[k]);
  }
  saveFilters();updateCatalog();
}
function quickFilter(kind){
  Object.assign(F,F_DEFAULT,{type:[],country:[],status:[],verdict:F_DEFAULT.verdict.slice()});
  if(kind==="new")F.status=["new"];
  if(kind==="soon"){F.window="28";F.sort="deadline"}
  if(kind==="eligible")F.verdict=["eligible"];
  if(kind==="marked")F.onlyMarked=true;
  saveFilters();renderCatalogShell();updateCatalog();
}
