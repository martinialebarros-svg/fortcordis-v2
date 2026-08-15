# Intent - atendimento-anexo-pdf-preview-csp

Data: 2026-08-15
Responsavel: Claude (pareado com Martiniano)
Status: done

## 1) Problema atual

Ao revisar o achado #55 (acessibilidade de modais), foi reproduzido um erro
real de console ao abrir o preview de um anexo PDF no modal de atendimento
(`AttachmentPreviewModal`, usado por `frontend/app/atendimento/page.tsx`):

```
Framing 'blob:http://localhost:3002/...' violates the following Content
Security Policy directive: 'default-src 'self''. The request has been
blocked.
```

O componente renderiza um `<iframe src={buildPdfPreviewUrl(attachmentPreview)} />`
apontando para uma `blob:` URL montada a partir do PDF ja baixado. A
Content-Security-Policy declarada em `frontend/next.config.js`
(`appContentSecurityPolicy`) nao tinha uma diretiva `frame-src`; sem ela, o
navegador cai no fallback `default-src 'self'`, que nao permite framing de
`blob:` URLs (blob nao e a mesma origem literal `'self'` para fins de
`frame-src`). Isso bloqueava a exibicao do PDF dentro do modal.

Como a policy e enviada via header HTTP real (`next.config.js` -> `headers()`),
isso acontece em qualquer navegador real em stage/producao, nao e um
artefato de ambiente de teste sandboxed.

## 2) Objetivo

Permitir o framing de `blob:` URLs de mesma origem no preview de PDF do
modal de anexos, sem afrouxar a CSP alem do necessario.

## 3) Nao objetivos

- Nao alterar `buildPdfPreviewUrl` nem o componente `AttachmentPreviewModal`
  - o mecanismo de montagem da blob URL ja estava correto, faltava apenas a
  diretiva de CSP.
- Nao usar `frame-src *` nem remover/afrouxar outras diretivas existentes
  na policy (`img-src`, `script-src`, `connect-src`, etc).
- Nao revisitar os demais itens do achado #55 (acessibilidade de modais em
  geral) - escopo aqui e restrito ao bloqueio de CSP no preview de PDF.

## 4) Contexto e restricoes

- Restricoes tecnicas: a mudanca precisa ser feita na lista
  `appContentSecurityPolicy` em `frontend/next.config.js`, unica fonte do
  header `Content-Security-Policy` enviado pelo Next.js.
- Restricoes de prazo: nenhuma.
- Restricoes regulatorio/operacional: nenhuma.

## 5) Impacto esperado

- Usuarios impactados: veterinarios/usuarios que abrem o preview de anexos
  PDF em atendimentos.
- Modulos impactados: `frontend/next.config.js` (CSP global, aplicada a
  `/:path*`).
- Risco de regressao: baixo - adicao pontual de uma diretiva que so amplia
  o que ja era permitido para framing (antes: nada; depois: mesma origem e
  `blob:`).

## 6) Riscos iniciais

- Risco 1: uma diretiva `frame-src` mal escopada (ex.: `*`) abriria a
  aplicacao para clickjacking/framing por terceiros - mitigado usando
  apenas `'self' blob:`.
- Risco 2: `frame-ancestors 'none'` (que controla quem pode enquadrar ESTA
  aplicacao) e uma diretiva diferente de `frame-src` (que controla o que
  ESTA aplicacao pode enquadrar) - confirmado que nao ha conflito, pois sao
  mecanismos distintos da CSP.

## 7) Perguntas abertas

Nenhuma.

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
