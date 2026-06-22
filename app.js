// ══ SUPABASE ══
const SURL = 'https://mjaschvxhdupoemaezjt.supabase.co';
const SKEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qYXNjaHZ4aGR1cG9lbWFlemp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NjE1MDYsImV4cCI6MjA5NzUzNzUwNn0.mPAF1SmB2HimzFa58Zy3nt0ESAoE6TaOVU4YTwArobA';
const VISION_KEY = 'AIzaSyCDHQOKG3e87WQ0fveIKR-v2S_3_2IgUhI';
const db = supabase.createClient(SURL, SKEY);

// ══ STORE CONFIG ══
const STORES = {
  woolworths:{label:'Woolworths',brand:'#1A1A1A',bar:'#6CC2C0',logo:'logos/woolworths.png'},
  checkers:  {label:'Checkers',  brand:'#00B5AD',bar:'#FFB6C8',logo:'logos/checkers.png'},
  pnp:       {label:'Pick n Pay',brand:'#004F9F',bar:'#B8D8F0',logo:'logos/pnp.jpg'},
  spar:      {label:'Spar',      brand:'#007A3D',bar:'#C2DFC2',logo:'logos/spar.jpg'},
  walmart:   {label:'Walmart',   brand:'#0071CE',bar:'#B8D8F0',logo:'logos/walmart.png'},
  other:     {label:'Other',     brand:'#8FA8A6',bar:'#ACD9D9',logo:null},
};

const CATEGORY_COLORS = {
  dinner:'#F5A623', baking:'#FF8FAB', lunch:'#6CC2C0', other:'#9B7FD4'
};
const CATEGORY_LABELS = {
  dinner:'🍽️ Dinner', baking:'🥐 Baking', lunch:'🥗 Lunch', other:'Other',
  meal_plan:'🍽️ Meal plan', school_lunch:'🎒 School lunch', misc:'📦 Misc', cleaning:'🧹 Cleaning'
};

function storeLogo(key, size=36) {
  const cfg = STORES[key]||STORES.other;
  if(cfg.logo) {
    return `<div class="store-logo-wrap" style="width:${size}px;height:${size}px">
      <img src="${cfg.logo}" alt="${cfg.label}" onerror="this.parentNode.style.background='${cfg.brand}';this.parentNode.innerHTML='<span style=font-size:${Math.round(size*.35)}px;font-weight:800;color:white>${cfg.label.charAt(0)}</span>'"/>
    </div>`;
  }
  return `<div class="store-logo-badge" style="background:${cfg.brand};width:${size}px;height:${size}px;font-size:${Math.round(size*.35)}px">${cfg.label.charAt(0)}</div>`;
}

// ══ STATE ══
let currentUser=null, isAdmin=false, receipts=[], budget=0, allRecipes=[], shoppingItems=[], currentFilter='all';

// ══ INIT ══
document.addEventListener('DOMContentLoaded', async()=>{
  updateClock(); setInterval(updateClock,30000);
  document.getElementById('receipt-date').value = new Date().toISOString().split('T')[0];
  if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
  const {data:{session}} = await db.auth.getSession();
  if(session){ await loadUser(session.user); showApp(); }
  else showAuth();
  db.auth.onAuthStateChange(async(event,session)=>{
    if(event==='SIGNED_IN'&&session){ await loadUser(session.user); showApp(); }
    else if(event==='SIGNED_OUT') showAuth();
  });
});

function updateClock(){
  document.getElementById('topbar-time').textContent =
    new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
}

// ══ AUTH ══
function showAuth(){ document.getElementById('auth-screen').classList.remove('hidden'); document.getElementById('app').classList.add('hidden'); }
function showApp(){ document.getElementById('auth-screen').classList.add('hidden'); document.getElementById('app').classList.remove('hidden'); loadDashboard(); }
function showSignup(){ document.getElementById('signin-form').classList.add('hidden'); document.getElementById('signup-form').classList.remove('hidden'); document.getElementById('auth-error').textContent=''; }
function showSignin(){ document.getElementById('signup-form').classList.add('hidden'); document.getElementById('signin-form').classList.remove('hidden'); document.getElementById('auth-error').textContent=''; }

async function signIn(){
  const email=document.getElementById('signin-email').value.trim();
  const password=document.getElementById('signin-password').value;
  const errEl=document.getElementById('auth-error');
  errEl.textContent='';
  if(!email||!password){errEl.textContent='Please enter your email and password';return;}
  const {error}=await db.auth.signInWithPassword({email,password});
  if(error) errEl.textContent=error.message;
}

async function signUp(){
  document.getElementById('auth-error').textContent='New accounts are created by the GEM admin. Please contact your admin to get access.';
}

async function signOut(){ await db.auth.signOut(); }

// ══ LOAD USER ══
async function loadUser(user){
  currentUser=user;
  const {data:profile,error:profileErr}=await db.from('profiles').select('full_name,is_admin,is_disabled').eq('id',user.id).single();
  if(profileErr) console.error('Profile fetch error:',profileErr);

  // Block disabled users — sign out and show message
  if(profile?.is_disabled){
    await db.auth.signOut();
    document.getElementById('auth-error').textContent='⛔ Your account has been disabled. Please contact your GEM admin.';
    showAuth();
    return;
  }

  isAdmin=profile?.is_admin||false;
  const name=profile?.full_name||user.email.split('@')[0];
  document.getElementById('profile-name').textContent=name;
  document.getElementById('profile-email').textContent=user.email;
  document.getElementById('profile-avatar').textContent=name.charAt(0).toUpperCase();
  document.getElementById('topbar-initial').textContent=name.charAt(0).toUpperCase();
  document.getElementById('edit-name-input').value=name;
  const roleEl=document.getElementById('profile-role');
  if(isAdmin){
    roleEl.textContent='⭐ Admin';
    document.getElementById('admin-panel').classList.remove('hidden');
    loadUserList();
  } else {
    roleEl.textContent='Member';
  }
}

// ══ DASHBOARD ══
async function loadDashboard(){
  const now=new Date();
  const monthKey=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const monthName=now.toLocaleString('default',{month:'long'});
  document.getElementById('hero-month').textContent=`${monthName} ${now.getFullYear()}`;
  document.getElementById('chart-month-label').textContent=monthName;
  const {data:bd}=await db.from('budgets').select('amount').eq('user_id',currentUser.id).eq('month',monthKey).single();
  budget=bd?.amount||0;
  const monthStart=`${monthKey}-01`;
  const {data:rx}=await db.from('receipts').select('*').eq('user_id',currentUser.id).gte('receipt_date',monthStart).order('receipt_date',{ascending:false});
  receipts=rx||[];
  renderDashboard(now,monthName);
}

