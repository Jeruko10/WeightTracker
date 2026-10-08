import { collection, doc, getDocs, setDoc, updateDoc, deleteDoc, writeBatch } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ── STATE ─────────────────────────────────────────────────────────────────────
// Firestore layout, all under users/{uid}/:
//   trainingDays/{id}  {name, order, createdAt}
//   exercises/{id}     {dayId, name, order, sets:[{id,min,max}]}
//   exerciseLogs/{id}  {exerciseId, setId, date, reps, weight, createdAt}
// Sets carry their own stable id so a log stays attached to the right set when sets are
// added, removed or reordered — an index would silently shift history onto another set.
var db=null, uid=null, sync=function(){};
var days=[], exercises=[], logs=[], loaded=false, loadError=false;
var editMode=false;
var showAll=new Set();
// Which inline form is open, if any. Only one at a time keeps the tree calm.
var ui={addFor:null,editLog:null,editDay:null,editEx:null,newExFor:null};
var charts={};
var OPEN_KEY='wt-ex-open';
var open=loadOpen();

var MAX_SETS=10, MIN_SETS=1, MIN_REPS=1, MAX_REPS=500, HISTORY_PREVIEW=5, CHART_ENTRIES=10;
// One colour per set, used for the set's dot, its chart line and its legend entry. Red sits
// late in the list so the first sets never read as the "below range" colour.
var SET_COLORS=['#d0bcff','#6fcf97','#f2c94c','#56ccf2','#f2994a','#ff8fab','#4fd1c5','#a3e635','#eb5757','#e6e1e5'];
var CHEV='<svg class="chev" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 4l4 4 4-4"/></svg>';
// Inline SVG rather than ↑ ✎ ✕ characters, which some platforms swap for coloured emoji.
function icon(d){ return '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="'+d+'"/></svg>'; }
var ICON={
  up:icon('M8 13V3M4 7l4-4 4 4'),
  down:icon('M8 3v10M4 9l4 4 4-4'),
  edit:icon('M10.5 2.5l3 3L6 13H3v-3z'),
  del:icon('M4 4l8 8M12 4l-8 8')
};

