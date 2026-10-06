package br.com.fiap.banking.repository;

import br.com.fiap.banking.entity.Transacao;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TransacaoRepository extends JpaRepository<Transacao, Long> {

    // Query sem índice na tabela transacoes -> provoca Sequential Scan no PostgreSQL
    List<Transacao> findByContaIdOrderByDataTransacaoDesc(Long contaId, Pageable pageable);
}
