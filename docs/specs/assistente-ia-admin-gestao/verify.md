# Verify - assistente-ia-admin-gestao

Data: 2026-07-23
Responsavel: Martiniano + Codex
Status: in_progress

## Matriz

| Criterio | Evidencia | Status |
| --- | --- | --- |
| CA-001 | inspecao automatica de todas as rotas e 403 para nao-admin | aprovado |
| CA-002 | endpoint, painel e carregamento do resumo executivo | aprovado |
| CA-003 | testes de pending/rejeicao/aprovacao/TTL | aprovado |
| CA-004 | remarcacao e WhatsApps chamam fluxos oficiais depois do snapshot | aprovado |
| CA-005 | bloqueio validado por `_validar_slot_disponivel` e removido das sugestoes | aprovado |
| CA-006 | endpoint `/acoes` e aba central no build | aprovado |
| CA-007 | teste memoria pending versus approved | aprovado |
| CA-008 | hash, deduplicacao e pesquisa limitada | aprovado em teste focal |
| CA-009 | rascunho isolado e campos oficiais preservados em teste | aprovado |
| CA-010 | feedback, tokens, latencia e metricas | aprovado |
| CA-011 | migration, 359 testes, lint, TypeScript e build | aprovado |
| CA-012 | 13 casos versionados, ferramentas strict e proibicoes | aprovado |
| CA-013 | teste do radar confirma persistencia e ausencia de mutacao operacional | aprovado |
| CA-014 | criacao tipada, calendario semanal e validacao de configuracao | aprovado |
| CA-015 | worker persistente, advisory lock e `skip_locked` no PostgreSQL | aprovado em inspecao e teste focal |
| CA-016 | teste semantico com sinonimo e fonte mais fallback lexical existente | aprovado |
| CA-017 | opt-in visivel, fonte obrigatoria, chunks locais e fila de indexacao | aprovado |
| CA-018 | mock do laboratorio confirma 100% dos casos sem chamada a `execute_tool` | aprovado |
| CA-019 | inspecao automatica inclui todas as novas rotas com guard admin | aprovado |
| CA-020 | migration 54 idempotente, 367 testes, lint, TypeScript e build | aprovado |
| CA-021 | `deploy-stage.yml` usa `OPENAI_API_KEY_STAGE`; `deploy.yml` usa `OPENAI_API_KEY_PROD`; nomes confirmados no repositorio sem leitura dos valores | aprovado |
| CA-022 | remarcacao explicita, contexto antes do rascunho incompleto e gravacao direta do rascunho completo | aprovado em contrato local |
| CA-023 | chamada obrigatoria, bloqueio direto, orcamento de 800 tokens e diagnostico de resposta sem ferramenta | aprovado em contrato local |
| CA-024 | teste de feedback negativo confirma sugestao pending e contexto aprovado inalterado | aprovado em teste focal |
| CA-025 | testes de aprovacao confirmam memoria v1, ajuste v2 e contrato ativo unico | aprovado em teste focal |
| CA-026 | teste de rejeicao e restauracao confirma historico v1/v2/v3 append-only | aprovado em teste focal |
| CA-027 | laboratorio inclui contrato determinista e confirma zero chamadas a `execute_tool` | aprovado em teste focal |
| CA-028 | inspecao automatica cobre as novas rotas com guard admin | aprovado em teste focal |
| CA-029 | migration 55 executada duas vezes no mesmo SQLite | aprovado em teste focal |
| CA-030 | suite, frontend, migration, deploy e canario de stage | aprovado em stage; producao pendente |
| CA-031 | inspecao automatica de todas as rotas, incluindo as tres rotas Clinicas 360, com guard admin | aprovado em teste focal |
| CA-032 | teste focal do agregador confirma agenda, financeiro, debitos, preferencias, alertas e fontes | aprovado |
| CA-033 | assercoes percorrem o payload e confirmam ausencia de campos ou textos operacionais de paciente/tutor | aprovado |
| CA-034 | teste focal compara duas clinicas e confirma lideres e contrato compartilhado | aprovado |
| CA-035 | 15 casos no dataset e definicoes estritas para consulta e comparacao | aprovado |
| CA-036 | ESLint, TypeScript, build e smoke de stage confirmam busca, periodo, perfil, comparacao, conversa e fontes | aprovado em stage; producao pendente |
| CA-037 | teste focal confirma um plano por alerta suportado e prioridade critica para debito vencido | aprovado |
| CA-038 | assercoes confirmam ausencia de execucao, envio e escrita automatica em plano e passos | aprovado |
| CA-039 | teste de autonomia confirma missao `clinic_360` tipada, periodo limitado e rejeicao sem clinica | aprovado |
| CA-040 | interface possui revisao separada e botao final `Aprovar e criar missao` | aprovado em lint e TypeScript |
| CA-041 | contato e revisao apenas transferem prompt para a conversa; contratos mantem aprovacao de escritas | aprovado em inspecao e contrato |
| CA-042 | portfolio resumido, 16 casos versionados, suite limpa, lint, TypeScript e build | aprovado |
| CR-001 | seis rotas da base inspecionadas com dependencia `admin`; nao-admin recebe 403 | aprovado |
| CR-002 | serie de cinco meses, filtro de clinica e total financeiro | aprovado |
| CR-003 | localizacao exata e retorno de desambiguacao para multiplos candidatos | aprovado |
| CR-004 | motor real da agenda reutilizado e resposta sem telefone/paciente | aprovado |
| CR-005 | OS e contas a receber retornadas em subtotais separados | aprovado |
| CR-006 | solicitacao cria `pending` sem remover o agendamento | aprovado |
| CR-007 | rejeicao preserva o alvo e impede nova decisao | aprovado |
| CR-008 | aprovacao executa o fluxo oficial e registra auditoria | aprovado |
| CR-009 | expiracao, replay e divergencia de snapshot retornam 409 | aprovado |
| CR-010 | TypeScript, ESLint e build Next com rota `/assistente-ia` | aprovado |
| CR-011 | validador de status e workflows com segredos separados de stage/producao | aprovado |
| CR-012 | reserva gera acao pendente, snapshot com prazo/contatos e zero insercoes antes da decisao | aprovado |
| CR-013 | rejeicao nao chama escrita; aprovacao chama `criar_agendamento` com payload validado | aprovado |
| CR-014 | referencias e regras sao revalidadas na aprovacao, sem override operacional | aprovado |
| CR-015 | cartao de criacao, mensagem, selecao de telefone, copia e abertura manual do WhatsApp | aprovado |
| CR-016 | pedido de ampliacao prepara `update_agenda_exception`, mostra antes/depois e nao escreve configuracao | aprovado |
| CR-017 | rejeicao preserva; aprovacao atualiza somente a excecao solicitada pelo endpoint oficial | aprovado |
| CR-018 | snapshot divergente invalida a acao com 409 | aprovado |
| CA-043 | testes de resolucao aproximada com `Animla Care` e `Vet Wrold` | aprovado localmente |
| CA-044 | teste preserva ambiguidade entre `Animal Care` e `Animal Clinic` | aprovado localmente |
| CA-045 | testes da rota/servico de voz para guard, formato e limite | aprovado |
| CA-046 | mock do provedor confirma idioma, modelo e vocabulario de clinicas | aprovado |
| CA-047 | teste confirma revisao, ausencia de persistencia e auditoria sem conteudo | aprovado |
| CA-048 | ESLint, TypeScript e build da gravacao/transcricao/revisao | aprovado |
| CA-049 | regressao confirma que voz nao altera o fluxo governado de ferramentas | aprovado |
| CA-050 | consulta somente leitura de 78 mensagens de producao identificou quatro lacunas funcionais e duas tentativas sem resposta | aprovado |
| CA-051 | teste soma OS `Pendente` e `Pago` e exclui `Cancelado` | aprovado |
| CA-052 | teste consulta matriz de deslocamento e resolve `Vet Wrold`; `Uninassal` obteve score 0,9667 e margem 0,2170 no cadastro real | aprovado |
| CA-053 | teste retorna funcionamento por excecao sem exigir clinica ou servico | aprovado |
| CA-054 | teste prepara vinculo sem escrita e chama atualizacao oficial apenas apos aprovacao, sem enviar horario no payload | aprovado |
| CA-055 | teste reutiliza mensagem identica sem resposta e preserva apenas um comando no historico | aprovado |
| CA-056 | 23 casos versionados, incluindo falhas reais, com schemas estritos e laboratorio sem executar ferramentas | aprovado |

