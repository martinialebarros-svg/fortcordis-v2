# Plan - portal-clinica-recuperacao-acesso-whatsapp

Data: 2026-09-20
Responsavel: Martiniano Barros
Status: draft

## Ordem

O trabalho se apoia quase todo em peca ja entregue e em producao
(`portal_clinic_device_trust_service`, modo laudos, escopo de sessao). O que e novo e
o pedido e o token descartavel.

### Fase 0 - dependencia externa, comeca antes de tudo

Submeter o modelo proprio na Meta, nas duas contas. Leva ~1 dia e nao bloqueia o
desenvolvimento, so o rollout - entao sai na frente para nao ser o caminho critico.
Texto precisa dizer que **a unidade pediu** e trazer a validade.

Conferir antes de submeter: nome ainda livre. Rejeicao trava o nome por 30 dias na
conta, como registrado em `portal-clinica-link-laudo-whatsapp`.

### Fase 1 - banco e servico

- Migracao `portal_clinic_access_recoveries` pelo runner proprio.
- Servico `portal_clinic_access_recovery_service.py`: emitir, resolver, marcar uso,
  contar pedidos da janela. Espelhar `portal_clinic_exam_link_service` na forma - o
  token opaco por `generate_opaque_token` e guardado por `hash_secret`, sem a
  derivacao por HMAC, que ali existia so para o reenvio repetir a URL e aqui nao faz
  sentido.
- Conferir se `portal_clinic_trusted_devices.origin_exam_link_id` ja aceita nulo.

### Fase 2 - endpoints

- `POST /clinicas/recuperar-acesso` e `POST /clinicas/recuperar-acesso/{token}`.
- Reaproveitar o padrao de recusa unica: uma funcao resolve e todas as saidas devolvem
  o mesmo 404, como `_resolver_link_laudo`.
- O segundo endpoint chama o servico de confianca de dispositivo que ja existe; nao
  duplicar emissao de sessao.

### Fase 3 - entrega

- `send_whatsapp_access_recovery` em `portal_clinic_auth_service.py`, ao lado das tres
  irmas que ja existem.
- Chave de idempotencia por linha de recuperacao.
- Limite diario contado **so** sobre pedidos cujo envio saiu (CB-004).

### Fase 4 - frontend

- Acao e formulario na tela publica de `/clinica-parceira`.
- Pagina `/acesso-laudos/[token]`, irma de `/laudo/[token]`, com `noindex` e
  `no-referrer`.
- A confirmacao de conexao segue RF-023: so diz que conectou depois de a sessao
  provar que o cookie colou.

### Fase 5 - testes

- Backend: arquivo proprio, no espirito de `test_portal_clinic_device_trust.py`.
  Entrar na lista do `migrations-ci.yml` **se** cobrir autorizacao - e o criterio que
  aquela lista usa, nao "todo teste novo".
- Frontend: a pagina nova e o formulario.
- Os casos que mais importam sao os de nao-vazamento: CA-002 (mesma resposta para
  tudo) e CA-004 (403 no financeiro).

### Fase 6 - rollout

- Flag desligada no merge.
- Ligar em stage e rodar os cenarios manuais.
- Producao so depois de o modelo estar aprovado - senao o pedido e aceito e a mensagem
  nao chega, e por NFR-003 a tela nao pode explicar isso a quem pediu.

## Decisoes que faltam antes da Fase 1

- **CB-001**: duas clinicas com o mesmo numero. A recomendacao da spec e nao enviar e
  registrar, mas e decisao de operacao.
- **Modelo da Meta**: proprio (recomendado) ou reaproveitar `convite_portal_clinica_v2`
  para nao esperar a analise.

## Riscos de execucao

- Contar o limite diario antes de saber se o envio saiu inverteria CB-004 e deixaria
  uma clinica sem recurso justamente quando a Cloud API falhou.
- Emitir a sessao direto no endpoint, em vez de chamar o servico de confianca, criaria
  um segundo lugar onde o escopo `exam:*` e decidido. O escopo tem que continuar
  nascendo em um lugar so.
