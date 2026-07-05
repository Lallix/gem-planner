// ══ SUPABASE ══
const SURL = 'https://mjaschvxhdupoemaezjt.supabase.co';
const SKEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qYXNjaHZ4aGR1cG9lbWFlemp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NjE1MDYsImV4cCI6MjA5NzUzNzUwNn0.mPAF1SmB2HimzFa58Zy3nt0ESAoE6TaOVU4YTwArobA';
const VISION_KEY = 'AIzaSyCDHQOKG3e87WQ0fveIKR-v2S_3_2IgUhI';
const db = supabase.createClient(SURL, SKEY);

// ══ STORE CONFIG ══
const STORES = {
  woolworths:{label:'Woolworths',brand:'#1A1A1A',bar:'#6CC2C0',logo:'logos/woolworths.png'},
  checkers:  {label:'Checkers',  brand:'#00B5AD',bar:'#FFB6C8',logo:'logos/checkers.png'},
  pnp:       {label:'Pick n Pay',brand:'#004F9F',bar:'#B8D8F0',logo:'logos/pnp.png'},
  spar:      {label:'Spar',      brand:'#007A3D',bar:'#C2DFC2',logo:'logos/spar.png'},
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
  const cfg=STORES[key]||STORES.other;
  const s=size+'px';
  if(!cfg.logo){
    return `<div style="background:${cfg.brand};width:${s};height:${s};border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:${Math.round(size*.4)}px;font-weight:800;color:white;flex-shrink:0">${cfg.label.charAt(0)}</div>`;
  }
  // Unique ID for each logo instance so onerror can target it
  const uid='sl'+Math.random().toString(36).slice(2,7);
  return `<div id="${uid}" style="width:${s};height:${s};border-radius:8px;background:#fff;flex-shrink:0;overflow:hidden;border:1px solid rgba(0,0,0,.1);display:flex;align-items:center;justify-content:center">
    <img src="${cfg.logo}" width="${size}" height="${size}"
      style="width:${s};height:${s};object-fit:contain;display:block"
      onerror="var p=document.getElementById('${uid}');if(p){p.style.background='${cfg.brand}';p.style.border='none';p.innerHTML='<span style=font-size:${Math.round(size*.4)}px;font-weight:800;color:white>${cfg.label.charAt(0)}</span>';}"
    />
  </div>`;
}


// ══ UNSPLASH IMAGE LOADER ══
const UNSPLASH_KEY='fnnAFjR1mriM9J8cN7zN8T4fCJ_6gL0TwrhGMGQ_haA';
const IMG_CACHE_KEY='gem_img_cache';

function getImgCache(){
  try{ return JSON.parse(localStorage.getItem(IMG_CACHE_KEY)||'{}'); }
  catch(e){ return {}; }
}
function setImgCache(cache){
  try{ localStorage.setItem(IMG_CACHE_KEY,JSON.stringify(cache)); }
  catch(e){}
}

async function fetchUnsplashUrl(query){
  const cache=getImgCache();
  const key=query.toLowerCase().trim();
  if(cache[key]) return cache[key];
  try{
    const res=await fetch(`https://api.unsplash.com/photos/random?query=${encodeURIComponent(key+' food')}&orientation=squarish&client_id=${UNSPLASH_KEY}`);
    if(!res.ok) return null;
    const data=await res.json();
    const url=data?.urls?.small||null;
    if(url){
      cache[key]=url;
      setImgCache(cache);
    }
    return url;
  }catch(e){ return null; }
}

// Load image into an element by ID — shows emoji fallback until loaded
async function loadUnsplashInto(elId, query, fallbackEmoji){
  const el=document.getElementById(elId);
  if(!el) return;
  const url=await fetchUnsplashUrl(query);
  if(!url) return;
  const img=new Image();
  img.onload=()=>{
    el.style.backgroundImage=`url(${url})`;
    el.style.backgroundSize='cover';
    el.style.backgroundPosition='center';
    el.style.fontSize='0'; // hide emoji once image loads
  };
  img.src=url;
}


// ══ SVG ITEM ILLUSTRATIONS ══
// Returns an inline SVG for common grocery items and categories
// Falls back to emoji if no match


// ══ ITEM EMOJI MAP — SA grocery focused ══
function getItemEmoji(name){
  const n=name.toLowerCase().trim();
  const map=[
    // Dairy
    ['full cream milk','🥛'],['low fat milk','🥛'],['skim milk','🥛'],['clover','🥛'],
    ['milk','🥛'],['butter','🧈'],['rama','🧈'],['margarine','🧈'],
    ['cheese','🧀'],['cheddar','🧀'],['gouda','🧀'],['cream cheese','🧀'],
    ['yoghurt','🫙'],['yogurt','🫙'],['amasi','🫙'],
    ['egg','🥚'],['eggs','🥚'],
    ['cream','🥛'],['sour cream','🥛'],
    // Meat & Fish
    ['chicken breast','🍗'],['chicken','🍗'],['drumstick','🍗'],
    ['beef','🥩'],['mince','🥩'],['steak','🥩'],['lamb','🥩'],['pork','🥩'],
    ['boerewors','🌭'],['wors','🌭'],['sausage','🌭'],
    ['bacon','🥓'],['ham','🥓'],
    ['fish','🐟'],['salmon','🐟'],['tuna','🐟'],['hake','🐟'],
    ['prawn','🦐'],['shrimp','🦐'],
    // Fruit
    ['apple','🍎'],['banana','🍌'],['orange','🍊'],['lemon','🍋'],
    ['grape','🍇'],['strawberry','🍓'],['watermelon','🍉'],
    ['mango','🥭'],['avocado','🥑'],['avo','🥑'],
    ['pear','🍐'],['peach','🍑'],['pineapple','🍍'],
    ['tomato','🍅'],['cherry','🍒'],
    // Vegetables
    ['potato','🥔'],['sweet potato','🍠'],['onion','🧅'],['garlic','🧄'],
    ['carrot','🥕'],['broccoli','🥦'],['spinach','🥬'],['lettuce','🥬'],
    ['cabbage','🥬'],['mushroom','🍄'],['corn','🌽'],['peas','🫛'],
    ['pepper','🌶️'],['capsicum','🫑'],['cucumber','🥒'],['courgette','🥒'],
    ['butternut','🎃'],['pumpkin','🎃'],['beetroot','🫚'],
    // Bakery
    ['bread','🍞'],['brown bread','🍞'],['white bread','🍞'],['albany','🍞'],
    ['toast','🍞'],['roll','🥐'],['croissant','🥐'],['bun','🥐'],
    ['pita','🫓'],['wrap','🫓'],['tortilla','🫓'],
    ['cake','🎂'],['muffin','🧁'],['cookie','🍪'],['biscuit','🍪'],
    ['cracker','🫙'],
    // Dry goods & pantry
    ['rice','🍚'],['pasta','🍝'],['spaghetti','🍝'],['noodle','🍜'],
    ['flour','🌾'],['sugar','🍬'],['brown sugar','🍬'],['salt','🧂'],
    ['oil','🫙'],['sunflower oil','🫙'],['olive oil','🫙'],
    ['sauce','🥫'],['all gold','🥫'],['koo','🥫'],['beans','🥫'],
    ['tomato sauce','🥫'],['tomato paste','🥫'],
    ['cereal','🥣'],['jungle oats','🥣'],['oats','🥣'],['cornflakes','🥣'],
    ['honey','🍯'],['jam','🍯'],['peanut butter','🥜'],
    ['chocolate','🍫'],['beacon','🍫'],['cadbury','🍫'],
    ['chips','🥔'],['simba','🥔'],['crisps','🥔'],
    ['popcorn','🍿'],
    // Drinks
    ['water','💧'],['still water','💧'],['sparkling water','💧'],
    ['juice','🧃'],['coke','🥤'],['cola','🥤'],['soda','🥤'],['cooldrink','🥤'],
    ['coffee','☕'],['nescafe','☕'],['ricoffy','☕'],
    ['tea','🍵'],['rooibos','🍵'],['lipton','🍵'],
    ['beer','🍺'],['wine','🍷'],['spirit','🥃'],
    ['milk shake','🥤'],['smoothie','🥤'],
    // Cleaning & household
    ['soap','🧼'],['sunlight','🧼'],['dishwash','🧼'],
    ['detergent','🧺'],['omo','🧺'],['surf','🧺'],['skip','🧺'],
    ['bleach','🧴'],['handy andy','🧴'],['toilet cleaner','🧴'],
    ['toilet paper','🧻'],['tissue','🧻'],['paper towel','🧻'],
    ['dishcloth','🧹'],['sponge','🧹'],
    // Personal care
    ['shampoo','🧴'],['conditioner','🧴'],['body wash','🧴'],
    ['deodorant','🧴'],['toothpaste','🪥'],['toothbrush','🪥'],
    ['lotion','🧴'],['sunscreen','🧴'],['exo','🧴'],
    ['pad','🩹'],['tampon','🩹'],['nappy','👶'],['diaper','👶'],
    // Baby
    ['baby food','👶'],['formula','👶'],['pampers','👶'],
    // Frozen
    ['ice cream','🍦'],['frozen','🧊'],['pizza','🍕'],
    ['frozen veg','🧊'],['chips frozen','🧊'],
  ];
  for(const [key,emoji] of map){
    if(n===key||n.includes(key)) return emoji;
  }
  return '🛒'; // default
}

