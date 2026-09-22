# Verify - portal-clinica-recuperacao-acesso-whatsapp

Data: 2026-09-21
Responsavel: Martiniano Barros
Status: planejamento

## 1) Estado da entrega

Esta feature ainda esta em fase de desenho. O `intent.md`, o `plan.md` e o
`spec.md` registram a proposta e os criterios esperados, mas nao ha implementacao
autorizada nem evidencia de execucao para os requisitos descritos.

## 2) Matriz de rastreabilidade

| Escopo | Evidencia esperada | Status |
| --- | --- | --- |
| RF-001 a RF-006 | testes do formulario publico, resposta indistinguivel e resolucao segura do numero cadastrado | pendente |
| RF-007 a RF-011 | testes do token descartavel, expiracao, uso unico, limite diario e entrega pelo modelo aprovado | pendente |
| RF-012 a RF-016 | testes de escopo `exam:*`, dispositivo confiavel, aviso ao gestor e revogacao | pendente |
| RF-017 a RF-018 | testes de auditoria sem token/URL e evento de limite | pendente |
| NFR-001 a NFR-006 | revisao de seguranca, flags desligadas por padrao e ausencia de regressao nos fluxos atuais | pendente |
| CA-001 a CA-011 | suites automatizadas e roteiro manual em stage | pendente |
| CB-001 a CB-005 | decisoes de produto e testes dos casos de borda | pendente |

## 3) Validacoes executadas

- Documentacao revisada quanto ao escopo: recuperacao concede somente acesso aos
  laudos e nao redefine senha nem concede `clinic:read`.
- Nenhum teste funcional foi executado, pois nao existe implementacao desta feature
  neste ciclo.
- Nenhuma flag foi ligada e nenhuma mensagem de WhatsApp foi enviada.

## 4) Pendencias antes de implementar

- Resolver a decisao de CB-001 para numeros compartilhados por mais de uma clinica.
- Aprovar o modelo proprio da Meta ou registrar a decisao de reaproveitar um modelo
  existente.
- Implementar migracao, servico, endpoints, frontend e cobertura automatizada.
- Validar em stage todos os criterios de aceitacao antes de qualquer habilitacao em
  producao.

## 5) Decisao de release

- [ ] Aprovado para stage.
- [ ] Aprovado para producao.
- [x] Nao aprovado: artefato exclusivamente documental e ainda em planejamento.
