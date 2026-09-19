# Verify - portal-escopo-sessao-clinica

Data: 2026-09-18
Responsavel: Martiniano Barros
Status: done

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | `test_portal_escopo_sessao.py::test_sessao_com_escopo_cheio_passa_no_guard_de_clinica` | ok |
| CA-002 | aceitacao | `test_portal_escopo_sessao.py::test_todo_escopo_emitido_hoje_carrega_a_permissao_do_seu_ator` | ok |
| CA-003 | aceitacao | `test_portal_escopo_sessao.py::test_servicos_de_autenticacao_emitem_o_escopo_cheio` | ok |
| CA-004 | aceitacao | `test_portal_escopo_sessao.py::test_escopo_so_laudos_e_barrado_na_gestao_da_unidade` - 4 subtests (agendamentos, financeiro, cancelamento, recibo) | ok |
| CA-005 | aceitacao | `test_portal_escopo_sessao.py::test_escopo_so_laudos_continua_lendo_exames_liberados` - inclui `operational_summary` | ok |
| CA-006 | aceitacao | `test_portal_escopo_sessao.py::test_sessao_sem_exam_read_nao_le_exames` | ok |
| CA-007 | aceitacao | `test_portal_escopo_sessao.py::test_download_exige_exam_download` | ok |
| CA-008 | aceitacao | `test_portal_escopo_sessao.py::test_escopo_vazio_nao_passa_em_nada` - 3 subtests | ok |
| CA-009 | aceitacao | `test_portal_escopo_sessao.py::test_guard_de_clinica_confere_escopo_antes_de_tocar_o_banco` (chamada com `db=None`) | ok |
| CA-010 | aceitacao | Suite completa: 1374 passaram, 7 pulados, 297 subtests | ok |
| NFR-001 | nao funcional | CA-002 e CA-003 conferem os tres pontos de emissao na origem, alem do comportamento dos endpoints | ok |
| NFR-002 | nao funcional | CA-008 | ok |
| NFR-003 | nao funcional | Default `permissao=PORTAL_PERMISSION_CLINIC_READ` em `_exigir_sessao_clinica_portal` | ok |
| NFR-004 | nao funcional | Mensagem unica "Sessao do portal sem permissao para esta operacao.", sem nomear a permissao | ok |
| RF-010 | funcional | `backend/tests/test_portal_escopo_sessao.py` adicionado ao `migrations-ci.yml`; rodado por `unittest` como o CI invoca (9 testes, OK) | ok |
| CB-003 | borda | Download por token segue sem conferencia de escopo, por desenho; suite completa cobre o caminho sem regressao | ok |
| Stage | manual | Conferido em 18/09/2026 na clinica 8 (Animal Care) em `app.stage.fortcordis.com.br` - ver secao 3 | ok |

## 2) Testes automatizados executados

Comandos:

```bash
cd backend && python -m pytest tests/ -q
```

```bash
cd backend && python -m unittest tests/test_portal_escopo_sessao.py
```

Resumo dos resultados:

- Backend (suite completa): **1374 passaram, 7 pulados, 297 subtests** em 53s.
- Arquivo novo isolado: **9 testes, 7 subtests**, tambem verde rodando por
  `unittest` com as mesmas variaveis de ambiente do `migrations-ci.yml`.
- Frontend: nao executado - esta entrega nao toca o frontend (secao 4 da spec).

Observacao sobre cobertura de CI: ate aqui nenhum workflow de `pull_request` rodava
teste Python de autorizacao - a suite completa so roda no deploy, depois do merge.
Por isso o arquivo novo entrou na lista do `migrations-ci.yml` (RF-010), que ja
carregava testes de invariante critica (`test_fiscal_numero_unicidade`,
`test_critical_composite_indexes`) alem dos de migracao.

## 3) Testes manuais

Executado em **18/09/2026**, em `app.stage.fortcordis.com.br`, com sessao real de
clinica (clinica 8 - Animal Care), login por e-mail e senha feito pelo usuario.

Cenario 1 - a clinica com senha nao perdeu nada. Todos os endpoints tocados pela
conferencia de escopo responderam **200**:

| Endpoint | Permissao exigida | Resultado |
| --- | --- | --- |
| `GET /portal/clinicas/exames` | `exam:read` | 200 |
| `GET /portal/clinicas/agendamentos` | `clinic:read` | 200 |
| `GET /portal/clinicas/financeiro` | `clinic:read` | 200 |
| `GET /portal/clinicas/ordens-servico/42/recibo` | `clinic:read` | 200 |
| `POST /portal/exames/17/download-url` | `exam:download` | 200 |
| `GET /portal/anexos/20/arquivo` | `exam:download` | 200 |

As quatro abas (Visao geral, Laudos, Agenda, Financeiro) aparecem e carregam dados;
o cabecalho mostra "Sessao ativa", nao o modo laudos - correto, porque a sessao com
senha carrega `clinic:read`.

**Nenhum 403 na sessao inteira.** Os 401 registrados no console sao todos de
autenticacao, nao de autorizacao: quatro de `POST /portal/auth/refresh` (o portal
tenta retomar sessao antes de mostrar o formulario, e nao havia cookie) e cinco de
`POST /portal/auth/login` antes do login que deu 200.

Conferido de passagem, embora seja criterio de outra feature: `/laudo/<token>` com
token invalido devolve 404 da API e a mensagem generica na tela, sem revelar se o
token existiu (`portal-clinica-link-laudo-whatsapp`, tambem ja em stage).

## 4) Regressao e riscos residuais

- Risco residual 1: o argumento de compatibilidade cobre os **tres pontos de emissao
  conhecidos**. Um quarto ponto que alguem adicione emitindo escopo parcial passaria
  a barrar acesso silenciosamente - CA-003 quebra se isso acontecer nos dois
  servicos, mas nao cobre um ponto de emissao novo em outro arquivo.
- Risco residual 2: endpoint do portal esquecido no levantamento segue sem
  conferencia. Nao quebra nada hoje, porque hoje toda sessao tem tudo; vira furo
  quando existir sessao reduzida. A spec `portal-clinica-dispositivo-confiavel` deve
  reconferir a lista antes de emitir a primeira.
- Risco residual 3: o default `clinic:read` no helper protege endpoint novo, mas
  tambem pode barrar por engano um endpoint futuro que devesse ser aberto a sessao
  reduzida. O erro, nesse caso, e visivel (403 em desenvolvimento) e nao silencioso.
- Regressao: suite completa verde.

## 5) Itens fora de escopo entregues

- `migrations-ci.yml` ganhou um arquivo de teste. Esta em RF-010, mas vale registrar
  que e o unico arquivo fora de `backend/` e `docs/` no diff.

## 6) Decisao de release

- [x] Aprovado para stage.
- [x] Aprovado para producao - Cenario 1 conferido em stage em 18/09/2026, sem
      nenhum 403 e com os seis endpoints em 200.
- [ ] Nao aprovado.
