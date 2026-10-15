# Verify - whatsapp-approved-template-catalog

Data: 2026-10-15
Responsavel: Martiniano + Codex
Status: meta-approved-production-release-authorized

## Matriz historica — 2026-08-16

| Criterio | Evidencia | Status |
| --- | --- | --- |
| CA-001 | `npm run build` em `whatsapp-stage-backend` | passou |
| CA-002 | `test-approved-templates.ts` confere onze contratos, idioma e quantidades | passou |
| CA-003 | teste inspeciona contratos sem botao, com botoes e com documento | passou |
| CA-004 | teste rejeita `appointmentReminder` com quantidade incorreta | passou |
| CA-005 | `npm run test:reservation-template` | passou |
| CA-006 | `.github/workflows/deploy-stage.yml` executa `test:approved-templates` | inspecao passou |
| CA-007 | `test_whatsapp_template_delivery.py` e validacoes de `templateAutomationController.ts` | passou |
| CA-008 | endpoints e acoes explicitas de Agenda, Portal e Financeiro | passou por inspecao e compilacao |
| CA-009 | teste Python exige mesmo destinatario e numero cadastrado em comum | passou |
| CA-010 | 777 testes Python, suites Node, 65 testes frontend, `tsc`, lint, build e guardrail SDD | passou |
| CA-011 | `test-document-templates.ts` valida upload e cabecalho de documento | passou |

## Comandos executados

```bash
cd whatsapp-stage-backend && npm run build
cd whatsapp-stage-backend && npm run test:approved-templates
cd whatsapp-stage-backend && npm run test:document-templates
cd whatsapp-stage-backend && npm run test:reservation-template
cd backend && venv/bin/python -m unittest tests.test_whatsapp_agenda_service tests.test_whatsapp_template_delivery
cd backend && DATABASE_URL=sqlite:///./fortcordis-ci.db SECRET_KEY=local-whatsapp-quality-gate-secret-key-1234567890 venv/bin/python -m unittest discover -s tests -p "test_*.py"
cd frontend && npx tsc --noEmit && npm run lint
cd frontend && npm run build
python3 -m unittest backend.tests.test_sdd_guardrail
git diff --check
```

## Resultado

- O catalogo do novo snapshot possui onze contratos em `pt_BR`, incluindo os quatro modelos
  financeiros confirmados como aprovados pelo responsavel.
- Payload sem botao contem apenas o componente de corpo.
- Payload com dois botoes preserva indices `0` e `1` e seus payloads opacos.
- Quantidades incorretas falham antes de qualquer chamada ao provedor.
- A transcricao interna de `reserva_de_agendamento` agora inclui acentos e a frase final aprovada.
- Os novos envios dependem de acao explicita e estado de dominio compativel.
- Respostas dos novos botoes sao registradas na caixa de entrada, sem mutacao automatica do dominio.
- A extensao financeira passou nos testes focados e nas suites locais completas.

## Evidencia historica do catalogo anterior em stage

- `Migration CI` (`31926968177`): concluido com sucesso.
- `Deploy to Stage (VPS)` (`31926968382`): `quality-gate`, `sdd-guardrail` e `deploy-stage` concluidos com sucesso.
- O VPS confirmou `HEAD=d8c80ef`, migração do serviço WhatsApp aplicada e smoke autenticado concluído.
- `https://stage.fortcordis.com.br/` respondeu `200` e redirecionou rotas do app para `https://app.stage.fortcordis.com.br/`.
- `/agenda`, `/financeiro`, `/laudos` e `/whatsapp/health` responderam `200`.
- As novas rotas protegidas de Agenda, Laudos, Financeiro e automação WhatsApp responderam `401` sem credencial.
- Os 19 chunks JavaScript referenciados pelas páginas continham as novas rotas e os rótulos de envio pelo FortCordis.

## Aprovacao externa historica — 2026-08-16

- os quatro modelos financeiros e seus IDs foram confirmados pelo responsavel como aprovados em
  2026-08-16;
- o catalogo nao consulta o status da Meta em tempo real e registra essa confirmacao operacional sem
  apresenta-la como evidencia automatizada;
- esta extensao ainda nao foi publicada em stage nem em producao.

## Lembrete com servico — validacao local 2026-10-14

| Criterio | Evidencia | Estado |
| --- | --- | --- |
| CA-SERV01 | `test_whatsapp_agenda_reminder_service.py`: nome completo do catalogo precede literal antigo, combo/fallback, limite e fonte sem observacoes internas; legado quatro parametros | passou |
| CA-SERV02 | `test-approved-templates.ts` e `test-inbox-ui-contracts.ts`: pendente retorna 409 sem conexao ao pool e sem Graph; ID sintetico temporario permite contrato de cinco variaveis | passou |
| CA-SERV03 | `agenda-whatsapp-templates.test.ts` e `NovoAgendamentoModal.lembrete-servico.test.tsx`: previa, troca de servico, nome salvo/fallback, espacos, 300 caracteres completos e bloqueio de 301/ausente | 15 testes focais passaram |
| RF-SERV05 | callback sintetico cria alerta de revisao do servico/horario, preserva todas as colunas da agenda e nao duplica alerta no replay | passou |

