import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';

// =====================================================================
// LAB 04B: Defesa de Borda com Rate Limiting (Token Bucket)
// =====================================================================
// Meta: Submeter a API a uma avalanche de 100 VUs simultâneas para
// comprovar a proteção do core bancário:
// 1. Tráfego dentro da cota: HTTP 200 OK (< 2ms).
// 2. Tráfego excedente: HTTP 429 Too Many Requests (< 1ms).
// =====================================================================

const acceptedRequests = new Counter('http_requests_accepted_200');
const rateLimitedRequests = new Counter('http_requests_rate_limited_429');
const rateLimitedRatio = new Rate('rate_limited_ratio');

export const options = {
  vus: 100,
  duration: '30s',
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  thresholds: {
    // A latência das requisições autorizadas (200) deve permanecer em patamar excelente
    'http_req_duration{status:200}': ['p(99)<50'],
    // Comprovamos que a taxa de limitação atua ativamente protegendo a borda
    'rate_limited_ratio': ['rate>0.20'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

export default function () {
  const contaId = Math.floor(Math.random() * 100) + 1001; // Contas entre 1001 e 1100

  const res = http.get(`${BASE_URL}/api/v1/contas/${contaId}/extrato`, {
    tags: { name: 'extrato' },
  });

  const isAccepted = res.status === 200;
  const isRateLimited = res.status === 429;

  check(res, {
    'status is 200 (OK) or 429 (Rate Limited)': (r) => r.status === 200 || r.status === 429,
    'retry-after header present on 429': (r) => r.status !== 429 || r.headers['Retry-After'] !== undefined,
  });

  if (isAccepted) {
    acceptedRequests.add(1);
    rateLimitedRatio.add(0);
  } else if (isRateLimited) {
    rateLimitedRequests.add(1);
    rateLimitedRatio.add(1);
  }

  sleep(0.02); // 20ms think time para manter rampa agressiva
}
