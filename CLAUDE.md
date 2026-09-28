@AGENTS.md

# 강원크루 — QR 출퇴근 웹앱 MVP

축제 현장 스태프(크루)가 QR을 스캔해 출퇴근을 기록하고, 관리자가 실시간 현황을 보고 CSV로 내려받는 모바일 웹앱.
강원 지역 축제 현장 PoC(개념 검증) 테스트용.

## ⚠️ 지금은 "데모 모드" (2026-09-29 전환)
시간이 없어 Supabase·Vercel 연결을 건너뛰고, **노트북 로컬 서버 + data.json 파일**로 오늘 바로 시연 가능한
버전을 먼저 만듦. 아래 "기술 구성/환경변수/확정된 결정사항"은 **정식 버전(Supabase) 계획**이고,
데모 모드는 이를 단순화한 별도 경로다. 자세한 내용은 "데모 모드" 섹션 참고. 정식 전환 시 이 섹션은 삭제.

### 데모 모드 요약
- DB 대신 프로젝트 루트의 `data.json` (git 제외, 최초 실행 시 자동 생성+시드).
  읽기/쓰기는 전부 `src/lib/store.ts` 한 파일에 모아둠 → 나중에 Supabase로 옮길 때 이 파일만 교체.
- 관리자 **로그인 없음**(데모 전용, 정식 버전엔 반드시 추가해야 함).
- **GPS 위치 확인 생략** (화면에 "데모 모드" 표시로 고지).
- QR 토큰: 30초 버킷 + HMAC 서명(`src/lib/qrToken.ts`, 고정 데모 시크릿) 이지만, 최근 5분(10버킷)까지 허용해
  "입장권" 없이도 이름 입력 시간을 확보 — 정식 버전의 "5분 입장권 + 1회용 티켓" 대신 단순화한 것.
- 대리 출근: `deviceId`(브라우저 localStorage, 크루 이름 기억 용도와 별개)가 같은 사람이 2명 이상이면
  현황판에 "동일 기기" 표시. 이름 기억은 localStorage, **출퇴근 기록은 항상 서버 API(data.json)에 저장** —
  휴대폰과 노트북이 같은 데이터를 보게 하려면 이 원칙 유지 필수.
- 명단 10명 + 명단 외 1명 시드 데이터 포함 (`src/lib/store.ts`의 `seedStore()`). 관리자 화면 "데모 데이터 초기화" 버튼으로 언제든 복원.
- 휴대폰 접속: `next dev`가 기본적으로 0.0.0.0에 바인딩됨(Next 16 CLI 기본값) → 같은 와이파이의 휴대폰도 접속 가능.
  `npm run dev` 실행 시 `scripts/print-lan.mjs`가 먼저 LAN IP를 콘솔에 출력. QR 화면(`/admin/qr`)은
  `os.networkInterfaces()`로 IP를 찾아 QR과 글자 주소를 함께 보여줌 (`src/lib/network.ts`, `/api/demo/qr-token`).
- CSV: `/api/demo/export` (UTF-8 BOM, KST 표시, 예상 급여 계산 포함).
- **테스트 시 주의**: Windows Git Bash로 curl에 한글을 직접 넣으면 인코딩이 깨져 다른 사람으로 오인될 수 있음
  (앱 버그 아님, 터미널 문제). 한글 포함 API 테스트는 UTF-8 파일을 만들어 `curl --data-binary @파일`로 보낼 것.

## 사용자(대표)와 일하는 방식
- 대표는 코딩을 거의 모름. 파일 생성·설치·실행은 Claude가 하고, 대표가 할 일(가입, 키 입력, 배포 클릭)만 번호 매겨 쉬운 말로 안내.
- 전문용어는 처음 나올 때 한 줄 설명.
- **키/비밀번호를 채팅에 붙여넣으라고 요청 금지.** "어디서 복사해 어느 파일 몇 번째 줄에 넣으라"고만 안내.
- 단계마다: 직접 실행해 확인 → git 커밋 → 이 파일 "진행 상황" 갱신 → "대표가 테스트할 방법" 안내 → 다음 단계.

