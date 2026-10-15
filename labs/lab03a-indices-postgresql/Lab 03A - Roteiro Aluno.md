# Lab 03A - Tuning de Persistência com Indexação Seletiva no PostgreSQL

**Programa:** Modernização 2026 — Engenharia de Software  
**Parceria:** Alura Business & FIAP Corporate  
**Ambiente:** GitHub Codespaces / Docker Local (Linux x86_64, 2 vCPUs, 8 GB RAM)  
**Linguagem & Stack:** PostgreSQL 16, psql CLI, Grafana k6, Prometheus, Grafana  
**Duração:** 35 minutos  

---

## 🎯 Objetivo do Lab

Ao concluir este laboratório, você será capaz de:
1. Compreender o funcionamento de uma árvore **B-Tree** e o princípio do **Leftmost Prefix** na modelagem de índices compostos.
2. Criar um índice composto otimizado (`idx_transacoes_conta_data`) no PostgreSQL cobrindo tanto a cláusula de filtro (`conta_id`) quanto a cláusula de ordenação (`data_transacao DESC`).
3. Executar o `EXPLAIN ANALYZE` e comprovar a substituição do custoso `Seq Scan` pelo cirúrgico **`Index Scan`**, com descarte de linhas reduzido a **zero**.
4. Disparar uma bateria formal de testes de carga com o **k6** (`scripts/lab3a.js`) e comprovar que a latência P99 do extrato despenca de **> 600ms para ~35ms**, cumprindo o SLO corporativo (< 200ms).
5. Compreender o trade-off de engenharia entre aceleração exponencial de leitura (`SELECT`) e o overhead de rebalanceamento da árvore nas operações de escrita (`INSERT`).

---

## 📋 Pré-requisitos & Materiais

* Stack do Core Banking (PostgreSQL, Redis, Jaeger, Prometheus, Grafana e API) — inicializada no Passo 2.
* Terminal bash aberto no Codespaces ou máquina local posicionado na pasta `labs/`.
* Tabela `transacoes` populada com 150.000 registros na base `banco_db`.
* Navegador web apontando para o Grafana (`http://localhost:3000` | usuário: `admin` / senha: `admin`).

---

## 🚀 Passo a Passo Guiado

### Passo 1: Posicionamento no Diretório de Trabalho
No terminal, certifique-se de que está posicionado no diretório deste laboratório:

```bash
cd labs/lab03a-indices-postgresql
```

---

### Passo 2: Inicialização e Verificação de Sanidade da Infraestrutura
Antes de iniciar os procedimentos de tuning, assegure a inicialização completa e a integridade operacional de todos os contêineres da stack de microsserviços e observabilidade:

```bash
# 1. Inicializar os serviços em segundo plano (caso não estejam ativos)
docker compose -f ../../docker-compose.yml up -d

# 2. Validar o estado operacional dos contêineres
docker compose -f ../../docker-compose.yml ps
```

*Validação esperada:*
Todos os serviços da arquitetura (`banco-api`, `banco-postgres`, `banco-redis`, `telemetria-jaeger`, `telemetria-prometheus` e `telemetria-grafana`) devem apresentar estado `Up` ou `healthy`.

---

### Passo 3: Relembrar a Dor da Consulta Sem Índice
Na Aula 02, descobrimos que a consulta de extrato descartava ~148.500 linhas a cada busca. Vamos acessar o `psql` para checar o estado atual:

```bash
docker exec -it banco-postgres psql -U postgres -d banco_db
```

Execute o plano da query de extrato:

```sql
EXPLAIN ANALYZE
SELECT * FROM transacoes 
WHERE conta_id = 1001 
ORDER BY data_transacao DESC 
LIMIT 20;
```

*Verificação esperada:*
* Operador: `Seq Scan on transacoes`
* `Rows Removed by Filter`: ~148.500 linhas
* `Execution Time`: ~35ms a 40ms por requisição individual isolada.

---

### Passo 4: Criação do Índice Composto no PostgreSQL
Agora vamos aplicar o remédio de engenharia de banco de dados. Criaremos um índice cobrindo `conta_id` e `data_transacao DESC`:

```sql
CREATE INDEX idx_transacoes_conta_data ON transacoes (conta_id, data_transacao DESC);
```

*Por que este índice é perfeito para essa query?*
1. **`conta_id` (Filtro):** Permite à B-Tree descer diretamente para o bloco onde residem apenas as transações da conta 1001.
2. **`data_transacao DESC` (Ordenação):** As tuplas no índice já estão fisicamente ordenadas da mais recente para a mais antiga. O PostgreSQL não precisa realizar o custo computacional de ordenação em memória (`Sort / top-N heapsort`).

---

### Passo 5: Auditoria do Novo Plano com EXPLAIN ANALYZE
Reexecute a mesma instrução SQL com o índice ativo:

```sql
EXPLAIN ANALYZE
SELECT * FROM transacoes 
WHERE conta_id = 1001 
ORDER BY data_transacao DESC 
LIMIT 20;
```

*Saída esperada:*
```text
                                                              QUERY PLAN                                                              
--------------------------------------------------------------------------------------------------------------------------------------
 Limit  (cost=0.42..3.85 rows=20 width=78) (actual time=0.038..0.052 rows=20 loops=1)
   ->  Index Scan using idx_transacoes_conta_data on transacoes  (cost=0.42..258.12 rows=1505 width=78) (actual time=0.036..0.048 rows=20 loops=1)
         Index Cond: (conta_id = 1001)
 Planning Time: 0.142 ms
 Execution Time: 0.071 ms
```

#### 🔍 O que mudou radicalmente:
1. **`Seq Scan` virou `Index Scan`:** O banco não lê mais 150 mil registros; ele vai direto nos nós-folha do índice.
2. **`Rows Removed by Filter` desapareceu:** Descarte de linhas caiu de 148.520 para **0**!
3. **Tempo de Execução:** Caiu de ~38ms para **~0.07ms (mais de 400 vezes mais rápido!)**.

---

### Passo 6: Sair do PostgreSQL e Testar sob Carga Concorrente (k6)
Saia do console interativo:

```sql
\q
```

Agora, volte à raiz do repositório para disparar a bateria de carga com 25 usuários virtuais concorrentes:

```bash
cd ../..
k6 run scripts/lab3a.js
```

Observe a saída tabular do console do k6:
* O threshold `http_req_duration{name:extrato} ... p(99)<200` exibirá **[ ✓ ] PASS**!
* O percentil **P99 do extrato agora marca ~35ms a 45ms** (uma redução de mais de 15x em relação aos > 600ms do baseline!).
* O SLO bancário está formalmente restabelecido.

---

### Passo 7: Correlação Visual e Estabilização no Grafana
Abra o navegador no Grafana (`http://localhost:3000` | admin / admin):
1. Acesse o dashboard **Core Banking - Visão de Performance**.
2. Avalie as métricas operacionais consolidadas à luz do histórico do incidente:
   * **Resgate do Baseline (Aula 01 - Sem Índice):** Na medição inicial (Lab 01B), a rota de extrato violava criticamente o SLO bancário, registrando **P99 entre 600ms e 850ms** decorrente do *Sequential Scan* em 150 mil tuplas no PostgreSQL.
   * **Estado Atual (Aula 03 - Pós-Indexação):** Observe no painel que a curva de latência P99 do extrato opera agora em patamar plano e previsível de **~35ms a 45ms**, eliminando a cauda longa e cumprindo o SLO corporativo (**< 200ms**).
   * **Database Query Duration:** O tempo de persistência caiu para frações de milissegundo, liberando conexões do pool e estabilizando o throughput da API.

---

## 🧪 Validação & Critérios de Aceite

O laboratório é considerado **concluído com sucesso** quando:
* [x] O índice composto `idx_transacoes_conta_data` foi criado com sucesso no banco `banco_db`.
* [x] O comando `EXPLAIN ANALYZE` comprovou o operador `Index Scan` com tempo < 0.1ms.
* [x] O script `scripts/lab3a.js` rodou com sucesso sem erros HTTP.
* [x] O threshold de SLO (`p(99) < 200ms`) foi atingido com aprovação verde no terminal.
* [x] A curva de latência no Grafana (`http://localhost:3000`) confirmou a estabilização da rota `/extrato`.

---

## 🧹 Cleanup

Para manter a organização do terminal, se estiver na raiz, retorne ao diretório base de laboratórios:

```bash
cd labs
```

*(Nota: Mantenha o índice criado, pois ele servirá de fundação sólida para o Lab 03B).*

---

## 💡 Desafios Complementares (Para Alunos Avançados)

Se você concluiu o laboratório antes do tempo previsto:

### Desafio 1: Avaliando o Overhead de Escrita (Trade-off de Índices)
Índices aceleram leituras, mas exigem manutenção a cada `INSERT`. Vamos medir isso:
1. Inspecione o tamanho ocupado pelo índice na tabela:
   ```sql
   SELECT pg_size_pretty(pg_relation_size('idx_transacoes_conta_data')) AS tamanho_indice;
   ```
2. Dispare 100 requisições sequenciais de escrita na rota `/api/v1/transferencias` e cronometre o tempo de inserção.
3. Pergunte-se: se tivéssemos 10 índices nessa mesma tabela, o que aconteceria com a vazão de transações PIX?

### Desafio 2: Inspecionando o Page Split da B-Tree
Execute a query com buffers no `psql`:
```sql
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM transacoes WHERE conta_id = 1001 ORDER BY data_transacao DESC LIMIT 20;
```
Observe que `Buffers: shared hit` caiu de centenas de blocos para apenas **3 a 4 blocos de 8 KB**!
