@AGENTS.md

# 강원크루 — QR 출퇴근 웹앱 MVP

축제 현장 스태프(크루)가 QR을 스캔해 출퇴근을 기록하고, 관리자가 실시간 현황을 보고 CSV로 내려받는 모바일 웹앱.
강원 지역 축제 현장 PoC(개념 검증) 테스트용.

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
supabase/schema.sql        DB 테이블·파기 함수 (Supabase SQL Editor에서 실행)
scripts/gen-secret.mjs     .env.local 생성 + APP_SECRET 자동 채움
src/lib/                   env, supabase(서버 전용), time(KST 표시)
src/components/            Logo 등 공용 컴포넌트
src/app/api/health         연결 점검 API (/api/health)
src/app/e/[eventId]        크루 출퇴근 페이지 (2단계)
src/app/admin/...          관리자 화면 (3~4단계)
```

## 진행 단계
- [x] 1단계: 프로젝트 생성 + DB 설계 + Supabase 연결 + git 초기화 (+ Vercel 첫 배포 안내)
- [ ] 2단계: 크루 출퇴근 페이지 (QR 없이 링크로, GPS 검증 포함)
- [ ] 3단계: 관리자 로그인(잠금) + 행사 생성 + 명단 등록 + 현황판(명단 외/동일 기기/위치 미확인 표시)
- [ ] 4단계: QR 토큰 + QR 전시 화면 + 입장권
- [ ] 5단계: CSV 다운로드(UTF-8 BOM, KST) + 휴대폰 실기기 통합 테스트
- [ ] 6단계: 현장 리허설 체크리스트 (동시 접속, 화면 꺼짐 방지, 네트워크 대비)

## 진행 상황 메모
- 1단계: 코드·스키마 작성 완료, 로컬 빌드 확인. 대표가 Supabase 가입·키 입력·schema.sql 실행 후 `/api/health`로 연결 확인 필요.
