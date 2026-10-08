# 🏦 FIAP Corporate: Latência e Vazão em Sistemas Distribuídos

> **Ambiente Oficial de Laboratórios Práticos**  
> **Programa:** Modernização 2026 — Engenharia de Software  
> **Parceria:** Alura Business & FIAP Corporate  
> **Instrutor:** Prof. Rafael Matsuyama  

---

## 🎯 Visão Geral do Treinamento

Este repositório contém a infraestrutura completa, a API simulada de Core Banking e os roteiros de laboratórios práticos para o treinamento executivo de **Latência e Vazão** (*Latency & Throughput*) em sistemas distribuídos.

O treinamento adota a metodologia contínua de **Problem-Based Learning (PBL)** estruturada em dois ciclos práticos por aula ("Dueto Hands-on"). A execução prática dos laboratórios é **100% individual** no GitHub Codespaces de cada participante, enquanto os squads atuam como uma estrutura colaborativa de suporte mútuo e debate técnico de **Incident Response de Engenharia**.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       A JORNADA DE ENGENHARIA (PBL)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. MEDIÇÃO (Aula 01)     ──► Testes com k6 & Violação de SLO (P99 > 200ms)  │
│ 2. DIAGNÓSTICO (Aula 02) ──► Tracing com Jaeger & EXPLAIN ANALYZE no Postgres│
│ 3. CURA (Aula 03)        ──► Indexação Composta & Cache-Aside com Redis     │
│ 4. BLINDAGEM (Aula 04)   ──► HikariCP Pool Tuning & Flash Pitch dos Squads  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Inicialização Rápida no GitHub Codespaces

O ambiente é 100% autônomo e pré-configurado para execução no **GitHub Codespaces** (Linux x86_64, 2 vCPUs, 8 GB RAM):

1. Clique no botão **Code** no topo deste repositório.
2. Selecione a aba **Codespaces** e clique em **Create codespace on main**.
3. Assim que o terminal do Codespaces inicializar, suba a stack completa:
   ```bash
   docker compose up -d
   docker compose ps
   ```

---

## 🚦 Como Iniciar os Laboratórios

Assim que a stack estiver ativa (`docker compose ps` com todos os serviços em `Up`):

### Aula 01 — Medição & Baseline de Performance
1. **Lab 01A - Primeiro Voo com k6 e Interpretação de Métricas:**
   * 📖 **Roteiro do Aluno:** [`labs/lab01a-k6-primeiro-voo/Lab 01A - Roteiro Aluno.md`](labs/lab01a-k6-primeiro-voo/Lab%2001A%20-%20Roteiro%20Aluno.md)
   * ⚡ **Comando de Teste:**
     ```bash
     k6 run scripts/lab1a.js
     ```

2. **Lab 01B - Medição do Baseline e Violação de SLO:**
   * 📖 **Roteiro do Aluno:** [`labs/lab01b-baseline-slo/Lab 01B - Roteiro Aluno.md`](labs/lab01b-baseline-slo/Lab%2001B%20-%20Roteiro%20Aluno.md)
   * ⚡ **Comando de Teste:**
     ```bash
     k6 run scripts/lab1b.js
     ```

### Aula 02 — Diagnóstico com Observabilidade & Causa-Raiz
3. **Lab 02A - Distributed Tracing com OpenTelemetry & Jaeger:**
   * 📖 **Roteiro do Aluno:** [`labs/lab02a-tracing-jaeger/Lab 02A - Roteiro Aluno.md`](labs/lab02a-tracing-jaeger/Lab%2002A%20-%20Roteiro%20Aluno.md)
   * ⚡ **Geração de Telemetria & Jaeger UI:**
     ```bash
     k6 run scripts/lab1b.js --duration 30s
     # Acesse http://localhost:16686 (Jaeger Web UI)
     ```

4. **Lab 02B - Diagnóstico de Causa-Raiz no Banco com EXPLAIN ANALYZE:**
   * 📖 **Roteiro do Aluno:** [`labs/lab02b-explain-postgresql/Lab 02B - Roteiro Aluno.md`](labs/lab02b-explain-postgresql/Lab%2002B%20-%20Roteiro%20Aluno.md)
   * ⚡ **Acesso ao PostgreSQL & Análise do Plano:**
     ```bash
     docker exec -it banco-postgres psql -U postgres -d banco_db
     # No psql: EXPLAIN ANALYZE SELECT * FROM transacoes WHERE conta_id = 1001 ORDER BY data_transacao DESC LIMIT 20;
     ```

---

## 🗺️ Mapa de Portas e Serviços

| Serviço | Porta | Descrição e Papel na Arquitetura |
| :--- | :---: | :--- |
| **API Bancária (Spring Boot 3)** | `8080` | Microsserviço bancário (`/health`, `/saldo`, `/extrato`, `/transferencias`) |
| **Grafana** | `3000` | Dashboards em tempo real (TPS, Percentis P50/P95/P99, HikariCP) |
| **Jaeger UI** | `16686` | Distributed Tracing ponta a ponta e visualização de waterfall de spans |
| **Prometheus** | `9090` | Coleta contínua de métricas dimensionais a cada 2s |
| **PostgreSQL 16** | `5432` | Banco relacional com 150k transações para tuning de queries |
| **Redis 7** | `6379` | Cache em memória para consultas em sub-milissegundos |

---

## 🧪 Estrutura dos Roteiros de Laboratório

Todos os laboratórios seguem o padrão estruturado passo a passo:

```text
├── labs/
│   ├── lab01a-k6-primeiro-voo/      # Aula 01: Subida da stack e primeiro voo com k6 CLI
│   ├── lab01b-baseline-slo/         # Aula 01: Carga concorrente e violação de SLO no extrato
│   ├── lab02a-tracing-jaeger/       # Aula 02: Tracing distribuído e isolamento de gargalo
│   ├── lab02b-explain-postgresql/   # Aula 02: Plano de execução e Sequential Scans
│   ├── lab03a-index-tuning/         # Aula 03: Migração de índice B-Tree seletivo
│   ├── lab03b-redis-cache/          # Aula 03: Implementação do padrão Cache-Aside
│   └── lab04a-hikaricp-starvation/  # Aula 04: Dimensionamento e saturação do HikariCP
├── scripts/                         # Cenários declarativos em JavaScript para o k6
│   ├── lab1a.js                     # Baseline em rotas leves (10 VUs)
│   └── lab1b.js                     # Tráfego misto com disparo de cauda longa (25 VUs)
├── db/                              # Schema e seed de transações do PostgreSQL
│   └── init.sql
├── telemetria/                      # Configurações de telemetria e observabilidade
│   ├── prometheus.yml               # Coleta de métricas a cada 2s
│   └── grafana/                     # Provisioning de datasources e dashboards
│       └── provisioning/
│           ├── datasources/datasource.yml
│           └── dashboards/
│               ├── dashboards.yml
│               └── core-banking.json
└── app/                             # Microsserviço Core Banking Spring Boot 3 (Java 21)
    ├── src/
    ├── pom.xml
    └── Dockerfile
```

---

## 🛠️ Validação e Smoke Test

Para validar se a API bancária está saudável após subir os contêineres:

```bash
# Verificação de integridade (Health Check)
curl -i http://localhost:8080/health

# Consulta rápida de saldo (Rota ultraleve: < 5ms)
curl -i http://localhost:8080/api/v1/contas/1001/saldo

# Consulta de extrato (Rota sem índice: ~400ms a 800ms sob concorrência)
curl -i http://localhost:8080/api/v1/contas/1001/extrato
```
