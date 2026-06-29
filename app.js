import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, deleteDoc, collection, getDocs, addDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

var FB = initializeApp({
  apiKey:"AIzaSyCyLBXgZeYsTW8s7IiGr5foJzLmzo3D9z4",
  authDomain:"weight-tracking-joan.firebaseapp.com",
  projectId:"weight-tracking-joan",
  storageBucket:"weight-tracking-joan.firebasestorage.app",
  messagingSenderId:"452714898066",
  appId:"1:452714898066:web:ecaf9cf5489ad3a6bf3c4b"
});
var auth = getAuth(FB);
var db   = getFirestore(FB);
var currentUser = null;
var entries = [], goal = null, goalHistory = [], chart = null;

// ── HELPERS ───────────────────────────────────────────────────────────────────
function uDoc(p)  { return doc(db,'users',currentUser.uid,p); }
function uCol(p)  { return collection(db,'users',currentUser.uid,p); }
function eDoc(id) { return doc(db,'users',currentUser.uid,'entries',id); }
function ghDoc(id){ return doc(db,'users',currentUser.uid,'goalHistory',id); }
function today()  { return new Date().toISOString().slice(0,10); }
function fmt(s)   { if(!s) return '—'; var p=s.split('-'); return p[2]+'/'+p[1]+'/'+p[0]; }
function addDays(s,d){ var dt=new Date(s); dt.setDate(dt.getDate()+d); return dt.toISOString().slice(0,10); }
function weekKey(s){
  var dt=new Date(s), jan=new Date(dt.getFullYear(),0,1);
  var wk=Math.ceil(((dt-jan)/864e5+jan.getDay()+1)/7);
  return dt.getFullYear()+'-W'+(wk<10?'0':'')+wk;
}
function sync(msg,cls){
  var el=document.getElementById('sync-indicator');
  el.textContent=msg; el.className='sync-indicator '+(cls||'');
}

// ── AUTH ──────────────────────────────────────────────────────────────────────
document.getElementById('btn-google-sign-in').addEventListener('click',function(){
  signInWithPopup(auth,new GoogleAuthProvider()).catch(console.error);
});
document.getElementById('btn-signout').addEventListener('click',function(){ signOut(auth); });

onAuthStateChanged(auth,function(u){
  if(u){
    currentUser=u;
    document.getElementById('login-screen').style.display='none';
    document.getElementById('app-screen').style.display='';
    document.getElementById('user-name').textContent=u.displayName||u.email;
    var av=document.getElementById('user-avatar');
    if(u.photoURL) av.innerHTML='<img src="'+u.photoURL+'">';
    else av.textContent=(u.displayName||'U')[0].toUpperCase();
    setDoc(uDoc('data/profile'),{name:u.displayName||'',email:u.email||'',photoURL:u.photoURL||''});
    loadAll();
  } else {
    currentUser=null;
    document.getElementById('login-screen').style.display='flex';
    document.getElementById('app-screen').style.display='none';
    entries=[]; goal=null; goalHistory=[];
    if(chart){chart.destroy();chart=null;}
  }
});

// ── FIREBASE LOAD ─────────────────────────────────────────────────────────────
async function loadAll(){
  sync('Loading…');
  try{
    var eSnap=await getDocs(uCol('entries'));
    entries=eSnap.docs.map(function(d){return Object.assign({_id:d.id},d.data());});
    entries.sort(function(a,b){return a.date.localeCompare(b.date);});

    var gSnap=await getDoc(uDoc('data/goal'));
    goal=gSnap.exists()?gSnap.data():null;

    var ghSnap=await getDocs(uCol('goalHistory'));
    goalHistory=ghSnap.docs.map(function(d){return Object.assign({_id:d.id},d.data());});
    goalHistory.sort(function(a,b){return (b.savedOn||'').localeCompare(a.savedOn||'');});

    sync('Synced','saved'); setTimeout(function(){sync('');},2000);
    render();
  } catch(e){
    sync('Error loading data','error');
    console.error(e);
  }
}

