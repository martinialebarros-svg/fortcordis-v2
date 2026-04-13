# Checklist de performance do frontend

Este projeto usa Next.js no diretório `frontend`. O objetivo deste guia é ajudar a medir se uma tela está pesada e interpretar os sinais sem depender só de impressão visual.

## 1. Bundle analyzer

No diretório `frontend`, rode:

```bash
npm run analyze
```

O build vai gerar relatórios HTML em `frontend/.next/analyze/`.

Arquivos mais úteis:

- `client.html`: JavaScript que vai para o navegador
- `edge.html`: código de edge/runtime quando existir
- `nodejs.html`: código executado no servidor Node

Como interpretar:

- Priorize `client.html`. É o que mais impacta download, parse e execução no navegador.
- Blocos grandes e coloridos representam arquivos ou bibliotecas pesadas.
- Se uma lib grande aparece em muitas páginas, ela pode estar indo para chunks compartilhados.
- Se uma lib aparece quase toda dentro de uma única rota, aquela tela é uma boa candidata para `dynamic import`.
- Bibliotecas como calendários, editores, PDF, upload, busca fuzzy e componentes ricos costumam aparecer como candidatas naturais.

Sinais de atenção:

- uma rota com `First Load JS` muito acima das demais
- bibliotecas grandes carregadas logo na entrada, mesmo quando o usuário nem usa a função
- código de tela administrativa indo para rotas comuns
- muitos ícones, utilitários ou helpers importados de forma ampla demais

## 2. Build do Next

Rode:

```bash
npm run build
```

Leia a tabela `Route (app)`:

- `Size`: tamanho da rota em si
- `First Load JS`: quanto de JavaScript o navegador precisa baixar na primeira carga daquela rota

Como interpretar:

- compare as rotas entre si, não apenas um número isolado
- uma rota 30% a 80% maior que as outras já merece inspeção
- se o `First Load JS shared by all` cresce demais, o problema está no código compartilhado
- se só uma rota cresce muito, o problema tende a estar em componentes específicos daquela página

## 3. Checklist de arquitetura

Use este checklist ao revisar telas pesadas:

- A página inteira precisa mesmo de `"use client"`?
- Parte da tela pode virar Server Component?
- Dá para buscar dados no servidor e hidratar menos estado no client?
- Componentes pesados podem ser carregados com `dynamic()`?
- Modal, calendário, editor, exportação PDF e upload só carregam quando necessários?
- A lista usa paginação, busca no servidor ou virtualização quando cresce?
- Há muitos `useEffect` encadeados disparando novas renderizações?
- Estado está concentrado demais na página inteira?
- Existem chamadas de API duplicadas na montagem?
- O usuário baixa dados demais para usar só uma parte?

## 4. DevTools do navegador

Abra a rota em produção e use o Chrome DevTools.

### Network

Veja:

- arquivos JS maiores
- quantidade de requests
- tempo das APIs
- imagens ou fontes grandes

Interpretação rápida:

- muito tempo em `Waiting (TTFB)` aponta mais para backend/rede
- muito tempo em download aponta arquivos pesados
- muitas requests pequenas podem indicar fragmentação excessiva ou chamadas redundantes

### Performance

Grave a navegação da tela e observe:

- `Scripting` alto: JavaScript demais executando
- `Rendering` alto: layout/reflow excessivo
- tarefas longas na main thread: travamentos perceptíveis

Se a tela abre, mas trava ao interagir, o problema costuma estar mais em execução/renderização do que em download.

## 5. React Profiler

Use quando a tela abre, mas digitar, trocar filtros ou abrir modais fica lento.

Procure:

- componentes renderizando em cascata
- listas inteiras rerenderizando por mudança pequena
- cálculo pesado rodando a cada tecla

## 6. Leitura rápida dos resultados

Pense assim:

- `build` alto em uma rota: investigar bundle daquela tela
- `Network` ruim: investigar payload, cache e APIs
- `Performance` ruim: investigar renderização e JavaScript
- `React Profiler` ruim: investigar rerender e estado

## 7. O que costuma resolver

- mover lógica e fetch para Server Components
- quebrar páginas `"use client"` em ilhas menores
- usar `dynamic()` para componentes pesados
- adiar bibliotecas não críticas
- paginar listas grandes
- evitar buscar tudo no mount
- reduzir estado global ou estado no topo da página
- revisar imports pesados por rota
