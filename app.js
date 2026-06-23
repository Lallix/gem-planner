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
    return `<div style="width:${size}px;height:${size}px;border-radius:8px;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#f5f5f5;flex-shrink:0">
      <img src="${cfg.logo}" alt="${cfg.label}" style="width:100%;height:100%;object-fit:contain" onerror="this.parentNode.style.background='${cfg.brand}';this.parentNode.innerHTML='<span style=\"font-size:${Math.round(size*.35)}px;font-weight:800;color:white\">${cfg.label.charAt(0)}</span>'"/>
    </div>`;
  }
  return `<div style="background:${cfg.brand};width:${size}px;height:${size}px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:${Math.round(size*.35)}px;font-weight:800;color:white;flex-shrink:0">${cfg.label.charAt(0)}</div>`;
}

// ══ STATE ══
let currentUser=null, isAdmin=false, receipts=[], budget=0, allRecipes=[], shoppingItems=[], currentFilter='all';

// ══ INIT ══
document.addEventListener('DOMContentLoaded', async()=>{
  updateClock(); setInterval(updateClock,30000);
  const rdEl=document.getElementById('receipt-date');
  if(rdEl) rdEl.value=new Date().toISOString().split('T')[0];
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
function showApp(){
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  window.scrollTo({top:0,behavior:'instant'});
  // Small delay so DOM renders before we try to populate elements
  setTimeout(()=>loadDashboard(), 150);
}
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
  const ss=(id,val)=>{const el=document.getElementById(id);if(el)el.textContent=val;};
  ss('profile-name',name);
  ss('profile-email',user.email);
  ss('profile-avatar',name.charAt(0).toUpperCase());
  ss('topbar-user',name.charAt(0).toUpperCase());
  ss('topbar-initial',name.charAt(0).toUpperCase()); // legacy
  ss('home-avatar',name.charAt(0).toUpperCase());
  ss('home-greeting-name',name);
  const editNameEl=document.getElementById('edit-name-input');
  if(editNameEl) editNameEl.value=name;
  const roleEl=document.getElementById('profile-role');
  const adminPanel=document.getElementById('admin-panel');
  if(isAdmin){
    if(roleEl) roleEl.textContent='Admin';
    if(adminPanel){ adminPanel.classList.remove('hidden'); adminPanel.style.display=''; }
    loadUserList();
  } else {
    if(roleEl) roleEl.textContent='Member';
    if(adminPanel){ adminPanel.classList.add('hidden'); adminPanel.style.display='none'; }
  }
  // Update settings subs
  const sNameSub=document.getElementById('setting-name-sub');
  if(sNameSub) sNameSub.textContent=name;
  // Load profile avatar from DB if saved
  const {data:pData}=await db.from('profiles').select('avatar_emoji').eq('id',user.id).single();
  if(pData?.avatar_emoji){
    const avEl=document.getElementById('profile-avatar');
    if(avEl) avEl.innerHTML=pData.avatar_emoji;
    const homeAv=document.getElementById('home-avatar');
    if(homeAv) homeAv.innerHTML=pData.avatar_emoji;
  }
  loadProfileStats();
}

// ══ DASHBOARD ══
async function loadDashboard(){
  // Guard — if home screen elements not in DOM yet, retry once
  if(!document.getElementById('home-budget-spent')){
    setTimeout(()=>loadDashboard(), 300);
    return;
  }
  const now=new Date();
  const monthKey=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const monthName=now.toLocaleString('default',{month:'long'});
  // Guard old elements that may not exist in new design
  const ss=(id,val)=>{const el=document.getElementById(id);if(el)el.textContent=val;};
  ss('hero-month',`${monthName} ${now.getFullYear()}`);
  ss('chart-month-label',monthName);
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
  const remaining=Math.max(0,budget-totalSpent);
  const ss=(id,val,prop='textContent')=>{const el=document.getElementById(id);if(el)el[prop]=val;};

  // ── NEW home screen budget card ──
  ss('home-budget-month',monthName+' budget');
  ss('home-budget-spent',fmtR(totalSpent));
  ss('home-budget-of','of '+fmtR(budget||0));
  ss('home-budget-pct',pct+'%');
  ss('home-budget-left',budget>0?fmtR(remaining)+' left':'Tap to set budget');
  const barEl=document.getElementById('home-budget-bar');
  if(barEl) barEl.style.width=pct+'%';

  // ── Greeting ──
  const hr=now.getHours();
  const greet=hr<12?'Good morning':hr<17?'Good afternoon':hr<21?'Good evening':'Good night';
  ss('home-greeting-time',greet);

  // ── Stats ──
  const weekStart=new Date(now); weekStart.setDate(now.getDate()-((now.getDay()+6)%7));
  weekStart.setHours(0,0,0,0);
  const weekRx=receipts.filter(r=>new Date(r.receipt_date)>=weekStart);
  const weekTotal=weekRx.reduce((s,r)=>s+(r.total||0),0);
  const weeksIn=Math.max(1,Math.ceil(now.getDate()/7));
  const avgWeek=totalSpent/weeksIn;
  const daysInMonth=new Date(now.getFullYear(),now.getMonth()+1,0).getDate();
  const daysLeft=daysInMonth-now.getDate();
  const predicted=totalSpent+(avgWeek/7)*daysLeft;
  ss('home-stat-week','R '+Math.round(weekTotal).toLocaleString());
  ss('home-stat-avg','R '+Math.round(avgWeek).toLocaleString());
  ss('home-stat-pred','R '+Math.round(predicted).toLocaleString());
  // Legacy stat elements
  ss('stat-week',`R ${Math.round(weekTotal).toLocaleString()}`);
  ss('stat-week-sub',`${weekRx.length} receipt${weekRx.length!==1?'s':''}`);
  ss('stat-avg',`R ${Math.round(avgWeek).toLocaleString()}`);
  ss('stat-predicted',`R ${Math.round(predicted).toLocaleString()}`);

  // ── Home lists, meals, receipts ──
  renderHomeLists();
  renderHomeMeals();
  renderHomeReceipts();

  // Stores (old dashboard element — skip if not present)
  const sm={};
  receipts.forEach(r=>{const k=r.store_key||'other';if(!sm[k])sm[k]={key:k,total:0};sm[k].total+=r.total||0;});
  const sa=Object.values(sm).sort((a,b)=>b.total-a.total);
  const storeListEl=document.getElementById('store-list');
  if(storeListEl) storeListEl.innerHTML=sa.length===0
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

  // Chart (old dashboard element — skip if not present)
  const wm={};
  receipts.forEach(r=>{const d=new Date(r.receipt_date);const wn=`W${Math.ceil(d.getDate()/7)}`;wm[wn]=(wm[wn]||0)+(r.total||0);});
  const wd=['W1','W2','W3','W4','W5'].map(w=>({week:w,amount:wm[w]||0})).filter(w=>w.amount>0);
  const curW=`W${Math.ceil(now.getDate()/7)}`;
  const chartEl=document.getElementById('weekly-chart');
  if(chartEl) chartEl.innerHTML=wd.length===0
    ?'<div style="width:100%;text-align:center;font-size:12px;color:var(--muted);padding:20px 0">Add receipts to see your chart</div>'
    :wd.map(w=>{const h=Math.max(8,Math.round((w.amount/Math.max(...wd.map(x=>x.amount)))*60));const a=w.week===curW;
      return `<div class="chart-col">
        <div style="font-size:9px;font-weight:700;color:${a?'var(--mint-dark)':'transparent'};margin-bottom:2px">R${(w.amount/1000).toFixed(1)}k</div>
        <div class="chart-bar" style="height:${h}px;background:${a?'linear-gradient(180deg,var(--mint),var(--mint-dark))':'var(--mint-pale)'}"></div>
        <div style="font-size:9px;color:${a?'var(--mint-dark)':'var(--muted)'};font-weight:${a?700:400}">${w.week}</div>
      </div>`;}).join('');

  // Recent receipts (old dashboard element — skip if not present)
  const recentEl=document.getElementById('recent-receipts');
  if(recentEl){
    const recent=receipts.slice(0,4);
    recentEl.innerHTML=recent.length===0
      ?'<div class="empty-state" style="padding:16px 0">No receipts yet</div>'
      :recent.map(r=>{
        const cfg=STORES[r.store_key]||STORES.other;
        const d=new Date(r.receipt_date).toLocaleDateString('en-ZA',{day:'numeric',month:'short'});
        return `<div class="receipt-row">${storeLogo(r.store_key,38)}
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:600">${cfg.label}</div>
            <div style="font-size:11px;color:var(--muted)">${d} · ${r.item_count||'?'} items</div>
          </div>
          <div style="font-size:14px;font-weight:700">${fmtR(r.total||0)}</div>
        </div>`;}).join('');
  }
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
  else if(currentFilter==='lunch') list=list.filter(r=>r.category==='lunch');
  else if(currentFilter==='shared') list=list.filter(r=>r.visibility==='everyone');
  else if(currentFilter!=='archived') list=list.filter(r=>r.visibility!=='archived');

  // Category colours
  const tagColors={dinner:{bg:'var(--orange-pale)',col:'#8B3A00'},baking:{bg:'var(--pink-pale)',col:'#8B0038'},lunch:{bg:'var(--blue-pale)',col:'var(--blue-dark)'},other:{bg:'var(--green-pale)',col:'var(--green-deeper)'}};
  const thumbBgs={dinner:'linear-gradient(135deg,#FFE4CC,#FFD0A8)',baking:'linear-gradient(135deg,#FFE0EE,#FFCCE4)',lunch:'linear-gradient(135deg,#D6EEFF,#BED8F8)',other:'linear-gradient(135deg,#D4F5E9,#B8EDD5)'};
  const thumbEmoji={dinner:'&#127829;&#65039;',baking:'&#129360;',lunch:'&#129367;',other:'&#127869;&#65039;'};

  document.getElementById('recipe-list').innerHTML=list.length===0
    ?`<div class="empty-state">
        <div class="empty-state-icon">&#127869;&#65039;</div>
        <div class="empty-title">No recipes yet</div>
        <div class="empty-sub">Tap + New to add your first recipe, or import one from a link</div>
      </div>`
    :list.map(r=>{
      const tc=tagColors[r.category]||tagColors.other;
      const bg=thumbBgs[r.category]||thumbBgs.other;
      const emoji=thumbEmoji[r.category]||thumbEmoji.other;
      const meta=[r.prep_time?`&#9201; ${r.prep_time}min prep`:'',r.cook_time?`&#128293; ${r.cook_time}min cook`:'',r.servings?`&#127869; Serves ${r.servings}`:''].filter(Boolean).join(' &middot; ');
      const sharedBadge=r.visibility==='everyone'?`<div class="recipe-shared-badge">Shared</div>`:'';
      const archivedBadge=r.visibility==='archived'?`<div class="recipe-shared-badge" style="color:var(--muted)">Archived</div>`:'';
      return `<div class="recipe-card" onclick="viewRecipe('${r.id}')">
        <div class="recipe-thumb" style="background:${bg}">
          <span class="recipe-thumb-emoji">${emoji}</span>
          <div class="recipe-cat-tag" style="background:${tc.bg};color:${tc.col}">${CATEGORY_LABELS[r.category]||r.category}</div>
          ${sharedBadge}${archivedBadge}
        </div>
        <div class="recipe-body">
          <div class="recipe-title">${r.title}</div>
          ${meta?`<div class="recipe-meta-row">${meta}</div>`:''}
          ${r.description?`<div style="font-size:12px;color:var(--muted);margin-top:4px;line-height:1.4">${r.description}</div>`:''}
          <div class="recipe-actions" style="margin-top:10px">
            <button class="recipe-act-btn" style="background:var(--green-pale);color:var(--green-deeper)" onclick="event.stopPropagation();openPlanPickerFromRecipe('${r.id}')">&#128197; Plan</button>
            <button class="recipe-act-btn" style="background:var(--blue-pale);color:var(--blue-dark)" onclick="event.stopPropagation();viewRecipeAndAddToList('${r.id}')">&#128722; List</button>
          </div>
        </div>
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
  // Load frequently bought alongside list items
  await loadFrequentlyBought();
  renderShoppingList();
}

let currentListStoreFilter='';

function setListStoreFilter(storeKey){
  currentListStoreFilter=storeKey;
  // Clear all active states on store buttons
  document.querySelectorAll('.store-filter-btn').forEach(b=>b.classList.remove('active'));
  const allBtn=document.getElementById('store-filter-all');
  if(allBtn) allBtn.classList.toggle('active',!storeKey);
  if(storeKey){
    const btn=document.getElementById('store-filter-'+storeKey);
    if(btn) btn.classList.add('active');
  }
  renderShoppingList();
}


// ══ FREQUENTLY BOUGHT ══
let freqItems=[];

async function loadFrequentlyBought(){
  if(!currentUser) return;
  // Pull most recently and frequently bought items from price_history
  const {data}=await db.from('price_history')
    .select('item_name,store_key,price,recorded_at')
    .eq('user_id',currentUser.id)
    .order('recorded_at',{ascending:false})
    .limit(200);
  if(!data||!data.length){ freqItems=[]; return; }
  // Count frequency per item name
  const counts={};
  const lastPrice={};
  const lastStore={};
  data.forEach(row=>{
    const key=row.item_name.toLowerCase().trim();
    counts[key]=(counts[key]||0)+1;
    if(!lastPrice[key]){ lastPrice[key]=row.price; lastStore[key]=row.store_key; }
  });
  // Sort by frequency, take top 10
  freqItems=Object.entries(counts)
    .sort((a,b)=>b[1]-a[1])
    .slice(0,10)
    .map(([key])=>({
      name:data.find(r=>r.item_name.toLowerCase().trim()===key)?.item_name||key,
      price:lastPrice[key],
      store_key:lastStore[key],
    }));
}

function renderFrequentlyBought(){
  if(!freqItems.length) return '';
  // Tile colours cycling through palette
  const palettes=[
    {bg:'var(--blue-pale)',    btn:'var(--blue)'},
    {bg:'var(--orange-pale)',  btn:'var(--orange)'},
    {bg:'var(--yellow-pale)',  btn:'var(--yellow)',btnText:'var(--charcoal)'},
    {bg:'var(--pink-pale)',    btn:'var(--pink)'},
    {bg:'var(--purple-pale)',  btn:'var(--purple)'},
    {bg:'var(--green-pale)',   btn:'var(--green-dark)'},
  ];
  const tiles=freqItems.map((item,i)=>{
    const pal=palettes[i%palettes.length];
    const emoji=getFreqEmoji(item.name);
    const btnText=pal.btnText||'#fff';
    return `<div class="freq-tile" style="background:${pal.bg};box-shadow:0 4px 14px rgba(0,0,0,.1)">
      <div class="freq-thumb">${emoji}</div>
      <div class="freq-name">${item.name}</div>
      ${item.price?`<div class="freq-price">R${parseFloat(item.price).toFixed(2)}</div>`:'<div class="freq-price" style="opacity:0">—</div>'}
      <button class="freq-add-btn" style="background:${pal.btn};color:${btnText}"
        onclick="addFreqItemToList('${item.name.replace(/'/g,"\\'")}','${item.store_key||''}')">+</button>
    </div>`;
  }).join('');
  return `<div style="padding:12px 0 0">
    <div class="freq-section-head">
      <span style="font-size:14px;font-weight:800;color:var(--text)">Frequently bought</span>
      <span style="font-size:11px;color:var(--muted);font-weight:500">scroll &#8594;</span>
    </div>
    <div class="freq-scroll">${tiles}</div>
    <div style="height:1px;background:var(--line);margin:0 16px 14px"></div>
  </div>`;
}

function getFreqEmoji(name){
  const n=name.toLowerCase();
  const map=[
    ['milk','&#129371;'],['egg','&#129040;'],['bread','&#127838;'],['butter','&#129371;'],
    ['cheese','&#129472;'],['chicken','&#129385;'],['beef','&#129385;'],['mince','&#129385;'],
    ['tomato','&#127813;'],['potato','&#129479;'],['onion','&#129382;'],['carrot','&#129365;'],
    ['apple','&#127822;'],['banana','&#127820;'],['orange','&#127818;'],['avocado','&#129361;'],
    ['rice','&#127858;'],['pasta','&#127857;'],['flour','&#127807;'],['sugar','&#127807;'],
    ['oil','&#127807;'],['coffee','&#9749;'],['tea','&#9749;'],['juice','&#129381;'],
    ['soap','&#129532;'],['detergent','&#129532;'],['sauce','&#127798;'],['yoghurt','&#129371;'],
    ['cream','&#129371;'],['bacon','&#129385;'],['fish','&#127957;'],['pork','&#129385;'],
  ];
  for(const [key,emoji] of map){ if(n.includes(key)) return emoji; }
  return '&#128230;';
}

async function addFreqItemToList(name,storeKey){
  if(!currentUser) return;
  const grocery=groceryItems.find(g=>g.name.toLowerCase()===name.toLowerCase());
  // Respect whichever basket is currently active
  const now=new Date();
  const weekStart=new Date(now); weekStart.setDate(now.getDate()-((now.getDay()+6)%7)); weekStart.setHours(0,0,0,0);
  if(currentListBasket==='next_week') weekStart.setDate(weekStart.getDate()+7);
  const ws=currentListBasket==='monthly'?'monthly':weekStart.toISOString().split('T')[0];
  const {error}=await db.from('shopping_list_items').insert({
    user_id:currentUser.id,
    name,
    category:grocery?.category||'misc',
    amount:grocery?.unit||null,
    normal_price:grocery?.normal_price||null,
    store_key:storeKey||null,
    week_start:ws,
    quantity:1,
    is_checked:false,
  });
  if(!error){
    showToast('\u2713 '+name+' added to '+(currentListBasket==='monthly'?'monthly':'list'));
    loadShoppingList();
  }
}


// ══ LIST CATEGORY FILTER ══
let currentListCatFilter='all';

function setListCatFilter(cat){
  currentListCatFilter=cat;
  document.querySelectorAll('[id^="list-cat-"]').forEach(b=>b.classList.remove('filter-active'));
  const activeId='list-cat-'+(cat==='all'?'all':cat==='Dairy'?'dairy':cat==='Meat & Fish'?'meat':cat==='Fruit & Veg'?'veg':cat==='Dry Goods'?'dry':cat==='Cleaning'?'cleaning':cat==='Bakery'?'bakery':cat==='Frozen'?'frozen':cat==='Beverages'?'drinks':'all');
  const el=document.getElementById(activeId);
  if(el) el.classList.add('filter-active');
  renderShoppingList();
}

function renderShoppingList(){
  renderListHero();
  let items=shoppingItems;
  if(currentListStoreFilter) items=items.filter(i=>i.store_key===currentListStoreFilter);
  if(currentListCatFilter&&currentListCatFilter!=='all') items=items.filter(i=>(i.category||'misc')===currentListCatFilter);

  const listEl=document.getElementById('shopping-list-content');
  if(items.length===0){
    listEl.innerHTML=renderFrequentlyBought()+
      `<div class="empty-state"><div class="empty-state-icon">&#128722;</div><div class="empty-title">List is empty</div><div class="empty-sub">Tap + Add or the basket icon to add items</div></div>`;
    return;
  }

  // Category config — tinted backgrounds + coloured shadows
  const catCfg={
    'Dairy':       {bg:'var(--blue-pale)',  shadow:'rgba(59,158,255,.3)',  dot:'var(--blue)'},
    'Meat & Fish': {bg:'var(--pink-pale)',  shadow:'rgba(255,79,139,.3)',   dot:'var(--pink)'},
    'Fruit & Veg': {bg:'var(--green-pale)', shadow:'rgba(0,198,122,.3)',    dot:'var(--green)'},
    'Dry Goods':   {bg:'var(--orange-pale)',shadow:'rgba(255,140,66,.3)',   dot:'var(--orange)'},
    'Bakery':      {bg:'var(--orange-pale)',shadow:'rgba(255,140,66,.25)',  dot:'var(--orange)'},
    'Frozen':      {bg:'var(--purple-pale)',shadow:'rgba(139,92,246,.25)',  dot:'var(--purple)'},
    'Cleaning':    {bg:'var(--green-pale)', shadow:'rgba(0,198,122,.2)',    dot:'var(--green-dark)'},
    'Beverages':   {bg:'var(--blue-pale)',  shadow:'rgba(59,158,255,.25)',  dot:'var(--blue)'},
    'Snacks':      {bg:'var(--yellow-pale)',shadow:'rgba(245,196,0,.25)',   dot:'var(--yellow)'},
    'Personal Care':{bg:'var(--pink-pale)', shadow:'rgba(255,79,139,.2)',   dot:'var(--pink)'},
    'Household':   {bg:'var(--purple-pale)',shadow:'rgba(139,92,246,.2)',   dot:'var(--purple)'},
    'Baby & Kids': {bg:'var(--pink-pale)',  shadow:'rgba(255,79,139,.2)',   dot:'var(--pink)'},
    'meal_plan':   {bg:'var(--orange-pale)',shadow:'rgba(255,140,66,.25)',  dot:'var(--orange)'},
    'misc':        {bg:'var(--yellow-pale)',shadow:'rgba(245,196,0,.25)',   dot:'var(--yellow)'},
    'Other':       {bg:'var(--yellow-pale)',shadow:'rgba(245,196,0,.2)',    dot:'var(--yellow)'},
  };

  // Category emoji map
  const catEmoji={'Dairy':'&#129371;','Meat & Fish':'&#129385;','Fruit & Veg':'&#129382;','Dry Goods':'&#127807;','Bakery':'&#127838;','Frozen':'&#10052;&#65039;','Cleaning':'&#129532;','Beverages':'&#129381;','Snacks':'&#127839;','Personal Care':'&#129532;','Household':'&#127968;','Baby & Kids':'&#128118;','meal_plan':'&#127869;&#65039;','misc':'&#128230;','Other':'&#128230;'};

  // Group by category
  const grouped={};
  items.forEach(i=>{
    const cat=i.category||'misc';
    if(!grouped[cat]) grouped[cat]=[];
    grouped[cat].push(i);
  });

  let html=renderFrequentlyBought();
  Object.entries(grouped).forEach(([cat,catItems])=>{
    const cfg=catCfg[cat]||{bg:'var(--yellow-pale)',shadow:'rgba(245,196,0,.25)',dot:'var(--yellow)'};
    const emoji=catEmoji[cat]||'&#128230;';
    const catLabel=CATEGORY_LABELS[cat]||cat;

    // Frequently bought row for this category (from grocery items)
    const freq=groceryItems.filter(g=>g.category===cat).slice(0,8);

    if(freq.length>0){
      html+=`<div style="padding:10px 16px 0">
        <div style="font-size:11px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.7px;margin-bottom:8px;display:flex;align-items:center;gap:6px">
          <span style="width:8px;height:8px;border-radius:50%;background:${cfg.dot};display:inline-block"></span>${catLabel}
        </div>
      </div>`;
    } else {
      html+=`<div style="padding:10px 16px 0">
        <div style="font-size:11px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.7px;margin-bottom:8px;display:flex;align-items:center;gap:6px">
          <span style="width:8px;height:8px;border-radius:50%;background:${cfg.dot};display:inline-block"></span>${catLabel}
        </div>
      </div>`;
    }

    // 3-column tile grid
    html+=`<div class="prod-grid">`;
    catItems.forEach(item=>{
      const price=item.normal_price?`<div class="prod-price">R${parseFloat(item.normal_price).toFixed(2)}</div>`:'';
      const qty=item.quantity||1;
      html+=`<div class="prod-card ${item.is_checked?'opacity-50':''}" style="background:${cfg.bg};box-shadow:0 4px 16px ${cfg.shadow}">
        <div class="prod-thumb">${emoji}</div>
        <div class="prod-name ${item.is_checked?'checked':''}">${item.name}</div>
        ${item.amount?`<div class="prod-unit">${item.amount}</div>`:''}
        ${price}
        <div class="qty-stepper" onclick="event.stopPropagation()">
          <button class="qty-btn" onclick="changeItemQty('${item.id}',${qty-1})">&#8722;</button>
          <div class="qty-num">${qty}</div>
          <button class="qty-btn plus" onclick="changeItemQty('${item.id}',${qty+1})">+</button>
        </div>
        <button onclick="deleteListItem('${item.id}')" style="background:transparent;border:none;cursor:pointer;font-size:13px;color:var(--muted);padding:2px;margin-top:4px;width:100%;text-align:right">&#10005;</button>
      </div>`;
    });
    // Empty add tile
    html+=`<div class="prod-card-empty" onclick="openAddListItem()" style="min-height:100px">
      <div style="text-align:center;color:var(--muted)">
        <div style="font-size:24px;font-weight:800;color:var(--green)">+</div>
        <div style="font-size:11px;font-weight:700;margin-top:2px">Add</div>
      </div>
    </div>`;
    html+=`</div>`;
  });

  listEl.innerHTML=html;
}


// ══ RECIPE QUICK ACTIONS ══
function openPlanPickerFromRecipe(recipeId){
  const r=allRecipes.find(x=>x.id===recipeId);
  if(!r) return;
  planPickerRecipe=r;
  planPickerWeek=0;
  pendingDayOfWeek=null;
  document.getElementById('plan-picker-recipe-name').textContent=r.title;
  document.getElementById('plan-picker-error').textContent='';
  setPlanPickerWeek(0);
  renderPlanDayPicker();
  document.getElementById('plan-step-recipe').classList.add('hidden');
  document.getElementById('plan-step-day').classList.remove('hidden');
  openModal('modal-plan-picker');
}

function viewRecipeAndAddToList(recipeId){
  viewRecipe(recipeId);
  // After modal opens, trigger pantry check automatically
  setTimeout(()=>checkPantry(),400);
}

async function changeItemQty(id,newQty){
  if(newQty<1){ deleteListItem(id); return; }
  await db.from('shopping_list_items').update({quantity:newQty}).eq('id',id);
  const item=shoppingItems.find(i=>i.id===id);
  if(item){ item.quantity=newQty; renderShoppingList(); }
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
    ['new-user-name','new-user-email'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=''});
    showToast(`✓ Account created for ${name}`);
    setTimeout(loadUserList,1500);

  } catch(err){
    errEl.textContent='Network error — please try again';
    console.error('Create user error:',err);
  }
}

