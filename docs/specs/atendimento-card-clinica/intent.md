# Intent - atendimento-card-clinica

Data: 2026-08-12
Responsavel: Claude (pareado com Martiniano)
Status: done

## 1) Problema atual

**Origem:** `docs/AUDITORIA-ATENDIMENTO-UX-FLUXO-2026-08-09.md` - achado #31
(dimensao: Lista de atendimentos/Historico), rastreado como issue #50.

O card "Atendimentos recentes" (painel de casos, `frontend/app/atendimento/page.tsx`)
tem um filtro "Todas as clinicas" que permite misturar atendimentos de
clinicas diferentes na mesma lista. O tipo `AtendimentoResumo` ja define
`clinica_nome`, e a API ja retorna esse campo preenchido (`clinica.nome`,
com fallback `""` quando o atendimento nao tem `clinica_id` - ex.:
atendimento domiciliar) - mas o campo nunca era usado no JSX do card.

## 2) Objetivo

Exibir um badge com `clinica_nome` em cada card da lista, visivel apenas
quando o filtro esta em "Todas as clinicas" (`clinicaFiltro === ""`) e o
atendimento tem uma clinica associada (`item.clinica_nome` truthy).

## 3) Nao objetivos

- Mudar o comportamento do filtro de clinica em si (select, opcoes,
  chamada a API) - already funcional.
- Adicionar icone (ex. MapPin/Building2) ao badge - nenhum precedente no
  modulo de badge de identidade + icone; manter o padrao "chip de texto"
  ja usado para os outros badges do mesmo card (exame(s), Receita salva,
  Documentacao incompleta).
- Mostrar a clinica em outras listas/paginas do sistema - escopo restrito
  ao card de "Atendimentos recentes" em `frontend/app/atendimento/page.tsx`,
  unico arquivo citado no achado.

## 4) Contexto e restricoes

- **Decisao de engenharia (posicao do badge):** o achado sugere "badge/texto";
  optou-se por um chip no mesmo `flex flex-wrap` que ja contem
  `{item.total_exames} exame(s)`, `Receita salva` e `Documentacao incompleta`,
  posicionado primeiro (antes de "exame(s)") por ser informacao de
  identificacao do atendimento (a qual clinica pertence), nao uma metrica.
  Reaproveita o mesmo padrao de chip (`rounded-full ... px-2.5 py-1`) ja
  usado pelos vizinhos, com uma cor neutra (`bg-slate-200 text-slate-700`)
  distinta do chip branco de "exame(s)" para nao ser confundido com uma
  contagem.
- **Decisao de engenharia (condicao dupla):** o badge so aparece quando
  `clinicaFiltro === ""` (filtro em "Todas as clinicas") E
  `item.clinica_nome` e truthy. A segunda condicao evita mostrar um chip
  vazio para atendimentos sem clinica (domiciliares, onde a API retorna
  `clinica_nome: ""`).
- Fonte do campo: `backend/app/api/v1/endpoints/atendimento.py` (listagem
  `GET /atendimentos`, linha ~2266: `Clinica.nome.label("clinica_nome")` via
  outer join; linha ~2378: `"clinica_nome": clinica_nome or ""`). Nenhuma
  mudanca de backend necessaria - o dado ja vem completo.

## 5) Impacto esperado

- Usuarios impactados: veterinarios que atendem em mais de uma clinica e
  usam o filtro "Todas as clinicas" na lista de atendimentos recentes.
- Modulos impactados: Atendimento (frontend) - somente `page.tsx`. Nenhuma
  mudanca de backend, banco ou contrato de API.
- Risco de regressao: muito baixo - adicao de um chip condicional a um
  bloco `flex flex-wrap` ja existente; nenhum estado novo, nenhuma logica
  de fetch alterada.

## 6) Riscos iniciais

- Risco 1: badge aparecer vazio quando `clinica_nome` e string vazia.
  Mitigado - condicao `item.clinica_nome` (truthy) exclui strings vazias.
- Risco 2: badge poluir visualmente o card quando ha muitos chips (exame(s)
  + Receita salva + Documentacao incompleta + clinica). Mitigado - o
  container ja usa `flex-wrap`, entao os chips quebram linha normalmente;
  nenhum layout quebrado observado no preview.
- Risco 3 (encontrado pela revisao adversarial, corrigido): a condicao
  inicial usava `clinicaFiltro` - o valor ao vivo do `<select>` - em vez do
  filtro que de fato populou `lista`. Como `carregarLista` so e disparado
  por acoes explicitas (nunca por um `useEffect` observando
  `clinicaFiltro`), trocar o select sem clicar "Aplicar filtros" fazia o
  badge sumir instantaneamente mesmo com a lista ainda misturando
  clinicas - recriando a ambiguidade que o pacote deveria resolver, no
  momento exato da troca de filtro. **Corrigido** adicionando o estado
  `clinicaFiltroAplicado`, atualizado dentro de `carregarLista` (na mesma
  chamada que atualiza `lista`/`totalLista`/`paginaLista`, garantindo que
  nunca fiquem fora de sincronia - `setLista` so e chamado nesse unico
  ponto do arquivo). O badge agora usa `clinicaFiltroAplicado === ""` em
  vez de `clinicaFiltro === ""`.

## 7) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
