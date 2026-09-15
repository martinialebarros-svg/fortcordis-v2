# Verify - atendimento-cta-novo-duplicado

Data: 2026-08-12
Responsavel: Claude (pareado com Martiniano)
Status: implementado, aguardando deploy

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-1 | aceitacao | Estado inicial (`selecionado` falso, sem paciente): 1 botao "Novo atendimento" no header - confirmado via DOM. | ok |
| CA-2 | aceitacao | Atendimento persistido real aberto via `?atendimento_id=1` (`selecionado` truthy): 0 botoes no header; exatamente 1 botao "Novo atendimento deste paciente", pertencente ao banner ambar (`className` com `bg-amber-700`) - confirmado via DOM e screenshot. | ok |
| CA-3 | aceitacao | Banner "Registro historico #1" confirmado visivel (texto da secao pai do botao) simultaneamente ao botao unico - sem estado com 0 CTAs. | ok |
| CA-4 | aceitacao | `npx tsc --noEmit` sem erros; `npm run build` verde. | ok |

## 2) Testes automatizados executados

```bash
cd frontend && npx tsc --noEmit
# sem saida (0 erros)

cd frontend && npm run build
# Compiled successfully
```

Sem suite automatizada de UI para esta pagina no projeto.

## 3) Testes manuais

Preview local isolado do worktree (backend `:8122`, frontend `:3021`,
`fortcordis.db`/`.env` copiados so para teste e removidos do worktree
ao final). Login via `fetch()` autenticado + `localStorage` (mesmo
padrao de pacotes anteriores desta sessao):

1. `/atendimento` (sem query param) - `selecionado` falso, nenhum
   paciente selecionado: 1 botao "Novo atendimento" no header,
   confirmado via `querySelectorAll('button')` filtrado por texto.
2. `/atendimento?atendimento_id=1` (id real, persistido, existente no
   banco local copiado) - `selecionado` truthy: 0 botoes no header
   com esse texto; 1 botao "Novo atendimento deste paciente" restante,
   confirmado como pertencente ao banner ambar via `className`
   (`bg-amber-700`, distinto do `fc-care-button-secondary` do header)
   e via `closest('section').textContent` mostrando "Registro
   historico #1" + o texto do banner. Screenshot confirma visualmente:
   header com so Laudar/Salvar/Finalizar; banner ambar abaixo com seu
   proprio botao unico.
3. Preview encerrado; db/.env copiados removidos do worktree.

Nota: porta 8021 (proxima da sequencia usada nos pacotes anteriores
desta sessao) estava ocupada por um processo `node` alheio a esta
sessao (nao iniciado por mim) - troquei para a porta 8122 em vez de
investigar/encerrar um processo que nao era meu, evitando qualquer
acao arriscada sobre estado de outra sessao.

## 4) Revisao adversarial

Agente ceptico rastreou todos os 6 pontos de `setSelecionado` no
arquivo, confirmou que `selecionado` truthy implica `form.paciente_id`
truthy (via constraint `NOT NULL` no banco + guards existentes em
`executarSaveAtendimento`), confirmou que o banner ambar usa a MESMA
variavel `selecionado` (nao uma derivada que possa dessincronizar), e
procurou por qualquer outra referencia ao botao do header (ref,
`data-testid`, atalho de teclado) que pudesse quebrar silenciosamente.

**Veredito: correto, sem achados.**
- Nenhum estado de rascunho/nao-salvo pode deixar `selecionado`
  truthy - so registros realmente persistidos e carregados via
  `abrirAtendimento`.
- Banner ambar e o novo guard do header usam a mesma variavel `bare`
  `selecionado`, sem risco de dessincronia (0 CTAs) ou duplicacao (2
  CTAs) permanecerem possiveis.
- O ramo removido do `onClick` do header era sempre
  `iniciarNovoAtendimentoPaciente()` quando `selecionado` e truthy -
  o caminho `novoAtendimento()` (sem paciente) permanece acessivel em
  todo estado onde o botao do header ainda e exibido.
- Nenhuma outra referencia (ref/testid/atalho) dependia deste botao
  especifico.

## 5) Riscos residuais aceitos

- Sem suite automatizada cobrindo este comportamento.
- Escopo deste pacote cobre apenas o achado #22 (issue de tracking
  #57); os demais achados permanecem para pacotes futuros.