// ══ PASSWORD CHANGE ══
function openChangePassword(){
  const pwEl=document.getElementById('new-password'); if(pwEl) pwEl.value='';
  const cpEl=document.getElementById('confirm-password'); if(cpEl) cpEl.value='';
  const peEl=document.getElementById('password-error'); if(peEl) peEl.textContent='';
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
  const ss=(id,val)=>{const el=document.getElementById(id);if(el)el.textContent=val;};
  ss('profile-name',name);
  ss('profile-avatar',name.charAt(0).toUpperCase());
  ss('topbar-user',name.charAt(0).toUpperCase());
  ss('topbar-initial',name.charAt(0).toUpperCase());
  ss('home-avatar',name.charAt(0).toUpperCase());
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
  // Scroll to top on every tab switch
  window.scrollTo({top:0,behavior:'instant'});
  const screenEl=document.getElementById('screen-'+name);
  if(screenEl) screenEl.scrollTop=0;
  // Lazy load screens
  if(name==='home') loadDashboard();
  if(name==='scan') loadAllReceipts();
  if(name==='recipes') loadRecipes();
  if(name==='list') loadShoppingList();
  if(name==='plan'){ if(!allRecipes||allRecipes.length===0) loadRecipes(); loadMealPlan(); }
  if(name==='profile'){ if(isAdmin) loadUserList(); loadProfileStats(); }
}

