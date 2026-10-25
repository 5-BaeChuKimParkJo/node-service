# 찰낙찰낙 · Auction Service

경매·입찰·낙찰자 결제와 관리자 업무 API를 제공하는 NestJS / Fastify 서비스다.
이 저장소의 현재 배포 대상은 `auction-service` 한 개다.
기준일: 2026-10-25.

## 역할과 데이터 흐름

- 경매 생성·조회·운영 처리, 입찰 이력과 Kafka 입찰 처리.
- PostgreSQL `cn_auction`의 업무 데이터·결제·관리 이력·Outbox 저장.
- Debezium → Kafka → Search Service로 검색 사본 갱신.
- 낙찰자 전용 Toss 테스트 결제, 결과 미확정 상태 확인과 관리자 전액 취소.
- 최근 24시간 인기 경매와 5분 주기 활성 데모 보충.

입찰 접수는 성공 확정이 아니다. 고객 웹은 저장된 입찰 내역으로 결과를 확인한다.
DB와 검색 간에는 비동기 지연이 있고, Kafka 전체 경로 exactly-once를 보장하지 않는다.
결제·데모 동시성 보호와 기존 입찰 Consumer의 실패 복구 한계는
[아키텍처](https://github.com/5-BaeChuKimParkJo/FE-Service/blob/main/docs/portfolio/architecture.md)에 설명했다.

## 폴더 구조

```text
apps/auction-service/src/auction       경매 domain / application / adapter
apps/auction-service/src/auction-etc   기존 입찰 배치 처리
apps/auction-service/src/payment       테스트 결제
apps/auction-service/src/prisma        스키마·마이그레이션·생성 클라이언트
libs/common                           Kafka·스토리지·공통 구현
scripts                               정적 검사·격리 DB 테스트 실행기
docs                                  기능·보안 감사·설계 기록
```

`catalog-query-service`, `notification-service`, `notification-consumer-service`는
보존된 앱이며 홈랩 배포 대상이 아니다. 일부 명령이 이 앱들의 빌드를 포함해도
서비스가 실제로 가동된다는 뜻은 아니다.

## 로컬 실행과 검증

Node.js 22 / npm 10.9.4 기준이다. DB·Redis·Kafka·MinIO와 서버 환경 변수는
별도로 준비한다. 단순 실행을 위해 운영 Secret이나 운영 DB를 테스트에 복사하지 않는다.

```powershell
npm ci
npm run prisma:auction-service:generate
npm run prisma:notification-consumer-service:generate
npx nest start auction-service --watch
```

```powershell
npm run test:checks
npm run check:naming
npm run check:architecture
npm run check:format
npm run test:unit
npm run build:all
```

`npm run test:payment:integration`은 loopback의 버려도 되는 `_test` PostgreSQL을
`TEST_DATABASE_URL`로 지정한 경우에만 실행한다. 마이그레이션과 fixture 정리를 포함한다.
기본 unit에서 DB 테스트가 skip된 결과는 실제 DB 검증 성공과 다르다.
Windows의 Kafka 네이티브 바인딩 제약과 Linux 검증은 [보안·환경 기록](docs/security-audit.md)을 참고한다.

## 배포와 문서

main CI 검증 후 `ghcr.io/5-baechukimparkjo/auction-service:<commit-sha>`를 게시한다.
시작 시 Prisma migration deploy를 수행한다. 새 스키마가 필요한 릴리스는
기능 플래그를 끈 채 마이그레이션과 Pod Ready를 확인한 뒤 활성화한다.

- [전체 아키텍처](https://github.com/5-BaeChuKimParkJo/FE-Service/blob/main/docs/portfolio/architecture.md)
- [데모 보충·수동 생성](docs/demo-auctions.md)
- [결제 구현·검증](apps/auction-service/src/payment/README.md)
- [검증 근거](https://github.com/5-BaeChuKimParkJo/FE-Service/blob/main/docs/portfolio/verification.md)
- [비공개 GitOps](https://github.com/chuman0216/cncn_private)
- [코드·커밋 규칙](CONTRIBUTING.md)
