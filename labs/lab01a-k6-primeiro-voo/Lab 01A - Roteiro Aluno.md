# Lab 01A - Primeiro Voo com k6 e Métricas de Performance

**Programa:** Modernização 2026 — Engenharia de Software  
**Parceria:** Alura Business & FIAP Corporate  
**Ambiente:** GitHub Codespaces (Linux x86_64, 2 vCPUs, 8 GB RAM)  
**Linguagem & Stack:** Grafana k6 CLI, Docker Compose, Spring Boot 3 (Java 21)  
**Duração:** 35 minutos  

---

## 🎯 Objetivo do Lab

Ao concluir este laboratório, você será capaz de:
1. Subir e validar a infraestrutura da API bancária em contêineres via `docker compose`.
2. Executar testes de carga scriptados como código utilizando o **Grafana k6**.
3. Ler e interpretar criticamente a saída tabular de métricas no terminal: TPS (`http_reqs`), usuários virtuais (`vus`), média, mediana (P50), P90 e P95 (`http_req_duration`).
4. Reconhecer por que testes restritos a rotas ultraleves (`/health` e `/saldo`) geram uma falsa sensação de segurança.

---

## 📋 Pré-requisitos & Materiais

* GitHub Codespaces ativo na raiz do repositório `FIAP-Corporate-LatencyThroughput`.
* Terminal bash integrado aberto.
* Arquivos do repositório:
  * `docker-compose.yml`: Definição dos serviços de infraestrutura e aplicação.
  * `scripts/lab1a.js`: Script declarativo de carga leve em JavaScript do k6.

---

## 🚀 Passo a Passo Guiado

### Passo 1: Navegar para o Diretório de Trabalho
No terminal do Codespaces, certifique-se de que está posicionado na raiz do projeto:

```bash
pwd
# Saída esperada: /workspaces/FIAP-Corporate-LatencyThroughput
```

Acesse o diretório do laboratório:
```bash
cd labs/lab01a-k6-primeiro-voo
```

---

### Passo 2: Inicializar a Stack de Contêineres
Suba todos os serviços de suporte (PostgreSQL, Redis, Jaeger, Prometheus, Grafana e a API Bancária Core) em background a partir da raiz:

```bash
docker compose -f ../../docker-compose.yml up -d
```

Aguarde a criação dos contêineres e valide se todos estão no estado `Up` (ou `healthy`):

```bash
docker compose -f ../../docker-compose.yml ps
```

*Saída esperada:*
```text
NAME                     IMAGE                      STATUS
banco-api                banco-api:latest           Up (healthy)
banco-postgres           postgres:16-alpine         Up
banco-redis              redis:7-alpine             Up
telemetria-jaeger        jaegertracing/all-in-one   Up
telemetria-prometheus    prom/prometheus:latest     Up
telemetria-grafana       grafana/grafana:latest     Up
```

---

### Passo 3: Testar a API Bancária Manualmente (`Smoke Test`)
Antes de estressar a aplicação, faça requisições manuais via `curl` para certificar que os endpoints respondem com HTTP 200:

1. Checagem de integridade (*Health Check*):
   ```bash
   curl -i http://localhost:8080/health
   ```
   *Saída esperada:* `HTTP/1.1 200 OK` com `{"status":"UP"}`.

2. Consulta de saldo de conta simulada:
   ```bash
   curl -i http://localhost:8080/api/v1/contas/1001/saldo
   ```
   *Saída esperada:* `HTTP/1.1 200 OK` com payload contendo `conta: 1001` e `saldo`.

---

### Passo 4: Inspecionar o Script do k6 (`scripts/lab1a.js`)
Visualize o script declarativo de teste que executaremos:

```bash
cat ../../scripts/lab1a.js
```

Observe a anatomia do script:
* **`options`:** Define a intensidade do teste (10 Usuários Virtuais - `vus: 10` durante 30 segundos - `duration: '30s'`).
* **`default function()`:** O fluxo executado continuamente por cada VU em loop, chamando `/health` e `/api/v1/contas/1001/saldo` com um tempo de respiro de 100ms (`sleep(0.1)`).

---

### Passo 5: Executar o Primeiro Voo de Carga com k6
Dispare o teste de carga a partir do terminal:

```bash
k6 run ../../scripts/lab1a.js
```

O k6 exibirá uma barra de progresso durante os 30 segundos de execução.

---

### Passo 6: Interpretar o Resumo de Métricas no Terminal
Ao finalizar, o k6 imprime uma tabela detalhada. Localize as seguintes métricas-chave:

```text
     ✓ status is 200

     checks.........................: 100.00% ✓ 2400      ✗ 0   
     data_received..................: 580 kB  19 kB/s
     data_sent......................: 210 kB  7.0 kB/s
     http_req_blocked...............: avg=18.4µs  min=1.2µs  med=4.1µs   max=1.8ms   p(90)=9.2µs   p(95)=12.1µs
     http_req_connecting............: avg=2.1µs   min=0s     med=0s      max=620µs   p(90)=0s      p(95)=0s    
   ✓ http_req_duration..............: avg=3.82ms  min=1.1ms  med=2.91ms  max=42.1ms  p(90)=6.1ms   p(95)=8.4ms 
     http_req_failed................: 0.00%   ✓ 0         ✗ 2400
     http_reqs......................: 2400    80.00/s
     vus............................: 10      min=10      max=10
```

#### 🔍 Como ler cada indicador:
1. **`http_reqs (TPS / Vazão):`** Quantidade total de requisições e a taxa por segundo (ex: `80.00/s`).
2. **`http_req_duration (Latência):`**
   * `avg` (Média): Tempo médio de resposta (~3.8ms).
   * `med` (Mediana / P50): 50% das requisições foram atendidas em até ~2.9ms.
   * `p(90)` e `p(95)`: Percentil 90 e 95. 95% das consultas levaram menos de 8.4ms.
3. **`http_req_failed:`** Percentual de erros HTTP (deve ser estritamente `0.00%`).

---

## 🧪 Validação & Critérios de Aceite

O laboratório é considerado **concluído com sucesso** quando:
* [x] A stack do `docker compose` está íntegra com todos os contêineres ativos.
* [x] O teste com k6 executou sem falhas de rede (`http_req_failed: 0.00%`).
* [x] A rota `/saldo` respondeu com `http_req_duration` estável em sub-milissegundos (< 15ms no P95).
* [x] O aluno publica no chat do squad os valores de: **TPS médio**, **P50** e **P95**.

---

## 🧹 Cleanup

Como utilizaremos a mesma infraestrutura no **Lab 01B**, **não derrube os contêineres**.  
Apenas retorne ao diretório raiz de laboratórios:

```bash
cd ..
```

---

## 💡 Desafios Complementares (Para Alunos Avançados)

Se o seu squad concluiu a etapa guiada antes do tempo, experimente implementar uma **rampa suave de carga (Stages)**:

1. Crie uma cópia do script do k6:
   ```bash
   cp ../../scripts/lab1a.js ./lab1a-rampa.js
   ```
2. Edite `lab1a-rampa.js` substituindo o bloco de `options` por:
   ```javascript
   export const options = {
     stages: [
       { duration: '10s', target: 20 }, // Sobe para 20 VUs em 10s
       { duration: '20s', target: 50 }, // Mantém 50 VUs por 20s
       { duration: '10s', target: 0 },  // Desce suavemente para 0
     ],
   };
   ```
3. Execute o teste com rampa:
   ```bash
   k6 run lab1a-rampa.js
   ```
4. Observe no terminal como o throughput e a latência se comportam durante a fase de pico de 50 VUs.
