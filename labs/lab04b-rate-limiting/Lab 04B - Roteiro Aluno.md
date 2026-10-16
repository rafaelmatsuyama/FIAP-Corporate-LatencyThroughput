# Lab 04B - Defesa de Borda com Rate Limiting e Throttling (Token Bucket)

**Programa:** Modernização 2026 — Engenharia de Software  
**Parceria:** Alura Business & FIAP Corporate  
**Ambiente:** GitHub Codespaces / Docker Local (Linux x86_64, 2 vCPUs, 8 GB RAM)  
**Linguagem & Stack:** Java 21 / Spring Boot 3, Token Bucket Filter, Grafana k6, Prometheus, Grafana  
**Duração:** 35 minutos  

---

## 🎯 Objetivo do Lab

Ao concluir este laboratório, você será capaz de:
1. Compreender o funcionamento do algoritmo **Token Bucket** e por que a proteção de borda (*boundary defense*) é o elo final obrigatório de resiliência em sistemas bancários.
2. Identificar os perigos de **avalanche de requisições (*thundering herd / traffic spikes*)**, que podem degradar o banco e esgotar o pool de conexões mesmo em sistemas altamente otimizados.
3. Ativar o mecanismo de **Rate Limiting** via variável de ambiente (`APP_RATELIMIT_ENABLED=true`) na API Bancária sem alterar código-fonte.
4. Submeter a API a uma rajada massiva de **100 usuários virtuais concorrentes** com o **k6** (`scripts/lab4b.js`).
5. Atestar que requisições dentro da cota são atendidas com excelência (**HTTP 200** em < 2ms) e requisições excedentes são cortadas cirurgicamente em sub-milissegundos com **HTTP 429 Too Many Requests** e cabeçalho `Retry-After`.
6. Observar no **Grafana** (`http://localhost:3000`) como a defesa de borda mantém a CPU do PostgreSQL fria e o pool de conexões HikariCP protegido contra colapso em cascata (*cascading failure*).

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
cd labs/lab04b-rate-limiting
```

---

### Passo 2: Inicialização e Verificação de Sanidade da Infraestrutura
Antes de iniciar os testes, garanta a inicialização completa de todos os contêineres da stack:

```bash
# 1. Subir toda a infraestrutura em segundo plano
docker compose -f ../../docker-compose.yml up -d

# 2. Validar o estado operacional dos 6 contêineres
docker compose -f ../../docker-compose.yml ps
```

*Validação esperada:*  
Todos os serviços devem apresentar status `Up` ou `healthy`. Valide a resposta do health check:

```bash
curl -s http://localhost:8080/actuator/health | grep UP
```

---

### Passo 3: O Dilema da Avalanche de Tráfego
Nas aulas anteriores, otimizamos queries com índices (Aula 03A), ativamos cache Redis (Aula 03B) e calibramos o HikariCP (Aula 04A).  
Porém, o que acontece se um parceiro com erro de loop infinito ou um ataque de estresse disparar **1.000 requisições por segundo** contra a API?  
Sem controle de taxa na borda, o sistema tentará processar tudo, gerando concorrência destrutiva, enfileiramento e eventual queda do serviço.

---

### Passo 4: Ativação da Defesa de Borda (Token Bucket)
Vamos ligar o filtro de Rate Limiting da API, configurando um teto de **50 requisições permitidas com recarga contínua**:

```bash
# 1. Ativar o mecanismo de Rate Limiting e definir a capacidade do bucket
export APP_RATELIMIT_ENABLED=true
export APP_RATELIMIT_CAPACITY=50
export APP_RATELIMIT_REFILL_RATE=50

# 2. Recriar a API aplicando a nova parametrização
docker compose -f ../../docker-compose.yml up -d --force-recreate banco-api

