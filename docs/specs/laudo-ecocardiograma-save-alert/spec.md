# Spec - laudo-ecocardiograma-save-alert

Data: 2026-07-30
Responsavel: Martiniano + Codex
Status: done

## 1) Escopo funcional

Adicionar uma confirmacao preventiva ao salvamento de ecocardiogramas novos e
existentes. A mensagem deve identificar se falta aplicar a analise qualitativa,
carregar imagens ou cumprir ambos os itens. Cancelar interrompe o fluxo antes da
persistencia e abre a aba adequada; confirmar mantem a possibilidade de
salvamento excepcional.

## 2) Requisitos funcionais (RF)

- RF-001: verificar a pendencia no fluxo de criacao e no fluxo de edicao.
- RF-002: considerar a analise qualitativa aplicada somente quando
  `ecocardiogramaEstruturado.usar_no_laudo` estiver ativo.
- RF-003: na criacao, considerar imagem carregada somente quando existir upload
  temporario concluido.
- RF-004: na edicao, considerar imagens persistidas ou novos uploads concluidos.
- RF-005: exibir mensagem especifica para uma pendencia ou mensagem conjunta
  para as duas.
- RF-006: cancelar a confirmacao deve impedir chamadas de persistencia e abrir
  `qualitativa` quando a analise estiver pendente; caso contrario, abrir
  `imagens`.
- RF-007: confirmar deve permitir o salvamento excepcional sem alterar os dados.
- RF-008: nao exibir esse alerta em laudos de pressao arterial ou de outro tipo.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (performance): a verificacao deve ser local e sincrona, sem nova
  requisicao de rede.
- NFR-002 (seguranca/permissoes): manter autenticacao e autorizacao existentes,
  sem criar endpoint.
- NFR-003 (integridade clinica): nao aplicar, preencher ou modificar analise
  qualitativa automaticamente.

## 4) Contratos tecnicos

### API

- Endpoint: sem alteracao.
- Metodo: sem alteracao.
- Payload: sem alteracao.
- Resposta: sem alteracao.

### Banco/migracoes

- Tabelas/colunas afetadas: nenhuma.
- Indices/constraints: nenhum.
- Migracao necessaria: nao.

### Frontend

- Telas afetadas: `/laudos/novo` e `/laudos/{id}/editar`.
- Estados de UI: `ecocardiogramaEstruturado.usar_no_laudo`, imagens persistidas
  e uploads temporarios concluidos.
- Regras de exibicao/erro: usar confirmacao nativa imediatamente antes da
  montagem/persistencia final; no cancelamento, navegar para a aba pendente.

## 5) Compatibilidade e rollout

- Backward compatibility: payloads, APIs e dados existentes permanecem iguais.
- Feature flag: nao necessaria.
- Estrategia de rollback: remover a chamada do alerta e seu helper compartilhado.
- Estrategia de rollout: publicar primeiro em `stage`, aguardar workflows e
  smokes finais, e somente entao promover o mesmo snapshot validado para
  producao.

## 6) Criterios de aceitacao (CA)

- CA-001: sem analise aplicada e sem imagem, o alerta lista as duas pendencias.
- CA-002: com apenas uma pendencia, o alerta menciona somente o item ausente.
- CA-003: com analise aplicada e imagem disponivel, o salvamento segue sem alerta.
- CA-004: cancelar nao inicia persistencia e abre a aba do item pendente.
- CA-005: confirmar permite continuar o salvamento.
- CA-006: laudo de pressao arterial nao recebe o alerta.
- CA-007: criacao e edicao usam a mesma regra de mensagem.

## 7) Casos de borda

- CB-001: arquivo selecionado cujo upload falhou nao conta como imagem carregada.
- CB-002: imagem ja persistida em laudo editado conta mesmo sem novo upload.
- CB-003: quando faltam ambos, o cancelamento abre primeiro a aba qualitativa.

## 8) Fora de escopo

- Validacao obrigatoria no backend.
- Mudanca visual do editor ou substituicao da confirmacao nativa por modal.
