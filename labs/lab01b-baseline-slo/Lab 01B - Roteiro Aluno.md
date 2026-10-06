# Lab 01B - Medição de Baseline e Violação de SLO

**Programa:** Modernização 2026 — Engenharia de Software  
**Parceria:** Alura Business & FIAP Corporate  
**Ambiente:** GitHub Codespaces (Linux x86_64, 2 vCPUs, 8 GB RAM)  
**Linguagem & Stack:** Grafana k6 CLI, Docker Compose, Spring Boot 3, PostgreSQL 16  
**Duração:** 40 minutos  

---

## 🎯 Objetivo do Lab

Ao concluir este laboratório, você será capaz de:
1. Submeter a API Bancária a uma esteira de carga realista concorrente cobrindo três rotas fundamentais: `/saldo`, `/extrato` e `/transferencias`.
2. Vivenciar na prática a **falácia da média aritmética** e como a cauda longa (*tail latency*) oculta desastres de experiência de usuário no core banking.
3. Detectar e quantificar a violação formal do **SLO contratado (P99 < 200ms)** no endpoint crítico de `/extrato`.
4. Preencher a **Ficha de Diagnóstico Inicial do Squad** com as métricas do baseline para guiar a investigação nas próximas aulas.

---

## 📋 Pré-requisitos & Materiais

* Contêineres da stack do Core Banking ativos e saudáveis (inicializados no Lab 01A).
* Script declarativo de carga integrada: `scripts/lab1b.js`.
* Terminal bash aberto no Codespaces.

---

## 🚀 Passo a Passo Guiado

### Passo 1: Posicionamento no Diretório do Lab
Acesse o diretório correspondente a esta etapa prática:

```bash
cd labs/lab01b-baseline-slo
```

---

### Passo 2: Validar o Cenário de Carga Integrada (`scripts/lab1b.js`)
Inspecione o script de carga que simula o fluxo misto dos correntistas no aplicativo do banco:

```bash
cat ../../scripts/lab1b.js
```

Observe que este script distribui as chamadas dos usuários virtuais de forma ponderada:
* **70% do tráfego:** Consultas leves de saldo (`/api/v1/contas/{id}/saldo`).
* **20% do tráfego:** Consultas de histórico de extrato (`/api/v1/contas/{id}/extrato`).
* **10% do tráfego:** Transações de transferência (`/api/v1/transferencias`).
* **Concorrência:** 25 Usuários Virtuais (`vus: 25`) durante 40 segundos (`duration: '40s'`).

---

### Passo 3: Executar a Esteira de Carga do Baseline
Dispare o teste completo contra a API bancária:

```bash
k6 run ../../scripts/lab1b.js
```

Aguarde os 40 segundos enquanto o k6 estressa os três endpoints em paralelo.

---

### Passo 4: Auditar a Discrepância Entre Rotas no Sumário
Ao término do teste, o k6 exibirá as tags customizadas por endpoint. Observe a tabela com atenção cirúrgica:

```text
     ✓ status is 200

   ┌───────────────────────────────────────────────────────────────────────────────────────┐
   │ ENDPOINT                     AVG         MED (P50)   P90         P95         P99      │
   ├───────────────────────────────────────────────────────────────────────────────────────┤
   │ /api/v1/contas/.../saldo     3.1ms       2.4ms       5.2ms       7.1ms       14.2ms   │
   │ /api/v1/transferencias       18.4ms      14.2ms      29.8ms      38.4ms      52.0ms   │
   │ /api/v1/contas/.../extrato   420.5ms     380.1ms     560.2ms     680.4ms     890.1ms  │
   └───────────────────────────────────────────────────────────────────────────────────────┘

   ✓ http_req_duration (GLOBAL)...: avg=88.4ms   med=4.2ms   p(90)=390ms   p(95)=540ms   p(99)=810ms
```

#### 🚨 A Falácia Estatística em Ação:
* Olhando a **média global (`avg = 88.4ms`)** ou a **mediana global (`med = 4.2ms`)**, a diretoria de tecnologia acreditaria que o sistema está voando baixo.
* No entanto, a rota de **`/extrato`** tem o **P99 explodindo em ~890ms**, com tempo médio de ~420ms.
* **O Contrato de SLO:** Nosso SLO acordado para consultas bancárias é **P99 < 200ms**.
* **Diagnóstico Preliminar:** O SLO foi **VIOLADO EM MAIS DE 4X**.

---

### Passo 5: Preenchimento da Ficha de Medição do Squad
Reúna-se com os integrantes do seu squad e compilem o diagnóstico executivo na tabela abaixo:

| Métrica de Engenharia | Valor Medido | Meta de SLO | Situação |
| :--- | :---: | :---: | :---: |
| **Throughput Global da API (TPS)** | *[Preencher]* req/s | $\ge 50$ req/s | [ ] Atendido [ ] Violado |
| **Latência P50 do `/extrato`** | *[Preencher]* ms | $\le 100$ ms | [ ] Atendido [ ] Violado |
| **Latência P99 do `/extrato`** | *[Preencher]* ms | $\le 200$ ms | [ ] Atendido [x] **VIOLADO** |
| **Taxa de Erros HTTP (`http_req_failed`)**| *[Preencher]* % | $0.00\%$ | [ ] Atendido [ ] Violado |

#### 📝 Dilema de Investigação do Squad:
Discutam brevemente entre si e respondam:  
*"O k6 provou matematicamente que o `/extrato` está lento, mas ele é capaz de apontar se o culpado é I/O de rede, overhead de serialização JSON, concorrência de pool de conexão ou uma slow query no PostgreSQL?"*

> **Spoiler:** O k6 atua como uma "caixa-preta externa". Na **Aula 02**, utilizaremos **Distributed Tracing (Jaeger)** e **EXPLAIN ANALYZE no banco** para abrir o capô e achar a linha exata da degradação.

---

## 🧪 Validação & Critérios de Aceite

O laboratório é considerado **concluído com sucesso** quando:
* [x] A esteira integrada `scripts/lab1b.js` executou até o fim com sucesso nas 3 rotas.
* [x] O squad coletou e confirmou os percentis P50, P90 e P99 específicos do endpoint `/extrato`.
* [x] O squad constatou a quebra do SLO (P99 > 200ms) e compartilhou os números do baseline no chat do Teams.

---

## 🧹 Cleanup

Ao encerrar as atividades práticas da Aula 01, encerre os contêineres e libere os recursos do Codespaces:

```bash
docker compose -f ../../docker-compose.yml down
cd ..
```

---

## 💡 Desafios Complementares (Para Alunos Avançados)

Se o squad desejar automatizar a governança de engenharia como código via **Thresholds do k6**:

1. Crie uma cópia do script para inserir a trava:
   ```bash
   cp ../../scripts/lab1b.js ./lab1b-threshold.js
   ```
2. Adicione ao bloco `options` do `lab1b-threshold.js` a regra de falha no pipeline:
   ```javascript
   export const options = {
     vus: 25,
     duration: '30s',
     thresholds: {
       // O pipeline deve falhar imediatamente se o P99 do extrato passar de 200ms
       'http_req_duration{name:extrato}': ['p(99)<200'],
     },
   };
   ```
3. Execute o script:
   ```bash
   k6 run lab1b-threshold.js
   ```
4. Verifique a saída do terminal: o k6 exibirá uma cruz vermelha (`✗`) no threshold e retornará o código de saída de erro `exit 99` (`echo $?`), provando como um pipeline de CI/CD moderno barra deploys degradados antes de atingirem a produção!
