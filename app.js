// ══ SUPABASE ══
const SURL = 'https://mjaschvxhdupoemaezjt.supabase.co';
const SKEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qYXNjaHZ4aGR1cG9lbWFlemp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NjE1MDYsImV4cCI6MjA5NzUzNzUwNn0.mPAF1SmB2HimzFa58Zy3nt0ESAoE6TaOVU4YTwArobA';
const VISION_KEY = 'AIzaSyCDHQOKG3e87WQ0fveIKR-v2S_3_2IgUhI'; // kept for fallback
const GEM_OCR_URL = SURL+'/functions/v1/gem-ocr';
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
  const fs=Math.round(size*.4)+'px';
  const fallback=`<div style="background:${cfg.brand};width:${s};height:${s};border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:${fs};font-weight:800;color:white;flex-shrink:0">${cfg.label.charAt(0)}</div>`;
  if(!cfg.logo) return fallback;
  // Outer div is the branded colour fallback
  // Image sits on top absolutely — when loaded it covers the letter
  return `<div style="position:relative;width:${s};height:${s};border-radius:8px;background:${cfg.brand};flex-shrink:0;overflow:hidden;display:flex;align-items:center;justify-content:center">
    <span style="font-size:${fs};font-weight:800;color:white;line-height:1">${cfg.label.charAt(0)}</span>
    <img src="${cfg.logo}" width="${size}" height="${size}"
      style="position:absolute;top:0;left:0;width:${s};height:${s};object-fit:contain;background:#fff"
      onerror="this.style.display='none'"
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


// ══ CLEAN NAME IN EDIT RECEIPT MODAL ══
async function cleanEditReceiptItemName(idx){
  const item=editingReceiptItems[idx];
  if(!item||!item.name.trim()) return;
  const btn=document.getElementById('clean-edit-btn-'+idx);
  if(btn){ btn.textContent='...'; btn.disabled=true; }
  try{
    const result=await callGemOCR({mode:'clean_one',name:item.name});
    if(result?.name){
      const oldName=item.name;
      const newName=result.name;
      editingReceiptItems[idx].name=newName;
      renderEditReceiptItems();
      showToast('\u2713 '+newName);
      // Propagate in background
      if(currentUser){
        db.from('price_history').update({item_name:newName}).eq('user_id',currentUser.id).eq('item_name',oldName).catch(()=>{});
        db.from('grocery_items').upsert({user_id:currentUser.id,name:newName,is_shared:false},{onConflict:'user_id,name',ignoreDuplicates:true}).catch(()=>{});
      }
    }
  }catch(e){
    showToast('Could not clean name');
  }finally{
    if(btn){ btn.textContent='\u2728'; btn.disabled=false; }
  }
}

function renderEditReceiptItems(){
  const el=document.getElementById('edit-receipt-items');
  if(!el) return;
  el.innerHTML=editingReceiptItems.map((item,i)=>`
    <div style="display:flex;flex-direction:column;gap:4px;padding:8px;background:#F8FAF9;border-radius:10px;margin-bottom:6px">
      <div style="display:flex;gap:6px;align-items:center">
        <input value="${item.name}" onchange="editingReceiptItems[${i}].name=this.value"
          style="flex:2;padding:7px 10px;border-radius:8px;border:1.5px solid var(--line);font-size:13px;font-family:var(--font);outline:none"/>
        <button id="clean-edit-btn-${i}" onclick="cleanEditReceiptItemName(${i})"
          title="Clean name with AI"
          style="flex-shrink:0;padding:6px 8px;border-radius:8px;background:var(--pink-pale);color:var(--pink);border:none;cursor:pointer;font-size:13px">&#10024;</button>
        <button onclick="editingReceiptItems.splice(${i},1);renderEditReceiptItems()"
          style="background:transparent;border:none;cursor:pointer;color:var(--muted);font-size:16px;padding:2px 4px;flex-shrink:0">&#10005;</button>
      </div>
      <div style="display:flex;gap:6px;align-items:center">
        <input value="${item.price}" onchange="editingReceiptItems[${i}].price=this.value"
          style="width:90px;padding:7px 8px;border-radius:8px;border:1.5px solid var(--line);font-size:13px;font-family:var(--font);outline:none"
          placeholder="Price R"/>
        ${item.isSpecial?`<span style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:8px;background:var(--green-pale);color:var(--green-dark)">&#127991; Special</span>`:''}
        ${item.normalPrice?`<span style="font-size:11px;color:var(--muted)">was R${item.normalPrice}</span>`:''}
      </div>
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
  // Save ingredients — parse "amount | name" format or plain name
  const ingLines=document.getElementById('recipe-ingredients').value.split('\n').filter(l=>l.trim());
  const {data:newR}=await db.from('recipes').select('id').eq('user_id',currentUser.id).order('created_at',{ascending:false}).limit(1).single();
  if(newR&&ingLines.length){
    await db.from('recipe_ingredients').insert(ingLines.map((l,i)=>{
      const parts=l.split('|').map(p=>p.trim());
      if(parts.length>=2){
        // "2 cups | flour" format from auto-split
        return {recipe_id:newR.id,amount:parts[0],name:parts[1],sort_order:i};
      }
      // Plain text — try to parse amount from start
      const {amount,name}=parseIngredient(l.trim());
      return {recipe_id:newR.id,amount:amount||null,name:name||l.trim(),sort_order:i};
    }));
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
            onclick="${bulkSelectMode?`toggleBulkItem('${item.id}')`:''}"
            style="display:flex;align-items:center;gap:10px;
            padding:11px 14px;
            background:${bulkSelectMode&&bulkSelected.has(item.id)?'var(--green-pale)':checked?'rgba(0,0,0,.03)':'transparent'};
            opacity:${!bulkSelectMode&&checked?'.5':'1'};transition:all .2s;
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


// ══ RECIPE CARD ACTION BUTTONS ══
function viewRecipeAndAddToList(recipeId){
  // Load recipe and open ingredient selector
  db.from('recipes').select('*,recipe_ingredients(*)').eq('id',recipeId).single().then(({data:recipe})=>{
    if(!recipe){ showToast('Recipe not found'); return; }
    openIngredientSelector([recipe]);
  });
}

function openPlanPickerFromRecipe(recipeId){
  const recipe=allRecipes.find(r=>r.id===recipeId);
  if(!recipe){ showToast('Recipe not found'); return; }
  // Store recipe for use after day is picked
  window._pendingPlanRecipe=recipe;
  // Show day picker modal
  renderDayPickerForRecipe(recipe);
  openModal('modal-plan-day-picker');
}

function renderDayPickerForRecipe(recipe){
  const el=document.getElementById('plan-day-picker-list');
  if(!el) return;
  const days=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const now=new Date();
  const thisMonday=new Date(now);
  thisMonday.setDate(now.getDate()-((now.getDay()+6)%7));
  thisMonday.setHours(0,0,0,0);
  const weekStart=new Date(thisMonday);
  weekStart.setDate(thisMonday.getDate()+(currentPlanWeekOffset*7));

  el.innerHTML=`<div style="font-size:13px;color:var(--muted);margin-bottom:12px">Adding: <strong>${recipe.title}</strong></div>`+
  days.map((day,i)=>{
    const date=new Date(weekStart); date.setDate(weekStart.getDate()+i);
    const dateStr=date.toLocaleDateString('en-ZA',{day:'numeric',month:'short'});
    const isToday=date.toDateString()===now.toDateString();
    return `<div onclick="confirmPlanFromRecipe(${i})"
      style="display:flex;align-items:center;justify-content:space-between;
        padding:12px 14px;border-radius:var(--r-md);margin-bottom:6px;cursor:pointer;
        background:${isToday?'var(--green-pale)':'var(--card)'};
        border:1.5px solid ${isToday?'var(--green-dark)':'var(--line)'}">
      <div style="font-size:14px;font-weight:700;color:var(--text)">${day}${isToday?' <span style="font-size:10px;background:var(--green-dark);color:#fff;padding:2px 7px;border-radius:10px;margin-left:4px">Today</span>':''}</div>
      <div style="font-size:12px;color:var(--muted)">${dateStr}</div>
    </div>`;
  }).join('');
}

async function confirmPlanFromRecipe(dayOfWeek){
  const recipe=window._pendingPlanRecipe;
  if(!recipe) return;
  addMealDay=dayOfWeek;
  addMealWeek=currentPlanWeekOffset||0;
  addMealType=recipe.category||'dinner';
  closeModal('modal-plan-day-picker');
  await confirmAddMealEntry(recipe.id, recipe.title, recipe.category);
  window._pendingPlanRecipe=null;
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
  const updates={store_key:newStore||null};
  // Also update basket if changed
  const basketSel=document.getElementById('edit-item-basket')?.value;
  if(basketSel){
    const now=new Date();
    const weekStart=new Date(now); weekStart.setDate(now.getDate()-((now.getDay()+6)%7)); weekStart.setHours(0,0,0,0);
    if(basketSel==='next_week') weekStart.setDate(weekStart.getDate()+7);
    updates.week_start=basketSel==='monthly'?'monthly':weekStart.toISOString().split('T')[0];
  }
  await db.from('shopping_list_items').update(updates).eq('id',editStoreItemId);
  const item=shoppingItems.find(i=>i.id===editStoreItemId);
  if(item){
    item.store_key=newStore||null;
    if(updates.week_start) item.week_start=updates.week_start;
  }
  closeModal('modal-edit-store');
  editStoreItemId=null;
  renderShoppingList();
  showToast('\u2713 Item updated');
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


// ══ BULK EDIT — LONG PRESS SELECTION MODE ══
let bulkSelectMode=false;
let bulkSelected=new Set();
let longPressTimer=null;

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
  ['bulk-store-sheet','bulk-basket-sheet'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.style.display='none';
  });
}

