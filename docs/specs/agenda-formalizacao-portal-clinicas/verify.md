# Verify - agenda-formalizacao-portal-clinicas

## Matriz de aceitação

| Critério | Evidência | Resultado |
|---|---|---|
| CA-001 | `test_criar_convite_usa_prazo_da_reserva_quando_disponivel`, `test_criar_convite_sem_prazo_usa_default_configurado` | passou |
| CA-002 | `test_novo_convite_revoga_pendente_anterior` | passou |
| CA-003 | `test_obter_convite_valido_rejeita_token_desconhecido`, `test_obter_convite_valido_expira_convite_vencido` | passou |
| CA-004 | `test_processar_submissao_cria_tutor_e_paciente_e_formaliza_agendamento`, `test_processar_submissao_rejeita_convite_ja_usado` | passou |
| CA-005 | `test_processar_submissao_reutiliza_tutor_existente_por_nome` | passou |
| CA-006 | `test_processar_submissao_falha_de_notificacao_nao_bloqueia_salvamento` | passou |
| CA-007 | `test_build_agenda_utility_template_formalized_monta_sete_parametros` | passou |
| CA-008 | `scripts/test-approved-template-button-events.ts` (cenário `enviar_dados` + reentrega do mesmo `provider_message_id`) | passou |
| CA-009 | mesmo script, cenário `falar_equipe` | passou |
| CA-010 | mesmo script, cenário de remetente divergente | passou |
| CA-011 | `AgendaFormalizacaoWorkspace.test.tsx` (fluxo feliz + link inválido) | passou |

## Comandos executados

```bash
# Backend
cd backend && source venv/bin/activate
python -m unittest discover -s tests -p "test_*.py"

# whatsapp-stage-backend
cd whatsapp-stage-backend
npx tsc --noEmit
npm run test:approved-templates
DATABASE_URL=postgres://martiniano@127.0.0.1:5432/fortcordis_stage npx ts-node src/db/migrate.ts
DATABASE_URL=postgres://martiniano@127.0.0.1:5432/fortcordis_stage \
  WHATSAPP_INTERNAL_API_TOKEN=test-internal-token WHATSAPP_ACCESS_TOKEN=test-access-token PHONE_NUMBER_ID=123456 \
  npx ts-node --transpile-only scripts/test-approved-template-button-events.ts
DATABASE_URL=postgres://martiniano@127.0.0.1:5432/fortcordis_stage \
  npx ts-node --transpile-only scripts/test-conversation-ordering.ts

# Frontend
cd frontend
npx tsc --noEmit
npx eslint "app/agenda/formalizar/[token]/page.tsx" components/agenda/AgendaFormalizacaoWorkspace.tsx \
  components/agenda/AgendaFormalizacaoWorkspace.test.tsx lib/agenda-formalizacao-api.ts
npx vitest run
npx next build
```

## Resultado - 2026-08-20

- Backend: **838 testes passaram** (14 novos desta feature: 12 em
  `test_agenda_formalizacao_service.py`, 1 em
  `test_agenda_formalizacao_migration.py`, 1 `falar_equipe` em
  `test_whatsapp_agenda_service.py`), sem regressão.
- `whatsapp-stage-backend`: `tsc --noEmit` limpo;
  `test:approved-templates` ajustado para o 12º modelo do catálogo
  (`appointmentFormalized`) e passou; migração
  (`approved_template_button_events`) aplicada com sucesso no Postgres
  local; `test-approved-template-button-events.ts` (novo, 4 cenários)
  passou; `test-conversation-ordering.ts` (existente) continua
  passando, sem regressão.
- Frontend: `tsc --noEmit`, `eslint` (sem warnings), `vitest run` (73
  testes — 71 já existentes + 2 novos), `next build` (rota
  `/agenda/formalizar/[token]` gerada, 3.17 kB) — todos sem erros.
- **Clique real no navegador** (não só revisão de código, diferente da
  entrega anterior desta spec): backend local (SQLite,
  `WHATSAPP_AGENDA_ENABLED` desligado) + frontend dev rodando
  simultaneamente via as tools de preview. Convite gerado com
  `criar_ou_reutilizar_convite` para um agendamento `Reservado` de
  teste; página carregou clínica/serviço/data/hora corretos; formulário
  preenchido (paciente, tutor, telefone) e enviado; tela mostrou "Dados
  enviados com sucesso"; conferido direto no SQLite: `agendamentos.status
  = 'Agendado'`, `paciente_id`/`tutor_id` vinculados,
  `agenda_formalizacao_invites.status = 'used'`; logs do servidor sem
  exceptions (200 no GET e no POST). Tutor pré-existente com o mesmo
  nome foi corretamente reaproveitado (sem duplicar) e seu telefone
  cadastrado não foi sobrescrito, confirmando CA-005 também em
  ambiente real. Dados de teste removidos do banco local ao final.

## Riscos residuais

- O envio best-effort de `appointmentFormalized` não foi testado contra
  a Graph API real (modelo ainda "Em análise" na Meta) — quando
  aprovado, atualizar `metaId` em `approvedTemplates.ts` e confirmar em
  stage que a mensagem chega com o texto correto.
- O clique real em "Enviar dados"/"Falar com a equipe" dentro do
  WhatsApp de verdade (Meta → webhook → `handleApprovedTemplateButtonReply`)
  não foi testado de ponta a ponta contra a API real da Meta — a
  cobertura é via `scripts/test-approved-template-button-events.ts`
  (Postgres real, `axios.post` interceptado). Recomenda-se validar em
  stage assim que o modelo `appointmentMissingData` for enviado de
  verdade com os botões.
- `PUBLIC_APP_BASE_URL` precisa ser configurada no ambiente de stage e
  produção (`.env.example` documenta o valor esperado,
  `https://app.fortcordis.com.br` em produção) antes do link funcionar
  de fato quando gerado pelo clique em "Enviar dados".
