# Spec - laudo-aviso-whatsapp-seletor-destino

## Contrato

`POST /laudos/{id}/portal/whatsapp` ganha `destinos` (opcional):

```json
{ "idempotency_key": "...", "destinos": ["clinica", "veterinario:144"] }
```

Chaves: `clinica` e `veterinario:<partner_id>`. Sem o campo, o comportamento é o
de hoje — todos os destinos elegíveis. Lista vazia é 422.

`GET /laudos` e `GET /laudos/{id}` passam a devolver `whatsapp_envios`: o último
resultado por destino.

```json
{
  "clinica": { "status": "enviado", "em": "2026-09-17T12:00:00", "erro": null },
  "veterinario:144": { "status": "falhou", "em": "...", "erro": "..." }
}
```

## Criterios de aceitacao

| ID | Criterio |
|---|---|
| CA-001 | Com `destinos: ["veterinario:144"]`, só o veterinário 144 recebe: a clínica não é chamada no provedor e volta como `ignorado` com `motivo: "nao_selecionado"`. |
| CA-002 | Com `destinos: ["clinica"]` num laudo que também tem veterinário liberado, só a clínica recebe; o veterinário volta `ignorado`/`nao_selecionado`. |
| CA-003 | Sem o campo `destinos`, o envio continua indo para todos os elegíveis — contrato antigo preservado. |
| CA-004 | `destinos: []` responde 422 sem chamar o provedor. |
| CA-005 | Destino que não é elegível (não liberado no portal, sem WhatsApp, ou id inexistente) responde 422 nomeando a chave recusada, sem enviar nada. |
| CA-006 | Cada envio grava o resultado em `whatsapp_envios` sob a chave do destino (`status`, `em`, `erro`), preservando o que já estava lá para os destinos não escolhidos. |
| CA-007 | As colunas `whatsapp_liberacao_*` e `whatsapp_parceiro_*` continuam sendo atualizadas como antes, e só para os destinos efetivamente tentados. |
| CA-008 | `GET /laudos` devolve `whatsapp_envios` em cada item, e `GET /laudos/{id}` no laudo. |
| CA-009 | O botão "Avisar WhatsApp" abre uma janela de seleção, não um `confirm()`, nas duas telas (Central de laudos e visualização de laudo). |
| CA-010 | A janela lista a clínica e cada veterinário liberado pelo nome, e mostra, em quem já tem envio registrado, o resultado e a data do último. |
| CA-011 | Ao abrir, vêm marcados os destinos cujo último envio **não** foi `enviado` (nunca enviado ou falhou); quem já recebeu vem desmarcado e pode ser remarcado. |
| CA-012 | Com tudo desmarcado, o botão de enviar fica desabilitado — a janela não deixa disparar uma chamada vazia. |
| CA-013 | Depois do envio, a janela fecha e o resultado aparece como hoje: toast de sucesso, toast âmbar quando algum destino falhou, e badges atualizadas na Central de laudos. |
| CA-014 | Laudo com um destino só (o caso comum) abre a janela com esse destino marcado: o fluxo continua sendo abrir e confirmar. |
| CA-015 | A migração `20260917_86_laudo_whatsapp_envios.py` é idempotente e não perde o conteúdo das colunas de resumo já existentes. |
