# Spec - atendimento-editor-textarea-aria

Data: 2026-08-13
Responsavel: Claude (pareado com Martiniano)
Status: done

## 1) Escopo funcional

O `<textarea>` de `ClinicalFieldCard.tsx` passa a ter nome acessivel
(`aria-labelledby`) ligado ao `<h3>` do titulo do campo. Em
`AtendimentoConsultaEditorSection.tsx`, uma nova regiao `aria-live="polite"`
(visualmente oculta) anuncia o titulo do campo ativo sempre que ele muda,
no modo "um campo por vez". Nenhuma mudanca de backend.

## 2) Requisitos funcionais (RF)

- RF-001: em `ClinicalFieldCard.tsx`, o `<h3>` do titulo recebe
  `id={\`clinical-field-title-${config.key}\`}`.
- RF-002: o `<textarea>` do mesmo card recebe
  `aria-labelledby={titleId}`, referenciando o `id` do RF-001.
- RF-003: em `AtendimentoConsultaEditorSection.tsx`, dentro do bloco
  `!consultaVerTodosCampos`, um novo `<p className="sr-only"
  aria-live="polite">` exibe `Campo ativo: ${consultaCampoAtivoConfig.title}`
  (ou vazio se `consultaCampoAtivoConfig` for nulo).
- RF-004: a regiao do RF-003 nao e renderizada quando
  `consultaVerTodosCampos` e verdadeiro (modo consolidado).

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (sem colisao de id): quando todos os `ClinicalFieldCard` do modo
  consolidado renderizam simultaneamente, cada `id` gerado pelo RF-001 e
  unico (um por `config.key`).
- NFR-002 (sem regressao visual): nenhuma classe Tailwind existente foi
  alterada; a nova regiao `aria-live` usa `sr-only` (visualmente oculta,
  sem impacto de layout).
- NFR-003 (sem mudanca de contrato de props): `ClinicalFieldCardProps` nao
  ganha nenhuma prop nova - `titleId` e calculado internamente a partir de
  `config.key`, ja recebido via `config`.

## 4) Contratos tecnicos

### API

- Nenhuma mudanca.

### Banco/migracoes

- Nenhuma.

### Frontend

- `frontend/app/atendimento/components/ClinicalFieldCard.tsx`: `id` no
  `<h3>`, `aria-labelledby` no `<textarea>` (ver RF-001/RF-002).
- `frontend/app/atendimento/components/AtendimentoConsultaEditorSection.tsx`:
  nova regiao `aria-live` condicional (ver RF-003/RF-004).

## 5) Compatibilidade e rollout

- Backward compatibility: sim - apenas atributos de acessibilidade
  adicionados; nenhum comportamento visual ou de estado muda.
- Estrategia de rollback: reverter o commit. Sem estado persistido no
  backend.

## 6) Criterios de aceitacao (CA)

- CA-001: o `<textarea>` de cada campo clinico tem `aria-labelledby`
  apontando para um `<h3>` existente cujo texto e o titulo do campo (ex.:
  "Queixa principal", "Anamnese dirigida").
- CA-002: no modo "um campo por vez", ao trocar de campo (via botao
  "Proximo campo"/"Campo anterior", clique em um chip, ou atalho de
  teclado), a regiao `aria-live` (className `sr-only`) atualiza seu texto
  para `Campo ativo: <novo titulo>`.
- CA-003: no modo consolidado ("Ver todos os campos"), a regiao
  `aria-live` do CA-002 nao esta presente no DOM.
- CA-004: no modo consolidado, todos os `<textarea>` renderizados tem
  `aria-labelledby` unico, cada um apontando para o `<h3>` correto do seu
  proprio campo (sem colisao de `id`).
- CA-005: `npx tsc --noEmit` e `npm run build` do frontend aprovados sem
  novos erros/warnings.

## 7) Casos de borda

- CB-001: `consultaCampoAtivoConfig` nulo (nenhum campo visivel na etapa) -
  a regiao `aria-live` renderiza texto vazio, sem erro.
- CB-002: troca de etapa (Anamnese e exame / Diagnostico / Plano e retorno)
  reseta o campo ativo para o primeiro da nova etapa (comportamento
  pre-existente) - a regiao `aria-live` acompanha automaticamente, pois
  le `consultaCampoAtivoConfig?.title` a cada render.

## 8) Fora de escopo

- Mudanca no mecanismo de foco automatico via `requestAnimationFrame`
  (pre-existente, nao tocado).
- `aria-live` no modo consolidado.
- Qualquer mudanca visual em `ClinicalFieldCard.tsx`.