// Category emoji for recipes
function getRecipeEmoji(category){
  const map={
    dinner:'🍽️',lunch:'🥗',baking:'🥐',breakfast:'☕',snack:'🍎',other:'🍴'
  };
  return map[category]||'🍽️';
}

// Category gradient for recipe cards
function getRecipeGradient(category){
  const map={
    dinner:'linear-gradient(135deg,#FFE4CC,#FFD0A8)',
    lunch:'linear-gradient(135deg,#D6EEFF,#BED8F8)',
    baking:'linear-gradient(135deg,#FFE0EE,#FFCCE4)',
    breakfast:'linear-gradient(135deg,#FFF5CC,#FFE8A0)',
    snack:'linear-gradient(135deg,#D4F5E9,#B8EDD5)',
    other:'linear-gradient(135deg,#E8DFFF,#D4C8FF)',
  };
  return map[category]||map.dinner;
}

// Item gradient based on category
function getItemGradient(category){
  const map={
    'Dairy':'linear-gradient(135deg,#D6EEFF,#BED8F8)',
    'Meat & Fish':'linear-gradient(135deg,#FFE0EE,#FFCCE4)',
    'Fruit & Veg':'linear-gradient(135deg,#D4F5E9,#B8EDD5)',
    'Dry Goods':'linear-gradient(135deg,#FFF5CC,#FFE8A0)',
    'Bakery':'linear-gradient(135deg,#FFE4CC,#FFD0A8)',
    'Frozen':'linear-gradient(135deg,#E8DFFF,#D4C8FF)',
    'Cleaning':'linear-gradient(135deg,#D4F5E9,#C0EDDF)',
    'Beverages':'linear-gradient(135deg,#D6EEFF,#C2E4FF)',
    'Snacks':'linear-gradient(135deg,#FFF5CC,#FFE8A0)',
    'meal_plan':'linear-gradient(135deg,#FFE4CC,#FFD0A8)',
    'misc':'linear-gradient(135deg,#F0F0F0,#E0E0E0)',
    'Other':'linear-gradient(135deg,#F0F0F0,#E0E0E0)',
  };
  return map[category]||map['Other'];
}

