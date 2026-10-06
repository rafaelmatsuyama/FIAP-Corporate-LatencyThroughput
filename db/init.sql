-- =====================================================================
-- BANCO DE DADOS: Core Banking Simulado (Banco Itaú / FIAP Corporate)
-- =====================================================================

CREATE TABLE IF NOT EXISTS contas (
    id BIGINT PRIMARY KEY,
    numero VARCHAR(20) NOT NULL UNIQUE,
    titular VARCHAR(100) NOT NULL,
    saldo NUMERIC(15,2) NOT NULL DEFAULT 1000.00,
    criado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ATENÇÃO (DESIGN DIDÁTICO INTENCIONAL):
-- A tabela transacoes NÃO possui índice composto em (conta_id, data_transacao).
-- Isso força o PostgreSQL a realizar um Sequential Scan (Full Table Scan)
-- na consulta de extrato, gerando a cauda longa no P99 (Lab 01B / Lab 02B).
CREATE TABLE IF NOT EXISTS transacoes (
    id BIGSERIAL PRIMARY KEY,
    conta_id BIGINT NOT NULL,
    tipo VARCHAR(30) NOT NULL,
    valor NUMERIC(15,2) NOT NULL,
    descricao VARCHAR(255) NOT NULL,
    data_transacao TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 1. SEED DE CONTAS: 100 contas corporativas (1001 a 1100)
INSERT INTO contas (id, numero, titular, saldo, criado_em)
SELECT 
    i,
    '000' || i,
    'Correntista ' || i,
    (1500.00 + (i % 200) * 25.50)::NUMERIC(15,2),
    NOW() - INTERVAL '90 days'
FROM generate_series(1001, 1100) AS i
ON CONFLICT (id) DO NOTHING;

-- 2. SEED DE TRANSAÇÕES: 150.000 registros históricos
-- O volume de 150k registros garante tamanho suficiente (~25MB) para provocar
-- o gargalo de I/O de disco e Sequential Scan durante carga concorrente no k6.
INSERT INTO transacoes (conta_id, tipo, valor, descricao, data_transacao)
SELECT 
    1001 + (floor(random() * 100))::BIGINT,
    CASE 
        WHEN random() < 0.4 THEN 'PIX_RECEBIDO'
        WHEN random() < 0.7 THEN 'PAGAMENTO_BOLETO'
        ELSE 'TRANSFERENCIA_TED'
    END,
    (random() * 850.00 + 5.00)::NUMERIC(15,2),
    'Transação bancária automatizada ref #' || s,
    NOW() - (random() * INTERVAL '90 days')
FROM generate_series(1, 150000) AS s;