// ══ MODALS ══
function openModal(id){
  const el=document.getElementById(id);
  if(!el) return;
  el.classList.remove('hidden');
  // Scroll modal sheet to top
  window.scrollTo({top:0,behavior:'instant'});
  const sheet=el.querySelector('.modal-sheet');
  if(sheet) sheet.scrollTop=0;
}
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
  // Toggle active class — must use 'active' to match .basket-tab.active CSS
  document.querySelectorAll('.basket-tab').forEach(t=>t.classList.remove('active'));
  const activeTab=basket==='this_week'?'list-tab-this':basket==='next_week'?'list-tab-next':'list-tab-monthly';
  const el=document.getElementById(activeTab);
  if(el) el.classList.add('active');
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
  const ss=(id,val,prop='textContent')=>{const el=document.getElementById(id);if(el)el[prop]=val;};
  ss('scan-review-title',title);
  ss('scan-status','');
  ss('scan-store','','value');
  ss('scan-date',new Date().toISOString().split('T')[0],'value');
  ss('scan-total','','value');
  // Legacy elements — guard in case they don't exist
  ss('scan-items','','value');
  ss('scan-items-text','','value');
  ss('scan-error','');
  // Clear the item list
  const listEl=document.getElementById('scan-item-list');
  if(listEl) listEl.innerHTML='';
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



