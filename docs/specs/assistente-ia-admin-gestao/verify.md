# Verify - assistente-ia-admin-gestao

Data: 2026-07-21
Responsavel: Martiniano + Codex
Status: passed

## 1) Matriz de rastreabilidade

| ID | Evidencia esperada | Status |
| --- | --- | --- |
| CA-001 | seis rotas inspecionadas com dependencia `admin`; nao-admin recebe 403 | aprovado |
| CA-002 | serie de cinco meses, filtro de clinica e total financeiro | aprovado |
| CA-003 | localizacao exata e retorno de desambiguacao para multiplos candidatos | aprovado |
| CA-004 | motor real da agenda reutilizado e resposta sem telefone/paciente | aprovado |
| CA-005 | OS e contas a receber retornadas em subtotais separados | aprovado |
| CA-006 | solicitacao cria `pending` sem remover o agendamento | aprovado |
| CA-007 | rejeicao preserva o alvo e impede nova decisao | aprovado |
| CA-008 | aprovacao executa o fluxo oficial e registra auditoria | aprovado |
| CA-009 | expiracao, replay e divergencia de snapshot retornam 409 | aprovado |
| CA-010 | TypeScript, ESLint e build Next com rota `/assistente-ia` | aprovado |
| CA-011 | teste do validador de status e workflow de segredo exclusivo de stage | aprovado |
| CA-012 | reserva gera acao pendente, snapshot com prazo/contatos e zero insercoes antes da decisao | aprovado |
| CA-013 | rejeicao nao chama escrita; aprovacao chama `criar_agendamento` com payload validado | aprovado |
| CA-014 | referencias e regras sao revalidadas na aprovacao, sem override operacional | aprovado |
| CA-015 | cartao de criacao, mensagem, selecao de telefone, copia e abertura manual do WhatsApp | aprovado |
| CA-016 | pedido de ampliacao prepara `update_agenda_exception`, mostra antes/depois e nao escreve configuracao | aprovado |
| CA-017 | rejeicao preserva; aprovacao atualiza somente a excecao solicitada pelo endpoint oficial | aprovado |
| CA-018 | snapshot divergente invalida a acao com 409 | aprovado |

## 2) Comandos executados

```bash
cd backend && ./venv/bin/python -m unittest tests.test_assistente_ia_admin tests.test_assistente_ia_migration tests.test_agenda_sugestao_janela_operacional tests.test_configuracoes_autorizacao
cd backend && ./venv/bin/python -m unittest discover -s tests
cd backend && ./venv/bin/python -m py_compile app/core/config.py app/models/assistente_ia.py app/schemas/assistente_ia.py app/services/assistente_ia_tools.py app/services/assistente_ia_service.py app/api/v1/endpoints/assistente_ia.py app/api/v1/endpoints/agenda.py app/main.py migrations/versions/20260720_52_assistente_ia_admin.py
cd backend && ./venv/bin/python -m pip check
cd frontend && ./node_modules/.bin/tsc --noEmit
cd frontend && ./node_modules/.bin/eslint app/assistente-ia/page.tsx app/layout-dashboard.tsx --max-warnings=0
cd frontend && npm run build
```

## 3) Resultado

- testes focais atuais: 52 aprovados;
- suite completa atual: 348 testes aprovados;
- migration SQLite executada duas vezes no mesmo banco: aprovada e idempotente;
- dependencias Python: `No broken requirements found`;
- frontend: compilacao, tipos, lint e build aprovados; rota estatica `/assistente-ia` gerada;
- smoke real da credencial: `gpt-5.6-sol` respondeu `OK`;
- smoke real de roteamento: pedido de cinco meses produziu a chamada `analisar_faturamento`;
- segredo `OPENAI_API_KEY_STAGE` registrado no GitHub Actions e workflow validado sintaticamente;
- nenhum segredo foi impresso, copiado para outro arquivo ou enviado ao frontend;
- versao inicial implantada em stage no commit `6190661`; extensao de criacao/reserva autorizada para a release de stage deste ciclo;
- fluxo novo de criacao/reserva: testes de preparacao sem escrita, rejeicao e aprovacao pelo endpoint oficial aprovados;
- frontend novo: cartao diferenciado para reserva/agendamento e comunicacao manual tipados e aprovados no lint;
- funcionamento excepcional: preparacao sem escrita, aprovacao, rejeicao e concorrencia cobertas; cartao mostra origem, janela atual e janela proposta.