// ── HELPERS ───────────────────────────────────────────────────────────────────
function today()  { var d=new Date(); return new Date(d.getTime()-d.getTimezoneOffset()*6e4).toISOString().slice(0,10); }
function fmtShort(s){ var p=s.split('-'); return p[2]+'/'+p[1]+'/'+p[0].slice(2); }
function fmtW(w)  { return String(Math.round((w||0)*100)/100); }
function esc(s)   { return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
function col(n)   { return collection(db,'users',uid,n); }
function ref(n,id){ return doc(db,'users',uid,n,id); }
function newId(n) { return doc(col(n)).id; }
function setId()  { return Math.random().toString(36).slice(2,10); }
function byOrder(a,b){ return (a.order||0)-(b.order||0)||(a.createdAt||0)-(b.createdAt||0); }
function byDate(a,b) { return a.date.localeCompare(b.date)||(a.createdAt||0)-(b.createdAt||0); }
function sortedDays(){ return days.slice().sort(byOrder); }
function dayExercises(dayId){ return exercises.filter(function(x){return x.dayId===dayId;}).sort(byOrder); }
function setLogs(exId,sId){ return logs.filter(function(l){return l.exerciseId===exId&&l.setId===sId;}).sort(byDate); }
function rangeText(s){ return s.min===s.max?String(s.min):s.min+'–'+s.max; }
function repsState(reps,s){ return reps>s.max?'up':reps<s.min?'down':'in'; }
function uniformRange(x){ return x.sets.every(function(s){return s.min===x.sets[0].min&&s.max===x.sets[0].max;}); }

function loadOpen(){
  try{ return new Set(JSON.parse(localStorage.getItem(OPEN_KEY)||'[]')); }catch(e){ return new Set(); }
}
function saveOpen(){
  try{ localStorage.setItem(OPEN_KEY,JSON.stringify(Array.from(open))); }catch(e){}
}

// Default weight for a new log: this set's last one, else the previous sets' (a fresh set 3
// usually starts at set 2's weight), else whatever any set of the exercise last used.
function lastWeight(x,k){
  for(var i=k;i>=0;i--){
    var h=setLogs(x.id,x.sets[i].id);
    if(h.length) return h[h.length-1].weight;
  }
  var all=logs.filter(function(l){return l.exerciseId===x.id;}).sort(byDate);
  return all.length?all[all.length-1].weight:'';
}

// ── FIREBASE ──────────────────────────────────────────────────────────────────
function persist(task){
  sync('Saving…','saving');
  return task().then(function(){ sync('Saved','saved'); setTimeout(function(){sync('');},2000); })
    .catch(function(e){ console.error(e); sync('Error saving — check your connection','error'); });
}
// Cascading deletes and reorders are written as batches so they land all-or-nothing. A batch
// holds at most 500 writes, so a day with a long history is split across several.
function runBatch(ops){
  if(!ops.length) return Promise.resolve();
  return persist(async function(){
    for(var i=0;i<ops.length;i+=450){
      var b=writeBatch(db);
      ops.slice(i,i+450).forEach(function(o){
        if(o.type==='delete') b.delete(o.ref);
        else if(o.type==='update') b.update(o.ref,o.data);
        else b.set(o.ref,o.data);
      });
      await b.commit();
    }
  });
}
function dayData(d){ return {name:d.name,order:d.order,createdAt:d.createdAt}; }
function exData(x){ return {dayId:x.dayId,name:x.name,order:x.order,sets:x.sets.map(function(s){return {id:s.id,min:s.min,max:s.max};})}; }
function logData(l){ return {exerciseId:l.exerciseId,setId:l.setId,date:l.date,reps:l.reps,weight:l.weight,createdAt:l.createdAt}; }

export async function loadExercises(userId){
  uid=userId; loaded=false; loadError=false; render();
  try{
    var r=await Promise.all([getDocs(col('trainingDays')),getDocs(col('exercises')),getDocs(col('exerciseLogs'))]);
    var rows=function(s){ return s.docs.map(function(d){return Object.assign({id:d.id},d.data());}); };
    days=rows(r[0]); exercises=rows(r[1]); logs=rows(r[2]);
    loaded=true;
    // Forget remembered folds for things deleted on another device.
    var live=new Set(foldKeys().concat(exercises.map(function(x){return 'c:'+x.id;})));
    open=new Set(Array.from(open).filter(function(k){return live.has(k);}));
    saveOpen();
  }catch(e){
    console.error(e); loadError=true;
    sync('Error loading exercises','error');
  }
  render();
}

export function clearExercises(){
  uid=null; days=[]; exercises=[]; logs=[]; loaded=false; editMode=false;
  resetForms(); ui.addFor=null;
  render();
}

// ── RENDER ────────────────────────────────────────────────────────────────────
function iconBtn(label,action,id,title,disabled,danger){
  return '<button class="icon-btn'+(danger?' danger':'')+'" data-action="'+action+'" data-id="'+id+'" title="'+title+'" aria-label="'+title+'"'+(disabled?' disabled':'')+'>'+label+'</button>';
}
function textBtn(label,action,id,cls){
  return '<button class="'+cls+'" data-action="'+action+'" data-id="'+(id||'')+'">'+label+'</button>';
}
function editActions(kind,id,i,n){
  return '<span class="row-actions edit-only">'+
    iconBtn(ICON.up,kind+'-up',id,'Move up',i===0)+
    iconBtn(ICON.down,kind+'-down',id,'Move down',i===n-1)+
    iconBtn(ICON.edit,kind+'-edit',id,'Edit')+
    iconBtn(ICON.del,kind+'-del',id,'Delete',false,true)+'</span>';
}
function foldClass(key){ return 'foldable'+(open.has(key)?' open':''); }

function dayHtml(d,i,arr){
  var exs=dayExercises(d.id), key='d:'+d.id;
  var head=ui.editDay===d.id
    ? '<div class="rename-row" data-form="day:'+d.id+'">'+
        '<input type="text" name="name" maxlength="40" value="'+esc(d.name)+'" aria-label="Day name">'+
        textBtn('Save','day-rename-save',d.id,'btn primary sm')+textBtn('Cancel','cancel','','btn secondary sm')+'</div>'
    : '<div class="fold-head day-head" data-action="toggle" role="button" tabindex="0">'+CHEV+
        '<span class="day-name">'+esc(d.name)+'</span>'+
        '<span class="meta">'+exs.length+' exercise'+(exs.length===1?'':'s')+'</span>'+
        editActions('day',d.id,i,arr.length)+'</div>';
  var body=exs.length
    ? exs.map(function(x,j){return exHtml(x,j,exs.length);}).join('')
    : '<p class="hist-empty">No exercises yet'+(editMode?'':' — turn on Edit mode to add some')+'</p>';
  body+=ui.newExFor===d.id
    ? '<div class="edit-only">'+exerciseForm(null,d.id)+'</div>'
    : textBtn('+ Add exercise','ex-new',d.id,'add-ex-btn edit-only');
  return '<div class="day card '+foldClass(key)+'" data-key="'+key+'">'+head+
    '<div class="fold"><div class="fold-inner"><div class="day-body">'+body+'</div></div></div></div>';
}

function exSummary(x){
  var n=x.sets.length;
  return n+' set'+(n===1?'':'s')+(uniformRange(x)?' · '+rangeText(x.sets[0])+' reps':'');
}

function exHtml(x,j,n){
  var key='e:'+x.id;
  var head='<div class="fold-head ex-head" data-action="toggle" role="button" tabindex="0">'+CHEV+
    '<div class="ex-titles"><span class="ex-name">'+esc(x.name)+'</span><span class="meta">'+exSummary(x)+'</span></div>'+
    editActions('ex',x.id,j,n)+'</div>';
  var body=ui.editEx===x.id
    ? exerciseForm(x,x.dayId)
    : x.sets.map(function(s,k){return setHtml(x,s,k);}).join('')+chartHtml(x);
  return '<div class="ex '+foldClass(key)+'" data-key="'+key+'">'+head+
    '<div class="fold"><div class="fold-inner"><div class="ex-body">'+body+'</div></div></div></div>';
}

function setHtml(x,s,k){
  var sk=x.id+':'+s.id, hist=setLogs(x.id,s.id).reverse();
  var shown=showAll.has(sk)?hist:hist.slice(0,HISTORY_PREVIEW);
  var h='<div class="set"><div class="set-head">'+
    '<span class="set-dot" style="background:'+SET_COLORS[k]+'"></span>'+
    '<span class="set-name">Set '+(k+1)+'</span>'+
    '<span class="set-range">'+rangeText(s)+' reps</span>'+
    (ui.addFor===sk?'':textBtn('+ Log','log-open',sk,'log-btn'))+'</div>';
  if(ui.addFor===sk) h+=logForm({date:today(),reps:'',weight:lastWeight(x,k)},'log-save',sk);
  if(!hist.length&&ui.addFor!==sk) h+='<p class="hist-empty">No entries yet</p>';
  else if(hist.length) h+='<div class="hist">'+shown.map(function(l){return logRow(l,s);}).join('')+'</div>';
  if(hist.length>HISTORY_PREVIEW)
    h+=textBtn(showAll.has(sk)?'Show less':'Show all ('+hist.length+')','hist-more',sk,'link-btn');
  return h+'</div>';
}

function logRow(l,s){
  if(ui.editLog===l.id) return logForm(l,'logedit-save',l.id);
  var st=repsState(l.reps,s);
  var arrow=st==='up'?ICON.up:st==='down'?ICON.down:'';
  var title=st==='up'?'Above target range':st==='down'?'Below target range':'Within target range';
  return '<div class="hist-row">'+
    '<span class="hist-date">'+fmtShort(l.date)+'</span>'+
    '<span class="reps-cell '+st+'" title="'+title+'">'+arrow+l.reps+' <small>reps</small></span>'+
    '<span class="hist-wt">'+fmtW(l.weight)+' <small>kg</small></span>'+
    '<span class="row-actions edit-only">'+iconBtn(ICON.edit,'log-edit',l.id,'Edit entry')+iconBtn(ICON.del,'log-del',l.id,'Delete entry',false,true)+'</span>'+
    '</div>';
}

function logForm(v,action,id){
  return '<div class="log-form" data-form="'+id+'">'+
    '<div class="log-grid">'+
      '<label class="lf-date"><span class="field-label">Date</span><input type="date" name="date" value="'+v.date+'"></label>'+
      '<label><span class="field-label">Reps</span><input type="number" name="reps" inputmode="numeric" min="0" max="'+MAX_REPS+'" step="1" value="'+v.reps+'"></label>'+
      '<label><span class="field-label">Weight (kg)</span><input type="number" name="weight" inputmode="decimal" min="0" max="1000" step="0.25" value="'+v.weight+'"></label>'+
    '</div>'+
    '<div class="form-actions">'+textBtn('Save',action,id,'btn primary sm')+textBtn('Cancel','cancel','','btn secondary sm')+'</div>'+
    '<p class="err"></p></div>';
}

function chartHtml(x){
  var key='c:'+x.id;
  var any=x.sets.some(function(s){return setLogs(x.id,s.id).length;});
  var inner=any
    ? '<div class="chart-legend">'+x.sets.map(function(s,k){
        return '<span class="leg-item"><span class="leg-dot" style="background:'+SET_COLORS[k]+'"></span>Set '+(k+1)+'</span>';
      }).join('')+'</div><div class="ex-chart-wrap"><canvas data-chart="'+x.id+'"></canvas></div>'
    : '<p class="hist-empty">Log some entries to see the chart</p>';
  return '<div class="chart-fold '+foldClass(key)+'" data-key="'+key+'">'+
    '<button class="fold-head chart-head" data-action="toggle">'+CHEV+'<span>Progress chart</span><span class="meta">last '+CHART_ENTRIES+' entries · reps</span></button>'+
    '<div class="fold"><div class="fold-inner">'+inner+'</div></div></div>';
}

function rangeRow(s,k){
  return '<div class="range-row" data-set-id="'+(s.id||'')+'">'+
    '<span class="set-dot" style="background:'+SET_COLORS[k]+'"></span>'+
    '<span class="range-label">Set '+(k+1)+'</span>'+
    '<input type="number" name="min" inputmode="numeric" min="'+MIN_REPS+'" max="'+MAX_REPS+'" step="1" value="'+s.min+'" aria-label="Set '+(k+1)+' min reps">'+
    '<span class="range-sep">–</span>'+
    '<input type="number" name="max" inputmode="numeric" min="'+MIN_REPS+'" max="'+MAX_REPS+'" step="1" value="'+s.max+'" aria-label="Set '+(k+1)+' max reps">'+
    '<span class="range-unit">reps</span></div>';
}

function exerciseForm(x,dayId){
  var sets=x?x.sets:[{id:'',min:8,max:12},{id:'',min:8,max:12},{id:'',min:8,max:12}];
  return '<div class="ex-form" data-form="'+(x?'ex:'+x.id:'new:'+dayId)+'">'+
    '<label><span class="field-label">Exercise name</span><input type="text" name="name" maxlength="60" placeholder="e.g. Bench press" value="'+(x?esc(x.name):'')+'"></label>'+
    '<div class="sets-ctl"><span class="field-label">Sets <small>(target rep range per set)</small></span>'+
      '<div class="stepper">'+
        '<button class="step-btn" data-action="sets-dec" aria-label="Remove a set"'+(sets.length<=MIN_SETS?' disabled':'')+'>−</button>'+
        '<span class="step-val">'+sets.length+'</span>'+
        '<button class="step-btn" data-action="sets-inc" aria-label="Add a set"'+(sets.length>=MAX_SETS?' disabled':'')+'>+</button>'+
      '</div></div>'+
    '<div class="range-rows">'+sets.map(rangeRow).join('')+'</div>'+
    '<div class="form-actions">'+
      (x?textBtn('Save changes','ex-save',x.id,'btn primary sm'):textBtn('Add exercise','ex-create',dayId,'btn primary sm'))+
      textBtn('Cancel','cancel','','btn secondary sm')+'</div>'+
    '<p class="err"></p></div>';
}

function render(){
  var tree=document.getElementById('ex-tree');
  if(!tree) return;
  destroyCharts();
  document.getElementById('exercises-view').classList.toggle('editing',editMode);
  document.getElementById('edit-toggle').checked=editMode;
  if(!uid){ tree.innerHTML=''; updateExpandBtn(); return; }
  if(!loaded){
    tree.innerHTML=loadError
      ? '<p class="empty">Couldn\'t load your exercises. Check your connection and reload.</p>'
      : '<p class="empty">Loading…</p>';
    updateExpandBtn(); return;
  }
  var ds=sortedDays();
  tree.innerHTML=ds.length
    ? ds.map(dayHtml).join('')
    : '<p class="empty">'+(editMode?'Create your first training day above.':'No training days yet — turn on <b>Edit mode</b> to create one.')+'</p>';
  Array.from(open).forEach(function(k){ if(k.indexOf('c:')===0) mountChart(k.slice(2)); });
  updateExpandBtn();
}

// ── EXPAND / COLLAPSE ─────────────────────────────────────────────────────────
function foldKeys(){
  return days.map(function(d){return 'd:'+d.id;}).concat(exercises.map(function(x){return 'e:'+x.id;}));
}
function allExpanded(){
  var k=foldKeys();
  return k.length>0&&k.every(function(x){return open.has(x);});
}
function updateExpandBtn(){
  var b=document.getElementById('btn-expand-all');
  var all=allExpanded();
  b.disabled=!loaded||!days.length;
  b.innerHTML='<svg class="chev'+(all?' up':'')+'" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 4l4 4 4-4"/></svg>'+(all?'Collapse all':'Expand all');
}
// Toggles classes on the existing nodes instead of re-rendering, so the CSS transition plays.
function setOpen(box,isOpen){
  var key=box.dataset.key;
  if(box.classList.contains('open')===isOpen) return;
  box.classList.toggle('open',isOpen);
  if(isOpen) open.add(key); else open.delete(key);
  if(key.indexOf('c:')===0){
    var exId=key.slice(2);
    if(isOpen) mountChart(exId);
    // Destroyed only once the fold has finished closing, so the chart doesn't vanish mid-slide.
    else setTimeout(function(){ if(!open.has(key)) destroyChart(exId); },300);
  }
}
function toggleFold(box){
  setOpen(box,!box.classList.contains('open'));
  saveOpen(); updateExpandBtn();
}
function expandAll(){
  var expand=!allExpanded();
  if(expand) foldKeys().forEach(function(k){open.add(k);});
  document.querySelectorAll('#ex-tree .foldable').forEach(function(box){
    var k=box.dataset.key;
    // Charts are the optional last level: Expand all leaves them as they are, Collapse all closes them.
    if(k.indexOf('c:')===0){ if(!expand) setOpen(box,false); return; }
    setOpen(box,expand);
  });
  if(!expand) open.clear();
  saveOpen(); updateExpandBtn();
}

// ── CHARTS ────────────────────────────────────────────────────────────────────
function destroyChart(exId){ if(charts[exId]){ charts[exId].destroy(); delete charts[exId]; } }
function destroyCharts(){ Object.keys(charts).forEach(destroyChart); }

function mountChart(exId){
  destroyChart(exId);
  var x=exercises.find(function(e){return e.id===exId;});
  var canvas=document.querySelector('#ex-tree canvas[data-chart="'+exId+'"]');
  if(!x||!canvas) return;
  var dates=new Set();
  var datasets=x.sets.map(function(s,k){
    var pts=setLogs(x.id,s.id).slice(-CHART_ENTRIES);
    pts.forEach(function(p){dates.add(p.date);});
    return {label:'Set '+(k+1),data:pts.map(function(p){return {x:p.date,y:p.reps,w:p.weight};}),
      borderColor:SET_COLORS[k],backgroundColor:SET_COLORS[k],borderWidth:2,
      pointRadius:3,pointHoverRadius:5,pointHitRadius:8,tension:0};
  });
  // Shade the target range when every set shares it — with mixed ranges a single band would lie.
  var band=uniformRange(x)?x.sets[0]:null;
  var bandPlugin={id:'repBand',beforeDatasetsDraw:function(c){
    if(!band) return;
    var a=c.chartArea, y=c.scales.y, ctx=c.ctx;
    var top=Math.max(a.top,y.getPixelForValue(band.max)), bot=Math.min(a.bottom,y.getPixelForValue(band.min));
    if(bot<=top) return;
    ctx.save(); ctx.fillStyle='rgba(111,207,151,0.08)'; ctx.fillRect(a.left,top,a.right-a.left,bot-top); ctx.restore();
  }};
  var gc='rgba(255,255,255,0.06)', tc='#938f99';
  charts[exId]=new Chart(canvas,{
    type:'line',
    data:{labels:Array.from(dates).sort(),datasets:datasets},
    plugins:[bandPlugin],
    options:{responsive:true,maintainAspectRatio:false,animation:false,
      // 'x' gathers every set logged on the hovered date into one tooltip.
      interaction:{mode:'x',intersect:false},
      plugins:{legend:{display:false},tooltip:{callbacks:{
        title:function(items){return items.length?fmtShort(items[0].raw.x):'';},
        label:function(ctx){return ctx.dataset.label+': '+ctx.raw.y+' reps × '+fmtW(ctx.raw.w)+' kg';}
      }}},
      scales:{
        x:{ticks:{color:tc,font:{size:11},maxRotation:0,autoSkip:true,
            callback:function(v){var d=this.getLabelForValue(v); var p=d.split('-'); return p[2]+'/'+p[1];}},
          grid:{color:gc,tickLength:0}},
        y:{suggestedMin:band?band.min-1:undefined,suggestedMax:band?band.max+1:undefined,
          ticks:{color:tc,font:{size:11},precision:0},grid:{color:gc,tickLength:0}}
      }
    }
  });
}

// ── ACTIONS ───────────────────────────────────────────────────────────────────
function resetForms(){ ui.editLog=null; ui.editDay=null; ui.editEx=null; ui.newExFor=null; }
function focusIn(sel){ var el=document.querySelector(sel); if(el){ el.focus(); if(el.select&&el.type==='text') el.select(); } }
function fail(form,msg){ form.querySelector('.err').textContent=msg; return null; }

// Same "tap again to confirm" pattern as the bodyweight history.
function confirmed(btn,text){
  if(btn.dataset.confirm==='1') return true;
  var orig=btn.innerHTML;
  btn.dataset.confirm='1'; btn.classList.add('confirming'); btn.textContent=text||'Confirm';
  setTimeout(function(){
    if(btn.isConnected&&btn.dataset.confirm==='1'){ btn.dataset.confirm='0'; btn.classList.remove('confirming'); btn.innerHTML=orig; }
  },3000);
  return false;
}

function move(list,coll,id,dir){
  var i=list.findIndex(function(o){return o.id===id;}), j=i+dir;
  if(i<0||j<0||j>=list.length) return;
  var t=list[i]; list[i]=list[j]; list[j]=t;
  var ops=[];
  list.forEach(function(o,k){ if(o.order!==k){ o.order=k; ops.push({type:'update',ref:ref(coll,o.id),data:{order:k}}); } });
  render(); runBatch(ops);
}

function readLogForm(f){
  var date=f.querySelector('[name=date]').value;
  var rv=f.querySelector('[name=reps]').value, wv=f.querySelector('[name=weight]').value;
  var reps=Number(rv), weight=wv===''?0:Number(wv);
  if(!date) return fail(f,'Pick a date.');
  if(rv===''||!Number.isInteger(reps)||reps<0||reps>MAX_REPS) return fail(f,'Reps must be a whole number from 0 to '+MAX_REPS+'.');
  if(!isFinite(weight)||weight<0||weight>1000) return fail(f,'Weight must be between 0 and 1000 kg.');
  return {date:date,reps:reps,weight:Math.round(weight*100)/100};
}

function readRangeRows(f){
  return Array.from(f.querySelectorAll('.range-row')).map(function(r){
    return {id:r.dataset.setId,min:r.querySelector('[name=min]').value,max:r.querySelector('[name=max]').value};
  });
}
function changeSetCount(f,delta){
  var rows=readRangeRows(f);
  if(delta>0&&rows.length<MAX_SETS){ var last=rows[rows.length-1]; rows.push({id:'',min:last.min,max:last.max}); }
  if(delta<0&&rows.length>MIN_SETS) rows.pop();
  f.querySelector('.range-rows').innerHTML=rows.map(rangeRow).join('');
  f.querySelector('.step-val').textContent=rows.length;
  f.querySelector('[data-action=sets-dec]').disabled=rows.length<=MIN_SETS;
  f.querySelector('[data-action=sets-inc]').disabled=rows.length>=MAX_SETS;
}
function readExerciseForm(f){
  var name=f.querySelector('[name=name]').value.trim();
  if(!name) return fail(f,'Give the exercise a name.');
  var rows=readRangeRows(f), sets=[];
  if(rows.length<MIN_SETS||rows.length>MAX_SETS) return fail(f,'Between '+MIN_SETS+' and '+MAX_SETS+' sets.');
  for(var k=0;k<rows.length;k++){
    var mn=Number(rows[k].min), mx=Number(rows[k].max), lbl='Set '+(k+1)+': ';
    if(rows[k].min===''||rows[k].max===''||!Number.isInteger(mn)||!Number.isInteger(mx)) return fail(f,lbl+'enter whole numbers for the rep range.');
    if(mn<MIN_REPS||mx>MAX_REPS) return fail(f,lbl+'reps must be between '+MIN_REPS+' and '+MAX_REPS+'.');
    if(mn>mx) return fail(f,lbl+'min can\'t be greater than max.');
    sets.push({id:rows[k].id||setId(),min:mn,max:mx});
  }
  return {name:name,sets:sets};
}

function addDay(){
  var inp=document.getElementById('new-day-name'), err=document.getElementById('new-day-err');
  var name=inp.value.trim();
  if(!name){ err.textContent='Give the day a name.'; return; }
  if(!loaded){ err.textContent='Still loading — try again in a moment.'; return; }
  err.textContent='';
  var d={id:newId('trainingDays'),name:name,order:days.length?Math.max.apply(null,days.map(function(x){return x.order||0;}))+1:0,createdAt:Date.now()};
  days.push(d); open.add('d:'+d.id); saveOpen();
  inp.value='';
  render();
  persist(function(){return setDoc(ref('trainingDays',d.id),dayData(d));});
}

function handle(t){
  var a=t.dataset.action, id=t.dataset.id, f=t.closest('[data-form]'), x, d, l, i;
  switch(a){
    case 'toggle': toggleFold(t.closest('.foldable')); return;
    case 'cancel': resetForms(); ui.addFor=null; render(); return;
    case 'hist-more':
      if(showAll.has(id)) showAll.delete(id); else showAll.add(id);
      render(); return;

    // Logging — the one thing allowed outside edit mode.
    case 'log-open':
      resetForms(); ui.addFor=id; render();
      focusIn('[data-form="'+id+'"] [name=reps]'); return;
    case 'log-save':
      var v=readLogForm(f); if(!v) return;
      var parts=id.split(':');
      l={id:newId('exerciseLogs'),exerciseId:parts[0],setId:parts[1],date:v.date,reps:v.reps,weight:v.weight,createdAt:Date.now()};
      logs.push(l); ui.addFor=null; render();
      persist(function(){return setDoc(ref('exerciseLogs',l.id),logData(l));}); return;
  }
  if(!editMode) return;
  switch(a){
    case 'log-edit':
      resetForms(); ui.addFor=null; ui.editLog=id; render();
      focusIn('[data-form="'+id+'"] [name=reps]'); return;
    case 'logedit-save':
      l=logs.find(function(o){return o.id===id;}); var ev=readLogForm(f); if(!l||!ev) return;
      Object.assign(l,ev); ui.editLog=null; render();
      persist(function(){return setDoc(ref('exerciseLogs',l.id),logData(l));}); return;
    case 'log-del':
      if(!confirmed(t,'Delete?')) return;
      logs=logs.filter(function(o){return o.id!==id;}); render();
      persist(function(){return deleteDoc(ref('exerciseLogs',id));}); return;

    case 'day-up': case 'day-down':
      move(sortedDays(),'trainingDays',id,a==='day-up'?-1:1); return;
    case 'day-edit':
      resetForms(); ui.editDay=id; render(); focusIn('[data-form="day:'+id+'"] [name=name]'); return;
    case 'day-rename-save':
      d=days.find(function(o){return o.id===id;});
      var nm=f.querySelector('[name=name]').value.trim(); if(!d||!nm) return;
      d.name=nm; ui.editDay=null; render();
      persist(function(){return updateDoc(ref('trainingDays',id),{name:nm});}); return;
    case 'day-del':
      var dx=exercises.filter(function(o){return o.dayId===id;});
      var exIds=new Set(dx.map(function(o){return o.id;}));
      var dl=logs.filter(function(o){return exIds.has(o.exerciseId);});
      if(!confirmed(t,dx.length?'Delete day + '+dx.length+' exercise'+(dx.length===1?'':'s')+'?':'Delete?')) return;
      days=days.filter(function(o){return o.id!==id;});
      exercises=exercises.filter(function(o){return o.dayId!==id;});
      logs=logs.filter(function(o){return !exIds.has(o.exerciseId);});
      render();
      runBatch([{type:'delete',ref:ref('trainingDays',id)}]
        .concat(dx.map(function(o){return {type:'delete',ref:ref('exercises',o.id)};}))
        .concat(dl.map(function(o){return {type:'delete',ref:ref('exerciseLogs',o.id)};})));
      return;

    case 'ex-new':
      resetForms(); ui.newExFor=id; open.add('d:'+id); saveOpen(); render();
      focusIn('[data-form="new:'+id+'"] [name=name]'); return;
    case 'sets-inc': changeSetCount(f,1); return;
    case 'sets-dec': changeSetCount(f,-1); return;
    case 'ex-create':
      var nv=readExerciseForm(f); if(!nv) return;
      var siblings=dayExercises(id);
      x={id:newId('exercises'),dayId:id,name:nv.name,order:siblings.length?siblings[siblings.length-1].order+1:0,sets:nv.sets};
      exercises.push(x); ui.newExFor=null; open.add('e:'+x.id); saveOpen(); render();
      persist(function(){return setDoc(ref('exercises',x.id),exData(x));}); return;
    case 'ex-up': case 'ex-down':
      x=exercises.find(function(o){return o.id===id;}); if(!x) return;
      move(dayExercises(x.dayId),'exercises',id,a==='ex-up'?-1:1); return;
    case 'ex-edit':
      resetForms(); ui.addFor=null; ui.editEx=id; open.add('e:'+id); saveOpen(); render();
      focusIn('[data-form="ex:'+id+'"] [name=name]'); return;
    case 'ex-save':
      x=exercises.find(function(o){return o.id===id;}); var ev2=readExerciseForm(f); if(!x||!ev2) return;
      var keep=new Set(ev2.sets.map(function(s){return s.id;}));
      var dropped=logs.filter(function(o){return o.exerciseId===id&&!keep.has(o.setId);});
      // Removing a set takes its history with it — make that an explicit second tap.
      if(dropped.length&&!confirmed(t,'Deletes '+dropped.length+' logged entr'+(dropped.length===1?'y':'ies')+' — tap again')) return;
      x.name=ev2.name; x.sets=ev2.sets;
      var dropIds=new Set(dropped.map(function(o){return o.id;}));
      logs=logs.filter(function(o){return !dropIds.has(o.id);});
      ui.editEx=null; render();
      runBatch([{type:'set',ref:ref('exercises',x.id),data:exData(x)}]
        .concat(dropped.map(function(o){return {type:'delete',ref:ref('exerciseLogs',o.id)};})));
      return;
    case 'ex-del':
      var xl=logs.filter(function(o){return o.exerciseId===id;});
      if(!confirmed(t,xl.length?'Delete + '+xl.length+' entr'+(xl.length===1?'y':'ies')+'?':'Delete?')) return;
      exercises=exercises.filter(function(o){return o.id!==id;});
      logs=logs.filter(function(o){return o.exerciseId!==id;});
      render();
      runBatch([{type:'delete',ref:ref('exercises',id)}]
        .concat(xl.map(function(o){return {type:'delete',ref:ref('exerciseLogs',o.id)};})));
      return;
  }
}

// ── INIT ──────────────────────────────────────────────────────────────────────
export function initExercises(opts){
  db=opts.db; sync=opts.sync;
  var view=document.getElementById('exercises-view');
  var tree=document.getElementById('ex-tree');
  // One delegated listener for the whole tree; every control carries a data-action.
  tree.addEventListener('click',function(e){
    var t=e.target.closest('[data-action]');
    if(t&&tree.contains(t)) handle(t);
  });
  view.addEventListener('keydown',function(e){
    if(e.key!=='Enter'&&e.key!==' ') return;
    var t=e.target;
    // Enter in any inline form submits it.
    if(e.key==='Enter'&&t.tagName==='INPUT'){
      if(t.id==='new-day-name'){ e.preventDefault(); addDay(); return; }
      var f=t.closest('[data-form]'), b=f&&f.querySelector('.btn.primary');
      if(b){ e.preventDefault(); b.click(); }
      return;
    }
    // Fold headers are divs (they contain buttons), so give them keyboard activation by hand.
    if(t.dataset&&t.dataset.action==='toggle'&&t.tagName!=='BUTTON'){ e.preventDefault(); handle(t); }
  });
  document.getElementById('btn-add-day').addEventListener('click',addDay);
  document.getElementById('btn-expand-all').addEventListener('click',expandAll);
  document.getElementById('edit-toggle').addEventListener('change',function(){
    editMode=this.checked;
    if(!editMode) resetForms();
    document.getElementById('new-day-err').textContent='';
    render();
  });
  render();
}