function fmt(n){ return Number(n).toLocaleString('en-ZA',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function fmtR(n){ return `R ${fmt(n)}`; }

function renderDashboard(now,monthName){
  const totalSpent=receipts.reduce((s,r)=>s+(r.total||0),0);
  const pct=budget>0?Math.min(Math.round((totalSpent/budget)*100),100):0;
  const remaining=budget-totalSpent;
  document.getElementById('hero-spent').textContent=fmtR(totalSpent);
  document.getElementById('hero-budget-label').textContent=budget>0?`of R ${budget.toLocaleString()} budget`:'No budget set yet';
  document.getElementById('hero-bar').style.width=`${pct}%`;
  document.getElementById('ring-pct').textContent=`${pct}%`;
  document.getElementById('hero-sub').textContent=budget>0?`${pct}% used · ${fmtR(remaining)} remaining`:'Tap "Set monthly budget" below';
  const circ=2*Math.PI*32;
  document.getElementById('ring-progress').setAttribute('stroke-dasharray',`${circ*(pct/100)} ${circ}`);
  document.getElementById('ring-progress').setAttribute('stroke',pct>85?'#FFB6C8':'white');

  // Stats
  const weekStart=new Date(now); weekStart.setDate(now.getDate()-((now.getDay()+6)%7));
  weekStart.setHours(0,0,0,0);
  const weekRx=receipts.filter(r=>new Date(r.receipt_date)>=weekStart);
  const weekTotal=weekRx.reduce((s,r)=>s+(r.total||0),0);
  const weeksIn=Math.max(1,Math.ceil(now.getDate()/7));
  const avgWeek=totalSpent/weeksIn;
  const daysInMonth=new Date(now.getFullYear(),now.getMonth()+1,0).getDate();
  const daysLeft=daysInMonth-now.getDate();
  const predicted=totalSpent+(avgWeek/7)*daysLeft;
  document.getElementById('stat-week').textContent=`R ${Math.round(weekTotal).toLocaleString()}`;
  document.getElementById('stat-week-sub').textContent=`${weekRx.length} receipt${weekRx.length!==1?'s':''}`;
  document.getElementById('stat-avg').textContent=`R ${Math.round(avgWeek).toLocaleString()}`;
  document.getElementById('stat-predicted').textContent=`R ${Math.round(predicted).toLocaleString()}`;

  // Stores
  const sm={};
  receipts.forEach(r=>{const k=r.store_key||'other';if(!sm[k])sm[k]={key:k,total:0};sm[k].total+=r.total||0;});
  const sa=Object.values(sm).sort((a,b)=>b.total-a.total);
  document.getElementById('store-list').innerHTML=sa.length===0
    ?'<div class="empty-state" style="padding:16px 0">No receipts yet</div>'
    :sa.map(s=>{
      const cfg=STORES[s.key]||STORES.other;
      const p=totalSpent>0?Math.round((s.total/totalSpent)*100):0;
      return `<div class="store-row">${storeLogo(s.key,36)}
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:700;margin-bottom:3px">${cfg.label}</div>
          <div class="store-bar-bg"><div class="store-bar-fill" style="width:${p}%;background:${cfg.bar}"></div></div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:12px;font-weight:700">${fmtR(s.total)}</div>
          <div style="font-size:10px;color:var(--muted)">${p}%</div>
        </div></div>`;}).join('');

  // Chart
  const wm={};
  receipts.forEach(r=>{const d=new Date(r.receipt_date);const wn=`W${Math.ceil(d.getDate()/7)}`;wm[wn]=(wm[wn]||0)+(r.total||0);});
  const wd=['W1','W2','W3','W4','W5'].map(w=>({week:w,amount:wm[w]||0})).filter(w=>w.amount>0);
  const curW=`W${Math.ceil(now.getDate()/7)}`;
  document.getElementById('weekly-chart').innerHTML=wd.length===0
    ?'<div style="width:100%;text-align:center;font-size:12px;color:var(--muted);padding:20px 0">Add receipts to see your chart</div>'
    :wd.map(w=>{const h=Math.max(8,Math.round((w.amount/Math.max(...wd.map(x=>x.amount)))*60));const a=w.week===curW;
      return `<div class="chart-col">
        <div style="font-size:9px;font-weight:700;color:${a?'var(--primary)':'transparent'};margin-bottom:2px">R${(w.amount/1000).toFixed(1)}k</div>
        <div class="chart-bar" style="height:${h}px;background:${a?'linear-gradient(180deg,#86CAC3,#6CC2C0)':'var(--primary-pale)'}"></div>
        <div style="font-size:9px;color:${a?'var(--primary)':'var(--muted)'};font-weight:${a?700:400}">${w.week}</div>
      </div>`;}).join('');

  // Recent receipts
  const recent=receipts.slice(0,4);
  document.getElementById('recent-receipts').innerHTML=recent.length===0
    ?'<div class="empty-state" style="padding:16px 0">No receipts yet</div>'
    :recent.map(r=>{
      const cfg=STORES[r.store_key]||STORES.other;
      const d=new Date(r.receipt_date).toLocaleDateString('en-ZA',{day:'numeric',month:'short'});
      return `<div class="receipt-row">${storeLogo(r.store_key,38)}
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600">${cfg.label}</div>
          <div style="font-size:11px;color:var(--muted)">${d} · ${r.item_count||'?'} items · ${r.method||'manual'}</div>
        </div>
        <div style="font-size:14px;font-weight:700">${fmtR(r.total||0)}</div>
      </div>`;}).join('');
}

// ══ SCAN SCREEN ══
async function loadAllReceipts(){
  const {data:rx}=await db.from('receipts').select('*').eq('user_id',currentUser.id).order('receipt_date',{ascending:false});
  const all=rx||[];
  document.getElementById('all-receipts').innerHTML=all.length===0
    ?'<div class="empty-state"><div class="empty-state-icon">🧾</div>No receipts yet — add your first one!</div>'
    :all.map(r=>{
      const cfg=STORES[r.store_key]||STORES.other;
      const d=new Date(r.receipt_date).toLocaleDateString('en-ZA',{day:'numeric',month:'short',year:'numeric'});
      return `<div class="receipt-row" style="padding:12px 16px;justify-content:space-between">
        <div style="display:flex;align-items:center;gap:12px;flex:1;min-width:0">
          ${storeLogo(r.store_key,38)}
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:700">${cfg.label}</div>
            <div style="font-size:11px;color:var(--muted)">${d} · ${r.item_count||'?'} items · ${r.method||'manual'}</div>
          </div>
          <div style="font-size:14px;font-weight:700;margin-right:8px">${fmtR(r.total||0)}</div>
        </div>
        <button onclick="confirmDeleteReceipt('${r.id}','${cfg.label}','${d}',${r.total||0})"
          style="background:transparent;border:none;cursor:pointer;font-size:18px;color:var(--muted);padding:4px 6px;flex-shrink:0"
          title="Delete receipt">🗑</button>
      </div>`;}).join('');
}

// ══ RECIPES ══
let showArchived=false;

async function loadRecipes(){
  // Exclude archived by default
  let ownQ=db.from('recipes').select('*').eq('user_id',currentUser.id).order('created_at',{ascending:false});
  if(!showArchived) ownQ=ownQ.neq('visibility','archived');
  const {data:own}=await ownQ;
  const {data:shared}=await db.from('recipes').select('*').eq('visibility','everyone').neq('user_id',currentUser.id).order('created_at',{ascending:false});
  allRecipes=[...(own||[]),...(shared||[])];
  renderRecipes();
}

function filterRecipes(f){ setFilterActive(f); currentFilter=f; renderRecipes(); }

function renderRecipes(){
  let list=allRecipes;
  if(currentFilter==='dinner') list=list.filter(r=>r.category==='dinner');
  else if(currentFilter==='baking') list=list.filter(r=>r.category==='baking');
  else if(currentFilter==='shared') list=list.filter(r=>r.visibility==='everyone');
  const colors={dinner:'#F5A623',baking:'#FF8FAB',lunch:'#6CC2C0',other:'#9B7FD4'};
  const bgs={dinner:'#FEF3DC',baking:'#FFF0F3',lunch:'#CFE8E4',other:'#EDE8F9'};
  document.getElementById('recipe-list').innerHTML=list.length===0
    ?'<div class="empty-state"><div class="empty-state-icon">🍽️</div>No recipes yet — add your first one!</div>'
    :list.map(r=>{
      const col=colors[r.category]||'#9B7FD4';
      const bg=bgs[r.category]||'#EDE8F9';
      const shareLabel=r.visibility==='everyone'?'<span class="recipe-share-badge" style="background:var(--primary-pale);color:var(--primary)">🌐 Everyone</span>':r.visibility==='shared'?'<span class="recipe-share-badge" style="background:var(--blue-pale);color:var(--blue)">👨‍👩‍👧 Shared</span>':'';
      const meta=[r.prep_time?`⏱ ${r.prep_time}min prep`:'',r.cook_time?`🔥 ${r.cook_time}min cook`:'',r.servings?`🍽 Serves ${r.servings}`:''].filter(Boolean).join(' · ');
      return `<div class="recipe-card" onclick="viewRecipe('${r.id}')">
        <div>${shareLabel}<span class="recipe-tag" style="background:${bg};color:${col}">${CATEGORY_LABELS[r.category]||r.category}</span></div>
        <div class="recipe-title">${r.title}</div>
        ${meta?`<div class="recipe-meta">${meta}</div>`:''}
        ${r.description?`<div style="font-size:12px;color:var(--muted);margin-top:4px">${r.description}</div>`:''}
      </div>`;}).join('');
}

// viewRecipe defined below

async function saveRecipe(){
  const title=document.getElementById('recipe-title').value.trim();
  if(!title){showToast('Please enter a recipe name');return;}
  const {error}=await db.from('recipes').insert({
    user_id:currentUser.id,
    title,
    category:document.getElementById('recipe-category').value,
    description:document.getElementById('recipe-desc').value,
    instructions:document.getElementById('recipe-instructions').value,
    prep_time:parseInt(document.getElementById('recipe-prep').value)||null,
    cook_time:parseInt(document.getElementById('recipe-cook').value)||null,
    servings:parseInt(document.getElementById('recipe-serves').value)||4,
    visibility:document.getElementById('recipe-visibility').value,
  });
  if(error){showToast('Error saving recipe');console.error(error);return;}
  // Save ingredients
  const ingLines=document.getElementById('recipe-ingredients').value.split('\n').filter(l=>l.trim());
  // get the recipe id we just created
  const {data:newR}=await db.from('recipes').select('id').eq('user_id',currentUser.id).order('created_at',{ascending:false}).limit(1).single();
  if(newR&&ingLines.length){
    await db.from('recipe_ingredients').insert(ingLines.map((l,i)=>({recipe_id:newR.id,name:l.trim(),sort_order:i})));
  }
  closeModal('modal-add-recipe');
  showToast('Recipe saved ✓');
  loadRecipes();
  // Clear fields
  ['recipe-title','recipe-desc','recipe-ingredients','recipe-instructions','recipe-prep','recipe-cook'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('recipe-serves').value='';
}

// ══ SHOPPING LIST ══
async function loadShoppingList(){
  const now=new Date();
  let weekStart=new Date(now); weekStart.setDate(now.getDate()-((now.getDay()+6)%7)); weekStart.setHours(0,0,0,0);
  if(currentListBasket==='next_week') weekStart.setDate(weekStart.getDate()+7);
  const weekEnd=new Date(weekStart); weekEnd.setDate(weekStart.getDate()+6);
  const ws=weekStart.toISOString().split('T')[0];
  const we=weekEnd.toISOString().split('T')[0];
  const label=currentListBasket==='monthly'?'Monthly basket':currentListBasket==='next_week'?'Next week: '+weekStart.toLocaleDateString('en-ZA',{day:'numeric',month:'short'}):'This week: '+weekStart.toLocaleDateString('en-ZA',{day:'numeric',month:'short'});
  document.getElementById('list-week-label').textContent=label;
  let query=db.from('shopping_list_items').select('*').eq('user_id',currentUser.id).order('category').order('created_at');
  if(currentListBasket==='monthly'){
    query=query.eq('week_start','monthly');
  } else {
    // Match items added anywhere in the week range, not just exact Monday
    query=query.gte('week_start',ws).lte('week_start',we);
  }
  const {data:items}=await query;
  shoppingItems=items||[];
  renderShoppingList();
}

let currentListStoreFilter='';

function setListStoreFilter(storeKey){
  currentListStoreFilter=storeKey;
  document.querySelectorAll('[id^="store-filter-"]').forEach(b=>b.classList.remove('filter-active'));
  const activeId='store-filter-'+(storeKey||'all');
  const activeEl=document.getElementById(activeId);
  if(activeEl) activeEl.classList.add('filter-active');
  renderShoppingList();
}

function renderShoppingList(){
  // Apply store filter
  let items=shoppingItems;
  if(currentListStoreFilter) items=items.filter(i=>i.store_key===currentListStoreFilter);

  if(items.length===0){
    const msg=currentListStoreFilter
      ?'<div class="empty-state"><div class="empty-state-icon">🏪</div>No items for '+( STORES[currentListStoreFilter]?.label||currentListStoreFilter)+'</div>'
      :'<div class="empty-state"><div class="empty-state-icon">🛒</div>Your list is empty — add items or tap 🛍️ to browse groceries!</div>';
    document.getElementById('shopping-list-content').innerHTML=msg;
    return;
  }

  // Group by store first if filtering all, else by category
  const storeColors={'woolworths':'#1A1A1A','checkers':'#00B5AD','pnp':'#004F9F','spar':'#007A3D','walmart':'#0071CE','other':'#8FA8A6'};
  const storeBgs={'woolworths':'#F0F0F0','checkers':'#E0F7F6','pnp':'#E6EEF9','spar':'#E6F4EC','walmart':'#E6F2FB','other':'#F5F5F5'};

  const groups={meal_plan:[],school_lunch:[],baking:[],cleaning:[],misc:[]};
  items.forEach(i=>{const g=groups[i.category]||groups.misc;g.push(i);});
  const groupOrder=['meal_plan','school_lunch','baking','cleaning','misc'];
  const groupColors={meal_plan:'var(--amber)',school_lunch:'var(--blue)',baking:'var(--accent)',cleaning:'var(--emerald)',misc:'var(--muted)'};

  let html='';
  groupOrder.forEach(g=>{
    if(!groups[g]||groups[g].length===0) return;
    html+=`<div class="list-section-header" style="color:${groupColors[g]}">${CATEGORY_LABELS[g]||g}</div>
    <div style="background:var(--card);border-top:1px solid var(--line);border-bottom:1px solid var(--line)">`;
    html+=groups[g].map(item=>{
      const sc=storeColors[item.store_key]||null;
      const sb=storeBgs[item.store_key]||null;
      const storeLabel=item.store_key?STORES[item.store_key]?.label||item.store_key:null;
      return `
      <div class="list-item">
        <div class="list-check ${item.is_checked?'checked':''}" onclick="toggleListItem('${item.id}','${!item.is_checked}')">${item.is_checked?'<svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="white" stroke-width="2" fill="none" stroke-linecap="round"/></svg>':''}</div>
        <div class="list-item-name ${item.is_checked?'checked':''}" style="flex:1" onclick="toggleListItem('${item.id}','${!item.is_checked}')">${item.name}</div>
        ${(item.quantity||1)>1?`<div style="font-size:11px;font-weight:700;color:var(--primary);background:var(--primary-pale);padding:2px 8px;border-radius:10px;flex-shrink:0;margin-right:4px">×${item.quantity}</div>`:''}
        ${item.amount?`<div class="list-item-amount" style="margin-right:4px">${item.amount}</div>`:''}
        ${storeLabel&&!currentListStoreFilter?`<div style="font-size:9px;font-weight:700;padding:2px 6px;border-radius:10px;background:${sb};color:${sc};flex-shrink:0;margin-right:4px">${storeLabel.split(' ')[0]}</div>`:''}
        <button onclick="deleteListItem('${item.id}')" style="background:transparent;border:none;cursor:pointer;font-size:16px;color:var(--line);padding:2px 4px;flex-shrink:0">✕</button>
      </div>`;}).join('');
    html+='</div>';
  });
  document.getElementById('shopping-list-content').innerHTML=html;
}

async function toggleListItem(id,checked){
  await db.from('shopping_list_items').update({is_checked:checked==='true'}).eq('id',id);
  const item=shoppingItems.find(i=>i.id===id);
  if(item) item.is_checked=checked==='true';
  renderShoppingList();
}

async function deleteListItem(id){
  await db.from('shopping_list_items').delete().eq('id',id).eq('user_id',currentUser.id);
  shoppingItems=shoppingItems.filter(i=>i.id!==id);
  renderShoppingList();
  showToast('\u2713 Item removed');
}

// ══ QUICK ADD LIST ITEMS — grocery browser style with multi-select ══
let quickAddSelected=new Set(); // set of grocery item IDs selected
let quickAddManual=[];          // manually typed items
let qaBasket='this_week';
let qaCategory='all';

function openAddListItem(){
  quickAddSelected=new Set();
  quickAddManual=[];
  qaCategory='all';
  const searchEl=document.getElementById('qa-search');
  if(searchEl) searchEl.value='';
  const saveBtn=document.getElementById('qa-save-btn');
  if(saveBtn) saveBtn.textContent='Add to list (0)';
  setQABasket('this_week');
  document.querySelectorAll('[id^="qa-cat-"]').forEach(b=>b.classList.remove('filter-active'));
  const allBtn=document.getElementById('qa-cat-all');
  if(allBtn) allBtn.classList.add('filter-active');
  // Load grocery items if not loaded yet, then render
  if(!groceryItems||groceryItems.length===0){
    loadGroceryItems().then(()=>renderQAItems());
  } else {
    renderQAItems();
  }
  openModal('modal-add-list-item');
}

function setQABasket(basket){
  qaBasket=basket;
  document.getElementById('qa-basket-this').classList.toggle('filter-active',basket==='this_week');
  document.getElementById('qa-basket-next').classList.toggle('filter-active',basket==='next_week');
  document.getElementById('qa-basket-monthly').classList.toggle('filter-active',basket==='monthly');
}

const QA_CAT_ID_MAP={
  'all':'qa-cat-all','Dairy':'qa-cat-Dairy','Meat & Fish':'qa-cat-Meat',
  'Fruit & Veg':'qa-cat-Fruit','Dry Goods':'qa-cat-Dry','Bakery':'qa-cat-Bakery',
  'Frozen':'qa-cat-Frozen','Snacks':'qa-cat-Snacks','Beverages':'qa-cat-Beverages',
  'Cleaning':'qa-cat-Cleaning','Personal Care':'qa-cat-PersonalCare',
  'Household':'qa-cat-Household','Baby & Kids':'qa-cat-BabyKids','Other':'qa-cat-Other'
};

function setQACat(cat){
  qaCategory=cat;
  document.querySelectorAll('[id^="qa-cat-"]').forEach(b=>b.classList.remove('filter-active'));
  const el=document.getElementById(QA_CAT_ID_MAP[cat]||'qa-cat-all');
  if(el) el.classList.add('filter-active');
  renderQAItems();
}

function updateQACount(){
  const total=quickAddSelected.size+quickAddManual.length;
  document.getElementById('qa-save-btn').textContent='Add to list ('+total+')';
}

function toggleQAItem(id){
  if(quickAddSelected.has(id)) quickAddSelected.delete(id);
  else quickAddSelected.add(id);
  updateQACount();
  // Re-render just this item's tick state
  const el=document.getElementById('qa-item-'+id);
  if(el){
    const selected=quickAddSelected.has(id);
    el.style.background=selected?'var(--primary-pale)':'var(--card)';
    el.style.borderColor=selected?'var(--primary)':'var(--line)';
    const tick=el.querySelector('.qa-tick');
    if(tick) tick.style.display=selected?'flex':'none';
  }
}

function renderQAItems(){
  const search=(document.getElementById('qa-search')?.value||'').toLowerCase();
  let items=groceryItems||[];
  if(qaCategory!=='all') items=items.filter(i=>i.category===qaCategory);
  if(search) items=items.filter(i=>i.name.toLowerCase().includes(search));

  const manualBtn=document.getElementById('qa-manual-add');

  if(items.length===0&&!search){
    document.getElementById('qa-items-list').innerHTML='<div style="text-align:center;padding:20px;color:var(--muted);font-size:13px">No grocery items yet — upload your list from Admin or use the manual add below</div>';
    if(manualBtn) manualBtn.style.display='block';
    return;
  }

  // Show manual add when searching for something not in list
  if(manualBtn) manualBtn.style.display=search?'block':'none';
  if(search&&document.getElementById('qa-manual-name')){
    document.getElementById('qa-manual-name').value=search.charAt(0).toUpperCase()+search.slice(1);
  }

  const catColors={'Dairy':'#2980B9','Meat & Fish':'#C0392B','Fruit & Veg':'#27AE60','Dry Goods':'#D4AC0D','Cleaning':'#1B8A6B','Bakery':'#E67E22','Frozen':'#8E44AD','Snacks':'#E67E22','Beverages':'#2980B9','Personal Care':'#E91E8C','Household':'#555','Baby & Kids':'#FF8FAB','Other':'#8FA8A6'};

  // Group by category
  const grouped={};
  items.forEach(i=>{if(!grouped[i.category])grouped[i.category]=[];grouped[i.category].push(i);});

  let html='';
  Object.entries(grouped).forEach(([cat,catItems])=>{
    const col=catColors[cat]||'#8FA8A6';
    html+=`<div style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${col};padding:8px 0 4px">${cat}</div>`;
    html+=catItems.map(item=>{
      const sel=quickAddSelected.has(item.id);
      return `<div id="qa-item-${item.id}" onclick="toggleQAItem('${item.id}')"
        style="display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:10px;background:${sel?'var(--primary-pale)':'var(--card)'};border:1px solid ${sel?'var(--primary)':'var(--line)'};margin-bottom:5px;cursor:pointer;transition:all .15s">
        <div class="qa-tick" style="display:${sel?'flex':'none'};width:22px;height:22px;border-radius:50%;background:var(--primary);align-items:center;justify-content:center;flex-shrink:0">
          <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="white" stroke-width="2" fill="none" stroke-linecap="round"/></svg>
        </div>
        <div style="width:${sel?'0':'22px'};height:22px;border-radius:50%;border:2px solid var(--line);flex-shrink:0;display:${sel?'none':'block'}"></div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;color:var(--text)">${item.name}</div>
          ${item.unit?`<div style="font-size:10px;color:var(--muted)">${item.unit}</div>`:''}
        </div>
        ${item.normal_price?`<div style="font-size:11px;color:var(--muted)">R${parseFloat(item.normal_price).toFixed(2)}</div>`:''}
        ${item.last_price&&item.normal_price&&item.last_price<item.normal_price?'<div style="font-size:9px;font-weight:700;color:var(--emerald);background:var(--emerald-pale);padding:2px 6px;border-radius:8px">SPECIAL</div>':''}
      </div>`;
    }).join('');
  });

  document.getElementById('qa-items-list').innerHTML=html;
}

function qaManualAdd(){
  const name=document.getElementById('qa-manual-name')?.value.trim();
  if(!name) return;
  const amount=document.getElementById('qa-manual-amount')?.value.trim();
  const manualCat=document.getElementById('qa-manual-cat')?.value||'misc';
  quickAddManual.push({id:'manual_'+Date.now(),name,amount,category:manualCat});
  document.getElementById('qa-manual-name').value='';
  document.getElementById('qa-manual-amount').value='';
  updateQACount();
  showToast('✓ '+name+' staged');
}

async function saveAllQuickItems(){
  const total=quickAddSelected.size+quickAddManual.length;
  if(total===0){showToast('Tap items to select them first');return;}
  const now=new Date();
  let weekStart=new Date(now); weekStart.setDate(now.getDate()-((now.getDay()+6)%7)); weekStart.setHours(0,0,0,0);
  if(qaBasket==='next_week') weekStart.setDate(weekStart.getDate()+7);
  const storeKey=document.getElementById('list-item-store').value||null;
  const ws=qaBasket==='monthly'?'monthly':weekStart.toISOString().split('T')[0];

  const rows=[];
  // From grocery list selections
  quickAddSelected.forEach(id=>{
    const item=groceryItems.find(i=>i.id===id);
    if(item) rows.push({user_id:currentUser.id,name:item.name,amount:item.unit||null,category:item.category||'misc',store_key:storeKey,week_start:ws});
  });
  // From manual additions
  quickAddManual.forEach(i=>{
    rows.push({user_id:currentUser.id,name:i.name,amount:i.amount||null,category:i.category,store_key:storeKey,week_start:ws});
  });

  const {error}=await db.from('shopping_list_items').insert(rows);
  if(error){showToast('Error: '+error.message);return;}
  closeModal('modal-add-list-item');
  quickAddSelected=new Set();
  quickAddManual=[];
  showToast('✓ '+rows.length+' item'+(rows.length!==1?'s':'')+' added');
  loadShoppingList();
}

async function saveListItem(){ await saveAllQuickItems(); }

// openAddListItem already defined above — grocery items loaded on demand inside it



function generateShoppingList(){showToast('Meal plan → shopping list coming soon!');showScreen('list');}

// ══ MEAL PLAN ══
let currentPlanWeekOffset=0;

function switchPlanWeek(offset){
  currentPlanWeekOffset=offset;
  // Update tab active state
  document.getElementById('plan-tab-this').classList.toggle('filter-active', offset===0);
  document.getElementById('plan-tab-next').classList.toggle('filter-active', offset===1);
  loadMealPlan();
}

async function loadMealPlan(){
  const now=new Date();
  // Calculate start of current week (Monday)
  const thisMonday=new Date(now);
  thisMonday.setDate(now.getDate()-((now.getDay()+6)%7));
  thisMonday.setHours(0,0,0,0);
  // Apply week offset
  const weekStart=new Date(thisMonday);
  weekStart.setDate(thisMonday.getDate()+(currentPlanWeekOffset*7));

  const weekEnd=new Date(weekStart); weekEnd.setDate(weekStart.getDate()+6);
  const startStr=weekStart.toLocaleDateString('en-ZA',{day:'numeric',month:'short'});
  const endStr=weekEnd.toLocaleDateString('en-ZA',{day:'numeric',month:'short'});
  document.getElementById('plan-week-label').textContent=`${startStr} — ${endStr}`;

  // Load meal plan for this week — join via meal_plans table
  const ws=weekStart.toISOString().split('T')[0];

  // First get the meal plan ID for this week
  const {data:planArr}=await db.from('meal_plans')
    .select('id')
    .eq('user_id',currentUser.id)
    .eq('week_start',ws)
    .limit(1);

  let entries=[];
  if(planArr&&planArr.length>0){
    const {data:entryData}=await db.from('meal_plan_entries')
      .select('*,recipes(title,category)')
      .eq('plan_id',planArr[0].id)
      .order('day_of_week');
    entries=entryData||[];
  }

  const days=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const today=new Date(); today.setHours(0,0,0,0);

  document.getElementById('plan-grid').innerHTML=days.map((day,i)=>{
    const date=new Date(weekStart); date.setDate(weekStart.getDate()+i);
    const dateStr=date.toLocaleDateString('en-ZA',{day:'numeric',month:'short'});
    const isToday=date.getTime()===today.getTime();
    const isPast=date<today;
    const dayEntry=entries?.find(e=>e.day_of_week===i);

    return `<div class="plan-day" style="${isToday?'border-color:var(--primary);border-width:2px;':''}${isPast?'opacity:0.6;':''}">
      <div class="plan-day-header">
        <div class="plan-day-name" style="${isToday?'color:var(--primary);font-weight:800;':''}">${day}${isToday?' <span style="font-size:10px;background:var(--primary);color:white;padding:1px 7px;border-radius:10px;font-weight:700;vertical-align:middle">Today</span>':''}</div>
        <div class="plan-day-date">${dateStr}</div>
      </div>
      ${dayEntry?.recipes
        ?`<div class="plan-slot plan-slot-filled" style="justify-content:space-between">
            <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0">
              <span style="font-size:16px">${dayEntry.recipes.category==='baking'?'🥐':'🍽️'}</span>
              <span style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${dayEntry.recipes.title}</span>
            </div>
            <button onclick="removeMealEntry('${dayEntry.id}')" style="background:transparent;border:none;cursor:pointer;color:var(--muted);font-size:16px;padding:2px 4px;flex-shrink:0" title="Remove">✕</button>
          </div>`
        :`<div class="plan-slot plan-slot-empty" onclick="openPlanPickerForDay(${i},${currentPlanWeekOffset})">
            <span style="font-size:16px">+</span><span>Add dinner</span>
          </div>`
      }
    </div>`;}).join('');
}

// ══ ADMIN — USERS ══
async function loadUserList(){
  const el=document.getElementById('user-list');
  if(!el) return; // not on admin page
  const {data:users,error}=await db.from('profiles').select('id,full_name,email,is_admin,created_at').order('created_at');
  if(error){ console.error('User list error:',error); }
  el.innerHTML=(users||[]).length===0
    ?'<div class="empty-state" style="padding:12px 0">No users yet</div>'
    :(users||[]).map(u=>`
      <div class="admin-user-row">
        <div class="user-avatar">${(u.full_name||u.email||'?').charAt(0).toUpperCase()}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:700">${u.full_name||'—'}</div>
          <div style="font-size:11px;color:var(--muted)">${u.email}</div>
        </div>
        <div class="pill" style="background:${u.is_admin?'var(--accent-pale)':'var(--primary-pale)'};color:${u.is_admin?'var(--accent)':'var(--primary)'}">
          ${u.is_admin?'⭐ Admin':'Member'}
        </div>
      </div>`).join('');
}

async function createUser(){
  const name=document.getElementById('new-user-name').value.trim();
  const email=document.getElementById('new-user-email').value.trim();
  const password=document.getElementById('new-user-password').value;
  const errEl=document.getElementById('create-user-error');
  errEl.textContent='';
  if(!name||!email||!password){errEl.textContent='All fields are required';return;}
  if(password.length<6){errEl.textContent='Password must be at least 6 characters';return;}

  // Get current session token to authenticate the edge function call
  const {data:{session}}=await db.auth.getSession();
  if(!session){errEl.textContent='Session expired — please sign in again';return;}

  try {
    const res=await fetch(`${SURL}/functions/v1/create-user`,{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'Authorization':`Bearer ${session.access_token}`,
        'apikey': SKEY
      },
      body:JSON.stringify({name,email,password})
    });

    const result=await res.json();

    if(!res.ok||result.error){
      errEl.textContent=result.error||'Failed to create user';
      return;
    }

    closeModal('modal-create-user');
    ['new-user-name','new-user-email','new-user-password'].forEach(id=>document.getElementById(id).value='');
    showToast(`✓ Account created for ${name}`);
    setTimeout(loadUserList,1500);

  } catch(err){
    errEl.textContent='Network error — please try again';
    console.error('Create user error:',err);
  }
}

// ══ PASSWORD CHANGE ══
function openChangePassword(){
  document.getElementById('new-password').value='';
  document.getElementById('confirm-password').value='';
  document.getElementById('password-error').textContent='';
  openModal('modal-change-password');
}

async function savePassword(){
  const newPass=document.getElementById('new-password').value;
  const confirm=document.getElementById('confirm-password').value;
  const errEl=document.getElementById('password-error');
  errEl.textContent='';
  if(!newPass||newPass.length<6){errEl.textContent='Password must be at least 6 characters';return;}
  if(newPass!==confirm){errEl.textContent='Passwords do not match';return;}
  const {error}=await db.auth.updateUser({password:newPass});
  if(error){errEl.textContent=error.message;return;}
  closeModal('modal-change-password');
  showToast('✓ Password updated successfully');
}

// ══ PROFILE — EDIT NAME ══
function openEditName(){
  const current=document.getElementById('profile-name').textContent;
  document.getElementById('edit-name-input').value=current;
  openModal('modal-edit-name');
}

async function saveName(){
  const name=document.getElementById('edit-name-input').value.trim();
  if(!name){showToast('Please enter your name');return;}
  const {error}=await db.from('profiles').update({full_name:name}).eq('id',currentUser.id);
  if(error){
    console.error('Name update error:',error);
    showToast('Error: '+error.message);
    return;
  }
  document.getElementById('profile-name').textContent=name;
  document.getElementById('profile-avatar').textContent=name.charAt(0).toUpperCase();
  document.getElementById('topbar-initial').textContent=name.charAt(0).toUpperCase();
  closeModal('modal-edit-name');
  showToast('Name updated ✓');
}

// ══ BUDGET ══
function openBudgetModal(){ document.getElementById('budget-input').value=budget||''; openModal('modal-budget'); }
async function saveBudget(){
  const amount=parseFloat(document.getElementById('budget-input').value);
  if(!amount||amount<=0){showToast('Enter a valid amount');return;}
  const now=new Date();
  const monthKey=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const {error}=await db.from('budgets').upsert({user_id:currentUser.id,month:monthKey,amount},{onConflict:'user_id,month'});
  if(error){showToast('Error saving budget');return;}
  budget=amount; closeModal('modal-budget');
  renderDashboard(new Date(),new Date().toLocaleString('default',{month:'long'}));
  showToast('Budget saved ✓');
}

// ══ RECEIPTS ══
function openManualReceipt(){ document.getElementById('receipt-date').value=new Date().toISOString().split('T')[0]; openModal('modal-receipt'); }
async function saveReceipt(){
  const storeKey=document.getElementById('receipt-store').value;
  const date=document.getElementById('receipt-date').value;
  const total=parseFloat(document.getElementById('receipt-total').value);
  const items=parseInt(document.getElementById('receipt-items').value)||null;
  if(!storeKey||!date||!total){showToast('Please fill in all required fields');return;}
  const {error}=await db.from('receipts').insert({user_id:currentUser.id,store_key:storeKey,store_name:STORES[storeKey]?.label||storeKey,total,item_count:items,method:'manual',receipt_date:date});
  if(error){showToast('Error saving receipt');console.error(error);return;}
  closeModal('modal-receipt');
  ['receipt-total','receipt-items'].forEach(id=>document.getElementById(id).value='');
  showToast('Receipt saved ✓');
  await loadDashboard();
  loadAllReceipts();
}

// ══ NAVIGATION ══
function showScreen(name){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(`screen-${name}`).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n=>{
    const a=n.dataset.screen===name;
    n.classList.toggle('active',a);
    const d=n.querySelector('.nav-dot');
    if(d&&!a)d.remove();
    if(a&&!d){const dot=document.createElement('div');dot.className='nav-dot';n.appendChild(dot);}
  });
  // Lazy load screens
  if(name==='scan') loadAllReceipts();
  if(name==='recipes') loadRecipes();
  if(name==='list') loadShoppingList();
  if(name==='plan'){ if(!allRecipes||allRecipes.length===0) loadRecipes(); loadMealPlan(); }
  if(name==='profile'&&isAdmin) loadUserList();
}

// ══ MODALS ══
function openModal(id){ document.getElementById(id).classList.remove('hidden'); }
function closeModal(id){ document.getElementById(id).classList.add('hidden'); }
function openAddRecipe(){ openModal('modal-add-recipe'); }
function openCreateUser(){ document.getElementById('create-user-error').textContent=''; openModal('modal-create-user'); }

// Close modal on overlay click
document.addEventListener('click',e=>{
  if(e.target.classList.contains('modal-overlay')) e.target.classList.add('hidden');
});

// ══ DELETE RECEIPT ══
let pendingDeleteReceiptId=null;

function confirmDeleteReceipt(id,store,date,total){
  pendingDeleteReceiptId=id;
  document.getElementById('del-receipt-label').textContent=`${store} · ${date} · R${Number(total).toFixed(2)}`;
  openModal('modal-delete-receipt');
}

async function deleteReceipt(){
  if(!pendingDeleteReceiptId) return;
  // Delete items first (cascade may not be set), then receipt
  await db.from('receipt_items').delete().eq('receipt_id',pendingDeleteReceiptId);
  const {error}=await db.from('receipts').delete().eq('id',pendingDeleteReceiptId).eq('user_id',currentUser.id);
  if(error){showToast('Error deleting receipt');return;}
  closeModal('modal-delete-receipt');
  pendingDeleteReceiptId=null;
  showToast('\u2713 Receipt deleted');
  await loadDashboard();
  loadAllReceipts();
}

// ══ TOAST ══
function showToast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),2500);
}

