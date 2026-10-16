# Lab 04A - Diagnóstico de Esgotamento de Conexões no HikariCP (Pool Starvation)

**Programa:** Modernização 2026 — Engenharia de Software  
**Parceria:** Alura Business & FIAP Corporate  
**Ambiente:** GitHub Codespaces / Docker Local (Linux x86_64, 2 vCPUs, 8 GB RAM)  
**Linguagem & Stack:** Java 21 / Spring Boot 3, HikariCP, PostgreSQL 16, Grafana k6, Prometheus, Grafana  
**Duração:** 35 minutos  

---

## 🎯 Objetivo do Lab

Ao concluir este laboratório, você será capaz de:
1. Compreender o funcionamento interno de um **Connection Pool** (HikariCP) e por que abrir conexões JDBC sob demanda é proibitivo em sistemas de alta vazão.
2. Identificar a diferença fundamental entre o **tempo de execução da query no banco** e o **tempo de aquisição de conexão na aplicação**.
3. Induzir um cenário real de **Pool Starvation** reduzindo intencionalmente a capacidade do pool (`maximum-pool-size: 2`) na API Bancária.
4. Submeter a API a 40 usuários virtuais concorrentes no **k6** (`scripts/lab4a.js`) e atestar como a latência de cauda (**P99**) explode decorrente do enfileiramento de threads aguardando conexões livres.
5. Inspecionar o painel do **Grafana** (`http://localhost:3000`) e diagnosticar métricas críticas do HikariCP (`hikaricp_connections_pending` e `hikaricp_connections_acquire_seconds`).
6. Aplicar a fórmula empírica canônica de dimensionamento de pools do PostgreSQL (`connections = (cores * 2) + disk`) e restaurar a estabilidade operacional da API bancária com `maximum-pool-size: 10`.

---

## 📋 Pré-requisitos & Materiais

* Stack do Core Banking (PostgreSQL, Redis, Jaeger, Prometheus, Grafana e API) — inicializada no Passo 2.
* Terminal bash aberto no Codespaces ou máquina local posicionado na pasta `labs/`.
* Navegador web apontando para o Grafana (`http://localhost:3000` | usuário: `admin` / senha: `admin`).

---

## 🚀 Passo a Passo Guiado

### Passo 1: Posicionamento no Diretório de Trabalho
No terminal, certifique-se de que está posicionado no diretório deste laboratório:

```bash
cd labs/lab04a-pool-hikaricp
```

---

### Passo 2: Inicialização e Verificação de Sanidade da Infraestrutura
Antes de iniciar os procedimentos de teste, garanta a subida completa de todos os contêineres da stack de microsserviços e observabilidade em segundo plano:

```bash
# 1. Inicializar os serviços em segundo plano (caso não estejam ativos)
docker compose -f ../../docker-compose.yml up -d

# 2. Validar o estado operacional de todos os contêineres
docker compose -f ../../docker-compose.yml ps
```

*Validação esperada:*  
Todos os 6 serviços da arquitetura (`banco-api`, `banco-postgres`, `banco-redis`, `telemetria-jaeger`, `telemetria-prometheus` e `telemetria-grafana`) devem apresentar status `Up` ou `healthy`. Caso a API ainda esteja aquecendo, aguarde alguns segundos até o health check responder `UP`:

```bash
curl -s http://localhost:8080/actuator/health | grep UP
```

---

### Passo 3: O Mistério da Latência de Fila
Nas Aulas 02 e 03, otimizamos o PostgreSQL com índices B-Tree e colocamos cache Redis. A query de extrato no banco executa em frações de milissegundo:

```bash
docker exec -it banco-postgres psql -U postgres -d banco_db -c "EXPLAIN ANALYZE SELECT * FROM transacoes WHERE conta_id = 1001 ORDER BY data_transacao DESC LIMIT 20;"
```

*Constatação:* O PostgreSQL leva **< 0.1ms** para executar essa consulta.  
Porém, se a aplicação tiver apenas **2 conexões no pool** para atender **40 threads simultâneas**, 38 threads ficarão bloqueadas na memória da aplicação aguardando uma conexão desocupar. O cliente perceberá lentidão extrema, mesmo com o banco rodando em velocidade máxima!

---

### Passo 4: Estrangulando o Pool de Conexões (Indução do Incidente)
Vamos simular uma falha comum em produção: um pool subdimensionado ou saturado por conexões presas.  
Reinicie o contêiner `banco-api` forçando o `maximum-pool-size` para apenas **2 conexões**:

```bash
# 1. Definir pool estrangulado via variáveis de ambiente
export SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE=2
export SPRING_DATASOURCE_HIKARI_MINIMUM_IDLE=2

# 2. Recriar a API forçando a aplicação das novas variáveis
docker compose -f ../../docker-compose.yml up -d --force-recreate banco-api

# 3. Auditar se as variáveis foram injetadas no contêiner
docker exec -it banco-api env | grep HIKARI
```

