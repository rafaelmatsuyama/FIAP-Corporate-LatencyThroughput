import http from 'k6/http';
import { check, sleep } from 'k6';

// =====================================================================
// LAB 03B: Validação de Performance com Cache-Aside (Redis)
// =====================================================================
// Meta: Atestar que com o padrão Cache-Aside ativo no endpoint de extrato,
// a latência despenca para sub-milissegundos (~2ms) no P99, e a vazão
// suporta alta concorrência com consumo mínimo de recursos do banco.
// =====================================================================

export const options = {
  vus: 40,
  duration: '35s',
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  thresholds: {
    // Com Cache Redis ativo, o P99 deve ser inferior a 20ms (típico: 1.5ms - 3ms)
    'http_req_duration{name:extrato}': ['p(99)<20'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

export default function () {
  const rand = Math.random();
  const contaId = Math.floor(Math.random() * 100) + 1001; // Contas entre 1001 e 1100

  if (rand < 0.60) {
    // 60% do tráfego: Consulta rápida de saldo
    const resSaldo = http.get(`${BASE_URL}/api/v1/contas/${contaId}/saldo`, {
      tags: { name: 'saldo' },
    });
    check(resSaldo, {
      'saldo status is 200': (r) => r.status === 200,
    });
  } else if (rand < 0.90) {
    // 30% do tráfego: Consulta de extrato com Cache-Aside no Redis
    const resExtrato = http.get(`${BASE_URL}/api/v1/contas/${contaId}/extrato`, {
      tags: { name: 'extrato' },
    });
    check(resExtrato, {
      'extrato status is 200': (r) => r.status === 200,
    });
  } else {
    // 10% do tráfego: Transação de transferência
    const payload = JSON.stringify({
      contaOrigem: contaId,
      contaDestino: 2000,
      valor: 15.0,
    });
    const headers = { 'Content-Type': 'application/json' };
    const resTransf = http.post(`${BASE_URL}/api/v1/transferencias`, payload, {
      headers,
      tags: { name: 'transferencias' },
    });
    check(resTransf, {
      'transferencia status is 200 or 201': (r) => r.status === 200 || r.status === 201,
    });
  }

  sleep(0.02); // 20ms think time (carga agressiva)
}