// ══ RECIPE VIEW / EDIT ══
let currentViewRecipe=null;
let isEditMode=false;

async function viewRecipe(id){
  const r=allRecipes.find(x=>x.id===id);
  if(!r){showToast('Recipe not found');return;}
  currentViewRecipe=r;
  isEditMode=false;

  // Load ingredients from DB
  const {data:ings}=await db.from('recipe_ingredients').select('*').eq('recipe_id',id).order('sort_order');

  document.getElementById('view-recipe-title').textContent=r.title;
  const meta=[r.prep_time?'⏱ '+r.prep_time+'min prep':'',r.cook_time?'🔥 '+r.cook_time+'min cook':'',r.servings?'🍽 Serves '+r.servings:''].filter(Boolean).join('  ·  ');
  document.getElementById('view-recipe-meta').textContent=meta;
  document.getElementById('view-recipe-ingredients').innerHTML=ings&&ings.length
    ?ings.map(i=>'• '+(i.amount?i.amount+' ':'')+i.name).join('<br/>')
    :'<span style="color:var(--muted)">No ingredients listed</span>';
  document.getElementById('view-recipe-instructions').textContent=r.instructions||'No instructions added yet.';

  // Show edit button only for own recipes
  const isOwn=r.user_id===currentUser?.id;
  document.getElementById('edit-recipe-btn').style.display=isOwn?'':'none';
  document.getElementById('archive-recipe-btn').style.display=isOwn?'':'none';
  document.getElementById('delete-recipe-btn').style.display=isOwn?'':'none';

  // Reset pantry section
  document.getElementById('pantry-results').textContent='Tap "Check pantry" to see what you likely already have based on your purchase history.';
  document.getElementById('pantry-add-btn').classList.add('hidden');
  document.getElementById('check-pantry-btn').textContent='Check pantry';
  document.getElementById('check-pantry-btn').disabled=false;
  pantryMissingItems=[];

  document.getElementById('recipe-view-mode').classList.remove('hidden');
  document.getElementById('recipe-edit-mode').classList.add('hidden');
  openModal('modal-view-recipe');
}

