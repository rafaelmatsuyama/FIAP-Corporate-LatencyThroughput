# Lab 02B - Diagnóstico da Causa-Raiz no Banco de Dados com EXPLAIN ANALYZE

**Programa:** Modernização 2026 — Engenharia de Software  
**Parceria:** Alura Business & FIAP Corporate  
**Ambiente:** GitHub Codespaces / Docker Local (Linux x86_64, 2 vCPUs, 8 GB RAM)  
**Linguagem & Stack:** PostgreSQL 16, psql CLI, Grafana (porta 3000), Prometheus  
**Duração:** 35 minutos  

---

## 🎯 Objetivo do Lab

Ao concluir este laboratório, você será capaz de:
1. Correlacionar no **Grafana** a curva de TPS e saturação da API bancária com a métrica de duração de queries no banco de dados.
2. Conectar interativamente ao cliente do **PostgreSQL 16** (`psql`) no contêiner da base de dados.
3. Compreender a diferença prática entre `EXPLAIN` (plano teórico estimado pelo otimizador) e `EXPLAIN ANALYZE` (execução real com medição de tempo e contagem de linhas).
4. Identificar o operador crítico **Sequential Scan (`Seq Scan on transacoes`)** e diagnosticar o descarte massivo de registros (`Rows Removed by Filter`).
5. Quantificar o impacto de I/O em disco e consumo de páginas de memória através da instrução `EXPLAIN (ANALYZE, BUFFERS)`.
6. Fechar o diagnóstico técnico definitivo da causa-raiz do incidente de latência mapeado desde a Aula 01.

---

## 📋 Pré-requisitos & Materiais

* Contêineres da stack do Core Banking ativos e saudáveis (inicializados nos passos anteriores).
* Terminal bash aberto no Codespaces ou máquina local.
* Navegador web apontando para o Grafana (`http://localhost:3000` | usuário: `admin` / senha: `admin`).
* Tabela `transacoes` populada com 150.000 registros na base `banco_db`.

---

## 🚀 Passo a Passo Guiado

### Passo 1: Posicionamento no Diretório de Trabalho
No terminal, certifique-se de que está posicionado no diretório deste laboratório:

```bash
cd labs/lab02b-explain-postgresql
```

---

### Passo 2: Correlação Visual de Métricas no Grafana
Antes de acessar o banco de dados, observe como a dor se manifesta no painel de controle operacional:

1. Acesse no navegador:
   * **Codespaces:** Abra a aba **Ports** no VS Code e clique no globo na porta **3000**.
   * **Local / Docker:** Acesse diretamente `http://localhost:3000`.
2. Efetue login com usuário `admin` e senha `admin`.
3. Navegue até o dashboard **Core Banking - Visão de Performance**:
   * Observe o painel **Database Query Duration**: durante os testes de carga, enquanto rotas indexadas (`/saldo`) mantêm latência sub-milissegundo, a rota de extrato empurra o tempo de execução do banco para centenas de milissegundos.
   * Observe o painel de **Conexões HikariCP**: as conexões ativas ficam presas esperando a resposta do banco, provocando enfileiramento na aplicação.

---

### Passo 3: Conectar ao Console Interativo do PostgreSQL
Acesse o cliente `psql` diretamente dentro do contêiner da base relacional:

```bash
docker exec -it banco-postgres psql -U postgres -d banco_db
```

*Verificação esperada:* O terminal exibirá o prompt interativo do PostgreSQL:
```text
psql (16.x)
Type "help" for help.

banco_db=#
```

---

### Passo 4: Auditar a Volumetria da Tabela de Transações
Verifique a quantidade total de registros armazenados na tabela `transacoes`:

```sql
SELECT count(*) FROM transacoes;
```

*Saída esperada:*
```text
 count  
--------
 150000
(1 row)
```

> [!NOTE]
> A base de teste foi semeada propositalmente com **150.000 transações históricas**. Esse volume (~25 MB) é suficiente para sobrecarregar a leitura sequencial sem saturar a memória do ambiente de aula.

---

### Passo 5: Executar o EXPLAIN Teórico vs. EXPLAIN ANALYZE Real

O PostgreSQL possui dois modos fundamentais para inspecionar planos de consulta:

#### 1. Plano Teórico (`EXPLAIN`):
O otimizador apenas estima o custo computacional com base nas estatísticas das tabelas (`pg_statistic`), **sem executar a query**:

```sql
EXPLAIN
SELECT * FROM transacoes 
WHERE conta_id = 1001 
ORDER BY data_transacao DESC 
LIMIT 20;
```

Observe que ele exibe uma estimativa de custo (`cost=0.00..3285.00`), mas **não há tempos reais em milissegundos**, pois a query não rodou no motor.

#### 2. Execução Real com Medição (`EXPLAIN ANALYZE`):
O comando agora executa a consulta de verdade no motor do PostgreSQL, cronometrando cada nó da árvore:

```sql
EXPLAIN ANALYZE
SELECT * FROM transacoes 
WHERE conta_id = 1001 
ORDER BY data_transacao DESC 
LIMIT 20;
```

---

### Passo 6: Dissecando a Saída do Otimizador

Analise a árvore de execução retornada no terminal:

```text
                                                        QUERY PLAN                                                         
---------------------------------------------------------------------------------------------------------------------------
 Limit  (cost=3285.50..3285.55 rows=20 width=78) (actual time=38.120..38.125 rows=20 loops=1)
   ->  Sort  (cost=3285.50..3289.25 rows=1500 width=78) (actual time=38.118..38.121 rows=20 loops=1)
         Sort Key: data_transacao DESC
         Sort Method: top-N heapsort  Memory: 27kB
         ->  Seq Scan on transacoes  (cost=0.00..3225.00 rows=1500 width=78) (actual time=0.025..36.850 rows=1480 loops=1)
               Filter: (conta_id = 1001)
               Rows Removed by Filter: 148520
 Planning Time: 0.185 ms
 Execution Time: 38.165 ms
```

#### 🔍 Decodificando os indicadores críticos:
1. **`Seq Scan on transacoes` (Sequential Scan):** O banco não encontrou nenhum índice na coluna `conta_id`. Por isso, ele foi forçado a varrer a tabela inteira do primeiro ao último bloco físico de dados.
2. **`Rows Removed by Filter: 148520` (O Descarte Massivo):**
   * Para encontrar cerca de 1.480 transações da conta 1001 e retornar as 20 mais recentes, o PostgreSQL teve que ler e **descartar mais de 148.000 linhas da memória a cada requisição**!
3. **Multiplicação pelo Teste de Carga (k6):**
   * Em uma requisição isolada, o descarte consome ~38ms.
   * Quando 25 usuários virtuais disparam essa mesma busca concorrentemente no k6, o banco precisa ler e descartar milhões de linhas por segundo, saturando as CPUs e estourando o tempo de resposta para **mais de 600ms**!

---

### Passo 7: O Veredito de Engenharia
A causa-raiz que investigamos desde a Aula 01 está matematicamente provada:
* **Problema:** Ausência de índice na coluna `conta_id` na tabela `transacoes`.
* **Sintoma:** Sequential Scan com leitura e descarte de ~150 mil registros por consulta.
* **Impacto:** Violação do SLO bancário ($P99 > 600\text{ms}$).
* **Solução Definitiva:** Criar um índice composto em `(conta_id, data_transacao DESC)` para transformar o `Seq Scan` em um cirúrgico `Index Scan` (objeto do **Lab 03A**).

---

## 🧪 Validação & Critérios de Aceite

O laboratório é considerado **concluído com sucesso** quando:
* [x] A conexão interativa com o PostgreSQL foi estabelecida com sucesso no banco `banco_db`.
* [x] A contagem de 150.000 registros na tabela `transacoes` foi conferida.
* [x] A instrução `EXPLAIN ANALYZE` foi executada na query de extrato da conta 1001.
* [x] O operador `Seq Scan on transacoes` e a métrica `Rows Removed by Filter` (> 140.000 linhas) foram localizados e anotados.
* [x] A correlação entre o descarte de linhas no Postgres e a violação de SLO no k6 foi compreendida.

---

## 🧹 Cleanup

Para sair do cliente interativo do PostgreSQL e retornar ao terminal bash:

```sql
\q
```

Retorne ao diretório raiz de laboratórios:

```bash
cd ..
```

---

## 💡 Desafios Complementares (Para Alunos Avançados)

Se você concluiu a análise do plano antes do tempo previsto, explore as auditorias avançadas de memória e custo:

### Desafio 1: Auditoria de Memória e Disco com `EXPLAIN (ANALYZE, BUFFERS)`
No PostgreSQL, o comando `BUFFERS` audita exatamente quantas páginas de 8 KB foram lidas do disco versus quantas vieram da memória cache (*Shared Buffers*).

1. No `psql`, execute:
   ```sql
   EXPLAIN (ANALYZE, BUFFERS)
   SELECT * FROM transacoes 
   WHERE conta_id = 1001 
   ORDER BY data_transacao DESC 
   LIMIT 20;
   ```
2. Inspecione a linha de buffers no plano:
   ```text
   Buffers: shared hit=975 read=250
   ```
   * **`shared hit`:** Blocos encontrados diretamente na memória RAM do PostgreSQL.
   * **`shared read`:** Blocos que o PostgreSQL precisou buscar fisicamente no disco/SSD.
   * Observe o volume astronômico de blocos manipulados para buscar apenas 20 linhas!

### Desafio 2: Antecipando o Remédio da Aula 03 (Simulação do Índice)
Quer ver o que acontecerá na Aula 03 quando aplicarmos o índice relacional correto?

1. Crie um índice temporário no `psql`:
   ```sql
   CREATE INDEX idx_temp_extrato ON transacoes (conta_id, data_transacao DESC);
   ```
2. Reexecute o `EXPLAIN ANALYZE`:
   ```sql
   EXPLAIN ANALYZE
   SELECT * FROM transacoes WHERE conta_id = 1001 ORDER BY data_transacao DESC LIMIT 20;
   ```
3. Observe o milagre da engenharia de banco de dados:
   * O `Seq Scan` desaparece e dá lugar a um **`Index Scan using idx_temp_extrato`**.
   * O `Execution Time` despenca de ~38ms para **menos de 0.08ms** (mais de 400x mais rápido!).
   * O `Rows Removed by Filter` vira **0**!
4. **Remova o índice temporário** para não invalidar o ambiente da Aula 03:
   ```sql
   DROP INDEX idx_temp_extrato;
   ```
