import http from 'k6/http';
import { check, sleep } from 'k6';

// =====================================================================
// LAB 03A: Validação de Performance Pós-Indexação no PostgreSQL
// =====================================================================
// Meta: Atestar que com o índice composto (conta_id, data_transacao DESC),
// o endpoint de extrato passa a cumprir o SLO bancário de P99 < 200ms.
// =====================================================================

export const options = {
  vus: 25,
  duration: '35s',
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  thresholds: {
    // Threshold formal de SLO bancário: P99 < 200ms
    'http_req_duration{name:extrato}': ['p(99)<200'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

export default function () {
  const rand = Math.random();
  const contaId = Math.floor(Math.random() * 100) + 1001; // Contas entre 1001 e 1100

  if (rand < 0.65) {
    // 65% do tráfego: Consulta rápida de saldo
    const resSaldo = http.get(`${BASE_URL}/api/v1/contas/${contaId}/saldo`, {
      tags: { name: 'saldo' },
    });
    check(resSaldo, {
      'saldo status is 200': (r) => r.status === 200,
    });
  } else if (rand < 0.90) {
    // 25% do tráfego: Consulta de extrato (Index Scan no PostgreSQL)
    const resExtrato = http.get(`${BASE_URL}/api/v1/contas/${contaId}/extrato`, {
      tags: { name: 'extrato' },
    });
    check(resExtrato, {
      'extrato status is 200': (r) => r.status === 200,
    });
  } else {
    // 10% do tráfego: Transação de transferência (Escrita com índice)
    const payload = JSON.stringify({
      contaOrigem: contaId,
      contaDestino: 2000,
      valor: 25.0,
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

  sleep(0.05); // 50ms think time
}
