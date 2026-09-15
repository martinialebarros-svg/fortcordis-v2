# Spec - atendimento-header-fixo

Data: 2026-08-10
Responsavel: Claude (pareado com Martiniano)
Status: em andamento

## 1) Escopo funcional

Mudanca de CSS: tornar `.fc-care-header` `position: sticky` a partir
do breakpoint `xl`, e ajustar os offsets `top`/`max-height` das duas
asides ja sticky da mesma pagina (`.fc-care-sidebar`, `.fc-care-aside`)
para nao ficarem cobertas pelo header fixo.

## 2) Requisitos funcionais (RF)

- RF-1: `.fc-care-header` (`frontend/app/globals.css`) recebe as
  classes `xl:sticky xl:top-0 xl:z-20`, alem das classes existentes.
- RF-2: nenhuma outra regra de `.fc-care-header` (background, border,
  padding, sombra, pseudo-elementos decorativos) e alterada.
- RF-3: o painel lateral `.fc-care-sidebar > div`
  (`frontend/app/atendimento/page.tsx`) tem seu offset `xl:top-6`
  alterado para `xl:top-[500px]`.
- RF-4: a aside `.fc-care-aside` tem seus offsets `xl:top-6`/`xl:top-3`
  alterados para `xl:top-[500px]`/`xl:top-[488px]` (mantendo o offset
  menor para o modo foco de prescricao), e seu
  `xl:max-h-[calc(100vh-2rem)]` recalculado para
  `xl:max-h-[calc(100vh-516px)]`, para continuar cabendo no viewport a
  partir do novo offset.
- RF-5: nenhuma outra mudanca de JSX em `page.tsx` - o header, o
  painel lateral e a aside continuam renderizando o mesmo conteudo de
  antes.

## 3) Requisitos nao funcionais (NFR)

- NFR-A (sem regressao abaixo de xl): em viewports menores que 1280px,
  `.fc-care-header` deve continuar com `position: relative` (como
  hoje) - `getComputedStyle(header).position` deve ser `"relative"`
  abaixo de `xl`.
- NFR-B (z-index seguro): o `z-20` do header deve ficar abaixo de
  elementos que precisam sobrepo-lo quando abertos - a sidebar mobile
  (`z-[60]`), o popup de erro/sucesso fixo no canto (`z-[90]`) e modais
  (`z-[120]+`) continuam visualmente acima do header fixo.
- NFR-C (sem sobreposicao de conteudo): nenhum conteudo da pagina deve
  ficar coberto/inacessivel atras do header fixo - o elemento
  imediatamente abaixo do header (ao rolar) deve continuar clicavel.
- NFR-D (sem sobreposicao entre stickies): o offset `top` do painel
  lateral e da aside deve ser maior que a altura real do header
  (incluindo variacao de conteudo - ex.: rotulo de botao mais longo
  quando ha paciente selecionado), com margem de seguranca - nao um
  valor so ligeiramente maior que a altura observada em um unico
  cenario.

## 4) Contratos tecnicos

Nenhuma migration, nenhum endpoint novo. Mudanca 100% CSS/classes
Tailwind.

## 5) Compatibilidade e rollout

- Backward compatibility: sim - o header so passa a ficar fixo em
  telas largas; nenhum dado ou fluxo muda.
- Rollback: reverter o commit.

## 6) Criterios de aceitacao (CA)

- CA-1: em viewport `xl` (>=1280px), apos rolar a pagina, `.fc-care-header`
  tem `getBoundingClientRect().top === 0` e `position: sticky`.
- CA-2: no mesmo cenario, o botao "Salvar atendimento" dentro do header
  permanece clicavel (o elemento no centro do seu retangulo e o proprio
  botao, nao outro elemento sobreposto).
- CA-3: em viewport abaixo de `xl` (ex.: 1024px), apos rolar,
  `.fc-care-header` tem `position: relative` e sai de vista
  normalmente (comportamento inalterado).
- CA-4: `npx tsc --noEmit` e `npm run build` sem erros novos.
- CA-5: com um atendimento selecionado (paciente_id preenchido, rotulo
  de botao "Novo atendimento deste paciente" - o cenario que mais
  alonga o header), a altura real do header medida via
  `getBoundingClientRect()` deve ser menor que o novo offset `top` do
  painel lateral/aside com folga confortavel - nao so acima do valor
  medido ao vivo (320.5px em viewport 1440px), mas tambem acima do
  pior caso teorico estimado (~416.5px, contabilizando viewport 1280px
  + bloco "Horario da OS" nao verificado ao vivo).
