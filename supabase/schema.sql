-- =====================================================================
-- 강원크루 DB 스키마
-- Supabase 대시보드 > SQL Editor 에 이 파일 전체를 붙여넣고 Run.
-- 여러 번 실행해도 안전하도록 작성됨 (if not exists / or replace).
--
-- 원칙
--  * 모든 시각은 timestamptz(UTC 저장). 화면/CSV 표시만 Asia/Seoul.
--  * 모든 테이블 RLS 활성화 + 정책 없음 → 브라우저(anon 키)로는 접근 불가.
--    서버(Next.js API)만 Secret 키로 접근한다.
--  * GPS 좌표 원본은 저장하지 않는다. 서버가 계산한 거리와 정확도만 저장.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 행사 (하루 단위. 여러 날 축제는 날짜별로 행사를 따로 만든다)
-- ---------------------------------------------------------------------
create table if not exists events (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  event_date   date not null,                       -- 한국 날짜 기준
  venue        text not null default '',
  lat          double precision not null check (lat between -90 and 90),
  lng          double precision not null check (lng between -180 and 180),
  radius_m     integer not null default 100 check (radius_m between 10 and 5000),
  hourly_wage  integer not null default 0 check (hourly_wage >= 0),
  personal_data_purged_at timestamptz,              -- 개인정보 파기 완료 시각
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 사전 등록 명단 (미출근자 = 노쇼 의심 판정용)
-- ---------------------------------------------------------------------
create table if not exists roster (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references events(id) on delete cascade,
  name         text not null,
  phone_last4  text not null check (phone_last4 ~ '^[0-9]{4}$'),
  created_at   timestamptz not null default now(),
  unique (event_id, name, phone_last4)
);

-- ---------------------------------------------------------------------
-- 출퇴근 기록 (행사당 1인 1줄: 출근 시 생성, 퇴근 시 갱신)
-- loc 값: 'ok' = 반경 안 확인됨
--         'no_gps' = 위치 미확인(권한 거부/실패)
--         'low_accuracy' = 위치 미확인(정확도 낮음)
-- 반경 밖(정확도 충분)은 서버가 거부하므로 저장되지 않는다.
-- ---------------------------------------------------------------------
create table if not exists attendances (
  id                    uuid primary key default gen_random_uuid(),
  event_id              uuid not null references events(id) on delete cascade,
  roster_id             uuid references roster(id) on delete set null, -- null = 명단 외
  name                  text not null,
  phone_last4           text not null check (phone_last4 ~ '^[0-9]{4}$'),
  device_id             text,               -- 브라우저에 저장된 기기 ID (대리 출근 감지)
  consent_at            timestamptz not null,
  consent_version       text not null,

  check_in_at           timestamptz not null default now(),
  check_in_loc          text not null check (check_in_loc in ('ok','no_gps','low_accuracy')),
  check_in_distance_m   double precision,
  check_in_accuracy_m   double precision,

  check_out_at          timestamptz,
  check_out_loc         text check (check_out_loc in ('ok','no_gps','low_accuracy')),
  check_out_distance_m  double precision,
  check_out_accuracy_m  double precision,

  created_at            timestamptz not null default now(),
  unique (event_id, name, phone_last4),
  check (check_out_at is null or check_out_at >= check_in_at)
);
create index if not exists attendances_event_device_idx on attendances (event_id, device_id);

-- ---------------------------------------------------------------------
-- 사용된 입장권 (입장권 1장 = 출근 또는 퇴근 1회)
-- ---------------------------------------------------------------------
create table if not exists used_tickets (
  jti      text primary key,
  used_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 관리자 로그인 실패 기록 (연속 실패 시 잠금)
-- ---------------------------------------------------------------------
create table if not exists admin_login_attempts (
  ip            text primary key,
  fail_count    integer not null default 0,
  locked_until  timestamptz,
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 익명 통계 (개인정보 파기 시 이름·뒷자리·기기ID를 지우고 남기는 기록)
-- PoC 효과 분석용
-- ---------------------------------------------------------------------
create table if not exists attendance_stats (
  id                    bigint generated always as identity primary key,
  event_id              uuid not null references events(id) on delete cascade,
  in_roster             boolean not null,
  no_show               boolean not null,
  shared_device         boolean not null default false,
  check_in_at           timestamptz,
  check_in_loc          text,
  check_in_distance_m   double precision,
  check_in_accuracy_m   double precision,
  check_out_at          timestamptz,
  check_out_loc         text,
  check_out_distance_m  double precision,
  check_out_accuracy_m  double precision,
  archived_at           timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- RLS: 켜두고 정책은 만들지 않는다 → anon/authenticated 접근 전부 차단
-- ---------------------------------------------------------------------
alter table events               enable row level security;
alter table roster               enable row level security;
alter table attendances          enable row level security;
alter table used_tickets         enable row level security;
alter table admin_login_attempts enable row level security;
alter table attendance_stats     enable row level security;

-- ---------------------------------------------------------------------
-- 개인정보 파기: 행사일 + retention_days 가 지난 행사의
-- 출퇴근 기록·명단을 익명 통계로 옮긴 뒤 삭제한다.
-- 반환값: 파기 처리한 행사 수
-- ---------------------------------------------------------------------
create or replace function purge_expired_personal_data(retention_days integer default 90)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  ev record;
  n  integer := 0;
begin
  for ev in
    select id from events
    where personal_data_purged_at is null
      and event_date < (now() at time zone 'Asia/Seoul')::date - retention_days
  loop
    -- 출근한 사람
    insert into attendance_stats (
      event_id, in_roster, no_show, shared_device,
      check_in_at, check_in_loc, check_in_distance_m, check_in_accuracy_m,
      check_out_at, check_out_loc, check_out_distance_m, check_out_accuracy_m)
    select
      a.event_id, a.roster_id is not null, false,
      exists (
        select 1 from attendances b
        where b.event_id = a.event_id and b.device_id = a.device_id
          and b.id <> a.id and (b.name, b.phone_last4) <> (a.name, a.phone_last4)
      ),
      a.check_in_at, a.check_in_loc, a.check_in_distance_m, a.check_in_accuracy_m,
      a.check_out_at, a.check_out_loc, a.check_out_distance_m, a.check_out_accuracy_m
    from attendances a
    where a.event_id = ev.id;

    -- 명단에 있었지만 출근하지 않은 사람 (노쇼)
    insert into attendance_stats (event_id, in_roster, no_show)
    select r.event_id, true, true
    from roster r
    where r.event_id = ev.id
      and not exists (select 1 from attendances a where a.roster_id = r.id);

    delete from attendances where event_id = ev.id;
    delete from roster      where event_id = ev.id;
    update events set personal_data_purged_at = now() where id = ev.id;
    n := n + 1;
  end loop;

  -- 오래된 입장권 사용 기록 정리 (1일 이상 지난 것)
  delete from used_tickets where used_at < now() - interval '1 day';

  return n;
end;
$$;

revoke all on function purge_expired_personal_data(integer) from public, anon, authenticated;
grant execute on function purge_expired_personal_data(integer) to service_role;
