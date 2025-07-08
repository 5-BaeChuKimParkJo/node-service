import { sleep } from 'k6';
import { Options } from 'k6/options';
import http from 'k6/http';

export const options: Options = {
  vus: 3000,
  duration: '15s',
};

export default function () {
  const res = http.get(`http://localhost:3001/api/test/db/update-rand/${__ITER}`);
  sleep(1);
}
