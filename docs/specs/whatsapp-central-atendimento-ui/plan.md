# Plan - whatsapp-central-atendimento-ui

## Fase 1 - contratos

- [x] P1.1 ampliar a busca de conversas sem remover `phone`;
- [x] P1.2 retornar dados amigáveis do atendente e da última mensagem;
- [x] P1.3 adicionar atualização validada/auditada de status;
- [x] P1.4 expor o catálogo local de modelos configurados.

## Fase 2 - interface

- [x] P2.1 reorganizar a página em fila, conversa e contexto;
- [x] P2.2 traduzir estados e mover dados técnicos para detalhes;
- [x] P2.3 melhorar atribuição, classificação e compositor;
- [x] P2.4 adicionar respostas rápidas e preview de modelos;
- [x] P2.5 ajustar o layout responsivo.

## Fase 3 - verificação

- [x] P3.1 atualizar testes de interface;
- [x] P3.2 executar TypeScript, lint direcionado e testes frontend;
- [x] P3.3 executar build e testes de contratos do backend WhatsApp;
- [x] P3.4 executar o guardrail SDD sobre o conjunto alterado.

## Fase 4 - vínculo de domínio

- [x] P4.1 definir resolução exata por telefone e regra de ambiguidade;
- [x] P4.2 criar endpoint somente leitura no backend principal;
- [x] P4.3 relacionar clínica/tutor a pets, agenda e OS com listas limitadas;
- [x] P4.4 substituir o placeholder do painel lateral pelo contexto resolvido;
- [x] P4.5 cobrir vínculo de clínica, tutor, ausência e ambiguidade em testes;
- [x] P4.6 repetir builds, lint, testes e guardrail SDD.

## Rollback

- Reverter a página e o bloco `fc-wa-*` restaura a experiência anterior.
- Remover as novas rotas/campos não exige migração de banco; o único write novo
  usa a coluna `status` e a tabela `audit_logs` já existentes.
- O vínculo de domínio é somente leitura e não exige migração. O rollback da
  fase 4 consiste em remover o endpoint `whatsapp-contexto` e restaurar o
  placeholder do painel lateral.
