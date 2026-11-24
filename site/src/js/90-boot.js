/* ---------- boot ---------- */
render(true);
(async()=>{
  let db=null;
  try{db=window.claude&&window.claude.use?await window.claude.use("db"):null}catch(e){db=null}
  if(!db){S.dbState="none";render(true);return}
  S.db=db;S.dbState="ok";
  const fail=()=>{};
  db.collection("calls").limit(2000).onSnapshot(s=>{S.calls=s.docs.map(d=>Object.assign({},d.data(),{id:d.id}));S.loaded.calls=true;schedule()},()=>{S.loaded.calls=true;schedule()});
  db.collection("meta").onSnapshot(s=>{
    const by={};for(const d of s.docs)by[d.id]=d.data();
    S.config=by.config||null;S.weights=by.weights||null;S.profile=by.profile||null;S.profileText=by["profile-text"]||null;S.run=by.run||null;S.control=by.control||null;
    S.loaded.meta=true;schedule();
  },fail);
  try{
    const user=await window.claude.use("user");
    if(user){S.canEdit=!!(await user.canEdit());S.uid=await user.id();
      if(S.uid)db.doc(`data/users/${S.uid}/marks`).onSnapshot(d=>{const v=d.exists?d.data():null;S.marks=(v&&v.calls)||{};S.loaded.marks=true;schedule()},fail);
    }
  }catch(e){}
  render(true);
})();