function getItemSVG(name, size=46){
  const n=name.toLowerCase().trim();
  const s=size;

  // ── Common items ──
  if(n.includes('milk')||n.includes('dairy'))
    return `<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="14" y="8" width="20" height="32" rx="5" fill="#EEF6FF" stroke="#3B9EFF" stroke-width="1.8"/>
      <rect x="18" y="4" width="12" height="7" rx="3" fill="#3B9EFF"/>
      <ellipse cx="24" cy="28" rx="7" ry="5" fill="#3B9EFF" opacity=".18"/>
      <text x="24" y="26" text-anchor="middle" font-size="9" fill="#3B9EFF" font-weight="700" font-family="DM Sans,sans-serif">MILK</text>
    </svg>`;

  if(n.includes('egg'))
    return `<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="24" cy="26" rx="10" ry="13" fill="#FFF5CC" stroke="#F5C400" stroke-width="1.8"/>
      <ellipse cx="24" cy="27" rx="5" ry="6" fill="#FFB347" opacity=".5"/>
    </svg>`;

  if(n.includes('bread')||n.includes('loaf'))
    return `<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="20" width="32" height="20" rx="6" fill="#FFE4CC" stroke="#FF8C42" stroke-width="1.8"/>
      <ellipse cx="24" cy="20" rx="16" ry="8" fill="#FFD0A8" stroke="#FF8C42" stroke-width="1.8"/>
      <line x1="16" y1="28" x2="32" y2="28" stroke="#FF8C42" stroke-width="1.2" stroke-dasharray="3 2" opacity=".5"/>
    </svg>`;

  if(n.includes('butter'))
    return `<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="18" width="28" height="16" rx="4" fill="#FFF5CC" stroke="#F5C400" stroke-width="1.8"/>
      <rect x="14" y="22" width="20" height="8" rx="2" fill="#F5C400" opacity=".3"/>
      <text x="24" y="28" text-anchor="middle" font-size="7" fill="#B8860B" font-weight="700" font-family="DM Sans,sans-serif">BUTTER</text>
    </svg>`;

  if(n.includes('cheese'))
    return `<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="8,36 40,36 32,14" fill="#FFF5CC" stroke="#F5C400" stroke-width="1.8"/>
      <circle cx="20" cy="28" r="2.5" fill="#F5C400" opacity=".6"/>
      <circle cx="28" cy="24" r="1.8" fill="#F5C400" opacity=".5"/>
      <circle cx="25" cy="31" r="2" fill="#F5C400" opacity=".4"/>
    </svg>`;

  if(n.includes('yoghurt')||n.includes('yogurt'))
    return `<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="13" y="14" width="22" height="26" rx="6" fill="#FFE0EE" stroke="#FF4F8B" stroke-width="1.8"/>
      <rect x="16" y="10" width="16" height="8" rx="3" fill="#FF4F8B" opacity=".5"/>
      <path d="M17 26 Q24 22 31 26" stroke="#FF4F8B" stroke-width="1.5" fill="none"/>
    </svg>`;

  if(n.includes('chicken')||n.includes('poultry'))
    return `<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="24" cy="28" rx="14" ry="10" fill="#FFE0EE" stroke="#FF4F8B" stroke-width="1.8"/>
      <ellipse cx="24" cy="18" rx="8" ry="7" fill="#FFE0EE" stroke="#FF4F8B" stroke-width="1.8"/>
      <circle cx="20" cy="16" r="1.5" fill="#FF4F8B" opacity=".6"/>
    </svg>`;

  if(n.includes('beef')||n.includes('mince')||n.includes('steak'))
    return `<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="24" cy="28" rx="14" ry="9" fill="#FFE0EE" stroke="#FF4F8B" stroke-width="1.8"/>
      <path d="M12 26 Q18 20 24 24 Q30 20 36 26" stroke="#FF4F8B" stroke-width="1.5" fill="none" opacity=".5"/>
    </svg>`;

  if(n.includes('tomato'))
    return `<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="24" cy="27" r="13" fill="#FFE0EE" stroke="#FF4F8B" stroke-width="1.8"/>
      <path d="M24 14 Q26 10 30 11" stroke="#D4F5E9" stroke-width="2" stroke-linecap="round"/>
      <path d="M24 14 Q22 10 18 11" stroke="#D4F5E9" stroke-width="2" stroke-linecap="round"/>
      <path d="M24 14 L24 17" stroke="#009A5C" stroke-width="2"/>
    </svg>`;

  if(n.includes('potato'))
    return `<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="24" cy="26" rx="13" ry="10" fill="#FFF5CC" stroke="#F5C400" stroke-width="1.8"/>
      <circle cx="18" cy="24" r="1.5" fill="#B8860B" opacity=".4"/>
      <circle cx="28" cy="22" r="1.5" fill="#B8860B" opacity=".4"/>
      <circle cx="23" cy="30" r="1.5" fill="#B8860B" opacity=".4"/>
    </svg>`;

  if(n.includes('onion'))
    return `<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="24" cy="28" rx="12" ry="10" fill="#E8DFFF" stroke="#8B5CF6" stroke-width="1.8"/>
      <path d="M20 18 Q24 10 28 18" stroke="#8B5CF6" stroke-width="1.5" fill="none"/>
      <path d="M24 28 Q28 22 32 26" stroke="#8B5CF6" stroke-width="1" fill="none" opacity=".4"/>
    </svg>`;

  if(n.includes('apple'))
    return `<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 26 Q12 14 24 14 Q36 14 36 26 Q36 38 24 38 Q12 38 12 26Z" fill="#FFE4CC" stroke="#FF8C42" stroke-width="1.8"/>
      <path d="M24 14 Q26 8 30 9" stroke="#009A5C" stroke-width="2" stroke-linecap="round"/>
      <path d="M24 14 L24 17" stroke="#009A5C" stroke-width="2"/>
    </svg>`;

  if(n.includes('banana'))
    return `<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 32 Q14 16 28 12 Q36 10 38 16 Q32 14 22 22 Q14 30 16 38 Q10 38 10 32Z" fill="#FFF5CC" stroke="#F5C400" stroke-width="1.8"/>
    </svg>`;

  if(n.includes('coffee'))
    return `<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="12" y="14" width="20" height="26" rx="5" fill="#FFE4CC" stroke="#FF8C42" stroke-width="1.8"/>
      <rect x="15" y="17" width="14" height="8" rx="2" fill="#FF8C42" opacity=".25"/>
      <text x="22" y="34" text-anchor="middle" font-size="7" fill="#8B3A00" font-weight="700" font-family="DM Sans,sans-serif">COFFEE</text>
      <path d="M32 22 Q38 22 38 28 Q38 32 32 32" stroke="#FF8C42" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    </svg>`;

  if(n.includes('tea'))
    return `<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="12" y="20" width="20" height="18" rx="5" fill="#D4F5E9" stroke="#009A5C" stroke-width="1.8"/>
      <path d="M32 24 Q38 24 38 30 Q38 34 32 34" stroke="#009A5C" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      <path d="M18 20 Q20 14 22 20" stroke="#009A5C" stroke-width="1.5" fill="none"/>
      <path d="M23 20 Q25 12 27 20" stroke="#009A5C" stroke-width="1.5" fill="none"/>
    </svg>`;

  if(n.includes('sugar'))
    return `<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="11" y="14" width="26" height="26" rx="5" fill="#FFF5CC" stroke="#F5C400" stroke-width="1.8"/>
      <text x="24" y="30" text-anchor="middle" font-size="8" fill="#B8860B" font-weight="700" font-family="DM Sans,sans-serif">SUGAR</text>
      <circle cx="18" cy="20" r="1.5" fill="#F5C400" opacity=".5"/>
      <circle cx="30" cy="22" r="1" fill="#F5C400" opacity=".4"/>
    </svg>`;

  if(n.includes('rice'))
    return `<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="11" y="12" width="26" height="28" rx="5" fill="#D4F5E9" stroke="#009A5C" stroke-width="1.8"/>
      <text x="24" y="29" text-anchor="middle" font-size="8" fill="#006B3C" font-weight="700" font-family="DM Sans,sans-serif">RICE</text>
      <ellipse cx="24" cy="20" rx="8" ry="3" fill="#009A5C" opacity=".15"/>
    </svg>`;

  if(n.includes('pasta')||n.includes('noodle')||n.includes('spaghetti'))
    return `<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 38 Q14 14 20 14 Q20 38 24 14 Q28 38 28 14 Q34 14 34 38" stroke="#FFE4CC" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M14 38 Q14 14 20 14 Q20 38 24 14 Q28 38 28 14 Q34 14 34 38" stroke="#FF8C42" stroke-width="1.5" fill="none" stroke-linecap="round"/>
    </svg>`;

  if(n.includes('oil')||n.includes('sunflower'))
    return `<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="16" y="10" width="16" height="30" rx="5" fill="#FFF5CC" stroke="#F5C400" stroke-width="1.8"/>
      <rect x="19" y="6" width="10" height="8" rx="3" fill="#F5C400" opacity=".5"/>
      <text x="24" y="30" text-anchor="middle" font-size="6" fill="#B8860B" font-weight="700" font-family="DM Sans,sans-serif">OIL</text>
    </svg>`;

  if(n.includes('soap')||n.includes('detergent')||n.includes('dishwash'))
    return `<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="14" y="14" width="20" height="26" rx="5" fill="#D4F5E9" stroke="#009A5C" stroke-width="1.8"/>
      <rect x="18" y="10" width="12" height="8" rx="3" fill="#009A5C" opacity=".5"/>
      <circle cx="22" cy="22" r="2" fill="#009A5C" opacity=".3"/>
      <circle cx="28" cy="26" r="1.5" fill="#009A5C" opacity=".3"/>
    </svg>`;

  if(n.includes('water')||n.includes('still water'))
    return `<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="17" y="8" width="14" height="32" rx="6" fill="#D6EEFF" stroke="#3B9EFF" stroke-width="1.8"/>
      <path d="M20 20 Q24 16 28 20 Q24 24 20 20Z" fill="#3B9EFF" opacity=".3"/>
    </svg>`;

  if(n.includes('juice'))
    return `<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="14" y="10" width="20" height="30" rx="5" fill="#FFE4CC" stroke="#FF8C42" stroke-width="1.8"/>
      <rect x="17" y="6" width="14" height="8" rx="3" fill="#FF8C42" opacity=".4"/>
      <ellipse cx="24" cy="28" rx="6" ry="5" fill="#FF8C42" opacity=".2"/>
    </svg>`;

  if(n.includes('flour'))
    return `<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="12" y="14" width="24" height="24" rx="5" fill="#FFF5CC" stroke="#F5C400" stroke-width="1.8"/>
      <text x="24" y="29" text-anchor="middle" font-size="7" fill="#B8860B" font-weight="700" font-family="DM Sans,sans-serif">FLOUR</text>
    </svg>`;

  if(n.includes('salt'))
    return `<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="16" y="12" width="16" height="26" rx="5" fill="#EEF6FF" stroke="#3B9EFF" stroke-width="1.8"/>
      <circle cx="22" cy="22" r="1.5" fill="#3B9EFF" opacity=".4"/>
      <circle cx="26" cy="26" r="1.5" fill="#3B9EFF" opacity=".4"/>
      <circle cx="22" cy="30" r="1.5" fill="#3B9EFF" opacity=".4"/>
    </svg>`;

  if(n.includes('pepper'))
    return `<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="16" y="12" width="16" height="26" rx="5" fill="#2C2C3E" stroke="#555" stroke-width="1.8" opacity=".85"/>
      <circle cx="22" cy="22" r="1.5" fill="#fff" opacity=".3"/>
      <circle cx="26" cy="28" r="1.5" fill="#fff" opacity=".3"/>
    </svg>`;

  if(n.includes('avocado')||n.includes('avo'))
    return `<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 8 Q36 16 36 28 Q36 40 24 40 Q12 40 12 28 Q12 16 24 8Z" fill="#D4F5E9" stroke="#009A5C" stroke-width="1.8"/>
      <ellipse cx="24" cy="30" rx="6" ry="7" fill="#FFE4CC" stroke="#FF8C42" stroke-width="1.2"/>
    </svg>`;

  if(n.includes('sauce')||n.includes('ketchup'))
    return `<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="15" y="16" width="18" height="22" rx="5" fill="#FFE0EE" stroke="#FF4F8B" stroke-width="1.8"/>
      <rect x="18" y="10" width="12" height="9" rx="3" fill="#FF4F8B" opacity=".4"/>
    </svg>`;

  if(n.includes('cereal')||n.includes('oat'))
    return `<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="11" y="10" width="26" height="30" rx="5" fill="#FFF5CC" stroke="#F5C400" stroke-width="1.8"/>
      <text x="24" y="28" text-anchor="middle" font-size="6.5" fill="#B8860B" font-weight="700" font-family="DM Sans,sans-serif">CEREAL</text>
    </svg>`;

  // ── Category fallbacks ──
  return getCatSVG(name, size);
}