function toggleEditRecipe(){
  if(!currentViewRecipe) return;
  isEditMode=!isEditMode;
  document.getElementById('recipe-view-mode').classList.toggle('hidden',isEditMode);
  document.getElementById('recipe-edit-mode').classList.toggle('hidden',!isEditMode);
  document.getElementById('edit-recipe-btn').textContent=isEditMode?'👁 View':'✏️ Edit';
  if(isEditMode){
    document.getElementById('edit-recipe-title-input').value=currentViewRecipe.title||'';
    document.getElementById('edit-recipe-category').value=currentViewRecipe.category||'dinner';
    document.getElementById('edit-recipe-desc').value=currentViewRecipe.description||'';
    document.getElementById('edit-recipe-instructions').value=currentViewRecipe.instructions||'';
    document.getElementById('edit-recipe-prep').value=currentViewRecipe.prep_time||'';
    document.getElementById('edit-recipe-cook').value=currentViewRecipe.cook_time||'';
    document.getElementById('edit-recipe-serves').value=currentViewRecipe.servings||'';
    document.getElementById('edit-recipe-visibility').value=currentViewRecipe.visibility||'private';
    // Load ingredients
    db.from('recipe_ingredients').select('*').eq('recipe_id',currentViewRecipe.id).order('sort_order').then(({data})=>{
      document.getElementById('edit-recipe-ingredients').value=data?data.map(i=>(i.amount?i.amount+' ':'')+i.name).join('\n'):'';
    });
  }
}

