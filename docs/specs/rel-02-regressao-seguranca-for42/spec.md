# Especificacao

## Requisitos funcionais
- RF-01: existir script executavel para regressao de seguranca de API (`scripts/security_regression_smoke.sh`).
- RF-02: script deve validar headers de seguranca em endpoint backend.
- RF-03: script deve validar bloqueio de rota protegida sem credencial (`401`).
- RF-04: script deve validar CORS preflight com `Origin` configuravel.
- RF-05: quando credenciais forem fornecidas, script deve validar emissao de cookies e fluxo CSRF (falha sem header / sucesso com header valido).
- RF-06: documentacao deve incluir checklist manual complementar para frontend.

## Requisitos nao funcionais
- RNF-01: script deve rodar via `bash` sem dependencias externas alem de `curl` e `python3` (opcional para suite unit).
- RNF-02: validacao deve ser parametrizavel por ambiente (`BASE_URL`, `API_BASE_URL`, `ORIGIN`).
- RNF-03: saida deve ser objetiva com resumo `PASS/FAIL`.

## Criterios de aceitacao
- CA-001: script executa e retorna `PASS` no ambiente corretamente configurado.
- CA-002: ausencia de credenciais nao quebra o script (deve pular bloco login/csrf com aviso).
- CA-003: checklist em `docs/SECURITY-REGRESSION-CHECKLIST.md` descreve execucao e troubleshooting.