function getCatSVG(cat, size=46){
  const s=size;
  const c=cat.toLowerCase();

  if(c.includes('dairy'))
    return `<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none"><rect x="14" y="8" width="20" height="32" rx="5" fill="#EEF6FF" stroke="#3B9EFF" stroke-width="1.8"/><rect x="18" y="4" width="12" height="7" rx="3" fill="#3B9EFF"/><text x="24" y="28" text-anchor="middle" font-size="8" fill="#3B9EFF" font-weight="700" font-family="DM Sans,sans-serif">DAIRY</text></svg>`;

  if(c.includes('meat')||c.includes('fish'))
    return `<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none"><ellipse cx="24" cy="26" rx="14" ry="10" fill="#FFE0EE" stroke="#FF4F8B" stroke-width="1.8"/><path d="M14 24 Q20 18 26 22 Q32 18 38 24" stroke="#FF4F8B" stroke-width="1.5" fill="none" opacity=".5"/></svg>`;

  if(c.includes('fruit')||c.includes('veg'))
    return `<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none"><circle cx="24" cy="27" r="13" fill="#D4F5E9" stroke="#009A5C" stroke-width="1.8"/><path d="M24 14 Q28 8 32 10" stroke="#009A5C" stroke-width="2" stroke-linecap="round"/><path d="M24 14 L24 18" stroke="#009A5C" stroke-width="2"/></svg>`;

  if(c.includes('dry')||c.includes('grain'))
    return `<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none"><rect x="11" y="12" width="26" height="28" rx="5" fill="#FFF5CC" stroke="#F5C400" stroke-width="1.8"/><text x="24" y="29" text-anchor="middle" font-size="8" fill="#B8860B" font-weight="700" font-family="DM Sans,sans-serif">DRY</text></svg>`;

  if(c.includes('bak'))
    return `<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none"><rect x="8" y="20" width="32" height="18" rx="6" fill="#FFE4CC" stroke="#FF8C42" stroke-width="1.8"/><ellipse cx="24" cy="20" rx="16" ry="7" fill="#FFD0A8" stroke="#FF8C42" stroke-width="1.8"/></svg>`;

  if(c.includes('frozen'))
    return `<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none"><path d="M24 8 L24 40M8 24 L40 24M13 13 L35 35M35 13 L13 35" stroke="#8B5CF6" stroke-width="2" stroke-linecap="round"/><circle cx="24" cy="24" r="5" fill="#E8DFFF" stroke="#8B5CF6" stroke-width="1.8"/></svg>`;

  if(c.includes('clean'))
    return `<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none"><rect x="15" y="14" width="18" height="24" rx="5" fill="#D4F5E9" stroke="#009A5C" stroke-width="1.8"/><rect x="19" y="10" width="10" height="7" rx="2" fill="#009A5C" opacity=".5"/><circle cx="20" cy="24" r="2" fill="#009A5C" opacity=".3"/><circle cx="28" cy="28" r="1.5" fill="#009A5C" opacity=".3"/></svg>`;

  if(c.includes('drink')||c.includes('bev'))
    return `<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none"><path d="M16 12 L18 38 Q18 40 24 40 Q30 40 30 38 L32 12Z" fill="#D6EEFF" stroke="#3B9EFF" stroke-width="1.8"/><path d="M16 18 L32 18" stroke="#3B9EFF" stroke-width="1.5" opacity=".4"/></svg>`;

  if(c.includes('snack'))
    return `<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none"><rect x="10" y="16" width="28" height="18" rx="6" fill="#FFE4CC" stroke="#FF8C42" stroke-width="1.8"/><circle cx="18" cy="25" r="2.5" fill="#FF8C42" opacity=".4"/><circle cx="24" cy="25" r="2.5" fill="#FF8C42" opacity=".4"/><circle cx="30" cy="25" r="2.5" fill="#FF8C42" opacity=".4"/></svg>`;

  // Default misc
  return `<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none"><rect x="12" y="12" width="24" height="24" rx="6" fill="#FFF5CC" stroke="#F5C400" stroke-width="1.8"/><circle cx="24" cy="24" r="6" fill="#F5C400" opacity=".2"/></svg>`;
}


// ══ CYCLE DATE HELPERS ══
function getCycleDates(startDay=1){
  const now=new Date();
  const today=now.getDate();
  let cycleStart=new Date(now.getFullYear(),now.getMonth(),startDay);
  // If today is before the start day, cycle started last month
  if(today<startDay){
    cycleStart=new Date(now.getFullYear(),now.getMonth()-1,startDay);
  }
  const cycleEnd=new Date(cycleStart);
  cycleEnd.setDate(cycleStart.getDate()+30);
  cycleEnd.setDate(cycleEnd.getDate()-1); // 30 days inclusive
  return {cycleStart,cycleEnd};
}