// ══ AVATAR PICKER ══
const AVATARS=[
  {emoji:'&#128104;&#8205;&#127859;',name:'Head Chef'},
  {emoji:'&#128105;&#8205;&#127859;',name:'Chef G'},
  {emoji:'&#129472;',name:'Cheese Boss'},
  {emoji:'&#127859;',name:'Fork Life'},
  {emoji:'&#129361;',name:'Avo King'},
  {emoji:'&#127839;',name:'Braai Lord'},
  {emoji:'&#127828;',name:'Pizza Vibes'},
  {emoji:'&#127856;',name:'Sweet Tooth'},
  {emoji:'&#129382;',name:'Veg Head'},
  {emoji:'&#127871;',name:'Bento Box'},
  {emoji:'&#129360;',name:'Baker'},
  {emoji:'&#127857;',name:'Ramen God'},
];
let selectedAvatar=null;

function toggleAvatarPicker(){
  const wrap=document.getElementById('avatar-picker-wrap');
  if(!wrap) return;
  const open=wrap.style.display==='block';
  wrap.style.display=open?'none':'block';
  if(!open) renderAvatarGrid();
}

function renderAvatarGrid(){
  const grid=document.getElementById('avatar-grid');
  if(!grid) return;
  const currentAvatar=document.getElementById('profile-avatar')?.textContent||'';
  grid.innerHTML=AVATARS.map((av,i)=>`
    <div class="av-option${currentAvatar===av.emoji?' selected':''}" onclick="selectAvatar(${i})">
      <div class="av-emoji">${av.emoji}</div>
      <div class="av-name">${av.name}</div>
    </div>`).join('');
}

