import { sleep } from 'k6';
import { Options } from 'k6/options';
import http from 'k6/http';
import { tokens } from '../common/jwt.js';

export const options: Options = {
  stages: [
    { target: 100, duration: '30s' },
    { target: 300, duration: '30s' },
    { target: 500, duration: '30s' },
    { target: 1000, duration: '30s' },
    { target: 0, duration: '30s' },
  ],
};

export default function () {
  const token = tokens[Math.floor(Math.random() * tokens.length)];

  const auctionUuid = 'f4404fbe-364b-4566-8a02-a1a9aa47b6dd';
  const bidAmount = 21084 + Math.floor(Math.random() * __ITER * 10);
  const res = http.post(`http://localhost:3001/api/v1/auctions/${auctionUuid}/bidders`, JSON.stringify({ bidAmount }), {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    tags: { name: '경매 조회 API' },
  });

  // 출력결과 저장
  if (res.status >= 400) {
    const body = JSON.parse(String(res.body));
    const message = body?.message ?? '';
    console.log(
      JSON.stringify({
        type: 'CustomLog',
        logType: 'failed',
        time: new Date().toISOString(),
        message,
      } as CustomLog),
    );
  } else {
    console.log(
      JSON.stringify({
        type: 'CustomLog',
        logType: 'success',
        time: new Date().toISOString(),
        message: '',
        args: { bidAmount },
      } as CustomLog),
    );
  }
  sleep(0.2);
}