// ── FIREBASE WRITE ────────────────────────────────────────────────────────────
async function fbSaveEntry(entry){
  sync('Saving…','saving');
  var ref=await addDoc(uCol('entries'),{date:entry.date,weight:entry.weight});
  entry._id=ref.id;
  sync('Saved','saved'); setTimeout(function(){sync('');},2000);
}
async function fbUpdateEntry(entry){
  sync('Saving…','saving');
  await setDoc(eDoc(entry._id),{date:entry.date,weight:entry.weight});
  sync('Saved','saved'); setTimeout(function(){sync('');},2000);
}
async function fbDeleteEntry(entry){
  sync('Saving…','saving');
  await deleteDoc(eDoc(entry._id));
  sync('Saved','saved'); setTimeout(function(){sync('');},2000);
}
async function fbSaveGoal(){
  sync('Saving…','saving');
  await setDoc(uDoc('data/goal'),goal);
  sync('Saved','saved'); setTimeout(function(){sync('');},2000);
}
async function fbDeleteGoal(){ await deleteDoc(uDoc('data/goal')); }
async function fbSaveGH(g){
  sync('Saving…','saving');
  var ref=await addDoc(uCol('goalHistory'),g);
  g._id=ref.id;
  sync('Saved','saved'); setTimeout(function(){sync('');},2000);
}
async function fbDeleteGH(g){ await deleteDoc(ghDoc(g._id)); }

// ── TABS ──────────────────────────────────────────────────────────────────────
document.getElementById('inp-date').value=today();
document.querySelectorAll('.tab').forEach(function(tab){
  tab.addEventListener('click',function(){
    document.querySelectorAll('.tab').forEach(function(t){t.classList.remove('active');});
    tab.classList.add('active');
    document.querySelectorAll('.section').forEach(function(s){s.classList.remove('active');});
    document.getElementById(tab.dataset.tab).classList.add('active');
    if(tab.dataset.tab==='goal') renderGoalTab();
  });
});

// ── ADD ENTRY ─────────────────────────────────────────────────────────────────
document.getElementById('btn-add').addEventListener('click',async function(){
  var d=document.getElementById('inp-date').value;
  var w=parseFloat(document.getElementById('inp-wt').value);
  var err=document.getElementById('add-err');
  if(!d){err.textContent='Please select a date.';return;}
  if(!w||w<30||w>250){err.textContent='Invalid weight (30–250 kg).';return;}
  if(entries.find(function(e){return e.date===d;})){err.textContent='An entry already exists for this day.';return;}
  err.textContent='';
  var entry={date:d,weight:w};
  entries.push(entry);
  entries.sort(function(a,b){return a.date.localeCompare(b.date);});
  document.getElementById('inp-wt').value='';
  render();
  await fbSaveEntry(entry);
});

// ── ENTRY ACTIONS ─────────────────────────────────────────────────────────────
function deleteEntry(entry,row,btn){
  if(row.dataset.confirm!=='1'){
    row.dataset.confirm='1'; btn.textContent='Confirm'; btn.style.background='#3a1a1a'; btn.style.color='#eb5757';
    setTimeout(function(){if(row.dataset.confirm==='1'){row.dataset.confirm='0';btn.textContent='Delete';btn.style.background='';btn.style.color='';}},3000);
    return;
  }
  entries=entries.filter(function(e){return e._id!==entry._id;});
  render(); fbDeleteEntry(entry);
}
function editEntry(date){
  document.querySelectorAll('.edit-row').forEach(function(r){r.style.display='none';});
  var row=document.getElementById('er-'+date);
  if(row){row.style.display='flex';row.querySelector('input').focus();}
}
function confirmEdit(entry){
  var inp=document.getElementById('ei-'+entry.date);
  var w=parseFloat(inp.value);
  if(!w||w<30||w>250){inp.style.borderColor='#eb5757';return;}
  entry.weight=w; render(); fbUpdateEntry(entry);
}
function cancelEdit(date){
  var row=document.getElementById('er-'+date);
  if(row)row.style.display='none';
}