function toggleBulkSheet(id){
  const sheets=['bulk-store-sheet','bulk-basket-sheet'];
  sheets.forEach(sid=>{
    const el=document.getElementById(sid);
    if(!el) return;
    el.style.display=(sid===id&&el.style.display==='none')?'block':'none';
  });
}

function toggleBulkItem(id){
  if(!bulkSelectMode) return;
  if(bulkSelected.has(id)) bulkSelected.delete(id);
  else bulkSelected.add(id);
  // Update visual
  const row=document.querySelector(`[data-item-id="${id}"]`);
  if(row){
    const isSelected=bulkSelected.has(id);
    row.style.background=isSelected?'var(--green-pale)':'transparent';
  }
  updateBulkBar();
}

function showBulkBar(){
  const bar=document.getElementById('bulk-action-bar');
  if(bar){ bar.style.transform='translateY(0)'; updateBulkBar(); }
}

function updateBulkBar(){
  const countEl=document.getElementById('bulk-count');
  if(countEl) countEl.textContent=bulkSelected.size+' item'+(bulkSelected.size!==1?'s':'')+' selected';
}

async function bulkMoveStore(storeKey){
  if(!bulkSelected.size) return;
  const ids=[...bulkSelected];
  await db.from('shopping_list_items').update({store_key:storeKey||null}).in('id',ids);
  ids.forEach(id=>{const item=shoppingItems.find(i=>i.id===id);if(item)item.store_key=storeKey||null;});
  exitBulkMode();
  showToast('\u2713 '+ids.length+' items moved to '+(STORES[storeKey]?.label||'No store'));
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
  showToast('\u2713 '+ids.length+' items moved to '+basket.replace('_',' '));
}