function selectAvatar(i){
  selectedAvatar=AVATARS[i].emoji;
  document.querySelectorAll('.av-option').forEach((el,idx)=>{
    el.classList.toggle('selected',idx===i);
  });
}

async function saveAvatar(){
  if(!selectedAvatar||!currentUser) return;
  const avatarEl=document.getElementById('profile-avatar');
  if(avatarEl) avatarEl.innerHTML=selectedAvatar;
  const homeAv=document.getElementById('home-avatar');
  if(homeAv) homeAv.innerHTML=selectedAvatar;
  // Save to profile
  await db.from('profiles').update({avatar_emoji:selectedAvatar}).eq('id',currentUser.id);
  toggleAvatarPicker();
  showToast('\u2713 Avatar saved');
}

// ══ PROFILE STATS ══
async function loadProfileStats(){
  if(!currentUser) return;
  const [{count:rxCount},{count:rcCount}]=await Promise.all([
    db.from('receipts').select('*',{count:'exact',head:true}).eq('user_id',currentUser.id),
    db.from('recipes').select('*',{count:'exact',head:true}).eq('user_id',currentUser.id),
  ]);
  const ss=(id,val)=>{const el=document.getElementById(id);if(el)el.textContent=val;};
  ss('profile-stat-receipts',rxCount||0);
  ss('profile-stat-recipes',rcCount||0);
  ss('profile-stat-budget',budget>0?'R'+Math.round(budget/1000)+'k':'R0');
  ss('setting-budget-sub',budget>0?'R'+budget.toLocaleString()+' / month':'Not set');
}

