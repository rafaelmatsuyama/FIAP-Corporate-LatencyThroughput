import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 25,
  duration: '40s',
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

export default function () {
  const rand = Math.random();
  const contaId = Math.floor(Math.random() * 100) + 1001; // Contas entre 1001 e 1100

  if (rand < 0.70) {
    // 70% do tráfego: Consulta rápida de saldo
    const resSaldo = http.get(`${BASE_URL}/api/v1/contas/${contaId}/saldo`, {
      tags: { name: 'saldo' },
    });
    check(resSaldo, {
      'saldo status is 200': (r) => r.status === 200,
    });
  } else if (rand < 0.90) {
    // 20% do tráfego: Consulta pesada de extrato (Sem índice no banco -> Cauda Longa)
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
      valor: 50.0,
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
