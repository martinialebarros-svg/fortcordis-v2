# Verify — Paginação de Transações

Data: 2026-09-13
Status: aceite concluído. Publicado em stage (`c1d42304`) e promovido em
`24479dc3`. O roteiro rodou em stage, e o único passo que a massa de dados de
stage não permitia foi fechado em produção — ver "Navegação de páginas, fechada
em produção".

## Evidências

- API: `backend/tests/test_financeiro_transacoes_pagination.py`: 3 testes aprovados,
  com 505 registros sintéticos; busca além do limite anterior, total, ordenação,
  filtros, caracteres literais e última página.
- UI: `frontend/app/financeiro/page.test.tsx`: 6 testes aprovados de paginação,
  busca remota, retry, resposta obsoleta, página removida, reset de filtro,
  vazio confirmado e falha independente do resumo.
- Resiliência existente: `frontend/lib/financeiro-loading.test.ts`.
- `npx vitest run app/financeiro/page.test.tsx lib/financeiro-loading.test.ts lib/axios.test.ts`:
  17 testes aprovados na execução final.
- `npm test`: 293 Vitest + 9 Node aprovados na revalidação completa de 13/09/2026.
- `npx tsc --noEmit`: aprovado após correção da inferência `never[]` no histórico
  sintético de `AppointmentQueue.test.tsx`; nenhuma alteração de runtime do WhatsApp.
- `npm run lint`: aprovado.
- `npm run build`: aprovado, 43 páginas estáticas geradas.
- `git diff --check`: aprovado. Revisão do diff: apenas listagem de Transações,
  testes e SDD; nenhuma mutação ou cálculo alterado.
- Guardrail SDD aprovado via `evaluate_guardrail` sobre arquivos modificados e
  não rastreados (sem criar commit apenas para executar o verificador).

## Pendências de aceite

- Paginação de Ordens/Cobranças não faz parte deste incremento.

O risco residual anterior — navegação de páginas na tela sem exercício em
ambiente publicado — deixou de existir. Fechado em produção, seção abaixo.

## Roteiro de aceite em stage

1. Reconciliar com a versão atual de stage, publicar backend e frontend juntos e
   aguardar os workflows terminarem com sucesso; não promover automaticamente.
2. Autenticar em stage e confirmar até 100 itens por página e total do servidor.
3. Avançar/voltar, buscar registro antigo e mudar filtros a partir da página 2.
4. Conferir que o resumo não muda apenas por navegar entre páginas.
5. Repetir navegação/reload e comparar tempos e requisições da mesma tela/período.
   Se o navegador não expuser tempos de API, registrar a limitação sem inventar métricas.
6. Conferir Ordens/Cobranças sem executar pagamentos, baixas, envios ou exclusões.
7. Registrar evidência e riscos residuais; produção exige aprovação separada.

## Aceite em stage (2026-09-13)

Executado com sessão autenticada em `app.stage.fortcordis.com.br`, sobre
`c1d42304`. Nenhuma mutação: só `GET`. Nenhum pagamento, baixa, envio ou
exclusão.

| Passo | Evidência | Status |
| --- | --- | --- |
| 1. Publicar backend e frontend juntos em stage | merge de #123 e `Deploy to Stage (VPS)` com success; não promovido em seguida | ok |
| 2. Até 100 por página e total do servidor | requisição da propria tela: `GET /financeiro/transacoes?limit=100&skip=0`; resposta `{total, items}`; contador da aba e lista mostram 23, igual ao `total` | ok |
| 3. Avançar/voltar e mudar filtros a partir da página 2 | inexecutável em stage (23 registros); fechado em produção com 1064 — ver seção própria | ok |
| 4. Resumo não muda só por navegar | `/financeiro/resumo` chamado apenas nas 2 cargas de tela, nunca em busca ou filtro; cards inalterados enquanto a lista ia de 23 para 1 e voltava | ok |
| 5. Tempos por requisição | 24 chamadas medidas por Resource Timing: 111–889 ms, mediana em torno de 160 ms; a de 889 ms e a primeira, com conexao fria | ok, com ressalva |
| 6. Ordens e Cobranças sem mutação | Cobranças (9 destinatários) e Ordens de Serviço (21) carregam sem erro; só `GET` no log de rede | ok |

