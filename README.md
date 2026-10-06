# 🏦 FIAP Corporate: Latência e Vazão em Sistemas Distribuídos

> **Ambiente Oficial de Laboratórios Práticos**  
> **Programa:** Modernização 2026 — Engenharia de Software  
> **Parceria:** Alura Business & FIAP Corporate  
> **Instrutor:** Prof. Rafael Matsuyama  

---

## 🎯 Visão Geral do Treinamento

Este repositório contém a infraestrutura completa, a API simulada de Core Banking e os roteiros de laboratórios práticos para o treinamento executivo de **Latência e Vazão** (*Latency & Throughput*) em sistemas distribuídos.

O treinamento adota a metodologia contínua de **Problem-Based Learning (PBL)** estruturada em dois ciclos práticos por aula ("Dueto Hands-on"). Os squads atuam como um time de **Incident Response de Engenharia**, investigando, diagnosticando, otimizando e blindando uma API financeira real sob estresse de concorrência.

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

1. **Aula 01 - Primeiro Voo com k6 e Interpretação de Métricas:**
   * 📖 **Roteiro do Aluno:** [`labs/lab01a-k6-primeiro-voo/Lab 01A - Roteiro Aluno.md`](labs/lab01a-k6-primeiro-voo/Lab%2001A%20-%20Roteiro%20Aluno.md)
   * ⚡ **Comando de Teste:**
     ```bash
     k6 run scripts/lab1a.js
     ```

2. **Aula 01 - Medição do Baseline e Violação de SLO:**
   * 📖 **Roteiro do Aluno:** [`labs/lab01b-baseline-slo/Lab 01B - Roteiro Aluno.md`](labs/lab01b-baseline-slo/Lab%2001B%20-%20Roteiro%20Aluno.md)
   * ⚡ **Comando de Teste:**
     ```bash
     k6 run scripts/lab1b.js
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
│   ├── lab02a-jaeger-tracing/       # Aula 02: Tracing distribuído e isolamento de gargalo
│   ├── lab02b-postgres-explain/     # Aula 02: Plano de execução e Sequential Scans
│   ├── lab03a-index-tuning/         # Aula 03: Migração de índice B-Tree seletivo
│   ├── lab03b-redis-cache/          # Aula 03: Implementação do padrão Cache-Aside
│   └── lab04a-hikaricp-starvation/  # Aula 04: Dimensionamento e saturação do HikariCP
├── scripts/                         # Cenários declarativos em JavaScript para o k6
│   ├── lab1a.js                     # Baseline em rotas leves (10 VUs)
│   └── lab1b.js                     # Tráfego misto com disparo de cauda longa (25 VUs)
├── db/                              # Schema e seed de transações do PostgreSQL
│   └── init.sql
├── telemetria/                      # Configurações de coleta do Prometheus
│   └── prometheus.yml
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
