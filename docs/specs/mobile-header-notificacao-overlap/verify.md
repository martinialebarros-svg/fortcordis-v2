# Verify - mobile-header-notificacao-overlap

Data: 2026-08-28
Responsavel: Martiniano + Claude
Status: done

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | Leitura do CSS resultante: `.fc-mobile-header` agora tem `position: relative; z-index: 70`, formando um stacking context posicionado que engloba o `AlertasInternosBell` (dropdown incluso) e o pinta acima de `.fc-reports-header` (`z-index: auto`). Ver `frontend/app/globals.css` (regra `.fc-mobile-header`). | ok |
| CA-002 | aceitacao | `AlertasInternosBell` em telas `lg+` usa `containerClassName="... lg:fixed lg:right-3 lg:top-3"` (`frontend/app/layout-dashboard.tsx:401`) e o proprio `.fc-mobile-header` vira `display: contents` em `lg:contents` (`frontend/app/layout-dashboard.tsx:385`), que ignora `position`/`z-index` do elemento — logo o ajuste so tem efeito abaixo de `lg`. | ok |
| NFR-001 | nao funcional | Mudanca e puramente CSS (uma classe adicionada), sem novos elementos/JS; sem impacto de performance esperado. | ok |

## 2) Testes automatizados executados

Comandos:

```bash
# frontend
npm run lint
```

Resumo dos resultados:
- Backend: nao alterado, nao executado.
- Frontend: `npm run lint` falhou por um problema de configuracao
  pre-existente e nao relacionado a esta mudanca (`ESLint couldn't find an
  eslint.config.(js|mjs|cjs) file` — o repo usa ESLint 10 mas nao tem
  `eslint.config.js`; provavelmente falta migrar de `.eslintrc.*`). `npm run
  build`/`npm run test` nao puderam ser executados porque `node_modules` nao
  esta instalado neste ambiente (sem acesso para rodar `npm install`).
  Nenhum desses problemas foi introduzido por este diff (que altera apenas
  uma regra CSS existente).

## 3) Testes manuais

- Cenario 1: revisão manual do código-fonte comparando a árvore de stacking
  contexts antes/depois (`.fc-mobile-header` sem `position`/`z-index`
  explícitos → conteúdo posterior no DOM com `z-index: auto`, como
  `.fc-reports-header`, pintava por cima; com `relative z-[70]` o cabeçalho
  mobile e tudo que estoura dele, incluindo o dropdown, passam a pintar
  acima).
- Cenario 2: verificação de que nenhum outro elemento com z-index entre 60
  e 70 dependia de ficar acima do header mobile (`fc-sidebar` usa `z-[60]`,
  abaixo do novo valor 70; modal de agendamento usa 80/100/120, acima,
  então não é coberto).
- Cenario 3 (pendente): validação visual em dispositivo/emulador real não
  foi possível neste ambiente (sem `node_modules`/servidor dev disponível).
  Recomendado conferir em stage após deploy, abrindo `/relatorios` no
  celular e testando o sino de alertas.

## 4) Regressao e riscos residuais

- Risco residual 1: validação visual real (screenshot em viewport mobile)
  não foi feita neste ambiente; a confirmação definitiva deve ocorrer em
  stage.
- Risco residual 2: se alguma página futura introduzir um elemento com
  `z-index` explícito maior que 70 no topo do conteúdo mobile, o problema
  pode reaparecer para aquele elemento específico — não há uma escala de
  z-index global no projeto (fora de escopo deste fix).

## 5) Itens fora de escopo entregues

- Nenhum.

## 6) Decisao de release

- [x] Aprovado para stage.
- [ ] Aprovado para producao.
- [ ] Nao aprovado (descrever motivo).
