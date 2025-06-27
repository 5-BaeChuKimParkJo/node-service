import { sleep } from 'k6';
import { Options } from 'k6/options';
import http from 'k6/http';
import { tokens } from '../common/jwt.js';

export const options: Options = {
  stages: [
    { target: 100, duration: '5s' },
    { target: 10000, duration: '10s' },
    { target: 0, duration: '5s' },
  ],
};

export default function () {
  const token = tokens[Math.floor(Math.random() * tokens.length)];

  const auctionUuid = '0d5acf41-cca3-45e3-a29e-983ff23369f6';
  const bidAmount = 10000 + Math.floor(Math.random() * __ITER * 10);
  const res = http.post(`http://localhost:3001/api/v2/auctions/${auctionUuid}/bidders`, JSON.stringify({ bidAmount }), {
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
  sleep(1);
}
