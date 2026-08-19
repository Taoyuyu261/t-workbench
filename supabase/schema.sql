-- ============================================================
-- T先生的工作台：Supabase 数据表（一次全部执行即可）
-- 使用方法：Supabase 控制台 → 左侧 SQL Editor → 粘贴本文件全部内容 → Run
-- ============================================================

-- 1. 每日数据表（今日计划 plans / 锻炼记录 exercise / 未来扩展类型）
create table if not exists app_data (
  uid         uuid        not null references auth.users(id) on delete cascade,
  date        text        not null,
  kind        text        not null,
  payload     jsonb       not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  primary key (uid, date, kind)
);

-- 2. 计划日程表（跨天事务：任意日期的待办/日程）
create table if not exists agenda_items (
  uid         uuid        not null references auth.users(id) on delete cascade,
  id          text        not null,
  date        text        not null,
  label       text        not null,
  done        boolean     not null default false,
  created_at  timestamptz not null default now(),
  primary key (uid, id)
);
create index if not exists idx_agenda_uid_date on agenda_items (uid, date);

-- 3. 行级安全（RLS）：每个人只能读写自己的数据
alter table app_data     enable row level security;
alter table agenda_items enable row level security;

drop policy if exists "own app_data" on app_data;
create policy "own app_data" on app_data
  for all
  using (auth.uid() = uid)
  with check (auth.uid() = uid);

drop policy if exists "own agenda" on agenda_items;
create policy "own agenda" on agenda_items
  for all
  using (auth.uid() = uid)
  with check (auth.uid() = uid);

-- 4. 允许前端通过 anon key 安全访问（默认已开启，此句兜底）
-- grant usage on schema public to anon, authenticated;
-- grant all on all tables in schema public to authenticated;