## Evidencias executadas ate agora

```bash
cd backend && ./venv/bin/python -m unittest tests/test_assistente_ia_admin.py tests/test_assistente_ia_migration.py tests/test_assistente_ia_copiloto_migration.py
cd backend && ./venv/bin/python -m unittest tests/test_assistente_ia_evals.py
cd backend && ./venv/bin/python -m unittest tests/test_assistente_ia_autonomy.py tests/test_assistente_ia_autonomy_migration.py
cd backend && ./venv/bin/python -m unittest discover -s tests
cd frontend && npx eslint app/assistente-ia/page.tsx --max-warnings=0
cd frontend && npx tsc --noEmit
cd frontend && npm run build
cd backend && ./venv/bin/python -m pip check
python3 -m py_compile <arquivos alterados do backend>
git diff --check
```

## Ciclo Clinicas 360 - 22/07/2026

- 42 testes focais da Mente aprovados, incluindo agregador, ferramentas, autorizacao e laboratorio;
- suite completa executada em worktree limpo do commit: 377 testes aprovados;
- ESLint focal, TypeScript, `py_compile`, `pip check`, `git diff --check` e build Next aprovados;
- build confirmou `/assistente-ia` com a area Clinicas 360 e bundle de producao valido;
- perfil e comparacao declaram `read_only=true` e `contains_patient_or_tutor_data=false`;
- nenhuma migration nova: leitura calculada sob demanda sobre tabelas oficiais;
- stage `f2b8b23`: SDD guardrail, Migration CI, 377 testes, lint, build e deploy aprovados;
- smoke publico de stage: `/assistente-ia` responde 200, a API Clinicas 360 retorna 401 sem sessao e o bundle servido contem `Mapa operacional - Clinicas 360`;
- producao sera registrada depois da promocao guardada que mantem `f2b8b23` como segundo pai do merge de release.

