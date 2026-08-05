# Verify - atendimento-pendencias-filtro

Data: 2026-08-02
Responsavel: Claude (pareado com Martiniano)
Status: done (backend e build verificados; smoke manual de UI pendente)

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | `test_filtro_traz_so_concluido_com_pendencia` + smoke HTTP "filtro traz o atendimento incompleto" | ok |
| CA-002 | aceitacao | `test_item_concluido_completo_nao_tem_pendencias` + smoke HTTP "item concluido e completo nao tem pendencias na listagem geral" | ok |
| CA-003 | aceitacao | `test_atendimento_aberto_nao_sinaliza_pendencia_mesmo_vazio` | ok |
| CA-004 | aceitacao | smoke HTTP "atendimento sai do filtro apos completar documentacao" - `PUT` preenchendo diagnostico, sem tocar em nenhum registro de auditoria, e o item sai do filtro na consulta seguinte | ok |
| CA-005 | aceitacao | `test_filtro_combinado_com_status_diferente_de_concluido_fica_vazio` | ok |
| CA-006 | aceitacao | `pytest tests/ -k atendimento`: 103 aprovados (baseline 98, fim do pacote anterior) | ok |
| NFR-001 | nao funcional | filtro aplicado via `.filter(...)` antes de `.offset(skip).limit(limit)` em `listar_atendimentos` - mesma query, sem paginacao em memoria | ok |
| NFR-002 | nao funcional | `documentacao_pendencias` calculado a partir dos campos ja presentes no objeto `AtendimentoClinico` do lote carregado, nenhuma query nova por item (mesmo padrao ja validado por `test_atendimento_list_n_plus_one.py`, que continua passando) | ok |
| NFR-003 | nao funcional | `_calcular_pendencias_documentacao` e a mesma funcao usada por `_validar_primeira_conclusao_atendimento` (guard) e por `listar_atendimentos` (listagem) | ok |
| CB-001 | borda | coberto pela reutilizacao de `_tem_texto_clinico` (mesma semantica de "vazio" usada no guard, ja testada em `atendimento-conclusao-confirmavel`) | ok |
| CB-002 | borda | `test_filtro_traz_so_concluido_com_pendencia` verifica os ids retornados, nao so a contagem, confirmando que o filtro reduz o conjunto antes de qualquer paginacao | ok |

## 2) Testes automatizados executados

```bash
cd backend
./venv/bin/python -m pytest tests/ -k atendimento -q --no-header
./venv/bin/python -m pytest tests/ -q --no-header

cd ../frontend
npx tsc --noEmit --pretty false
npx eslint app/atendimento/page.tsx
npm run build
```

Resumo dos resultados:

- **Backend, modulo Atendimento:** `103 passed, 463 deselected` (baseline
  antes deste pacote: 98). Os 5 testes novos estao todos em
  `test_atendimento_documentacao_incompleta_filtro.py`.
- **Backend, suite completa:** `566 passed`, nenhuma falha (worktree limpo
  baseado em `origin/stage`).
- **TypeScript:** aprovado, sem diagnosticos.
- **ESLint:** aprovado no arquivo alterado.
- **Build Next.js:** aprovado.

### Smoke HTTP em banco isolado

Script temporario via `TestClient`, cobrindo o ciclo completo: criar
atendimento aberto -> finalizar confirmando pendencia -> aparece no filtro
com a pendencia certa -> `PUT` preenchendo diagnostico e plano terapeutico ->
some do filtro e a listagem geral confirma `documentacao_pendencias == []`.
6 verificacoes, todas aprovadas. Confirma na pratica a decisao de nao
depender do log de auditoria (RF/CB do `intent.md`): o item sai do filtro
assim que o conteudo muda, sem nenhuma acao para "resolver" o aviso.

## 3) Testes manuais

Sem runner de teste no frontend. Roteiro para validacao humana:

1. Marcar o checkbox "Concluidos com documentacao incompleta" e clicar
   "Aplicar filtros". *Esperado:* lista so atendimentos concluidos com
   diagnostico/plano/anamnese ausentes.
2. Abrir um desses atendimentos, ver o badge amber "Documentacao incompleta"
   no card da lista (passar o mouse mostra o que falta no tooltip).
3. Preencher o diagnostico e salvar. Voltar para a lista com o filtro ainda
   marcado. *Esperado:* o atendimento nao aparece mais.
4. Desmarcar o filtro. *Esperado:* volta a listagem normal, sem filtro de
   status implicito.

## 4) Regressao e riscos residuais

- **Risco residual 1:** a condicao SQL (`_condicao_sql_documentacao_
  incompleta`) e o calculo Python (`_calcular_pendencias_documentacao`)
  precisam ser mantidos em sincronia manualmente se a regra de pendencia
  mudar no futuro - nao ha um teste que force os dois a divergir e falhar
  automaticamente. Documentado no codigo (docstring de ambas as funcoes se
  referenciando).
- **Risco residual 2:** nenhuma notificacao ativa - o vet so ve a pendencia
  se acessar a lista e usar o filtro ou reparar no badge. Fica como possivel
  proximo passo, nao decidido.
- **Risco residual 3:** o smoke manual (secao 3) nao foi executado por um
  humano ainda.

## 5) Itens fora de escopo entregues

- Nenhum.

## 6) Decisao de release

- [ ] Aprovado para stage.
- [ ] Aprovado para producao.
- [x] Pendente: aguarda o roteiro manual da secao 3 e autorizacao explicita
  para deploy (mesmo processo dos pacotes anteriores).
