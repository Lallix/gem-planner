-- ============================================================
-- GEM PLANNER — Supabase Database Schema
-- Run this entire script in your Supabase SQL Editor
-- ============================================================

-- ── USERS PROFILE ────────────────────────────────────────────
-- Extends Supabase auth.users with display info
create table if not exists public.profiles (
  id          uuid references auth.users(id) on delete cascade primary key,
  full_name   text,
  email       text,
  is_admin    boolean default false,
  created_at  timestamptz default now()
);

-- Auto-create profile when a new auth user is created
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── STORES ───────────────────────────────────────────────────
-- Auto-populated when receipts are scanned
create table if not exists public.stores (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references auth.users(id) on delete cascade,
  name        text not null,
  store_key   text, -- woolworths | checkers | pnp | spar | walmart | other
  created_at  timestamptz default now()
);

-- ── BUDGETS ──────────────────────────────────────────────────
create table if not exists public.budgets (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references auth.users(id) on delete cascade,
  month       text not null, -- format: "2026-06"
  amount      numeric(10,2) not null,
  created_at  timestamptz default now(),
  unique(user_id, month)
);

-- ── RECEIPTS ─────────────────────────────────────────────────
create table if not exists public.receipts (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references auth.users(id) on delete cascade,
  store_key   text,
  store_name  text,
  total       numeric(10,2),
  item_count  integer,
  method      text, -- 'photo' | 'email' | 'manual'
  receipt_date date,
  created_at  timestamptz default now()
);

