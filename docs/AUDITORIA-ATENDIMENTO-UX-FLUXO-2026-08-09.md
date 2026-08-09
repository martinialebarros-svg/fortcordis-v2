# Auditoria de UX e Fluxo de Trabalho - Módulo de Atendimento Clínico (2026-08-09)

> **Origem:** auditoria multi-agente com 7 dimensões de UX/fluxo de trabalho, cada uma investigada por um agente independente e depois submetida a um segundo agente instruído a verificá-la adversarialmente (reler o código atual e tentar refutar o achado antes de confirmá-lo).

> **Escopo:** exclusivamente UI e fluxo de trabalho (navegação, carga cognitiva, descobribilidade, consistência visual, feedback ao usuário, estados vazios/carregamento, acessibilidade, responsividade) e sugestões funcionais de melhoria do módulo como produto. Bugs de integridade de dados clínicos, race conditions de rede/concorrência, segurança (IDOR/SSRF/autorização) e performance de query/N+1 estão **fora de escopo** — já cobertos em `docs/AUDITORIA-ATENDIMENTO-ACHADOS-2026-08-04.md` (29 achados verificados).

> **Data:** 2026-08-09.

> **Resumo:** 37 achados levantados, todos submetidos a verificação adversarial — 36 confirmados sem alteração de mérito e 1 confirmado parcialmente (texto ajustado na verificação). Nenhum achado foi descartado nesta rodada. Quebra por impacto: 14 ALTA, 20 MÉDIA, 3 BAIXA.

## Índice

