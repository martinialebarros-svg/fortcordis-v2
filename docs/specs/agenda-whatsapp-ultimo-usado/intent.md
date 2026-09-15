# Intent - agenda-whatsapp-ultimo-usado

Data: 2026-08-08
Responsavel: Martiniano + Claude
Status: approved (sugestao feita e aprovada pelo usuario)

## 1) Problema atual

No fluxo de mensagem de confirmacao (`NovoAgendamentoModal.tsx`, spec base
`agenda-reserva-mensagem-edicao`), quando o destinatario (clinica ou tutor) tem mais de um
WhatsApp cadastrado, a secretaria precisa escolher o numero toda vez que gera a mensagem — mesmo
quando ja usou o mesmo numero da ultima vez para aquele mesmo contato.

## 2) Objetivo

Lembrar, por contato (clinica ou tutor), o ultimo WhatsApp efetivamente usado (abriu o WhatsApp ou
copiou a mensagem) e pre-selecionar esse numero na proxima vez, mantendo o dropdown de escolha
para quando o numero mudar.

## 3) Nao objetivos

- Sincronizar essa preferencia entre dispositivos/usuarios (fica local ao navegador, via
  `localStorage`, mesma limitacao de outras preferencias locais ja existentes no app).
- Mudar a logica de quais telefones sao candidatos (isso continua vindo de
  `obterWhatsappsClinica`/dados do tutor).

## 4) Contexto e restricoes

- Nao existe wrapper compartilhado de `localStorage` no frontend; o padrao do repo e cada tela
  cuidar da propria leitura/escrita com guarda de `typeof window` e `try/catch` (visto em
  `frontend/lib/racas.ts`, `frontend/app/fiscal/components/ExportacaoDadosContabeisPage.tsx`).
  Seguido aqui com chave `fortcordis:agenda:ultimo-whatsapp:v1:<tipo>:<id>`.
- A gravacao acontece no momento em que a secretaria efetivamente usa o numero (abre o WhatsApp ou
  copia a mensagem), nao a cada mudanca no dropdown — evita gravar uma escolha que a pessoa so
  esta olhando e nao vai usar.

## 5) Impacto esperado

- Usuarios impactados: equipe interna que usa o modal de agendamento/reserva.
- Modulos impactados: `frontend/app/agenda/NovoAgendamentoModal.tsx` (unico arquivo alterado).
- Risco de regressao: minimo — mudanca aditiva, com fallback identico ao comportamento anterior
  (`telefones[0]`) quando nao ha numero lembrado ou o numero lembrado nao esta mais na lista de
  candidatos.

## 6) Riscos iniciais

- `localStorage` indisponivel (modo privado/quota) — mitigado com `try/catch` silencioso,
  degradando para o comportamento anterior sem erro visivel.
- Numero lembrado deixa de existir (contato removeu o WhatsApp) — mitigado checando
  `telefones.includes(telefoneLembrado)` antes de usar; caso contrario cai no primeiro candidato.

## 7) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
