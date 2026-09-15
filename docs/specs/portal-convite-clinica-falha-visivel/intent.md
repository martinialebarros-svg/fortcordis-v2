# Intent - portal-convite-clinica-falha-visivel

Data: 2026-09-15  
Responsavel: Martiniano Barros  
Status: draft

## 1) Problema

Encontrado no primeiro teste real do convite por WhatsApp em stage, logo depois
do merge de `whatsapp-portal-clinic-invite-template` (#90).

O responsavel tentou enviar o convite **varias vezes**. Nenhuma mensagem chegou,
e a tela nao deu nenhuma informacao -- a resposta voltava `200` com
`delivery_status: "manual_copy"`, exatamente como voltaria se o envio estivesse
apenas desabilitado.

Causa da cegueira, em `portal_clinic_auth.py`:

```python
except Exception:
    if not payload.allow_manual_copy:
        raise HTTPException(502, "Nao foi possivel enviar o convite por WhatsApp.")
```

A excecao e descartada **sem log**. E mesmo quando o chamador pede para nao cair
em copia manual, o 502 troca o motivo real por um texto generico. Nao ha, em
lugar nenhum, registro de por que o envio falhou.

Isso deixa dois cenarios indistinguiveis do lado de fora:

1. `WHATSAPP_AGENDA_ENABLED` desligado -- envio nem tentado.
2. Envio tentado e falhou: integracao sem token, servico fora do ar, modelo
   recusado pela Meta, numero invalido.

No diagnostico foi preciso ler o codigo e eliminar hipoteses uma a uma para
concluir que o caso era o (2). Com log, teria sido uma linha.

## 2) Objetivo

Quando o convite nao sai por WhatsApp, o motivo fica registrado -- e chega a
quem chamou, quando o chamador nao aceitou copia manual.

## 3) Nao objetivos

- Nao mudar quando o envio acontece, nem o fallback para copia manual. O convite
  continua sendo criado e valido por copia mesmo quando o WhatsApp falha: isso
  esta certo e e o que impede uma clinica de ficar sem acesso.
- Nao investigar a causa raiz do ambiente de stage. E outro trabalho; este aqui
  e o que torna essa investigacao possivel da proxima vez.
- Nao expor o motivo na interface. Precisa de campo novo na resposta e mudanca
  de frontend -- ver secao 5.

## 4) Contexto e restricoes

- O servico de entrega sinaliza condicao de ambiente com `HTTPException`
  (integracao nao configurada, envio desabilitado) e falha de envio com
  `WhatsAppTemplateDeliveryError`. Os dois precisam de tratamento, e o `detail`
  da primeira e justamente a informacao util.
- O motivo nao pode conter o numero de destino nem o token: vai para log.
- Nao e o primeiro caso deste padrao no repo. A spec
  `atendimento-status-apos-finalizar` registra o mesmo defeito no botao de
  emitir receita: saida muda em caminho de acao do usuario custa caro no
  diagnostico.

## 5) Limite conhecido desta entrega

O log resolve para quem consegue ler o log da VPS. **Nao resolve para quem esta
na tela**, que foi exatamente o caso de hoje: a resposta continua `200` com
`delivery_status: "manual_copy"` e nenhuma pista.

Fechar isso exige um campo novo na resposta (ex.: `delivery_error`) e a
interface exibindo-o. E aditivo e de baixo risco, mas e decisao a parte --
registrado aqui para nao se perder.
