# Verify - whatsapp-reenvio-mensagem-falha

## Matriz de aceitação

| Critério | Evidência | Resultado |
|---|---|---|
| CA-001 | teste `reenvia uma mensagem com falha`: botão "Reenviar" presente para mensagem `status: "failed"` | passou |
| CA-002 | mesmo teste: `POST /whatsapp/conversations/90/messages` com `{body: "Olá, tudo bem?", type: "text"}` | passou |
| CA-003 | mesmo teste: texto "Mensagem reenviada." aparece após o clique, botão desaparece (mensagem recarregada com novo status) | passou |
| CA-004 | revisão de código (`whatsapp-envio-anexo-documento`): condição do botão passou a incluir `message.type === "text"` | ok (sem teste de componente dedicado) |

## Comandos executados

```bash
cd frontend
npx tsc --noEmit
npx eslint app/whatsapp-stage/page.tsx app/whatsapp-stage/page.test.tsx --max-warnings=0
npx vitest run app/whatsapp-stage/page.test.tsx
npx next build
```

## Resultado - 2026-08-19

- `tsc --noEmit`, `eslint --max-warnings=0`: sem erros.
- `vitest run`: 13 testes passaram (1 novo desta feature, sem regressão
  nos 12 já existentes).
- `next build`: passou; rota `/whatsapp-stage` gerada (11.7 kB).

Risco residual: reenviar cria uma mensagem nova (não corrige a original)
— se o mesmo problema que causou a primeira falha persistir (ex.: token
expirado), o reenvio falha de novo com o mesmo erro, e o atendente pode
clicar "Reenviar" repetidamente sem limite de tentativas. Aceitável por
ser uma ação manual e explícita, não um retry automático.
