# 내 경매 조회

`GET /api/v1/auctions/mine`은 검증된 access JWT의 판매자만 조회한다.
예전 catalog 사용자별 URL을 고객 웹의 새로운 조회 계약에서 제거한다.
기존 catalog HTTP 계약·입찰·결제·이벤트 동작은 변경하지 않는다.

query는 `q`(공백 제거 후 최대80자), `status`(all/waiting/active/ended/hidden/cancelled),
`sort`(recent/ending/price), `page`(1~10000 정수 문자열)다. 기본은 빈 검색/all/recent/1,
pageSize20이다. 다른 query 키·배열·잘못된 페이지는400이며 JWT 오류는401이다.
성공 응답은 private/no-store다. 헤더/query/cookie의 별도 회원 UUID를 신뢰하지 않는다.

응답은 items, summary, total, page, pageSize다. summary는 필터와 무관한 본인 전체
상태별 수이며 total은 검색/상태 필터 결과 수다. 두 SELECT는 동일 서버 시각과
repeatable-read 트랜잭션에서 실행한다. soft delete는 제외하고 숨김/취소는 본인에게만
표시한다. 나머지는 endAt<=now 종료, startAt>now 대기, 그 외 진행이다.

최근 등록(createdAt DESC), 마감(endAt ASC), 가격(greatest(currentBid,minimumBid) DESC)
순을 제공하며 동률은 auctionId DESC로 고정한다. 입찰 횟수는 삭제되지 않은 입찰
레코드 수로 같은 사람의 반복 입찰도 센다. 금액은 int8 범위의 십진 문자열을 유지한다.
썸네일·제목·상태·시각·금액·입찰 수만 보내며 판매자/입찰자/구매자 UUID·결제 키·
설명 원문은 응답하지 않는다. 경매마다 HTTP 요청을 추가하지 않는다.

`20261030043000_my_sales_index`는 sellerUuid/createdAt/auctionId 인덱스만 추가한다.
기존 행을 변경하거나 초기화하지 않는다. 로컬 Docker/운영 DB에서 테스트하지 않는다.

## 검증과 한계

실제 Nest/Fastify HTTP16건 포함 전체 단위415건, checker22·명명·의존 방향·포맷과
4개 앱 빌드를 통과했다. 단위의 보호된 DB/Kafka70건 skip은 DB 검증 성공이 아니다.
신규 실제 PostgreSQL5건은 기존 격리 `_test` DB 통합 실행기에 포함했다:
소유자 격리/삭제 제외/시간 경계/상태별 수, 문자 그대로의 검색과 상태, 큰 금액과
입찰 레코드 수, 20개 페이지·동률·범위 초과, 가격·마감 정렬이다. 전체 CI에서 실행한다.

페이지별 요청 사이의 전체 스냅샷은 유지하지 않는다. 데이터 변경 시 페이지 구성이
달라질 수 있다. offset 방식은 포트폴리오 규모를 전제로 하며 최대10000페이지다.
더 큰 규모에는 커서 조회와 카운트 전략을 다시 검토한다. 조회 결과로 판매/결제
완료를 추정하거나 가격·입찰·주문을 갱신하지 않는다.
