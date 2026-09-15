# Spec - atendimento-anexo-pdf-preview-csp

Data: 2026-08-15
Responsavel: Claude (pareado com Martiniano)
Status: done

## 1) Escopo funcional

Adicionar a diretiva `frame-src 'self' blob:` a
`appContentSecurityPolicy` em `frontend/next.config.js`, para que o
`<iframe>` de preview de PDF (`AttachmentPreviewModal`, alimentado por
`buildPdfPreviewUrl` em `frontend/app/atendimento/page.tsx`) possa carregar
`blob:` URLs de mesma origem sem violar a CSP enviada via header HTTP.

## 2) Requisitos funcionais (RF)

- RF-001: a lista `appContentSecurityPolicy` em `frontend/next.config.js`
  passa a incluir a diretiva `frame-src 'self' blob:`.
- RF-002: nenhuma outra diretiva da policy e removida ou alterada.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (seguranca): a diretiva nao deve permitir framing de origens
  externas arbitrarias (`frame-src *` esta fora de escopo) - restrita a
  `'self'` e `blob:`.
- NFR-002 (compatibilidade): `frame-ancestors 'none'` permanece inalterado
  (continua bloqueando que a aplicacao seja enquadrada por terceiros).

## 4) Contratos tecnicos

### API

Nao aplicavel - mudanca e apenas de header HTTP estatico.

### Banco/migracoes

Nao aplicavel.

### Frontend

- Telas afetadas: modal de preview de anexo em `/atendimento`
  (`AttachmentPreviewModal`).
- Estados de UI: o `<iframe>` do preview de PDF passa a renderizar o
  conteudo em vez de ficar em branco/bloqueado.
- Regras de exibicao/erro: nenhuma mudanca de logica - apenas o header CSP
  enviado pelo servidor Next.js.

## 5) Compatibilidade e rollout

- Backward compatibility: sim - apenas amplia uma permissao que antes nao
  existia; nenhum comportamento anterior deixa de funcionar.
- Feature flag: nao ha.
- Estrategia de rollback: reverter a linha adicionada em
  `frontend/next.config.js`.

## 6) Criterios de aceitacao (CA)

- CA-001: o header `Content-Security-Policy` retornado pelo servidor
  Next.js inclui `frame-src 'self' blob:`.
- CA-002: um `<iframe>` apontando para uma `blob:` URL de mesma origem
  carrega sem gerar violacao de CSP no console do navegador.
- CA-003: as demais diretivas da policy (`default-src`, `img-src`,
  `script-src`, `connect-src`, `frame-ancestors`, etc.) permanecem
  identicas as anteriores.

## 7) Casos de borda

- CB-001: `frame-src` ausente faz o navegador cair no fallback
  `default-src 'self'`, que bloqueia `blob:` - e exatamente o bug
  corrigido aqui.

## 8) Fora de escopo

- Qualquer alteracao em `AttachmentPreviewModal.tsx` ou
  `buildPdfPreviewUrl`.
- Demais achados de acessibilidade de modais (#55).
