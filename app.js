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
var entries = [], goal = null, goalHistory = [], chart = null, pendingReset = null, chartRange = '2w', chartTransitionQueued = false;

// ── HELPERS ───────────────────────────────────────────────────────────────────
function uDoc(p)  { return doc(db,'users',currentUser.uid,p); }
function uCol(p)  { return collection(db,'users',currentUser.uid,p); }
function eDoc(id) { return doc(db,'users',currentUser.uid,'entries',id); }
function ghDoc(id){ return doc(db,'users',currentUser.uid,'goalHistory',id); }
// Date keys are plain calendar days ('YYYY-MM-DD'), which JS parses as UTC midnight. All day
// arithmetic below therefore stays in UTC — mixing in local getters/setters silently loses or
// repeats a day when the clock crosses a daylight-saving boundary.
function today()  { var d=new Date(); return new Date(d.getTime()-d.getTimezoneOffset()*6e4).toISOString().slice(0,10); }
function fmt(s)   { if(!s) return '—'; var p=s.split('-'); return p[2]+'/'+p[1]+'/'+p[0]; }
function addDays(s,d){ var dt=new Date(s); dt.setUTCDate(dt.getUTCDate()+d); return dt.toISOString().slice(0,10); }
function weekKey(s){
  var dt=new Date(s), jan=new Date(Date.UTC(dt.getUTCFullYear(),0,1));
  var wk=Math.ceil(((dt-jan)/864e5+jan.getUTCDay()+1)/7);
  return dt.getUTCFullYear()+'-W'+(wk<10?'0':'')+wk;
}
function sync(msg,cls){
  var el=document.getElementById('sync-indicator');
  el.textContent=msg; el.className='sync-indicator '+(cls||'');
}
// Fills gaps between logged entries with a straight-line estimate per day, so a single
// entry after a multi-day gap doesn't get treated as one sudden jump in the averages below.
function buildDailySeries(){
  var series={}, n=entries.length;
  if(!n) return series;
  if(n===1){ series[entries[0].date]=entries[0].weight; return series; }
  for(var i=0;i<n-1;i++){
    var d1=entries[i].date, w1=entries[i].weight;
    var d2=entries[i+1].date, w2=entries[i+1].weight;
    var days=Math.round((new Date(d2)-new Date(d1))/864e5);
    for(var k=0;k<=days;k++){
      series[addDays(d1,k)]=days>0?w1+(w2-w1)*(k/days):w1;
    }
  }
  return series;
}
function windowAvg(series,endDate,spanDays,rangeStart){
  var vals=[];
  for(var k=0;k<spanDays;k++){
    var dd=addDays(endDate,-k);
    if(dd<rangeStart) break;
    if(series[dd]!==undefined) vals.push(series[dd]);
  }
  return vals.length?vals.reduce(function(a,b){return a+b;},0)/vals.length:null;
}
// Walks day-by-day through the interpolated series to find when the 7-day average first
// crossed the goal weight, so the congratulations message can report a real date, not "today".
function findReachedDate(series,targetWeight,goalIsGain,rangeStart,rangeEnd){
  var d=rangeStart;
  while(d<=rangeEnd){
    var avg=windowAvg(series,d,7,rangeStart);
    if(avg!==null && (goalIsGain?avg>=targetWeight:avg<=targetWeight)) return d;
    d=addDays(d,1);
  }
  return rangeEnd;
}

// ── CHART WINDOW ──────────────────────────────────────────────────────────────
// The chart always holds the FULL day-by-day series; the range dropdown only moves the
// x-axis bounds over it. Switching range therefore animates as a true zoom — the same line
// stretches or compresses — instead of swapping in a different dataset that has to pop in.
var chartState={dates:[],pxPerDay:24,scrollable:false};
var chartWin=null, chartAnimFrame=null;

// Exact min/max of the DRAWN line across a window whose edges may sit between logged days.
// The fractional edges are the point: during a zoom the window grows continuously, so if the
// bounds only ever consider whole logged days they jump the instant a day crosses the edge —
// and the whole chart lurches vertically. Taking the line's interpolated value AT each edge
// makes the bounds a continuous function of the window, so the vertical scale glides instead.
// It is also tighter than reaching out to the neighbouring logged day, which with a long gap
// could be at a very different weight and would inflate the range for no visible reason.
function chartYBounds(minX,maxX){
  if(!chart) return null;
  var mn=Infinity, mx=-Infinity;
  chart.data.datasets.forEach(function(ds){
    var d=ds.data, n=d.length, i;
    if(!n) return;
    // Where the drawn line crosses x — null when the line does not reach that far.
    function valueAt(x){
      if(x<=d[0].x||x>=d[n-1].x) return null;
      for(i=1;i<n;i++){
        if(d[i].x>=x){
          var a=d[i-1], b=d[i];
          return b.x===a.x?b.y:a.y+(b.y-a.y)*((x-a.x)/(b.x-a.x));
        }
      }
      return null;
    }
    var edges=[valueAt(minX),valueAt(maxX)];
    for(var k=0;k<2;k++){ var v=edges[k];
      if(v!==null){ if(v<mn)mn=v; if(v>mx)mx=v; } }
    for(i=0;i<n;i++){
      var p=d[i];
      if(p.x>=minX&&p.x<=maxX){ if(p.y<mn)mn=p.y; if(p.y>mx)mx=p.y; }
    }
  });
  if(mn===Infinity) return null;
  var pad=Math.max(0.3,(mx-mn)*0.15);
  return {min:mn-pad,max:mx+pad};
}

