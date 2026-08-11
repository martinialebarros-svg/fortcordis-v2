# Intent - atendimento-documento-emitido-aviso

Data: 2026-08-11
Responsavel: Claude (pareado com Martiniano)
Status: em andamento

## 1) Problema atual

GitHub issue #43 ("[UX] Documento 'emitido' continua editável sem
nenhum aviso"), origem achado #24 da auditoria UX/fluxo
(`docs/AUDITORIA-ATENDIMENTO-UX-FLUXO-2026-08-09.md`, issue de tracking
#57): ao gerar o PDF de um documento clinico
(`/atendimentos/{id}/documentos/{id}/pdf`), o backend ja marca
`status="emitido"` e `emitido_at` de forma persistente (confirmado em
`backend/app/api/v1/endpoints/atendimento.py`,
`gerar_pdf_documento_atendimento`), mas o frontend
(`AtendimentoDocumentosSection.tsx`) exibia isso so como texto cinza
pequeno na lista, e o editor (titulo + corpo) permanecia 100%
editavel, sem nenhum sinal visual de que aquele documento ja foi
oficialmente emitido e entregue.

Um atestado ja entregue ao tutor pode ser reaberto e alterado, e um
novo PDF gerado sem qualquer aviso explicito de que isso cria uma nova
versao oficial do documento.

O pacote anterior ja "done" (`atendimento-documentos-auditoria`)
resolveu a trilha de auditoria no backend (log de quem editou/excluiu
documentos), mas documentou explicitamente "nenhuma alteracao de
frontend" - esse gap de UX permanece, e e o que este pacote resolve.

## 2) Objetivo

Tornar o estado "emitido" visivel e explicito em 3 pontos, exatamente
como sugerido pela auditoria:

1. Badge de cor distinta (nao so texto cinza) na lista de documentos.
2. Banner de aviso no editor quando o documento selecionado ja foi
   emitido.
3. Confirmacao explicita antes de gerar um NOVO PDF de um documento que
   ja foi emitido antes (evitar que uma edicao pos-emissao gere um novo
   PDF "por engano", sem o vet perceber que esta criando uma nova
   versao oficial).

## 3) Nao objetivos

- Nao tornar o titulo/corpo `readOnly` quando `status === "emitido"` -
  a sugestao da auditoria (banner + badge + confirmacao) nao inclui
  bloquear a edicao; um vet pode legitimamente precisar corrigir um
  erro de digitacao antes de reenviar ao tutor. Bloquear edicao seria
  uma mudanca de comportamento mais invasiva, fora do escopo "esforço
  pequeno" deste issue.
- Nao alterar o backend - `status`/`emitido_at` ja sao persistidos
  corretamente pelo endpoint de geracao de PDF; este pacote e 100%
  frontend (consumir o que ja existe, exibir de forma mais visivel).
- Nao adicionar confirmacao na PRIMEIRA emissao (documento ainda
  "rascunho") - so ao GERAR PDF NOVAMENTE de um documento que ja
  esta "emitido"; a primeira emissao nao precisa de confirmacao extra.
- Nao alterar o mecanismo de auditoria (`registrar_auditoria`) ja
  existente no backend para edicao/exclusao de documentos - fora do
  escopo deste pacote, que trata so da UX do frontend.