// ── RENDER HISTORY ────────────────────────────────────────────────────────────
function renderHistory(){
  var list=document.getElementById('entry-list');
  list.innerHTML='';
  if(!entries.length){list.innerHTML='<p class="empty">No entries yet</p>';return;}
  [].concat(entries).reverse().forEach(function(e){
    var isToday=e.date===today();
    var row=document.createElement('div'); row.className='entry'; row.dataset.date=e.date;
    if(isToday){row.style.background='#2b3a2b';row.style.borderRadius='10px';}
    var ds=document.createElement('span'); ds.className='edate'; ds.textContent=fmt(e.date);
    if(isToday){
      var b=document.createElement('span'); b.textContent='Today';
      b.style.cssText='font-size:10px;background:#3a3540;color:#6fcf97;padding:2px 6px;border-radius:6px;margin-left:6px';
      ds.appendChild(b);
    }
    var ws=document.createElement('span'); ws.className='ewt'; ws.textContent=e.weight.toFixed(1)+' kg';
    var bw=document.createElement('span'); bw.style.cssText='display:flex;gap:4px';
    var eb=document.createElement('button'); eb.className='ebtn edit-btn'; eb.textContent='Edit';
    (function(en){eb.addEventListener('click',function(){editEntry(en.date);});})(e);
    var db=document.createElement('button'); db.className='ebtn del-btn'; db.textContent='Delete';
    (function(en,r,bn){db.addEventListener('click',function(){deleteEntry(en,r,bn);});})(e,row,db);
    bw.appendChild(eb); bw.appendChild(db);
    row.appendChild(ds); row.appendChild(ws); row.appendChild(bw);
    list.appendChild(row);
    var er=document.createElement('div'); er.className='edit-row'; er.id='er-'+e.date;
    var inp=document.createElement('input'); inp.type='number'; inp.id='ei-'+e.date; inp.value=e.weight; inp.min=30; inp.max=250; inp.step=0.1;
    var sv=document.createElement('button'); sv.className='btn primary'; sv.textContent='Save';
    (function(en){sv.addEventListener('click',function(){confirmEdit(en);});})(e);
    var ca=document.createElement('button'); ca.className='btn secondary'; ca.textContent='Cancel';
    (function(en){ca.addEventListener('click',function(){cancelEdit(en.date);});})(e);
    er.appendChild(inp); er.appendChild(sv); er.appendChild(ca);
    list.appendChild(er);
  });
}

// ── GOAL PREVIEW ─────────────────────────────────────────────────────────────
function updateGoalPreview(){
  var w=parseFloat(document.getElementById('g-wt').value);
  var s=document.getElementById('g-start').value;
  var p=parseFloat(document.getElementById('g-pace').value);
  var prev=document.getElementById('goal-preview');
  if(!w||!s||!p||p<=0){prev.style.display='none';return;}
  var n=entries.length, cur=n?entries[n-1].weight:null;
  var startW=cur!==null?cur:w;
  var delta=w-startW;
  var isBulk=delta>=0;
  var weeks=Math.abs(delta/p)||1;
  var days=Math.round(weeks*7);
  var endDate=addDays(s,days);
  prev.style.display='';
  prev.innerHTML='<b>'+(isBulk?'Bulking':'Cutting')+'</b>'+(cur!==null?' from <b>'+startW.toFixed(1)+' kg</b>':'')+' to <b>'+w+' kg</b><br>At <b>'+(isBulk?'+':'-')+p+' kg/wk</b> → <b>'+weeks.toFixed(1)+' weeks</b> (~'+days+' days)<br>Estimated end: <b>'+fmt(endDate)+'</b>';
}
['g-wt','g-start','g-pace'].forEach(function(id){
  document.getElementById(id).addEventListener('input',updateGoalPreview);
});

