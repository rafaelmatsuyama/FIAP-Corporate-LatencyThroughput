import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 10,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'], // Menos de 1% de erros
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

export default function () {
  // 1. Health check da API
  const resHealth = http.get(`${BASE_URL}/health`, {
    tags: { name: 'health' },
  });
  check(resHealth, {
    'health status is 200': (r) => r.status === 200,
  });

  // 2. Consulta de saldo (rota ultraleve em memória)
  const resSaldo = http.get(`${BASE_URL}/api/v1/contas/1001/saldo`, {
    tags: { name: 'saldo' },
  });
  check(resSaldo, {
    'saldo status is 200': (r) => r.status === 200,
  });

  sleep(0.1); // 100ms de think time
}