1. [Resumo executivo](#resumo-executivo)
2. [Navegação, arquitetura de informação e header](#1-navegação-arquitetura-de-informação-e-header)
3. [Entrada de dados clínicos](#2-entrada-de-dados-clínicos-editor-guiado-triagem-cadastro-complementar)
4. [Fluxo de exames](#3-fluxo-de-exames)
5. [Fluxo de prescrição](#4-fluxo-de-prescrição)
6. [Documentos clínicos e templates](#5-documentos-clínicos-e-templates)
7. [Lista de atendimentos e histórico/timeline do paciente](#6-lista-de-atendimentos-busca-filtros-e-históricotimeline-do-paciente)
8. [Feedback, estados vazios/carregamento, acessibilidade e responsividade](#7-feedback-visual-estados-de-carregamentovazio-confirmações-acessibilidade-e-responsividade)
9. [Priorização sugerida](#priorização-sugerida)
10. [O que já está bom / não entrou no relatório](#o-que-já-está-bom--não-entrou-no-relatório)

---

## Resumo executivo

A auditoria confirmou 37 oportunidades de melhoria de UX/fluxo no módulo de Atendimento Clínico, distribuídas em 7 dimensões. Todas sobreviveram à verificação adversarial (releitura de código, checagem contra specs já "done", checagem de escopo) — 36 sem alteração de mérito, 1 com o texto ajustado para maior precisão. Isso é um sinal de que o módulo, apesar de já ter passado por várias rodadas de correção focadas em dados/segurança/performance, ainda tem uma superfície de UX genuína e concreta a melhorar, distinta do que já foi tratado.

| Impacto | Quantidade |
|---|---|
| Alta | 14 |
| Média | 20 |
| Baixa | 3 |
| **Total** | **37** |

Padrões transversais que aparecem repetidas vezes entre os achados:

1. **Dado já calculado, nunca exibido.** Vários pontos do sistema já computam a informação certa internamente, mas a UI não a exibe: o badge das abas mostra contagem bruta em vez de pendências reais (`prescricaoErrosCount`, granularidade de status de exame já existem), o resumo de exames omite o tile "No portal" (`resumoExamesFluxo.liberado_portal` já é calculado), o card da lista de atendimentos não mostra `clinica_nome` (já retornado pela API), e a "cobertura do prontuário" no editor usa um critério de completude divergente do que o backend realmente exige para concluir. Em todos os casos, o esforço de implementação é pequeno porque o dado já existe — falta só ligá-lo à UI.
2. **Estado clinicamente crítico escondido por padrão.** A triagem vem recolhida por padrão sem destacar sinais vitais fora da faixa normal, e o radar de alertas clínicos (alergias/condições crônicas) desaparece justamente na aba de Prescrição — o momento de maior risco de erro médico do fluxo.
3. **Confirmações e ações destrutivas sem gradação de risco.** Dez pontos do módulo usam `window.confirm` nativo indiferenciado para ações tão distintas quanto "substituir rascunho" e "excluir atendimento", enquanto na outra ponta os protocolos de prescrição inserem 2-3 medicamentos instantaneamente ao clicar, sem prévia nem confirmação — o padrão de fricção para confirmar uma ação está desalinhado com o risco real de cada ação.
4. **Ações que alteram estado sem feedback visível.** "Salvar fórmula na biblioteca" na aba Prescrição, abrir um atendimento do histórico, e o loading inicial do módulo todos deixam o usuário sem sinal de que algo está acontecendo — um padrão já resolvido em outras ações do mesmo arquivo (toast, `Loader2`) mas não replicado nesses pontos.
5. **Densidade de informação pensada para desktop grande.** O header não é `sticky`, e o layout de 3 colunas só se ativa a partir de 1280px — abaixo disso o vet rola por ~270 linhas de painel de casos antes de chegar ao editor clínico. Notebooks menores e janelas não maximizadas, comuns em consultório, ficam mal servidos.

---

## 1. Navegação, arquitetura de informação e header

### 1. [ALTA] Header do prontuário não é fixo: identificação do paciente e ações primárias desaparecem ao rolar

**Arquivos:** `frontend/app/atendimento/page.tsx` (seção `fc-care-header`, linhas 6168-6280), `frontend/app/globals.css` (`.fc-care-header`, linhas 6678-6681)

**Comportamento atual:** `.fc-care-header` — que contém a `fc-care-patient-strip` (nome do paciente/tutor/peso/alertas) e os botões "Novo atendimento", "Laudar", "Salvar atendimento" e "Finalizar atendimento" — é uma `<section>` comum, sem `position: sticky`. Só o painel lateral (`fc-care-aside`/`fc-care-sidebar`) tem `xl:sticky`; o header, a navegação por abas e todo o conteúdo de trabalho rolam junto com a página.

**Fricção:** ao trabalhar na aba Exames, Prescrição ou no editor clínico guiado, o veterinário rola a página para baixo e perde de vista qual paciente/tutor está editando e os únicos botões "Salvar atendimento"/"Finalizar atendimento" da tela — precisa rolar de volta ao topo para salvar ou finalizar.

**Sugestão:** tornar `.fc-care-header` (ou ao menos a faixa de paciente + os botões Salvar/Finalizar) `sticky top-0` com fundo opaco, ou extrair uma barra de contexto compacta que fica fixa ao rolar.

**Esforço estimado:** pequeno

### 2. [ALTA] Badges das abas mostram contagem bruta, não pendências, apesar do app já rastrear status granular

**Arquivos:** `frontend/app/atendimento/page.tsx` (`workspaceCards`, linhas 5407-5431; `EXAME_STATUS_META`, linhas 565-580; `prescricaoErrosCount`, linha 2403; `EXAME_FILTRO_OPCOES`, linhas 558-563)

**Comportamento atual:** o badge de cada aba é uma contagem simples — Exames mostra o total solicitado, Prescrição mostra o total de itens — sem usar a granularidade de status por exame (`aguardando_arquivo`/`interpretado`/`liberado_portal`) nem o contador de erros de validação da prescrição, ambos já calculados internamente e usados em outros componentes.

**Fricção:** o vet vê "Exames: 3" no menu superior sem saber se os 3 já foram resolvidos ou ainda estão pendentes, ou se a prescrição tem itens com erro bloqueando a impressão — só descobre entrando na aba.

**Sugestão:** diferenciar visualmente o badge quando há pendência real (cor de alerta na aba Exames quando há itens `aguardando_arquivo`/`interpretado` > 0; cor de alerta na aba Prescrição quando `prescricaoErrosCount > 0`), reaproveitando os dados já calculados.

**Esforço estimado:** pequeno

### 3. [MÉDIA] CTA "Novo atendimento deste paciente" duplicado simultaneamente na tela

**Arquivos:** `frontend/app/atendimento/page.tsx` (linhas 6192-6200 e 6283-6301)

**Comportamento atual:** quando um registro histórico está selecionado, o header renderiza o botão "Novo atendimento deste paciente" e, imediatamente abaixo, o banner de "Registro histórico #{selecionado}" renderiza outro botão com o mesmo texto — ambos chamando exatamente `iniciarNovoAtendimentoPaciente()`. Como um atendimento persistido selecionado normalmente já implica `form.paciente_id` preenchido, os dois botões coexistem na prática, não só em um caso de borda raro.

**Fricção:** o usuário vê dois botões idênticos em estilos visuais diferentes fazendo a mesma coisa a poucos centímetros um do outro, gerando dúvida sobre se são ações diferentes e poluição visual no topo da tela.

**Sugestão:** remover o botão do header quando o banner âmbar de "Registro histórico" já está visível, mantendo a ação em um único lugar (preferencialmente no banner, que já explica o motivo).

**Esforço estimado:** pequeno

### 4. [MÉDIA] Duas interfaces de navegação/progresso redundantes e com semânticas diferentes para as mesmas áreas

**Arquivos:** `frontend/app/atendimento/page.tsx` (`fluxoClinico`, linhas 5377-5402; `workspaceCards`, linhas 5407-5431; `fc-care-tabs`, linhas 6341-6362), `frontend/app/atendimento/components/AtendimentoConsultaOverviewSection.tsx` (seção "Jornada do atendimento", linhas 216-251)

**Comportamento atual:** existem duas listas paralelas navegando entre as mesmas áreas clínicas: as abas do topo (Consulta/Exames/Prescrição/Documentos) e o cartão "Jornada do atendimento" dentro da própria aba Consulta (Triagem/Consulta/Exames/Prescrição). As duas têm 4 itens, mas cobertura diferente (uma tem Triagem, a outra tem Documentos), e os critérios de "completo" divergem entre elas (ex.: "Exames" é booleano num lado e contagem/percentual no outro).

**Fricção:** o usuário aprende dois sistemas de "progresso do atendimento" com nomenclatura e cobertura diferentes navegando para os mesmos lugares — redundância de arquitetura de informação que aumenta a carga cognitiva sem agregar informação nova.

**Sugestão:** eliminar o card "Jornada do atendimento" (ou torná-lo somente-leitura, sem função de navegação duplicada) e, se necessário, incorporar o sinal de status da Triagem como selo dentro da própria aba "Consulta" no menu superior — mantendo uma única fonte de verdade sobre navegação.

**Esforço estimado:** médio

### 5. [MÉDIA] "Bibliotecas clínicas" não preserva a aba de trabalho anterior ao voltar

**Arquivos:** `frontend/app/atendimento/page.tsx` (`fc-care-navigation`, linhas 6308-6363; `showCaseSidebar`, linha 5438), `frontend/app/atendimento/components/AtendimentoBibliotecasSection.tsx` (linhas 55-91)

**Comportamento atual:** o botão "Bibliotecas clínicas" é um pill de navegação secundária (mesmo estilo do botão "Casos recentes", mais leve que os 4 cartões-aba), que recebe destaque visual próprio quando ativo. Ao clicar, nenhuma das 4 abas do prontuário (Consulta/Exames/Prescrição/Documentos) fica marcada como ativa e o painel lateral de casos é ocultado — o header com paciente/tutor/peso/alertas continua visível normalmente. `workspacePainel` é um único estado sem memória da aba de trabalho anterior.

**Fricção:** ao voltar de "Bibliotecas clínicas" para o prontuário, o usuário perde a noção de qual aba (Consulta/Exames/Prescrição/Documentos) estava usando antes e precisa clicar de novo na aba desejada.

**Sugestão:** mover "Bibliotecas clínicas" para fora da faixa de navegação do atendimento (menu global ou modal/drawer que preserva a aba ativa por trás), ou fazer o componente lembrar a última aba de trabalho para restaurá-la ao fechar Bibliotecas.

**Esforço estimado:** médio

### 6. [BAIXA] Botão "Laudar" tem a mesma aparência de ação-no-registro que "Salvar"/"Finalizar", mas na verdade navega para outro módulo

**Arquivos:** `frontend/app/atendimento/page.tsx` (`goLaudo`, linhas 4264-4272; botões do header, linhas 6201-6220), `frontend/app/globals.css` (linhas 6734-6755)

**Comportamento atual:** os botões "Laudar", "Salvar atendimento" e "Novo atendimento" compartilham a mesma classe visual base (tamanho, padding, borda, tipografia), diferindo só na cor de destaque. Porém "Laudar" executa `router.push('/laudos/novo?...')` — sai completamente da tela de Atendimento — enquanto os outros atuam sobre o registro atual sem navegar. Nenhum ícone ou separador comunica essa diferença.

**Fricção:** o vet pode clicar em "Laudar" esperando um efeito local e se surpreender ao ser levado para outra rota, especialmente com texto ainda não salvo na etapa clínica em edição.

**Sugestão:** separar visualmente "Laudar" das ações que operam sobre o atendimento atual, com um divisor sutil e/ou ícone de link externo (ex. `ArrowUpRight`).

**Esforço estimado:** pequeno

---

## 2. Entrada de dados clínicos: editor guiado, triagem, cadastro complementar

### 7. [ALTA] Editor guiado não tem modo de revisão consolidada dos 11 campos

**Arquivos:** `frontend/app/atendimento/components/AtendimentoConsultaEditorSection.tsx`, `frontend/app/atendimento/components/ClinicalFieldCard.tsx`, `frontend/lib/atendimento-clinical-notes.ts`

**Comportamento atual:** o editor mostra exatamente um `ClinicalFieldCard` por vez, navegado por botões/atalhos. Os "chips" dos campos da etapa só mostram título + badge "Concluído"/"Em aberto", nunca o conteúdo. O único resumo textual (`buildClinicalQuickSummary`) é truncado a 170 caracteres por destaque e o JSX que o exibe corta para no máximo 4 dos 11 campos, sempre somente leitura.

**Fricção:** para revisar o prontuário inteiro antes de salvar/concluir (ex.: reler anamnese + diagnóstico + plano juntos para checar coerência clínica), o veterinário precisa navegar campo a campo — até 11 cliques/atalhos — porque não existe nenhuma tela ou toggle que renderize os 11 campos simultaneamente.

**Sugestão:** adicionar um toggle "Ver todos os campos" que alterna entre o modo atual (1 campo por vez, focado para digitação) e uma lista vertical com todos os `ClinicalFieldCard` da etapa abertos simultaneamente, reaproveitando o mesmo componente — sem nova lógica de dados, só um modo de layout.

**Esforço estimado:** médio

### 8. [ALTA] "Cobertura do prontuário" e lista de pendências do editor não refletem o critério real de conclusão do backend

**Arquivos:** `frontend/lib/atendimento-clinical-notes.ts`, `frontend/app/atendimento/components/AtendimentoConsultaEditorSection.tsx`, `frontend/app/atendimento/page.tsx`, `backend/app/api/v1/endpoints/atendimento.py`

**Comportamento atual:** `buildClinicalQuickSummary` calcula `completeness` como `preenchidos / 11`, exigindo todos os 11 campos (incluindo diagnóstico secundário/diferencial, motivo do retorno, observações). Já a barreira real de conclusão no backend (`_calcular_pendencias_documentacao`) usa lógica OR em 3 grupos — queixa principal + 1 de (anamnese/exame físico/dados clínicos) + 1 de (diagnóstico/plano) — e nunca exige retorno recomendado nem prognóstico. O spec já "done" `atendimento-pendencias-filtro` levou esse critério real apenas para o card da listagem de atendimentos, não para o painel de "Cobertura do prontuário" dentro do próprio editor, que continua usando só o cálculo do frontend.

**Fricção:** um atendimento que já satisfaz tudo que o backend pede para concluir pode aparecer no editor como "em abertura" com 45-60% de cobertura, porque campos genuinamente opcionais entram no mesmo denominador que os campos realmente bloqueantes — o vet preenche campos não-obrigatórios só para "fechar a barra", ou fica em dúvida se pode concluir.

**Sugestão:** separar visualmente "campos obrigatórios para concluir" (usando a mesma lógica OR do backend) de "campos complementares recomendados", com duas métricas distintas em vez de uma única % de conclusão.

**Esforço estimado:** pequeno

### 9. [ALTA] Triagem vem recolhida por padrão e o resumo colapsado não destaca sinais vitais fora da faixa normal

**Arquivos:** `frontend/app/atendimento/components/AtendimentoTriagemSection.tsx`, `frontend/app/atendimento/page.tsx`

**Comportamento atual:** `triagemExpandida` inicia em `false` e nenhum dos pontos que o alteram no código o força para `true` automaticamente. Quando recolhida, o resumo é uma linha de texto neutro fixo, sem cor condicional. Mesmo expandida, os inputs de temperatura/FC/FR/SpO2/PA não têm faixa de referência aplicada — qualquer valor usa o mesmo estilo visual.

**Fricção:** um vet que reabre um atendimento (ex.: retomando após interrupção, ou iniciado por um técnico) vê a triagem fechada com um resumo neutro mesmo havendo um valor claramente anormal (ex.: FC 220 bpm), sem nenhum sinal visual que force atenção antes de seguir para consulta/diagnóstico.

**Sugestão:** aplicar faixas de referência básicas por espécie com cor de alerta (âmbar/vermelho) no resumo colapsado e nos próprios inputs quando o valor estiver fora da faixa; considerar expandir `triagemExpandida` automaticamente quando o atendimento carregado já tiver algum valor fora do range.

**Esforço estimado:** pequeno

### 10. [MÉDIA] Biblioteca de frases rápidas fica isolada da tela onde é usada

**Arquivos:** `frontend/app/atendimento/components/ClinicalFieldCard.tsx`, `frontend/app/atendimento/components/AtendimentoBibliotecasSection.tsx`, `frontend/app/atendimento/page.tsx`

**Comportamento atual:** `ClinicalFieldCard` só oferece ações para inserir frases/roteiros já existentes; não há nenhuma ação para capturar o texto digitado e salvá-lo como frase nova. Criar/editar uma frase só é possível na aba separada "Bibliotecas clínicas", onde o vet escolhe manualmente a seção e redigita o texto.

**Fricção:** quando o vet percebe que uma frase que acabou de escrever seria útil como atalho reutilizável, precisa sair da consulta em andamento, abrir Bibliotecas, selecionar a seção certa, copiar/colar o texto e voltar — perdendo o contexto do atendimento. Isso desincentiva a manutenção do banco de frases, que é justamente o que torna o editor de campo único mais rápido no dia a dia.

**Sugestão:** adicionar um botão "Salvar como frase rápida" ao lado de "Limpar" em `ClinicalFieldCard`, com um mini-formulário inline (só título) que envie a `secao` = campo atual e `texto` = conteúdo atual, sem sair da aba Consulta.

**Esforço estimado:** médio

### 11. [MÉDIA] Textarea do editor clínico sem label programático e sem anúncio de troca de campo

**Arquivos:** `frontend/app/atendimento/components/ClinicalFieldCard.tsx`, `frontend/app/atendimento/components/AtendimentoConsultaEditorSection.tsx`

**Comportamento atual:** o título do campo é um `<h3>` sem `id`, e o `<textarea>` não tem `aria-label` nem `aria-labelledby` — a única pista textual acessível é o `placeholder`, que desaparece ao digitar. A troca de campo ativo via atalho de teclado move o foco via `requestAnimationFrame`, mas não existe região `aria-live` anunciando qual campo passou a estar ativo.

**Fricção:** um usuário de leitor de tela ouve apenas "caixa de edição" ao entrar em cada campo, sem saber se está em "Anamnese" ou "Plano terapêutico"; ao usar os atalhos de navegação entre campos, não há confirmação sonora de qual campo passou a ter foco — tornando o fluxo de 11 campos pouco acessível sem depender só da leitura visual.

**Sugestão:** dar um `id` ao `<h3>` do título e ligar via `aria-labelledby` no `<textarea>` (ou usar `aria-label={config.title}` diretamente); adicionar uma região `aria-live="polite"` que anuncie o título do campo ativo quando ele muda.

**Esforço estimado:** pequeno

---

## 3. Fluxo de exames

### 12. [ALTA] Botão "Liberar no portal" fica ao lado do botão "Excluir", ambos do mesmo tamanho e estilo

**Arquivos:** `frontend/app/atendimento/components/AtendimentoExamesSection.tsx`

**Comportamento atual:** no header de cada card de exame, os botões "Laudar", "Liberar no portal"/"Revogar portal" e "Excluir" ficam no mesmo grupo flex, com o mesmo tamanho/padding, diferenciados só pela cor de fundo — todos adjacentes, sem divisor.

**Fricção:** numa lista com vários exames, ao clicar em sequência em "Liberar no portal" de vários cards (fluxo comum), o botão "Excluir" está a poucos pixels de distância e tem o mesmo alvo de clique — um clique levemente deslocado remove o exame do prontuário em vez de liberar/revogar o portal. Mais provável em telas menores, onde o `flex-wrap` pode reordenar os botões entre renders.

**Sugestão:** isolar visualmente a ação destrutiva (menu secundário/"mais opções", ou posicionamento no canto oposto do card) e/ou aumentar o espaçamento com um divisor antes do botão vermelho, mantendo-o sempre por último.

**Esforço estimado:** pequeno

### 13. [MÉDIA] Nenhum indicador de que a clínica parceira já visualizou o exame liberado

**Arquivos:** `frontend/app/atendimento/components/AtendimentoExamesSection.tsx`, `frontend/app/atendimento/page.tsx`

**Comportamento atual:** o estado de portal é estritamente binário (liberado/não liberado); não existe nenhum campo ou timestamp de "visualizado pela clínica" em nenhum ponto do módulo ou do fluxo de autorização do portal.

**Fricção:** o veterinário libera o resultado e não tem como saber, dentro do próprio atendimento, se a clínica parceira já abriu o exame — precisa confirmar por telefone/WhatsApp, especialmente em casos urgentes (ex. exame de imagem para segunda opinião).

**Sugestão:** adicionar um selo discreto no chip/botão de portal (ex. "Liberado · ainda não visto" vs "Liberado · visto em dd/mm hh:mm") alimentado por um evento simples de primeiro acesso no endpoint do portal.

**Esforço estimado:** médio

### 14. [MÉDIA] Lista de exames longa não tem agrupamento por categoria, só filtro por status de fluxo

**Arquivos:** `frontend/app/atendimento/components/AtendimentoExamesSection.tsx`, `frontend/app/atendimento/page.tsx`

**Comportamento atual:** a lista filtra exclusivamente por status de fluxo (`aguardando_arquivo`/`arquivo_anexado`/`interpretado`/`liberado_portal`); não há filtro ou agrupamento por categoria de exame, mesmo cada card já exibindo seu chip de categoria individualmente.

**Fricção:** em atendimentos com 12-15 exames (comum em check-up geriátrico com hemograma + bioquímico + imagem + urinálise), achar "o resultado de ultrassom" exige rolar e ler cada chip de categoria manualmente, um por um.

**Sugestão:** agrupar a lista por categoria com cabeçalhos de seção sticky, mantendo o filtro de status atual como refinamento dentro de cada grupo; alternativamente, adicionar um segundo controle de filtro por categoria.

**Esforço estimado:** médio

### 15. [MÉDIA] Adicionar exame do catálogo exige digitar toda vez — sem favoritos, mais usados ou lista padrão visível

**Arquivos:** `frontend/app/atendimento/components/AtendimentoExamesSection.tsx`, `frontend/app/atendimento/page.tsx`

**Comportamento atual:** o cálculo de top-8 exames padrão do catálogo já existe no código (quando a busca está vazia), mas a condição de render do dropdown exige texto digitado — a lista padrão nunca chega a ser exibida.

**Fricção:** mesmo para o exame mais solicitado da clínica, o veterinário precisa digitar ao menos uma letra antes de qualquer sugestão aparecer — repetindo o mesmo esforço de digitação mesmo quando o padrão da clínica é sempre o mesmo conjunto de exames.

**Sugestão:** exibir as sugestões padrão/top-8 ao focar o campo vazio, idealmente ordenadas por frequência de uso recente da clínica e rotuladas como "Mais usados".

**Esforço estimado:** médio

### 16. [MÉDIA] Zona de drag-and-drop só aparece depois de expandir o card do exame

**Arquivos:** `frontend/app/atendimento/components/AtendimentoExamesSection.tsx`

**Comportamento atual:** o bloco de upload (dropzone) só existe no DOM quando o card do exame está expandido; por padrão só o primeiro exame da lista vem expandido.

**Fricção:** quando o laboratório manda vários PDFs de uma vez (hemograma, bioquímico, urinálise, ultrassom), o vet precisa expandir card por card manualmente antes de poder soltar cada arquivo, em vez de simplesmente arrastar sobre o card colapsado.

**Sugestão:** permitir soltar o arquivo diretamente sobre o card colapsado (usando o próprio card como dropzone com feedback visual), expandindo automaticamente ao detectar `dragenter`.

**Esforço estimado:** médio

### 17. [BAIXA] Painel-resumo de exames não mostra a contagem de "Liberado no portal", apesar de existir como filtro e como status

**Arquivos:** `frontend/app/atendimento/components/AtendimentoExamesSection.tsx`, `frontend/app/atendimento/page.tsx`

**Comportamento atual:** o grid de resumo mostra só 4 tiles fixos (Solicitados/Sem arquivo/Com arquivo/Interpretados); `resumoExamesFluxo.liberado_portal` já é calculado e o filtro rápido "No portal" já existe, mas o número nunca é exibido no resumo.

**Fricção:** para saber quantos exames já foram liberados no portal, o vet precisa clicar no filtro e contar os cards manualmente, mesmo o dashboard existindo justamente para dar essa visão rápida.

**Sugestão:** adicionar um 5º tile "No portal" reaproveitando o dado já calculado, ajustando o grid para acomodá-lo.

**Esforço estimado:** pequeno

---

## 4. Fluxo de prescrição

### 18. [ALTA] Protocolos clínicos são aplicados instantaneamente, sem prévia e sem revelar por que foram sugeridos

**Arquivos:** `frontend/app/atendimento/components/AtendimentoPrescricaoWorkspace.tsx`, `frontend/app/atendimento/page.tsx`, `frontend/lib/atendimento-prescricao-protocolos.ts`

**Comportamento atual:** os protocolos usam gatilhos (palavras-chave) comparados ao texto do diagnóstico, mas nenhuma keyword aparece na tela — o card só mostra rótulo e descrição genérica. Ao clicar em qualquer protocolo, os itens são inseridos e as orientações concatenadas de forma síncrona e imediata, sem modal de confirmação nem prévia do que será adicionado.

**Fricção:** um clique injeta 2-3 medicamentos com dose e frequência prontos; o vet só percebe um clique equivocado ao rolar a lista de itens e remover cada um manualmente. Como o card não diz qual termo do diagnóstico disparou a sugestão, também não há como avaliar a pertinência antes de aceitar.

**Sugestão:** exibir no card qual gatilho casou com o diagnóstico (ex.: "sugerido porque o diagnóstico contém 'ICC'") e substituir a aplicação direta por uma prévia dos itens/orientações a inserir, com botões explícitos "Aplicar"/"Descartar".

**Esforço estimado:** médio

### 19. [ALTA] "Salvar fórmula na biblioteca" não dá nenhum feedback visível na aba Prescrição

**Arquivos:** `frontend/app/atendimento/page.tsx`

**Comportamento atual:** o botão executa `duplicarMedicamentoManipulado`, que apenas abre o banco de medicamentos internamente e preenche o formulário — sem trocar de aba (`setWorkspacePainel`) e sem toast (`setSucesso("")` limpa, em vez de mostrar, uma mensagem). Como o banco só é renderizado na aba "Bibliotecas clínicas", nada muda visualmente enquanto o vet permanece em "Prescrição".

**Fricção:** o vet clica esperando confirmação, nada acontece na tela, e assume que a ação falhou — podendo clicar de novo sem efeito adicional perceptível — até descobrir por conta própria que precisa abrir manualmente "Bibliotecas clínicas" para ver o formulário pré-preenchido.

**Sugestão:** fazer a função também trocar para a aba Bibliotecas (`setWorkspacePainel("bibliotecas")`) e exibir um toast do tipo "Fórmula pronta para revisão em Bibliotecas clínicas".

**Esforço estimado:** pequeno

### 20. [MÉDIA] Nenhuma forma de reordenar ou duplicar itens de uma receita longa

**Arquivos:** `frontend/app/atendimento/page.tsx`, `frontend/app/atendimento/components/AtendimentoPrescricaoWorkspace.tsx`

**Comportamento atual:** cada item de prescrição só tem a ação "Remover"; não existe nenhuma função de mover item para cima/baixo nem de duplicar um item já preenchido dentro da mesma receita.

**Fricção:** numa receita com vários itens (comum após aplicar um protocolo e ainda somar itens manuais), priorizar visualmente um medicamento crítico ou duplicar uma fórmula parecida trocando só dose/horário exige apagar e redigitar tudo do zero.

**Sugestão:** adicionar no cabeçalho do card botões de mover para cima/baixo (ou drag handle) e "duplicar item", ao lado do "Remover" já existente.

**Esforço estimado:** médio

### 21. [MÉDIA] Editar o medicamento de um item existente usa select nativo sem busca, inconsistente com a busca fuzzy do fluxo de adição

**Arquivos:** `frontend/app/atendimento/page.tsx`, `frontend/app/atendimento/components/AtendimentoPrescricaoWorkspace.tsx`

**Comportamento atual:** adicionar um item novo usa busca fuzzy (Fuse.js, por nome/princípio ativo/classe); trocar o medicamento de um item já existente na receita usa um `<select>` HTML nativo que lista todos os medicamentos sem qualquer filtro.

**Fricção:** com uma biblioteca de medicamentos grande, corrigir o medicamento de um item já criado é mais lento (rolagem de lista nativa) e inconsistente com a experiência rápida de adicionar um item do zero.

**Sugestão:** reaproveitar o mesmo componente/lógica de busca fuzzy como combobox dentro do card do item, no lugar do `<select>` nativo.

**Esforço estimado:** médio

### 22. [MÉDIA] Preview de PDF em iframe de altura fixa, sem opção de abrir/baixar em caso de falha de renderização

**Arquivos:** `frontend/app/atendimento/components/AtendimentoPrescricaoPreview.tsx`, `frontend/app/atendimento/page.tsx`

**Comportamento atual:** o preview é um `<iframe>` com altura fixa (500px) recebendo uma data URL base64; o único controle de recuperação é "Tentar novamente", exibido apenas em erro de geração — não há botão de "abrir em nova aba" no próprio painel de preview.

**Fricção:** em telas pequenas, os 500px fixos competem por espaço com a rolagem da página; se o navegador não renderizar bem o `data:` URI embutido, a única saída é "Baixar PDF" na aside, que fica fora da área visível quando a lateral empilha em telas menores.

**Sugestão:** adicionar no cabeçalho do painel de preview um botão "Abrir em nova aba" reaproveitando o mesmo base64, e trocar a altura fixa por algo flexível para telas pequenas.

**Esforço estimado:** pequeno

---

## 5. Documentos clínicos e templates

### 23. [ALTA] Variáveis `{{chave}}` não resolvidas ou vazias ficam indistinguíveis do texto normal

**Arquivos:** `backend/app/services/atendimento/document_context_service.py` (`renderizar_template_documento`, `montar_contexto_template_documento`), `frontend/app/atendimento/components/AtendimentoDocumentosSection.tsx`

**Comportamento atual:** `renderizar_template_documento` deixa `{{chave}}` literal no texto quando a chave não existe no contexto, e várias chaves do contexto (peso, nome do tutor, raça, idade etc.) resolvem para string vazia quando o dado não existe no cadastro. O editor é um `<textarea>` plano exibindo o corpo já mesclado, sem qualquer marcação visual distinguindo "preenchido pelo sistema", "vazio por falta de dado" ou "placeholder não reconhecido".

**Fricção:** o veterinário gera um atestado a partir de template e o PDF pode sair com uma lacuna silenciosa (ex.: "Peso: kg" sem número) ou com um `{{crmv}}` literal aparecendo no documento impresso, porque nada na tela chamou atenção para revisar esse trecho antes de baixar o PDF.

**Sugestão:** destacar (ex.: `<mark>` com fundo amarelo, ou um contador "N campos precisam de atenção") qualquer `{{...}}` remanescente e, quando possível, os trechos vazios vindos do contexto, antes de habilitar "Gerar PDF".

**Esforço estimado:** médio

### 24. [ALTA] Documento "emitido" continua totalmente editável sem nenhum aviso do que isso significa

**Arquivos:** `frontend/app/atendimento/components/AtendimentoDocumentosSection.tsx`, `frontend/app/atendimento/page.tsx` (`baixarPdfDocumentoClinico`, `salvarDocumentoClinico`)

**Comportamento atual:** ao gerar o PDF, o front marca localmente `status: "emitido"`, exibido como texto cinza pequeno na lista, mas o textarea do corpo e o campo título permanecem editáveis exatamente como um rascunho — sem `readOnly`, badge de cor distinta ou confirmação. O spec já "done" `atendimento-documentos-auditoria` resolveu a trilha de auditoria no backend para esse cenário, mas seu próprio spec documenta explicitamente "nenhuma alteração de frontend" — o gap de UX (aviso/lock visual) permanece aberto.

**Fricção:** um atestado já entregue ao tutor (impresso/baixado) pode ser reaberto e alterado pelo mesmo atendente sem qualquer aviso de que está editando um documento já emitido oficialmente, gerando confusão sobre qual versão o tutor recebeu de fato.

**Sugestão:** quando `status === "emitido"`, exibir um banner de aviso ("Este documento já foi emitido em {data}. Editar e gerar novamente criará uma nova versão."), com badge de cor distinta na lista e um passo de confirmação explícito antes de gerar novo PDF.

**Esforço estimado:** pequeno

### 25. [MÉDIA] Escolha de template sem preview ou categorização — seleção às escuras

**Arquivos:** `frontend/app/atendimento/components/AtendimentoDocumentosSection.tsx`, `frontend/app/atendimento/page.tsx` (`criarDocumentoClinicoDeTemplate`)

**Comportamento atual:** o `<select>` de template lista apenas o nome — sem tipo, categoria ou trecho do corpo. Ao clicar "Criar", o documento já é persistido no banco com o corpo totalmente renderizado; o usuário só vê o conteúdo real depois de já criado.

**Fricção:** com templates de nomes parecidos ("Atestado - repouso", "Atestado - viagem", "Atestado geral"), o atendente precisa adivinhar pelo nome, criar, ler o resultado e, se errou, excluir para tentar outro — um ciclo de várias etapas para uma decisão que um preview resolveria de imediato.

**Sugestão:** mostrar um preview do corpo do template (ao menos o texto bruto com placeholders) antes de clicar "Criar", e agrupar as opções por tipo de template usando `<optgroup>`.

**Esforço estimado:** pequeno (a implementação de um preview fiel pode exigir lógica de render adicional no cliente ou um endpoint dedicado, já que hoje não existe nenhum endpoint de preview para documentos)

### 26. [MÉDIA] Editor de corpo é texto plano, sem nenhum recurso de formatação, mesmo gerando documentos oficiais em PDF

**Arquivos:** `frontend/app/atendimento/components/AtendimentoDocumentosSection.tsx`, `backend/app/api/v1/endpoints/atendimento.py` (`_texto_pdf_html`, geração de parágrafos do PDF)

**Comportamento atual:** tanto o corpo do documento quanto o corpo do template são `<textarea>` simples; o backend só separa blocos por linha em branco e escapa quebras de linha para `<br/>` — não existe negrito, itálico, listas ou qualquer marcação, nem no editor nem no PDF final.

**Fricção:** para destacar um diagnóstico, uma restrição ("NÃO administrar via oral") ou uma lista de orientações num atestado/laudo, o veterinário só pode usar texto corrido ou caixa alta/hifens manuais — sem forma de enfatizar visualmente a informação mais crítica de um documento impresso.

**Sugestão:** adicionar suporte mínimo a formatação (markdown leve — negrito/itálico/listas — renderizado no preview e convertido para tags equivalentes do ReportLab no PDF), ou ao menos uma barra de ferramentas simples sobre o textarea.

**Esforço estimado:** grande

### 27. [MÉDIA] Lista de documentos do atendimento não tem busca/filtro e mistura rascunhos e documentos emitidos sem hierarquia visual

**Arquivos:** `frontend/app/atendimento/components/AtendimentoDocumentosSection.tsx`

**Comportamento atual:** a lista é renderizada como cards verticais simples mostrando só título/status/data; não há busca, filtro ou agrupamento por tipo/status — o spec já "done" de filtros/paginação cobre a lista de atendimentos, não a lista de documentos dentro de um atendimento.

**Fricção:** em atendimentos longos (retorno com múltiplos atestados/laudos ao longo de semanas de acompanhamento), encontrar um documento específico entre vários de títulos similares exige abrir um por um.

**Sugestão:** adicionar um campo de busca por título/tipo quando houver mais de N documentos, e separar visualmente "Rascunhos" de "Emitidos" reaproveitando o campo `status` já disponível.

**Esforço estimado:** pequeno

---

## 6. Lista de atendimentos, busca/filtros e histórico/timeline do paciente

### 28. [ALTA] Radar de alertas clínicos desaparece nas abas Exames e Prescrição

**Arquivos:** `frontend/app/atendimento/page.tsx` (`showClinicalRadarAside`, linha 5441), `frontend/app/atendimento/components/AtendimentoClinicalRadarAside.tsx`, `frontend/lib/clinical-medication.ts`

**Comportamento atual:** `showClinicalRadarAside` só é verdadeiro nas abas Consulta e Documentos. Na aba Exames nenhum aside de alertas é renderizado; na aba Prescrição, o aside mostra só alertas de interação medicamento-medicamento — nunca os alertas clínicos do paciente (alergia/condição crônica), que só existem no `AtendimentoClinicalRadarAside`.

**Fricção:** no momento de prescrever — o de maior risco de erro do fluxo (ex.: prescrever um AINE para paciente com alerta de insuficiência renal, ou penicilina num paciente com alergia registrada) — o painel de alergias/condições crônicas do paciente simplesmente não está na tela.

**Sugestão:** manter uma versão compacta do radar clínico (ao menos os alertas de gravidade alta/crítica) sempre visível, independente da aba ativa, ou incluir os `alertasAtivos` também nos asides de Exames e Prescrição.

**Esforço estimado:** pequeno

### 29. [ALTA] Timeline do paciente agrupada só por ano, ordem cronológica crescente, sem distinção visual entre tipos de evento

**Arquivos:** `backend/app/api/v1/endpoints/atendimento.py` (`_montar_timeline_paciente`), `frontend/app/atendimento/page.tsx`

**Comportamento atual:** os eventos (consulta/evolução/exame solicitado/exame resultado/anexo/laudo) são agrupados só por ano e ordenados do mais antigo para o mais recente, tanto os anos quanto os eventos dentro de cada ano. Cada card é visualmente idêntico, com o tipo distinguido só por um texto pequeno, sem ícone ou cor por categoria.

**Fricção:** para um paciente crônico com anos de acompanhamento, um único ano pode acumular dezenas de eventos misturados; como a ordenação é crescente, o evento mais recente do ano fica no fim da lista (exigindo rolagem), e como todos os cards são iguais, o vet precisa ler o rótulo de texto de cada um para saber o tipo.

**Sugestão:** inverter a ordem (mais recente primeiro, tanto anos quanto eventos), agrupar por mês quando o volume for alto, e atribuir ícone/cor distintos por tipo de evento para permitir escaneamento visual rápido.

**Esforço estimado:** médio

### 30. [MÉDIA] Nenhuma comparação de valores clínicos entre visitas, exceto peso

**Arquivos:** `frontend/app/atendimento/page.tsx` (seção "Dinâmica de peso"), `frontend/app/atendimento/components/AtendimentoExamesSection.tsx`, `frontend/app/atendimento/components/AtendimentoTriagemSection.tsx`

**Comportamento atual:** só existe série histórica dedicada para peso (sparkline + delta); não há equivalente para temperatura/FC/FR (campos de Triagem) nem para resultados de exames recorrentes. Os campos `temperatura`/`frequencia_cardiaca`/`frequencia_respiratoria` existem no modelo de dados, mas não são incluídos no payload de histórico do paciente hoje.

**Fricção:** comparar o hemograma de hoje com o de três meses atrás, ou apenas ver a última temperatura registrada ao preencher a triagem atual, exige abrir manualmente a timeline, localizar o atendimento antigo e anotar o valor para comparar.

**Sugestão:** ao lado de cada campo de vital na triagem e de cada exame com resultado numérico recorrente, mostrar um indicador "última: X (data)" — o que exige um pequeno ajuste de backend para incluir esses campos no histórico, além da mudança de frontend.

**Esforço estimado:** médio

### 31. [MÉDIA] Card da lista de atendimentos não mostra a clínica, mesmo havendo filtro multi-clínica

**Arquivos:** `frontend/app/atendimento/page.tsx` (tipo `AtendimentoResumo`, filtro de clínica)

**Comportamento atual:** `AtendimentoResumo.clinica_nome` é retornado pela API e definido no tipo, mas nunca é usado no JSX do card da lista — que mostra só paciente, tutor, status, data, diagnóstico, contagem de exames e badges de pendência.

**Fricção:** existe um filtro "Todas as clínicas" (ou seja, o sistema é usado por quem atende em mais de uma unidade); ao deixar esse filtro em "Todas", a lista mistura atendimentos de clínicas diferentes sem indicar a qual clínica cada item pertence, forçando o vet a abrir o atendimento só para confirmar a unidade.

**Sugestão:** adicionar um badge/texto com `clinica_nome` no card, visível quando o filtro de clínica está em "Todas as clínicas".

**Esforço estimado:** pequeno

---

## 7. Feedback visual, estados de carregamento/vazio, confirmações, acessibilidade e responsividade

### 32. [ALTA] Dez confirmações via `window.confirm`/`confirm()` nativo do browser para ações heterogêneas

**Arquivos:** `frontend/app/atendimento/page.tsx`

**Comportamento atual:** dez pontos distintos do módulo usam o diálogo nativo do navegador — substituição de rascunho, herança de dados de atendimento anterior (texto corrido de 3 frases), exclusão de exame/anexo/documento/painel/atendimento, revogação de liberação no portal e conclusão com pendências — todos sem estilo consistente com o resto do app e sem diferenciar ações reversíveis de irreversíveis.

**Fricção:** cada diálogo nativo renderiza sem marca, sem ícone de alerta e sem distinguir visualmente uma ação reversível ("substituir rascunho") de uma irreversível ("excluir atendimento"); o texto de herança de dados anteriores é um bloco corrido que quebra mal em telas menores.

**Sugestão:** criar um componente `ConfirmDialog` compartilhado (reaproveitando o padrão visual já existente em outros modais do módulo, e o precedente de `role="dialog"` já usado em outras telas do frontend), com título, corpo formatado e variante visual distinta para exclusões irreversíveis — priorizando primeiro as exclusões (exame, anexo, documento, painel, atendimento).

**Esforço estimado:** médio

### 33. [ALTA] Layout de 3 colunas só se ativa a partir de 1280px; abaixo disso o usuário rola pelo painel de casos antes de chegar às abas clínicas

**Arquivos:** `frontend/app/atendimento/page.tsx`, `frontend/app/globals.css`

**Comportamento atual:** o grid de colunas só ativa no breakpoint `xl` (1280px). Abaixo disso, a página empilha em coluna única na ordem do DOM: primeiro o painel de casos (filtros, busca, lista paginada, prontuário longitudinal, dinâmica de peso — cerca de 270 linhas de JSX), só depois o workspace com as abas clínicas. Não há nenhuma classe `order-*` para reordenar por prioridade em telas estreitas.

**Fricção:** em notebook menor (1366×768 com navegador não maximizado), janela em split-screen ou tablet em paisagem — cenários comuns em consultório — o veterinário precisa rolar por todo o painel de casos e o gráfico de peso antes de alcançar o editor da consulta que está tentando preencher.

**Sugestão:** baixar o breakpoint do grid para `lg` (1024px), já que o conteúdo do sidebar cabe em larguras menores conforme usado em outras grades do arquivo, e/ou aplicar `order-*` para priorizar o workspace quando empilhado, com o painel de casos colapsável abaixo.

**Esforço estimado:** médio

### 34. [MÉDIA] Loading de tela cheia genérico, sem skeleton nem contexto visual

**Arquivos:** `frontend/app/atendimento/page.tsx`, `frontend/app/globals.css` (`.fc-care-loading`)

**Comportamento atual:** quando `loading` é `true`, todo o componente é substituído por uma div com o texto estático "Carregando modulo de atendimento..." — sem spinner (`Loader2`, já usado em outros pontos do mesmo arquivo) e sem qualquer skeleton que sugira o layout por vir.

**Fricção:** ao abrir o módulo (ou recarregar com um atendimento selecionado), o veterinário vê uma tela quase vazia por 1-2s ou mais em conexão lenta, sem nenhum indício de progresso — parece que a aplicação travou.

**Sugestão:** substituir o texto plano por um skeleton simples reaproveitando os blocos existentes (header, navegação, tabs, cards) com `animate-pulse`, ou ao menos adicionar o `Loader2` já usado no resto do arquivo.

**Esforço estimado:** pequeno

### 35. [MÉDIA] Troca de atendimento (histórico) sem qualquer feedback de carregamento

**Arquivos:** `frontend/app/atendimento/page.tsx` (`abrirAtendimento`)

**Comportamento atual:** `abrirAtendimento` faz chamadas assíncronas ao abrir um atendimento do histórico, mas não há nenhum estado de loading associado nem desabilitação do botão clicado — diferente de outras ações do mesmo arquivo (salvar, finalizar, gerar PDF) que já usam `Loader2`.

**Fricção:** em rede mais lenta da clínica, nada muda na tela ao clicar num item da lista de "Atendimentos recentes"; é comum o usuário clicar de novo ou em outro item, gerando confusão sobre qual atendimento está de fato abrindo.

**Sugestão:** adicionar um estado de loading por item (seguindo o padrão já usado em outras ações), mostrando `Loader2` sobre o card clicado e desabilitando cliques nos demais itens enquanto a requisição está em andamento.

**Esforço estimado:** pequeno

### 36. [MÉDIA] Modais do módulo não seguem um padrão comum de acessibilidade (Escape, clique fora, `role="dialog"`)

**Arquivos:** `frontend/app/atendimento/components/PainelExamesModal.tsx`, `frontend/app/atendimento/components/AttachmentPreviewModal.tsx`, `frontend/app/atendimento/page.tsx`

**Comportamento atual:** `AttachmentPreviewModal` fecha com Escape e tem overlay clicável; `PainelExamesModal` não tem nem Escape nem clique-fora-fecha. Nenhum dos dois declara `role="dialog"`, `aria-modal` ou `aria-labelledby`, nem gerencia foco (sem `autoFocus`, sem devolver foco ao fechar).

**Fricção:** um usuário de teclado ou leitor de tela que abre "Gerenciar painéis de exames" não consegue fechar com `Esc` nem clicando fora — precisa localizar visualmente o "X"; para tecnologia assistiva, nenhum dos dois modais é anunciado como diálogo modal.

**Sugestão:** extrair um wrapper `Modal` compartilhado que padronize `role="dialog"` + `aria-modal="true"` + `aria-labelledby`, registre Escape e clique-fora, e faça `autoFocus` no primeiro elemento interativo.

**Esforço estimado:** médio

### 37. [BAIXA] Estados vazios de listas são só texto informativo, sem ação sugerida

**Arquivos:** `frontend/app/atendimento/page.tsx`, `frontend/app/atendimento/components/AtendimentoExamesSection.tsx`, `frontend/app/atendimento/components/AtendimentoDocumentosSection.tsx`

**Comportamento atual:** os estados vazios de lista de atendimentos, exames filtrados, documentos e anexos são todos uma div com "Nenhum X encontrado.", sem botão ou link para a ação óbvia seguinte — mesmo já existindo, em alguns casos, um botão "Limpar filtros" fora do card vazio.

**Fricção:** ao aplicar um filtro/busca sem resultado, a única saída é rolar a tela de volta para achar manualmente o filtro já renderizado mais acima — o estado vazio não nomeia o filtro ativo nem linka para a ação de limpá-lo.

**Sugestão:** no bloco de estado vazio, incluir uma frase que nomeie o filtro ativo e um botão inline que o reseta, trazendo a ação para dentro do próprio card vazio.

**Esforço estimado:** pequeno

---

## Priorização sugerida

Ordenada pela heurística impacto alto + esforço baixo/médio primeiro:

| # | Achado | Tema | Impacto | Esforço |
|---|---|---|---|---|
| 1 | Header não é fixo ao rolar | Navegação | Alta | Pequeno |
| 2 | Badges das abas mostram contagem bruta, não pendências | Navegação | Alta | Pequeno |
| 3 | "Cobertura do prontuário" divergente do critério real de conclusão | Entrada clínica | Alta | Pequeno |
| 4 | Triagem recolhida sem destaque para sinais vitais anormais | Entrada clínica | Alta | Pequeno |
| 5 | Botão "Liberar no portal" ao lado de "Excluir" | Exames | Alta | Pequeno |
| 6 | "Salvar fórmula na biblioteca" sem feedback visível | Prescrição | Alta | Pequeno |
| 7 | Documento "emitido" continua editável sem aviso | Documentos | Alta | Pequeno |
| 8 | Radar de alertas clínicos desaparece em Exames/Prescrição | Lista/Histórico | Alta | Pequeno |
| 9 | Editor guiado sem modo de revisão consolidada dos 11 campos | Entrada clínica | Alta | Médio |
| 10 | Protocolos de prescrição aplicados instantaneamente, sem prévia | Prescrição | Alta | Médio |
| 11 | Variáveis `{{chave}}` não resolvidas/vazias indistinguíveis | Documentos | Alta | Médio |
| 12 | Timeline só por ano, ordem crescente, sem distinção visual | Lista/Histórico | Alta | Médio |
| 13 | Dez confirmações via `window.confirm` nativo | Feedback/Acessibilidade | Alta | Médio |
| 14 | Layout de 3 colunas só a partir de 1280px | Feedback/Acessibilidade | Alta | Médio |
| 15 | CTA "Novo atendimento deste paciente" duplicado | Navegação | Média | Pequeno |
| 16 | Textarea do editor clínico sem label programático | Entrada clínica | Média | Pequeno |
| 17 | Preview de PDF de prescrição em iframe fixo, sem "abrir em nova aba" | Prescrição | Média | Pequeno |
| 18 | Escolha de template sem preview/categorização | Documentos | Média | Pequeno |
| 19 | Lista de documentos sem busca/filtro | Documentos | Média | Pequeno |
| 20 | Card da lista de atendimentos não mostra a clínica | Lista/Histórico | Média | Pequeno |
| 21 | Loading de tela cheia genérico, sem skeleton | Feedback/Acessibilidade | Média | Pequeno |
| 22 | Troca de atendimento sem feedback de carregamento | Feedback/Acessibilidade | Média | Pequeno |
| 23 | Duas interfaces de navegação/progresso redundantes | Navegação | Média | Médio |
| 24 | "Bibliotecas clínicas" não preserva a aba anterior | Navegação | Média | Médio |
| 25 | Biblioteca de frases isolada da tela de uso | Entrada clínica | Média | Médio |
| 26 | Sem indicador de exame visualizado pela clínica parceira | Exames | Média | Médio |
| 27 | Lista de exames sem agrupamento por categoria | Exames | Média | Médio |
| 28 | Sem sugestões padrão/mais usados no catálogo de exames | Exames | Média | Médio |
| 29 | Drag-and-drop só funciona com o card de exame expandido | Exames | Média | Médio |
| 30 | Sem reordenar/duplicar itens de prescrição | Prescrição | Média | Médio |
| 31 | Select nativo sem busca ao editar medicamento de item existente | Prescrição | Média | Médio |
| 32 | Nenhuma comparação de valores clínicos entre visitas, exceto peso | Lista/Histórico | Média | Médio |
| 33 | Modais sem padrão comum de acessibilidade | Feedback/Acessibilidade | Média | Médio |
| 34 | Botão "Laudar" com aparência de ação local, mas navega para outro módulo | Navegação | Baixa | Pequeno |
| 35 | Painel-resumo de exames sem tile "No portal" | Exames | Baixa | Pequeno |
| 36 | Estados vazios sem ação sugerida | Feedback/Acessibilidade | Baixa | Pequeno |
| 37 | Editor de documentos sem recurso de formatação | Documentos | Média | Grande |

---

## O que já está bom / não entrou no relatório

Nesta rodada, todos os 37 achados levantados pelos investigadores sobreviveram à verificação adversarial — nenhum foi descartado por já estar implementado, ser impreciso ou estar fora de escopo. O único ajuste foi de precisão: o achado sobre o botão "Bibliotecas clínicas" (tema Navegação) teve seu texto refinado na verificação — a fricção real confirmada é a perda da aba de trabalho anterior ao voltar (não o "mesmo peso visual" descrito inicialmente, já que o botão é visualmente um controle secundário, e não um dos 4 cartões-aba principais).

Isso reflete positivamente o rigor dos investigadores: cada um foi instruído a confirmar por leitura de código antes de reportar, e a evitar duplicar o que já foi corrigido pelos specs "done" (toast de sucesso/erro, progresso/cancelamento de upload, filtros/paginação da lista, layout do header de ações, entre outros) — nenhum desses temas já resolvidos aparece neste documento.
