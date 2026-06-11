-- ──────────────────────────────────────────────────────────────────────────────
-- schema-audit.sql — status transition audit trail (UM-CC_AUDIT_TRAIL / SM1+SM2)
--
-- Adds:
--   1. scout_items.status_history jsonb  — append-only [{status, changed_at, reason, user_id}]
--   2. audit_log table                   — generic entity change log
--   3. trigger functions + triggers on scout_items / feed_posts / story_clusters
--
-- Idempotent (add column if not exists / create or replace / drop trigger if exists).
-- Apply with:
--   node command-centrum/scripts/apply-sql.mjs command-centrum/supabase/schema-audit.sql
-- NOTE: not yet applied — SUPABASE_DB_URL empty in this environment.
-- ──────────────────────────────────────────────────────────────────────────────

-- 1. status_history column ────────────────────────────────────────────────────
alter table scout_items add column if not exists status_history jsonb not null default '[]'::jsonb;

-- 2. audit_log table ───────────────────────────────────────────────────────────
create table if not exists audit_log (
  id          uuid        primary key default gen_random_uuid(),
  entity_type text        not null,                       -- 'scout_item' | 'feed_post' | 'story_cluster'
  entity_id   text        not null,
  action      text        not null,                       -- created | status_changed | updated | ...
  changes     jsonb       not null default '{}'::jsonb,    -- { col: {old, new} }
  changed_by  uuid,                                        -- auth.uid() when available
  changed_at  timestamptz not null default now()
);

create index if not exists idx_audit_log_entity on audit_log (entity_type, entity_id, changed_at desc);
create index if not exists idx_audit_log_action on audit_log (action, changed_at desc);

comment on table audit_log is 'Generic entity change log — UM-CC_AUDIT_TRAIL. Powers /items/:id/history.';

-- 3a. status_history appender (scout_items) ────────────────────────────────────
-- On every status change, append a transition record to status_history.
create or replace function append_status_history()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    new.status_history := coalesce(old.status_history, '[]'::jsonb) || jsonb_build_array(
      jsonb_build_object(
        'status',     new.status,
        'changed_at', now(),
        'reason',     coalesce(current_setting('app.transition_reason', true), null),
        'user_id',    auth.uid()
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists scout_items_status_history on scout_items;
create trigger scout_items_status_history before update on scout_items
  for each row execute function append_status_history();

-- 3b. generic audit_log writer ─────────────────────────────────────────────────
-- Diffs changed columns (excluding mechanical bumps) and writes an audit_log row.
create or replace function log_entity_change()
returns trigger language plpgsql as $$
declare
  v_action  text;
  v_changes jsonb;
  v_id      text;
begin
  v_id := coalesce((to_jsonb(new) ->> 'id'), (to_jsonb(old) ->> 'id'));

  if tg_op = 'INSERT' then
    insert into audit_log (entity_type, entity_id, action, changes, changed_by)
    values (tg_argv[0], v_id, 'created', '{}'::jsonb, auth.uid());
    return new;
  end if;

  -- UPDATE: diff substantive columns.
  select jsonb_object_agg(o.key, jsonb_build_object('old', o.value, 'new', n.value))
    into v_changes
  from jsonb_each(to_jsonb(old)) o
  join jsonb_each(to_jsonb(new)) n on n.key = o.key
  where o.value is distinct from n.value
    and o.key not in ('updated_at', 'status_history');

  if v_changes is null then
    return new;  -- nothing of substance changed
  end if;

  v_action := case
    when (to_jsonb(new) ? 'status')
         and (to_jsonb(new) ->> 'status') is distinct from (to_jsonb(old) ->> 'status')
      then 'status_changed'
    else 'updated'
  end;

  insert into audit_log (entity_type, entity_id, action, changes, changed_by)
  values (tg_argv[0], v_id, v_action, v_changes, auth.uid());
  return new;
end;
$$;

drop trigger if exists scout_items_audit_log on scout_items;
create trigger scout_items_audit_log after insert or update on scout_items
  for each row execute function log_entity_change('scout_item');

drop trigger if exists feed_posts_audit_log on feed_posts;
create trigger feed_posts_audit_log after insert or update on feed_posts
  for each row execute function log_entity_change('feed_post');

drop trigger if exists story_clusters_audit_log on story_clusters;
create trigger story_clusters_audit_log after insert or update on story_clusters
  for each row execute function log_entity_change('story_cluster');
