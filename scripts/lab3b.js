import http from 'k6/http';
import { check, sleep } from 'k6';

// =====================================================================
// LAB 03B (Parte 2): Consagração - Validação da Camada Blindada (Redis)
// =====================================================================
// Meta: Atestar que com 100% do tráfego direcionado para o endpoint com
// Cache-Aside no Redis, a latência colapsa para sub-milissegundos (~2ms a 4ms),
// o PostgreSQL permanece em repouso absoluto e o throughput atinge pico máximo.
// =====================================================================

export const options = {
  vus: 35,
  duration: '35s',
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  thresholds: {
    // Com Cache Redis ativo em 100% do tráfego, o P99 deve ser inferior a 20ms
    'http_req_duration{name:extrato}': ['p(99)<20'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

export default function () {
  const contaId = Math.floor(Math.random() * 100) + 1001; // Contas entre 1001 e 1100

  // 100% do tráfego: Consulta de extrato com Cache-Aside no Redis (In-Memory)
  const resExtrato = http.get(`${BASE_URL}/api/v1/contas/${contaId}/extrato`, {
    tags: { name: 'extrato' },
  });

  check(resExtrato, {
    'extrato status is 200': (r) => r.status === 200,
  });

  sleep(0.04); // 40ms think time
}
