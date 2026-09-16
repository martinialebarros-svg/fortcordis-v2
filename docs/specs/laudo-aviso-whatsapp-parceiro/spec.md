# Spec - laudo-aviso-whatsapp-parceiro

## Contrato do endpoint

`POST /laudos/{id}/portal/whatsapp`

Entrada: `idempotency_key` (8..128) e `destination` opcional — que continua
sendo **da clínica** (validado contra `_registered_clinic_whatsapp_numbers`).

Destinos elegíveis, cada um avaliado de forma independente:

| Destino | Elegível quando |
|---|---|
| Clínica | `laudo.clinic_id` preenchido, status do laudo liberado no portal e a clínica tem número (`whatsapps[0]` ou `telefone`) |
| Veterinário parceiro | `laudo.veterinario_parceiro_id` aponta para perfil ativo do tipo `veterinario`, com liberação no portal ativa para o exame (`PortalPartnerReleaseTarget`), e com número (`whatsapp` ou `telefone`) |

Resposta 200 (objeto por destino, além dos campos do provedor da clínica no
topo, mantidos para compatibilidade):

```json
{
  "message": "...",
  "message_id": "...",
  "idempotent": false,
  "clinica": {"status": "enviado|falhou|ignorado", "motivo": "...", "erro": "..."},
  "veterinario_parceiro": {"status": "enviado|falhou|ignorado", "motivo": "...", "erro": "..."},
  "whatsapp_liberacao_status": "...", "whatsapp_liberacao_em": "...", "whatsapp_liberacao_erro": "...",
  "whatsapp_parceiro_status": "...", "whatsapp_parceiro_em": "...", "whatsapp_parceiro_erro": "..."
}
```

`motivo` para `ignorado`: `sem_vinculo`, `nao_liberado` ou `sem_whatsapp`.

## Critérios de aceitação

| ID | Critério |
|---|---|
| CA-001 | Laudo liberado no portal para clínica e para veterinário parceiro, ambos com WhatsApp cadastrado: um clique dispara **duas** mensagens `portalReportAvailable` — uma para o número da clínica, com o nome da clínica em `{{1}}`, outra para o número do parceiro, com o nome do parceiro em `{{1}}`. |
| CA-002 | As duas mensagens usam `idempotency_key` diferentes: a da clínica é exatamente a recebida do cliente; a do parceiro é `<chave>-vet`, limitada a 128 caracteres. |
| CA-003 | Laudo vinculado só a veterinário parceiro (sem clínica), liberado para ele no portal: o envio acontece e responde 200 — não mais 409 "O laudo nao possui clinica parceira vinculada.". |
| CA-004 | Parceiro vinculado mas **sem liberação ativa no portal** para o exame: nenhuma mensagem é enviada a ele (`veterinario_parceiro.status == "ignorado"`, `motivo == "nao_liberado"`), e o envio para a clínica acontece normalmente. |
| CA-005 | Parceiro vinculado e liberado, mas sem `whatsapp` nem `telefone` no cadastro: `status == "ignorado"`, `motivo == "sem_whatsapp"`, sem erro 5xx, e a clínica continua sendo avisada. |
| CA-006 | Envio ao parceiro aceito pela API persiste `whatsapp_parceiro_status = "enviado"` + `_em`, e gera auditoria `LAUDO_PORTAL_WHATSAPP_PARCEIRO_ENVIADO`. |
| CA-007 | Envio ao parceiro rejeitado (`WhatsAppTemplateDeliveryError`) persiste `whatsapp_parceiro_status = "falhou"` + `_erro`, gera auditoria `LAUDO_PORTAL_WHATSAPP_PARCEIRO_FALHOU` e a resposta continua 200 quando a clínica foi avisada com sucesso. |
| CA-008 | Falha no envio da clínica continua respondendo 502 com o `detail` do provedor e persistindo `whatsapp_liberacao_status = "falhou"` — contrato inalterado — e, se o parceiro era elegível, o envio a ele foi tentado assim mesmo e o resultado ficou persistido. |
| CA-009 | Laudo sem clínica e sem parceiro elegível responde 409 sem enviar nada; laudo não liberado no portal continua respondendo 409 "Libere o laudo no portal antes de enviar o aviso.". |
| CA-010 | `GET /laudos` devolve `whatsapp_parceiro_status/_em/_erro` em cada item, de modo que o resultado do último aviso ao parceiro sobreviva a reload. |
| CA-011 | A migração `20260916_85_laudo_whatsapp_parceiro_status.py` é idempotente: aplicada duas vezes na mesma base não levanta erro nem duplica colunas. |
| CA-012 | Na Central de laudos, laudo com aviso enviado ao parceiro mostra a badge "WhatsApp parceiro enviado"; com falha, "WhatsApp parceiro falhou" com o erro no `title`. A badge da clínica continua como era. |
| CA-013 | O botão de WhatsApp aparece quando **qualquer** destino externo está liberado no portal — inclusive em laudo só com parceiro — e some quando nenhum está. |
| CA-014 | A confirmação antes do envio nomeia quem vai receber ("clínica e veterinário parceiro", só a clínica, ou só o parceiro), e o toast/alerta de sucesso nomeia quem foi avisado. |
| CA-015 | Sucesso parcial (clínica avisada, parceiro falhou) aparece como aviso âmbar com a mensagem de erro do parceiro, não como sucesso silencioso. |
