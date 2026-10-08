# Lab 02A - Rastreamento Ponta a Ponta com Tracing Distribuído (Jaeger)

**Programa:** Modernização 2026 — Engenharia de Software  
**Parceria:** Alura Business & FIAP Corporate  
**Ambiente:** GitHub Codespaces / Docker Local (Linux x86_64, 2 vCPUs, 8 GB RAM)  
**Linguagem & Stack:** OpenTelemetry (OTel), Jaeger All-in-One, Spring Boot 3 (Java 21), Grafana k6  
**Duração:** 35 minutos  

---

## 🎯 Objetivo do Lab

Ao concluir este laboratório, você será capaz de:
1. Validar os serviços de telemetria distribuída da stack do Core Banking via `docker compose`.
2. Disparar uma rajada controlada de aquecimento com o **k6** para alimentar o coletor de telemetria com dados frescos em tempo real.
3. Acessar e navegar na interface web do **Jaeger UI** (`http://localhost:16686`), filtrando operações do serviço `banking-api`.
4. Interpretar criticamente a árvore de spans hierárquica e a visualização em cascata (*Waterfall*) de requisições degradadas (`/api/v1/contas/{id}/extrato`).
5. Isolar matematicamente em qual camada reside a latência crítica do incidente bancário (comprovando que a aplicação Java/Spring Boot e a serialização JSON respondem em $< 5\text{ms}$, enquanto o acesso ao banco retém $> 95\%$ do tempo total).
6. Compreender a mecânica do padrão **W3C Trace Context** correlacionando dados do tracing distribuído com logs estruturados em JSON.

---

## 📋 Pré-requisitos & Materiais

* Contêineres da stack do Core Banking ativos e saudáveis (inicializados na Aula 01 ou via comando no Passo 2).
* Terminal bash aberto no Codespaces ou máquina local.
* Navegador web apontando para o Jaeger UI (`http://localhost:16686`).
* Arquivos do repositório:
  * `docker-compose.yml`: Definição dos serviços de infraestrutura e aplicação.
  * `scripts/lab1b.js`: Script declarativo de carga mista do k6 para gerar traces.

---

## 🚀 Passo a Passo Guiado

### Passo 1: Posicionamento no Diretório de Trabalho
No terminal, garanta que você está posicionado no diretório deste laboratório:

```bash
cd labs/lab02a-tracing-jaeger
```

---

### Passo 2: Validar o Estado da Stack de Contêineres
Certifique-se de que todos os contêineres da aplicação e da infraestrutura de observabilidade estão em execução:

```bash
docker compose -f ../../docker-compose.yml ps
```

*Verificação esperada:*
```text
NAME                     IMAGE                      STATUS
banco-api                banco-api:latest           Up (healthy)
banco-postgres           postgres:16-alpine         Up
banco-redis              redis:7-alpine             Up
telemetria-jaeger        jaegertracing/all-in-one   Up
telemetria-prometheus    prom/prometheus:latest     Up
telemetria-grafana       grafana/grafana:latest     Up
```

> [!NOTE]
> Caso a stack esteja desligada, inicialize todos os serviços com:  
> `docker compose -f ../../docker-compose.yml up -d`

---

### Passo 3: Disparar Carga de Aquecimento (Alimentar Telemetria)
O coletor **Jaeger All-in-One** opera com armazenamento em memória RAM (*in-memory storage*). Isso significa que, se a máquina ou os contêineres foram reiniciados, a base de traces inicia zerada.

Dispare uma rajada rápida de carga de 20 segundos com o k6 para gerar telemetria fresca:

```bash
k6 run ../../scripts/lab1b.js --duration 20s
```

Aguarde a conclusão do teste no terminal. Esse comando garantirá centenas de spans recém-gerados e prontos para inspeção no Jaeger.

---

### Passo 4: Acessar a Interface do Jaeger UI
1. No seu navegador, acesse o endereço:
   * **Codespaces:** Abra a aba **Ports** no rodapé do VS Code / Codespaces e clique no ícone de globo na porta **16686**.
   * **Local / Docker Desktop:** Acesse diretamente `http://localhost:16686`.
2. No menu lateral esquerdo (**Search**), configure os filtros de consulta:
   * **Service:** selecione `banking-api`.
   * **Operation:** selecione `GET /api/v1/contas/{id}/extrato`.
   * **Lookback:** `Last 15 minutes` (ou `Last Hour`).
   * **Limit Results:** `20`.
3. Clique no botão azul **Find Traces**.
4. No canto superior direito da lista de resultados, clique na caixa de ordenação e selecione **Longest First** (para listar as requisições mais lentas no topo).

---

