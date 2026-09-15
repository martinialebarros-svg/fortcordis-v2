# Intent - whatsapp-smoke-test-isolamento-limpeza

## Problema

Ao investigar como limpar conversas de teste ("Smoke User ...", "Agent
Smoke") visíveis na Central de Atendimento WhatsApp, descobrimos que o
problema era maior do que uma sujeira pontual: `whatsapp-stage-backend/scripts/smoke-tests.sh`
roda automaticamente em **todo deploy** (stage desde abril/2026, produção
desde o cutover de 17/08/2026), e o serviço WhatsApp não tem banco
Postgres isolado — usa o mesmo `DATABASE_URL` do backend principal, tanto
em stage quanto em produção. Ou seja, cada deploy criava uma conversa e um
atendente sintéticos novos nas tabelas reais (`conversations`, `agents`,
`messages`, `message_status_events`, `webhook_events`, `audit_logs`),
visíveis para atendentes de verdade na tela `/whatsapp-stage`.

## Objetivo

Parar a contaminação recorrente em produção e oferecer uma forma segura de
limpar o que já se acumulou, em stage e produção.

## Escopo inicial

- desativar o smoke test no deploy de produção
  (`ENABLE_WHATSAPP_STAGE_SMOKE=0` em `.github/workflows/deploy.yml`),
  mantendo-o em stage — é lá que faz sentido validar o deploy end-to-end
  antes de promover;
- endpoint de preview (`GET /admin/whatsapp-smoke-cleanup/preview`) que
  conta o que seria apagado, sem apagar nada;
- endpoint de execução (`POST /admin/whatsapp-smoke-cleanup/execute`,
  só admin) que apaga com segurança usando marcadores que o WhatsApp real
  nunca produziria.

## Fora de escopo

- reescrever o smoke test para usar um banco/schema isolado (resolveria a
  causa raiz de forma mais definitiva, mas é uma mudança maior de
  infraestrutura; a decisão tomada agora foi só desligar em produção);
- UI dedicada para a limpeza — por ora é só via chamada autenticada
  (mesmo padrão já usado para o preview do lembrete automático).

## Riscos e decisões

- Marcador de mensagem (`messages.wa_message_id LIKE 'wamid.smoke.%'`) é a
  âncora mais confiável — nenhum `wamid` real da Graph API tem esse
  formato. **Não** usar o prefixo de telefone (`5511...`) como critério:
  55 é o código do Brasil e 11 é DDD real de São Paulo, colidiria com
  clientes reais.
- `agents.email LIKE 'agent.smoke.%@example.com'` é seguro porque
  `example.com` é domínio reservado (RFC 2606) — nenhum atendente real
  usaria esse domínio.
- `webhook_events.raw_body` precisa de busca por substring
  (`LIKE '%wamid.smoke.%'`, com `%` nas duas pontas) — é o JSON bruto do
  webhook, o marcador não fica no início da string. Usar o mesmo padrão
  ancorado (`'wamid.smoke.%'`) usado para `messages.wa_message_id` aqui
  seria um bug (não casaria nada) — foi exatamente isso que o teste
  automatizado pegou antes do deploy.
- `conversation_participants` tem `ON DELETE CASCADE` a partir de
  `conversations`, então não precisa de limpeza própria. `messages`
  também cascade a partir de `conversations`. `message_status_events`,
  `webhook_events` e `audit_logs` não têm FK com cascade e precisam de
  `DELETE` explícito, ou ficam com IDs órfãos.
- Execução (`execute`) exige papel `admin` explicitamente dentro do
  handler (`req.authUser.papeis`), não apenas a autenticação padrão do
  serviço WhatsApp — mesmo padrão de "leitura para qualquer atendente,
  escrita destrutiva só para admin" já usado no toggle de Configurações do
  backend principal.
