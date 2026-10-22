# Verify - atendimento-pdf-auth-hardening

## Revisao 2026-10-22 — sessao Supabase nos PDFs

Base local: `origin/stage` em `ec956a0f`, worktree isolado `receita-impressao`.
Status: correcao e validacao locais concluidas; nenhuma publicacao executada neste ciclo.

### Diagnostico observado (somente leitura em producao)

- Producao em `1a7cd0aa`, `AUTH_PROVIDER=supabase`.
- Logs de 2026-10-22 entre 17:01 e 17:06 UTC mostram repetidos `401` nos downloads de receita dos dois atendimentos associados ao relato da paciente. Consulta com transacao `READ ONLY` confirmou a correspondencia; nenhum dado clinico foi alterado ou exportado.
- `_autenticar_usuario_pdf` extraia o cookie corretamente, mas tentava decodifica-lo com a chave JWT legada. `get_current_user`, usado nas demais rotas, ja validava Supabase e o vinculo com usuario/permissoes locais.
- Tambem ha `QueuePool TimeoutError` em outras chamadas. Sao uma ocorrencia distinta; nao se atribui a eles o `401` dos PDFs nem se altera o pool nesta correcao.

### Matriz atual

| ID | Evidencia local | Status |
| --- | --- | --- |
| CA-001 | Token na URL retorna `400` nas quatro rotas antes de consultar o provedor | ok |
| CA-002 | Sem credenciais retorna `401`; cookie valido permite download | ok |
| CA-003 | Bearer legado invalido e sessao Supabase revogada retornam `401` | ok |
| CA-004 | Bearer legado e Supabase sao aceitos pelos respectivos provedores | ok |
| CA-005 | 203 testes de Atendimento e 20 de Supabase Auth passam | ok |
| CA-006 | HTTP com cookie atual + bearer antigo chega ao `404` funcional de atendimento inexistente nas quatro rotas; download de receita principal/complementar existente retorna `200 application/pdf`, texto correto e sem mistura de medicamentos; atendimento continua concluido | ok |
| CA-007 | Usuario inativo/sem permissao recebem `403`, vinculo apenas em `user_metadata` recebe `401`, indisponibilidade recebe `503` | ok |

Os testes HTTP usam SQLite descartavel e identidades/receitas sinteticas. Apenas o retorno do provedor externo e o branding sao simulados; autenticacao central, vinculo com usuario local, matriz, selecao da receita e geracao do PDF sao reais. Nao e uma prova de publicacao ou de sessao Supabase real.

### Validacao reproduzivel

Executado na raiz do worktree, usando o Python do ambiente local existente:

```bash
/Users/martiniano/fortcordis-v2/backend/venv/bin/python -m unittest discover -s backend/tests -p 'test_atendimento*.py' -q
# 203 testes, OK (inclui 14 de auth PDF)
/Users/martiniano/fortcordis-v2/backend/venv/bin/python -m unittest discover -s backend/tests -p test_supabase_auth.py -q
# 20 testes, OK
git diff --check
```

Antes da correcao, os novos testes HTTP reproduziram `401` com sessao Supabase valida; depois da delegacao ao resolvedor central, a mesma requisicao emite PDF ou chega ao erro funcional esperado. Sintaxe Python e gate SDD sobre a lista de arquivos modificados tambem validados.

### Limites e proxima validacao operacional

- Sem mudanca de layout, frontend, schema, configuracao, contas, papeis ou dados da paciente.
- A validacao em stage e a publicacao em producao continuam sendo etapas separadas. Apos publicacao autorizada: testar o download pela sessao real da equipe e verificar ausencia de novos `401` na rota de receita.
- Rollback: reverter somente esta correcao; nao exige restauracao de dados nem alteracao do provedor de login.

---

## Publicacao autorizada em 22/10/2026 — preflight

O usuario autorizou publicar em producao e validar a impressao da receita da
paciente do relato. A PR #424 integrou o patch a stage em `41b234c1`; a PR #425
contem somente os quatro arquivos desta correcao, baseada em `1a7cd0aa`.
O hotfix preserva a correcao regional exclusiva de stage fora de producao e
sera reintegrado imediatamente em stage. Gates locais SDD e criterios de
promocao passaram sem excecao. Os gates da PR #424 passaram integralmente.