function formatCycleLabel(startDay=1){
  const {cycleStart,cycleEnd}=getCycleDates(startDay);
  const fmt=d=>d.toLocaleDateString('en-ZA',{day:'numeric',month:'short'});
  return fmt(cycleStart)+' — '+fmt(cycleEnd);
}

// ══ STATE ══
let currentUser=null, isAdmin=false, receipts=[], budget=0, cycleStartDay=1, allRecipes=[], shoppingItems=[], currentFilter='all';

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
  // Use requestAnimationFrame to wait for DOM paint, then load
  requestAnimationFrame(()=>{
    requestAnimationFrame(()=>{
      loadDashboard();
    });
  });
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
  try{
    const {data:pData}=await db.from('profiles').select('avatar_emoji,cycle_start_day').eq('id',user.id).single();
    if(pData?.avatar_emoji){
      const avEl=document.getElementById('profile-avatar');
      if(avEl) avEl.innerHTML=pData.avatar_emoji;
      const homeAv=document.getElementById('home-avatar');
      if(homeAv) homeAv.innerHTML=pData.avatar_emoji;
    }
    if(pData?.cycle_start_day) cycleStartDay=pData.cycle_start_day;
  }catch(e){ /* columns may not exist yet */ }
  loadProfileStats();
}

// ══ DASHBOARD ══
async function loadDashboard(){
  // Guard — if home screen not active yet, skip silently
  if(!document.getElementById('home-budget-spent')) return;
  const now=new Date();
  const monthKey=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const monthName=now.toLocaleString('default',{month:'long'});
  // Guard old elements that may not exist in new design
  const ss=(id,val)=>{const el=document.getElementById(id);if(el)el.textContent=val;};
  ss('hero-month',`${monthName} ${now.getFullYear()}`);
  ss('chart-month-label',monthName);
  const {data:bd}=await db.from('budgets').select('amount').eq('user_id',currentUser.id).eq('month',monthKey).single();
  budget=bd?.amount||0;
  // Use cycle dates — cycle may span two calendar months (e.g. 25 Jun - 24 Jul)
  const {cycleStart:cStart,cycleEnd:cEnd}=getCycleDates(cycleStartDay);
  const cycleStartStr=cStart.toISOString().split('T')[0];
  const cycleEndStr=cEnd.toISOString().split('T')[0];
  const {data:rx}=await db.from('receipts').select('*').eq('user_id',currentUser.id)
    .gte('receipt_date',cycleStartStr)
    .lte('receipt_date',cycleEndStr)
    .order('receipt_date',{ascending:false});
  receipts=rx||[];
  renderDashboard(now,monthName);
}