## 기술 구성
- Next.js 16 (App Router, TypeScript, Tailwind v4) + Supabase(Postgres) + Vercel
- Next 16 주의: `params`/`cookies()`/`headers()`는 모두 `await`. `middleware` → `proxy`. 문서는 `node_modules/next/dist/docs/`.
- 이 PC는 Node가 PATH에 없음 → Bash에서 `export PATH="/c/Program Files/nodejs:$PATH"` 후 사용.
- DB 접근은 **서버(API 라우트/서버 컴포넌트)에서만**, Secret 키 사용 (`src/lib/supabase.ts`, `server-only`).
  모든 테이블 RLS 켜고 정책 없음 → 브라우저에서 직접 접근 불가.
- 관리자 현황판은 5초 폴링(Realtime 미사용, 현장 네트워크 안정성 우선).

## 환경변수 (.env.local, git 제외 / 견본은 .env.example)
| 줄 | 이름 | 설명 |
|---|---|---|
| 5 | SUPABASE_URL | Supabase Project URL |
| 9 | SUPABASE_SECRET_KEY | Supabase Secret key (sb_secret_…) |
| 12 | ADMIN_PASSWORD | 관리자 비밀번호 (대표가 직접 정함) |
| 16 | APP_SECRET | 서명용 무작위 문자열, `npm run gen-secret`으로 자동 생성 |
- 하드코딩 금지. `.gitignore`에 `.env*` (단 `!.env.example`).

## 확정된 결정사항
1. **명단 외 출근**: 거절하지 않고 받아주되 현황판에 "명단 외" 표시 (`attendances.roster_id = null`).
2. **개인정보 보유기간**: 행사일 종료 후 **90일** 보관 후 삭제.
   - 동의서 문구: 목적 "급여 정산 및 분쟁 대응", "행사 종료 후 90일 보관 후 삭제",
     "공식 임금 기록은 행사 운영사가 별도 보관".
   - 수집 항목: 이름, 휴대폰 뒷자리 4자리, 출퇴근 시각, 행사장과의 거리 및 위치 정확도, 기기 식별값.
   - 파기 시 이름·뒷자리·기기ID를 지운 **익명 통계**(출퇴근 시각, 노쇼 여부, 거리, 정확도, 명단 여부, 동일기기 여부)를
     `attendance_stats`에 남김 (PoC 효과 분석용). SQL 함수 `purge_expired_personal_data(90)`.
   - GPS 좌표 원본은 저장하지 않음 (거리·정확도만).
3. **행사 단위**: 하루 = 행사 1개. 여러 날 축제는 날짜별로 행사 생성. 행사당 1인 1기록(출근 1회, 퇴근 1회).
4. **QR 토큰**: 30초마다 갱신, "행사ID+발급시각+HMAC 서명". 유효 30초 + 인식 여유 10초.
   스캔 성공 시 서버가 **5분짜리 입장권**(서명 쿠키/토큰)을 발급 → 이름 입력·동의에 시간이 걸려도 OK.
   입장권 1장으로 출근 또는 퇴근 **1회만** (`used_tickets` 테이블로 재사용 차단). 한 QR을 여러 명이 동시에 스캔 가능.
5. **GPS 판정 (서버에서 계산)**:
   - 위치 없음(권한 거부/실패) → 기록하되 `no_gps` "위치 미확인".
   - 정확도(accuracy) > 허용 반경 → 거절하지 않고 `low_accuracy` "위치 미확인(정확도 낮음)".
   - 정확도 ≤ 반경일 때만 반경 판정: 거리 > 반경이면 **거부** + 안내, 이내면 `ok`.
   - 정확도 값도 저장.
