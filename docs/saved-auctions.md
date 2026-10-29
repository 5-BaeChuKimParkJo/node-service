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
FE의 action 전체 102건과 실제 프로덕션 Next/fixture 브라우저 10건은 별도 저장소 근거다.

배포는 백엔드 전체 CI → additive migration·새 이미지 준비 → FE 순서다.
검증용 실제 체험 계정 관심 상태를 바꾸면 원상복구하며 운영 금융 요청을 만들지 않는다.

## 실제 CI와 백엔드 배포 · 2026-10-30

런타임 `d70874936f8491c8a3de15ba0b4db5cdee0788fd`의
[CI 40902755518](https://github.com/5-BaeChuKimParkJo/node-service/actions/runs/40902755518)
가 전체 성공했다. 실제 로그에서 신규 SavedAuction PostgreSQL 7건 포함 통합 62건,
실제 Kafka/PostgreSQL 복구 4건, 단위 399건과 모든 정적 검사·4개 빌드 통과,
조직 GHCR 게시를 확인했다. unit의 보호된 65 skip을 통합 성공에 합산하지 않는다.

GitOps `237275607142087f2c786de7e0aaa97fba4badb1`가 새 auction 이미지를 반영했다.
해당 이미지의 새 파드에서 `20261029150000_saved_auctions` 적용과 모든 migration 성공,
Ready·재시작 0, rollout 완료, Argo Synced/Healthy를 확인한 뒤 FE를 게시한다.

독립 리뷰는 backend `7335ece..d708749`, FE `8d2c25b..99eeb34`를 함께 읽었다.
백엔드 Critical/Important/Minor는 없었다. FE의 거절된 쿠키 로그인 복구 Important 1건은
실제 브라우저 RED→GREEN으로 수정했다. 해당 두 경우를 포함한 FE 브라우저 10건과
기존 결제·짧은 데모 회귀 3건이 통과했다. 재리뷰 대신 작성자가 전체 검증을 실행했다.

리뷰에서 제외한 기존 인증/세션 갱신·결제 전체 동작은 그대로다(기존 장애는 별도 해결).
기존 상세 API 숫자 표현도 유지한다(상세의 큰 금액 반올림은 이 기능이 해결하지 않는다).
동시 삭제 중 페이지 구성 변화와 공개 체험 계정 공동 사용도 제한으로 유지한다
(페이지 구성 변화와 다른 체험자의 관심 항목 노출 가능). 새 목록은 정밀도를 보존하고
일반 개인 계정은 검증된 JWT 소유자로 격리한다. 보류한 Minor는 없다.

## 운영 최종 확인 · 2026-10-30

FE 런타임 `93eeb2ebffc4955b6e13fcd7ea6d6263896c9c2f`의
[CI 40904253992](https://github.com/5-BaeChuKimParkJo/FE-Service/actions/runs/40904253992)
도 성공했고 GitOps `9ed5ec4de7c2a1b1fd57a47960edd5facd1fcb65`가 반영했다.
새 frontend 파드 Ready·재시작 0, rollout 완료와 Argo Synced/Healthy를 확인했다.

실제 체험 계정에서 미등록 경매 하나만 등록 → 새로고침 유지 → 별도 데스크톱·모바일
브라우저 목록 조회 → 모바일 해제 → 상세 재조회까지 성공했다. 원래 미등록 상태로
복구했고 기존 관심 항목은 변경하지 않았다. 자격 증명은 출력/저장하지 않았고,
브라우저의 입찰·결제·업로드 POST는 0건이었다. 장애·토큰 만료·경합을 운영에서
주입하지 않았다. 그 경로는 격리 DB/fixture 검증과 구분한다.