// ── GOAL SAVE ─────────────────────────────────────────────────────────────────
document.getElementById('btn-save-goal').addEventListener('click',async function(){
  var w=parseFloat(document.getElementById('g-wt').value);
  var s=document.getElementById('g-start').value;
  var p=parseFloat(document.getElementById('g-pace').value);
  var err=document.getElementById('goal-err');
  var btn=document.getElementById('btn-save-goal');
  if(!w||w<30||w>250){err.textContent='Enter a valid target weight (30–250 kg).';return;}
  if(!s){err.textContent='Please set a start date.';return;}
  if(!p||p<=0||p>2){err.textContent='Enter a valid pace (0.05–2 kg/week).';return;}
  var n=entries.length, cur=n?entries[n-1].weight:null;
  var startW=cur!==null?cur:w;
  var delta=w-startW;
  if(cur!==null&&Math.abs(delta)<0.1){err.textContent='Target weight must differ from current weight.';return;}
  var isBulk=delta>=0;
  var weeks=Math.abs(delta/p)||1;
  var days=Math.round(weeks*7);
  var endDate=addDays(s,days);
  if(endDate<=today()){err.textContent='Calculated end date is in the past. Adjust pace or start date.';return;}
  if(goal&&btn.dataset.confirm!=='1'){
    btn.dataset.confirm='1'; btn.textContent='Tap again to confirm';
    btn.style.background='#f2c94c'; btn.style.color='#1c1b1f';
    setTimeout(function(){btn.dataset.confirm='0';btn.textContent='Save goal';btn.style.background='';btn.style.color='';},3000);
    return;
  }
  if(goal){
    var old={weight:goal.weight,start:goal.start,date:goal.date,pace:goal.pace||null,isBulk:goal.isBulk,savedOn:today()};
    goalHistory.unshift(old); await fbSaveGH(old);
  }
  btn.dataset.confirm='0'; btn.textContent='Save goal'; btn.style.background=''; btn.style.color='';
  err.textContent='';
  goal={weight:w,start:s,date:endDate,pace:p,isBulk:isBulk};
  document.getElementById('btn-clear-goal').style.display='';
  render(); await fbSaveGoal();
});

// ── GOAL CLEAR ────────────────────────────────────────────────────────────────
document.getElementById('btn-clear-goal').addEventListener('click',async function(){
  var btn=document.getElementById('btn-clear-goal');
  if(btn.dataset.confirm!=='1'){
    btn.dataset.confirm='1'; btn.textContent='Tap again to confirm removal';
    btn.style.background='#3a1a1a'; btn.style.color='#eb5757';
    setTimeout(function(){btn.dataset.confirm='0';btn.textContent='Remove goal';btn.style.background='';btn.style.color='';},3000);
    return;
  }
  goal=null;
  ['g-wt','g-start','g-pace'].forEach(function(id){document.getElementById(id).value='';});
  document.getElementById('goal-preview').style.display='none';
  btn.dataset.confirm='0'; btn.textContent='Remove goal'; btn.style.background=''; btn.style.color='';
  btn.style.display='none';
  document.getElementById('goal-summary').style.display='none';
  render(); await fbDeleteGoal();
});

// ── GOAL TAB ──────────────────────────────────────────────────────────────────
function renderGoalTab(){
  if(goal){
    document.getElementById('g-wt').value=goal.weight;
    document.getElementById('g-start').value=goal.start||'';
    document.getElementById('g-pace').value=goal.pace||'';
    document.getElementById('btn-clear-goal').style.display='';
    updateGoalPreview();
    renderGoalSummary();
  } else {
    document.getElementById('btn-clear-goal').style.display='none';
    document.getElementById('goal-summary').style.display='none';
    document.getElementById('goal-preview').style.display='none';
  }
  var ghCard=document.getElementById('goal-history-card');
  var ghList=document.getElementById('goal-history-list');
  if(goalHistory.length){
    ghCard.style.display=''; ghList.innerHTML='';
    goalHistory.forEach(function(g){
      var isBulk=g.isBulk!==undefined?g.isBulk:false;
      var div=document.createElement('div'); div.className='past-goal';
      var info=document.createElement('div');
      info.innerHTML='<span style="font-size:12px;font-weight:500;color:'+(isBulk?'#6fcf97':'#eb5757')+'">'+(isBulk?'Bulk':'Cut')+'</span><span style="font-size:13px;color:#938f99;margin-left:8px">'+fmt(g.start)+' → '+fmt(g.date)+'</span>';
      var right=document.createElement('div'); right.style.cssText='display:flex;align-items:center;gap:10px';
      var ws=document.createElement('span'); ws.style.cssText='font-size:14px;font-weight:500;color:#e6e1e5'; ws.textContent=g.weight+' kg';
      var db=document.createElement('button'); db.className='ebtn'; db.textContent='Delete';
      (function(gh,row,btn){db.addEventListener('click',function(){deleteGH(gh,row,btn);});})(g,div,db);
      right.appendChild(ws); right.appendChild(db);
      div.appendChild(info); div.appendChild(right);
      ghList.appendChild(div);
    });
  } else ghCard.style.display='none';
}

