import { sleep } from 'k6';
import { Options } from 'k6/options';
import http from 'k6/http';
import { tokens } from '../common/jwt.js';

export const options: Options = {
  stages: [
    { target: 10, duration: '5s' },
    { target: 100, duration: '10s' },
    { target: 0, duration: '5s' },
  ],
};

export default function () {
  const token = tokens[Math.floor(Math.random() * tokens.length)];

  const res = http.get(`http://localhost:3001/api/test`);

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
      } as CustomLog),
    );
  }
  sleep(0.01);
}