async function bulkDelete(){
  if(!bulkSelected.size) return;
  if(!confirm('Delete '+bulkSelected.size+' items?')) return;
  const ids=[...bulkSelected];
  await db.from('shopping_list_items').delete().in('id',ids);
  shoppingItems=shoppingItems.filter(i=>!ids.includes(i.id));
  exitBulkMode();
  showToast('\u2713 '+ids.length+' items removed');
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
  document.querySelectorAll('[id^="qa-basket-"]').forEach(b=>b.classList.remove('filter-active','active'));
  const map={'this_week':'qa-basket-this','next_week':'qa-basket-next','monthly':'qa-basket-monthly'};
  const el=document.getElementById(map[basket]);
  if(el) el.classList.add('filter-active');
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
    el.style.background=selected?'var(--green-pale)':'var(--card)';
    el.style.borderColor=selected?'var(--green-dark)':'var(--line)';
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
        style="display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:10px;background:${sel?'var(--green-pale)':'var(--card)'};border:1px solid ${sel?'var(--green-dark)':'var(--line)'};margin-bottom:5px;cursor:pointer;transition:all .15s">
        <div style="width:22px;height:22px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;
          background:${sel?'var(--green-dark)':'transparent'};border:2px solid ${sel?'var(--green-dark)':'var(--line)'}">
          ${sel?'<svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="white" stroke-width="2.2" fill="none" stroke-linecap="round"/></svg>':''}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;color:var(--text)">${item.name}</div>
          ${item.unit?`<div style="font-size:10px;color:var(--muted)">${item.unit}</div>`:''}
        </div>
        ${item.normal_price?`<div style="font-size:11px;color:var(--muted)">R${parseFloat(item.normal_price).toFixed(2)}</div>`:''}
      </div>`;
    }).join('');
  });  // close forEach

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
    if(item) rows.push({user_id:currentUser.id,name:item.name,amount:item.unit||null,category:item.category||'misc',store_key:storeKey,week_start:ws,quantity:1});
  });
  // From manual additions
  quickAddManual.forEach(i=>{
    rows.push({user_id:currentUser.id,name:i.name,amount:i.amount||null,category:i.category,store_key:storeKey,week_start:ws,quantity:1});
  });

  // Check for duplicates — if item already exists in this basket, increment qty instead
  let added=0; let incremented=0;
  for(const row of rows){
    const existing=shoppingItems.find(i=>
      i.name.toLowerCase().trim()===row.name.toLowerCase().trim()&&
      i.week_start===row.week_start
    );
    if(existing){
      const newQty=(existing.quantity||1)+1;
      await db.from('shopping_list_items').update({quantity:newQty}).eq('id',existing.id);
      existing.quantity=newQty;
      incremented++;
    } else {
      await db.from('shopping_list_items').insert(row);
      added++;
    }
  }

  closeModal('modal-add-list-item');
  quickAddSelected=new Set();
  quickAddManual=[];
  const msg=[];
  if(added) msg.push(added+' added');
  if(incremented) msg.push(incremented+' qty updated');
  showToast('\u2713 '+msg.join(', '));
  loadShoppingList();
}

async function saveListItem(){ await saveAllQuickItems(); }

// openAddListItem already defined above — grocery items loaded on demand inside it



// generateShoppingList — see new async version above

// ══ MEAL PLAN ══
let currentPlanWeekOffset=0;


// ══ MEAL PLANNER — ADD MEAL FLOW ══
let addMealDay=null;
let addMealWeek=null;
let addMealType=null;

function openAddMealForDay(dayOfWeek, weekOffset){
  addMealDay=dayOfWeek;
  addMealWeek=weekOffset;
  addMealType=null;
  // Reset modal state
  document.getElementById('add-meal-type-step').classList.remove('hidden');
  document.getElementById('add-meal-recipe-step').classList.add('hidden');
  document.getElementById('add-meal-other-wrap').classList.add('hidden');
  document.getElementById('add-meal-other-input').value='';
  document.querySelectorAll('.meal-type-btn').forEach(b=>b.classList.remove('selected'));
  openModal('modal-add-meal');
}

function selectMealType(type){
  addMealType=type;
  document.querySelectorAll('.meal-type-btn').forEach(b=>b.classList.remove('selected'));
  const btn=document.getElementById('meal-type-btn-'+type);
  if(btn) btn.classList.add('selected');
  // Show other input if 'other' selected
  const otherWrap=document.getElementById('add-meal-other-wrap');
  if(type==='other'){
    otherWrap.classList.remove('hidden');
    document.getElementById('add-meal-other-input').focus();
  } else {
    otherWrap.classList.add('hidden');
  }
}

function goToMealRecipePicker(){
  if(!addMealType){ showToast('Please select a meal type first'); return; }
  // "Other" with free text — save directly, no recipe needed
  if(addMealType==='other'){
    const custom=document.getElementById('add-meal-other-input').value.trim();
    if(!custom){ showToast('Please enter a meal type'); return; }
    addMealType=custom;
    // Save directly without recipe
    confirmAddMealEntry(null, custom, 'other');
    return;
  }
  // All other types go to recipe picker
  document.getElementById('add-meal-type-step').classList.add('hidden');
  document.getElementById('add-meal-recipe-step').classList.remove('hidden');
  renderAddMealRecipePicker();
}

function renderAddMealRecipePicker(){
  const list=allRecipes.filter(r=>r.visibility!=='archived');
  const el=document.getElementById('add-meal-recipe-list');
  if(!el) return;
  const catBg={dinner:'var(--orange-pale)',baking:'var(--pink-pale)',lunch:'var(--blue-pale)',other:'var(--green-pale)',breakfast:'var(--yellow-pale)',snack:'var(--green-pale)'};
  const catCol={dinner:'#8B3A00',baking:'#8B0038',lunch:'var(--blue-dark)',other:'var(--green-deeper)',breakfast:'#8B6B00',snack:'var(--green-deeper)'};
  const addNewBtn=`<div onclick="closeModal('modal-add-meal');setTimeout(()=>{showScreen('recipes');openAddRecipe();},300)"
    style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:var(--pink-pale);
      border-radius:var(--r-md);margin-top:8px;cursor:pointer;border:2px dashed var(--pink)">
    <span style="font-size:24px">➕</span>
    <div>
      <div style="font-size:14px;font-weight:700;color:var(--pink)">Add a new recipe</div>
      <div style="font-size:11px;color:var(--muted)">Opens the Recipes tab</div>
    </div>
  </div>`;
  el.innerHTML=(list.length===0
    ?'<div style="text-align:center;padding:20px;color:var(--muted)">No recipes yet — tap below to add one</div>'
    :list.map(r=>{
      const bg=catBg[r.category]||catBg.other;
      const col=catCol[r.category]||catCol.other;
      return `<div onclick="confirmAddMealEntry('${r.id}','${r.title.replace(/'/g,"\\'")}','${r.category}')"
        style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:var(--white);border-radius:var(--r-md);margin-bottom:6px;cursor:pointer;border:1.5px solid var(--line-light)">
        <span style="font-size:24px">${r.category==='baking'?'&#129360;':r.category==='lunch'?'&#129365;':'&#127869;&#65039;'}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:700;color:var(--text)">${r.title}</div>
          <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:8px;background:${bg};color:${col}">${r.category}</span>
        </div>
      </div>`;
    }).join(''))+addNewBtn;
}

async function confirmAddMealEntry(recipeId, recipeTitle, recipeCategory){
  if(!currentUser||addMealDay===null) return;
  // Ensure meal_plans row exists for this week
  const now=new Date();
  const thisMonday=new Date(now);
  thisMonday.setDate(now.getDate()-((now.getDay()+6)%7));
  thisMonday.setHours(0,0,0,0);
  const weekStart=new Date(thisMonday);
  weekStart.setDate(thisMonday.getDate()+(addMealWeek*7));
  const ws=weekStart.toISOString().split('T')[0];

  // Get or create meal plan for this week
  let planId=null;
  const {data:existing}=await db.from('meal_plans').select('id').eq('user_id',currentUser.id).eq('week_start',ws).limit(1);
  if(existing&&existing.length>0){
    planId=existing[0].id;
  } else {
    const {data:newPlan}=await db.from('meal_plans').insert({user_id:currentUser.id,week_start:ws}).select('id').single();
    planId=newPlan?.id;
  }
  if(!planId){ showToast('Error creating meal plan'); return; }

  // Insert meal entry — allow multiple per day (recipe_id may be null for free-text meals)
  const {error}=await db.from('meal_plan_entries').insert({
    user_id:currentUser.id,
    plan_id:planId,
    week_offset:addMealWeek,
    day_of_week:addMealDay,
    meal_type:addMealType||'dinner',
    recipe_id:recipeId||null,
  });

  if(error){ console.error(error); showToast('Error saving meal'); return; }
  closeModal('modal-add-meal');
  showToast('\u2713 '+(recipeTitle||addMealType)+' added to plan');
  loadMealPlan();
}

// ══ ADD RECIPE TO LIST FROM PLAN (single meal) ══
async function addRecipeToListFromPlan(recipeId, recipeTitle){
  if(!recipeId) return;
  // Set up ingredient selector for this recipe
  const {data:recipe}=await db.from('recipes').select('*,recipe_ingredients(*)').eq('id',recipeId).single();
  if(!recipe){ showToast('Recipe not found'); return; }
  openIngredientSelector([recipe]);
}

// ══ GENERATE SHOPPING LIST FROM FULL WEEK ══
async function generateShoppingList(){
  if(!currentUser) return;
  // Load all entries for current week
  const {data:entries}=await db.from('meal_plan_entries')
    .select('recipe_id,recipes(title,recipe_ingredients(name,amount,unit))')
    .eq('user_id',currentUser.id)
    .eq('week_offset',currentPlanWeekOffset);

  if(!entries||entries.length===0){
    showToast('No meals planned for this week');
    return;
  }

  // Collect all recipes
  const recipes=entries.map(e=>e.recipes).filter(Boolean);
  if(recipes.length===0){ showToast('No recipe details found'); return; }
  openIngredientSelector(recipes);
}

// ══ INGREDIENT SELECTOR MODAL ══
let ingredientSelectorItems=[];

function openIngredientSelector(recipes){
  // Collect + deduplicate ingredients across all recipes
  const allIngredients=[];
  const seen=new Set();
  recipes.forEach(recipe=>{
    (recipe.recipe_ingredients||[]).forEach(ing=>{
      const key=ing.name.toLowerCase().trim();
      if(!seen.has(key)){
        seen.add(key);
        allIngredients.push({name:ing.name,amount:ing.amount||'',unit:ing.unit||'',selected:true});
      }
    });
  });

  if(allIngredients.length===0){
    showToast('No ingredients found — add ingredients to your recipes first');
    return;
  }

  ingredientSelectorItems=allIngredients;
  renderIngredientSelector();
  openModal('modal-ingredient-selector');
}

function renderIngredientSelector(){
  const el=document.getElementById('ingredient-selector-list');
  if(!el) return;
  el.innerHTML=ingredientSelectorItems.map((item,i)=>`
    <div onclick="toggleIngredient(${i})"
      style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:var(--r-md);cursor:pointer;margin-bottom:6px;
        background:${item.selected?'var(--green-pale)':'#F5F5F5'};transition:background .2s">
      <div style="width:26px;height:26px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;
        background:${item.selected?'var(--green-dark)':'#E0E0E0'};border:2.5px solid ${item.selected?'var(--green-dark)':'#CCC'};transition:all .2s">
        ${item.selected?'<svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>':''}
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:14px;font-weight:700;color:${item.selected?'var(--text)':'var(--muted)'}">${item.name}</div>
        ${item.amount||item.unit?`<div style="font-size:11px;color:var(--muted)">${[item.amount,item.unit].filter(Boolean).join(' ')}</div>`:''}
      </div>
    </div>`).join('');

  // Update button count
  const count=ingredientSelectorItems.filter(i=>i.selected).length;
  const btn=document.getElementById('ingredient-add-btn');
  if(btn) btn.textContent=`Add ${count} item${count!==1?'s':''} to list`;
}

function toggleIngredient(i){
  ingredientSelectorItems[i].selected=!ingredientSelectorItems[i].selected;
  renderIngredientSelector();
}

// ══ INGREDIENT SELECTOR BASKET TOGGLE ══
let ingBasket='this_week';
function setIngBasket(b){
  ingBasket=b;
  const map={'this_week':'ing-tab-this','next_week':'ing-tab-next','monthly':'ing-tab-monthly'};
  document.querySelectorAll('[id^="ing-tab-"]').forEach(t=>t.classList.remove('active'));
  const activeEl=document.getElementById(map[b]);
  if(activeEl) activeEl.classList.add('active');
}
async function saveIngredientSelection(){
  const selected=ingredientSelectorItems.filter(i=>i.selected);
  if(!selected.length){ showToast('Nothing selected'); return; }
  if(!currentUser) return;

  // Get basket week_start from ingredient selector's own basket choice
  const basket=typeof ingBasket!=='undefined'?ingBasket:currentListBasket;
  const now=new Date();
  const weekStart=new Date(now); weekStart.setDate(now.getDate()-((now.getDay()+6)%7)); weekStart.setHours(0,0,0,0);
  if(basket==='next_week') weekStart.setDate(weekStart.getDate()+7);
  const ws=basket==='monthly'?'monthly':weekStart.toISOString().split('T')[0];

  const ingStore=document.getElementById('ing-store-select')?.value||null;
  const rows=selected.map(item=>({
    user_id:currentUser.id,
    name:item.name,
    amount:item.amount||null,
    category:'misc',
    store_key:ingStore,
    week_start:ws,
    quantity:1,
    is_checked:false,
  }));

  const {error}=await db.from('shopping_list_items').insert(rows);
  if(error){ console.error(error); showToast('Error adding items'); return; }
  closeModal('modal-ingredient-selector');
  showToast('\u2713 '+selected.length+' item'+( selected.length!==1?'s':'')+' added to list');
  showScreen('list');
}

function switchPlanWeek(offset){
  currentPlanWeekOffset=offset;
  document.querySelectorAll('.week-tab').forEach(t=>t.classList.remove('active'));
  const activeTab=offset===0?'plan-tab-this':'plan-tab-next';
  const el=document.getElementById(activeTab);
  if(el) el.classList.add('active');
  loadMealPlan();
}

async function loadMealPlan(){
  const now=new Date();
  const thisMonday=new Date(now);
  thisMonday.setDate(now.getDate()-((now.getDay()+6)%7));
  thisMonday.setHours(0,0,0,0);
  const weekStart=new Date(thisMonday);
  weekStart.setDate(thisMonday.getDate()+(currentPlanWeekOffset*7));
  const weekEnd=new Date(weekStart); weekEnd.setDate(weekStart.getDate()+6);
  const startStr=weekStart.toLocaleDateString('en-ZA',{day:'numeric',month:'short'});
  const endStr=weekEnd.toLocaleDateString('en-ZA',{day:'numeric',month:'short'});
  const labelEl=document.getElementById('plan-week-label');
  if(labelEl) labelEl.textContent=`${startStr} — ${endStr}`;

  const ws=weekStart.toISOString().split('T')[0];

  // Load entries directly using week_offset column (no join through meal_plans)
  const {data:entries}=await db.from('meal_plan_entries')
    .select('*,recipes(id,title,category,prep_time,cook_time)')
    .eq('user_id',currentUser.id)
    .eq('week_offset',currentPlanWeekOffset)
    .order('day_of_week');

  const allEntries=entries||[];

  // Week summary
  const mealCounts={};
  allEntries.forEach(e=>{
    const t=e.meal_type||'dinner';
    mealCounts[t]=(mealCounts[t]||0)+1;
  });
  const summaryEl=document.getElementById('week-summary-label');
  if(summaryEl) summaryEl.textContent=`${allEntries.length} of 7 days have meals`;
  const pillsEl=document.getElementById('week-summary-pills');
  if(pillsEl){
    const mealColors={dinner:'var(--orange-pale)',lunch:'var(--blue-pale)',baking:'var(--pink-pale)',breakfast:'var(--yellow-pale)',snack:'var(--green-pale)',other:'var(--purple-pale)'};
    const mealText={dinner:'#8B3A00',lunch:'var(--blue-dark)',baking:'#8B0038',breakfast:'#8B6B00',snack:'var(--green-deeper)',other:'var(--purple)'};
    pillsEl.innerHTML=Object.entries(mealCounts).map(([t,n])=>
      `<span style="font-size:11px;font-weight:700;padding:4px 10px;border-radius:10px;background:${mealColors[t]||'var(--purple-pale)'};color:${mealText[t]||'var(--purple)'}">${n} ${t.charAt(0).toUpperCase()+t.slice(1)}</span>`
    ).join('');
  }

  const days=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const today=new Date(); today.setHours(0,0,0,0);
  const mealEmoji={dinner:'&#127869;&#65039;',lunch:'&#129365;',baking:'&#129360;',breakfast:'&#9749;',snack:'&#127822;',other:'&#127869;&#65039;'};
  const mealBg={dinner:'var(--orange-pale)',lunch:'var(--blue-pale)',baking:'var(--pink-pale)',breakfast:'var(--yellow-pale)',snack:'var(--green-pale)',other:'var(--purple-pale)'};
  const mealCol={dinner:'#8B3A00',lunch:'var(--blue-dark)',baking:'#8B0038',breakfast:'#8B6B00',snack:'var(--green-deeper)',other:'var(--purple)'};

  document.getElementById('plan-grid').innerHTML=days.map((day,i)=>{
    const date=new Date(weekStart); date.setDate(weekStart.getDate()+i);
    const dateStr=date.toLocaleDateString('en-ZA',{day:'numeric',month:'short'});
    const isToday=date.getTime()===today.getTime();
    const isPast=date<today;
    const dayEntries=allEntries.filter(e=>e.day_of_week===i);

    const mealsHtml=dayEntries.map(e=>{
      const mt=e.meal_type||'dinner';
      const bg=mealBg[mt]||mealBg.other;
      const col=mealCol[mt]||mealCol.other;
      const emoji=mealEmoji[mt]||mealEmoji.other;
      return `<div class="plan-slot plan-slot-filled" style="border-top:.5px solid var(--line-light)">
        <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0">
          <span style="font-size:18px">${emoji}</span>
          <div style="flex:1;min-width:0">
            <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:${col}">${mt}</div>
            <div style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text)">${e.recipes?.title||'Unknown recipe'}</div>
          </div>
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0">
          ${e.recipe_id?`<button onclick="addRecipeToListFromPlan('${e.recipe_id}','${e.recipes?.title||''}')" 
            style="font-size:10px;font-weight:700;padding:4px 8px;border-radius:8px;background:${bg};color:${col};border:none;cursor:pointer">+ List</button>`:''}
          <button onclick="removeMealEntry('${e.id}')" 
            style="background:transparent;border:none;cursor:pointer;color:var(--muted);font-size:16px;padding:2px 4px;flex-shrink:0">&#10005;</button>
        </div>
      </div>`;
    }).join('');

    return `<div class="plan-day-card${isToday?' today':''}${isPast?' past':''}">
      <div class="plan-day-hdr${isToday?' today-hdr':''}">
        <div class="plan-day-name">${day}${isToday?` <span class="today-badge">Today</span>`:''}${isPast?` <span class="past-label">passed</span>`:''}</div>
        <div class="plan-day-date">${dateStr}</div>
      </div>
      <div style="height:6px"></div>
      ${mealsHtml}
      <div onclick="openAddMealForDay(${i},${currentPlanWeekOffset})"
        style="display:flex;align-items:center;gap:10px;padding:10px 14px;
          cursor:pointer;border-top:.5px dashed rgba(0,0,0,.08);
          background:rgba(255,255,255,.3);border-radius:0 0 var(--r-lg) var(--r-lg)">
        <div style="width:30px;height:30px;border-radius:50%;background:var(--pink);
          display:flex;align-items:center;justify-content:center;flex-shrink:0;
          box-shadow:0 2px 6px rgba(255,79,139,.35)">
          <span style="font-size:18px;color:#fff;line-height:1">+</span>
        </div>
        <span style="font-size:13px;color:var(--muted);font-weight:600">Add meal</span>
      </div>
    </div>`;
  }).join('');
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

// ══ CYCLE DAY PICKER ══
function selectCycleDay(day){
  document.querySelectorAll('.cycle-day-btn').forEach(b=>{
    const active=parseInt(b.dataset.day)===day;
    b.classList.toggle('active',active);
    b.style.background=active?'var(--green-dark)':'#fff';
    b.style.color=active?'#fff':'var(--text)';
    b.style.borderColor=active?'var(--green-dark)':'var(--line)';
  });
  // Update preview label
  const now=new Date();
  const today=now.getDate();
  let cycleStart=new Date(now.getFullYear(),now.getMonth(),day);
  if(today<day) cycleStart=new Date(now.getFullYear(),now.getMonth()-1,day);
  const cycleEnd=new Date(cycleStart);
  cycleEnd.setDate(cycleStart.getDate()+29);
  const fmt=d=>d.toLocaleDateString('en-ZA',{day:'numeric',month:'short'});
  const preview=document.getElementById('cycle-preview');
  if(preview) preview.textContent=`Your cycle: ${fmt(cycleStart)} — ${fmt(cycleEnd)}`;
}

function openBudgetModal(){
  document.getElementById('budget-input').value=budget||'';
  // Highlight current cycle start day in picker
  document.querySelectorAll('.cycle-day-btn').forEach(b=>{
    b.classList.toggle('active',parseInt(b.dataset.day)===cycleStartDay);
  });
  openModal('modal-budget');
}
async function saveBudget(){
  const amount=parseFloat(document.getElementById('budget-input').value);
  if(!amount||amount<=0){showToast('Enter a valid amount');return;}
  const now=new Date();
  const monthKey=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const {error}=await db.from('budgets').upsert({user_id:currentUser.id,month:monthKey,amount},{onConflict:'user_id,month'});
  if(error){showToast('Error saving budget');return;}
  // Save cycle start day
  const selectedDay=parseInt(document.querySelector('.cycle-day-btn.active')?.dataset.day||cycleStartDay);
  cycleStartDay=selectedDay;
  await db.from('profiles').update({cycle_start_day:selectedDay}).eq('id',currentUser.id);
  budget=amount; closeModal('modal-budget');
  renderDashboard(new Date(),new Date().toLocaleString('default',{month:'long'}));
  showToast('\u2713 Budget saved');
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
    await db.from('recipe_ingredients').insert(ingLines.map((l,i)=>{
      const parts=l.split('|').map(p=>p.trim());
      if(parts.length>=2) return {recipe_id:currentViewRecipe.id,amount:parts[0],name:parts[1],sort_order:i};
      const {amount,name}=parseIngredient(l.trim());
      return {recipe_id:currentViewRecipe.id,amount:amount||null,name:name||l.trim(),sort_order:i};
    }));
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
  // Set filter to archived and reload — archived recipes fetched from DB
  currentFilter='archived';
  showArchived=true;
  // Update pill active states
  document.querySelectorAll('.filter-pill').forEach(p=>p.classList.remove('filter-active'));
  const btn=document.getElementById('filter-archived');
  if(btn){
    btn.classList.add('filter-active');
    btn.style.background='#6B7280';
    btn.style.color='#fff';
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
var currentListBasket='this_week'; // var for hoisting — used before let block

function switchListBasket(basket){
  currentListBasket=basket;
  // Toggle active class — must use 'active' to match .basket-tab.active CSS
  document.querySelectorAll('.basket-tab').forEach(t=>t.classList.remove('active'));
  const activeTab=basket==='this_week'?'list-tab-this':basket==='next_week'?'list-tab-next':'list-tab-monthly';
  const el=document.getElementById(activeTab);
  if(el) el.classList.add('active');
  loadShoppingList();
}


// ══ CLEAR BASKET ══
async function clearBasket(){
  if(!currentUser) return;
  const basketLabel=currentListBasket==='monthly'?'Monthly basket':currentListBasket==='next_week'?'Next week':'This week';
  if(!confirm('Clear all items from '+basketLabel+'? This cannot be undone.')) return;

  const now=new Date();
  let weekStart=new Date(now); weekStart.setDate(now.getDate()-((now.getDay()+6)%7)); weekStart.setHours(0,0,0,0);
  if(currentListBasket==='next_week') weekStart.setDate(weekStart.getDate()+7);
  const weekEnd=new Date(weekStart); weekEnd.setDate(weekStart.getDate()+6);
  const ws=weekStart.toISOString().split('T')[0];
  const we=weekEnd.toISOString().split('T')[0];

  let query=db.from('shopping_list_items').delete().eq('user_id',currentUser.id);
  if(currentListBasket==='monthly'){
    query=query.eq('week_start','monthly');
  } else {
    query=query.gte('week_start',ws).lte('week_start',we);
  }
  const {error}=await query;
  if(error){ showToast('Error clearing basket'); return; }
  shoppingItems=[];
  renderShoppingList();
  showToast('\u2713 '+basketLabel+' cleared');
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
  document.getElementById('photo-input').click();
}

async function handlePhotoScan(input){
  if(!input.files||!input.files[0]) return;
  const file=input.files[0];
  input.value='';
  showScanModal('📸 Review scanned receipt');
  document.getElementById('scan-status').textContent='Reading receipt with Claude AI...';
  try {
    const b64=await fileToBase64(file);
    const compressed=await compressImage(b64.split(',')[1]);
    const result=await callGemOCR({mode:'scan',image:compressed,mediaType:file.type||'image/jpeg'});
    if(result){
      applyClaudeReceiptResult(result);
      document.getElementById('scan-status').textContent='✓ Receipt scanned — review and correct if needed';
    } else {
      document.getElementById('scan-status').textContent='⚠️ Could not read receipt — please fill in manually';
    }
  } catch(e) {
    console.error('Photo scan error:',e);
    document.getElementById('scan-status').textContent='❌ Scan failed: '+e.message;
  }
}

// ══ EMAIL / DOC IMPORT ══
function openEmailImport(){
  document.getElementById('email-input').click();
}

async function handleEmailImport(input){
  if(!input.files||!input.files[0]) return;
  const file=input.files[0];
  input.value='';
  showScanModal('📄 Review imported receipt');
  document.getElementById('scan-status').textContent='Reading document with Claude AI...';
  try {
    const b64=await fileToBase64(file);
    const compressed=await compressImage(b64.split(',')[1]);
    const mediaType=file.type||'image/jpeg';
    const result=await callGemOCR({mode:'scan',image:compressed,mediaType});
    if(result){
      applyClaudeReceiptResult(result);
      document.getElementById('scan-status').textContent='✓ Document read — review and correct if needed';
    } else {
      document.getElementById('scan-status').textContent='Could not read file — fill in manually';
    }
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

// ══ GEM OCR — Supabase Edge Function (Claude AI) ══
async function callGemOCR(payload){
  const res=await fetch(GEM_OCR_URL,{
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'Authorization':'Bearer '+SKEY,
    },
    body:JSON.stringify(payload)
  });
  if(!res.ok){
    const err=await res.json().catch(()=>({}));
    throw new Error(err.error||'OCR service error '+res.status);
  }
  return res.json();
}

// ══ CLEAN ITEM NAMES via Edge Function ══
async function cleanItemNames(){
  const rawNames=scanItems.map(i=>i.name);
  if(!rawNames.length){ showToast('No items to clean'); return; }
  const statusEl=document.getElementById('scan-status');
  if(statusEl) statusEl.textContent='\u2728 Cleaning names with Claude...';
  try{
    const result=await callGemOCR({mode:'clean',items:rawNames});
    if(result?.items&&result.items.length===scanItems.length){
      // Store old→new name mapping for propagation
      const nameMap=rawNames.map((old,i)=>({old,new:result.items[i]||old}));
      scanItems=scanItems.map((item,i)=>({...item,name:result.items[i]||item.name}));
      renderScanItems();
      if(statusEl) statusEl.textContent='\u2713 Names cleaned — review and correct if needed';
      // Propagate to price_history in background (non-blocking)
      if(currentUser){
        nameMap.filter(m=>m.old!==m.new).forEach(m=>{
          db.from('price_history').update({item_name:m.new}).eq('user_id',currentUser.id).eq('item_name',m.old).catch(()=>{});
          db.from('grocery_items').upsert({user_id:currentUser.id,name:m.new,is_shared:false},{onConflict:'user_id,name',ignoreDuplicates:true}).catch(()=>{});
        });
      }
    }
  }catch(e){
    if(statusEl) statusEl.textContent='Could not clean names: '+e.message;
  }
}

// ══ CLEAN SINGLE NAME via Edge Function ══
async function cleanSingleName(idx){
  const item=scanItems[idx];
  if(!item) return;
  try{
    const result=await callGemOCR({mode:'clean_one',name:item.name});
    if(result?.name){
      scanItems[idx].name=result.name;
      renderScanItems();
      showToast('\u2713 Name cleaned');
    }
  }catch(e){
    showToast('Could not clean name');
  }
}

// ══ CLEAN LIST ITEM NAME via Edge Function ══
async function cleanListItemName(itemId){
  const item=shoppingItems.find(i=>i.id===itemId);
  if(!item) return;
  const btn=document.getElementById('clean-btn-single');
  if(btn){ btn.textContent='...'; btn.disabled=true; }
  try{
    const result=await callGemOCR({mode:'clean_one',name:item.name});
    if(result?.name){
      const oldName=item.name;
      const newName=result.name;
      // Update everywhere in parallel
      await Promise.all([
        // 1. Shopping list item
        db.from('shopping_list_items').update({name:newName}).eq('id',itemId),
        // 2. Price history — update all entries with old name
        db.from('price_history').update({item_name:newName}).eq('user_id',currentUser.id).eq('item_name',oldName),
        // 3. Grocery items — upsert with clean name
        db.from('grocery_items').upsert({
          user_id:currentUser.id,
          name:newName,
          is_shared:false,
        },{onConflict:'user_id,name',ignoreDuplicates:true}),
      ]);
      item.name=newName;
      // Refresh price history cache so freq bought updates
      if(typeof loadShoppingList==='function') loadShoppingList();
      else renderShoppingList();
      closeModal('modal-edit-store');
      showToast('\u2713 '+newName);
    }
  }catch(e){
    console.error(e);
    showToast('Could not clean name');
  }finally{
    if(btn){ btn.textContent='\u2728 Identify'; btn.disabled=false; }
  }
}

// ══ GOOGLE VISION API (kept as fallback) ══
async function callVisionAPI(base64Image,feature='TEXT_DETECTION'){
  const compressed=await compressImage(base64Image);
  const res=await fetch('https://vision.googleapis.com/v1/images:annotate?key='+VISION_KEY,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({requests:[{image:{content:compressed},features:[{type:feature,maxResults:1}]}]})
  });
  const data=await res.json();
  if(!res.ok) throw new Error(data.error?.message||'Vision API error '+res.status);
  const result=data.responses?.[0];
  if(result?.error) throw new Error(result.error.message);
  return result?.fullTextAnnotation?.text||result?.textAnnotations?.[0]?.description||null;
}

// ══ PARSE VISION OCR TEXT INTO STRUCTURED JSON ══
// Handles multiple Vision API output formats:
// Format A: item and price on same line "MILK 2L    28.99"
// Format B: item name then price on next line "MILK 2L\n28.99"  
// Format C: price with R prefix "MILK 2L R28.99"
function parseReceiptToJSON(text){
  const lines=text.split('\n').map(l=>l.trim()).filter(Boolean);
  const result={store:null,date:null,total:null,items:[]};

  // Detect store from first 6 lines
  const headerText=lines.slice(0,6).join(' ').toLowerCase();
  if(headerText.includes('pick n pay')||headerText.includes('picknpay')) result.store='Pick n Pay';
  else if(headerText.includes('woolworth')) result.store='Woolworths';
  else if(headerText.includes('checkers')) result.store='Checkers';
  else if(headerText.includes('spar')) result.store='Spar';
  else if(headerText.includes('walmart')||headerText.includes('game')) result.store='Walmart';

  // Detect date — DD.MM.YY or DD/MM/YYYY
  for(const line of lines){
    const m=line.match(/(\d{1,2})[.\/](\d{2})[.\/](\d{2,4})/);
    if(m){
      const y=m[3].length===2?'20'+m[3]:m[3];
      result.date=`${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
      break;
    }
  }

  // Detect total
  for(const line of lines){
    if(/\btotal\b/i.test(line)&&!/sub|vat|sav|year|today/i.test(line)){
      const m=line.match(/R?\s*(\d+[.,]\d{2})/);
      if(m) result.total=parseFloat(m[1].replace(',','.'));
    }
  }

  // Skip lines that are clearly not product items
  const skipWords=/total|subtotal|vat|tax|change|tender|card|cash|thank|receipt|invoice|balance|saving|smart shopper|loyalty|rands earned|rands to spend|today you|this year|you missed|served by|customer|keep your|store cash|till |date |time |txn|rate|gross|net\b|hi |checkout|liquor|cnr |oakfield|northmead|ext\d|lic\.|vat no|less product|less disc|product disc/i;
  const standalonePrice=/^R?\s*(\d+[.,]\d{2})\s*$/;

  let pendingName=null;

  for(let i=0;i<lines.length;i++){
    const line=lines[i];
    if(skipWords.test(line)){ pendingName=null; continue; }

    // Format B: standalone price line follows item name line
    const soloMatch=line.match(standalonePrice);
    if(soloMatch&&pendingName){
      const price=parseFloat(soloMatch[1].replace(',','.'));
      if(price>0&&price<5000){
        result.items.push({name:pendingName,price,isSpecial:false});
      }
      pendingName=null;
      continue;
    }

    // Format A/C: item + price on same line (with optional R prefix)
    const inlineMatch=line.match(/^(.+?)\s+R?\s*(\d+[.,]\d{2})\s*$/);
    if(inlineMatch){
      const name=inlineMatch[1].trim();
      const price=parseFloat(inlineMatch[2].replace(',','.'));
      if(name.length>2&&price>0&&price<5000&&!skipWords.test(name)){
        result.items.push({name,price,isSpecial:false});
        pendingName=null;
        continue;
      }
    }

    // Detect discount line — negative price or "less/discount/saving" keyword with amount
    const discountMatch=line.match(/^(.*)(?:discount|saving|less|special|promo).*?-?R?\s*(\d+[.,]\d{2})\s*$/i)
      || line.match(/^-R?\s*(\d+[.,]\d{2})\s*$/);
    if(discountMatch&&result.items.length>0){
      const discountAmt=parseFloat((discountMatch[2]||discountMatch[1]).replace(',','.'));
      if(discountAmt>0&&discountAmt<500){
        // Apply to last item — mark as special
        const lastItem=result.items[result.items.length-1];
        lastItem.normalPrice=lastItem.price;
        lastItem.price=Math.max(0,parseFloat((lastItem.price-discountAmt).toFixed(2)));
        lastItem.isSpecial=true;
      }
      pendingName=null;
      continue;
    }

    // Detect variable weight items e.g. "BEEF RUMP 0.543kg" or "CHICKEN 0.432 kg"
    const weightMatch=line.match(/(\d+[.,]\d{3})\s*kg/i);
    if(weightMatch&&result.items.length>0){
      const lastItem=result.items[result.items.length-1];
      lastItem.isVariable=true;
      lastItem.weight=weightMatch[1]+'kg';
      lastItem.name=lastItem.name+' ⚖️';
    }

    // Possible item name — hold it in case next line is price
    if(line.length>3&&!/^\d/.test(line)&&!skipWords.test(line)&&!/^[-=*]{3,}/.test(line)){
      pendingName=line;
    } else {
      pendingName=null;
    }
  }

  return result.items.length>0?result:null;
}