// Axis labels and gridlines during a zoom. Two separate problems are handled here:
//   • Chart.js regenerates ticks at "nice" round values every frame, so as the bounds move the
//     gridlines snap between step sizes instead of gliding. Pinning a fixed tick count while
//     animating makes them evenly spaced fractions of the window, which slide continuously.
//   • Which labels fit also changes frame to frame, so text pops in and out. Rather than fight
//     that, the labels and grid fade out at the start and back in once the zoom has settled.
var CHART_TICK_RGB='147,143,153', CHART_GRID_ALPHA=0.06;
// Fixed axis sizes — see the afterFit hooks on the scales. Wide/tall enough for the longest
// label either axis can produce ("100.0" for a three-digit weight, "17/08" unrotated).
var CHART_Y_AXIS_W=40, CHART_X_AXIS_H=26;
function setAxisChrome(alpha,animating){
  if(!chart) return;
  var x=chart.options.scales.x, y=chart.options.scales.y;
  var tc='rgba('+CHART_TICK_RGB+','+alpha+')';
  var gc='rgba(255,255,255,'+(CHART_GRID_ALPHA*alpha).toFixed(4)+')';
  x.ticks.color=tc; y.ticks.color=tc;
  x.grid.color=gc;  y.grid.color=gc;
  x.grid.tickColor=gc; y.grid.tickColor=gc;
  x.ticks.count=animating?7:undefined;
  y.ticks.count=animating?6:undefined;
  x.ticks.autoSkip=!animating;
}

// Paints one frame: x bounds, matching y bounds, and optionally the canvas width.
// `widthCss` null → leave the current width alone.
function applyChartWindow(minX,maxX,yb,widthCss){
  if(!chart) return;
  chart.options.scales.x.min=minX;
  chart.options.scales.x.max=maxX;
  if(yb===undefined) yb=chartYBounds(minX,maxX);
  if(yb){ chart.options.scales.y.min=yb.min; chart.options.scales.y.max=yb.max; }
  if(widthCss){
    var inner=document.getElementById('chart-inner');
    if(inner.style.width!==widthCss){ inner.style.width=widthCss; chart.resize(); }
  }
  chart.update('none');
}

// Which days are on screen right now. For a scrolling range the canvas is far wider than its
// container, so only a slice is visible; the zoom has to animate THAT slice. Animating the whole
// window instead means growing the canvas underneath a fixed-size viewport, and the line tears
// across the visible strip while the rest of it is drawn off-screen.
function chartVisibleWindow(fullWin){
  if(!fullWin) return null;
  var wrap=document.getElementById('chart-wrap'), inner=document.getElementById('chart-inner');
  var wrapW=wrap.clientWidth, innerW=inner.offsetWidth||wrapW;
  if(innerW<=wrapW+1) return {min:fullWin.min,max:fullWin.max};
  var perDay=innerW/(fullWin.max-fullWin.min+1);
  var start=fullWin.min+wrap.scrollLeft/perDay;
  return {min:start,max:start+wrapW/perDay};
}

// Where the zoom should land visually: the whole window when it fits, otherwise the most recent
// days at the scroll density — a scrolling range settles showing today, not the oldest entries.
function chartTargetVisible(winStart,winEnd){
  if(!chartState.scrollable) return {min:winStart,max:winEnd};
  var viewDays=document.getElementById('chart-wrap').clientWidth/chartState.pxPerDay;
  return {min:Math.max(winStart,winEnd-viewDays+1),max:winEnd};
}

// The settled state: the full window on a canvas sized for the range, scrolled to today. Taking
// over from the animation is invisible because its last frame already shows exactly these days
// at exactly this px-per-day.
function applyFinalLayout(winStart,winEnd,yb){
  var wrap=document.getElementById('chart-wrap');
  var w=chartState.scrollable?Math.round((winEnd-winStart+1)*chartState.pxPerDay)+'px':'100%';
  applyChartWindow(winStart,winEnd,yb,w);
  if(chartState.scrollable) wrap.scrollLeft=wrap.scrollWidth-wrap.clientWidth;
}

// How far along yFrom→yTo the scale must already be for `v` to be inside it.
function yProgressFor(from,to,v,isMin){
  var d=to-from;
  if(isMin){ if(d>=-1e-9) return 0; return Math.max(0,Math.min(1,(from-v)/(from-to))); }
  if(d<=1e-9) return 0;
  return Math.max(0,Math.min(1,(v-from)/d));
}


