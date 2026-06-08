# Spec - financeiro-recibo-os-recebidas

Data: 2026-06-08  
Responsavel: Martiniano + Codex  
Status: done

## 0) Atualizacao de ciclo

- 2026-06-08 (hotfix stage): previa do recibo passou a priorizar renderizacao inline compativel com Safari usando visualizador PDF mais tolerante e acao de abrir em nova aba.
- 2026-06-08 (hotfix stage): corrigido o carregamento da configuracao do usuario no endpoint de recibo para evitar falha em runtime ao gerar PDF na stage.
- 2026-06-08 (hotfix stage): frontend passou a tentar extrair `detail` mesmo quando a API responde erro em `blob`, reduzindo a mensagem generica no modulo Financeiro.

## 1) Escopo funcional

Adicionar geracao de recibo para ordens de servico ja recebidas no modulo Financeiro, com suporte a emissao individual e emissao agrupada para varias OS selecionadas.

## 2) Requisitos funcionais (RF)

- RF-001: usuario deve conseguir gerar recibo PDF de uma OS com status `Pago`.
- RF-002: usuario deve conseguir selecionar varias OS recebidas e gerar um recibo consolidado.
- RF-003: usuario deve conseguir selecionar varias OS recebidas e gerar um PDF com recibos individuais em sequencia.
- RF-004: recibo deve exibir dados da OS, paciente, tutor, clinica, servico, data de atendimento, data de recebimento e valor quitado.
- RF-005: recibo deve exibir composicao do recebimento com formas de pagamento registradas e eventual uso de credito do cliente.
- RF-006: apenas OS com status `Pago` podem participar da emissao de recibo.
- RF-006A: recibo PDF deve exibir a assinatura do usuario emissor quando houver assinatura pessoal cadastrada; se nao houver, deve usar a assinatura padrao do sistema quando habilitada.
- RF-006B: recibo PDF deve exibir o nome do usuario emissor e o CRMV quando configurado.
- RF-007: usuario deve conseguir compartilhar o recibo por WhatsApp a partir da tela de Financeiro.
- RF-008: usuario deve conseguir compartilhar o recibo por e-mail a partir da tela de Financeiro.
- RF-009: quando o navegador suportar compartilhamento de arquivo, o PDF deve ser enviado diretamente pelo share sheet; caso contrario, o sistema deve baixar o PDF e abrir o canal com mensagem pronta para anexo manual.
- RF-010: antes do envio por WhatsApp ou e-mail, o usuario deve poder revisar e editar a mensagem.
- RF-011: no envio por e-mail, o usuario deve poder revisar e editar o assunto e o destinatario.
- RF-012: no envio por WhatsApp, o usuario deve poder revisar e editar o telefone de destino.
- RF-013: deve existir um modelo base diferente para mensagem de recibo individual e para mensagem de recibo agrupado.
- RF-014: usuario deve conseguir visualizar uma previa do PDF do recibo antes de baixar ou compartilhar.
- RF-015: a previa deve funcionar em navegadores com suporte parcial a `iframe` de `blob`, incluindo fallback compativel com Safari e opcao de abrir o PDF em nova aba.

## 3) Requisitos nao funcionais (NFR)

- NFR-001: geracao deve reaproveitar a infraestrutura atual de PDF do backend para manter padrao visual e baixo risco.
- NFR-002: quando algum `os_id` informado nao existir ou nao estiver recebido, a API deve rejeitar a emissao com erro explicito.
- NFR-003: o frontend deve deixar claro quantas OS recebidas estao visiveis e quantas foram selecionadas.
- NFR-004: o fallback sem compartilhamento nativo nao deve bloquear a operacao; o usuario precisa sair com PDF baixado e mensagem pronta.
- NFR-005: assinatura no recibo deve seguir a mesma hierarquia ja usada nos laudos para evitar comportamento divergente no produto.

## 4) Contratos tecnicos

### API

- `GET /ordens-servico/relatorios/recibos/pdf`
  - obrigatorio: `os_ids` CSV
  - opcional: `agrupar=true|false`
  - `agrupar=false`: gera um PDF com um recibo por OS
  - `agrupar=true`: gera um recibo consolidado com todas as OS selecionadas
  - inclui assinatura do usuario emissor e fallback da assinatura do sistema

### Frontend

- Tela afetada:
  - `frontend/app/financeiro/page.tsx`
- Comportamento:
  - checkboxes apenas para OS com status `Pago`
  - acao rapida `Recibo` por linha paga
  - acoes de lote `Gerar recibo` e `Gerar recibo agrupado`
  - acoes de lote `WhatsApp` e `E-mail`
  - apoio operacional com `Selecionar recebidas` e `Limpar selecao`
  - acoes por linha para compartilhar recibo unitario
  - modal de revisao antes do envio para editar mensagem e dados do canal
  - editor de modelo para mensagem base do recibo individual
  - editor de modelo para mensagem base do recibo agrupado
  - modal de previa do PDF do recibo
  - fallback da previa com visualizador PDF compativel e acao `Abrir em nova aba`

## 5) Criterios de aceitacao (CA)

- CA-001: ao clicar em `Recibo` numa OS paga, um PDF do recibo individual e baixado.
- CA-002: ao selecionar 2+ OS pagas e usar `Gerar recibo agrupado`, um PDF consolidado e baixado.
- CA-003: ao selecionar 2+ OS pagas e usar `Gerar recibo`, um PDF com recibos individuais em paginas sequenciais e baixado.
- CA-004: tentativa de gerar recibo para OS pendente/cancelada deve ser bloqueada na UI e validada na API.
- CA-005: recibo deve refletir pagamentos salvos em `ordens_servico_pagamentos` e credito consumido quando existir.
- CA-006: no compartilhamento por WhatsApp/e-mail, o sistema deve tentar compartilhar o PDF automaticamente e, se nao for possivel, baixar o arquivo e abrir o canal com mensagem pronta.
- CA-007: ao clicar em `WhatsApp` ou `E-mail`, deve abrir um modal com a mensagem preenchida e editavel antes da continuidade.
- CA-008: recibo PDF deve sair com assinatura do usuario emissor quando existir, com fallback para assinatura padrao do sistema.
- CA-009: a mensagem inicial do compartilhamento deve usar modelos diferentes para recibo individual e agrupado.
- CA-010: ao clicar em `Previa`, o sistema deve abrir uma visualizacao do PDF do recibo sem exigir download imediato.
- CA-011: em navegadores como Safari, a previa deve continuar acessivel com renderer compativel e alternativa explicita para abrir o PDF em nova aba.

## 6) Fora de escopo

- envio automatico do recibo por WhatsApp ou e-mail;
- assinatura digital do recibo;
- filtros dedicados apenas para historico de recibos emitidos.