async function saveEditRecipe(){
  if(!currentViewRecipe) return;
  const title=document.getElementById('edit-recipe-title-input').value.trim();
  if(!title){document.getElementById('edit-recipe-error').textContent='Please enter a recipe name';return;}
  const {error}=await db.from('recipes').update({
    title,
    category:document.getElementById('edit-recipe-category').value,
    description:document.getElementById('edit-recipe-desc').value,
    instructions:document.getElementById('edit-recipe-instructions').value,
    prep_time:parseInt(document.getElementById('edit-recipe-prep').value)||null,
    cook_time:parseInt(document.getElementById('edit-recipe-cook').value)||null,
    servings:parseInt(document.getElementById('edit-recipe-serves').value)||4,
    visibility:document.getElementById('edit-recipe-visibility').value,
    updated_at:new Date().toISOString(),
  }).eq('id',currentViewRecipe.id);
  if(error){document.getElementById('edit-recipe-error').textContent='Error: '+error.message;return;}
  // Update ingredients
  const ingLines=document.getElementById('edit-recipe-ingredients').value.split('\n').filter(l=>l.trim());
  await db.from('recipe_ingredients').delete().eq('recipe_id',currentViewRecipe.id);
  if(ingLines.length){
    await db.from('recipe_ingredients').insert(ingLines.map((l,i)=>({recipe_id:currentViewRecipe.id,name:l.trim(),sort_order:i})));
  }
  closeModal('modal-view-recipe');
  showToast('Recipe updated \u2713');
  loadRecipes();
}

async function deleteRecipe(){
  if(!currentViewRecipe) return;
  if(!confirm('Delete "'+currentViewRecipe.title+'"? This cannot be undone.')) return;
  await db.from('recipe_ingredients').delete().eq('recipe_id',currentViewRecipe.id);
  await db.from('recipes').delete().eq('id',currentViewRecipe.id);
  closeModal('modal-view-recipe');
  showToast('Recipe deleted');
  loadRecipes();
}

async function archiveRecipe(){
  if(!currentViewRecipe) return;
  const isArchived=currentViewRecipe.visibility==='archived';
  const newVisibility=isArchived?'private':'archived';
  const {error}=await db.from('recipes').update({visibility:newVisibility}).eq('id',currentViewRecipe.id);
  if(error){showToast('Error: '+error.message);return;}
  closeModal('modal-view-recipe');
  showToast(isArchived?'\u2713 Recipe restored':'📁 Recipe archived');
  loadRecipes();
}

function toggleArchived(){
  showArchived=!showArchived;
  const btn=document.getElementById('filter-archived');
  if(btn){
    btn.style.background=showArchived?'var(--primary-pale)':'var(--bg)';
    btn.style.color=showArchived?'var(--primary)':'var(--muted)';
  }
  loadRecipes();
}

// ══ MEAL PLAN — RECIPE PICKER ══
let prFilter='all';
let pendingDayOfWeek=null;
let pendingWeekOffset=0;

function openPlanPickerForDay(dayOfWeek, weekOffset){
  // Open plan picker starting at recipe selection for a specific day
  pendingDayOfWeek=dayOfWeek;
  pendingWeekOffset=weekOffset;
  planPickerWeek=weekOffset;
  prFilter='all';
  document.getElementById('plan-recipe-search').value='';
  document.getElementById('pr-filter-all').classList.add('filter-active');
  document.getElementById('pr-filter-dinner').classList.remove('filter-active');
  document.getElementById('pr-filter-baking').classList.remove('filter-active');
  showPlanStepRecipe();
  renderPlanRecipePicker();
  openModal('modal-plan-picker');
}

function showPlanStepRecipe(){
  document.getElementById('plan-step-recipe').classList.remove('hidden');
  document.getElementById('plan-step-day').classList.add('hidden');
}

function showPlanStepDay(){
  document.getElementById('plan-step-recipe').classList.add('hidden');
  document.getElementById('plan-step-day').classList.remove('hidden');
}

function setPRFilter(f){
  prFilter=f;
  ['all','dinner','baking'].forEach(x=>{
    document.getElementById('pr-filter-'+x).classList.toggle('filter-active',x===f);
  });
  renderPlanRecipePicker();
}

function renderPlanRecipePicker(){
  const search=(document.getElementById('plan-recipe-search')?.value||'').toLowerCase();
  let list=allRecipes.filter(r=>r.visibility!=='archived');
  if(prFilter==='dinner') list=list.filter(r=>r.category==='dinner'||r.category==='lunch'||r.category==='other');
  else if(prFilter==='baking') list=list.filter(r=>r.category==='baking');
  if(search) list=list.filter(r=>r.title.toLowerCase().includes(search));

  const colors={dinner:'#F5A623',baking:'#FF8FAB',lunch:'#6CC2C0',other:'#9B7FD4'};
  const bgs={dinner:'#FEF3DC',baking:'#FFF0F3',lunch:'#CFE8E4',other:'#EDE8F9'};

  if(list.length===0){
    document.getElementById('plan-recipe-list').innerHTML=
      '<div style="text-align:center;padding:20px;color:var(--muted);font-size:13px">No recipes found — add some in the Recipes tab first</div>';
    return;
  }

  document.getElementById('plan-recipe-list').innerHTML=list.map(r=>{
    const col=colors[r.category]||'#9B7FD4';
    const bg=bgs[r.category]||'#EDE8F9';
    return `<div onclick="selectRecipeForPlan('${r.id}')"
      style="display:flex;align-items:center;gap:12px;padding:11px 14px;background:var(--card);border-radius:12px;border:1px solid var(--line);cursor:pointer">
      <div style="width:36px;height:36px;border-radius:8px;background:${bg};display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">
        ${r.category==='baking'?'🥐':'🍽️'}
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:700;color:var(--text)">${r.title}</div>
        <div style="font-size:10px;font-weight:700;color:${col};margin-top:2px">${r.category||'other'}</div>
      </div>
      <span style="color:var(--muted);font-size:18px">›</span>
    </div>`;
  }).join('');
}

function selectRecipeForPlan(recipeId){
  const r=allRecipes.find(x=>x.id===recipeId);
  if(!r) return;
  planPickerRecipe=r;
  planPickerWeek=pendingWeekOffset;
  document.getElementById('plan-picker-recipe-name').textContent=r.title;
  document.getElementById('plan-picker-error').textContent='';
  setPlanPickerWeek(pendingWeekOffset);

  // If we came from a specific day tap, assign immediately
  if(pendingDayOfWeek!==null){
    showPlanStepDay();
    // Pre-highlight the pending day
    renderPlanDayPicker();
  } else {
    showPlanStepDay();
    renderPlanDayPicker();
  }
}



function addRecipeToPlan(){
  if(!currentViewRecipe) return;
  planPickerRecipe=currentViewRecipe;
  planPickerWeek=0;
  pendingDayOfWeek=null;
  document.getElementById('plan-picker-recipe-name').textContent=currentViewRecipe.title;
  document.getElementById('plan-picker-error').textContent='';
  setPlanPickerWeek(0);
  renderPlanDayPicker();
  // Go straight to day picker since recipe is already known
  document.getElementById('plan-step-recipe').classList.add('hidden');
  document.getElementById('plan-step-day').classList.remove('hidden');
  openModal('modal-plan-picker');
}

function setPlanPickerWeek(offset){
  planPickerWeek=offset;
  document.getElementById('picker-tab-this').classList.toggle('filter-active',offset===0);
  document.getElementById('picker-tab-next').classList.toggle('filter-active',offset===1);
  renderPlanDayPicker();
}

function renderPlanDayPicker(){
  const days=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const now=new Date();
  const monday=new Date(now); monday.setDate(now.getDate()-((now.getDay()+6)%7)); monday.setHours(0,0,0,0);
  monday.setDate(monday.getDate()+(planPickerWeek*7));
  document.getElementById('plan-day-picker').innerHTML=days.map((day,i)=>{
    const date=new Date(monday); date.setDate(monday.getDate()+i);
    const dateStr=date.toLocaleDateString('en-ZA',{day:'numeric',month:'short'});
    return `<button onclick="assignRecipeToPlan(${i})" style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-radius:10px;border:1.5px solid var(--line);background:var(--card);cursor:pointer;font-family:var(--font);font-size:13px;font-weight:600;color:var(--text)">
      <span>${day}</span><span style="font-size:11px;color:var(--muted)">${dateStr}</span>
    </button>`;
  }).join('');
}

