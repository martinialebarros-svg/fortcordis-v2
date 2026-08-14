# Intent — Agrupar lista de exames por categoria

## Origem

`docs/AUDITORIA-ATENDIMENTO-UX-FLUXO-2026-08-09.md` — achado #14 (dimensão: Fluxo de exames), rastreado em [#33](https://github.com/martiniano-fortcordis/fortcordis-v2/issues/33) (referenciado a partir da issue de rastreamento #57).

**Impacto:** Média · **Esforço:** Médio

## Problema

A lista de exames de um atendimento filtra exclusivamente por status de fluxo (Todos/Sem arquivo/Com arquivo/Interpretados/No portal); não há agrupamento visual por categoria, apesar de cada card já exibir seu chip de categoria individualmente. Em atendimentos com muitos exames (comum em check-up geriátrico, 12-15 exames), localizar "o resultado de ultrassom" exige rolar e ler cada chip de categoria manualmente, um por um.

## Objetivo

Agrupar a lista por categoria (`exame.categoria_exame`) com cabeçalhos de seção sticky, mantendo o filtro de status atual como refinamento **dentro** de cada grupo — ou seja, o filtro continua reduzindo quais exames aparecem; o agrupamento apenas organiza visualmente o que já está filtrado.

## Decisões de design

- **Ordem dos grupos por primeira aparição, não alfabética**: os grupos aparecem na ordem em que suas categorias surgem pela primeira vez na lista de exames (que já vem ordenada por posição de solicitação). Evita reordenar exames que o veterinário já está acostumado a ver em uma ordem específica, e evita introduzir uma noção de "ordem canônica de categorias" que não existe hoje no sistema (não há enum de categorias, `categoria_exame` é texto livre vindo do catálogo).
- **"Sem categoria" como grupo de fallback**: exames sem `categoria_exame` preenchido (incluindo o item em branco inicial de uma receita/exame novo) caem em um grupo "Sem categoria" — garante que nenhum exame fica sem aparecer em algum grupo.
- **Reaproveitamento do corpo do card sem reescrita**: o corpo de renderização de cada card de exame (grande, ~390 linhas de JSX cobrindo upload de anexo, liberação no portal, laudo, histórico de ajustes etc.) foi extraído para uma função local `renderExameCard` dentro de uma IIFE, em vez de reescrito/reindentado. Isso elimina o risco de erro de sintaxe/indentação ao mover um bloco grande de JSX, e seu comportamento interno é idêntico ao anterior — apenas o laço externo que o invoca mudou (de um único `.map()` sobre a lista filtrada para um `.map()` de grupos, cada um mapeando seus próprios itens).
- **`top` do cabeçalho sticky calibrado empiricamente**: o header global fixo do módulo (`.fc-care-header`, já implementado em #20, `xl:sticky xl:top-0`) tem altura variável dependendo do conteúdo (nome do paciente, banner de "registro histórico", etc.). Medido diretamente no preview local em ~320px de altura no estado mais alto observado; o cabeçalho de categoria usa `xl:top-[330px]` (pequena margem de segurança) para não ficar escondido atrás dele. Este valor é uma calibração empírica, não uma garantia matemática para todo estado possível do header — ver limitação em verify.md.

## Fora de escopo

- Mudar o filtro de status em si (continua idêntico, apenas atua como refinamento dentro de cada grupo).
- Tornar a altura do cabeçalho global (`.fc-care-header`) uma variável CSS calculada dinamicamente — resolveria a calibração do `top` de forma mais robusta, mas é um esforço maior e não pedido por esta issue.
- Agrupamento por categoria em outras listas do módulo (documentos, prescrição) — fora do escopo, específico à lista de exames.
