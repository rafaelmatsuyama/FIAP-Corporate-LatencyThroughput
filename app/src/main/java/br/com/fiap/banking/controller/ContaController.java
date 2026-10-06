package br.com.fiap.banking.controller;

import br.com.fiap.banking.dto.TransferenciaDTO;
import br.com.fiap.banking.entity.Conta;
import br.com.fiap.banking.entity.Transacao;
import br.com.fiap.banking.repository.ContaRepository;
import br.com.fiap.banking.repository.TransacaoRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1")
public class ContaController {

    private final ContaRepository contaRepository;
    private final TransacaoRepository transacaoRepository;

    public ContaController(ContaRepository contaRepository, TransacaoRepository transacaoRepository) {
        this.contaRepository = contaRepository;
        this.transacaoRepository = transacaoRepository;
    }

    /**
     * Rota Ultraleve: Consulta de Saldo por PK
     * Utiliza índice primário da tabela contas (tempo de resposta < 5ms).
     */
    @GetMapping("/contas/{id}/saldo")
    public ResponseEntity<?> getSaldo(@PathVariable Long id) {
        return contaRepository.findById(id)
                .map(conta -> ResponseEntity.ok(Map.of(
                        "conta", conta.getId(),
                        "titular", conta.getTitular(),
                        "saldo", conta.getSaldo()
                )))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("erro", "Conta não encontrada")));
    }

    /**
     * Rota com Cauda Longa (Gargalo de Performance Didático):
     * Executa consulta de extrato na tabela transacoes sem índice em conta_id.
     * Sob concorrência no k6, provoca Sequential Scan no PostgreSQL e saturação
     * de I/O, elevando o P99 para > 600ms (Violação do SLO < 200ms).
     */
    @GetMapping("/contas/{id}/extrato")
    public ResponseEntity<List<Transacao>> getExtrato(@PathVariable Long id) {
        List<Transacao> extrato = transacaoRepository.findByContaIdOrderByDataTransacaoDesc(
                id,
                PageRequest.of(0, 50)
        );
        return ResponseEntity.ok(extrato);
    }

    /**
     * Rota de Transferência: Operação de Escrita Simples
     * Registra movimentação financeira na tabela transacoes.
     */
    @PostMapping("/transferencias")
    public ResponseEntity<?> realizarTransferencia(@RequestBody TransferenciaDTO dto) {
        if (dto.getContaOrigem() == null || dto.getValor() == null) {
            return ResponseEntity.badRequest().body(Map.of("erro", "Dados incompletos"));
        }

        Transacao transacao = new Transacao(
                dto.getContaOrigem(),
                "TRANSFERENCIA_PIX",
                dto.getValor(),
                "Transferência para conta " + dto.getContaDestino(),
                LocalDateTime.now()
        );
        transacaoRepository.save(transacao);

        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                "status", "CONFIRMADO",
                "transacaoId", transacao.getId(),
                "valor", dto.getValor()
        ));
    }
}
