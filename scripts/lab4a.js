import http from 'k6/http';
import { check, sleep } from 'k6';

// =====================================================================
// LAB 04A: Diagnóstico de Esgotamento de Conexões (HikariCP Starvation)
// =====================================================================
// Meta: Submeter a API Bancária a 40 VUs concorrentes sob pool estrangulado
// (maximum-pool-size = 2) e diagnosticar o estouro do P99 por fila de pool.
// =====================================================================

export const options = {
  vus: 40,
  duration: '35s',
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  thresholds: {
    // Threshold de integridade: sob starvation, avaliamos o impacto no P99
    'http_req_duration{name:extrato}': ['p(99)<200'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

export default function () {
  const rand = Math.random();
  const contaId = Math.floor(Math.random() * 100) + 1001; // Contas entre 1001 e 1100

  if (rand < 0.60) {
    // 60% do tráfego: Consulta de extrato (Demanda conexão com o banco)
    const resExtrato = http.get(`${BASE_URL}/api/v1/contas/${contaId}/extrato`, {
      tags: { name: 'extrato' },
    });
    check(resExtrato, {
      'extrato status is 200': (r) => r.status === 200,
    });
  } else if (rand < 0.85) {
    // 25% do tráfego: Consulta de saldo
    const resSaldo = http.get(`${BASE_URL}/api/v1/contas/${contaId}/saldo`, {
      tags: { name: 'saldo' },
    });
    check(resSaldo, {
      'saldo status is 200': (r) => r.status === 200,
    });
  } else {
    // 15% do tráfego: Transferência (Escrita transacional)
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

  sleep(0.05); // 50ms think time
}
