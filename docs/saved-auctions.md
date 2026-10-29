# 관심 경매 저장

기존 경매 서비스에 개인별 관심 경매 저장소를 추가한다. JWT가 검증한 회원 UUID만
소유자로 사용하며 application service/port → PostgreSQL adapter 의존 방향을 따른다.
클라이언트가 회원 UUID를 지정하거나 입찰·결제 상태를 변경할 수 없다.

## API와 데이터

| 메서드 | `/api/v1` 이후 경로 | 결과 |
| --- | --- | --- |
| GET | `/auctions/saved?cursor=...` | `items` 최대 20개와 `nextCursor` |
| GET | `/auctions/:uuid/saved` | `{saved:boolean}` |
| PUT | `/auctions/:uuid/saved` | `{saved:true}` |
| DELETE | `/auctions/:uuid/saved` | `{saved:false}` |

전부 access JWT가 필요하며 성공 응답은 private/no-store다. UUID·query·빈 mutation
객체를 검증한다. PUT/DELETE JSON 본문은 `{}`다. 다른 소유자 필드는 거절한다.
cursor는 양의 signed int8 범위 문자열이다. 가격도 문자열로 응답해 JS 정밀도를 보존한다.

`20261029150000_saved_auctions`는 SavedAuction 테이블·인덱스·FK만 추가한다.
memberUuid+auctionUuid 유일 제약으로 동시 PUT도 한 행이고 최초 savedId/time을
보존한다. 경매 물리 삭제 시 FK cascade로 관심 행을 정리한다. 기존 테이블·데이터·
sequence를 초기화하지 않는다. 다른 서비스 DB의 회원 테이블에는 FK를 두지 않는다.

목록은 owner·공개/미삭제 조건을 먼저 적용한 뒤 savedId 내림차순 21행을 읽어
20행과 다음 cursor를 반환한다. 숨김·취소·삭제 경매는 상태 조회/저장에 404이며
목록에서 제외한다. 해제는 접근 불가능해진 경매도 본인 행만 지우고 반복해도 성공한다.
공개 복구 시 기존 관심 행은 다시 보일 수 있다. 종료 여부는 서버 시각으로 계산하며
가격과 상태는 조회 시점 값이다. 이 API는 이벤트·순위·입찰·결제·알림을 생성하지 않는다.

## 검증 · 2026-10-30

실제 Nest/Fastify HTTP 17건과 시각 경계 3건을 포함해 단위 399건을 통과했다.
65건의 DB/Kafka 검증은 기본 unit 실행에서 보호 조건에 따라 skip되며 성공으로
계산하지 않는다. checker 22건·이름·의존 방향·포맷과 4개 Nest 앱 빌드도 통과했다.

새 PostgreSQL 통합 7건은 실제 DB에서 동시 12회 저장, 시간/ID 보존, 소유자 격리,
숨김/취소/삭제 제외·해제, 정밀도·20개 cursor 경계, FK cascade를 검증한다.
기존 `test:payment:integration` 실행기에 포함했으며 loopback의 disposable `_test`
DB만 허용한다. 로컬 운영 DB로 실행하지 않고 전체 CI의 PostgreSQL에서 실행한다.

cursor 문자/소수 입력이 BigInt 변환에서 500이 되던 RED를 400으로 수정했다.
JSON DELETE 무본문 400도 재현해 FE가 `{}`를 보내도록 계약을 맞췄다.
FE의 action 전체 102건과 실제 프로덕션 Next/fixture 브라우저 8건은 별도 저장소 근거다.

배포는 백엔드 전체 CI → additive migration·새 이미지 준비 → FE 순서다.
검증용 실제 체험 계정 관심 상태를 바꾸면 원상복구하며 운영 금융 요청을 만들지 않는다.
