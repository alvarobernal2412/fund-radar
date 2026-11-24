/* ---------- routing ---------- */
// Views: #calls (default), #call.<id>, #timeline, #profile, #settings.
function route(){
  const h=(location.hash||"").replace(/^#/,"");if(!h)return{view:"calls"};
  const i=h.indexOf(".");if(i>0)return{view:h.slice(0,i),id:decodeURIComponent(h.slice(i+1))};return{view:h};
}
let lastKey="";
function render(force){
  const r=route();const key=r.view+"|"+(r.id||"");
  document.querySelectorAll("nav.tabs a").forEach(a=>{const t=a.dataset.tab;const on=t===r.view||(r.view==="call"&&t==="calls");if(on)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current")});
  renderRunStat();renderBrand();
  if(S.dbState==="none"){app.innerHTML=emptyBlock("The radar's data store isn't available here","Open this page in Claude while signed in to see the calls it has collected.");return}
  const changed=key!==lastKey;lastKey=key;
  if(r.view==="calls"){if(changed||force||!document.getElementById("flt-q"))renderCatalogShell();updateCatalog()}
  else if(r.view==="call")renderCallDetail(r.id);
  else if(r.view==="timeline")renderTimeline();
  else if(r.view==="profile"){if(changed||force||!(PF.editing||PF.dirty))renderProfile()}
  else if(r.view==="settings"){if(changed||force||!ST.busy)renderSettings()}
  else{location.hash="#calls";return}
  if(changed)window.scrollTo(0,0);
}
window.addEventListener("hashchange",()=>{PF.editing=false;PF.dirty=false;ST.dirty=false;render(true)});
let raf=0;function schedule(){if(raf)return;raf=requestAnimationFrame(()=>{raf=0;
  // Never re-render a form the user is typing in; the next navigation picks up the new data.
  const v=route().view;if((v==="profile"&&(PF.editing||PF.dirty))||(v==="settings"&&ST.dirty)){renderRunStat();return}
  render(false)})}

function renderBrand(){const b=document.getElementById("brand");if(b)b.innerHTML=`<b>${esc(siteName())}</b>`;document.title=siteName()}
function renderRunStat(){
  const el=document.getElementById("runstat");const run=S.run;
  if(S.dbState==="loading"){el.innerHTML=`<span class="dot"></span><span>Connecting…</span>`;return}
  const queued=S.control&&S.control.status==="queued",running=S.control&&S.control.status==="running";
  if(!run||!run.lastRunAt){el.innerHTML=`<span class="dot"></span><span>No scan yet · runs ${esc(scheduleText())}${queued?` · <a href="#settings">request queued</a>`:""}</span>`;return}
  const st=run.status==="ok"?"ok":run.status==="partial"?"warn":run.status==="failed"?"err":"";
  const nn=num(run.counts&&run.counts.newCalls);
  el.innerHTML=`<span class="dot ${st}"></span><span>Last scan ${fmtDate(String(run.lastRunAt).slice(0,10))}${nn!==null?` · ${nn} new`:""}${running?" · scanning now":queued?` · <a href="#settings">request queued</a>`:""}</span>`;
}
