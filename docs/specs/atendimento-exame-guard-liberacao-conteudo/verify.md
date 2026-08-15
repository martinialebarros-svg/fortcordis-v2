# Verify - atendimento-exame-guard-liberacao-conteudo

Data: 2026-08-07
Responsavel: Claude (Sonnet 5)
Status: done

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | test_atendimento_liberacao_exige_download_real.py::test_anexo_com_metadado_falso_e_bloqueado | ok |
| CA-002 | aceitacao | test_atendimento_liberacao_exige_download_real.py::test_anexo_com_arquivo_local_real_e_liberado | ok |
| CA-003 | aceitacao | test_atendimento_liberacao_exige_download_real.py::test_anexo_com_caminho_arquivo_apontando_para_arquivo_inexistente_e_bloqueado | ok |
| CA-004 | aceitacao | test_atendimento_exame_liberado_conteudo_protegido.py::test_autosave_com_exame_liberado_nao_sobrescreve_resultado | ok |
| CA-005 | aceitacao | test_atendimento_exame_liberado_conteudo_protegido.py::test_exame_nao_liberado_continua_aceitando_edicao_normal | ok |
| CA-006 | aceitacao | test_atendimento_exame_liberado_conteudo_protegido.py::test_apos_revogar_liberacao_conteudo_volta_a_ser_editavel | ok |
| CB-001 | caso de borda | logica `any(...)` inalterada - garantido pela mudanca ser aditiva (AND, nao substituicao da condicao existente) | ok (por construcao) |
| CB-002 | caso de borda | `exame.valor` fora do bloco protegido - confirmado por leitura de codigo (linha nao movida) | ok |
| NFR-001 | seguranca | CA-001 prova o fechamento do gap especifico do PoC da auditoria | ok |
| NFR-002 | integridade | CA-004/CA-005/CA-006 provam a protecao + reversibilidade | ok |

## 2) Testes automatizados executados

Comandos:

```bash
cd backend
./venv/bin/python -m pytest tests/test_atendimento_liberacao_exige_download_real.py \
  tests/test_atendimento_exame_liberado_conteudo_protegido.py \
  tests/test_atendimento_portal_exam_release.py \
  tests/test_atendimento_observacoes_portal_preservadas.py -v --no-header

./venv/bin/python -m pytest tests/ -q --no-header
```

Resumo dos resultados:
- Backend (arquivos da feature + fixtures corrigidos): 15 passed, 0 failed
  (3 + 3 novos, 2 + 4 existentes corrigidos e reverificados).
- Backend (suite completa): 673 passed, 0 failed (baseline antes deste
  pacote: 657).
- Frontend: N/A (sem mudanca de frontend nesta feature).

## 3) Testes manuais

Nao aplicavel - ambos os cenarios adversariais (anexo com metadado falso;
conteudo sobrescrito enquanto liberado) sao deterministicos e cobertos
integralmente por teste automatizado chamando as funcoes de dominio
diretamente, sem depender de rede real ou navegador.

## 4) Regressao e riscos residuais

- Risco residual 1 (documentado no intent.md, aceito conscientemente): uma
  URL com host publico real mas nao-legitimo ainda passaria
  `attachment_has_download_source` - fechar esse residual exige uma
  allowlist de hosts confiaveis para anexo "externo", fora do escopo desta
  correcao pontual.
- Risco residual 2: o frontend continua permitindo a EDICAO visual dos
  campos protegidos mesmo com o exame liberado (sem `disabled` na UI) - o
  usuario pode digitar um novo resultado, salvar, e nao ver erro nenhum
  (o backend so ignora silenciosamente a mudanca). Uma melhoria futura de
  UX seria desabilitar visualmente ou avisar que a edicao nao tera efeito
  enquanto liberado.
- Correcao de processo: os fixtures de teste existentes
  (`test_atendimento_portal_exam_release.py`,
  `test_atendimento_observacoes_portal_preservadas.py`) usavam
  `caminho_arquivo` fake (nunca escrito no disco) - corrigidos para
  escrever um arquivo real no `tmpdir` de cada teste. Isso NAO e uma
  fraqueza desta correcao; e exatamente a lacuna que o achado #20 da
  auditoria apontou como faltando ("nao ha nenhum teste que exercite anexo
  com metadado falso").

## 5) Itens fora de escopo entregues

Nenhum.

## 6) Decisao de release

- [x] Aprovado para stage.
- [x] Aprovado para producao.
- [ ] Nao aprovado (descrever motivo).
