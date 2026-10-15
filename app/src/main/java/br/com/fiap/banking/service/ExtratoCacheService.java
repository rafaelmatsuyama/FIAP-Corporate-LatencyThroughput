package br.com.fiap.banking.service;

import br.com.fiap.banking.entity.Transacao;
import br.com.fiap.banking.repository.TransacaoRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.List;

@Service
public class ExtratoCacheService {

    private static final Logger log = LoggerFactory.getLogger(ExtratoCacheService.class);

    private final TransacaoRepository transacaoRepository;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    @Value("${app.cache.enabled:false}")
    private boolean cacheEnabled;

    @Value("${app.cache.ttl-seconds:30}")
    private long ttlSeconds;

    public ExtratoCacheService(TransacaoRepository transacaoRepository,
                               StringRedisTemplate redisTemplate,
                               ObjectMapper objectMapper) {
        this.transacaoRepository = transacaoRepository;
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
    }

    /**
     * Consulta o extrato bancário aplicando o padrão Cache-Aside (Lazy Loading).
     *
     * 1. Se o cache estiver desabilitado (padrão): consulta direto no banco relacional.
     * 2. Se habilitado:
     *    - Verifica se a chave existe no Redis (Cache Hit: resposta sub-milissegundo).
     *    - Se ausente (Cache Miss): consulta no PostgreSQL, popula o Redis com TTL e retorna.
     */
    public List<Transacao> buscarExtrato(Long contaId) {
        if (!cacheEnabled) {
            return transacaoRepository.findByContaIdOrderByDataTransacaoDesc(
                    contaId,
                    PageRequest.of(0, 50)
            );
        }

        String cacheKey = "extrato:" + contaId;

        // 1. Tenta recuperar do Redis (Cache-Aside: Read Path)
        try {
            String cachedJson = redisTemplate.opsForValue().get(cacheKey);
            if (cachedJson != null && !cachedJson.isBlank()) {
                log.debug("Cache HIT para chave {}", cacheKey);
                return objectMapper.readValue(cachedJson, new TypeReference<List<Transacao>>() {});
            }
        } catch (Exception e) {
            log.warn("Falha na leitura do cache Redis para chave {}. Fallback para banco: {}", cacheKey, e.getMessage());
        }

        // 2. Cache MISS: Consulta no banco de dados relacional
        log.debug("Cache MISS para chave {}. Consultando PostgreSQL...", cacheKey);
        List<Transacao> extrato = transacaoRepository.findByContaIdOrderByDataTransacaoDesc(
                contaId,
                PageRequest.of(0, 50)
        );

        // 3. Popula o cache Redis com TTL determinístico
        try {
            String json = objectMapper.writeValueAsString(extrato);
            redisTemplate.opsForValue().set(cacheKey, json, Duration.ofSeconds(ttlSeconds));
            log.debug("Chave {} armazenada no Redis com TTL de {}s", cacheKey, ttlSeconds);
        } catch (Exception e) {
            log.warn("Falha ao gravar no cache Redis para chave {}: {}", cacheKey, e.getMessage());
        }

        return extrato;
    }

    public boolean isCacheEnabled() {
        return cacheEnabled;
    }
}