async function assignRecipeToPlan(dayOfWeek){
  if(!planPickerRecipe||!currentUser) return;
  const errEl=document.getElementById('plan-picker-error');
  errEl.textContent='Saving...';
  const now=new Date();
  const monday=new Date(now); monday.setDate(now.getDate()-((now.getDay()+6)%7)); monday.setHours(0,0,0,0);
  monday.setDate(monday.getDate()+(planPickerWeek*7));
  const ws=monday.toISOString().split('T')[0];

  try{
    // Get or create meal plan
    let planId=null;
    const {data:existingArr}=await db.from('meal_plans').select('id').eq('user_id',currentUser.id).eq('week_start',ws).limit(1);
    const existing=existingArr&&existingArr.length>0?existingArr[0]:null;
    if(existing){
      planId=existing.id;
    } else {
      const {data:newPlan,error:planErr}=await db.from('meal_plans').insert({user_id:currentUser.id,week_start:ws}).select('id').single();
      if(planErr){errEl.textContent='Error creating plan: '+planErr.message;return;}
      planId=newPlan.id;
    }

    // Delete existing entry for this day then insert fresh — avoids constraint issues
    await db.from('meal_plan_entries').delete().eq('plan_id',planId).eq('day_of_week',dayOfWeek);
    const {error:entryErr}=await db.from('meal_plan_entries').insert({
      plan_id:planId,
      user_id:currentUser.id,
      day_of_week:dayOfWeek,
      meal_type:planPickerRecipe.category==='baking'?'baking':'dinner',
      recipe_id:planPickerRecipe.id,
    });

    if(entryErr){errEl.textContent='Error saving: '+entryErr.message;return;}
    errEl.textContent='';
    closeModal('modal-plan-picker');
    closeModal('modal-view-recipe');
    const days=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    showToast('\u2713 '+planPickerRecipe.title+' added to '+days[dayOfWeek]);
    if(currentPlanWeekOffset===planPickerWeek) loadMealPlan();
  } catch(e){
    errEl.textContent='Error: '+e.message;
    console.error('assignRecipeToPlan:',e);
  }
}

// ══ SHOPPING LIST BASKET ══
let currentListBasket='this_week';

function switchListBasket(basket){
  currentListBasket=basket;
  ['this_week','next_week','monthly'].forEach(b=>{
    const el=document.getElementById('list-tab-'+b.replace('_week',b==='this_week'?'-this':b==='next_week'?'-next':'').replace('this_week','this').replace('next_week','next').replace('monthly','monthly'));
  });
  document.getElementById('list-tab-this').classList.toggle('filter-active',basket==='this_week');
  document.getElementById('list-tab-next').classList.toggle('filter-active',basket==='next_week');
  document.getElementById('list-tab-monthly').classList.toggle('filter-active',basket==='monthly');
  loadShoppingList();
}

// ══ GROCERY MASTER LIST ══
let groceryItems=[];
let groceryBasket='this_week';
let groceryCategory='all';
let groceryEditMode=false;

async function loadGroceryItems(){
  // Load shared catalogue (uploaded by admin) + own personal items
  const {data:shared}=await db.from('grocery_items').select('*').eq('is_shared',true).order('category').order('name');
  const {data:own}=await db.from('grocery_items').select('*').eq('user_id',currentUser.id).eq('is_shared',false).order('category').order('name');
  // Merge: shared first, then personal items
  groceryItems=[...(shared||[]),...(own||[])];
  renderGroceryItems();
}

function openGroceryList(){
  loadGroceryItems();
  openModal('modal-grocery-list');
}

function toggleGroceryEditMode(){
  groceryEditMode=!groceryEditMode;
  const btn=document.getElementById('grocery-edit-toggle');
  const hint=document.getElementById('grocery-mode-hint');
  const addForm=document.getElementById('grocery-add-form');
  const basketBar=document.getElementById('grocery-basket-bar');
  if(groceryEditMode){
    btn.textContent='\u2713 Done';
    btn.style.background='var(--primary)';
    hint.textContent='Tap any item to edit or delete it';
    addForm.classList.remove('hidden');
    basketBar.classList.add('hidden');
  } else {
    btn.textContent='\u270f\ufe0f Edit';
    btn.style.background='';
    hint.textContent='Tap any item to add it to your shopping list';
    addForm.classList.add('hidden');
    basketBar.classList.remove('hidden');
    ['new-grocery-name','new-grocery-unit','new-grocery-price'].forEach(id=>{
      const el=document.getElementById(id); if(el) el.value='';
    });
  }
  renderGroceryItems();
}

function filterGroceryItems(search){ renderGroceryItems(search); }

function filterGroceryCategory(cat){
  groceryCategory=cat;
  document.querySelectorAll('[id^="gcat-"]').forEach(b=>b.classList.remove('filter-active'));
  // Map category name to element id
  const idMap={
    'all':'gcat-all','Dairy':'gcat-Dairy','Meat & Fish':'gcat-Meat',
    'Fruit & Veg':'gcat-Fruit','Dry Goods':'gcat-Dry','Bakery':'gcat-Bakery',
    'Frozen':'gcat-Frozen','Snacks':'gcat-Snacks','Beverages':'gcat-Beverages',
    'Cleaning':'gcat-Cleaning','Personal Care':'gcat-PersonalCare',
    'Household':'gcat-Household','Baby & Kids':'gcat-BabyKids','Other':'gcat-Other'
  };
  const el=document.getElementById(idMap[cat]||'gcat-all');
  if(el) el.classList.add('filter-active');
  renderGroceryItems(document.getElementById('grocery-search').value);
}

function setGroceryBasket(basket){
  groceryBasket=basket;
  document.getElementById('basket-this').classList.toggle('filter-active',basket==='this_week');
  document.getElementById('basket-next').classList.toggle('filter-active',basket==='next_week');
  document.getElementById('basket-monthly').classList.toggle('filter-active',basket==='monthly');
}

function renderGroceryItems(search=''){
  let items=groceryItems;
  if(groceryCategory!=='all') items=items.filter(i=>i.category===groceryCategory);
  if(search) items=items.filter(i=>i.name.toLowerCase().includes(search.toLowerCase()));
  const catColors={'Dairy':'#2980B9','Meat & Fish':'#C0392B','Fruit & Veg':'#27AE60','Dry Goods':'#D4AC0D','Cleaning':'#1B8A6B','Bakery':'#E67E22','Frozen':'#8E44AD','Snacks':'#E67E22','Beverages':'#2980B9','Personal Care':'#E91E8C','Household':'#555','Baby & Kids':'#FF8FAB','Other':'#8FA8A6'};
  const catBgs={'Dairy':'#E8F4FD','Meat & Fish':'#FDECEA','Fruit & Veg':'#EAFAF1','Dry Goods':'#FEF9E7','Cleaning':'#E8F5F0','Bakery':'#FEF0E6','Frozen':'#F4ECF7','Snacks':'#FEF0E6','Beverages':'#E8F4FD','Personal Care':'#FFF0F3','Household':'#F5F5F5','Baby & Kids':'#FFF0F3','Other':'#F5F5F5'};
  if(items.length===0){
    document.getElementById('grocery-items-list').innerHTML='<div style="text-align:center;padding:20px;color:var(--muted);font-size:13px">'+(groceryItems.length===0?'No items yet — tap \u270f\ufe0f Edit to add items or upload from Admin':'No items match your filter')+'</div>';
    return;
  }
  const grouped={};
  items.forEach(item=>{if(!grouped[item.category])grouped[item.category]=[];grouped[item.category].push(item);});
  let html='';
  Object.entries(grouped).forEach(([cat,catItems])=>{
    const col=catColors[cat]||'#8FA8A6';
    const bg=catBgs[cat]||'#F5F5F5';
    html+=`<div style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${col};padding:8px 0 4px">${cat}</div>`;
    if(groceryEditMode){
      html+=catItems.map(item=>`
        <div onclick="openEditGroceryItem('${item.id}')" style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:10px;background:var(--card);border:1px solid var(--line);margin-bottom:6px;cursor:pointer">
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:600;color:var(--text)">${item.name}</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:2px">
              ${item.unit?`<span style="font-size:10px;color:var(--muted)">${item.unit}</span>`:''}
              ${item.normal_price?`<span style="font-size:10px;color:var(--muted)">R${parseFloat(item.normal_price).toFixed(2)}</span>`:''}
              ${item.last_price&&item.normal_price&&item.last_price<item.normal_price?`<span style="font-size:10px;color:var(--emerald);font-weight:700">ON SPECIAL \ud83c\udff7\ufe0f</span>`:''}
            </div>
          </div>
          <span style="color:var(--muted);font-size:18px">&#8250;</span>
        </div>`).join('');
    } else {
      html+=catItems.map(item=>`
        <div onclick="addGroceryItemToList('${item.id}')" style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:10px;background:var(--card);border:1px solid var(--line);margin-bottom:6px;cursor:pointer">
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:600;color:var(--text)">${item.name}</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:2px">
              ${item.unit?`<span style="font-size:10px;color:var(--muted)">${item.unit}</span>`:''}
              ${item.normal_price?`<span style="font-size:10px;color:var(--muted)">R${parseFloat(item.normal_price).toFixed(2)}</span>`:''}
              ${item.last_price&&item.normal_price&&item.last_price<item.normal_price?`<span style="font-size:10px;color:var(--emerald);font-weight:700">ON SPECIAL \ud83c\udff7\ufe0f</span>`:''}
            </div>
          </div>
          <div style="width:28px;height:28px;border-radius:50%;background:${bg};color:${col};display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;flex-shrink:0">+</div>
        </div>`).join('');
    }
  });
  document.getElementById('grocery-items-list').innerHTML=html;
}

async function addGroceryItem(){
  const name=document.getElementById('new-grocery-name').value.trim();
  const cat=document.getElementById('new-grocery-cat').value;
  const unit=document.getElementById('new-grocery-unit').value.trim()||null;
  const price=parseFloat(document.getElementById('new-grocery-price').value)||null;
  if(!name){showToast('Please enter an item name');return;}
  const {error}=await db.from('grocery_items').insert({user_id:currentUser.id,name,category:cat,unit,normal_price:price,is_shared:false});
  if(error){showToast('Error: '+error.message);return;}
  document.getElementById('new-grocery-name').value='';
  document.getElementById('new-grocery-unit').value='';
  document.getElementById('new-grocery-price').value='';
  showToast('\u2713 '+name+' added');
  loadGroceryItems();
}

function openEditGroceryItem(id){
  const item=groceryItems.find(i=>i.id===id);
  if(!item) return;
  document.getElementById('edit-grocery-id').value=id;
  document.getElementById('edit-grocery-name').value=item.name||'';
  document.getElementById('edit-grocery-cat').value=item.category||'Other';
  document.getElementById('edit-grocery-unit').value=item.unit||'';
  document.getElementById('edit-grocery-price').value=item.normal_price||'';
  openModal('modal-edit-grocery');
}

