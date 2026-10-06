package br.com.fiap.banking.dto;

import java.math.BigDecimal;

public class TransferenciaDTO {

    private Long contaOrigem;
    private Long contaDestino;
    private BigDecimal valor;

    public TransferenciaDTO() {
    }

    public TransferenciaDTO(Long contaOrigem, Long contaDestino, BigDecimal valor) {
        this.contaOrigem = contaOrigem;
        this.contaDestino = contaDestino;
        this.valor = valor;
    }

    public Long getContaOrigem() {
        return contaOrigem;
    }

    public void setContaOrigem(Long contaOrigem) {
        this.contaOrigem = contaOrigem;
    }

    public Long getContaDestino() {
        return contaDestino;
    }

    public void setContaDestino(Long contaDestino) {
        this.contaDestino = contaDestino;
    }

    public BigDecimal getValor() {
        return valor;
    }

    public void setValor(BigDecimal valor) {
        this.valor = valor;
    }
}
