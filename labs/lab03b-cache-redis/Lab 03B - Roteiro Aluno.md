# Lab 03B - Implementação e Validação do Padrão Cache-Aside com Redis

**Programa:** Modernização 2026 — Engenharia de Software  
**Parceria:** Alura Business & FIAP Corporate  
**Ambiente:** GitHub Codespaces / Docker Local (Linux x86_64, 2 vCPUs, 8 GB RAM)  
**Linguagem & Stack:** Redis 7, redis-cli, Java 21 / Spring Boot 3, Grafana k6, Prometheus, Grafana  
**Duração:** 35 minutos  

---

## 🎯 Objetivo do Lab

Ao concluir este laboratório, você será capaz de:
1. Compreender o padrão arquitetural **Cache-Aside (Lazy Loading)** e sua função primária de proteger a base relacional e acelerar vazão em sistemas de missão crítica.
2. Inspecionar a implementação corporativa no código-fonte Java (`ExtratoCacheService.java`), analisando o fluxo de checagem de chave, serialização JSON e aplicação de **TTL (Time-to-Live)**.
3. Habilitar a camada de cache in-memory na API bancária através de *Feature Toggle* determinístico (`APP_CACHE_ENABLED: "true"`) no ambiente Docker sem atrito de compilação.
4. Conectar interativamente ao console do **Redis 7** (`redis-cli`) para auditar chaves em memória (`KEYS *`), acompanhar a regressão do TTL (`TTL extrato:1001`) e mensurar acertos de cache (`keyspace_hits`).
5. Submeter a API a uma carga agressiva de 40 usuários virtuais com o **k6** (`scripts/lab3b.js`), atestando que a latência P99 despenca para **~1.5ms - 2.5ms** com salto de até 10x na capacidade de vazão (TPS).
6. Analisar o risco e mitigações para o fenômeno do **Thundering Herd (Cache Stampede)** na expiração de chaves quentes.

---

## 📋 Pré-requisitos & Materiais

* Infraestrutura do Core Banking (PostgreSQL, Redis, Jaeger, Prometheus, Grafana e API) — inicializada no Passo 2.
* Índice composto criado no PostgreSQL durante o Lab 03A.
* Navegador web apontando para o Grafana (`http://localhost:3000` | usuário: `admin` / senha: `admin`).

---

## 🚀 Passo a Passo Guiado

### Passo 1: Posicionamento no Diretório de Trabalho
No terminal, certifique-se de que está posicionado no diretório deste laboratório:

```bash
cd labs/lab03b-cache-redis
```

---

### Passo 2: Inicialização e Verificação de Sanidade da Infraestrutura
Antes de avançar para a camada de cache, confirme a inicialização e a integridade de todos os componentes da arquitetura:

```bash
# 1. Inicializar os serviços em segundo plano (caso não estejam ativos)
docker compose -f ../../docker-compose.yml up -d

# 2. Auditar o estado operacional dos contêineres
docker compose -f ../../docker-compose.yml ps
```

*Validação esperada:*
Certifique-se de que os contêineres `banco-api`, `banco-postgres`, `banco-redis`, `telemetria-jaeger`, `telemetria-prometheus` e `telemetria-grafana` estejam em execução com status `Up` ou `healthy`.

---