// Plans the vertical scale for a whole zoom, before it starts.
//
// Driving y straight off the data in view does not work: as the window edge sweeps across a
// steep segment the edge value changes fast, the scale chases it, and the chart lurches —
// continuous, but with the rate changing sharply enough to read as a jump. So sample the
// animation up front and derive, for each edge of the scale, the smoothest monotone path that
// never clips the line. The two edges get their own path because they can be moving opposite
// ways, and the constraint flips with direction:
//   • an edge that WIDENS must be at least as far along as the data demands, so the smoothest
//     safe path is the concave majorant of that demand — it widens early, never late.
//   • an edge that NARROWS must be at most as far along as the data allows, so the smoothest
//     safe path is the convex minorant — it holds its width until the data has actually left.
// With nothing demanded either path degenerates to a straight line.
// Hull boundary through a set of samples: the smallest concave function above them all
// (upper=true), or the largest convex function below them all (upper=false).
function hullOf(pts,upper){
  var h=[];
  for(var i=0;i<pts.length;i++){
    while(h.length>=2){
      var a=h[h.length-2], b=h[h.length-1], c=pts[i];
      var cross=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
      if(upper?cross>=0:cross<=0) h.pop(); else break;
    }
    h.push(pts[i]);
  }
  return h;
}

// Evaluates the hull as a rounded curve rather than a polygon. Straight segments meeting at a
// corner change speed instantly, which at this duration reads as a stutter; blending each
// vertex's two slopes gives a path with no corners at all. The rounding only ever cuts inside
// the polygon, which the margin baked into the samples already covers.
function evalHull(h,x){
  var n=h.length;
  if(n===1) return h[0].y;
  var i=1;
  while(i<n-1&&x>h[i].x) i++;
  var a=h[i-1], b=h[i], dx=b.x-a.x;
  if(dx<=0) return b.y;
  var t=(x-a.x)/dx; if(t<0)t=0; if(t>1)t=1;
  var m=(b.y-a.y)/dx;
  // Neighbouring slopes, skipped when the neighbour sits at the same x — dividing by that zero
  // width would poison the tangent, and with it the whole scale, with NaN.
  var mPrev=m, mNext=m;
  if(i>=2&&a.x!==h[i-2].x) mPrev=(a.y-h[i-2].y)/(a.x-h[i-2].x);
  if(i<=n-2&&h[i+1].x!==b.x) mNext=(h[i+1].y-b.y)/(h[i+1].x-b.x);
  var ta=(mPrev+m)/2, tb=(m+mNext)/2;
  var t2=t*t, t3=t2*t;
  return (2*t3-3*t2+1)*a.y + (t3-2*t2+t)*dx*ta + (-2*t3+3*t2)*b.y + (t3-t2)*dx*tb;
}

function planZoomBound(reqs,from,to,isMin){
  var N=reqs.length-1, i, pts=[];
  var widening=isMin?(to<from-1e-9):(to>from+1e-9);
  var narrowing=isMin?(to>from+1e-9):(to<from-1e-9);
  if(!widening&&!narrowing) return null;                 // edge does not move
  // MARGIN keeps the fitted path clear of the requirement between samples. Without it the path
  // can fall a hair short for a single frame, the last-resort union takes over for exactly that
  // frame, and the scale twitches.
  var MARGIN=0.04;
  if(widening){
    var run=0;
    for(i=0;i<=N;i++){
      var need=reqs[i]?yProgressFor(from,to,isMin?reqs[i].min:reqs[i].max,isMin):0;
      need=Math.min(1,need+MARGIN);
      if(i===N) need=1;
      if(need>run) run=need;
      pts.push({x:i/N,y:i===0?0:run});      // the path always starts from the scale on screen
    }
    return hullOf(pts,true);
  }
  // Narrowing: allowance[i] is the furthest along the edge may be at sample i. An increasing
  // path can only ever sit under the smallest allowance still ahead of it.
  var allow=[];
  for(i=0;i<=N;i++){
    var v=reqs[i]?(isMin?reqs[i].min:reqs[i].max):null;
    var t=1;
    if(v!==null) t=Math.max(0,Math.min(1,isMin?(v-from)/(to-from):(from-v)/(from-to)));
    allow.push(i===N?1:Math.max(0,t-MARGIN));
  }
  for(i=N-1;i>=0;i--) if(allow[i+1]<allow[i]) allow[i]=allow[i+1];
  allow[0]=0;                               // the path always starts from the scale on screen
  for(i=0;i<=N;i++) pts.push({x:i/N,y:allow[i]});
  return hullOf(pts,false);
}

function planZoomY(fromV,toV,yFrom,yTo){
  if(!yFrom||!yTo) return null;
  var N=48, reqs=[];
  for(var i=0;i<=N;i++){
    var e=i/N;
    reqs.push(chartYBounds(fromV.min+(toV.min-fromV.min)*e, fromV.max+(toV.max-fromV.max)*e));
  }
  return {min:planZoomBound(reqs,yFrom.min,yTo.min,true),
          max:planZoomBound(reqs,yFrom.max,yTo.max,false)};
}