function fmt(n){ return Number(n).toLocaleString('en-ZA',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function fmtR(n){ return `R ${fmt(n)}`; }

function renderDashboard(now,monthName){
  // ── Cycle-aware budget calculation ──
  const {cycleStart,cycleEnd}=getCycleDates(cycleStartDay);
  const cycleReceipts=receipts.filter(r=>{
    const d=new Date(r.receipt_date);
    return d>=cycleStart&&d<=cycleEnd;
  });
  const totalSpent=cycleReceipts.reduce((s,r)=>s+(r.total||0),0);
  const pct=budget>0?Math.min(Math.round((totalSpent/budget)*100),100):0;
  const remaining=Math.max(0,budget-totalSpent);
  const ss=(id,val,prop='textContent')=>{const el=document.getElementById(id);if(el)el[prop]=val;};

  // ── Budget card ──
  ss('home-budget-month',formatCycleLabel(cycleStartDay));
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

  // ── Stats — cycle-aware ──
  const weekStart=new Date(now); weekStart.setDate(now.getDate()-((now.getDay()+6)%7));
  weekStart.setHours(0,0,0,0);
  const weekRx=cycleReceipts.filter(r=>new Date(r.receipt_date)>=weekStart);
  const weekTotal=weekRx.reduce((s,r)=>s+(r.total||0),0);
  const daysSinceCycleStart=Math.max(1,Math.floor((now-cycleStart)/(1000*60*60*24)));
  const weeksIn=Math.max(1,daysSinceCycleStart/7);
  const avgWeek=totalSpent/weeksIn;
  const daysLeft=Math.max(0,Math.floor((cycleEnd-now)/(1000*60*60*24)));
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
        <div style="display:flex;gap:4px;flex-shrink:0">
          <button onclick="openEditReceipt('${r.id}')"
            style="background:transparent;border:none;cursor:pointer;font-size:16px;color:var(--muted);padding:4px 6px"
            title="Edit receipt">✏️</button>
          <button onclick="confirmDeleteReceipt('${r.id}','${cfg.label}','${d}',${r.total||0})"
            style="background:transparent;border:none;cursor:pointer;font-size:18px;color:var(--muted);padding:4px 6px"
            title="Delete receipt">🗑</button>
        </div>
      </div>`;}).join('');
}


// ══ EDIT RECEIPT ══
let editingReceiptId=null;
let editingReceiptItems=[];

async function openEditReceipt(receiptId){
  editingReceiptId=receiptId;
  editingReceiptItems=[];
  const statusEl=document.getElementById('edit-receipt-status');
  if(statusEl) statusEl.textContent='Loading...';
  openModal('modal-edit-receipt');

  // Load receipt + items
  const {data:receipt}=await db.from('receipts').select('*').eq('id',receiptId).single();
  const {data:items}=await db.from('receipt_items').select('*').eq('receipt_id',receiptId).order('id');

  if(!receipt){ if(statusEl) statusEl.textContent='Error loading receipt'; return; }
  if(statusEl) statusEl.textContent='';

  // Populate fields
  const ss=(id,val,prop='value')=>{const el=document.getElementById(id);if(el)el[prop]=val;};
  ss('edit-receipt-store',receipt.store_key||'');
  ss('edit-receipt-date',receipt.receipt_date||'');
  ss('edit-receipt-total',receipt.total||'');

  // Populate items
  editingReceiptItems=(items||[]).map(i=>({
    id:i.id,name:i.name||'',price:i.price||'',isSpecial:i.is_special||false
  }));
  renderEditReceiptItems();
}

function renderEditReceiptItems(){
  const el=document.getElementById('edit-receipt-items');
  if(!el) return;
  el.innerHTML=editingReceiptItems.map((item,i)=>`
    <div style="display:flex;gap:6px;align-items:center;padding:6px;background:#F8FAF9;border-radius:10px;margin-bottom:6px">
      <input value="${item.name}" onchange="editingReceiptItems[${i}].name=this.value"
        style="flex:2;padding:7px 10px;border-radius:8px;border:1.5px solid var(--line);font-size:13px;font-family:var(--font);outline:none"/>
      <input value="${item.price}" onchange="editingReceiptItems[${i}].price=this.value"
        style="width:72px;padding:7px 8px;border-radius:8px;border:1.5px solid var(--line);font-size:13px;font-family:var(--font);outline:none"
        placeholder="Price"/>
      <button onclick="editingReceiptItems.splice(${i},1);renderEditReceiptItems()"
        style="background:transparent;border:none;cursor:pointer;color:var(--muted);font-size:16px;padding:2px 4px;flex-shrink:0">✕</button>
    </div>`).join('');
}

function addEditReceiptItem(){
  editingReceiptItems.push({id:null,name:'',price:'',isSpecial:false});
  renderEditReceiptItems();
  // Focus last name input
  setTimeout(()=>{
    const inputs=document.querySelectorAll('#edit-receipt-items input[type="text"], #edit-receipt-items input:not([type])');
    if(inputs.length) inputs[inputs.length-2]?.focus();
  },100);
}

async function saveEditReceipt(){
  if(!editingReceiptId||!currentUser) return;
  const statusEl=document.getElementById('edit-receipt-status');
  if(statusEl) statusEl.textContent='Saving...';

  const store=document.getElementById('edit-receipt-store')?.value||null;
  const date=document.getElementById('edit-receipt-date')?.value||null;
  const total=parseFloat(document.getElementById('edit-receipt-total')?.value||0);

  // Update receipt row
  const {error:rxErr}=await db.from('receipts').update({
    store_key:store||null,
    receipt_date:date,
    total:total||null,
    item_count:editingReceiptItems.length,
  }).eq('id',editingReceiptId).eq('user_id',currentUser.id);

  if(rxErr){ if(statusEl) statusEl.textContent='Error: '+rxErr.message; return; }

  // Delete existing items and re-insert
  await db.from('receipt_items').delete().eq('receipt_id',editingReceiptId);
  await db.from('price_history').delete().eq('receipt_id',editingReceiptId);

  const validItems=editingReceiptItems.filter(i=>i.name.trim()&&parseFloat(i.price)>0);
  if(validItems.length>0){
    await db.from('receipt_items').insert(validItems.map(i=>({
      receipt_id:editingReceiptId,
      user_id:currentUser.id,
      name:i.name.trim(),
      price:parseFloat(i.price),
      is_special:i.isSpecial||false,
    })));
    // Re-insert price history
    await db.from('price_history').insert(validItems.map(i=>({
      user_id:currentUser.id,
      receipt_id:editingReceiptId,
      item_name:i.name.trim(),
      store_key:store||null,
      price:parseFloat(i.price),
      is_special:i.isSpecial||false,
      recorded_at:date,
    })));
  }

  closeModal('modal-edit-receipt');
  editingReceiptId=null;
  editingReceiptItems=[];
  showToast('\u2713 Receipt updated');
  loadAllReceipts();
  // Refresh dashboard to recalculate cycle totals
  loadDashboard();
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

function filterRecipes(f){
  setFilterActive(f);
  currentFilter=f;
  // Reset archived state when switching to a non-archived filter
  if(f!=='archived'){
    showArchived=false;
    const archBtn=document.getElementById('filter-archived');
    if(archBtn){ archBtn.style.background=''; archBtn.style.color=''; }
  }
  renderRecipes();
}

function renderRecipes(){
  let list=allRecipes;
  if(currentFilter==='archived'){
    // Show ONLY archived
    list=list.filter(r=>r.visibility==='archived');
  } else {
    // Always exclude archived from other filters unless showArchived is on
    if(!showArchived) list=list.filter(r=>r.visibility!=='archived');
    if(currentFilter==='dinner') list=list.filter(r=>r.category==='dinner');
    else if(currentFilter==='baking') list=list.filter(r=>r.category==='baking');
    else if(currentFilter==='lunch') list=list.filter(r=>r.category==='lunch');
    else if(currentFilter==='shared') list=list.filter(r=>r.visibility==='everyone');
  }

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
      const recipeBg=getRecipeGradient(r.category);
      const recipeEmoji=getRecipeEmoji(r.category);
      const meta=[r.prep_time?`&#9201; ${r.prep_time}min prep`:'',r.cook_time?`&#128293; ${r.cook_time}min cook`:'',r.servings?`&#127869; Serves ${r.servings}`:''].filter(Boolean).join(' &middot; ');
      const sharedBadge=r.visibility==='everyone'?`<div class="recipe-shared-badge">Shared</div>`:'';
      const archivedBadge=r.visibility==='archived'?`<div class="recipe-shared-badge" style="color:var(--muted)">Archived</div>`:'';
      return `<div class="recipe-card" onclick="viewRecipe('${r.id}')">
        <div class="recipe-thumb" style="background:${recipeBg};display:flex;align-items:center;justify-content:center">
          <span style="font-size:64px;line-height:1;filter:drop-shadow(0 4px 8px rgba(0,0,0,.15))">${recipeEmoji}</span>
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
  // Emoji + gradient used — no Unsplash needed
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
    const emoji=getItemEmoji(item.name);
    const btnText=pal.btnText||'#fff';
    return `<div class="freq-tile" style="background:${pal.bg};box-shadow:0 4px 14px rgba(0,0,0,.1)">
      <div class="freq-thumb" style="font-size:32px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,.15))">${emoji}</div>
      <div class="freq-name">${item.name}</div>
      ${item.price?`<div class="freq-price">R${parseFloat(item.price).toFixed(2)}</div>`:'<div class="freq-price" style="opacity:0">—</div>'}
      <button class="freq-add-btn" style="background:${pal.btn};color:${btnText}"
        onclick="addFreqItemToList('${item.name.replace(/'/g,"\\'")}','${item.store_key||''}')">+</button>
    </div>`;
  }).join('');
  // SVG illustrations used — no Unsplash for freq tiles
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
  return getItemEmoji(name);
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

// ══ COLLAPSED STORE STATE ══
let collapsedStores=new Set();

function toggleStoreCollapse(sk){
  if(collapsedStores.has(sk)) collapsedStores.delete(sk);
  else collapsedStores.add(sk);
  renderShoppingList();
}

function renderShoppingList(){
  renderListHero();
  let items=shoppingItems;

  const listEl=document.getElementById('shopping-list-content');
  if(items.length===0){
    listEl.innerHTML=renderFrequentlyBought()+
      `<div class="empty-state">
        <div class="empty-state-icon">&#128722;</div>
        <div class="empty-title">List is empty</div>
        <div class="empty-sub">Tap + Add to get started</div>
      </div>`;
    return;
  }

  // Store order + config
  const STORE_ORDER=['woolworths','checkers','pnp','spar','walmart','other',''];
  const STORE_COLORS={
    woolworths:{bg:'#1A1A1A',text:'#fff',badge:'rgba(255,255,255,.12)'},
    checkers:  {bg:'#00B5AD',text:'#fff',badge:'rgba(255,255,255,.15)'},
    pnp:       {bg:'#004F9F',text:'#fff',badge:'rgba(255,255,255,.15)'},
    spar:      {bg:'#007A3D',text:'#fff',badge:'rgba(255,255,255,.15)'},
    walmart:   {bg:'#0071CE',text:'#fff',badge:'rgba(255,255,255,.15)'},
    other:     {bg:'#6B7280',text:'#fff',badge:'rgba(255,255,255,.12)'},
    '':        {bg:'#9CA3AF',text:'#fff',badge:'rgba(255,255,255,.12)'},
  };

  // Category dot colours
  const catDot={
    'Dairy':'#3B9EFF','Meat & Fish':'#FF4F8B','Fruit & Veg':'#00C67A',
    'Dry Goods':'#FF8C42','Bakery':'#FF8C42','Frozen':'#8B5CF6',
    'Cleaning':'#009A5C','Beverages':'#3B9EFF','Snacks':'#F5C400',
    'meal_plan':'#FF8C42','misc':'#9CA3AF','Other':'#9CA3AF',
  };

  // Build store groups
  const storeGroups={};
  items.forEach(item=>{
    const sk=item.store_key||'';
    if(!storeGroups[sk]) storeGroups[sk]=[];
    storeGroups[sk].push(item);
  });

  let html=renderFrequentlyBought();

  STORE_ORDER.forEach(sk=>{
    const storeItems=storeGroups[sk];
    if(!storeItems||!storeItems.length) return;
    const cfg=STORE_COLORS[sk]||STORE_COLORS[''];
    const storeCfg=STORES[sk]||STORES.other;
    const storeLabel=sk?storeCfg.label:'No store assigned';
    const doneCount=storeItems.filter(i=>i.is_checked).length;
    const total=storeItems.reduce((s,i)=>s+(i.quantity||1)*(parseFloat(i.normal_price)||0),0);
    const collapsed=collapsedStores.has(sk);

    // Store header
    html+=`<div style="margin:8px 16px 0">
      <div onclick="toggleStoreCollapse('${sk}')"
        style="display:flex;align-items:center;gap:10px;padding:12px 16px;
          background:${cfg.bg};border-radius:${collapsed?'14px':'14px 14px 0 0'};cursor:pointer;
          user-select:none">
        <div style="width:36px;height:36px;border-radius:9px;overflow:hidden;
          background:rgba(255,255,255,.15);display:flex;align-items:center;
          justify-content:center;flex-shrink:0">
          ${sk?storeLogo(sk,36):`<span style="font-size:18px">&#128230;</span>`}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:800;color:${cfg.text}">${storeLabel}</div>
          <div style="font-size:11px;color:rgba(255,255,255,.7);margin-top:1px">
            ${doneCount} of ${storeItems.length} done${total>0?' &middot; ~'+fmtR(total):''}
          </div>
        </div>
        <span style="color:rgba(255,255,255,.7);font-size:18px;transition:transform .2s;
          transform:rotate(${collapsed?'-90':'0'}deg)">&#8964;</span>
      </div>
    </div>`;

    if(collapsed) return;

    // Group by category within store
    const catGroups={};
    storeItems.forEach(item=>{
      const cat=item.category||'misc';
      if(!catGroups[cat]) catGroups[cat]=[];
      catGroups[cat].push(item);
    });

    html+=`<div style="margin:0 16px 16px;background:rgba(255,255,255,.85);
      border-radius:0 0 14px 14px;overflow:visible">`;

    Object.entries(catGroups).forEach(([cat,catItems])=>{
      const dot=catDot[cat]||'#9CA3AF';
      const catLabel=CATEGORY_LABELS[cat]||cat;
      // Category sub-header
      html+=`<div style="display:flex;align-items:center;gap:6px;padding:8px 14px 4px;
        background:rgba(0,0,0,.03)">
        <span style="width:7px;height:7px;border-radius:50%;background:${dot};
          display:inline-block;flex-shrink:0"></span>
        <span style="font-size:10px;font-weight:800;color:var(--muted);
          text-transform:uppercase;letter-spacing:.7px">${catLabel}</span>
      </div>`;

      catItems.forEach((item,idx)=>{
        const qty=item.quantity||1;
        const checked=item.is_checked;
        const isLast=idx===catItems.length-1;
        html+=`<div class="swipe-row" style="position:relative;overflow:hidden;
          border-bottom:${isLast?'none':'0.5px solid rgba(0,0,0,.06)'}">
          <!-- Red delete zone — revealed by swipe -->
          <div class="swipe-delete-btn"
            ontouchend="event.preventDefault();deleteListItem('${item.id}')"
            onclick="deleteListItem('${item.id}')"
            style="position:absolute;right:0;top:0;bottom:0;width:72px;
              background:#FF3B5C;color:#fff;border:none;cursor:pointer;
              display:flex;flex-direction:column;align-items:center;justify-content:center;
              gap:2px;opacity:0;pointer-events:none;transition:opacity .15s;font-family:var(--font);
              -webkit-tap-highlight-color:transparent;user-select:none">
            <span style="font-size:18px">&#128465;</span>
            <span style="font-size:10px;font-weight:700">Remove</span>
          </div>
          <!-- Row content — slides left on swipe -->
          <div class="swipe-row-inner" data-item-id="${item.id}"
            style="display:flex;align-items:center;gap:10px;
            padding:11px 14px;
            background:${checked?'rgba(0,0,0,.03)':'transparent'};
            opacity:${checked?'.5':'1'};transition:all .2s;
            transform:translateX(0);will-change:transform">
            <!-- Emoji icon -->
            <div style="width:36px;height:36px;border-radius:10px;
              background:rgba(0,0,0,.04);display:flex;align-items:center;
              justify-content:center;flex-shrink:0;font-size:22px;
              filter:drop-shadow(0 1px 2px rgba(0,0,0,.1))">
              ${getItemEmoji(item.name)}
            </div>
            <!-- Name + unit -->
            <div style="flex:1;min-width:0;cursor:pointer"
              onclick="toggleListItem('${item.id}','${!checked}')">
              <div style="font-size:14px;font-weight:600;color:var(--text);
                ${checked?'text-decoration:line-through;':''}
                white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${item.name}</div>
              ${item.amount?`<div style="font-size:11px;color:var(--muted);margin-top:1px">${item.amount}</div>`:''}
            </div>
            <!-- Edit store pencil -->
            <button onclick="openEditItemStore('${item.id}','${item.store_key||''}')"
              style="background:none;border:none;cursor:pointer;padding:4px;
                color:var(--muted);font-size:14px;flex-shrink:0">&#9998;&#65039;</button>
            <!-- Qty stepper -->
            <div style="display:flex;align-items:center;border-radius:8px;
              border:1.5px solid var(--line);overflow:hidden;background:#fff;
              flex-shrink:0" onclick="event.stopPropagation()">
              <button onclick="changeItemQty('${item.id}',${qty-1})"
                style="width:26px;height:26px;border:none;background:transparent;
                  font-size:16px;font-weight:800;cursor:pointer;color:var(--text)">&#8722;</button>
              <div style="width:22px;text-align:center;font-size:12px;
                font-weight:700;color:var(--text)">${qty}</div>
              <button onclick="changeItemQty('${item.id}',${qty+1})"
                style="width:26px;height:26px;border:none;background:transparent;
                  font-size:18px;font-weight:800;cursor:pointer;color:var(--green-dark)">+</button>
            </div>
            <!-- Tick circle -->
            <div onclick="toggleListItem('${item.id}','${!checked}')"
              style="width:26px;height:26px;border-radius:50%;flex-shrink:0;cursor:pointer;
                display:flex;align-items:center;justify-content:center;
                background:${checked?'var(--green-dark)':'#fff'};
                border:2px solid ${checked?'var(--green-dark)':'var(--line)'};
                transition:all .2s">
              ${checked?'<svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="white" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>':''}
            </div>
          </div>
        </div>`;
      });

      html+='';
    });

    html+='</div>';
  });

  listEl.innerHTML=html;
  setTimeout(()=>{ initSwipeToDelete(); initBulkSelect(); },50);
}


