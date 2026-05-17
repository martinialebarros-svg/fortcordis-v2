# FOR-32 OPS-02 Idempotencia em laudo_pdf_jobs e xml_import_jobs

## Problema
Em cenarios concorrentes, duas requisicoes podem criar jobs duplicados para o mesmo trabalho assíncrono.

## Objetivo
Garantir idempotencia de criacao de job para PDF de laudo e importacao XML, com protecao no banco e fallback no servico.

## Resultado esperado
- apenas um job ativo (`pending/processing`) por chave idempotente
- chamadas repetidas retornam o job existente, sem duplicacao
