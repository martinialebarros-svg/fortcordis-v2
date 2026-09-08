# Verify - whatsapp-produtividade-equipe

## Escopo e ambiente

- Data: 2026-09-07; baseline `origin/stage` em `1dd7680e`.
- Branch: `codex/whatsapp-produtividade`.
- Worktree: `/Users/martiniano/.codex/worktrees/whatsapp-produtividade`.
- Código e testes locais, sem commit, push ou publicação. O checkout principal
  e suas alterações pendentes no módulo de pacientes foram preservados.
- APIs externas simuladas; PostgreSQL 16 temporário em `127.0.0.1:55438`, com
  bancos exclusivos `wa_productivity_test` e `fortcordis_whatsapp_test`.
- Nenhuma mensagem real enviada, callback alterado ou credencial consultada.
  Não foram medidos ganhos operacionais de produtividade em uso real.

## Matriz de integração e regressão

| Critério | Evidência executada | Resultado |
|---|---|---|
| CA-001 | Contrato backend com cinco conversas, páginas de dois itens, filtros e resumo global, incluindo `mine`. | PASSOU |
| CA-002 | Contratos com `agent_id`, `unread=true/false`, combinações, parâmetros inválidos e telefone formatado com/sem DDI/nono dígito. UI envia os filtros corretos. | PASSOU |
| CA-003 | Timers simulados: debounce 300 ms, polling 15 s, aba oculta/visível e resposta antiga ignorada. Refresh após POST usa a busca/filtros atuais. | PASSOU |
| CA-004 | Seleção e rascunho mantidos quando a conversa sai do resultado da fila. | PASSOU |
| CA-005 | Backend com 65 mensagens no mesmo timestamp: últimas 50, 15 anteriores, sem duplicatas, legado ASC preservado. UI preserva histórico no polling e recupera a lacuna entre 100 mensagens carregadas e um total novo de 151. | PASSOU |
| CA-006 | Resposta atrasada do histórico de A descartada após selecionar B. | PASSOU |
| CA-007 | Texto e File isolados por conversa, preservados na alternância; ausência de seleção e desmontagem do hook verificadas. | PASSOU |
| CA-008 | Sucesso limpa somente o snapshot enviado, inclusive em outra conversa; novas edições de texto/arquivo sobrevivem. | PASSOU |
| CA-009 | Submit duplo produz um POST; rejeições HTTP e de rede mantêm texto/arquivo e liberam a trava. | PASSOU |
| CA-010 | Resposta rápida acrescentada ao texto existente, sem envio automático ou descarte de arquivo. | PASSOU |
| CA-011 | Destino escolhido para transferência sobrevive ao polling e é enviado ao endpoint correto. | PASSOU |
| CA-012 | Sugestão A desaparece ao selecionar B; edição sobrevive ao polling; novo resposta_id encerra edição antiga; ação pendente de A não injeta seu estado em B. | PASSOU |
| CA-013 | Regressões existentes da página, contexto, anexos, janela de 24 horas, autenticação e reenvio idempotente do bot. | PASSOU |

## Verificações técnicas

Comandos frontend executados a partir da pasta `frontend` desta worktree:

- `npm test`: **28 arquivos Vitest, 182 testes aprovados**, mais **9 testes Node
  aprovados**. O conjunto inclui 21 testes existentes da página WhatsApp, 18
  cenários de produtividade e 8 testes do hook de rascunhos.
- `npx tsc --noEmit`: aprovado.
- `npm run lint`: aprovado, sem warnings.
- `npm run build`: aprovado; 43 páginas geradas. Rota `/whatsapp-stage`: 17,6 kB,
  First Load JS de 153 kB. O aviso de atualização da base Browserslist não
  impediu compilação, lint, tipos ou geração das páginas.

Comandos backend executados a partir de `whatsapp-stage-backend`, com
`DATABASE_URL` apontando exclusivamente ao banco local de teste:

- `npm run build`: aprovado.
- `npm run test:conversation-productivity`: aprovado com PostgreSQL real.
- `npm run test:conversation-ordering`: aprovado com PostgreSQL real.
- `./node_modules/.bin/ts-node --files scripts/test-inbox-ui-contracts.ts`: aprovado.
- `npm run test:customer-service-window`: aprovado.
- `./node_modules/.bin/ts-node --files scripts/test-message-attachment.ts`:
  aprovados serviço, validação de anexos e nomes de arquivos; Graph API simulado.
- `npm run test:auth-policy`: aprovado.

Os workflows `deploy-stage.yml` e `deploy.yml` incluem uma etapa idêntica que
cria um banco exclusivo `fortcordis_whatsapp_test`, aplica `npm run migrate` e
executa os contratos de produtividade e ordenação. Os dois YAMLs foram
analisados com `js-yaml`; a etapa foi extraída e executada localmente com
`bash -e`, alterando somente a conexão para o PostgreSQL temporário. A etapa
passou. Nenhum workflow remoto foi disparado.

- `git diff --check`: aprovado.
- Guardrail SDD: função oficial `evaluate_guardrail`, aplicada ao conjunto de
  arquivos modificados e novos, aprovada. Foi usada a avaliação direta porque
  a entrega está sem commit; não se declarou validação de um SHA inexistente.

## Inspeção visual

Next.js em modo de produção local (`next start`, porta 3013), Chrome headless
via Playwright, autenticação e APIs interceptadas com dados fictícios. Toda
requisição a hosts externos foi bloqueada pelo harness.

- Desktop: viewport de 1440 × 1100; fila, resumo, compositor e contexto visíveis.
- Celular: viewport de 390 × 844; painéis empilhados, controles acessíveis e
  respostas rápidas quebradas em linhas.
- Não houve overflow horizontal do documento nem eventos `pageerror`.
- Texto do compositor e resposta rápida inspecionados no resultado renderizado.
- Capturas temporárias: `/tmp/fortcordis-whatsapp-desktop.png` e
  `/tmp/fortcordis-whatsapp-mobile.png`.

## Limites

Os rascunhos humanos vivem somente na memória enquanto a página permanece
aberta. A trava de envio previne cliques repetidos na mesma montagem; ela não
é garantia de entrega única na Meta quando há resultado de rede ambíguo.
Nesses casos a interface conserva o rascunho e orienta conferir o histórico.

A validação usa dados sintéticos e comprova os contratos locais. Não equivale
a smoke de stage/produção nem comprova ganho de produtividade medido com a
equipe. A publicação permanece como etapa separada.

## Continuação

A primeira entrega acima foi posteriormente publicada em `b8246a32`. As
evidências da nova etapa, implementada sobre esse baseline, ficam em
`../whatsapp-fila-respostas/verify.md`; os testes anteriores continuam fazendo
parte da regressão. Este acréscimo não declara publicação da segunda etapa.