-- ── RECEIPT ITEMS ─────────────────────────────────────────────
create table if not exists public.receipt_items (
  id          uuid default gen_random_uuid() primary key,
  receipt_id  uuid references public.receipts(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete cascade,
  name        text not null,
  price       numeric(10,2),
  quantity    numeric(8,2) default 1,
  unit        text,
  created_at  timestamptz default now()
);

-- ── PRICE HISTORY ─────────────────────────────────────────────
-- Tracks price changes per item over time
create table if not exists public.price_history (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references auth.users(id) on delete cascade,
  item_name   text not null,
  store_key   text,
  price       numeric(10,2),
  recorded_at date default now()
);

-- ── RECIPES ──────────────────────────────────────────────────
create table if not exists public.recipes (
  id            uuid default gen_random_uuid() primary key,
  user_id       uuid references auth.users(id) on delete cascade,
  title         text not null,
  category      text default 'dinner', -- dinner | baking | lunch | other
  description   text,
  instructions  text,
  prep_time     integer, -- minutes
  cook_time     integer, -- minutes
  servings      integer default 4,
  source_url    text,   -- Pinterest / Facebook link if imported
  source_label  text,   -- "From Pinterest" etc
  visibility    text default 'private', -- private | shared | everyone
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ── RECIPE INGREDIENTS ────────────────────────────────────────
create table if not exists public.recipe_ingredients (
  id          uuid default gen_random_uuid() primary key,
  recipe_id   uuid references public.recipes(id) on delete cascade,
  name        text not null,
  amount      text,
  unit        text,
  have_it     boolean default false, -- for the ingredient checker
  sort_order  integer default 0
);

-- ── RECIPE SHARES ─────────────────────────────────────────────
-- Links recipes to specific users they're shared with
create table if not exists public.recipe_shares (
  id          uuid default gen_random_uuid() primary key,
  recipe_id   uuid references public.recipes(id) on delete cascade,
  shared_by   uuid references auth.users(id) on delete cascade,
  shared_with uuid references auth.users(id) on delete cascade,
  created_at  timestamptz default now(),
  unique(recipe_id, shared_with)
);

-- ── MEAL PLANS ────────────────────────────────────────────────
create table if not exists public.meal_plans (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references auth.users(id) on delete cascade,
  week_start  date not null, -- Monday of the planned week
  created_at  timestamptz default now(),
  unique(user_id, week_start)
);

-- ── MEAL PLAN ENTRIES ─────────────────────────────────────────
create table if not exists public.meal_plan_entries (
  id          uuid default gen_random_uuid() primary key,
  plan_id     uuid references public.meal_plans(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete cascade,
  day_of_week integer not null, -- 0=Mon, 1=Tue ... 6=Sun
  meal_type   text default 'dinner', -- dinner | baking
  recipe_id   uuid references public.recipes(id) on delete set null,
  notes       text
);

-- ── SHOPPING LIST ─────────────────────────────────────────────
create table if not exists public.shopping_list_items (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references auth.users(id) on delete cascade,
  week_start  date,
  name        text not null,
  amount      text,
  unit        text,
  category    text default 'misc', -- meal_plan | school_lunch | baking | misc
  recipe_id   uuid references public.recipes(id) on delete set null,
  is_checked  boolean default false,
  est_price   numeric(10,2),
  created_at  timestamptz default now()
);

-- ── PANTRY (probable items) ───────────────────────────────────
create table if not exists public.pantry_items (
  id            uuid default gen_random_uuid() primary key,
  user_id       uuid references auth.users(id) on delete cascade,
  name          text not null,
  last_bought   date,
  usual_qty     text,
  est_days_life integer default 7,
  created_at    timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY — users only see their own data
-- ============================================================

alter table public.profiles             enable row level security;
alter table public.stores               enable row level security;
alter table public.budgets              enable row level security;
alter table public.receipts             enable row level security;
alter table public.receipt_items        enable row level security;
alter table public.price_history        enable row level security;
alter table public.recipes              enable row level security;
alter table public.recipe_ingredients   enable row level security;
alter table public.recipe_shares        enable row level security;
alter table public.meal_plans           enable row level security;
alter table public.meal_plan_entries    enable row level security;
alter table public.shopping_list_items  enable row level security;
alter table public.pantry_items         enable row level security;

-- Profiles
create policy "Own profile" on public.profiles
  for all using (auth.uid() = id);

-- Admin can see all profiles (for user management)
create policy "Admin sees all profiles" on public.profiles
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- Standard: each table is own-data only
create policy "Own stores"        on public.stores               for all using (auth.uid() = user_id);
create policy "Own budgets"       on public.budgets              for all using (auth.uid() = user_id);
create policy "Own receipts"      on public.receipts             for all using (auth.uid() = user_id);
create policy "Own receipt items" on public.receipt_items        for all using (auth.uid() = user_id);
create policy "Own price history" on public.price_history        for all using (auth.uid() = user_id);
create policy "Own meal plans"    on public.meal_plans           for all using (auth.uid() = user_id);
create policy "Own plan entries"  on public.meal_plan_entries    for all using (auth.uid() = user_id);
create policy "Own shopping list" on public.shopping_list_items  for all using (auth.uid() = user_id);
create policy "Own pantry"        on public.pantry_items         for all using (auth.uid() = user_id);

-- Recipes — own + shared with me + everyone
create policy "Own recipes" on public.recipes
  for all using (auth.uid() = user_id);

create policy "See shared recipes" on public.recipes
  for select using (
    visibility = 'everyone'
    or (
      visibility = 'shared' and
      exists (
        select 1 from public.recipe_shares
        where recipe_id = recipes.id and shared_with = auth.uid()
      )
    )
  );

-- Recipe ingredients — follow recipe visibility
create policy "Own recipe ingredients" on public.recipe_ingredients
  for all using (
    exists (select 1 from public.recipes where id = recipe_id and user_id = auth.uid())
  );

create policy "See shared recipe ingredients" on public.recipe_ingredients
  for select using (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id
      and (
        r.visibility = 'everyone'
        or (r.visibility = 'shared' and exists (
          select 1 from public.recipe_shares
          where recipe_id = r.id and shared_with = auth.uid()
        ))
      )
    )
  );

-- Recipe shares — manage your own shares
create policy "Manage own recipe shares" on public.recipe_shares
  for all using (auth.uid() = shared_by);

create policy "See shares for me" on public.recipe_shares
  for select using (auth.uid() = shared_with);

-- ============================================================
-- ADMIN HELPERS
-- ============================================================

-- Make a user admin (run manually in SQL editor when needed)
-- update public.profiles set is_admin = true where email = 'your@email.com';

-- ============================================================
-- Done! All tables, RLS policies and triggers created.
-- ============================================================