Antes da publicacao, foram registrados hashes dos seis arquivos runtime e
dos atendimentos, receitas e itens envolvidos, em transacao READ ONLY.
A validacao final pode preencher apenas a data normal de primeira emissao do
PDF; conteudo da receita, medicamentos e estado do atendimento devem permanecer
iguais. A sessao tecnica de canario sera revogada ao terminar, sem envio de
email nem alteracao de senha. O merge da PR #424 nao gerou workflow de push;
esta atualizacao registra o preflight concreto e segue pelo merge normal via
CLI, sem commit vazio, mudanca de workflow ou bypass dos gates.

---

## Registro historico de 2026-04-03 (anterior a migracao de autenticacao)

Data: 2026-04-03  
Responsavel: Equipe FortCordis  
Status: approved

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | unit test + stage (`GET /prescricao/pdf?access_token=abc` => `400`) | ok |
| CA-002 | aceitacao | unit test + stage (`GET /prescricao/pdf` sem header => `401`) | ok |
| CA-003 | aceitacao | unit test + stage (`Authorization: Bearer invalido` => `401`) | ok |
| CA-004 | aceitacao | unit test + stage (`GET /atendimentos/6/prescricao/pdf` com bearer tecnico => `200`) | ok |
| CA-005 | aceitacao | `backend/.venv/Scripts/python -m unittest backend/tests/test_atendimento_pdf_auth.py -v` | ok |
| NFR-001 | nao funcional | bloqueio explicito no helper `_autenticar_usuario_pdf` | ok |
| NFR-002 | nao funcional | testes cobrindo `400` (query token), `401` (sem/invalid bearer), `403` (usuario inativo) | ok |
| NFR-003 | nao funcional | detalhe de erro orientativo para uso de header bearer | ok |

## 2) Testes automatizados executados

Comandos:

```bash
# backend
backend/.venv/Scripts/python -m unittest backend/tests/test_atendimento_pdf_auth.py -v
backend/.venv/Scripts/python -m unittest backend/tests/test_atendimento_pdf_auth.py backend/tests/test_atendimento_upload_service.py backend/tests/test_atendimento_upload_endpoint.py -v
```

Resumo dos resultados:
- Backend: suite alvo (5/5 pass) e regressao relacionada (19/19 pass).
- Frontend: nao aplicavel nesta iteracao.

## 3) Testes manuais

- Cenario 1: download PDF prescricao com sessao autenticada.
- Cenario 2: download PDF exames com sessao autenticada.
- Cenario 3: tentativa manual com query token sem header (esperado: bloqueio `400`).
- Evidencias stage (2026-04-03):
- `GET http://127.0.0.1:8001/api/v1/atendimentos/1/prescricao/pdf?access_token=abc` => `400` + detalhe orientando header bearer.
- `GET http://127.0.0.1:8001/api/v1/atendimentos/1/prescricao/pdf` sem header => `401`.
- `GET http://127.0.0.1:8001/api/v1/atendimentos/1/prescricao/pdf` com bearer invalido => `401`.
- `GET http://127.0.0.1:8001/api/v1/atendimentos/6/prescricao/pdf` com bearer tecnico => `200` (PDF gerado).
- `GET http://127.0.0.1:8001/api/v1/atendimentos/6/exames/pdf` com bearer tecnico => `404` funcional (`Nao ha exames para este atendimento.`), validando que auth foi aceita (nao `401`).
- Log backend stage sem `500` para os cenarios executados.
- Status: concluido para gate de seguranca/auth em stage.

## 4) Regressao e riscos residuais

- Risco residual 1: cliente externo legado com query token deixar de funcionar.
- Risco residual 2: ausencia de teste de integracao HTTP fim a fim nesta iteracao.

## 5) Itens fora de escopo entregues

- Nenhum item fora de escopo entregue nesta iteracao.

## 6) Decisao de release

- [x] Aprovado para stage.
- [ ] Aprovado para producao.
- [ ] Nao aprovado (descrever motivo).

## 7) Checklist operacional rapido (stage)

1. Abrir atendimento autenticado no stage e gerar PDF de prescricao.
2. Gerar PDF de exames no mesmo atendimento.
3. Chamar endpoint PDF manualmente com `?access_token=abc` e sem header.
4. Confirmar retorno `400` com mensagem orientando `Authorization: Bearer`.
5. Confirmar que nao houve erro `500` nos logs do backend stage.