// ══ BULK EDIT — LONG PRESS SELECTION MODE ══
var bulkSelectMode=false;
var bulkSelected=new Set();
var longPressTimer=null;

function initBulkSelect(){
  document.querySelectorAll('.swipe-row').forEach(row=>{
    const inner=row.querySelector('.swipe-row-inner');
    if(!inner) return;
    const itemId=inner.getAttribute('data-item-id');
    if(!itemId) return;
    let startX=0,startY=0;
    inner.addEventListener('touchstart',e=>{
      startX=e.touches[0].clientX;
      startY=e.touches[0].clientY;
      longPressTimer=setTimeout(()=>{
        navigator.vibrate&&navigator.vibrate(40);
        enterBulkMode(itemId);
      },600);
    },{passive:true});
    inner.addEventListener('touchend',()=>clearTimeout(longPressTimer),{passive:true});
    inner.addEventListener('touchmove',e=>{
      const dx=Math.abs(e.touches[0].clientX-startX);
      const dy=Math.abs(e.touches[0].clientY-startY);
      if(dx>10||dy>10) clearTimeout(longPressTimer);
    },{passive:true});
  });
}

function enterBulkMode(itemId){
  bulkSelectMode=true;
  bulkSelected.clear();
  if(itemId) bulkSelected.add(itemId);
  renderShoppingList();
  showBulkBar();
}

