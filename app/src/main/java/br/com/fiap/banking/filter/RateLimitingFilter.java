package br.com.fiap.banking.filter;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Filtro HTTP de Defesa de Borda aplicando o algoritmo Token Bucket em memória.
 *
 * Protege o core banking de sobrecargas e ataques de negação de serviço (DDoS/avalanche),
 * rejeitando requisições excedentes com HTTP 429 (Too Many Requests) e cabeçalho Retry-After.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 1)
public class RateLimitingFilter implements Filter {

    private static final Logger log = LoggerFactory.getLogger(RateLimitingFilter.class);

    @Value("${app.ratelimit.enabled:false}")
    private boolean enabled;

    @Value("${app.ratelimit.capacity:50}")
    private int capacity;

    @Value("${app.ratelimit.refill-tokens-per-second:50}")
    private int refillTokensPerSecond;

    private final AtomicInteger currentTokens = new AtomicInteger(50);
    private final AtomicLong lastRefillTimestamp = new AtomicLong(System.currentTimeMillis());

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {

        if (!enabled) {
            chain.doFilter(request, response);
            return;
        }

        HttpServletRequest httpRequest = (HttpServletRequest) request;
        HttpServletResponse httpResponse = (HttpServletResponse) response;

        String path = httpRequest.getRequestURI();

        // Endpoints de observabilidade e healthcheck nunca sofrem rate limit
        if (path.startsWith("/actuator") || path.startsWith("/health")) {
            chain.doFilter(request, response);
            return;
        }

        refillTokens();

        if (tryConsumeToken()) {
            chain.doFilter(request, response);
        } else {
            // Rejeição limpa e imediata na borda com HTTP 429
            httpResponse.setStatus(429);
            httpResponse.setContentType("application/json");
            httpResponse.setHeader("Retry-After", "1");
            httpResponse.setHeader("X-RateLimit-Limit", String.valueOf(capacity));
            httpResponse.setHeader("X-RateLimit-Remaining", "0");

            String jsonError = """
                {"status":429,"error":"Too Many Requests","message":"Limite de taxa excedido. Tente novamente em 1 segundo."}
                """;
            httpResponse.getWriter().write(jsonError);
            log.warn("Rate limit excedido para rota {} - HTTP 429 retornado imediatamente", path);
        }
    }

    private synchronized void refillTokens() {
        long now = System.currentTimeMillis();
        long elapsedMillis = now - lastRefillTimestamp.get();

        if (elapsedMillis >= 1000) {
            int intervals = (int) (elapsedMillis / 1000);
            int tokensToAdd = intervals * refillTokensPerSecond;
            int newTokens = Math.min(capacity, currentTokens.get() + tokensToAdd);

            currentTokens.set(newTokens);
            lastRefillTimestamp.set(now);
        }
    }

    private boolean tryConsumeToken() {
        while (true) {
            int available = currentTokens.get();
            if (available <= 0) {
                return false;
            }
            if (currentTokens.compareAndSet(available, available - 1)) {
                return true;
            }
        }
    }
}
