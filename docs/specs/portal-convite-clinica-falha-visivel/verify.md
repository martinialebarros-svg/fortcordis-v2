# Verify - portal-convite-clinica-falha-visivel

Data: 2026-09-15  
Responsavel: Martiniano Barros  
Status: verificado por teste automatizado

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| RF-002, RF-003 / CA-001 | aceitacao | `test_convite_sem_copia_manual_propaga_o_motivo_da_falha` - servico devolve 400 com `template not approved`, o 502 contem esse texto | ok |
| RF-003 / CA-002 | aceitacao | `test_convite_sem_token_interno_diz_que_a_integracao_nao_esta_configurada` - token vazio, o 502 contem "nao configurada" | ok |
| RF-004 / CA-003 | aceitacao | `test_convite_cai_para_copia_manual_quando_envio_pelo_whatsapp_falha` segue passando: 200, `manual_copy`, `provider` nulo, link valido | ok |
| RF-001 | funcional | saida da suite mostra `Convite da clinica 1 nao foi enviado por WhatsApp: Integracao interna do WhatsApp nao configurada.` | ok |
| RF-005 | tecnico | o log formata id da clinica e motivo; motivo vem do servico de entrega, que descreve condicao e nao carrega destino nem token | ok |
| RT-001..RT-004 | tecnico | revisao de codigo: logger no padrao do repo, `HTTPException` antes de `Exception`, `exc_info` so no ramo generico, `from exc` nos dois | ok |
| CA-004 | tecnico | secao 2 | ok |

## 2) Testes executados

```bash
cd backend && venv/bin/python -m unittest tests.test_portal_clinic_invite_auth
```

**19 testes, OK** (eram 17; dois novos).

## 3) Teste negativo

Trocando o `detail` do ramo de ambiente de volta pelo texto generico -- isto e,
voltando ao comportamento anterior:

```
AssertionError: 'nao configurada' not found in 'Nao foi possivel enviar o convite por WhatsApp.'
Ran 19 tests ... FAILED (failures=1)
```

Confirma que o teste cobre o defeito, e nao apenas o caminho novo.

## 4) Como o defeito foi encontrado

Nao veio de revisao de codigo: veio de tentar usar a funcionalidade. O
responsavel tentou enviar o convite varias vezes em stage, nada chegou, e a tela
nao deu pista nenhuma.

O diagnostico precisou de tres passos que **so foram necessarios por causa do
`except` mudo**:

1. Ler a resposta da API -- `delivery_status: "manual_copy"`,
   `delivery_provider: null`.
2. Confirmar `whatsapp_agenda_enabled: true` pelo endpoint `lembrete-preview`,
   eliminando "envio pulado" e provando que havia excecao engolida.
3. Ler `send_approved_utility_template` para enumerar o que pode lancar.

Com log, o passo 1 teria respondido tudo.

## 5) O que esta entrega nao resolve

**Quem esta na tela continua sem saber.** Com `allow_manual_copy: true` -- que e
o que a interface envia -- a resposta segue `200` com
`delivery_status: "manual_copy"` e nenhuma pista. O motivo agora existe, mas so
no log da VPS.

Fechar isso exige campo novo na resposta e mudanca de interface. Fica registrado
aqui e na secao 5 do `intent.md`, como decisao a parte.

## 6) A causa raiz segue aberta

Esta entrega torna a falha legivel; nao diz por que ela acontece em stage.

A hipotese mais forte e `WHATSAPP_AGENDA_INTERNAL_TOKEN` vazio naquele ambiente
-- coerente com `reminder_scheduler_enabled: false`, que faz nada mais ali
exercitar esse caminho. Nao foi possivel confirmar: o acesso SSH a VPS nao esta
disponivel nesta sessao.

Depois desta correcao chegar em stage, uma nova tentativa de convite registra o
motivo no log e encerra a duvida.