function renderGoalSummary(){
  if(!goal)return;
  document.getElementById('goal-summary').style.display='';
  var n=entries.length, cur=n?entries[n-1].weight:null;
  var remW=Math.max(0.01,(new Date(goal.date)-new Date())/(7*864e5));
  var kpwN=cur?((goal.weight-cur)/remW).toFixed(2):'—';
  var sign=parseFloat(kpwN)>0?'+':'';
  var totW=Math.round((new Date(goal.date)-new Date(goal.start))/(7*864e5));
  document.getElementById('goal-summary-text').innerHTML=
    '<b>'+goal.weight+' kg</b> by <b>'+fmt(goal.date)+'</b><br>'+
    '<span style="color:#938f99;font-size:13px">Started '+fmt(goal.start)+' · '+totW+' weeks · target pace: <b>'+(goal.isBulk?'+':'-')+goal.pace+' kg/wk</b>'+(cur?'<br>Currently need: <b>'+sign+kpwN+' kg/wk</b>':'')+'</span>';
}

async function deleteGH(g,row,btn){
  if(row.dataset.confirm!=='1'){
    row.dataset.confirm='1'; btn.textContent='Confirm'; btn.style.background='#3a1a1a'; btn.style.color='#eb5757';
    setTimeout(function(){if(row.dataset.confirm==='1'){row.dataset.confirm='0';btn.textContent='Delete';btn.style.background='';btn.style.color='';}},3000);
    return;
  }
  goalHistory=goalHistory.filter(function(x){return x._id!==g._id;});
  await fbDeleteGH(g); renderGoalTab();
}

