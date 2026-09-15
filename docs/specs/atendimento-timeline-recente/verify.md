# Verify - atendimento-timeline-recente

Data: 2026-08-11
Responsavel: Claude (pareado com Martiniano)
Status: implementado, aguardando deploy

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-1 | aceitacao | `pytest` novo (`test_anos_e_eventos_em_ordem_decrescente`): anos e eventos dentro de cada ano em ordem decrescente, com fixture real multi-ano (30 atendimentos ao longo de ~2.4 anos, cada um com exame e laudo associado). | ok |
| CA-2 | aceitacao | Verificacao end-to-end via `fetch()` direto ao endpoint real `/api/v1/atendimentos/paciente/9/historico` (preview local, dados sinteticos inseridos no banco copiado): anos retornados `["2026","2025","2024"]` (decrescente); eventos dentro de 2026 em ordem decrescente (`2026-02-28` -> `2026-01-05`), cobrindo 5 dos 6 tipos de evento. | ok |
| CA-3 | aceitacao | 6 pares de classe Tailwind do `TIMELINE_EVENTO_META` (marcador + badge) testados via elemento DOM temporario na mesma pagina (CSS real ja compilado) - todos resolvem a cores distintas (`getComputedStyle`): teal/sky/amber/emerald/violet/rose. | ok |
| CA-4 | aceitacao | `npx tsc --noEmit` sem erros; `npm run build` verde. | ok |
| CA-5 | aceitacao | `pytest tests/ -k "atendimento or timeline"` (158 testes) - sem regressao em nenhum outro teste relacionado. | ok |

## 2) Testes automatizados executados

```bash
cd backend && venv/bin/python -m pytest tests/test_atendimento_timeline_limitada.py -v
# 4 passed

cd backend && venv/bin/python -m pytest tests/ -k "atendimento or timeline" -q
# 158 passed, 541 deselected

cd frontend && npx tsc --noEmit
# sem saida (0 erros)

cd frontend && npm run build
# Compiled successfully
```

## 3) Testes manuais / end-to-end

Preview local isolado do worktree (backend `:8018`, frontend `:3018`,
`fortcordis.db`/`.env` copiados so para teste e removidos do worktree
ao final):

1. Dados sinteticos inseridos no banco local copiado para o paciente
   "celine" (id 9, que ja tinha 1 atendimento real de 2026): 2 novos
   atendimentos (2024-03-10, 2025-06-15), 2 evolucoes em fevereiro/2026
   (dias 20 e 27), 3 laudos (2024-05-01, 2025-08-01, 2026-01-05), 1
   exame (2026-02-26) e 1 anexo (2026-02-28) - dado descartavel, so no
   banco local copiado, nunca tocou producao/stage.
2. **Limitacao encontrada nesta sessao de preview:** o clique do
   Browser tool parou de mover o foco (`document.activeElement`) para
   QUALQUER elemento da pagina - testado com `computer` click (via ref
   e via coordenada apos screenshot), `double_click`, `form_input` e
   um `dispatchEvent` manual de `input` nativo; todos falharam em
   tirar o foco de `<body>`, inclusive em elementos nao relacionados
   (ex.: o select de clinica). Isso impediu o fluxo interativo
   completo (buscar paciente -> clicar -> ver a timeline renderizada
   na tela). A mesma logica de busca de paciente funcionou normalmente
   nos 2 pacotes imediatamente anteriores desta sessao (#21, #38),
   entao trata-se de uma instabilidade pontual do ambiente/tool nesta
   sessao especifica de preview, nao um bug introduzido por este
   pacote.
3. Para nao bloquear a verificacao, usei dois caminhos que nao
   dependem de foco/clique:
   - `fetch()` direto (autenticado via cookie de sessao, mesma rota
     que o frontend consome) ao endpoint real - confirma a ordenacao
     decrescente ponta-a-ponta (banco -> backend -> HTTP), reportado
     em CA-2.
   - Criacao de um elemento DOM temporario na mesma pagina (CSS real
     ja carregado) com as classes Tailwind exatas usadas no JSX, lido
     via `getComputedStyle` - confirma que as 6 combinacoes de cor
     compilam e resultam em cores distintas, reportado em CA-3.
4. Preview encerrado; db/.env copiados removidos do worktree.

## 4) Revisao adversarial

Agente ceptico leu a funcao completa, buscou todos os consumidores do
retorno de `_montar_timeline_paciente` (backend e frontend) para
confirmar que nada dependia da ordem crescente antiga, verificou o
fallback de tipo desconhecido no frontend, os imports de icone e a
fixture do novo teste.

**Veredito: sem achados bloqueantes.**
- Nenhum outro consumidor (backend ou frontend) indexa
  `timeline[0]`/`eventos[0]` assumindo ordem crescente - so `.length`/
  `.map`, que sao neutros a ordem.
- Bucket `"Sem data"` agora e concatenado incondicionalmente ao final
  (`anos_reais + [...]`), garantindo a posicao independente de
  comparacao de string - mais robusto que o `sorted` por tupla usado
  antes.
- Fallback `TIMELINE_EVENTO_META[evento.tipo] || TIMELINE_EVENTO_META_PADRAO`
  dispara corretamente (lookup ausente retorna `undefined`, falsy).
- Todos os 7 icones usados (6 + fallback) ja estavam importados de
  `lucide-react`, sem imports novos.
- Fixture do novo teste e genuinamente multi-ano/multi-evento (30
  atendimentos ao longo de ~2.4 anos), nao um caso trivial.

**Observacao nao bloqueante (pre-existente, fora de escopo):** o
agente notou que `Exame.data_resultado` e por vezes preenchido com
hora local (`datetime.now()`) e por vezes UTC (`datetime.utcnow()`) em
pontos diferentes do codigo, causando um desvio de ate ~3h na
ordenacao relativa de eventos `exame_resultado` especificamente. Esse
mecanismo de comparacao de string ja existia antes deste pacote (so
que em ordem crescente) - nao e introduzido nem agravado por esta
mudanca, e fica fora de escopo do achado #48.

## 5) Riscos residuais aceitos

- Sem agrupamento por mes para anos de alto volume (ver `intent.md`,
  decisao de escopo) - pacote futuro se a rolagem dentro de um ano
  ainda incomodar.
- Verificacao visual pixel-a-pixel (screenshot da timeline renderizada
  na tela) nao foi possivel nesta sessao devido a instabilidade do
  Browser tool (ver secao 3) - mitigado pela verificacao end-to-end via
  API real + verificacao de CSS via DOM, cobrindo a mesma superficie.
- Desvio de fuso horario pre-existente em `exame_resultado.data_resultado`
  (ver secao 4) - nao corrigido, fora de escopo do achado #48.
- Escopo deste pacote cobre apenas o achado #48 (issue de tracking
  #57); os demais achados permanecem para pacotes futuros.
