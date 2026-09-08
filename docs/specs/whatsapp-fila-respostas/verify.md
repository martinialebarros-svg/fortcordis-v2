# Verify — fila de respostas WhatsApp

## Estado da entrega

- Verificação local concluída em 2026-09-07 (America/Fortaleza).
- Baseline `b8246a32a27d7c63f62f324d107f25fd86b8306d`, confirmado no início
  como HEAD, origin/stage e origin/main.
- Branch `codex/whatsapp-fila-respostas`; worktree isolada
  `/Users/martiniano/.codex/worktrees/whatsapp-produtividade`.
- No encerramento da implementação local, ainda sem commit/push/publicação.
  A publicação foi autorizada em seguida pelo usuário ("prossiga"). O checkout
  principal e suas alterações de pacientes foram preservados.
- PostgreSQL 16 temporário em 127.0.0.1:55439, bancos sintéticos
  `wa_queue_test` e `wa_queue_backend_test`. API core/Graph simuladas.
  Nenhuma mensagem real enviada, segredo consultado ou callback alterado.

## Matriz funcional

| Requisitos | Evidência | Resultado |
|---|---|---|
| RF-001–003 | Banco real: pendência independente de seen, filtros combinados e validação, contador global e espera mais antiga; sucesso sent/delivered/read versus pending/failed; retry com mesmo ID; timestamps empatados. UI com total global, filtros pessoais e limpeza. | PASSOU |
| RF-004 | Fechamento registra marco; nova inbound reabre; duplicação de payload e de wa_message_id não reabre; backfill e migração reaplicada preservam o marco. Webhook assinado sintético. | PASSOU |
| RF-005 | Fechamento com token divergente retorna 409 e não altera status, incluindo transações concorrentes; UI envia o token string do histórico sem arredondar bigint e recarrega após conflito. | PASSOU |
| RF-006–007 | Conclusão e GET novo para próxima pendência com filtros; nenhuma pendência e falha de consulta dão feedback; seleção/filtros durante PATCH ou GET não redirecionam; repetição bloqueada; texto e anexo preservados. | PASSOU |
| RF-008 | Dois claims simultâneos: um sucesso e um conflito; mesma pessoa é idempotente; transferência legada preservada. UI usa o ID vinculado ao email e preserva o colega que assumiu primeiro. | PASSOU |
| RF-009–012 | CRUD/validação, atalho único inclusive inativo, desativação/reativação, 404/422/409, versões concorrentes, seeds editados/renomeados/desativados preservados. HTTP 401 sem token; perfil de leitura obtém GET200 e escrita403; perfil de escrita cria com201, core simulado. | PASSOU |
| RF-013–015 | Busca sem acentos, categoria, atalho final, inserção sem envio; gestão fora do form de envio; bloqueio de inserção pela janela; conflito de edição preserva texto, recuperação de leitura e falha de rede; leitura atrasada não apaga cadastro salvo. | PASSOU |
| RF-016 | Favoritos filtram e persistem somente IDs por usuário; trocar de usuário isola preferências. | PASSOU |

## Verificações executadas

Frontend, a partir de `frontend/`:

- `npm test`: **30 arquivos Vitest, 213 testes**, mais **9 testes Node**,
  todos aprovados (**222 testes**).
- Inclui 20 cenários de fila/conclusão, 9 da biblioteca, 20 de produtividade,
  21 da página anterior e 8 do hook de rascunhos.
- `npm run lint`: aprovado, sem warnings ESLint.
- `./node_modules/.bin/tsc --noEmit`: aprovado.
- `npm run build`: aprovado, 43 páginas. WhatsApp: 21,8 kB e First Load JS
  157 kB. Aviso não impeditivo da base Browserslist desatualizada.

Backend, a partir de `whatsapp-stage-backend/`, com DATABASE_URL somente para
os bancos sintéticos acima:

- `npm run migrate`: init.sql e quick-replies.sql na mesma transação.
- `npm run test:conversation-reply-queue`: aprovado.
- `npm run test:quick-replies`: aprovado, incluindo permissões HTTP com API
  core simulada. Violações únicas esperadas nos testes negativos foram
  registradas pelo logger genérico do banco e tratadas como 409 pelo endpoint.
- `npm run test:conversation-productivity`: aprovado.
- `npm run test:conversation-ordering`: aprovado.
- `./node_modules/.bin/ts-node --files scripts/test-inbox-ui-contracts.ts`:
  aprovado.
- `npm run test:customer-service-window`: aprovado.
- `npm run test:auth-policy`: aprovado.
- `./node_modules/.bin/ts-node --files scripts/test-message-attachment.ts`:
  aprovados serviço, validação, truncamento e decodificação de nomes; Graph
  simulado.
- `npm run build`: aprovado.

Os quality gates de stage e produção agora incluem os dois novos contratos
no banco efêmero exclusivo já existente. YAMLs analisados com js-yaml e
presença dos comandos validada. Nenhum workflow remoto foi disparado.

`git diff --check` e função oficial `evaluate_guardrail` do SDD passaram sobre
arquivos modificados **e novos**, sem criar commit apenas para verificar.

## Verificação visual e de interação

Next.js em build de produção local, porta 3013, Chrome headless e Playwright;
autenticação e todas as APIs interceptadas com fixtures, hosts externos
bloqueados. Nenhuma requisição de envio de mensagem foi efetuada.

- Desktop 1440 × 1100 e celular 390 × 844, sem overflow horizontal e sem
  `pageerror`.
- Assumir para mim, inserir por /atalho, favoritar, filtrar favoritas,
  cadastrar frase e resolver/abrir próxima exercitados no navegador.
- Retornar à conversa resolvida preservou o texto exato do rascunho.
- Capturas: `/tmp/fortcordis-wa-queue-{desktop,chat,library,mobile}.png`.
- Harness: `/tmp/fortcordis-wa-queue-visual.cjs`.

## Limites e retorno

A espera é tempo corrido desde a primeira inbound pendente. Uma resposta
operacional enviada com sucesso conta como resposta, sem avaliar se o assunto
foi satisfatoriamente resolvido. Não há medida real de ganho de produtividade.

O token do histórico é conservador se uma mensagem chegar entre as consultas
internas: pode pedir uma revisão adicional (409), mas não fechar silenciosamente
uma mensagem nova. Os clientes legados que omitem o token continuam compatíveis;
os controles da central o enviam para fechamento.

Frases são compartilhadas e atualizadas na abertura ou por Atualizar biblioteca.
Favoritos são preferências deste navegador por usuário. Rascunhos humanos seguem
somente em memória enquanto a página permanece montada.

A migração é aditiva e permite retorno ao código anterior mantendo os dados.
Criação de índices pode bloquear escrita durante a migração: volume e janela
operacional devem ser considerados quando a publicação for solicitada.
Esta evidência local não substitui smoke autenticado de stage/produção.

## Preparação para publicação

- Remotos conferidos novamente: `origin/stage` e `origin/main` permaneciam em
  `b8246a32`, sem delta adicional a integrar. Lint e TypeScript repetidos e
  aprovados no preparo.
- Deploy padrão executa `npm run migrate` no serviço WhatsApp correto antes
  do restart; a nova tabela e o marco de resolução seguem a migração testada.
- Workflows mantêm os serviços e configurações separados entre stage e
  produção; o diff de CI acrescenta somente os dois contratos novos.
- A promoção ocorrerá com o SHA exato aprovado em stage, após conclusão
  dos workflows e smoke de rota, serviço, APIs protegidas e bundles.
  A evidência terminal de publicação será registrada no relatório da tarefa.