// One frame's vertical scale, from the plan. The union with the live bounds stays as a
// last-resort guarantee; with the plan in place it should never actually bite.
function zoomYBounds(minX,maxX,e,yFrom,yTo,plan){
  if(!yFrom||!yTo) return yTo||yFrom||null;
  var gMin=(plan&&plan.min)?evalHull(plan.min,e):e;
  var gMax=(plan&&plan.max)?evalHull(plan.max,e):e;
  var yb={min:yFrom.min+(yTo.min-yFrom.min)*gMin, max:yFrom.max+(yTo.max-yFrom.max)*gMax};
  var actual=chartYBounds(minX,maxX);
  if(actual){
    if(actual.min<yb.min) yb.min=actual.min;
    if(actual.max>yb.max) yb.max=actual.max;
  }
  return yb;
}

// The zoom runs in three phases so that every change to the tick set happens while the labels
// are at zero opacity. Switching tick modes (auto ↔ pinned count) or bounds while they are
// visible is what makes labels appear from nowhere and reshuffle:
//   1. fade out  — nothing moves; the old frame and its own tick set just dim away
//   2. zoom      — labels hidden, tick count pinned so the grid glides with the bounds
//   3. fade in   — bounds already final and ticks back on automatic, so the labels appear
//                  directly in their end positions and never re-lay-out afterwards
function animateChartWindow(toMin,toMax,tickLimit,prevWin){
  // Read what is on screen BEFORE anything touches the layout.
  var fromV=chartVisibleWindow(prevWin), toV=chartTargetVisible(toMin,toMax);
  chartWin={min:toMin,max:toMax};
  if(chartAnimFrame){ cancelAnimationFrame(chartAnimFrame); chartAnimFrame=null; }
  // Start from the scale actually on screen, not a recomputed one — a scrolling range settles
  // with the vertical scale of its WHOLE window, which is wider than the visible slice's own
  // bounds, and recomputing here would make the line jump the moment the zoom begins.
  var ySc=chart.options.scales.y;
  var yFrom=(typeof ySc.min==='number'&&typeof ySc.max==='number')
    ?{min:ySc.min,max:ySc.max}
    :(prevWin?chartYBounds(prevWin.min,prevWin.max):null);
  var yTo=chartYBounds(toMin,toMax);
  if(!fromV||(fromV.min===toV.min&&fromV.max===toV.max)){
    chart.options.scales.x.ticks.maxTicksLimit=tickLimit;
    setAxisChrome(1,false); applyFinalLayout(toMin,toMax,yTo); return;
  }
  var yPlan=planZoomY(fromV,toV,yFrom,yTo);
  // The fades finish slightly inside their phases (OUT*0.75, and HOLD ms before the fade-in)
  // so that opacity is already a hard 0 for at least one frame either side of a tick-mode
  // switch — otherwise the last frame before a switch still carries a few percent of opacity
  // and can flash the old tick set.
  // 2000ms in total, split in the same proportions as before.
  var OUT=390, ZOOM=965, HOLD=65, IN=580, t0=performance.now(), phase3=false;
  (function step(now){
    var t=now-t0, done=false;
    if(t<OUT){
      // Fit the canvas to the container up front. Coming from a scrolling range this is
      // invisible: the same days stay under the cursor at the same px-per-day.
      setAxisChrome(Math.max(0,1-t/(OUT*0.75)),false);
      applyChartWindow(fromV.min,fromV.max,yFrom,'100%');
    } else if(t<OUT+ZOOM){
      // easeInOutCubic: easeOut alone starts so fast that the first frames jump a large slice
      // of the zoom at once, which shows up as the vertical scale lurching. Easing in as well
      // spreads that motion out.
      var p=(t-OUT)/ZOOM, e=p<0.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2;
      var cMin=fromV.min+(toV.min-fromV.min)*e, cMax=fromV.max+(toV.max-fromV.max)*e;
      setAxisChrome(0,true);
      applyChartWindow(cMin,cMax,zoomYBounds(cMin,cMax,e,yFrom,yTo,yPlan),'100%');
    } else {
      // The new tick limit and the scrolling canvas both land here, with the labels still
      // invisible, so the fade-in is the first time the final layout is ever drawn.
      if(!phase3){
        phase3=true;
        chart.options.scales.x.ticks.maxTicksLimit=tickLimit;
        applyFinalLayout(toMin,toMax,yTo);
      }
      var q=Math.max(0,Math.min(1,(t-OUT-ZOOM-HOLD)/IN));
      setAxisChrome(q,false);
      applyChartWindow(toMin,toMax,yTo,null);
      done=q>=1;
    }
    if(done) chartAnimFrame=null;
    else chartAnimFrame=requestAnimationFrame(step);
  })(t0);
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

// ── CHART RANGE ───────────────────────────────────────────────────────────────
// Browsers restore <select> state across reloads and back-navigation, which would leave the
// dropdown showing one range while chartRange still held the default — the chart and its own
// label disagreeing. Force the control back to the default so the two can't drift apart.
document.getElementById('chart-range').value=chartRange;
document.getElementById('chart-range').addEventListener('change',function(){
  chartTransitionQueued=true; chartRange=this.value; render();
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
    var old={weight:goal.weight,start:goal.start,date:goal.date,pace:goal.pace||null,isBulk:goal.isBulk,startWeight:goal.startWeight,savedOn:today()};
    goalHistory.unshift(old); await fbSaveGH(old);
  }
  btn.dataset.confirm='0'; btn.textContent='Save goal'; btn.style.background=''; btn.style.color='';
  err.textContent='';
  goal={weight:w,start:s,date:endDate,pace:p,isBulk:isBulk,startWeight:startW};
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

// ── GOAL REACHED / MISSED ─────────────────────────────────────────────────────
document.getElementById('btn-goal-reached-ok').addEventListener('click',async function(){
  if(!goal) return;
  var old={weight:goal.weight,start:goal.start,date:goal.date,pace:goal.pace||null,isBulk:goal.isBulk,savedOn:today()};
  goalHistory.unshift(old); await fbSaveGH(old);
  goal=null;
  ['g-wt','g-start','g-pace'].forEach(function(id){document.getElementById(id).value='';});
  document.getElementById('goal-preview').style.display='none';
  document.getElementById('goal-summary').style.display='none';
  render(); await fbDeleteGoal();
});
document.getElementById('btn-goal-reset').addEventListener('click',async function(){
  if(!goal||!pendingReset) return;
  var old={weight:goal.weight,start:goal.start,date:goal.date,pace:goal.pace||null,isBulk:goal.isBulk,savedOn:today()};
  goalHistory.unshift(old); await fbSaveGH(old);
  goal={weight:pendingReset.weight,start:pendingReset.start,date:pendingReset.date,pace:pendingReset.pace,isBulk:pendingReset.isBulk,startWeight:pendingReset.startWeight};
  pendingReset=null;
  render(); await fbSaveGoal();
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
      // Prefer the weight stored on the goal itself; for cycles archived before that field
      // existed, fall back to the entry logged around when the cycle started.
      var ghStartW=(g.startWeight!==undefined&&g.startWeight!==null)?g.startWeight:(function(){var e=entries.find(function(e){return e.date>=g.start;});return e?e.weight:null;})();
      var ws=document.createElement('span'); ws.style.cssText='font-size:14px;font-weight:500;color:#e6e1e5';
      ws.textContent=ghStartW!==null?ghStartW.toFixed(1)+' → '+g.weight.toFixed(1)+' kg':g.weight.toFixed(1)+' kg';
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
  var cur=n?entries[n-1].weight:null;
  var firstDate=n?entries[0].date:null, lastDate=n?entries[n-1].date:null;
  var series=buildDailySeries();
  // Current average — mean of the 7 calendar days ending on the last logged date (gaps interpolated above)
  var curAvg=n?windowAvg(series,lastDate,7,firstDate):null;
  var dataSpanDays=n?Math.round((new Date(lastDate)-new Date(firstDate))/864e5):0;
  // Two conditions gate the trend stats: enough calendar coverage for two 7-day windows,
  // AND enough real logs that those windows aren't mostly guessed via interpolation.
  var MIN_ENTRIES=6, MIN_SPAN_DAYS=13;
  var enoughData=n>=MIN_ENTRIES&&dataSpanDays>=MIN_SPAN_DAYS;

  // Cycle label
  var cl=document.getElementById('cycle-label'), dv=document.getElementById('hdivider');
  if(goal&&goal.start&&goal.date){
    var cycleIsBulk=goal.isBulk!==undefined?goal.isBulk:true;
    cl.style.display=''; dv.style.display='';
    cl.textContent=cycleIsBulk?'BULKING CYCLE':'CUTTING CYCLE';
    cl.style.color=cycleIsBulk?'#6fcf97':'#eb5757';
  } else {cl.style.display='none';dv.style.display='none';}

  // Stats
  var prevAvg=enoughData?windowAvg(series,addDays(lastDate,-7),7,firstDate):null;
  if(n>=1){
    document.getElementById('s-cur').textContent=curAvg.toFixed(1)+' kg';
    var re=document.getElementById('s-rate');
    if(prevAvg!==null){
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
  var reachedBox=document.getElementById('goal-reached-box');
  var missedBox=document.getElementById('goal-missed-box');
  reachedBox.style.display='none'; missedBox.style.display='none';
  pendingReset=null;

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
    // Prefer the weight recorded when the goal was set/reset — falling back to searching
    // entries only for old goals saved before this field existed.
    var sw=(goal.startWeight!==undefined&&goal.startWeight!==null)?goal.startWeight:(entries.find(function(e){return e.date>=goal.start;})||entries[0]).weight;
    var goalIsGain=goal.isBulk!==undefined?goal.isBulk:goal.weight>sw;

    var kpw=(goal.weight-cur)/remWk, sign=kpw>=0?'+':'';

    btitle.textContent='Goal · '+goal.weight+' kg by '+fmt(goal.date);

    // Reached: the 7-day average has crossed the target in the intended direction.
    var reached=goalIsGain?curAvg>=goal.weight:curAvg<=goal.weight;
    // Past due: the end date has passed without reaching it.
    var pastDue=!reached&&now>gE;

    if(reached){
      proj.style.display='none'; bars.style.display='none';
      chip.className='chip on'; chip.textContent='Goal reached!'; pdesc.textContent='';
      reachedBox.style.display='';
      var rangeStart=goal.start>firstDate?goal.start:firstDate;
      var rd=findReachedDate(series,goal.weight,goalIsGain,rangeStart,lastDate);
      var elapsedDays=Math.round((new Date(rd)-gS)/864e5);
      var diffDays=Math.round((new Date(rd)-gE)/864e5);
      var diffTxt=diffDays===0?'right on time':diffDays<0
        ?Math.abs(diffDays)+' day'+(Math.abs(diffDays)===1?'':'s')+' early'
        :diffDays+' day'+(diffDays===1?'':'s')+' late';
      document.getElementById('goal-reached-text').innerHTML=
        '🎉 You reached your goal of <b>'+goal.weight.toFixed(1)+' kg</b> in <b>'+(elapsedDays/7).toFixed(1)+' weeks</b> — <b>'+diffTxt+'</b> compared to your original plan!';
    } else if(pastDue){
      proj.style.display='none'; bars.style.display='none';
      chip.className='chip slow'; chip.textContent='Goal date passed'; pdesc.textContent='';
      missedBox.style.display='';
      var newStart=today();
      var delta2=goal.weight-curAvg;
      var weeks2=Math.abs(delta2/goal.pace)||1;
      var newEnd=addDays(newStart,Math.round(weeks2*7));
      document.getElementById('goal-missed-text').innerHTML=
        'You should have reached <b>'+goal.weight.toFixed(1)+' kg</b> by now. No worries, that happens! '+
        'Recalculating from your current average of <b>'+curAvg.toFixed(1)+' kg</b> at your <b>'+(goalIsGain?'+':'-')+goal.pace+' kg/wk</b> pace, '+
        'you can still get there by <b>'+fmt(newEnd)+'</b> if you stay focused.';
      pendingReset={weight:goal.weight,start:newStart,date:newEnd,pace:goal.pace,isBulk:goal.isBulk,startWeight:curAvg};
    } else {
      // Pace comparison — two consecutive 7-calendar-day windows (gaps interpolated),
      // so a single log after several quiet days reads as a gradual change, not a sudden one
      var desiredPace=goal.pace;
      var chipMsg, chipClass, pdescMsg, actualPaceP;
      if(!enoughData){
        chipClass='none';
        chipMsg=dataSpanDays<MIN_SPAN_DAYS
          ?'Need '+(MIN_SPAN_DAYS-dataSpanDays)+' more day'+(MIN_SPAN_DAYS-dataSpanDays===1?'':'s')+' of data'
          :'Need '+(MIN_ENTRIES-n)+' more log'+(MIN_ENTRIES-n===1?'':'s');
        pdescMsg='';
      } else {
        actualPaceP=curAvg-prevAvg;
        var directedActual=goalIsGain?actualPaceP:-actualPaceP;
        var tol=desiredPace*0.5;
        var paceAhead=directedActual>desiredPace+tol;
        var paceBehind=directedActual<desiredPace-tol;
        if(paceAhead){chipClass='fast';chipMsg=goalIsGain?'Eat less':'Eat more';pdescMsg='Slow down · need '+sign+kpw.toFixed(2)+' kg/wk';}
        else if(paceBehind){chipClass='slow';chipMsg=goalIsGain?'Eat more':'Eat less';pdescMsg='Push harder · need '+sign+kpw.toFixed(2)+' kg/wk';}
        else{chipClass='on';chipMsg='On track';pdescMsg=sign+kpw.toFixed(2)+' kg/wk needed';}
      }

      chip.className='chip '+chipClass; chip.textContent=chipMsg; pdesc.textContent=pdescMsg;

      // Projection — based on the 7-day windowed pace above
      proj.style.display='';
      if(!enoughData){
        proj.textContent='Log more entries to see projection';
      } else {
        var movRight=(goalIsGain&&actualPaceP>0)||(!goalIsGain&&actualPaceP<0);
        if(Math.abs(actualPaceP)<0.001) proj.textContent='Trend is flat — log more data';
        else if(!movRight) proj.textContent='Current trend is moving away from goal';
        else{
          var wn=(goal.weight-curAvg)/actualPaceP;
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
      // Bar tracks the current average (last 7 calendar days), not the last logged weight
      var totD=Math.abs(goal.weight-sw), doneD=Math.abs(curAvg-sw);
      var wPct=totD>0?Math.min(100,Math.round(doneD/totD*100)):100;
      document.getElementById('wl-s').textContent=sw.toFixed(1)+' kg';
      document.getElementById('wl-e').textContent=goal.weight.toFixed(1)+' kg';
      document.getElementById('wt-fill').style.width=wPct+'%';
      document.getElementById('wt-sub').textContent='Weight progress: '+wPct+'% · '+Math.abs(goal.weight-curAvg).toFixed(1)+' kg left';
    }
  }

  renderGoalSummary();

  // Chart — the full day-by-day series is always loaded as {x:dayIndex,y:weight} points on a
  // linear x axis. The range dropdown only moves the x-axis window over that series, so a range
  // switch animates as a real zoom (the same line stretches/compresses) rather than swapping in
  // a different dataset. Days with no entry stay null, drawn through via spanGaps.
  var fullDates=[];
  if(n){
    var lastDay=today()>entries[n-1].date?today():entries[n-1].date;
    var dc=new Date(entries[0].date), de=new Date(lastDay);
    while(dc<=de){fullDates.push(dc.toISOString().slice(0,10));dc.setUTCDate(dc.getUTCDate()+1);}
  }
  var lastIdx=fullDates.length-1;
  var dayIdx=function(d){return Math.round((new Date(d)-new Date(fullDates[0]))/864e5);};

  // The x window for the selected range, clamped to the data we actually have.
  var winStart=0, winEnd=Math.max(0,lastIdx);
  if(n){
    var todayIdx=Math.min(lastIdx,dayIdx(today()));
    if(chartRange==='1w'){ winEnd=todayIdx; winStart=winEnd-6; }
    else if(chartRange==='2w'){ winEnd=todayIdx; winStart=winEnd-13; }
    else if(chartRange==='1m'){ winEnd=todayIdx; winStart=winEnd-29; }
    else if(chartRange==='1y'){ winEnd=todayIdx; winStart=winEnd-364; }
    else if(chartRange==='goal'&&goal&&goal.start){ winEnd=todayIdx; winStart=dayIdx(goal.start); }
    else { winStart=0; winEnd=lastIdx; }
    if(winStart<0) winStart=0;
    if(winEnd>lastIdx) winEnd=lastIdx;
    if(winEnd<winStart) winEnd=winStart;
  }
  var visibleDays=winEnd-winStart+1;

  // Horizontal scroll past the range's day threshold, at a fixed px/day so points never get
  // more cramped as data grows. "1y" is exempt — always compacts to fit, as a zoomed-out
  // overview. "All time" gets a larger threshold (100) since it's meant to stay browsable
  // longer before handing off to scroll. Below the threshold, points hide past 60 days so a
  // dense compacted line doesn't turn into a blob — except "all", which always hides them.
  var CHART_SCROLL_THRESHOLD=30, ALL_TIME_THRESHOLD=100, PX_PER_DAY=24, POINT_R=2.8;
  var scrollThreshold=chartRange==='all'?ALL_TIME_THRESHOLD:CHART_SCROLL_THRESHOLD;
  var scrollable=chartRange!=='1y'&&visibleDays>scrollThreshold;
  var pointRadius=scrollable?POINT_R:(chartRange==='all'?0:(visibleDays>60?0:POINT_R));

  // tension:0 (straight segments between logged days) rather than a spline. A spline's control
  // points are derived from the points currently in the x window, so the curve between two
  // entries changed shape depending on the selected range. It also invented movement on days
  // with no entry — bulging above or below the two weights it sits between. Straight segments
  // are window-independent and match the linear interpolation the stats above already assume.
  // Hover reach depends on whether the points are drawn. With points visible, detection is
  // bounded to a radius around each one (they're small, so the hit area is padded well past
  // the dot). With points hidden there is nothing to aim at, so it falls back to "closest
  // point on the x axis", which has no distance limit by design.
  var pointsVisible=pointRadius>0;
  var HIT_R=9;
  // Only the days that were actually logged become points. Padding the series with one element
  // per calendar day and letting spanGaps skip the empty ones drew exactly the same line — the
  // segments between logged days are straight either way — but it left hundreds of null
  // elements in the dataset. As the x window slides over them during a zoom, Chart.js pulls
  // them into the range it paints and they can land at the base of the chart for a frame,
  // which is the line dropping to the bottom-left and snapping back. No empty days, no flicker.
  var datasets=[{
    label:'Weight',
    data:entries.map(function(e){return {x:dayIdx(e.date),y:e.weight};}),
    borderColor:'#d0bcff',backgroundColor:'rgba(208,188,255,0.08)',
    borderWidth:2,pointRadius:pointRadius,pointHoverRadius:5,pointHitRadius:pointsVisible?HIT_R:0,
    pointBackgroundColor:'#d0bcff',tension:0,fill:true
  }];
  if(goal&&goal.start&&goal.date&&n){
    var sd=new Date(goal.start), gd=new Date(goal.date);
    var sw2=(goal.startWeight!==undefined&&goal.startWeight!==null)?goal.startWeight:(entries.find(function(e){return e.date>=goal.start;})||entries[0]).weight;
    var totW2=Math.max(0.01,(gd-sd)/(7*864e5));
    // The ideal pace is a straight line in time, so its two ends describe it completely.
    var iStart=Math.max(0,Math.min(lastIdx,dayIdx(goal.start)));
    var idealAt=function(i){
      var t=(new Date(fullDates[i])-sd)/(7*864e5);
      return parseFloat((sw2+(goal.weight-sw2)*(t/totW2)).toFixed(2));
    };
    if(iStart<lastIdx){
      datasets.push({label:'Ideal pace',
        data:[{x:iStart,y:idealAt(iStart)},{x:lastIdx,y:idealAt(lastIdx)}],
        borderColor:'#6fcf97',borderWidth:1.5,borderDash:[6,3],pointRadius:0,pointHoverRadius:4,
        pointHitRadius:pointsVisible?0:1,tension:0,fill:false});
    }
  }

  chartState.dates=fullDates; chartState.pxPerDay=PX_PER_DAY; chartState.scrollable=scrollable;

  var gc='rgba(255,255,255,0.06)', tc='#938f99';
  var tickLimit=scrollable?Math.min(visibleDays,60):8;
  var interaction=pointsVisible
    ? {mode:'nearest',axis:'xy',intersect:true}   // bounded by each point's hit radius
    : {mode:'nearest',axis:'x',intersect:false};  // no points to aim at — snap to nearest day
  if(!chart){
    chart=new Chart(document.getElementById('chart'),{
      type:'line',data:{datasets:datasets},
      options:{responsive:true,maintainAspectRatio:false,
        // Every frame of a range change is computed and painted by animateChartWindow, so
        // Chart.js must not also animate. Left on, it interpolates element positions toward
        // each frame's target while the target is itself still moving: the drawn line trails
        // the scale (visible as the line distorting mid-zoom) and then snaps into place when
        // the zoom stops. resize() in particular starts one of these on every width change.
        animation:false,
        animations:{colors:false,numbers:false},
        transitions:{resize:{animation:{duration:0}},active:{animation:{duration:0}}},
        interaction:interaction,
        plugins:{legend:{display:false},tooltip:{
          filter:function(item){return item.parsed.y!==null;},
          callbacks:{
            title:function(items){var d=chartState.dates[Math.round(items[0].parsed.x)];return d?fmt(d):'';},
            label:function(ctx){return ctx.dataset.label+': '+ctx.parsed.y.toFixed(1)+' kg';}
          }
        }},
        scales:{
          // includeBounds:false — with an explicit min/max, Chart.js also forces a tick at each
          // bound, which sits right next to the first generated one and overlaps its label.
          // Both axes are pinned to a fixed size so the plotting rectangle is identical in every
          // range. Left to itself Chart.js sizes them from their content, and that content
          // changes with the range: the y column widens or narrows with the label text ("76.9"
          // vs "84.1", worse once a weight reaches three digits), and the x row grows taller
          // whenever it decides to tilt the dates to fit more of them in. Either one moves the
          // edge of the chart box between views.
          x:{type:'linear',
            afterFit:function(s){ s.height=CHART_X_AXIS_H; },
            ticks:{color:tc,font:{size:11},maxTicksLimit:tickLimit,autoSkip:true,includeBounds:false,
            maxRotation:0,minRotation:0,
            callback:function(v){
              var d=chartState.dates[Math.round(v)];
              if(!d) return '';
              var p=d.split('-'); return p[2]+'/'+p[1];
            }},grid:{color:gc}},
          y:{afterFit:function(s){ s.width=CHART_Y_AXIS_W; },
            ticks:{color:tc,font:{size:11},callback:function(v){return v.toFixed(1);}},grid:{color:gc}}
        }
      }
    });
    chartWin={min:winStart,max:winEnd};
    applyFinalLayout(winStart,winEnd);
  } else {
    chart.data.datasets=datasets;
    // Whether points are drawn changes with the range, so the hover mode has to follow it.
    chart.options.interaction.mode=interaction.mode;
    chart.options.interaction.axis=interaction.axis;
    chart.options.interaction.intersect=interaction.intersect;
    var prevWin=chartWin;
    if(chartTransitionQueued){
      // maxTicksLimit is deliberately left alone here — animateChartWindow applies it mid-zoom,
      // while the labels are hidden, so the change never shows as a reshuffle.
      chartTransitionQueued=false;
      animateChartWindow(winStart,winEnd,tickLimit,prevWin);
    } else {
      // Not a range switch — make sure the axes are fully opaque and back on automatic ticks,
      // in case a zoom was interrupted partway through its fade.
      if(chartAnimFrame){ cancelAnimationFrame(chartAnimFrame); chartAnimFrame=null; }
      chart.options.scales.x.ticks.maxTicksLimit=tickLimit;
      setAxisChrome(1,false);
      chartWin={min:winStart,max:winEnd};
      applyFinalLayout(winStart,winEnd);
    }
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