function exitBulkMode(){
  bulkSelectMode=false;
  bulkSelected.clear();
  renderShoppingList();
  const bar=document.getElementById('bulk-action-bar');
  if(bar) bar.style.transform='translateY(100%)';
  const ss=document.getElementById('bulk-store-sheet');
  const bs=document.getElementById('bulk-basket-sheet');
  if(ss) ss.style.display='none';
  if(bs) bs.style.display='none';
}

function toggleBulkItem(id){
  if(!bulkSelectMode) return;
  if(bulkSelected.has(id)) bulkSelected.delete(id);
  else bulkSelected.add(id);
  renderShoppingList();
  updateBulkBar();
}

function showBulkBar(){
  const bar=document.getElementById('bulk-action-bar');
  if(bar){ bar.style.transform='translateY(0)'; updateBulkBar(); }
}

function updateBulkBar(){
  const el=document.getElementById('bulk-count');
  if(el) el.textContent=bulkSelected.size+' item'+(bulkSelected.size!==1?'s':'')+' selected';
}

async function bulkMoveStore(storeKey){
  if(!bulkSelected.size) return;
  const ids=[...bulkSelected];
  await db.from('shopping_list_items').update({store_key:storeKey||null}).in('id',ids);
  ids.forEach(id=>{const item=shoppingItems.find(i=>i.id===id);if(item)item.store_key=storeKey||null;});
  exitBulkMode();
  showToast('✓ '+ids.length+' items moved to '+(STORES[storeKey]?.label||'No store'));
}

async function bulkMoveBasket(basket){
  if(!bulkSelected.size) return;
  const ids=[...bulkSelected];
  const now=new Date();
  const weekStart=new Date(now); weekStart.setDate(now.getDate()-((now.getDay()+6)%7)); weekStart.setHours(0,0,0,0);
  if(basket==='next_week') weekStart.setDate(weekStart.getDate()+7);
  const ws=basket==='monthly'?'monthly':weekStart.toISOString().split('T')[0];
  await db.from('shopping_list_items').update({week_start:ws}).in('id',ids);
  ids.forEach(id=>{const item=shoppingItems.find(i=>i.id===id);if(item)item.week_start=ws;});
  exitBulkMode();
  showToast('✓ '+ids.length+' items moved to '+basket.replace('_',' '));
}

async function bulkDelete(){
  if(!bulkSelected.size) return;
  if(!confirm('Delete '+bulkSelected.size+' items?')) return;
  const ids=[...bulkSelected];
  await db.from('shopping_list_items').delete().in('id',ids);
  shoppingItems=shoppingItems.filter(i=>!ids.includes(i.id));
  exitBulkMode();
  showToast('✓ '+ids.length+' items removed');
}

// ══ CHANGE ITEM QUANTITY ══
async function changeItemQty(id,newQty){
  if(newQty<1){
    if(confirm('Remove this item from the list?')) await deleteListItem(id);
    return;
  }
  await db.from('shopping_list_items').update({quantity:newQty}).eq('id',id).eq('user_id',currentUser.id);
  const item=shoppingItems.find(i=>i.id===id);
  if(item){ item.quantity=newQty; renderShoppingList(); }
}

// ══ SWIPE TO DELETE ══
let activeSwipeRow=null;

function initSwipeToDelete(){
  document.querySelectorAll('.swipe-row').forEach(row=>{
    let startX=0,startY=0,currentX=0,swiping=false;
    const inner=row.querySelector('.swipe-row-inner');
    const del=row.querySelector('.swipe-delete-btn');
    if(!inner) return;

    row.addEventListener('touchstart',e=>{
      if(activeSwipeRow&&activeSwipeRow!==row) resetSwipe(activeSwipeRow);
      startX=e.touches[0].clientX;
      startY=e.touches[0].clientY;
      currentX=0; swiping=true;
    },{passive:true});

    row.addEventListener('touchmove',e=>{
      if(!swiping) return;
      const dx=e.touches[0].clientX-startX;
      const dy=e.touches[0].clientY-startY;
      // If moving more vertically than horizontally, treat as scroll
      if(Math.abs(dy)>Math.abs(dx)&&Math.abs(currentX)<5){ swiping=false; return; }
      if(dx>0&&currentX>=0) return; // block right swipe
      // Prevent page scroll while swiping
      e.preventDefault();
      currentX=Math.max(dx,-80);
      inner.style.transform=`translateX(${currentX}px)`;
      inner.style.transition='none';
      if(del) del.style.opacity=Math.min(1,Math.abs(currentX)/60)+'';
    },{passive:false});

    row.addEventListener('touchend',()=>{
      if(!swiping) return; swiping=false;
      if(currentX<-50){
        inner.style.transition='transform .2s';
        inner.style.transform='translateX(-72px)';
        if(del){del.style.opacity='1';del.style.pointerEvents='auto';}
        activeSwipeRow=row;
      } else {
        resetSwipe(row);
      }
    });
  });
}

function resetSwipe(row){
  const inner=row?.querySelector('.swipe-row-inner');
  const del=row?.querySelector('.swipe-delete-btn');
  if(inner){inner.style.transition='transform .2s';inner.style.transform='translateX(0)';}
  if(del){del.style.opacity='0';del.style.pointerEvents='none';}
  if(activeSwipeRow===row) activeSwipeRow=null;
}

// ══ EDIT ITEM STORE ══
let editStoreItemId=null;

function openEditItemStore(itemId, currentStore){
  editStoreItemId=itemId;
  // Highlight current store
  document.querySelectorAll('.store-pick-btn').forEach(b=>{
    b.classList.toggle('selected',b.dataset.store===currentStore);
  });
  openModal('modal-edit-store');
}

async function confirmEditStore(newStore){
  if(!editStoreItemId) return;
  await db.from('shopping_list_items')
    .update({store_key:newStore||null})
    .eq('id',editStoreItemId);
  const item=shoppingItems.find(i=>i.id===editStoreItemId);
  if(item) item.store_key=newStore||null;
  closeModal('modal-edit-store');
  editStoreItemId=null;
  renderShoppingList();
  showToast('\u2713 Store updated');
}


