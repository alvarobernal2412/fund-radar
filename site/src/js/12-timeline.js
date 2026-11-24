/* ---------- deadline timeline (adapted from Research Radar's conferences page) ---------- */
// Only calls the viewer added with "Add to timeline" appear (marks.calls[id].timeline). Above the line:
// submission deadlines (filled dot). Below: when to start preparing, from the preparation time of the
// call's type (ring), and when a forthcoming call opens (ring). Days are counted from today.
const TL_W=1000,TL_ZOOMS=[1,1.5,2,3,4,6,8,12],TL_BACK=21,TL_MIN_AHEAD=120,TL_MAX_AHEAD=540,TL_LANE=20,TL_CH=6.4;
function tlDay(d){const t=Date.parse(String(d).slice(0,10)+"T12:00:00");if(isNaN(t))return null;const n=new Date();return Math.round((t-Date.UTC(n.getFullYear(),n.getMonth(),n.getDate(),12))/864e5)}
const TL_HUES=[5,210,140,275,30,185,330,55,245,100,300,160];
function tlHue(ids,id){return TL_HUES[ids.indexOf(id)%TL_HUES.length]}
const TLF=Object.assign({call:[],kind:[],labels:true},lsGet("fr-tlfilter",{}));
TLF.call=arr(TLF.call);TLF.kind=arr(TLF.kind);
function tlStore(){lsSet("fr-tlfilter",{call:TLF.call,kind:TLF.kind,labels:TLF.labels})}
const TL_KINDS=[["due","Deadlines"],["prep","Start preparing"],["opens","Call opens"]];
const onTimeline=c=>!!(S.marks[c.id]||{}).timeline;
function tlShort(c){const t=String(c.title||"Untitled call");return t.length>34?t.slice(0,33)+"…":t}
function tlEvents(calls,f){
  const out=[];
  for(const c of calls){
    if(f.call.length&&!f.call.includes(c.id))continue;
    const add=(kind,date,stage)=>{const n=date?tlDay(date):null;if(n===null||n<-TL_BACK||n>TL_MAX_AHEAD)return;if(f.kind.length&&!f.kind.includes(kind))return;out.push({c,kind,date:String(date).slice(0,10),n,stage})};
    const dl=arr(c.deadlines).filter(d=>d.date);
    for(const d of dl){if(/^opens?$/i.test(d.stage||""))add("opens",d.date,"opens");else add("due",d.date,d.stage||"deadline")}
    // Start preparing: the preparation time before the first upcoming submission deadline.
    const nd=nextDeadline(c);
    if(nd&&nd.date&&!/^opens?$/i.test(nd.stage||"")){const t=new Date(Date.parse(nd.date+"T12:00:00")-prepWeeks(c.type)*7*864e5).toISOString().slice(0,10);add("prep",t,`start preparing (${prepWeeks(c.type)} weeks)`)}
  }
  return out.sort((a,b)=>a.n-b.n||String(a.c.title).localeCompare(String(b.c.title)));
}
function tlWhen(n){return n===0?"today":n>0?`in ${n}d`:`${-n}d ago`}
function tlLabel(e){return `${tlShort(e.c)} · ${e.kind==="due"?e.stage:e.kind==="opens"?"opens":"start preparing"} · ${fmtDate(e.date)} · ${tlWhen(e.n)}`}
const TLZ={i:clamp(+lsGet("fr-tlzoom",0)||0,0,TL_ZOOMS.length-1)};
function tlZoomBy(a){
  const sc=document.querySelector(".tl-scroll");
  if(a==="today"){const n=sc&&sc.querySelector(".tl-now");if(n)sc.scrollLeft+=n.getBoundingClientRect().left-sc.getBoundingClientRect().left-60;return}
  const i=clamp(TLZ.i+(+a),0,TL_ZOOMS.length-1);if(i===TLZ.i)return;
  const f=sc?(sc.scrollLeft+sc.clientWidth/2)/sc.scrollWidth:0;
  TLZ.i=i;lsSet("fr-tlzoom",i);renderTimeline();
  const s=document.querySelector(".tl-scroll");if(s)s.scrollLeft=f*s.scrollWidth-s.clientWidth/2;
}
function tlSetFilter(key,v,on){
  const a=TLF[key].filter(x=>x!==v);if(on)a.push(v);TLF[key]=a;tlStore();renderTimeline();
  const d=document.getElementById("tlf-"+key);if(d)d.open=true;
  const i=document.querySelector(`[data-tlf="${key}"][value="${CSS.escape(v)}"]`);if(i)i.focus();
}
function tlSetLabels(on){TLF.labels=on;tlStore();renderTimeline();const i=document.querySelector("[data-tllabels]");if(i)i.focus()}
function tlMulti(key,label,opts,sel,all){
  const n=sel.length,names=sel.map(v=>(opts.find(o=>o[0]===v)||[0,v])[1]);
  return `<div class="fld tl-f"><details class="msel${n?" on":""}" id="tlf-${key}"><summary aria-label="${esc(label)}">${esc(n===0?all:n===1?names[0]:n+" selected")}</summary><div class="mselbox" role="group" aria-label="${esc(label)}">${opts.map(([v,l])=>`<label><input type="checkbox" data-tlf="${key}" value="${esc(v)}"${sel.includes(v)?" checked":""}> ${esc(l)}</label>`).join("")}</div></details></div>`;
}
function tlLanes(evs,pos,W){
  const lanes=[];
  for(const e of evs){
    const w=tlLabel(e).length*TL_CH+14,x=pos(e.n)*W/100;
    const l=Math.max(0,Math.min(W-w,x-w/2));e.l=l;
    let i=0;while(lanes[i]!==undefined&&lanes[i]+8>l)i++;
    lanes[i]=l+w;e.lane=i;
  }
  return lanes.length;
}
function renderTimeline(){
  if(!S.loaded.calls){app.innerHTML=loadingBlock();return}
  const sc=document.querySelector(".tl-scroll"),left=sc?sc.scrollLeft:0;
  const chosen=S.calls.filter(onTimeline);
  const opts=chosen.map(c=>[c.id,tlShort(c)]).sort((a,b)=>a[1].localeCompare(b[1]));
  TLF.call=TLF.call.filter(v=>opts.some(o=>o[0]===v));
  const evs=tlEvents(chosen,TLF);
  const Z=TL_ZOOMS[TLZ.i],W=TL_W*Z,filtered=TLF.call.length||TLF.kind.length;
  let h=`<div class="pagehead"><div><h1>Timeline</h1><p>Deadlines of the calls you added, with the day to start preparing for each. Add a call with <b>Add to timeline</b> on its entry; preparation times are set on <a href="#settings">Scope &amp; scans</a>.</p></div></div>
  <section class="block"><div class="sechead"><h2>Deadline timeline</h2><div class="tl-ctl"><div class="seg" role="group" aria-label="Zoom"><button type="button" data-tlz="-1" aria-label="Zoom out"${TLZ.i===0?" disabled":""}>−</button><button type="button" disabled class="tl-zl">${Z}×</button><button type="button" data-tlz="1" aria-label="Zoom in"${TLZ.i===TL_ZOOMS.length-1?" disabled":""}>+</button></div><button type="button" class="btn" data-tlz="today">Today</button></div></div>`;
  if(!chosen.length)return app.innerHTML=h+emptyBlock("No calls on the timeline yet","Open the catalogue and press Add to timeline on the calls you want to plan for. Only those calls appear here.",`<a href="#calls">Go to calls</a>`)+`</section>`;
  h+=`<div class="tl-bar">${tlMulti("call","Filter by call",opts,TLF.call,"All calls on the timeline")}${tlMulti("kind","Filter by date kind",TL_KINDS,TLF.kind,"All dates")}<label class="tl-chk"><input type="checkbox" data-tllabels${TLF.labels?" checked":""}> Show labels</label></div><p class="muted" style="font-size:.85rem;margin:0">Filled dot: submission deadline · ring below the line: start preparing or call opens · days counted from today · zoom in to separate crowded dates${TLF.labels?"":" · labels show on hover"}</p>`;
  if(!evs.length)h+=`<div class="empty"><span>${filtered?"No dates match these filters.":`None of these calls has a dated deadline in the next ${TL_MAX_AHEAD} days.`}</span></div>`;
  else{
    const end=Math.max(TL_MIN_AHEAD,Math.min(TL_MAX_AHEAD,evs[evs.length-1].n+10)),start=-TL_BACK,span=end-start;
    const pos=n=>(n-start)/span*100;
    const ids=chosen.map(c=>c.id).sort();
    const up=evs.filter(e=>e.kind==="due"),down=evs.filter(e=>e.kind!=="due");
    let nu=tlLanes(up,pos,W),nd=tlLanes(down,pos,W);
    if(!TLF.labels){for(const e of evs)e.lane=0;nu=Math.min(nu,1);nd=Math.min(nd,1)}
    const lineY=22+14+nu*TL_LANE+8,H_=lineY+nd*TL_LANE+34;
    const st=e=>`--c:hsl(${tlHue(ids,e.c.id)} var(--tl-s) var(--tl-l))`;
    const link=e=>"#call."+encodeURIComponent(e.c.id);
    const tip=e=>`${e.c.title}${e.c.funder?" · "+e.c.funder:""} · ${e.kind==="due"?e.stage+" due":e.kind==="opens"?"opens":"start preparing"} ${e.date}`;
    let t="";
    const d0=new Date();d0.setHours(12,0,0,0);
    for(let m=new Date(d0.getFullYear(),d0.getMonth()+Math.floor(start/30)-1,1,12);;m.setMonth(m.getMonth()+1)){
      const n=Math.round((m-d0)/864e5);if(n>end)break;if(n<start)continue;
      t+=`<span class="tl-tick" style="left:${pos(n)}%;top:${H_-20}px">${m.toLocaleDateString(undefined,{month:"short"})}${m.getMonth()===0?" "+m.getFullYear():""}</span>`;
    }
    t+=`<div class="tl-axis" style="top:${lineY}px"></div>`;
    for(const [list,dir] of [[up,-1],[down,1]])for(const e of list){
      const x=pos(e.n),lab=tlLabel(e);
      const ly=dir<0?lineY-14-(e.lane+1)*TL_LANE+4:lineY+14+e.lane*TL_LANE-2;
      const stemTop=dir<0?ly+TL_LANE-6:lineY,stemH=dir<0?lineY-stemTop:ly+6-lineY;
      t+=`<span class="tl-stem${e.n<0?" past":""}" style="${st(e)};left:${x}%;top:${stemTop}px;height:${stemH}px"></span>`;
      t+=`<a class="tl-node ${e.kind==="due"?"paper":"notif"}${e.n<0?" past":""}" href="${link(e)}" title="${esc(tip(e))}" aria-label="${esc(lab)}" style="${st(e)};left:${x}%;top:${lineY}px"></a>`;
      t+=`<a class="tl-lab${e.n<0?" past":""}" href="${link(e)}" title="${esc(tip(e))}" style="${st(e)};left:${e.l/W*100}%;top:${ly}px">${esc(lab)}</a>`;
    }
    t+=`<div class="tl-now" style="left:${pos(0)}%"></div><span class="tl-nowlab" style="left:${pos(0)}%">Today</span>`;
    h+=`<div class="tl-scroll"><div class="tl${TLF.labels?"":" nolab"}" style="height:${H_}px${Z>1?`;width:${W}px`:""}">${t}</div></div>`;
  }
  const ids=chosen.map(c=>c.id).sort();
  const rolling=chosen.filter(c=>!arr(c.deadlines).some(d=>d.date)).length;
  h+=`<div class="tl-legend">${chosen.slice().sort((a,b)=>String(a.title).localeCompare(String(b.title))).map(c=>`<span class="tl-item" style="--c:hsl(${tlHue(ids,c.id)} var(--tl-s) var(--tl-l))"><a href="#call.${encodeURIComponent(c.id)}"><i></i>${esc(tlShort(c))}</a><button type="button" class="tl-rm" data-tl-toggle="${esc(c.id)}" aria-label="Remove ${esc(c.title)} from the timeline" title="Remove from the timeline">×</button></span>`).join("")}${rolling?`<span class="muted">${plural(rolling,"call")} with rolling submission (no date to show)</span>`:""}</div></section>`;
  app.innerHTML=h;
  const s2=document.querySelector(".tl-scroll");if(s2&&left)s2.scrollLeft=left;
}
