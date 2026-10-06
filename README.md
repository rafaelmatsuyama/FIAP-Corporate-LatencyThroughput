# 🏦 FIAP Corporate: Latency & Throughput in Distributed Systems

> **Official Hands-on Laboratory Environment**  
> **Program:** Modernização 2026 — Software Engineering  
> **Partnership:** Alura Business & FIAP Corporate  
> **Instructor:** Prof. Rafael Matsuyama  

---

## 🎯 Course Overview

This repository contains the infrastructure, simulated Core Banking microservice, and hands-on laboratory guides for the executive engineering training on **Latency & Throughput** in distributed systems.

The course follows a continuous **Problem-Based Learning (PBL)** methodology structured into two practical cycles per session ("Hands-on Duet"). Squads operate as an **Incident Response Engineering Team**, actively measuring, diagnosing, tuning, and hardening a real financial API under heavy concurrent load.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       THE ENGINEERING JOURNEY (PBL)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. MEASUREMENT (Class 01) ──► k6 Load Testing & SLO Violation (P99 > 200ms) │
│ 2. DIAGNOSIS (Class 02)   ──► Jaeger Distributed Tracing & Postgres EXPLAIN │
│ 3. OPTIMIZATION (Class 03)──► Compound B-Tree Indexing & Redis Cache-Aside  │
│ 4. HARDENING (Class 04)   ──► HikariCP Pool Sizing & Squad Flash Pitches    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start with GitHub Codespaces

This environment is fully self-contained and pre-configured to run on **GitHub Codespaces** (Linux x86_64, 2 vCPUs, 8 GB RAM):

1. Click the **Code** button at the top of this repository.
2. Select the **Codespaces** tab and click **Create codespace on main**.
3. Once the Codespace terminal initializes, spin up the entire stack:
   ```bash
   docker compose up -d
   docker compose ps
   ```

---

## 🗺️ Port Mapping & Services

| Service | Port | Description & Role |
| :--- | :---: | :--- |
| **Banking Core API (Spring Boot 3)** | `8080` | Banking microservice (`/health`, `/saldo`, `/extrato`, `/transferencias`) |
| **Grafana** | `3000` | Real-time dashboards (TPS, Latency Percentiles P50/P95/P99, HikariCP) |
| **Jaeger UI** | `16686` | End-to-end distributed tracing & waterfall span inspection |
| **Prometheus** | `9090` | Time-series scraper collecting metrics every 2s |
| **PostgreSQL 16** | `5432` | Relational storage with 150k historical transactions for query tuning |
| **Redis 7** | `6379` | In-memory key-value cache for sub-millisecond lookups |

---

## 🧪 Laboratory Guides (Roteiros Práticos)

All student guides follow the structured step-by-step format:

```text
├── labs/
│   ├── lab01a-k6-primeiro-voo/      # Class 01: Stack spin-up & first flight with k6 CLI
│   ├── lab01b-baseline-slo/         # Class 01: Concurrent load & tail latency SLO violation
│   ├── lab02a-jaeger-tracing/       # Class 02: Distributed tracing & bottleneck isolation
│   ├── lab02b-postgres-explain/     # Class 02: Query execution plan & Sequential Scans
│   ├── lab03a-index-tuning/         # Class 03: Selective B-Tree index migration
│   ├── lab03b-redis-cache/          # Class 03: Cache-Aside pattern implementation
│   └── lab04a-hikaricp-starvation/  # Class 04: JDBC Connection Pool tuning & saturation
├── scripts/                         # Declarative Grafana k6 JavaScript scenarios
│   ├── lab1a.js                     # Light endpoints baseline (10 VUs)
│   └── lab1b.js                     # Full mixed traffic & tail latency trigger (25 VUs)
├── db/                              # PostgreSQL schema and transaction data seed
│   └── init.sql
├── telemetria/                      # Prometheus scraper configuration
│   └── prometheus.yml
└── app/                             # Core Banking Spring Boot 3 microservice (Java 21)
    ├── src/
    ├── pom.xml
    └── Dockerfile
```

---

## 🛠️ Verification & Smoke Test

Validate that the banking service is healthy:

```bash
# Health check
curl -i http://localhost:8080/health

# Account balance check (Fast route: < 5ms)
curl -i http://localhost:8080/api/v1/contas/1001/saldo

# Account statement check (Unindexed slow route: ~400ms-800ms under load)
curl -i http://localhost:8080/api/v1/contas/1001/extrato
```
