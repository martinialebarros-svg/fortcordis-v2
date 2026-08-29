# Verify - mobile-header-notificacao-overlap

Data: 2026-08-28
Responsavel: Martiniano + Claude
Status: done

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | Leitura do CSS resultante: `.fc-mobile-header` agora tem `position: relative; z-index: 20`, formando um stacking context posicionado que engloba o `AlertasInternosBell` (dropdown incluso) e o pinta acima de `.fc-reports-header` (`z-index: auto`). Ver `frontend/app/globals.css` (regra `.fc-mobile-header`). | ok |
| CA-002 | aceitacao | `AlertasInternosBell` em telas `lg+` usa `containerClassName="... lg:fixed lg:right-3 lg:top-3"` (`frontend/app/layout-dashboard.tsx:401`) e o proprio `.fc-mobile-header` vira `display: contents` em `lg:contents` (`frontend/app/layout-dashboard.tsx:385`), que ignora `position`/`z-index` do elemento — logo o ajuste so tem efeito abaixo de `lg`. | ok |
| CA-003 | aceitacao | Levantamento de todos os overlays `fixed inset-0` (modais em tela cheia) do app: menor valor observado e `z-30` (`frontend/components/portal/PortalClinicaWorkspace.tsx:1568`); demais usam `z-40`/`z-50`/`z-[60]`/`z-[70]`/`z-[120]`/`z-[130]`. Com `.fc-mobile-header` em `z-20` (< 30), todos continuam pintando acima do header/dropdown, como antes da mudanca. | ok |
| NFR-001 | nao funcional | Mudanca e puramente CSS (uma classe adicionada), sem novos elementos/JS; sem impacto de performance esperado. | ok |

## 2) Testes automatizados executados

Comandos:

```bash
# frontend
npm run lint
```

Resumo dos resultados:
- Backend: nao alterado, nao executado.
- Frontend: **nao executado** neste ambiente — `node_modules` nao estava
  instalado (sem acesso para rodar `npm install`), e o `npm run lint` chamou
  um binario global de ESLint 10 do ambiente (`ESLint couldn't find an
  eslint.config.(js|mjs|cjs) file`) em vez do `eslint@^8.57.0` fixado em
  `frontend/package.json`/lockfile, que e compativel com o `.eslintrc`
  existente. Correcao de registro: uma revisao automatizada (Codex,
  comentario no PR #88) confirmou que `npm run lint` roda com sucesso com as
  dependencias do repositorio instaladas — a falha observada aqui e do
  ambiente de execucao, nao da configuracao do repositorio. `npm run
  build`/`npm run test` tambem nao puderam ser executados pelo mesmo motivo
  (`node_modules` ausente). Nenhum desses problemas foi introduzido por este
  diff (que altera apenas uma regra CSS existente).

## 3) Testes manuais

- Cenario 1: revisão manual do código-fonte comparando a árvore de stacking
  contexts antes/depois (`.fc-mobile-header` sem `position`/`z-index`
  explícitos → conteúdo posterior no DOM com `z-index: auto`, como
  `.fc-reports-header`, pintava por cima; com `relative z-20` o cabeçalho
  mobile e tudo que estoura dele, incluindo o dropdown, passam a pintar
  acima).
- Cenario 2 (revisado): a primeira versão deste fix usava `z-[70]` e só
  havia sido conferida contra a sidebar (`z-[60]`). Uma revisão automatizada
  (Codex, comentário no PR #87) apontou que `z-70` ficava **acima** de vários
  modais em tela cheia do app que usam `z-30`/`z-40`/`z-50`/`z-[60]` (ex.:
  `frontend/app/financeiro/page.tsx:3360`, submodais de
  `frontend/app/agenda/NovoAgendamentoModal.tsx`, portal da clínica em
  `frontend/components/portal/PortalClinicaWorkspace.tsx:1568`), o que faria
  o header mobile e o dropdown de alertas cobrirem modais abertos — uma
  regressão real. Corrigido reduzindo o header para `z-20`, valor abaixo do
  menor overlay de modal em tela cheia do app (`z-30`) e ainda acima do
  conteúdo comum (`z-index: auto`).
- Cenario 3 (pendente): validação visual em dispositivo/emulador real não
  foi possível neste ambiente (sem `node_modules`/servidor dev disponível).
  Recomendado conferir em stage após deploy: (a) abrir `/relatorios` no
  celular e testar o sino de alertas; (b) abrir um modal em tela cheia
  (ex.: financeiro) no celular e confirmar que ele ainda cobre o header.

## 4) Regressao e riscos residuais

- Risco residual 1: validação visual real (screenshot em viewport mobile)
  não foi feita neste ambiente; a confirmação definitiva deve ocorrer em
  stage.
- Risco residual 2: se alguma página futura introduzir um overlay de
  conteúdo comum (não-modal) com `z-index` explícito entre 21 e 29 no topo
  do mobile, ele ficaria coberto pelo header — não há uma escala de z-index
  global no projeto (fora de escopo deste fix).

## 5) Itens fora de escopo entregues

- Nenhum.

## 6) Decisao de release

- [x] Aprovado para stage.
- [ ] Aprovado para producao.
- [ ] Nao aprovado (descrever motivo).
