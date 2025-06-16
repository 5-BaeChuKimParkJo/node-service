import { sleep } from 'k6';
import { Options } from 'k6/options';
import http from 'k6/http';

export const options: Options = {
  stages: [
    { target: 1000, duration: '30s' },
    { target: 3000, duration: '30s' },
    { target: 5000, duration: '30s' },
    { target: 10000, duration: '30s' },
    { target: 0, duration: '30s' },
  ],
};

export default function () {
  const bidAmount = 21084 + Math.floor(Math.random() * __ITER * 10);
  const res = http.get(`http://localhost:8088/test`, {
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
