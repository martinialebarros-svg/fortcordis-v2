# Spec — deploy-immutable-sha

Data: 2026-10-22
Status: implementado e validado localmente; teste servido em stage pendente

## Contrato

- RF-001: cada checkout dos dois workflows usa `github.sha` explicitamente.
  Antes de executar os gates, validar SHA completo hexadecimal minúsculo de
  40 caracteres e `github.ref == refs/heads/<branch esperada>`. Isso também
  rejeita um dispatch manual de produção fora de `main`.
- RF-002: a VPS busca o commit informado e extrai os scripts desse mesmo SHA,
  sem usar uma ponta móvel como fonte do instalador. O contexto `DEPLOY_SHA` e
  `DEPLOY_REF` é transmitido ao instalador e preservado pelo wrapper stage.
- RF-003: antes de backup, reset ou serviços, o instalador confirma ref/branch,
  busca a branch e o commit e exige que o commit seja ancestral da branch
  remota. Branch avançada é permitida; SHA ausente/inválido, ref incompatível,
  fetch malsucedido ou commit fora da branch abortam sem fallback.
- RF-004: o reset usa o SHA resolvido e confirma a igualdade exata de HEAD.
  Um avanço remoto após a resolução não altera a revisão escolhida.
- RF-005: chamadas manuais sem `DEPLOY_SHA` ou `DEPLOY_REF` são recusadas,
  inclusive quando ambos estão ausentes. Não existe fallback para a ponta.
  Identidade inválida é recusada antes de preparar serviços, backups ou handlers
  de limpeza/rollback.
- RF-006: preservar sincronização com assertiva de SHA, health, canário,
  observabilidade, restauração dos seis arquivos runtime e rollback existente.
- RF-007: após preparar SSH e antes do primeiro passo que modifica configuração
  na VPS, executar a resolução completa com as funções do instalador do SHA
  gateado transmitidas por stdin. Objeto ausente, fetch falho, commit divergente
  ou fora da branch abortam antes de escrever configurações. Esta verificação
  pode atualizar apenas metadados Git. O instalador repete a verificação antes
  de backup/reset e confirma `DEPLOY_TARGET_SHA == DEPLOY_SHA` antes do reset.

## Critérios de aceitação

| ID | Critério |
| --- | --- |
| CA-001 | Branch avança entre trigger e instalação; scripts e HEAD continuam no SHA gateado. |
| CA-002 | SHA/ref inválidos, ref incompatível, commit fora da branch e fetch falho abortam antes de checkout/reset. |
| CA-003 | Ausência de identidade manual é recusada sem comandos operacionais; wrapper stage transmite o contexto sem trocar o ambiente. |
| CA-004 | Workflows exigem contexto imutável, executam regressões e mantêm o sync e gates existentes. |
| CA-005 | Mudança validada localmente sem rede, banco, serviços ou publicação; teste servido em stage é registrado separadamente. |
| CA-006 | Ambos os workflows verificam o commit na VPS antes das configurações; falhas deixam HEAD, ambiente e backups intactos. |
