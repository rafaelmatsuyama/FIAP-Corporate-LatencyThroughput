# 🏦 FIAP Corporate: Latência e Vazão em Sistemas Distribuídos

> **Ambiente Oficial de Laboratórios Práticos**  
> **Programa:** Modernização 2026 — Engenharia de Software  
> **Parceria:** Alura Business & FIAP Corporate  
> **Instrutor:** Prof. Rafael Matsuyama  

---

## 🎯 Visão Geral do Treinamento

Este repositório contém a infraestrutura completa, a API simulada de Core Banking e os laboratórios hands-on para o treinamento executivo de **Latência e Vazão** (*Latency & Throughput*).

O treinamento adota a metodologia **PBL (Problem-Based Learning)** contínua: durante 4 encontros práticos ("Dueto Hands-on"), você atuará em squad como parte de um time de engenharia investigando, diagnosticando e otimizando uma API financeira real sob estresse de tráfego.

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

O ambiente é 100% autônomo e pré-configurado para rodar no **GitHub Codespaces** (Linux x86_64, 2 vCPUs, 8 GB RAM):

1. Clique no botão **Code** no topo deste repositório.
2. Selecione a aba **Codespaces** e clique em **Create codespace on main**.
3. Aguarde o terminal do Codespaces carregar e execute:
   ```bash
   docker compose up -d
   docker compose ps
   ```

---

## 🗺️ Mapa de Portas e Serviços

| Serviço | Porta Web | Finalidade Técnica |
| :--- | :---: | :--- |
| **API Bancária (Spring Boot 3)** | `8080` | Microsserviço de Core Banking (`/saldo`, `/extrato`, `/transferencias`) |
| **Grafana** | `3000` | Dashboards executivos em tempo real (TPS, P50/P95/P99, HikariCP) |
| **Jaeger UI** | `16686` | Distributed Tracing ponta a ponta e análise de waterfall de spans |
| **Prometheus** | `9090` | Coleta e raspagem contínua de métricas dimensionais |
| **PostgreSQL 16** | `5432` | Persistência relacional de contas e extratos |
| **Redis 7** | `6379` | Camada de cache em memória para baixa latência |

---

## 🧪 Estrutura dos Laboratórios

```text
├── labs/
│   ├── lab01a-k6-primeiro-voo/      # Aula 01: Subida da stack e primeiro teste com k6
│   ├── lab01b-baseline-slo/         # Aula 01: Carga concorrente e violação de SLO
│   ├── lab02a-jaeger-tracing/       # Aula 02: Tracing distribuído e isolamento de nós
│   ├── lab02b-postgres-explain/     # Aula 02: Diagnóstico no banco com EXPLAIN ANALYZE
│   ├── lab03a-index-tuning/         # Aula 03: Tuning de persistência com índices
│   ├── lab03b-redis-cache/          # Aula 03: Cache-aside com Redis
│   └── lab04a-hikaricp-starvation/  # Aula 04: Dimensionamento e exaustão de pool
├── scripts/                         # Scripts declarativos do Grafana k6
└── app/                             # Código-fonte da API Spring Boot 3
```
