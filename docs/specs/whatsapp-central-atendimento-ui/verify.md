# Verify - whatsapp-central-atendimento-ui

## Matriz de aceitação

| Critério | Evidência | Resultado |
|---|---|---|
| CA-001 | Consulta usa `search` em telefone, assunto e última mensagem; UI testa envio de `search=Animal+Care` | passou |
| CA-002 | Testes DOM e inspeção visual local em 1600x900 e 390x844 | passou |
| CA-003 | Rotas existentes preservadas; `test:auth-policy` confirma proteção | passou |
| CA-004 | `isConversationStatus` coberto por `test:inbox-ui`; write usa lock e auditoria | passou |
| CA-005 | `page.test.tsx` valida bloqueio após janela encerrada | passou |
| CA-006 | `test:inbox-ui` valida 11 modelos e `meta_approval_live: null` | passou |
| CA-007 | `page.test.tsx` preenche variáveis e copia preview para o rascunho | passou |
| CA-008 | Comandos de validação abaixo | passou |
| CA-009 | `test_whatsapp_conversation_context` resolve clínica e relações de agenda/OS | passou |
| CA-010 | `test_whatsapp_conversation_context` resolve tutor, pets e relações | passou |
| CA-011 | Backend e `page.test.tsx` validam número duplicado sem vínculo implícito | passou |
| CA-012 | `page.test.tsx` descarta resposta atrasada após troca de conversa | passou |

## Comandos previstos

```bash
cd frontend
npx tsc --noEmit
npx eslint app/whatsapp-stage/page.tsx app/whatsapp-stage/page.test.tsx
npx vitest run app/whatsapp-stage/page.test.tsx

cd ../backend
venv/bin/python -m unittest tests.test_whatsapp_conversation_context

cd ../whatsapp-stage-backend
npm run build
npm run test:inbox-ui
npm run test:approved-templates
npm run test:customer-service-window
npm run test:auth-policy
```

## Verificação manual

1. Pesquisar por nome, telefone e trecho da última mensagem.
2. Selecionar conversa e confirmar leitura dos estados traduzidos.
3. Assumir, transferir, liberar e alterar classificação.
4. Enviar texto com `Ctrl/Cmd+Enter` durante janela aberta.
5. Confirmar bloqueio de texto e orientação por modelo após o encerramento.
6. Abrir catálogo, preencher variáveis e validar preview sem afirmar aprovação
   em tempo real.
7. Selecionar números de clínica e tutor e confirmar clínica, tutor, pet,
   agendamento e OS no contexto.
8. Selecionar um número duplicado e confirmar aviso de ambiguidade sem vínculo
   automático.

## Resultado final - 2026-08-16

- `npx tsc --noEmit`: passou.
- ESLint direcionado da página e do teste: passou sem avisos.
- Vitest direcionado: 3 testes passaram.
- `npm run build` do frontend: passou; rota `/whatsapp-stage` gerada com sucesso.
- `npm run build` do backend WhatsApp: passou.
- `test:inbox-ui`, `test:approved-templates`,
  `test:customer-service-window` e `test:auth-policy`: passaram.
- `git diff --check`: passou.
- `evaluate_guardrail` com a lista da entrega: passou e qualificou
  `whatsapp-central-atendimento-ui`.
- Inspeção visual com backend local simulado: layout em três painéis correto em
  1600x900 e fluxo vertical correto em 390x844. Os erros do overlay local eram
  apenas chamadas auxiliares de dashboard/push ausentes no mock.

Risco residual: esta primeira etapa não consulta o status do modelo na Meta e
não envia modelos de ação diretamente pela caixa de entrada. O envio continua
nos fluxos de domínio para preservar vínculo com agendamento, exame ou OS.

## Resultado da fase 4 - 2026-08-16

- `venv/bin/python -m unittest tests.test_whatsapp_conversation_context
  tests.test_clinicas_whatsapp_multiplos tests.test_whatsapp_template_delivery`:
  16 testes passaram.
- TypeScript e ESLint direcionado do frontend: passaram.
- Vitest da central: 6 testes passaram.
- Build de produção do frontend: passou; `/whatsapp-stage` gerada.
- Build do backend WhatsApp, `test:inbox-ui` e `test:auth-policy`: passaram.
- Os workflows de stage e produção provisionam PostgreSQL efêmero e executam
  `test:inbox-ui` e `test:webhook-cleanup-config` antes do deploy.
- `git diff --check`: passou.
- `evaluate_guardrail` qualificou `whatsapp-central-atendimento-ui`.
- Verificação visual local confirmou leitura de clínica, tutor, pet,
  agendamento e OS, com links e valores formatados no painel responsivo.

Risco residual da fase 4: números propositalmente compartilhados exigem
correção do cadastro antes do vínculo automático. A central informa os
candidatos e não expande agenda/OS nesse estado.
