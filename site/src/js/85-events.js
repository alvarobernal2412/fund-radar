/* ---------- events ---------- */
app.addEventListener("input",e=>{
  const v=route().view;
  if(v==="calls"&&e.target.closest("#cat-tools")){readFilters();return}
  if(v==="profile"&&e.target.closest("form"))PF.dirty=true;
  if(v==="settings"&&e.target.closest("form")){ST.dirty=true;if(e.target.dataset.w)showWeights()}
});
app.addEventListener("change",e=>{
  const v=route().view;const t=e.target;
  if(v==="calls"&&t.closest("#cat-tools")){readFilters();return}
  const tf=t.closest("[data-tlf]");if(tf){tlSetFilter(tf.dataset.tlf,tf.value,tf.checked);return}
  if(t.closest("[data-tllabels]")){tlSetLabels(t.checked);return}
  if(t.id==="pf-file"){const fs=[...t.files];t.value="";addFiles(fs);return}
  if(t.id==="pf-showhidden"){PF.showHidden=t.checked;const s=document.getElementById("pf-pubs");if(s)s.innerHTML=publicationsSection();return}
  if(t.dataset.src&&!t.disabled){toggleSource(t.dataset.src,t.checked);return}
  if(t.dataset.country&&v==="settings"){
    // Re-render the scope so the newly picked country's universities appear; keep what was ticked.
    const sc=readScope();if(sc){ST.preview=sc;const s=document.getElementById("st-scope");if(s){const keep=S.config;S.config=Object.assign({},S.config||{},sc);s.innerHTML=scopeSection();S.config=keep}}
  }
});
app.addEventListener("click",e=>{
  const q=e.target.closest("[data-quick]");if(q){e.preventDefault();quickFilter(q.dataset.quick);return}
  if(e.target.closest("#flt-reset")){Object.assign(F,F_DEFAULT,{type:[],country:[],status:[],verdict:F_DEFAULT.verdict.slice()});saveFilters();renderCatalogShell();updateCatalog();return}
  const tz=e.target.closest("[data-tlz]");if(tz&&!tz.disabled){tlZoomBy(tz.dataset.tlz);return}
  const tt=e.target.closest("[data-tl-toggle]");if(tt){e.preventDefault();toggleMark(tt.dataset.tlToggle,"timeline");return}
  const m=e.target.closest("[data-mark]");if(m){e.preventDefault();toggleMark(m.dataset.id,m.dataset.mark);return}
  const d=e.target.closest("[data-discard]");if(d){e.preventDefault();const det=d.closest("details");if(det)det.open=false;discardCall(d.dataset.discard,d.dataset.reason);return}
  const r=e.target.closest("[data-restore]");if(r){e.preventDefault();restoreCall(r.dataset.restore);return}
  const pub=e.target.closest("[data-pub]");if(pub){togglePub(pub.dataset.pub);return}
  const tl=e.target.closest("details.tl-list summary");if(tl){const det=tl.parentElement;setTimeout(()=>{if(det.open)ST.tlOpen.add(det.dataset.tl);else ST.tlOpen.delete(det.dataset.tl)},0)}
  const pf=e.target.closest("[data-pf]");if(pf&&!pf.disabled){
    const a=pf.dataset.pf;
    if(a==="save-inputs")saveInputs();
    else if(a==="rm-file")removeFile(Number(pf.dataset.i));
    else if(a==="draft-now")draftNow();
    else if(a==="queue-derive")queueDerive(false);
    else if(a==="derive-run")queueDerive(true);
    else if(a==="save-answers")saveAnswers();
    else if(a==="edit"){PF.editing=true;PF.draft=null;renderProfile();document.getElementById("pf-main").scrollIntoView({block:"start"})}
    else if(a==="cancel-edit"){PF.editing=false;PF.draft=null;renderProfile()}
    else if(a==="save-confirm")saveProfileEdits();
    else if(a==="confirm")confirmProfile();
    else if(a==="accept")resolvePending(pf.dataset.i,true);
    else if(a==="reject")resolvePending(pf.dataset.i,false);
    else if(a==="accept-all")resolvePending("all",true);
    else if(a==="reject-all")resolvePending("all",false);
    return;
  }
  const st=e.target.closest("[data-st]");if(st&&!st.disabled){
    const a=st.dataset.st;
    if(a==="save-scope")saveScope();
    else if(a==="save-weights")saveWeights(false);
    else if(a==="reset-weights")saveWeights(true);
    else if(a==="save-prep")savePrep();
    else if(a==="run-now")requestScan(true);
    else if(a==="queue")requestScan(false);
    else if(a==="export")exportData();
    return;
  }
});
// Close an open dropdown or discard menu when clicking elsewhere.
document.addEventListener("click",e=>{document.querySelectorAll("details.msel[open],details.disc[open]").forEach(d=>{if(!d.contains(e.target))d.open=false})});
app.addEventListener("dragover",e=>{const z=e.target.closest("#pf-drop");if(z){e.preventDefault();z.classList.add("over")}});
app.addEventListener("dragleave",e=>{const z=e.target.closest("#pf-drop");if(z)z.classList.remove("over")});
app.addEventListener("drop",e=>{const z=e.target.closest("#pf-drop");if(!z)return;e.preventDefault();z.classList.remove("over");if(S.canEdit)addFiles([...e.dataTransfer.files])});