// ══ LIST HERO CARD ══
function renderListHero(){
  const el=document.getElementById('list-hero-card');
  if(!el) return;
  if(!shoppingItems||shoppingItems.length===0){ el.innerHTML=''; return; }
  const done=shoppingItems.filter(i=>i.is_checked).length;
  const pct=Math.round((done/shoppingItems.length)*100);
  const total=shoppingItems.reduce((s,i)=>s+(i.quantity||1)*(parseFloat(i.normal_price)||0),0);
  el.innerHTML=`<div class="list-hero">
    <div class="lh-label">Estimated total</div>
    <div class="lh-amount">${total>0?fmtR(total):shoppingItems.length+' items'}</div>
    <div class="lh-sub">${done} of ${shoppingItems.length} done</div>
    <div class="lh-prog-row"><span>${done} of ${shoppingItems.length} completed</span><span>${pct}%</span></div>
    <div class="lh-prog-bar"><div class="lh-prog-fill" style="width:${pct}%"></div></div>
  </div>`;
}

// ══ RECIPE IMPORT MODAL ══
function openRecipeImport(){
  const urlEl=document.getElementById('recipe-import-url');
  const errEl=document.getElementById('recipe-import-error');
  if(urlEl) urlEl.value='';
  if(errEl) errEl.textContent='';
  openModal('modal-recipe-import');
}

