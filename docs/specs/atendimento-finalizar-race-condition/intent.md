# Intent - atendimento-finalizar-race-condition

Data: 2026-08-07
Responsavel: Claude (Sonnet 5)
Status: done

## 1) Problema atual

`finalizarAtendimento` (`frontend/app/atendimento/page.tsx`) tinha o mesmo
padrao de bug do achado #18 (ja corrigido em
`docs/specs/atendimento-condicoes-corrida-frontend/`), deixado
explicitamente fora de escopo naquele pacote por ser uma funcao
diferente:

1. chama `await saveAtendimento("manual")` (persiste o form);
2. chama `await api.post(".../finalizar", {...})` (uma SEGUNDA chamada de
   rede, separada);
3. ao receber a resposta do `/finalizar`, fazia `setForm(hydrated)` -
   substituicao INCONDICIONAL pelo snapshot devolvido pelo servidor.

Nenhum campo do formulario fica desabilitado durante esses dois
round-trips (mesma characteristica do achado #18). Se o usuario editar
algo entre o `saveAtendimento` resolver e o `/finalizar` responder, essa
edicao e silenciosamente apagada quando `setForm(hydrated)` roda.

## 2) Objetivo

Aplicar o mesmo merge do achado #18 (`mergeAutoSavedFormState`) tambem em
`finalizarAtendimento`, e - agora que
`docs/specs/frontend-infraestrutura-testes/` existe - substituir o padrao
de "prova algoritmica em script `.mjs` externo" por um teste Vitest real,
importando a funcao de merge de produção.

## 3) Nao objetivos

- Nao inclui nova tentativa de confirmacao visual real no navegador -
  mesma limitacao de ambiente documentada em pacotes anteriores desta
  sessao, nao resolvida por este pacote.
- Nao inclui revisitar `executarSaveAtendimento` (achado #18) ou
  `salvarDocumentoClinico`/`criarDocumentoClinicoDeTemplate` (achado #19)
  - ja corrigidos e fora do escopo aqui.
- Nao inclui testar `finalizarAtendimento` via render de componente
  (React Testing Library) - o componente `AtendimentoPage` tem
  dependencias pesadas (chamadas de API no mount, roteador, dezenas de
  hooks) que tornariam esse teste fragil e caro para o que se quer provar
  (a semantica do merge, nao o ciclo de vida do componente). A funcao de
  merge extraida e testada isoladamente e testada tambem no contexto do
  #18 (mesma funcao, ja em produção) - a decisao de escopo foi ganho
  maior com risco/esforco menor.

## 4) Contexto e restricoes

- Restricao tecnica descoberta durante a implementacao: o Next.js App
  Router valida em tempo de type-check (`.next/types/app/atendimento/page.ts`,
  gerado automaticamente) que um arquivo `page.tsx` de rota so pode
  exportar os nomes reservados do framework (`default`, `metadata`,
  `generateStaticParams` etc.) - qualquer export nomeado adicional (ex.:
  `export const mergeAutoSavedFormState`) quebra `tsc --noEmit`/`next
  build` com `TS2344`. Confirmado empiricamente tentando exportar a
  funcao diretamente do `page.tsx` antes de decidir extrair.
- Confirmado tambem, empiricamente, que essa restricao e SOMENTE sobre
  exports de VALOR - `export type X = {...}` (tipo, sem representacao em
  runtime) nao aciona o mesmo erro. Por isso os 3 tipos usados pela logica
  de merge (`AtendimentoForm`, `ExameSolicitacao`, `PrescricaoItem`) foram
  exportados como TIPO do `page.tsx`, e a logica de merge foi movida para
  `frontend/lib/atendimento-form-merge.ts`, que importa esses tipos com
  `import type` (import de tipo, apagado em tempo de compilacao - sem
  dependencia circular em runtime entre os dois arquivos).
- `buildExamMergeKey` tambem e usado em outro lugar do arquivo
  (`resolveExamIdForUpload`, para reencontrar o `id` de um exame recem
  persistido ao fazer upload de resultado) - por isso foi exportado do
  novo modulo tambem, nao só `mergeAutoSavedFormState`.
- Restricoes de prazo: nenhuma.

## 5) Impacto esperado

- Usuarios impactados: veterinarios que editam o atendimento durante os
  ~1-3s de round-trip da finalizacao (rede lenta ou servidor sob carga
  aumentam a janela).
- Modulos impactados: `frontend/app/atendimento/page.tsx`,
  `frontend/lib/atendimento-form-merge.ts` (novo).
- Risco de regressao: baixo - a extracao e mecanica (copia + import, sem
  mudanca de comportamento) e confirmada por `tsc`/`lint`/`build`/suite
  completa do backend (isolamento) permanecerem verdes; o UNICO
  comportamento alterado de verdade e o `setForm` de
  `finalizarAtendimento`, que passa a mesclar em vez de substituir.

## 6) Riscos iniciais

- Risco 1: mover `mergeAutoSavedFormState`/`buildExamMergeKey` para outro
  arquivo poderia introduzir uma dependencia circular em runtime entre
  `lib/atendimento-form-merge.ts` e `app/atendimento/page.tsx`. Mitigado
  por usar exclusivamente `import type` no sentido lib->page (tipos sao
  apagados na compilacao, o import no sentido page->lib e o unico que
  existe em runtime) - confirmado por `npm run build` completar sem erro.
- Risco 2: assim como no achado #18, `lastPersistedSnapshotRef.current`
  precisa continuar sendo o snapshot do servidor (`hydrated`), NAO o
  merge - do contrario a proxima verificacao de autosave nao percebe que
  o form atual (merged) difere do que foi persistido e deixa de agendar
  um novo save capturando a edicao que sobreviveu ao merge. Mitigado
  mantendo essa linha inalterada (so o `setForm` mudou).

## 7) Perguntas abertas

Nenhuma - implementacao concluida e validada localmente.

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