function applyClaudeReceiptResult(result){
  // Populate scan modal fields from Claude's structured response
  const ss=(id,val,prop='value')=>{const el=document.getElementById(id);if(el)el[prop]=val;};

  // Auto-detect store
  if(result.store){
    const storeLower=result.store.toLowerCase();
    const storeMatch=Object.keys(STORES).find(k=>storeLower.includes(k)||storeLower.includes(STORES[k].label.toLowerCase()));
    if(storeMatch) ss('scan-store',storeMatch);
  }
  // Date
  if(result.date) ss('scan-date',result.date);
  // Total
  if(result.total) ss('scan-total',result.total);

  // Populate item list — preserve normalPrice and isSpecial from Claude
  scanItems=(result.items||[]).map(i=>({
    name:i.name||'',
    price:i.price?String(i.price):'',
    isSpecial:i.isSpecial||false,
    normalPrice:i.normalPrice?String(i.normalPrice):'',
  }));
  renderScanItems();
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




// ══ GROCERY LIST UPLOAD ══
function openGroceryUpload(){
  document.getElementById('grocery-upload-status').textContent='';
  document.getElementById('grocery-upload-preview').innerHTML='';
  document.getElementById('grocery-upload-confirm').style.display='none';
  window._uploadRows=[];
  openModal('modal-grocery-upload');
}

async function downloadGroceryTemplate(){
  // Fetch the pre-built template file
  try{
    const res=await fetch('grocery-template.xlsx');
    const blob=await res.blob();
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url; a.download='GEM-Grocery-Template.xlsx';
    a.click(); URL.revokeObjectURL(url);
  }catch(e){
    showToast('Could not download template');
  }
}

async function handleGroceryUpload(input){
  if(!input.files||!input.files[0]) return;
  const file=input.files[0];
  input.value='';
  const statusEl=document.getElementById('grocery-upload-status');
  const previewEl=document.getElementById('grocery-upload-preview');
  const confirmEl=document.getElementById('grocery-upload-confirm');
  statusEl.textContent='Reading file...';
  previewEl.innerHTML='';
  confirmEl.style.display='none';

  try{
    // Use SheetJS to read the Excel file
    const XLSX=window.XLSX;
    if(!XLSX){ statusEl.textContent='❌ SheetJS not loaded'; return; }
    const data=await file.arrayBuffer();
    const wb=XLSX.read(data,{type:'array'});
    const ws=wb.Sheets[wb.SheetNames[0]];
    const rows=XLSX.utils.sheet_to_json(ws,{defval:''});

    if(!rows.length){ statusEl.textContent='No data found in file'; return; }

    // Map columns — flexible header matching
    const mapped=rows.map(row=>{
      const name=row['Name']||row['name']||row['ITEM']||'';
      const category=row['Category']||row['category']||'Other';
      const unit=row['Unit']||row['unit']||row['SIZE']||'';
      const price=parseFloat(String(row['Price (R)']||row['Price']||row['price']||'').replace(/[^0-9.]/g,''))||null;
      const store=String(row['Store']||row['store']||'').toLowerCase().trim();
      const storeKey=store.includes('woolworths')?'woolworths':
        store.includes('checkers')?'checkers':
        store.includes('pick')||store.includes('pnp')?'pnp':
        store.includes('spar')?'spar':
        store.includes('walmart')?'walmart':null;
      return {name:name.trim(),category,unit,price,store_key:storeKey};
    }).filter(r=>r.name.length>1);

    window._uploadRows=mapped;
    statusEl.textContent=`✅ Found ${mapped.length} items`;

    // Show preview of first 5
    previewEl.innerHTML=`<div style="font-size:12px;font-weight:800;color:var(--muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px">Preview (first 5 items)</div>`+
      mapped.slice(0,5).map(r=>`
        <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:#F8FAF9;border-radius:10px;margin-bottom:4px">
          <span style="font-size:18px">${getItemEmoji(r.name)}</span>
          <div style="flex:1">
            <div style="font-size:13px;font-weight:600">${r.name}</div>
            <div style="font-size:11px;color:var(--muted)">${r.category}${r.unit?' · '+r.unit:''}${r.price?' · R'+r.price:''}</div>
          </div>
        </div>`).join('');

    confirmEl.style.display='block';
  }catch(e){
    statusEl.textContent='❌ Error reading file: '+e.message;
  }
}

async function confirmGroceryUpload(){
  const rows=window._uploadRows||[];
  if(!rows.length||!currentUser) return;
  const statusEl=document.getElementById('grocery-upload-status');
  statusEl.textContent='Uploading...';

  // Upsert rows — match on name+user_id
  const toUpsert=rows.map(r=>({
    user_id:currentUser.id,
    name:r.name,
    category:r.category||'Other',
    unit:r.unit||null,
    normal_price:r.price||null,
    store_key:r.store_key||null,
    is_shared:false,
  }));

  const {error}=await db.from('grocery_items')
    .upsert(toUpsert,{onConflict:'user_id,name',ignoreDuplicates:false});

  if(error){
    statusEl.textContent='❌ Upload failed: '+error.message;
    return;
  }
  statusEl.textContent='✅ '+rows.length+' items saved to your grocery list!';
  document.getElementById('grocery-upload-confirm').style.display='none';
  document.getElementById('grocery-upload-preview').innerHTML='';
  window._uploadRows=[];
  showToast('\u2713 Grocery list updated');
  // Reload grocery items
  if(typeof loadGroceryItems==='function') loadGroceryItems();
  setTimeout(()=>closeModal('modal-grocery-upload'),1500);
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
    <div style="display:flex;gap:6px;align-items:center;padding:6px;background:#F8FAF9;border-radius:10px;border:1px solid var(--line-light);flex-wrap:wrap">
      <div style="display:flex;gap:6px;align-items:center;width:100%">
        <input style="flex:2;padding:6px 8px;border-radius:8px;border:1.5px solid var(--line);font-size:12px;font-family:var(--font);outline:none"
          value="${item.name}" onchange="scanItems[${i}].name=this.value" placeholder="Item name"/>
        <input style="width:70px;padding:6px 8px;border-radius:8px;border:1.5px solid ${item.isSpecial?'var(--green-dark)':'var(--line)'};font-size:12px;font-family:var(--font);outline:none;background:${item.isSpecial?'var(--green-pale)':'#fff'}"
          value="${item.price}" onchange="scanItems[${i}].price=this.value" placeholder="Price"/>
        <button onclick="toggleScanSpecial(${i})" title="Mark as special"
          style="padding:5px 8px;border-radius:8px;border:1.5px solid ${item.isSpecial?'var(--green-dark)':'var(--line)'};background:${item.isSpecial?'var(--green-pale)':'transparent'};font-size:13px;cursor:pointer">🏷️</button>
        <button onclick="removeScanItem(${i})"
          style="background:transparent;border:none;cursor:pointer;color:var(--muted);font-size:16px;padding:2px">✕</button>
      </div>
      ${item.isSpecial?`<div style="display:flex;align-items:center;gap:6px;width:100%;padding-left:4px">
        <span style="font-size:11px;color:var(--green-dark);font-weight:600">Normal price:</span>
        <input style="width:80px;padding:5px 8px;border-radius:8px;border:1.5px solid var(--green-dark);font-size:12px;font-family:var(--font);outline:none;background:var(--green-pale)"
          value="${item.normalPrice||''}" onchange="scanItems[${i}].normalPrice=this.value" placeholder="e.g. 15.99"/>
        <span style="font-size:10px;color:var(--muted)">You saved R${item.normalPrice&&item.price?Math.max(0,parseFloat(item.normalPrice||0)-parseFloat(item.price||0)).toFixed(2):'?'}</span>
      </div>`:''}
      ${item.isVariable?`<div style="font-size:10px;color:var(--orange);font-weight:700;padding-left:4px">⚖️ Variable weight: ${item.weight||'check receipt'} — price may vary</div>`:''}
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
      // Propagate clean names to grocery_items so freq bought + template stay current
      db.from('grocery_items').upsert(
        valid.map(i=>({user_id:currentUser.id,name:i.name.trim(),is_shared:false})),
        {onConflict:'user_id,name',ignoreDuplicates:true}
      ).catch(()=>{});
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

// ══ INGREDIENT PARSER — split amount from name ══
function parseIngredient(raw){
  const s=raw.trim();
  if(!s) return {amount:'',name:''};

  // Units list
  const units='cups?|tbsp|tablespoons?|tsp|teaspoons?|g|kg|ml|l|liter|litre|oz|lb|lbs|pounds?|litres?|liters?|handful|pinch|dash|can|cans|tin|tins|cloves?|slices?|pieces?|bunch|bunches|stalks?|sprigs?';
  const toTaste=/^(to taste|salt and pepper|seasoning|a pinch)/i;

  if(toTaste.test(s)){
    const m=s.match(/^([^,]+)(,.*)?$/);
    return {amount:'to taste',name:(m?m[1].trim():s).replace(/^to taste\s*/i,'').trim()||s};
  }

  // Match: number (fraction/decimal) + optional unit + rest
  // e.g. "2 cups flour", "500g chicken breast", "1/2 tsp salt", "3 large eggs"
  const re=new RegExp(
    `^(\\d+(?:[\\s\\/]\\d+)?(?:\\.\\d+)?(?:\\s*-\\s*\\d+(?:\\.\\d+)?)?)` + // number (incl fractions/ranges)
    `(?:\\s+(${units}))?` + // optional unit
    `(?:\\s+(.*?))?$`, // rest = ingredient name
    'i'
  );

  const m=s.match(re);
  if(m){
    const num=m[1]?.trim()||'';
    const unit=m[2]?.trim()||'';
    const name=m[3]?.trim()||'';
    if(num&&name){
      return {amount:unit?`${num} ${unit}`:num, name:name};
    }
  }

  // No number found — whole thing is the name
  return {amount:'',name:s};
}

// Split imported ingredients and populate textarea with amount | name format
function splitImportedIngredients(lines){
  return lines.map(line=>{
    const {amount,name}=parseIngredient(line);
    return amount?`${amount} | ${name}`:name;
  });
}

async function importRecipeFromUrl(){
  const urlInput=document.getElementById('recipe-import-url');
  const errEl=document.getElementById('recipe-import-error');
  const url=(urlInput?.value||'').trim();
  errEl.textContent='';
  if(!url||!url.startsWith('http')){errEl.textContent='Please enter a valid URL';return;}

  const btn=document.getElementById('recipe-import-btn');
  if(btn){btn.textContent='Importing...';btn.disabled=true;}

  try{
    // Try multiple CORS proxies in order — allorigins is unreliable
    let html='';
    const proxies=[
      async()=>{
        const r=await fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`,{signal:AbortSignal.timeout(8000)});
        return r.ok?await r.text():'';
      },
      async()=>{
        const r=await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,{signal:AbortSignal.timeout(8000)});
        const d=await r.json(); return d.contents||'';
      },
      async()=>{
        const r=await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,{signal:AbortSignal.timeout(8000)});
        return r.ok?await r.text():'';
      },
    ];
    for(const proxy of proxies){
      try{ html=await proxy(); if(html.length>500) break; }catch(e){ continue; }
    }
    if(!html) throw new Error('All proxies failed — check your internet connection');

    // Try to parse schema.org/Recipe JSON-LD first
    const recipe=parseSchemaRecipe(html)||parseOpenGraph(html,url);

    if(!recipe||!recipe.title){
      errEl.textContent='Could not read recipe from that page. Try copying the ingredients manually.';
      return;
    }

    // Populate the add recipe modal
    document.getElementById('recipe-title').value=recipe.title||'';
    document.getElementById('recipe-desc').value=recipe.description||'';
    // Split amount from ingredient name where possible
    const splitIngs=splitImportedIngredients(recipe.ingredients||[]);
    document.getElementById('recipe-ingredients').value=splitIngs.join('\n');
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
    return `<div class="receipt-strip-row">
      ${storeLogo(r.store_key,40)}
      <div style="flex:1;min-width:0">
        <div class="receipt-store-name">${cfg.label}</div>
        <div class="receipt-meta">${d} &middot; ${r.item_count||'?'} items</div>
      </div>
      <div class="receipt-amount">${fmtR(r.total||0)}</div>
    </div>`;
  }).join('');
}