### Passo 3: Inspecionar a Arquitetura de Cache no Código Java
Abra o arquivo [`app/src/main/java/br/com/fiap/banking/service/ExtratoCacheService.java`](file:///C:/Dropbox/PC/Documents/GitHub/FIAP-Corporate-LatencyThroughput/app/src/main/java/br/com/fiap/banking/service/ExtratoCacheService.java) no editor do VS Code.

Observe a mecânica canônica do padrão **Cache-Aside**:
```java
// 1. Tenta recuperar do Redis (Cache Hit: resposta sub-milissegundo)
String cachedJson = redisTemplate.opsForValue().get(cacheKey);
if (cachedJson != null && !cachedJson.isBlank()) {
    return objectMapper.readValue(cachedJson, new TypeReference<List<Transacao>>() {});
}

// 2. Cache Miss: Busca no banco relacional (PostgreSQL)
List<Transacao> extrato = transacaoRepository.findByContaIdOrderByDataTransacaoDesc(contaId, PageRequest.of(0, 50));

// 3. Popula a memória do Redis com TTL determinístico de 30 segundos
String json = objectMapper.writeValueAsString(extrato);
redisTemplate.opsForValue().set(cacheKey, json, Duration.ofSeconds(ttlSeconds));
```

> [!NOTE]
> **Por que serializar como JSON explícito?**
> Ao utilizar `StringRedisTemplate` com JSON puro em vez de serialização binária padrão do Java, as chaves e valores tornam-se 100% legíveis no `redis-cli` e interoperáveis entre diferentes microsserviços.

---

### Passo 4: Ativar o Cache-Aside no Ambiente Docker
No arquivo `docker-compose.yml` (na raiz do repositório), a variável de controle da feature flag está mapeada. Vamos ativá-la no ambiente de execução:

No terminal, volte para a raiz do repositório:
```bash
cd ../..
```

Reinicie o serviço da API bancária com o cache habilitado:
```bash
APP_CACHE_ENABLED=true docker compose up -d banco-api
```

*(Tempo de execução: aproximadamente **~3 segundos**, reaproveitando a imagem pré-construída).*

Verifique nos logs da API a inicialização com sucesso:
```bash
docker compose logs banco-api --tail 15
```

---

### Passo 5: Executar Consulta Prévia e Auditar o Redis CLI
Efetue uma chamada HTTP para a rota de extrato da conta 1001 para disparar o primeiro *Cache Miss* e popular a memória:

```bash
curl -s http://localhost:8080/api/v1/contas/1001/extrato | head -c 120
```

Em seguida, conecte interativamente ao console do Redis:

```bash
docker exec -it banco-redis redis-cli
```

No prompt do Redis, execute os comandos de auditoria operacional:

1. **Listar as chaves ativas em memória:**
   ```text
   KEYS *
   ```
   *Saída esperada:* `"extrato:1001"`

2. **Checar o conteúdo JSON armazenado na chave:**
   ```text
   GET extrato:1001
   ```

3. **Inspecionar o tempo de vida restante (TTL):**
   ```text
   TTL extrato:1001
   ```
   *Saída esperada:* Um número inteiro entre `30` e `1` (indicando os segundos restantes antes da expiração automática).

4. **Auditar estatísticas de acertos (Hits vs Misses):**
   ```text
   INFO stats
   ```
   *Localize os indicadores:* `keyspace_hits` e `keyspace_misses`.

5. Saia do console do Redis:
   ```text
   exit
   ```

---

### Passo 6: Provocação de Arquitetura — A Armadilha do Vizinho Barulhento (*Noisy Neighbor*)
Muitas equipes assumem que adicionar Redis em uma rota resolve automaticamente a escala de toda a aplicação. Vamos testar essa hipótese submetendo a API a uma carga concorrente mista (saldo, extrato e transferências simultâneas):

```bash
k6 run scripts/lab3b-contencao.js
```

Observe o resultado no console:
* **O Choque de Realidade:** Mesmo com o Redis ativo no extrato, a latência P99 do extrato atinge **> 400ms**, e o threshold é violado!
* **A Pergunta de 1 Milhão de Dólares:** *Por que o `/extrato` degradou se ele está em cache na memória do Redis?*
* **A Resposta Arquitetural:** Microsserviços compartilham recursos finitos do processo hospedeiro:
  1. O pool de conexões **HikariCP** (20 conexões).
  2. O pool de threads HTTP do **Tomcat**.
  3. A CPU compartilhada da máquina virtual.
  Como 70% da carga deste script atacou rotas sem cache (`/saldo` e `/transferencias`), o banco relacional afogou e esgotou as conexões do HikariCP. As threads do Tomcat travaram na fila do banco, represando as requisições de extrato na camada HTTP antes mesmo que pudessem consultar o Redis!
* **A Lição:** O cache protege a consulta que ele atende, mas **não blinda a aplicação contra o esgotamento de recursos compartilhados provocado por vizinhos barulhentos (*Noisy Neighbors*)**.

---

### Passo 7: Consagração da Arquitetura — Teste da Camada Blindada no Redis
Agora vamos submeter a API a um teste focado na rota blindada pelo padrão Cache-Aside (100% do tráfego direcionado para o `/extrato` em memória):

```bash
k6 run scripts/lab3b.js
```

Analise a saída consolidada do k6 no terminal:
* **`http_req_duration{name:extrato}`:**
  * **P90:** `~1.2ms - 3.5ms`
  * **P95:** `~1.8ms - 4.5ms`
  * **P99:** **`~2.0ms - 8.0ms`** (Latência sub-milissegundo in-memory mantida sob concorrência!)
* O threshold corporativo (`p(99) < 20ms`) é aprovado com ampla folga (**[ ✓ ] PASS**).
* Zero consultas ao PostgreSQL: a camada in-memory absorveu 100% da carga!

---

### Passo 8: Análise de Telemetria no Grafana & O Gancho para a Aula 04
Abra o navegador no Grafana (`http://localhost:3000` | admin / admin):
1. Acesse o dashboard **Core Banking - Visão de Performance**.
2. Observe o contraste dramático entre os dois experimentos:
   * **No momento do `lab3b-contencao.js`:** Picos de fila no HikariCP e saturação de conexões gerada pelos endpoints não cacheados.
   * **No momento do `lab3b.js`:** A curva do painel *Database Query Duration* colapsa para **zero**, provando o repouso absoluto da persistência relacional e a eficácia cirúrgica do Cache-Aside.
3. **Ponte para a Aula 04:**
   > *Percebeu como a contenção de conexões no HikariCP quase derrubou nossa aplicação mesmo com Redis? Pois na **Aula 04**, mergulharemos a fundo no dimensionamento de pools de banco (HikariCP), saturação de threads e estratégias de backpressure!*

---

## 🧪 Validação & Critérios de Aceite

O laboratório é considerado **concluído com sucesso** quando:
* [x] A classe `ExtratoCacheService.java` foi inspecionada no VS Code.
* [x] A API bancária foi reiniciada com `APP_CACHE_ENABLED=true`.
* [x] A chave `extrato:1001` foi conferida no `redis-cli` com `TTL` ativo.
* [x] O teste de contenção (`scripts/lab3b-contencao.js`) comprovou a armadilha do vizinho barulhento.
* [x] O script oficial `scripts/lab3b.js` rodou com sucesso acusando P99 do extrato em **~2ms** com aprovação verde (**PASS**).
* [x] O Grafana confirmou o isolamento e repouso do PostgreSQL durante o teste de cache.

---

## 🧹 Cleanup

Para manter a organização do ambiente ao concluir os exercícios:

```bash
cd labs
```

---

## 💡 Desafios Complementares (Para Alunos Avançados)

Se você concluiu o laboratório antes do tempo previsto:

### Desafio 1: O Fenômeno do Thundering Herd (Cache Stampede)
1. Conecte no `redis-cli` e delete manualmente a chave da conta 1001:
   ```text
   DEL extrato:1001
   ```
2. Imediatamente dispare uma rajada rápida com k6 mirando exclusivamente a conta 1001:
   * Observe que a primeira requisição acusa tempo de banco (~35ms), e todas as seguintes voltam a responder em ~2ms.
   * Discuta: e se 500 requisições chegassem exatamente no mesmo milissegundo em que a chave foi deletada? Como um **Distributed Lock** ou **Mutex de Chave** protegeria o banco?

### Desafio 2: Invalidação Ativa em Transações (PIX)
1. No método `realizarTransferencia` em `ContaController.java`, como você implementaria a invalidação do cache da conta origem (`redisTemplate.delete("extrato:" + dto.getContaOrigem())`) para evitar que o correntista veja saldo/extrato desatualizado após um PIX?