### Passo 5: Dissecar a Árvore de Spans (*Waterfall Breakdown*)
Clique sobre o trace com duração mais longa. Você verá a hierarquia pai-filho em cascata:

```text
banking-api: http get /api/v1/contas/{id}/extrato ................. (654ms)
│
└── query [JDBC / PostgreSQL - DataSource Proxy] .................. (642ms) [98.2%] 🚨
      ├── Tag: db.system = postgresql
      ├── Tag: db.user = postgres
      └── Tag: db.statement = SELECT ... FROM transacoes WHERE conta_id = ? ...
```

#### 🔍 O que a decomposição de spans revela:
1. **Span Raiz HTTP (`http get`):** Rastreia o ciclo completo de vida da requisição na borda web (~654ms).
2. **Span Filho JDBC (`query`):** Gerado automaticamente pelo proxy do `datasource-micrometer`, medindo o tempo exato de execução no PostgreSQL.
3. **Persistência Relacional como Culpada:** A query SQL reteve **642 ms** de um total de 654 ms (**mais de 98% do tempo total da requisição**), provando que o atraso não está na camada web, mas sim no banco.

---

### Passo 6: Registrar o Veredito do Comitê de Engenharia
Com base na evidência científica coletada no Jaeger:
* **A aplicação Java/Spring Boot está inocentada:** Não há problema de CPU, loop infinito, vazamento de memória ou ineficiência de código no microsserviço.
* **O gargalo está isolado no Banco de Dados:** Mais de 95% do tempo de espera de cada usuário correntista ocorre enquanto o banco processa a consulta da tabela `transacoes`.
* **Próximo Passo:** Investigar *por que* o PostgreSQL demora centenas de milissegundos para retornar essas linhas (objeto do **Lab 02B** com `EXPLAIN ANALYZE`).

---

## 🧪 Validação & Critérios de Aceite

O laboratório é considerado **concluído com sucesso** quando:
* [x] A interface do Jaeger UI foi acessada com sucesso na porta 16686.
* [x] Traces do serviço `banking-api` na rota `/extrato` foram consultados e ordenados por duração.
* [x] A árvore em cascata (*Waterfall*) de uma requisição com duração $\ge 600\text{ms}$ foi aberta e inspecionada.
* [x] O span JDBC de acesso ao banco de dados foi identificado como responsável por $\ge 95\%$ do tempo total da requisição.
* [x] O `TraceID` hexadecimal único de uma requisição degradada foi anotado para correlação posterior.

---

## 🧹 Cleanup

Como continuaremos a investigação da causa-raiz no banco de dados no **Lab 02B**, **mantenha todos os contêineres ativos**.  
Apenas retorne ao diretório raiz de laboratórios:

```bash
cd ..
```

---

## 💡 Desafios Complementares (Para Alunos Avançados)

Se você concluiu a análise do Jaeger antes do tempo previsto, explore os dois desafios abaixo:

### Desafio 1: Correlacionar TraceID com Logs Estruturados em JSON
O padrão **W3C Trace Context** propaga o identificador único da requisição através de todas as camadas.
1. No Jaeger UI, localize o cabeçalho superior do trace inspecionado e copie o seu **Trace ID** hexadecimal completo (exemplo: `4bf92f3577b34da6a3ce929d0e0e4736`).
2. No terminal, filtre os logs do contêiner da aplicação buscando exatamente por esse identificador:
   ```bash
   docker compose -f ../../docker-compose.yml logs app | grep "<SEU_TRACE_ID>"
   ```
3. Inspecione o payload JSON emitido pelo Micrometer Tracing. Observe como o mesmo `trace_id` e o `span_id` estão registrados na linha de log da aplicação:
   ```json
   {
     "timestamp": "2026-10-08T14:42:15.120Z",
     "level": "INFO",
     "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736",
     "span_id": "00f067aa0ba902b7",
     "thread": "http-nio-8080-exec-4",
     "message": "Consultando extrato para a conta 1001"
   }
   ```

### Desafio 2: Comparativo Anatômico com a Rota Leve (`/saldo`)
1. No Jaeger UI, altere o filtro de **Operation** para `GET /api/v1/contas/{id}/saldo` e clique em **Find Traces**.
2. Abra qualquer um dos traces retornados.
3. Observe que o tempo total da requisição é de apenas **~2ms a 4ms**.
4. Inspecione o span JDBC do saldo: ele leva menos de **1ms**, pois realiza uma busca direta pela chave primária indexada (`WHERE id = ?`).
5. Compare mentalmente: por que a busca por conta no extrato demora 600 vezes mais do que a busca por conta no saldo? Essa resposta será respondida no Lab 02B!