async function saveGroceryItem(){
  const id=document.getElementById('edit-grocery-id').value;
  const name=document.getElementById('edit-grocery-name').value.trim();
  if(!name){showToast('Please enter a name');return;}
  const {error}=await db.from('grocery_items').update({
    name,
    category:document.getElementById('edit-grocery-cat').value,
    unit:document.getElementById('edit-grocery-unit').value.trim()||null,
    normal_price:parseFloat(document.getElementById('edit-grocery-price').value)||null,
  }).eq('id',id).eq('user_id',currentUser.id);
  if(error){showToast('Error: '+error.message);return;}
  closeModal('modal-edit-grocery');
  showToast('\u2713 Item updated');
  loadGroceryItems();
}

async function deleteGroceryItem(){
  const id=document.getElementById('edit-grocery-id').value;
  const name=document.getElementById('edit-grocery-name').value;
  if(!confirm('Delete "'+name+'"?')) return;
  await db.from('grocery_items').delete().eq('id',id).eq('user_id',currentUser.id);
  closeModal('modal-edit-grocery');
  showToast('\u2713 Item deleted');
  loadGroceryItems();
}

async function addGroceryItemToList(itemId){
  const item=groceryItems.find(i=>i.id===itemId);
  if(!item) return;
  const now=new Date();
  let weekStart=new Date(now); weekStart.setDate(now.getDate()-((now.getDay()+6)%7)); weekStart.setHours(0,0,0,0);
  if(groceryBasket==='next_week') weekStart.setDate(weekStart.getDate()+7);
  const groceryStore=document.getElementById('grocery-item-store')?.value||null;
  const {error}=await db.from('shopping_list_items').insert({
    user_id:currentUser.id,name:item.name,amount:item.unit||null,
    category:item.category||'misc',store_key:groceryStore||null,
    week_start:groceryBasket==='monthly'?'monthly':weekStart.toISOString().split('T')[0],
  });
  if(error){showToast('Error adding item');return;}
  showToast('\u2713 '+item.name+' added');
}




// ══ GOOGLE VISION KEY ══
function getVisionKey(){ return VISION_KEY; }
function checkVisionKey(){ return true; }

// ══ PHOTO SCAN ══
function openPhotoScan(){
  if(!checkVisionKey()) return;
  document.getElementById('photo-input').click();
}

async function handlePhotoScan(input){
  if(!input.files||!input.files[0]) return;
  const file=input.files[0];
  input.value='';
  showScanModal('📸 Review scanned receipt');
  document.getElementById('scan-status').textContent='Scanning receipt... please wait';
  try {
    document.getElementById('scan-status').textContent='Reading image...';
    const b64=await fileToBase64(file);
    document.getElementById('scan-status').textContent='Sending to Google Vision...';
    const text=await callVisionAPI(b64.split(',')[1]);
    if(text){
      parseReceiptText(text);
      document.getElementById('scan-status').textContent='✓ Receipt scanned — review and correct if needed';
    } else {
      document.getElementById('scan-status').textContent='⚠️ No text detected — please fill in manually. Try a clearer photo with good lighting.';
    }
  } catch(e) {
    console.error('Photo scan error:',e);
    document.getElementById('scan-status').textContent='❌ Scan failed: '+e.message+'. Please fill in manually or check your Google Vision API is enabled.';
  }
}

// ══ EMAIL / DOC IMPORT ══
function openEmailImport(){
  if(!checkVisionKey()) return;
  document.getElementById('email-input').click();
}

async function handleEmailImport(input){
  if(!input.files||!input.files[0]) return;
  const file=input.files[0];
  input.value='';
  showScanModal('📄 Review imported receipt');
  document.getElementById('scan-status').textContent='Reading document... please wait';
  try {
    const b64=await fileToBase64(file);
    const feature=file.type==='application/pdf'?'DOCUMENT_TEXT_DETECTION':'TEXT_DETECTION';
    const text=await callVisionAPI(b64.split(',')[1],feature);
    if(text){ parseReceiptText(text); document.getElementById('scan-status').textContent='✓ Document read — review and correct if needed'; }
    else { document.getElementById('scan-status').textContent='Could not read file — fill in manually'; }
  } catch(e) {
    document.getElementById('scan-status').textContent='Read failed: '+e.message;
  }
}

function showScanModal(title){
  document.getElementById('scan-review-title').textContent=title;
  document.getElementById('scan-status').textContent='';
  document.getElementById('scan-store').value='';
  document.getElementById('scan-date').value=new Date().toISOString().split('T')[0];
  document.getElementById('scan-total').value='';
  document.getElementById('scan-items').value='';
  document.getElementById('scan-items-text').value='';
  document.getElementById('scan-error').textContent='';
  openModal('modal-scan-review');
}

// ══ GOOGLE VISION API ══
async function callVisionAPI(base64Image,feature='TEXT_DETECTION'){
  // Compress image to reduce payload — Vision API works best under 4MB
  const compressed=await compressImage(base64Image);
  const res=await fetch('https://vision.googleapis.com/v1/images:annotate?key='+VISION_KEY,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({requests:[{image:{content:compressed},features:[{type:feature,maxResults:1},{type:'TEXT_DETECTION',maxResults:1}]}]})
  });
  const data=await res.json();
  if(!res.ok){
    const msg=data.error?.message||'Vision API error '+res.status;
    console.error('Vision API error:',data);
    throw new Error(msg);
  }
  const result=data.responses?.[0];
  if(result?.error){throw new Error(result.error.message||'Vision processing error');}
  return result?.fullTextAnnotation?.text||result?.textAnnotations?.[0]?.description||null;
}

// Compress image before sending to Vision API
function compressImage(base64){
  return new Promise((resolve)=>{
    const img=new Image();
    img.onload=()=>{
      const canvas=document.createElement('canvas');
      const max=1200; // max dimension
      let w=img.width, h=img.height;
      if(w>max||h>max){
        if(w>h){h=Math.round(h*max/w);w=max;}
        else{w=Math.round(w*max/h);h=max;}
      }
      canvas.width=w; canvas.height=h;
      const ctx=canvas.getContext('2d');
      ctx.drawImage(img,0,0,w,h);
      const compressed=canvas.toDataURL('image/jpeg',0.85).split(',')[1];
      resolve(compressed);
    };
    img.onerror=()=>resolve(base64); // fallback to original
    img.src='data:image/jpeg;base64,'+base64;
  });
}

// ══ PARSE OCR TEXT ══
function parseReceiptText(text){
  const lines=text.split('\n').map(l=>l.trim()).filter(Boolean);
  const lower=text.toLowerCase();

  // Detect store
  const storeMap={woolworths:'woolworths',woolies:'woolworths',checkers:'checkers',sixty60:'checkers','pick n pay':'pnp','pick & pay':'pnp',pnp:'pnp',spar:'spar',walmart:'walmart'};
  for(const [kw,key] of Object.entries(storeMap)){
    if(lower.includes(kw)){document.getElementById('scan-store').value=key;break;}
  }

  // Detect date
  const datePatterns=[/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/,/(\d{4})[\/\-](\d{2})[\/\-](\d{2})/];
  for(const pat of datePatterns){
    const m=text.match(pat);
    if(m){
      try{
        const d=pat.source.startsWith('(\\d{4})')?new Date(m[1]+'-'+m[2]+'-'+m[3]):new Date(m[3]+'-'+m[2]+'-'+m[1]);
        if(!isNaN(d.getTime())){document.getElementById('scan-date').value=d.toISOString().split('T')[0];break;}
      }catch(e){}
    }
  }

  // Detect total
  const totalMatch=text.match(/(?:total|amount due|balance due|grand total|totaal)[:\s]*r?\s*([\d\s,]+\.?\d*)/i)||text.match(/r\s*([\d,]+\.\d{2})\s*$/im);
  if(totalMatch){
    const num=parseFloat(totalMatch[1].replace(/[\s,]/g,''));
    if(!isNaN(num)&&num>0&&num<100000) document.getElementById('scan-total').value=num.toFixed(2);
  }

  // Populate item list with special price support
  parseItemsFromOCR(text);
}

// ══ SAVE SCANNED RECEIPT ══
async function saveScanReceipt(){
  const storeKey=document.getElementById('scan-store').value;
  const date=document.getElementById('scan-date').value;
  const total=parseFloat(document.getElementById('scan-total').value);
  const errEl=document.getElementById('scan-error');
  errEl.textContent='';
  if(!storeKey||!date||!total){errEl.textContent='Please fill in store, date and total';return;}

  const {data:receipt,error:rxErr}=await db.from('receipts').insert({
    user_id:currentUser.id,
    store_key:storeKey,
    store_name:STORES[storeKey]?.label||storeKey,
    total,
    item_count:scanItems.length||null,
    method:'scan',
    receipt_date:date,
  }).select('id').single();

  if(rxErr){errEl.textContent='Error saving: '+rxErr.message;return;}

  // Save individual items with special price flags
  if(receipt&&scanItems.length>0){
    const valid=scanItems.filter(i=>i.name.trim());
    if(valid.length){
      await db.from('receipt_items').insert(valid.map(i=>({
        receipt_id:receipt.id,
        user_id:currentUser.id,
        name:i.name.trim(),
        price:parseFloat(i.price)||null,
        is_special:i.isSpecial||false,
        normal_price:i.isSpecial&&i.normalPrice?parseFloat(i.normalPrice):null,
      })));
      // Price history for trend tracking
      const hist=valid.filter(i=>i.price);
      if(hist.length) await db.from('price_history').insert(hist.map(i=>({
        user_id:currentUser.id,
        item_name:i.name.trim(),
        store_key:storeKey,
        price:parseFloat(i.price),
        is_special:i.isSpecial||false,
        normal_price:i.isSpecial&&i.normalPrice?parseFloat(i.normalPrice):null,
        recorded_at:date,
      })));
    }
  }

  scanItems=[];
  renderScanItems();
  closeModal('modal-scan-review');
  showToast('\u2713 Receipt saved');
  await loadDashboard();
  loadAllReceipts();
}

// ══ FILE TO BASE64 ══
function fileToBase64(file){
  return new Promise((resolve,reject)=>{
    const r=new FileReader();
    r.onload=()=>resolve(r.result);
    r.onerror=()=>reject(new Error('Could not read file'));
    r.readAsDataURL(file);
  });
}

// ══ FILTER ACTIVE STATE ══
function setFilterActive(f){
  document.querySelectorAll('.filter-pill').forEach(p=>p.classList.remove('filter-active'));
  const el=document.getElementById('filter-'+f);
  if(el) el.classList.add('filter-active');
}

// ══ PANTRY — SMART PREDICTION ENGINE ══
// Predicts what you likely have based on purchase history
// No manual tracking needed — works from your receipt items

let pantryMissingItems=[];