6. **중복 방지**: 이미 출근한 사람은 퇴근 버튼만. 서버에서도 재확인. 출근 후 10분 이내 퇴근 불가.
7. **대리 출근 대응**: 브라우저 localStorage의 기기 ID 기준, 같은 행사에서 같은 기기로 다른 이름이 출근하면
   막지 않고 현황판에 **"동일 기기"** 경고 표시.
8. **시간대**: DB는 UTC(timestamptz). 화면·CSV는 모두 `Asia/Seoul` (`src/lib/time.ts`, timeZone 항상 명시).
9. **관리자 로그인**: 비밀번호 1개(ADMIN_PASSWORD). IP별 **5회 연속 실패 시 5분 잠금** (`admin_login_attempts`, 서버리스라 DB에 저장).
   세션은 APP_SECRET으로 서명한 httpOnly 쿠키.
10. **Supabase 무료판**은 7일 미사용 시 일시정지 → 축제 전날 대시보드 접속해 확인.

## 디자인
모바일 우선, 한글, 큰 버튼. 메인 블루 #2563EB(`brand`), 네이비 #1F3864(`navy`), 흰 배경. 상단 "강원크루" 텍스트 로고.

## 폴더 구조
```
supabase/schema.sql        [정식용, 데모에서 미사용] DB 테이블·파기 함수
scripts/gen-secret.mjs     [정식용] .env.local 생성 + APP_SECRET 자동 채움
scripts/print-lan.mjs      [데모용] 서버 시작 시 LAN IP·접속 주소 콘솔 출력
src/lib/store.ts           [데모] data.json 읽기/쓰기 전담 (나중에 Supabase로 교체할 지점)
src/lib/dashboard.ts       [데모] 현황판 집계(노쇼/명단외/동일기기 계산)
src/lib/qrToken.ts         [데모] QR 토큰 발급·검증 (단순화 버전)
src/lib/network.ts         [데모] LAN IP 탐색
src/lib/env.ts, supabase.ts [정식용, 데모에서 미사용]
src/lib/time.ts            KST 표시 유틸 (공통 사용)
src/components/            Logo 등 공용 컴포넌트
src/app/api/health         [정식용] Supabase 연결 점검
src/app/api/demo/...       [데모] checkin, checkin-state, status, qr-token, export, reset
src/app/e/[eventId]        크루 출퇴근 페이지
src/app/admin/page.tsx     관리자 현황판 (로그인 없음, 데모)
src/app/admin/qr/page.tsx  QR 전시 화면
```

## 진행 단계
### 정식 버전 (Supabase, 보류 중)
- [x] 1단계: 프로젝트 생성 + DB 설계 + Supabase 연결 + git 초기화
- [ ] 2단계 이후: 데모 모드 검증 후 재개 예정 (아래 데모 단계와 별개로 이어감)

### 데모 모드 (진행 중)
- [x] 크루 출퇴근 페이지 (이름/뒷자리 1회 입력 → localStorage 기억 → 출근/퇴근 큰 버튼)
- [x] 관리자 현황판 (전체/출근/미출근/퇴근 집계, 노쇼·명단외·동일기기 표시, 3초 폴링)
- [x] QR 전시 화면 (30초 갱신 카운트다운 + LAN 주소 텍스트 병기)
- [x] CSV 다운로드, 데모 데이터 초기화 버튼
- [x] 로컬 빌드·API 시나리오 테스트 통과 (출근/퇴근/중복퇴근거부/만료토큰거부/동의누락거부)
- [ ] 대표가 휴대폰 실기기로 QR 스캔 → 출근 → 현황판 반영까지 직접 확인
- [ ] GitHub 저장소 연결 + 푸시

## 진행 상황 메모
- 1단계(정식): 코드·스키마 작성 완료, 로컬 빌드 확인. Supabase 키 입력은 보류.
- 데모 모드: 화면·API 전부 구현, 로컬에서 전체 흐름 curl로 검증 완료. GitHub 연결 진행 중.