// ══ SCAN ITEM STATE ══
let scanItems=[];

// ══ PARSE OCR ITEMS ══
function parseItemsFromOCR(text){
  scanItems=[];
  const lines=text.split('\n').map(l=>l.trim()).filter(Boolean);
  // Match lines with a price pattern: "Item name   R12.99" or "Item name   12.99"
  const priceRe=/^(.+?)\s+[Rr]?\s*(\d+[\.,]\d{2})\s*$/;
  for(const line of lines){
    // Skip obvious header/footer lines
    const lower=line.toLowerCase();
    if(/total|subtotal|vat|tax|change|tender|card|cash|thank|receipt|invoice|balance|amount due/i.test(lower)) continue;
    if(line.length<3||line.length>80) continue;
    const m=line.match(priceRe);
    if(m){
      const name=m[1].trim();
      const price=m[2].replace(',','.');
      if(name.length>1&&parseFloat(price)>0&&parseFloat(price)<5000){
        scanItems.push({name,price,isSpecial:false,normalPrice:''});
      }
    }
  }
  renderScanItems();
}

// ══ RENDER SCAN ITEMS ══
function renderScanItems(){
  const listEl=document.getElementById('scan-item-list');
  if(!listEl) return;
  if(scanItems.length===0){
    listEl.innerHTML='<div style="font-size:12px;color:var(--muted);padding:8px 0">No items detected — tap + Add item to add manually</div>';
    return;
  }
  listEl.innerHTML=scanItems.map((item,i)=>`
    <div style="display:flex;gap:6px;align-items:center;padding:6px;background:#F8FAF9;border-radius:10px;border:1px solid var(--line-light)">
      <input style="flex:2;padding:6px 8px;border-radius:8px;border:1.5px solid var(--line);font-size:12px;font-family:var(--font);outline:none"
        value="${item.name}" onchange="scanItems[${i}].name=this.value" placeholder="Item name"/>
      <input style="width:70px;padding:6px 8px;border-radius:8px;border:1.5px solid var(--line);font-size:12px;font-family:var(--font);outline:none"
        value="${item.price}" onchange="scanItems[${i}].price=this.value" placeholder="Price"/>
      <button onclick="toggleScanSpecial(${i})" title="Mark as special price"
        style="padding:5px 8px;border-radius:8px;border:1.5px solid ${item.isSpecial?'var(--green-dark)':'var(--line)'};background:${item.isSpecial?'var(--green-pale)':'transparent'};font-size:13px;cursor:pointer">&#127991;&#65039;</button>
      ${item.isSpecial?`<input style="width:70px;padding:6px 8px;border-radius:8px;border:1.5px solid var(--green-dark);font-size:12px;font-family:var(--font);outline:none;background:var(--green-pale)"
        value="${item.normalPrice}" onchange="scanItems[${i}].normalPrice=this.value" placeholder="Normal R"/>`:'' }
      <button onclick="removeScanItem(${i})"
        style="background:transparent;border:none;cursor:pointer;color:var(--muted);font-size:16px;padding:2px">&#10005;</button>
    </div>`).join('');
}

