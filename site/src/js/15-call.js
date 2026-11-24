/* ---------- call detail ---------- */
const MARK_ICON={met:"✓",unclear:"?",not_met:"✕"};
function renderCallDetail(id){
  if(!S.loaded.calls){app.innerHTML=loadingBlock();return}
  const c=S.calls.find(x=>x.id===id);
  if(!c){app.innerHTML=`<div class="empty"><b>This call isn't in the radar</b><a href="#calls">Back to calls</a></div>`;return}
  const m=markOf(c.id),w=weights(),a=affinityOf(c,w),s=c.scores||{};
  const conds=arr(c.eligibility);const v=c.verdict||verdictOf(conds);
  const verdictLine={eligible:"You meet every condition the funder states.",check:conds.length?"At least one condition needs checking before you apply.":"No conditions could be read from the call; check them on the funder's page.",not_eligible:"At least one condition is clearly not met."}[v];
  const bar=(k,l)=>num(s[k])==null?"":`<div class="sbar"><span>${l}</span><span class="b"><i style="width:${clamp(s[k],0,100)}%"></i></span><span class="n">${Math.round(s[k])} × ${Math.round(w[k]*100)}%</span></div>`;
  const deadlines=arr(c.deadlines).slice().sort((x,y)=>String(x.date).localeCompare(String(y.date)));
  const prov=c.provenance||{};
  const disc=m.discarded?`<button type="button" class="btn" data-restore="${esc(c.id)}">Restore</button>`:`<details class="disc"><summary class="btn">Discard…</summary><div class="discbox">${DISCARD.map(([v2,l])=>`<button type="button" data-discard="${esc(c.id)}" data-reason="${v2}">${esc(l)}</button>`).join("")}</div></details>`;
  app.innerHTML=`<a class="back" href="#calls">← All calls</a>
  <div class="dhead"><h1>${esc(c.title||"Untitled call")}</h1>
    <div class="meta">${esc(c.funder||"Unknown funder")}${c.programme?` · ${esc(c.programme)}`:""}${c.reference?` · <span class="mono">${esc(c.reference)}</span>`:""}</div>
    <div class="cmeta">${verdictBadge(v)}<span class="pill">${esc(typeLabel(c.type))}</span>${c.status?`<span class="pill${c.status==="new"?" acc":c.status==="changed"?" amb":""}">${esc((STATUSES.find(x=>x[0]===c.status)||[0,c.status])[1])}</span>`:""}${c.partial?`<span class="pill amb">Partial</span>`:""}${dueHtml(c)}</div>
    <div class="btnrow"><button type="button" class="btn${m.interested?" primary":""}" data-mark="interested" data-id="${esc(c.id)}" aria-pressed="${!!m.interested}">${m.interested?"Interested ✓":"Mark interested"}</button><button type="button" class="btn${m.applying?" primary":""}" data-mark="applying" data-id="${esc(c.id)}" aria-pressed="${!!m.applying}">${m.applying?"Applying ✓":"Mark applying"}</button>${disc}${m.discarded?`<span class="pill crit">Discarded: ${esc((DISCARD.find(d=>d[0]===m.discarded)||[0,m.discarded])[1])}</span>`:""}</div>
  </div>
  ${c.partial?`<div class="notice gap" id="partial-note">This call was read from a listing or summary page only. Details it does not state are unknown, not absent: open the call page before relying on them.</div>`:""}
  <div class="dgrid">
    <div class="prose">
      ${c.summary?`<section><div class="eyebrow">Summary</div><p>${esc(c.summary)}</p></section>`:""}
      <section class="panel" id="elig"><div class="sechead" style="border:0;padding:0"><h2>Eligibility</h2>${verdictBadge(v)}</div><p class="muted" style="margin:0">${esc(verdictLine)}</p>
        ${conds.length?`<ul class="conds">${conds.map(x=>`<li class="cond ${esc(x.mark||"unclear")}"><span class="ic" aria-label="${esc(x.mark||"unclear")}">${MARK_ICON[x.mark]||"?"}</span><div><b style="font-weight:500">${esc(x.text)}</b>${x.reason?`<p>${esc(x.reason)}</p>`:""}${x.mark==="unclear"&&x.question?`<p class="q">To find out: ${esc(x.question)}</p>`:""}</div></li>`).join("")}</ul>`:""}
      </section>
      <section class="panel" id="fit"><div class="sechead" style="border:0;padding:0"><h2>Affinity</h2>${ring(a,72)}</div>
        <div class="scorebars">${bar("topical","Topical fit")}${bar("skills","Skills fit")}${bar("practical","Practical fit")}${num(s.adjust)?`<div class="sbar"><span>Your feedback</span><span></span><span class="n">${s.adjust>0?"+":""}${Math.round(s.adjust)}</span></div>`:""}</div>
        ${c.why?`<p style="margin:0">${esc(c.why)}</p>`:""}
        ${arr(c.gaps).length?`<div><div class="eyebrow">What your profile lacks for this call</div><ul>${c.gaps.map(g=>`<li>${esc(g)}</li>`).join("")}</ul></div>`:""}
        <p class="muted" style="margin:0;font-size:.8rem">Scored against profile revision ${esc(c.scoredProfileRevision??"?")}${S.profile&&num(S.profile.revision)&&c.scoredProfileRevision!=null&&c.scoredProfileRevision<S.profile.revision?` · your profile has changed since: <a href="#settings">rescore</a>`:""}. The weights are yours to change on Scope &amp; scans.</p>
      </section>
      ${arr(c.requiredDocuments).length?`<section><div class="eyebrow">Required documents</div><ul>${c.requiredDocuments.map(d=>`<li>${esc(d)}</li>`).join("")}</ul></section>`:""}
      ${deadlines.length?`<section><div class="eyebrow">Deadlines</div><div class="tblwrap"><table><thead><tr><th>Stage</th><th>Date</th><th>Time</th></tr></thead><tbody>${deadlines.map(d=>`<tr><td>${esc(d.stage||"Deadline")}</td><td class="num">${fmtDate(d.date)}</td><td class="num">${esc([d.time,d.tz].filter(Boolean).join(" ")||"—")}</td></tr>`).join("")}</tbody></table></div></section>`:c.rolling?`<p class="muted">Rolling submission: no fixed deadline.</p>`:""}
    </div>
    <aside class="dside">
      <div class="panel"><dl class="kv">
        <dt>Amount</dt><dd style="font-family:var(--f-body)">${esc(amountText(c)||"Not stated")}</dd>
        <dt>Duration</dt><dd>${c.durationMonths&&(c.durationMonths.min||c.durationMonths.max)?esc([c.durationMonths.min,c.durationMonths.max].filter(x=>x!=null).filter((x,i,a)=>a.indexOf(x)===i).join("–"))+" months":"Not stated"}</dd>
        <dt>Funder in</dt><dd style="font-family:var(--f-body)">${esc(arr(c.countries).map(countryName).join(", ")||"—")}</dd>
        <dt>Work in</dt><dd style="font-family:var(--f-body)">${esc(arr(c.hostCountries).map(countryName).join(", ")||"Not restricted")}</dd>
        <dt>Theme</dt><dd style="font-family:var(--f-body)">${c.theme&&c.theme.open?"Open to any topic":esc((c.theme||{}).text||"Not stated")}</dd>
      </dl></div>
      <div class="panel"><div class="eyebrow">Links</div><div class="srcs">${c.links&&c.links.call?linkOut(c.links.call,"Call page"):"<span>No call page stored</span>"}${c.links&&c.links.guidelines?linkOut(c.links.guidelines,"Guidelines"):""}</div></div>
      <div class="panel"><div class="eyebrow">Where it was found</div><dl class="kv"><dt>Sources</dt><dd style="font-family:var(--f-body)">${esc(arr(prov.foundIn).join(", ")||"—")}</dd><dt>Read from funder</dt><dd>${prov.fromFunder?"yes":"no"}</dd><dt>First seen</dt><dd>${fmtDate(prov.firstSeen)}</dd><dt>Last confirmed</dt><dd>${fmtDate(prov.lastConfirmed)}</dd></dl></div>
    </aside>
  </div>`;
}