## Ciclo Planos de acao supervisionados - 22/07/2026

- alertas de queda de faturamento, cancelamentos, debito vencido e inatividade geram planos deterministas com evidencia e prioridade;
- cada plano oferece missao somente de leitura, rascunho de contato sem envio e revisao operacional sem escrita direta;
- a missao `clinic_360` aceita apenas clinica e periodo, e a interface exige revisao seguida de aprovacao explicita;
- portfolio e comparacao carregam apenas o resumo dos planos; o perfil focal preserva o contrato completo;
- nenhuma migration nova: missoes aprovadas reutilizam a persistencia e o scheduler tipado existentes;
- 17 testes focais de Clinicas 360, autonomia e contratos de avaliacao aprovados;
- 48 testes focais de toda a Mente, incluindo migrations, admin, autonomia, Clinicas 360 e avaliacoes, aprovados;
- suite completa em worktree limpo do commit: 381 testes aprovados;
- ESLint focal, TypeScript, `py_compile`, `pip check`, `git diff --check`, guardrail SDD e build Next aprovados;
- build confirmou `/assistente-ia` com planos de acao, revisao explicita de missao e protecao contra sugestao duplicada;
- release remoto permanece separado desta validacao local.

## Ciclo Nomes tolerantes e comandos de voz - 23/07/2026

- auditoria somente leitura percorreu as 78 mensagens existentes em producao e preservou conversas e dados operacionais;
- lacunas confirmadas: todas as OS do mes, deslocamento entre clinicas, funcionamento geral da agenda e vinculo de paciente a reserva;
- duas mensagens `Agora realize o agendamento` ficaram sem resposta final; a nova tentativa agora recupera a conversa e reutiliza o comando persistido;
- recusas de horario retroativo e de reserva cujo prazo minimo termina depois do slot foram mantidas como protecoes corretas;
- matching de clinicas passou a aceitar erro evidente somente com limiar e margem sobre o segundo candidato;
- ambiguidades por substring/token continuam interrompendo o fluxo e pedindo esclarecimento;
- `Hospital Veterinario Uninassal` resolve o cadastro real `Hospital Veterinario Uninassau` com score 0,9667 contra 0,7497 do segundo candidato;
- novas ferramentas estritas cobrem OS realizadas, matriz de deslocamento e funcionamento geral da agenda;
- vinculo de paciente e tutor a reserva usa acao pendente, snapshot, TTL, revalidacao e o fluxo oficial de atualizacao;
- audio e transcrito no backend em portugues, com vocabulario das clinicas ativas e sem persistencia do arquivo;
- frontend grava por tempo limitado, transcreve e preenche o campo sem enviar automaticamente;
- toda solicitacao transcrita continua usando `/chat`; qualquer escrita permanece sujeita a acao pendente e confirmacao;
- 50 testes focais da Mente aprovados e suite completa com 390 testes aprovados;
- `py_compile`, `pip check`, `git diff --check`, ESLint, TypeScript e build Next aprovados;
- build confirmou `/assistente-ia` com 24,5 kB e controles de voz/revisao;
- stage `5496b16`: Migration CI, quality gate, guardrail SDD, deploy, saude interna e canario autenticado aprovados;
- smokes de stage aprovados para pagina, APIs protegidas, pacote servido, voz real e novas consultas; producao permanece pendente.

## Ciclo de aprendizado continuo supervisionado - 22/07/2026