- Frontend final: 676 testes Vitest (87 arquivos) e 9 testes Node passaram;
  TypeScript, ESLint e build Next.js passaram. O seletor diz `Modelo de mensagem`.
- Node: build, TypeScript dos testes, catalogo e inbox passaram; a suite de
  webhook assinado/fila usou PostgreSQL descartavel e transportes simulados.
  Revisao independente confirmou corpo Node/frontend identico, legado intacto
  e callback de alteracao sem anotacao positiva ou mutacao de servico.
- Suite Python completa apos as bordas de estado/fallback: 1791 passaram,
  25 skips, 619 subtests. Suite focada de Agenda/delivery/scheduler: 59 passaram.
  O ultimo ajuste de classificacao da aprovacao pendente na API passou em
  62 testes focais (59 existentes + 3 novos), sem repetir os demais testes.
- Node 409 com codigo exato `WHATSAPP_TEMPLATE_APPROVAL_PENDING`, somente
  para a nova variante, agora chega como HTTP 409 na API da Agenda com detalhe
  amigavel. Teste chama o endpoint real diretamente, sem auditoria de sucesso.
  Demais erros/modelos legados preservam o tratamento anterior de HTTP 502.
- A variante aceita somente Agendado/Confirmado. Testes comprovam rejeicao
  manual antes de consultas para reservas, filtro de preview/worker sem consumo
  de tentativas e legado preservado com a flag desligada. Revisao independente
  aprovou tambem o fallback de catalogo vazio apos normalizacao.
- SDD e `git diff --check` passaram para as seis features afetadas.

### Meta / entrega externa

- Conta de producao Fort Cordis, WABA `1369494994627980`, consultada no
  WhatsApp Manager autenticado em 14/10/2026. Modelo legado aparece ativo.
- Formulario do novo `lembrete_de_agendamento_servico_v2` preparado como
  Utilidade / `pt_BR`, cinco variaveis numericas, dois quick replies e corpo
  identico ao codigo. Exemplos sao sinteticos: Clinica Exemplo, Thor,
  16/10/2026, 08:30 e Ecocardiograma.
- **Submetido** apos autorizacao explicita do usuario em 14/10/2026, por volta
  das 17:56 (America/Fortaleza; verificacao UTC 20:56). O formulario foi
  restaurado com o mesmo contrato depois de a sessao voltar para a lista.
  Um unico clique em `Enviar para analise`; nenhuma repeticao do envio.
- Lista e detalhe do modelo confirmaram ID `1647759970059717`, categoria
  Utilidade, idioma Portuguese (BR) e status **Em analise**. Corpo e botoes
  persistidos coincidem com o texto autorizado, usando apenas exemplos sinteticos.
  Screenshot de prova: `/tmp/fortcordis-lembrete-servico-meta-submetido.jpg`.
- O ID de submissao nao foi convertido em ID operacional aprovado no codigo.
  O novo contrato continua `PENDING_META_APPROVAL` e a flag continua `false`.
- Nenhum envio real, credencial, callback, flag de ambiente, commit, push ou
  publicacao foi realizado nesta extensao. A unica mutacao externa foi a
  submissao autorizada do novo modelo. Cutover depende de aprovacao por
  ambiente e release autorizado; a WABA de stage nao foi alterada.


## Aprovacao e preparacao da ativacao — 2026-10-15

- Detalhe autenticado da Meta confirmou `lembrete_de_agendamento_servico_v2`,
  ID `1647759970059717`, Utilidade / Portuguese (BR), status
  `Ativo — Qualidade pendente`. Corpo de cinco variaveis e dois botoes conferidos.
  Prova local: `/tmp/fortcordis-lembrete-servico-meta-aprovado.png`.
- Usuario autorizou expressamente publicar e ativar a variante em producao.
  A WABA `1369494994627980` e a unica aprovada; a WABA de stage
  `4413513738886247` permanece bloqueada. Nenhuma credencial/identidade Meta mudou.
- Node exige ID numerico e WABA exata, com rejeicao antes de banco/Graph.
  Build, TypeScript, catalogo e inbox passaram; os testes de conta ausente/
  divergente comprovam zero conexao e zero envio, com legado preservado.
- Nenhuma mensagem de teste foi enviada nem marcador de lembrete foi limpo.
  A publicacao e a ativacao ainda dependem da conclusao dos gates de release.