function toggleScanSpecial(i){
  scanItems[i].isSpecial=!scanItems[i].isSpecial;
  if(!scanItems[i].isSpecial) scanItems[i].normalPrice='';
  renderScanItems();
}

function removeScanItem(i){
  scanItems.splice(i,1);
  renderScanItems();
}

function addScanItem(){
  scanItems.push({name:'',price:'',isSpecial:false,normalPrice:''});
  renderScanItems();
  // Focus last item name input
  setTimeout(()=>{
    const inputs=document.querySelectorAll('#scan-item-list input');
    if(inputs.length) inputs[inputs.length-2].focus();
  },100);
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

// ══ HOME MEALS STRIP ══
async function renderHomeMeals(){
  const el=document.getElementById('home-meals');
  if(!el||!currentUser) return;
  const now=new Date();
  const weekStart=new Date(now); weekStart.setDate(now.getDate()-((now.getDay()+6)%7)); weekStart.setHours(0,0,0,0);
  const {data:entries}=await db.from('meal_plan_entries').select('day_of_week,recipes(title,category)').eq('user_id',currentUser.id).eq('week_offset',0);
  const days=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const catBg={dinner:'var(--orange-pale)',baking:'var(--pink-pale)',lunch:'var(--blue-pale)',other:'var(--green-pale)'};
  const catTag={dinner:'Dinner',baking:'Baking',lunch:'Lunch',other:'Other'};
  const catCol={dinner:'#8B3A00',baking:'#8B0038',lunch:'var(--blue-dark)',other:'var(--green-deeper)'};
  // Show next 3 days
  const todayDow=(now.getDay()+6)%7;
  const upcoming=[0,1,2].map(offset=>(todayDow+offset)%7);
  el.innerHTML=upcoming.map(dow=>{
    const dayDate=new Date(weekStart); dayDate.setDate(weekStart.getDate()+dow);
    const dateStr=dayDate.toLocaleDateString('en-ZA',{day:'numeric',month:'short'});
    const entry=entries?.find(e=>e.day_of_week===dow);
    const isToday=dow===todayDow;
    if(entry?.recipes){
      const bg=catBg[entry.recipes.category]||catBg.other;
      const col=catCol[entry.recipes.category]||catCol.other;
      return `<div class="meal-strip-row">
        <span class="meal-day-label">${days[dow]}${isToday?' <span style="font-size:9px;background:var(--green-dark);color:#fff;padding:1px 6px;border-radius:10px;font-weight:800">Today</span>':''}</span>
        <div class="meal-icon-thumb" style="background:${bg}">&#127869;&#65039;</div>
        <span class="meal-name-text">${entry.recipes.title}</span>
        <span class="meal-cat-tag" style="background:${bg};color:${col}">${catTag[entry.recipes.category]||'Other'}</span>
      </div>`;
    } else {
      return `<div class="meal-strip-row empty" onclick="showScreen('plan')">
        <span class="meal-day-label">${days[dow]}${isToday?' <span style="font-size:9px;background:var(--green-dark);color:#fff;padding:1px 6px;border-radius:10px;font-weight:800">Today</span>':''}</span>
        <div class="meal-icon-thumb" style="background:rgba(168,217,200,.3)">&#43;</div>
        <span class="meal-name-text">Add dinner</span>
      </div>`;
    }
  }).join('');
}

// ══ HOME RECEIPTS ══
function renderHomeReceipts(){
  const el=document.getElementById('home-receipts');
  if(!el) return;
  const recent=receipts.slice(0,3);
  if(!recent.length){el.innerHTML='<div style="font-size:13px;color:var(--muted);padding:8px 0">No receipts yet — tap Scan to add your first</div>';return;}
  const initials={'woolworths':'WW','checkers':'CK','pnp':'PnP','spar':'SP','walmart':'WM','other':'?'};
  const colors={'woolworths':'var(--green-pale)','checkers':'var(--blue-pale)','pnp':'var(--orange-pale)','spar':'var(--green-pale)','walmart':'var(--blue-pale)','other':'var(--purple-pale)'};
  el.innerHTML=recent.map(r=>{
    const cfg=STORES[r.store_key]||STORES.other;
    const d=new Date(r.receipt_date).toLocaleDateString('en-ZA',{day:'numeric',month:'short'});
    const init=initials[r.store_key]||'?';
    const col=colors[r.store_key]||colors.other;
    return `<div class="receipt-strip-row">
      <div class="store-initials" style="background:${col}">${init}</div>
      <div style="flex:1;min-width:0">
        <div class="receipt-store-name">${cfg.label}</div>
        <div class="receipt-meta">${d} &middot; ${r.item_count||'?'} items</div>
      </div>
      <div class="receipt-amount">${fmtR(r.total||0)}</div>
    </div>`;
  }).join('');
}