- feedback negativo com correcao esperada cria sugestao pendente com origem rastreavel e sem mudar o prompt ativo;
- aprovacao cria ou atualiza memoria, registra versao imutavel e substitui o contrato de regressao ativo;
- rejeicao nao altera memoria e restauracao de versao antiga cria uma nova versao, sem apagar historico;
- laboratorio combina roteamento do modelo e contratos deterministas, sem executar ferramentas;
- migration `20260722_55` foi executada duas vezes no mesmo SQLite;
- 37 testes focais do admin, autonomia e migration aprovados;
- suite completa: 373 testes aprovados;
- ESLint, TypeScript, `pip check`, `git diff --check` e build Next aprovados;
- build confirmou `/assistente-ia` com Aprendizados, versoes, restauracao e contratos de regressao;
- stage `366f898`: SDD guardrail, Migration CI, quality gate, migration 55, deploy, backend health e canario autenticado aprovados;
- smoke publico de stage: `/assistente-ia` responde 200, rotas novas retornam 401 sem sessao e o pacote servido contem Aprendizados e aprovacao versionada;
- producao sera registrada depois da promocao guardada que mantem `366f898` como segundo pai do merge de release.

## Resultado

- 28 testes focais novos/atualizados aprovados;
- suite completa: 359 testes aprovados;
- migration `20260721_53` executada duas vezes no mesmo SQLite sem divergencia;
- ESLint, TypeScript, `py_compile`, `pip check`, `git diff --check` e build Next aprovados;
- build gerou `/assistente-ia` com as seis areas administrativas;
- smoke real do modelo `gpt-5.6-sol`: status `completed` e roteamento correto para `gerar_resumo_executivo`;
- nenhuma chave foi impressa, persistida em codigo ou enviada ao frontend.
- regressao da versao base: criacao/reserva, exclusao e funcionamento excepcional mantiveram preparacao sem escrita, rejeicao, aprovacao e protecao contra concorrencia;
- segredos `OPENAI_API_KEY_STAGE` e `OPENAI_API_KEY_PROD` permanecem separados e os workflows validam o status autenticado;
- stage: quality gate, SDD guardrail, migration CI, deploy e canario autenticado aprovados para `25cd5e0`;
- smoke publico de stage: `/assistente-ia` responde, redireciona sessao anonima ao login, APIs protegidas retornam 401 e o pacote servido contem as seis areas novas.

## Ciclo Radar, Missoes, Semantica e Avaliacoes

- 6 testes focais novos cobrem radar somente de leitura, recorrencia tipada, revogacao de admin, fonte obrigatoria, busca semantica e laboratorio sem execucao;
- migration `20260721_54` exercitada duas vezes no mesmo SQLite;
- suite completa: 367 testes aprovados;
- ESLint, TypeScript, `py_compile`, `pip check`, `git diff --check` e build Next aprovados;
- build confirmou `/assistente-ia` com Radar, Missoes, Memoria semantica e Avaliacoes;
- worker aguarda a migration sem loop de erro, recupera execucoes interrompidas e aparece na saude do runtime;
- stage: quality gate, SDD guardrail, migration `20260721_54`, deploy, runtime readiness e canario autenticado aprovados para `896928f`;
- smoke publico de stage: `/assistente-ia` responde 200, API protegida responde 401 sem sessao e o pacote servido contem Radar, Missoes, Memoria semantica e Avaliacoes.

## Ciclo de calibracao de roteamento - 22/07/2026

- linha de base real em producao: 10/12 casos, nota 83,3%;
- o caso de remarcacao nao informava o motivo exigido pelo schema estrito;
- o pedido generico de rascunho selecionou corretamente `obter_contexto_laudo`, mas o dataset esperava gravacao imediata sem conteudo;
- o dataset agora separa contexto primeiro de gravacao com conteudo completo e inclui motivo explicito na remarcacao;
- as instrucoes reais e do laboratorio preservam confirmacao da remarcacao, isolamento do rascunho e proibicao de finalizar o laudo;
- 10 testes focais do contrato e da autonomia aprovados;
- suite completa: 368 testes aprovados;
- ESLint, TypeScript, `py_compile`, `pip check`, `git diff --check` e build Next aprovados.

## Segunda calibracao de roteamento - 22/07/2026

- primeira avaliacao apos a publicacao: 11/13 casos, nota 84,6%;
- o rascunho clinico foi corrigido, mas remarcacao e bloqueio retornaram sem `function_call`;
- o laboratorio agora explicita que `solicitar_*` apenas prepara acao pendente, exige resposta por ferramenta, cobre bloqueio direto e amplia o orcamento de saida para 800 tokens;
- respostas sem ferramenta passam a registrar status e motivo de incompletude por caso, sem executar nenhuma ferramenta real.
- 11 testes focais e a suite completa com 369 testes foram aprovados;
- `py_compile`, `pip check` e `git diff --check` aprovados.