// ── MAIN RENDER ───────────────────────────────────────────────────────────────
function render(){
  var n=entries.length;
  var wts=entries.map(function(e){return e.weight;});
  var cur=n?wts[n-1]:null;

  // Cycle label
  var cl=document.getElementById('cycle-label'), dv=document.getElementById('hdivider');
  if(goal&&goal.start&&goal.date){
    var cycleIsBulk=goal.isBulk!==undefined?goal.isBulk:true;
    cl.style.display=''; dv.style.display='';
    cl.textContent=cycleIsBulk?'BULKING CYCLE':'CUTTING CYCLE';
    cl.style.color=cycleIsBulk?'#6fcf97':'#eb5757';
  } else {cl.style.display='none';dv.style.display='none';}

  // Stats
  if(n>=1){
    var sl=wts.slice(Math.max(0,n-7));
    var curAvg=sl.reduce(function(a,b){return a+b;},0)/sl.length;
    document.getElementById('s-cur').textContent=curAvg.toFixed(1)+' kg';
    var re=document.getElementById('s-rate');
    if(n>=8){
      var prev=wts.slice(Math.max(0,n-14),n-7);
      var prevAvg=prev.reduce(function(a,b){return a+b;},0)/prev.length;
      document.getElementById('s-avg').textContent=prevAvg.toFixed(1)+' kg';
      var diff=curAvg-prevAvg;
      re.textContent=(diff>=0?'+':'')+diff.toFixed(1)+' kg';
      re.style.color=diff>0?'#6fcf97':diff<0?'#eb5757':'#e6e1e5';
    } else {
      document.getElementById('s-avg').textContent='—';
      re.textContent='—';
    }
  } else {
    document.getElementById('s-cur').textContent='—';
    document.getElementById('s-avg').textContent='—';
    document.getElementById('s-rate').textContent='—';
  }

  // Goal banner
  var chip=document.getElementById('pace-chip');
  var pdesc=document.getElementById('pace-desc');
  var bars=document.getElementById('bars');
  var proj=document.getElementById('proj-line');
  var btitle=document.getElementById('banner-title');

  if(!goal||!goal.start||!goal.date||!cur){
    chip.className='chip none';
    chip.textContent=(!goal||!goal.start||!goal.date)?'No goal set':'Not enough data';
    pdesc.textContent=''; bars.style.display='none'; proj.style.display='none'; btitle.textContent='Goal';
  } else {
    var now=new Date(), gS=new Date(goal.start), gE=new Date(goal.date);
    var timePct=Math.min(100,Math.max(0,Math.round((now-gS)/(gE-gS)*100)));
    var totWk=Math.max(0.01,(gE-gS)/(7*864e5));
    var elWk=Math.max(0,(now-gS)/(7*864e5));
    var remWk=Math.max(0.01,(gE-now)/(7*864e5));
    var se=entries.find(function(e){return e.date>=goal.start;})||entries[0];
    var sw=se.weight;
    var goalIsGain=goal.isBulk!==undefined?goal.isBulk:goal.weight>sw;

    var kpw=(goal.weight-cur)/remWk, sign=kpw>=0?'+':'';

    // Pace comparison — entry-based, not day-based
    var desiredPace=goal.pace;
    var chipMsg, chipClass, pdescMsg;
    if(n<8){
      chipClass='none'; chipMsg='Need '+(8-n)+' more log'+(8-n===1?'':'s');
      pdescMsg='';
    } else {
      var curSlice=entries.slice(n-7);
      var prevSlice=entries.slice(Math.max(0,n-14),n-7);
      var curAvgP=curSlice.reduce(function(a,b){return a+b.weight;},0)/curSlice.length;
      var prevAvgP=prevSlice.reduce(function(a,b){return a+b.weight;},0)/prevSlice.length;
      var curMidDate=new Date(curSlice[Math.floor(curSlice.length/2)].date);
      var prevMidDate=new Date(prevSlice[Math.floor(prevSlice.length/2)].date);
      var weeksBetween=Math.max(0.01,(curMidDate-prevMidDate)/(7*864e5));
      var actualPaceP=(curAvgP-prevAvgP)/weeksBetween;
      var directedActual=goalIsGain?actualPaceP:-actualPaceP;
      var tol=desiredPace*0.25;
      var paceAhead=directedActual>desiredPace+tol;
      var paceBehind=directedActual<desiredPace-tol;
      if(paceAhead){chipClass='fast';chipMsg=goalIsGain?'Eat less':'Eat more';pdescMsg='Slow down · need '+sign+kpw.toFixed(2)+' kg/wk';}
      else if(paceBehind){chipClass='slow';chipMsg=goalIsGain?'Eat more':'Eat less';pdescMsg='Push harder · need '+sign+kpw.toFixed(2)+' kg/wk';}
      else{chipClass='on';chipMsg='On track';pdescMsg=sign+kpw.toFixed(2)+' kg/wk needed';}
    }

    btitle.textContent='Goal · '+goal.weight+' kg by '+fmt(goal.date);
    chip.className='chip '+chipClass; chip.textContent=chipMsg; pdesc.textContent=pdescMsg;

    // Projection — two-average method (mirrors pace chip)
    proj.style.display='';
    if(n<8){
      proj.textContent='Log more entries to see projection';
    } else {
      var movRight=(goalIsGain&&actualPaceP>0)||(!goalIsGain&&actualPaceP<0);
      if(Math.abs(actualPaceP)<0.001) proj.textContent='Trend is flat — log more data';
      else if(!movRight) proj.textContent='Current trend is moving away from goal';
      else{
        var wn=(goal.weight-curAvgP)/actualPaceP;
        var pd=new Date(); pd.setDate(pd.getDate()+Math.round(wn*7));
        var ps=(pd.getDate()<10?'0':'')+pd.getDate()+'/'+(pd.getMonth()<9?'0':'')+(pd.getMonth()+1)+'/'+pd.getFullYear();
        var dd=Math.round((pd-gE)/864e5);
        var dt=dd===0?'right on time':dd<0?Math.abs(dd)+'d early':dd+'d late';
        proj.innerHTML='At current rate, projected arrival: <b>'+ps+'</b> — <b>'+dt+'</b>';
      }
    }

    // Bars
    bars.style.display='';
    document.getElementById('tl-s').textContent=fmt(goal.start);
    document.getElementById('tl-e').textContent=fmt(goal.date);
    document.getElementById('time-fill').style.width=timePct+'%';
    var dLeft=Math.max(0,Math.round((gE-now)/864e5));
    document.getElementById('time-sub').textContent='Time elapsed: '+timePct+'% · '+dLeft+' day'+(dLeft!==1?'s':'')+' left';
    var totD=Math.abs(goal.weight-sw), doneD=Math.abs(cur-sw);
    var wPct=totD>0?Math.min(100,Math.round(doneD/totD*100)):100;
    document.getElementById('wl-s').textContent=sw.toFixed(1)+' kg';
    document.getElementById('wl-e').textContent=goal.weight.toFixed(1)+' kg';
    document.getElementById('wt-fill').style.width=wPct+'%';
    document.getElementById('wt-sub').textContent='Weight progress: '+wPct+'% · '+Math.abs(goal.weight-cur).toFixed(1)+' kg left';
  }

  renderGoalSummary();

  // Chart — day-based X axis, null for days with no entry (creates visible gaps)
  var entryMap={};
  entries.forEach(function(e){entryMap[e.date]=e.weight;});
  var allDates=[];
  if(n){
    var dc=new Date(entries[0].date), de=new Date(entries[n-1].date);
    while(dc<=de){allDates.push(dc.toISOString().slice(0,10));dc.setDate(dc.getDate()+1);}
  }
  var labels=allDates.map(function(d){var p=d.split('-');return p[2]+'/'+p[1];});
  var chartWts=allDates.map(function(d){return entryMap[d]!==undefined?entryMap[d]:null;});
  var datasets=[{
    label:'Weight',data:chartWts,borderColor:'#d0bcff',backgroundColor:'rgba(208,188,255,0.08)',
    borderWidth:2,pointRadius:4,pointBackgroundColor:'#d0bcff',tension:0.3,fill:true,spanGaps:true
  }];
  if(goal&&goal.start&&goal.date&&n){
    var sd=new Date(goal.start), gd=new Date(goal.date);
    var se2=entries.find(function(e){return e.date>=goal.start;})||entries[0];
    var sw2=se2.weight, totW2=Math.max(0.01,(gd-sd)/(7*864e5));
    var ideal=allDates.map(function(d){
      if(d<goal.start) return null;
      var t=(new Date(d)-sd)/(7*864e5);
      return parseFloat((sw2+(goal.weight-sw2)*(t/totW2)).toFixed(2));
    });
    datasets.push({label:'Ideal pace',data:ideal,borderColor:'#6fcf97',borderWidth:1.5,borderDash:[6,3],pointRadius:0,tension:0,fill:false,spanGaps:true});
  }

  var gc='rgba(255,255,255,0.06)', tc='#938f99';
  if(!chart){
    chart=new Chart(document.getElementById('chart'),{
      type:'line',data:{labels:labels,datasets:datasets},
      options:{responsive:true,maintainAspectRatio:false,
        plugins:{legend:{display:false},tooltip:{callbacks:{label:function(ctx){return ctx.dataset.label+': '+ctx.parsed.y.toFixed(1)+' kg';}}}},
        scales:{
          x:{ticks:{color:tc,font:{size:11},maxTicksLimit:10},grid:{color:gc}},
          y:{ticks:{color:tc,font:{size:11},callback:function(v){return v.toFixed(1);}},grid:{color:gc}}
        }
      }
    });
  } else {
    chart.data.labels=labels; chart.data.datasets=datasets; chart.update();
  }

  // Weekly summary
  var weeks={};
  entries.forEach(function(e){var k=weekKey(e.date);if(!weeks[k])weeks[k]=[];weeks[k].push(e.weight);});
  var wsum=document.getElementById('week-summary');
  if(!n){wsum.innerHTML='<p class="empty">No entries yet</p>';}
  else{
    var rows=Object.entries(weeks).sort(function(a,b){return b[0].localeCompare(a[0]);}).slice(0,8).map(function(pair){
      var ws2=pair[1], avg=(ws2.reduce(function(a,b){return a+b;},0)/ws2.length).toFixed(1), parts=pair[0].split('-W');
      return '<tr><td>Week '+parts[1]+', '+parts[0]+'</td><td>'+avg+' kg</td><td>'+ws2.length+' entr'+(ws2.length===1?'y':'ies')+'</td></tr>';
    }).join('');
    wsum.innerHTML='<table class="wtbl"><thead><tr><th>Week</th><th>Avg</th><th></th></tr></thead><tbody>'+rows+'</tbody></table>';
  }

  renderHistory();
}