# 3. Auditar se a variável foi injetada no contêiner
docker exec -it banco-api env | grep RATELIMIT
```

Aguarde 10 segundos até a API concluir a inicialização e valide que o endpoint responde normalmente:

```bash
curl -i http://localhost:8080/api/v1/contas/1001/saldo
```

*Validação esperada:* Resposta `HTTP/1.1 200 OK`.

---

### Passo 5: Submissão de Rajada Agressiva com k6
Agora, volte à raiz do repositório para disparar uma bateria de estresse massivo com **100 VUs** simultâneas durante 30 segundos:

```bash
cd ../..
k6 run scripts/lab4b.js
```

Observe a saída tabular do console do k6:
* **Threshold `http_req_duration{status:200}`:** Aprovado com **[ ✓ ] PASS** (latência das requisições autorizadas continua ultrabaixa, P99 < 50ms)!
* **Threshold `rate_limited_ratio`:** Aprovado com **[ ✓ ] PASS** (mais de 20% das chamadas excedentes foram bloqueadas na borda).
* **Checks:**
  * `✓ status is 200 (OK) or 429 (Rate Limited)`: 100% de conformidade!
  * `✓ retry-after header present on 429`: 100% de conformidade!

---

### Passo 6: Dissecação da Resposta de Proteção HTTP 429
No terminal, dispare uma rajada rápida com `curl` para inspecionar os cabeçalhos de controle retornados quando o bucket esgota:

```bash
for i in {1..70}; do curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/api/v1/contas/1001/extrato; done | sort | uniq -c
```

*Saída típica:*
```text
50 200
20 429
```

Faça uma requisição detalhada para ver o payload de bloqueio:

```bash
curl -i http://localhost:8080/api/v1/contas/1001/extrato
```

*Cabeçalhos e Corpo retornados:*
```http
HTTP/1.1 429 Too Many Requests
Retry-After: 1
X-RateLimit-Limit: 50
X-RateLimit-Remaining: 0
Content-Type: application/json

{"status":429,"error":"Too Many Requests","message":"Limite de taxa excedido. Tente novamente em 1 segundo."}
```

---

### Passo 7: Telemetria de Proteção no Grafana
Abra o navegador no Grafana (`http://localhost:3000` | admin / admin):
1. Acesse o dashboard **Core Banking - Visão de Performance**.
2. Avalie as métricas do sistema sob rajada de 100 VUs:
   * **Throughput:** A API atende com tranquilidade a cota contratada e descarta o excedente em frações de milissegundo.
   * **HikariCP Active Connections:** Permanece baixo e controlado (< 5 conexões), pois as chamadas bloqueadas pelo Rate Limiter **sequer chegam a tocar no DataSource**.
   * **PostgreSQL CPU Utilization:** O banco de dados nem percebe a avalanche externa, operando com consumo frio (< 10%).

---

## 🧪 Validação & Critérios de Aceite

O laboratório é considerado **concluído com sucesso** quando:
* [x] A variável `APP_RATELIMIT_ENABLED=true` foi configurada e aplicada no contêiner `banco-api`.
* [x] O script `scripts/lab4b.js` rodou com 100 VUs evidenciando respostas `HTTP 200` e `HTTP 429`.
* [x] O threshold de latência de chamadas aceitas (`p(99) < 50ms`) foi cumprido com aprovação.
* [x] O cabeçalho `Retry-After: 1` foi verificado nas respostas 429.
* [x] O Grafana comprovou a proteção do PostgreSQL e do pool HikariCP contra colapso por tráfego excessivo.

---

## 🧹 Cleanup

Para encerrar o laboratório e restaurar a API para o estado padrão sem restrições de taxa:

```bash
export APP_RATELIMIT_ENABLED=false
docker compose up -d --force-recreate banco-api
cd labs
```

---

## 💡 Desafios Complementares (Para Alunos Avançados)

Se você concluiu o laboratório antes do tempo previsto:

### Desafio 1: Calibração Fina da Taxa de Recarga (Throughput Shaping)
Experimente reconfigurar a API com um bucket de rajada menor (ex: 20 tokens) e recarga suave de 10 tokens por segundo:
```bash
export APP_RATELIMIT_ENABLED=true
export APP_RATELIMIT_CAPACITY=20
export APP_RATELIMIT_REFILL_RATE=10
docker compose up -d --force-recreate banco-api
```
Reexecute o `k6 run scripts/lab4b.js` e observe como a proporção de corte sobe, garantindo estabilidade máxima em ambientes com infraestrutura mínima.

### Desafio 2: Rate Limiting Distribuído com Redis
Atualmente o filtro opera em memória local da JVM. Em uma arquitetura com 10 instâncias de API atrás de um Load Balancer, como garantir que o limite global de 50 req/s seja compartilhado entre todos os nós?
*Pesquisa arquitetural:* Avalie o uso de `INCR` com `EXPIRE` atômico no Redis ou o módulo Redis Rate Limiter via script Lua para controle centralizado.
