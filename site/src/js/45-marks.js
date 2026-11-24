/* ---------- marks (per viewer) ---------- */
// Stored in data/users/<id>/marks as {calls: {<call id>: {interested, applying, timeline, discarded, at}}}.
// "timeline" puts the call on the Timeline page; nothing is on it until the viewer adds it.
// Discarding keeps the call: it only leaves the list until "Show discarded" is ticked.
let markBusy=Promise.resolve();
function saveMarks(){
  const snapshot=S.marks,path=`data/users/${S.uid}/marks`;
  markBusy=markBusy.then(()=>S.db.doc(path).set({calls:snapshot})).catch(()=>{});
}
function setMark(id,patch){
  if(!S.db||!S.uid)return;
  const cur=Object.assign({},S.marks[id]||{},patch,{at:new Date().toISOString()});
  for(const k of Object.keys(cur))if(cur[k]===false||cur[k]===null)delete cur[k];
  S.marks=Object.assign({},S.marks,{[id]:cur});saveMarks();
  const v=route().view;if(v==="call")render(true);else if(v==="timeline")renderTimeline();else updateCatalog();
}
function toggleMark(id,kind){setMark(id,{[kind]:!(S.marks[id]||{})[kind]})}
function discardCall(id,reason){setMark(id,{discarded:reason,interested:false,applying:false,timeline:false})}
function restoreCall(id){setMark(id,{discarded:null})}