// Default shelf life in days per keyword
const SHELF_LIFE={
  milk:7, cream:5, yoghurt:10, cheese:21, butter:30,
  egg:21, eggs:21, bread:5, flour:180, sugar:365, salt:365,
  rice:365, pasta:365, noodles:365, oats:180,
  chicken:2, beef:2, mince:2, pork:2, fish:2, sausage:3,
  bacon:5, ham:7,
  apple:14, banana:5, orange:14, lemon:14, tomato:7,
  onion:30, garlic:30, potato:21, carrot:14, spinach:5,
  lettuce:5, cucumber:7, pepper:7,
  oil:365, vinegar:365, sauce:90, ketchup:90, mustard:90,
  mayonnaise:60, jam:180, honey:365,
  coffee:180, tea:365, juice:7, cooldrink:90,
  soap:365, shampoo:365, toothpaste:365,
  default:14
};

function getShelfLife(itemName){
  const lower=itemName.toLowerCase();
  for(const [key,days] of Object.entries(SHELF_LIFE)){
    if(lower.includes(key)) return days;
  }
  return SHELF_LIFE.default;
}

function getPantryStatus(lastBought, shelfLife){
  if(!lastBought) return 'unknown';
  const daysSince=Math.floor((Date.now()-new Date(lastBought).getTime())/(1000*60*60*24));
  const ratio=daysSince/shelfLife;
  if(ratio<0.5) return 'have';       // bought recently, likely still good
  if(ratio<0.85) return 'low';       // getting old, might be running out
  return 'need';                      // probably finished
}

async function checkPantry(){
  if(!currentViewRecipe) return;
  const btn=document.getElementById('check-pantry-btn');
  const resultsEl=document.getElementById('pantry-results');
  btn.textContent='Checking...';
  btn.disabled=true;

  // Load recipe ingredients
  const {data:ings}=await db.from('recipe_ingredients')
    .select('name,amount,unit')
    .eq('recipe_id',currentViewRecipe.id)
    .order('sort_order');

  if(!ings||ings.length===0){
    resultsEl.innerHTML='<div style="color:var(--muted)">No ingredients listed for this recipe yet.</div>';
    btn.textContent='Check pantry'; btn.disabled=false;
    return;
  }

  // Load last 90 days of receipt items to build purchase history
  const since=new Date(); since.setDate(since.getDate()-90);
  const {data:purchaseHistory}=await db.from('receipt_items')
    .select('name,created_at')
    .eq('user_id',currentUser.id)
    .gte('created_at',since.toISOString());

  // Also check receipt totals for store-level recency (fallback if no items scanned)
  const {data:recentReceipts}=await db.from('receipts')
    .select('store_name,receipt_date')
    .eq('user_id',currentUser.id)
    .gte('receipt_date',since.toISOString().split('T')[0])
    .order('receipt_date',{ascending:false});

  const history=purchaseHistory||[];

  // For each ingredient, find last purchase date
  const statusColors={have:'var(--emerald)',low:'var(--amber)',need:'var(--accent)',unknown:'var(--muted)'};
  const statusIcons={have:'✅',low:'⚠️',need:'❌',unknown:'❓'};
  const statusLabels={have:'Likely have',low:'Running low',need:'Probably need',unknown:'Not sure'};

  pantryMissingItems=[];
  let html='<div style="display:flex;flex-direction:column;gap:6px">';

  for(const ing of ings){
    const ingLower=ing.name.toLowerCase();
    // Find most recent purchase matching this ingredient
    const matches=history.filter(h=>h.name.toLowerCase().includes(ingLower)||ingLower.includes(h.name.toLowerCase().split(' ')[0]));
    const lastBought=matches.length>0?matches.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))[0].created_at:null;
    const shelfLife=getShelfLife(ing.name);
    const status=getPantryStatus(lastBought,shelfLife);
    const col=statusColors[status];
    const icon=statusIcons[status];
    const label=statusLabels[status];
    const daysAgo=lastBought?Math.floor((Date.now()-new Date(lastBought).getTime())/(1000*60*60*24)):null;

    if(status==='need'||status==='unknown') pantryMissingItems.push(ing);

    html+=`<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;background:var(--bg);border:0.5px solid var(--line)">
      <span style="font-size:16px">${icon}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;color:var(--text)">${ing.name}${ing.amount?' <span style="font-weight:400;color:var(--muted)">'+ing.amount+'</span>':''}</div>
        <div style="font-size:10px;color:${col};font-weight:600">${label}${daysAgo!==null?' · last bought '+daysAgo+'d ago':''}</div>
      </div>
    </div>`;
  }
  html+='</div>';

  // Summary
  const haveCount=ings.length-pantryMissingItems.length;
  html=`<div style="font-size:12px;color:var(--muted);margin-bottom:8px">You likely have <strong style="color:var(--emerald)">${haveCount}</strong> of ${ings.length} ingredients. <strong style="color:var(--accent)">${pantryMissingItems.length}</strong> to buy.</div>`+html;

  resultsEl.innerHTML=html;
  if(pantryMissingItems.length>0){
    document.getElementById('pantry-add-btn').classList.remove('hidden');
  }
  btn.textContent='Refresh'; btn.disabled=false;
}

// ══ REMOVE MEAL PLAN ENTRY ══
async function removeMealEntry(entryId){
  const {error}=await db.from('meal_plan_entries').delete().eq('id',entryId).eq('user_id',currentUser.id);
  if(error){showToast('Error removing meal');return;}
  showToast('\u2713 Meal removed from plan');
  loadMealPlan();
}

async function addMissingToList(){
  if(!pantryMissingItems.length) return;
  const now=new Date();
  let weekStart=new Date(now); weekStart.setDate(now.getDate()-((now.getDay()+6)%7)); weekStart.setHours(0,0,0,0);
  const ws=weekStart.toISOString().split('T')[0];
  const we=new Date(weekStart); we.setDate(weekStart.getDate()+6);
  const weStr=we.toISOString().split('T')[0];

  // Check for duplicates already in list this week
  const {data:existing}=await db.from('shopping_list_items')
    .select('id,name,amount,quantity').eq('user_id',currentUser.id)
    .gte('week_start',ws).lte('week_start',weStr);
  const existingMap={};
  (existing||[]).forEach(i=>{ existingMap[i.name.toLowerCase().trim()]=i; });

  const toAdd=[];
  const toIncrement=[];

  pantryMissingItems.forEach(i=>{
    const key=i.name.toLowerCase().trim();
    if(existingMap[key]){
      toIncrement.push({id:existingMap[key].id, qty:(existingMap[key].quantity||1)+1});
    } else {
      toAdd.push({user_id:currentUser.id,name:i.name.trim(),amount:i.amount||(i.unit||null),category:'meal_plan',store_key:null,week_start:ws});
    }
  });

  if(toAdd.length>0) await db.from('shopping_list_items').insert(toAdd);
  for(const u of toIncrement){
    await db.from('shopping_list_items').update({quantity:u.qty}).eq('id',u.id);
  }

  closeModal('modal-view-recipe');
  let msg='✓ ';
  if(toAdd.length) msg+=toAdd.length+' items added';
  if(toIncrement.length) msg+=(toAdd.length?', ':'')+toIncrement.length+' quantities updated';
  showToast(msg);
  showScreen('list');
  loadShoppingList();
}
// ══ RECIPE LINK IMPORT ══
// Fetches a URL via a CORS proxy, parses title/ingredients/instructions
// from common recipe schema (schema.org/Recipe JSON-LD or Open Graph)
async function importRecipeFromUrl(){
  const urlInput=document.getElementById('recipe-import-url');
  const errEl=document.getElementById('recipe-import-error');
  const url=(urlInput?.value||'').trim();
  errEl.textContent='';
  if(!url||!url.startsWith('http')){errEl.textContent='Please enter a valid URL';return;}

  const btn=document.getElementById('recipe-import-btn');
  if(btn){btn.textContent='Importing...';btn.disabled=true;}

  try{
    // Use allorigins CORS proxy to fetch the page
    const proxy=`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const res=await fetch(proxy);
    const data=await res.json();
    const html=data.contents||'';

    // Try to parse schema.org/Recipe JSON-LD first
    const recipe=parseSchemaRecipe(html)||parseOpenGraph(html,url);

    if(!recipe||!recipe.title){
      errEl.textContent='Could not read recipe from that page. Try copying the ingredients manually.';
      return;
    }

    // Populate the add recipe modal
    document.getElementById('recipe-title').value=recipe.title||'';
    document.getElementById('recipe-desc').value=recipe.description||'';
    document.getElementById('recipe-ingredients').value=(recipe.ingredients||[]).join('\n');
    document.getElementById('recipe-instructions').value=recipe.instructions||'';
    if(recipe.prepTime) document.getElementById('recipe-prep').value=recipe.prepTime;
    if(recipe.cookTime) document.getElementById('recipe-cook').value=recipe.cookTime;
    if(recipe.servings) document.getElementById('recipe-serves').value=recipe.servings;

    closeModal('modal-recipe-import');
    openModal('modal-add-recipe');
    showToast('\u2713 Recipe imported — review and save');

  }catch(e){
    errEl.textContent='Error fetching page: '+e.message;
    console.error('Recipe import error:',e);
  } finally {
    if(btn){btn.textContent='Import recipe';btn.disabled=false;}
  }
}

function parseSchemaRecipe(html){
  // Find JSON-LD script tags
  const matches=html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)||[];
  for(const block of matches){
    try{
      const inner=block.replace(/<script[^>]*>/i,'').replace(/<\/script>/i,'');
      const json=JSON.parse(inner);
      const schemas=[].concat(json['@graph']||json);
      for(const schema of schemas){
        if(schema['@type']==='Recipe'||schema['@type']==='https://schema.org/Recipe'){
          return {
            title:schema.name||'',
            description:schema.description||'',
            ingredients:schema.recipeIngredient||[],
            instructions:formatInstructions(schema.recipeInstructions),
            prepTime:parseDuration(schema.prepTime),
            cookTime:parseDuration(schema.cookTime),
            servings:schema.recipeYield?parseInt(schema.recipeYield):null,
          };
        }
      }
    }catch(e){}
  }
  return null;
}

function parseOpenGraph(html,url){
  // Fallback — just get the title
  const titleMatch=html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
    ||html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const desc=html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
  if(!titleMatch) return null;
  return {title:titleMatch[1].trim(),description:desc?desc[1].trim():'',ingredients:[],instructions:'Source: '+url};
}

function formatInstructions(raw){
  if(!raw) return '';
  if(typeof raw==='string') return raw;
  if(Array.isArray(raw)){
    return raw.map((s,i)=>{
      if(typeof s==='string') return (i+1)+'. '+s;
      return (i+1)+'. '+(s.text||s.name||'');
    }).join('\n');
  }
  return '';
}

function parseDuration(iso){
  if(!iso) return null;
  const m=iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if(!m) return null;
  return ((parseInt(m[1])||0)*60)+(parseInt(m[2])||0);
}

function openRecipeImport(){
  const urlEl=document.getElementById('recipe-import-url');
  const errEl=document.getElementById('recipe-import-error');
  if(urlEl) urlEl.value='';
  if(errEl) errEl.textContent='';
  openModal('modal-recipe-import');
}
