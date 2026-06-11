-- ──────────────────────────────────────────────────────────────────────────────
-- Migration: 20260517000004_sources_triggers
-- PR-S1 — Sources Registry triggers (updated_at + audit log + identifier sync)
-- Spec: SYSTEM/INFO/AUDITS/SOURCES_REDESIGN/2026-05-17/03-registry-schema.md
--
-- Scope (sub-mission #04):
--   1. updated_at auto-update — BEFORE UPDATE on sources, platform_identifiers
--   2. audit log — AFTER INSERT/UPDATE on sources -> source_history
--   3. sync — AFTER INSERT/UPDATE on platform_identifiers -> source_handles
--
-- No DELETE audit trigger: source_history.source_id is ON DELETE CASCADE, so a
-- delete-log row would be cascade-removed in the same statement (pointless).
--
-- Run order: _001 -> _002 -> _003 -> _004. Triggers are created AFTER the _002
-- backfill on purpose — backfill inserts must NOT flood source_history.
-- Idempotent: create or replace + drop trigger if exists. Safe to re-run.
-- ──────────────────────────────────────────────────────────────────────────────

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. updated_at auto-update (canonical helper, mirrors MASTER_SCHEMA.sql)
-- ──────────────────────────────────────────────────────────────────────────────
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists sources_updated_at on sources;
create trigger sources_updated_at before update on sources
  for each row execute function update_updated_at();

drop trigger if exists platform_identifiers_updated_at on platform_identifiers;
create trigger platform_identifiers_updated_at before update on platform_identifiers
  for each row execute function update_updated_at();

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. Audit log — record creates and meaningful updates into source_history
--    action is derived: archived > health_changed > validated > updated
-- ──────────────────────────────────────────────────────────────────────────────
create or replace function log_source_change()
returns trigger language plpgsql as $$
declare
  v_action  text;
  v_changes jsonb;
begin
  if tg_op = 'INSERT' then
    insert into source_history (source_id, actor_user_id, actor_agent, action)
    values (new.id, auth.uid(), 'trigger:sources_audit', 'created');
    return new;
  end if;

  -- tg_op = 'UPDATE': diff every column, drop the mechanical updated_at bump
  select jsonb_object_agg(o.key, jsonb_build_object('old', o.value, 'new', n.value))
    into v_changes
  from jsonb_each(to_jsonb(old)) o
  join jsonb_each(to_jsonb(new)) n on n.key = o.key
  where o.value is distinct from n.value
    and o.key <> 'updated_at';

  if v_changes is null then
    return new;  -- nothing of substance changed
  end if;

  v_action := case
    when new.status = 'archived' and old.status <> 'archived'        then 'archived'
    when new.health is distinct from old.health                      then 'health_changed'
    when (v_changes ? 'last_validated_at')
         and (v_changes - 'last_validated_at') = '{}'::jsonb          then 'validated'
    else 'updated'
  end;

  insert into source_history (source_id, actor_user_id, actor_agent, action, changes)
  values (new.id, auth.uid(), 'trigger:sources_audit', v_action, v_changes);
  return new;
end;
$$;

drop trigger if exists sources_audit_log on sources;
create trigger sources_audit_log after insert or update on sources
  for each row execute function log_source_change();

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. Sync — mirror a canonical platform_identifier into source_handles
--    Only fires when entity_id maps to an existing sources row (artist/playlist).
--    UNIQUE(platform, handle) collisions resolve to verified-status refresh,
--    guarded so a handle owned by a different source is never hijacked.
-- ──────────────────────────────────────────────────────────────────────────────
create or replace function sync_to_source_handles()
returns trigger language plpgsql as $$
begin
  if exists (select 1 from sources where id = new.entity_id) then
    insert into source_handles (
      source_id, platform, handle, verified, verified_at, verified_by
    )
    values (
      new.entity_id, new.platform, new.platform_id,
      new.verified, new.verified_at,
      coalesce(new.verified_by, 'platform_identifiers_sync')
    )
    on conflict (platform, handle) do update
      set verified    = excluded.verified,
          verified_at = excluded.verified_at
      where source_handles.source_id = excluded.source_id;
  end if;
  return new;
end;
$$;

drop trigger if exists platform_identifiers_sync on platform_identifiers;
create trigger platform_identifiers_sync after insert or update on platform_identifiers
  for each row execute function sync_to_source_handles();

-- ──────────────────────────────────────────────────────────────────────────────
-- Verification (run manually on shadow DB — sub-mission #05):
--   update sources set name = name || ' ' where id = (select id from sources limit 1);
--   select action, changes from source_history order by created_at desc limit 1;
--   update sources set health = 'amber' where id = (select id from sources limit 1);
--   select action from source_history order by created_at desc limit 1;  -- health_changed
--   insert into platform_identifiers (entity_type, entity_id, platform, platform_id)
--     select 'artist', id, 'test_platform', 'test-id-1' from sources where type='artist' limit 1;
--   select * from source_handles where platform = 'test_platform';        -- synced row
-- ──────────────────────────────────────────────────────────────────────────────