### Contrato exercitado direto na API

| Verificação | Resultado |
| --- | --- |
| `skip=0,10,20` com `limit=10` | páginas disjuntas, união cobre os 23, `total` estável em 23 |
| `skip=100` (além do fim) | 0 itens, `total` segue 23 |
| Ordenação | `data_transacao DESC, id DESC` confirmada item a item |
| `search` com `%` e com `_` | 0 resultados — tratados como literais. Se fossem curinga, `%` traria os 23 e `_` traria qualquer linha |
| `search` com espaços em volta e em caixa alta | mesmo total do termo limpo — trim e case-insensitive confirmados |
| Busca pela tela | 7 teclas produziram **1** requisição (debounce) com `skip=0` (volta à página 1) |
| Busca do registro mais antigo (`Freder`, 13/03/2026) | alcançado, 2 resultados, contador segue o `total` do servidor |
| Filtro trocado com busca ativa | `?limit=100&skip=0&search=Freder&tipo=entrada` — combinados no servidor, `skip` resetado |
| Limpar busca | volta a 23 com requisição nova sem `search` |

### Por que o passo 3 não coube em stage

**Stage tem 23 transações.** Com página de 100, existe uma única página: os
botões "Anterior" e "Próxima" ficam corretamente desabilitados, e não há página
2 para navegar nem para mudar filtro a partir dela. O passo era inexecutável ali
sem criar massa de dados — e criar transações financeiras em stage só para o
teste não pareceu troca justa.

Na ocasião, a paginação foi exercitada pela API com `limit=10`, forçando três
páginas sobre os mesmos 23 registros (tabela acima). Isso cobria o backend, mas
não a navegação na interface, e o passo ficou registrado como `parcial`.

### Sobre os tempos

Há medição, mas **não há comparação**: o código anterior não está mais publicado
em stage, então não existe um "antes" no ambiente publicado. Os números acima
são absolutos e valem como ordem de grandeza, não como ganho. CA-5 desta spec
proíbe atribuir redução de latência sem medição no ambiente publicado, e essa
medição não foi feita.

## Navegação de páginas, fechada em produção (2026-09-13)

O que stage não permitia por falta de dados foi exercitado em produção, onde há
**1064 transações** — 11 páginas de 100, e mais que o limite antigo de 500.

Sessão autenticada em `app.fortcordis.com.br`. **Somente `GET` e navegação**:
35 chamadas de API, nenhuma mutação — nenhum pagamento, baixa, envio, exclusão
ou edição. A tela foi devolvida ao estado inicial, sem filtro.

| Verificação | Resultado |
| --- | --- |
| Página 1 | exatamente 100 itens; contador em 1064, igual ao `total` do servidor; "Anterior" desabilitado e "Próxima" habilitada |
| Avançar | `?limit=100&skip=100`, 100 itens, **zero sobreposição** com a página 1 |
| Voltar | `?limit=100&skip=0`, conteúdo idêntico ao da primeira visita, "Anterior" desabilitado de novo |
| Mudar filtro estando na página 2 | `?limit=100&skip=0&tipo=entrada` — volta à página 1 e o filtro vai ao servidor; contador passa a 1057 |
| Resumo ao navegar | inalterado |
| Registro na posição 700, além do limite antigo de 500 | alcançável por busca, `total` 1 — fecha o critério 1 da spec |

O defeito clássico de paginação — a página 2 repetir a página 1 — **não ocorre**.
Era exatamente o risco residual registrado antes.

### Método, por ser produção

As páginas foram comparadas por hash do texto renderizado de cada linha, não por
leitura de conteúdo: nenhuma descrição, nome de tutor, paciente ou valor foi
extraído do ambiente. Os números desta seção são contagens e parâmetros de query.

### Desvio declarado

O roteiro dizia "aceite em stage". Este passo foi feito em **produção**, porque é
o único ambiente onde existe massa suficiente. A mudança já estava publicada lá
(`24479dc3`), e o teste é de leitura — mas fica o registro de que o ambiente não
foi o previsto.

### Observação, não defeito

`/financeiro/resumo` foi refeito uma vez durante a navegação (2 para 3 chamadas).
O valor não mudou, que é o que o critério exige, e continua vindo do endpoint
próprio em vez da soma da página. É uma requisição a mais do que o necessário.
