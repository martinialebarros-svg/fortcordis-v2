# Verify - whatsapp-portal-clinic-invite-template

## Matriz de aceitação

| Critério | Evidência | Resultado |
|---|---|---|
| CA-001 | `whatsapp-stage-backend`: `npx tsc --noEmit` e `npx ts-node scripts/test-approved-templates.ts` com os 15 modelos (12 antigos + 3 novos, contratos name/metaId/parâmetros/quick-replies) | passou |
| CA-002 | script isolado chamando `listApprovedTemplateCatalog` diretamente (sem depender de Postgres, indisponível neste ambiente) confirma `data.length === 12` e nenhuma chave `portalClinicInvite*` presente - mesma contagem que `test-inbox-ui-contracts.ts` já espera, sem precisar alterá-lo | passou |
| CA-003 | `backend/tests/test_portal_clinic_invite_auth.py`: `test_convite_envia_pelo_canal_whatsapp_do_atendimento_quando_habilitado` (mocka `httpx.post`, confirma `delivery_status="sent"`, `delivery_provider="whatsapp_business_template"`, payload com `template_key="portalClinicInviteActivation"`, `subject_type="clinica"`, `subject_id=clinica_id`, `destination` normalizado com prefixo `55`) e `test_convite_cai_para_copia_manual_quando_envio_pelo_whatsapp_falha` (resposta 400 do serviço → `delivery_status="manual_copy"`, sem quebrar a criação do convite) | passou |
| CA-004 | suítes completas de backend (`pytest`), frontend (`vitest`, `tsc`, `eslint`) sem regressão | passou |

## Comandos executados

```bash
# whatsapp-stage-backend
npm install --no-audit --no-fund
npx tsc --noEmit
npx ts-node scripts/test-approved-templates.ts

# backend
pip install -r requirements.txt   # (menos pywebpush, que falha ao compilar neste ambiente)
python3 -m pytest tests/ -q

# frontend
npm ci --prefer-offline --no-audit --no-fund
npx tsc --noEmit -p tsconfig.json
npx eslint app/clinicas/components/ClinicaPortalAccessCard.tsx app/clinicas/portal/page.tsx --max-warnings=0
npx vitest run
```

## Resultado - 2026-08-30

- `whatsapp-stage-backend`: `tsc --noEmit` sem erros; `test:approved-templates` passou (15 modelos,
  incluindo os 3 novos com `metaId: "PENDING_META_APPROVAL"`); script isolado confirmou que
  `listApprovedTemplateCatalog` continua expondo exatamente os 12 modelos originais.
- `backend`: suíte completa `pytest` - **847 passaram, 1 skip**, incluindo os 2 testes novos deste
  ciclo (envio com sucesso e fallback para cópia manual).
- `frontend`: `tsc --noEmit` e `eslint --max-warnings=0` sem erros; `vitest run` - **85 testes
  passaram** (14 arquivos), sem regressão.

## Risco residual

- **Aprovação da Meta pendente**: os 3 modelos foram submetidos ao WhatsApp Manager em 30/08/2026
  (categoria Utilidade) e seguem em análise - `metaId` permanece `PENDING_META_APPROVAL` em
  `approvedTemplates.ts`. Até lá, o convite continua funcionando normalmente, só que sempre cai em
  `delivery_status = "manual_copy"` (mesmo comportamento de fallback que existia antes desta
  mudança). Assim que a Meta aprovar, falta apenas atualizar os 3 `metaId` em
  `approvedTemplates.ts` - nenhuma outra mudança de código é necessária para o envio passar a
  funcionar de ponta a ponta.
- **Nome e texto ajustados na submissão real**: a checagem automática da Meta ("A categoria não
  corresponde") sinalizou os 3 textos originalmente planejados como mais próximos de Autenticação
  (linguagem de "ativar acesso/senha/conta" perto de um link é lida como entrega de credencial/OTP).
  O texto dos 3 modelos foi reescrito para linguagem de atualização de cadastro, e isso passou na
  checagem para os 3. O modelo `convite_portal_clinica` teve a primeira submissão (texto original)
  efetivamente rejeitada antes da reescrita; como a Meta bloqueia reuso de nome de modelo
  rejeitado/excluído por até 30 dias, ele foi resubmetido como `convite_portal_clinica_v2` - esse é
  o `name` real em `approvedTemplates.ts` agora, não `convite_portal_clinica`. Os outros dois
  (`acesso_portal_clinica`, `senha_temporaria_portal_clinica`) mantiveram o nome original, só o
  `body` mudou. `test-approved-templates.ts` foi atualizado para o novo nome.
- Não foi possível exercitar `test-inbox-ui-contracts.ts` (o script real, não a verificação isolada)
  neste ambiente por depender de um Postgres em `127.0.0.1:5432` indisponível aqui - risco mitigado
  pela verificação isolada de CA-002 acima, que exercita a mesma função exportada.