Aguarde 10 segundos até a API inicializar e valide o endpoint de health check:

```bash
curl -s http://localhost:8080/actuator/health | grep UP
```

---

### Passo 5: Submissão de Carga Concorrente com k6
Agora, volte à raiz do repositório e dispare a esteira de teste de estresse de pool com **40 VUs** concorrentes durante 35 segundos:

```bash
cd ../..
k6 run scripts/lab4a.js
```

Observe a saída tabular do console do k6:
* **Threshold de SLO (`p(99)<200`):** Falhará com **[ ✗ ] FAIL**!
* **Latência de Cauda (P99):** O P99 do `/extrato` saltará de ~35ms para **> 800ms a 1.500ms**!
* **Throughput:** A taxa de requisições por segundo despenca devido ao tempo que as threads passam bloqueadas em fila.

---

### Passo 6: Diagnóstico de Saturação no Grafana
Abra o navegador no Grafana (`http://localhost:3000` | admin / admin):
1. Acesse o dashboard **Core Banking - Visão de Performance**.
2. Role até a seção **HikariCP Connection Pool Metrics**:
   * **`Active Connections`:** Cravado no teto em `2.0` (100% de ocupação do pool).
   * **`Pending / Waiting Threads`:** Picos de **15 a 30 threads enfileiradas** aguardando a liberação de conexões.
   * **`Connection Acquire Time`:** Média de espera para alugar uma conexão salta para centenas de milissegundos.
   * **PostgreSQL CPU Utilization:** O banco opera com CPU fria (< 10%), confirmando que o gargalo **não reside no banco**, mas na **borda da infraestrutura JDBC da aplicação**.

---

### Passo 7: Correção de Arquitetura — Dimensionamento Conforme a Fórmula Canônica
Aumentar o pool cegamente para 200 conexões gera disputa de locks e *context switching* na CPU do Postgres.  
Aplicando a fórmula do PostgreSQL:
$$\text{Pool Size} = (\text{Cores} \times 2) + \text{Spindle} = (2 \times 2) + 1 = 5 \text{ a } 10 \text{ conexões}$$

Vamos calibrar a API para o tamanho ideal de **10 conexões**:

```bash
export SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE=10
export SPRING_DATASOURCE_HIKARI_MINIMUM_IDLE=5
docker compose -f docker-compose.yml up -d --force-recreate banco-api

# Auditar a configuração ativa no contêiner
docker exec -it banco-api env | grep HIKARI
```

Aguarde a subida da API (5 a 10s) e reexecute o teste de carga:

```bash
k6 run scripts/lab4a.js
```

*Veredito:*
* O threshold `http_req_duration{name:extrato} ... p(99)<200` voltará a marcar **[ ✓ ] PASS**!
* As threads encontram conexões imediatas no pool aquecido, zerando as conexões pendentes e estabilizando a latência P99 em **< 40ms**.

---

## 🧪 Validação & Critérios de Aceite

O laboratório é considerado **concluído com sucesso** quando:
* [x] A redução do pool para 2 conexões foi configurada e aplicada no contêiner `banco-api`.
* [x] O script `scripts/lab4a.js` evidenciou a explosão de latência de cauda (P99 > 500ms) decorrente do enfileiramento.
* [x] As métricas de `Pending Threads` no Grafana comprovaram o bloqueio de threads no HikariCP.
* [x] A reconfiguração para 10 conexões normalizou a vazão e restabeleceu o SLO bancário com aprovação no k6.

---

## 🧹 Cleanup

Para manter a organização do terminal, retorne ao diretório base de laboratórios:

```bash
cd labs
```

---

## 💡 Desafios Complementares (Para Alunos Avançados)

Se você concluiu o laboratório antes do tempo previsto:

### Desafio 1: Saturação com Connection Timeout Agressivo
O que acontece se uma requisição não puder esperar a conexão desocupar?
1. Configure o `connection-timeout` do HikariCP para apenas **1.500ms**:
   ```bash
   export SPRING_DATASOURCE_HIKARI_CONNECTION_TIMEOUT=1500
   docker compose -f docker-compose.yml up -d banco-api
   ```
2. Dispare o `k6 run scripts/lab4a.js` com o pool estrangulado (`maximum-pool-size=2`).
3. Observe que as requisições que excederem 1.5s na fila receberão **HTTP 500 Internal Server Error** com a exceção `SQLTransientConnectionException: Connection is not available, request timed out after 1500ms`.

### Desafio 2: Auditoria de Conexões Vivas no PostgreSQL
Conecte no `psql` durante a execução do teste de carga e audite os processos ativos no banco:
```sql
SELECT pid, usename, client_addr, state, query_start, query 
FROM pg_stat_activity 
WHERE datname = 'banco_db' AND state != 'idle';
```
Observe como o número de conexões físicas estabelecidas no PostgreSQL reflete com exatidão o `maximum-pool-size` do HikariCP.
