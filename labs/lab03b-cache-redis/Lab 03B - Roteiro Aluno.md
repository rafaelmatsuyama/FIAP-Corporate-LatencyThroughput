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

### Passo 6: Teste de Carga Agressivo com k6 (40 VUs)
Agora vamos submeter a arquitetura a um cenário de concorrência intensa. Execute o script do Lab 03B:

```bash
k6 run scripts/lab3b.js
```

Analise o relatório consolidado emitido pelo k6 no terminal:
* **`http_req_duration{name:extrato}`:**
  * **P90:** `~1.2ms - 1.8ms`
  * **P95:** `~1.5ms - 2.2ms`
  * **P99:** **`~2.0ms - 2.8ms`** (Latência sub-milissegundo mantida sob estresse!)
* O threshold corporativo (`p(99) < 20ms`) é aprovado com ampla margem de segurança (**[ ✓ ] PASS**).
* A taxa de vazão (TPS) atinge centenas de requisições por segundo.

---

### Passo 7: Análise de Telemetria e Blindagem no Grafana
Abra o navegador no Grafana (`http://localhost:3000` | admin / admin):
1. Acesse o dashboard **Core Banking - Visão de Performance**.
2. Observe a blindagem arquitetural da camada de persistência:
   * **Consagração da Latência:** Enquanto o tuning de índices no Lab 03A reduziu o P99 para ~35ms, o Cache-Aside no Redis fez a latência colapsar para **~2ms** (um ganho de 15x sobre o banco indexado e superior a 300x em relação ao baseline da Aula 01).
   * **Painel Database Query Duration:** Mesmo sob a elevação acentuada da vazão no extrato (40 VUs), as consultas no PostgreSQL permanecem em repouso quase absoluto. A camada in-memory absorveu o tráfego crítico.
   * **Conexões HikariCP:** Ausência completa de saturação ou retenção de conexões no pool da aplicação.

---

## 🧪 Validação & Critérios de Aceite

O laboratório é considerado **concluído com sucesso** quando:
* [x] A classe `ExtratoCacheService.java` foi inspecionada no VS Code.
* [x] A API bancária foi reiniciada com `APP_CACHE_ENABLED=true`.
* [x] A chave `extrato:1001` foi conferida no `redis-cli` com `TTL` ativo.
* [x] O comando `INFO stats` confirmou o incremento de `keyspace_hits`.
* [x] O script `scripts/lab3b.js` rodou com sucesso acusando P99 do extrato em **~2ms**.
* [x] O Grafana confirmou o isolamento e proteção do PostgreSQL sob carga.

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
