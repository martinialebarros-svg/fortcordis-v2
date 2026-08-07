# Plan - atendimento-exame-guard-liberacao-conteudo

Data: 2026-08-07
Responsavel: Claude (Sonnet 5)
Status: done

## 1) Sequencia de fases

- Fase 1 (DB/migracoes): nao aplicavel.
- Fase 2 (backend/API): guard de liberacao (#20) + protecao de conteudo
  (#25).
- Fase 3 (frontend): nao aplicavel (ver spec.md, "Frontend").
- Fase 4 (integracao/observabilidade): testes + correcao de fixtures
  existentes.

## 2) Tarefas por fase

### Fase 2

- [x] T2.1 - Import de `attachment_has_download_source` em `atendimento.py`.
- [x] T2.2 - `liberar_exame_no_portal`: guard combinado
  (`_anexo_eh_pdf(anexo) and attachment_has_download_source(anexo)`).
- [x] T2.3 - `_sync_exames`: mover `resultado`/`valor_referencia`/`unidade`
  para dentro do `if not is_portal_released_status(exame.status):` que ja
  protegia `observacoes`.
- Criterio de conclusao: os testes de T4.1 passam.
- Risco: fixtures existentes com `caminho_arquivo` fake - identificado e
  corrigido em T4.2.
- Rollback: reverter o commit.

### Fase 4

- [x] T4.1 - Testes novos:
  `test_atendimento_liberacao_exige_download_real.py` (3 testes) e
  `test_atendimento_exame_liberado_conteudo_protegido.py` (3 testes).
- [x] T4.2 - Corrigir fixtures de
  `test_atendimento_portal_exam_release.py` e
  `test_atendimento_observacoes_portal_preservadas.py`: `caminho_arquivo`
  passa a apontar para um arquivo escrito de fato no `tmpdir` do teste, em
  vez de um caminho `/tmp/*.pdf` que nunca era criado.
- [x] T4.3 - Suite completa do backend.
- Criterio de conclusao: 673/673 testes passando (era 657 antes deste
  pacote).
- Risco: nenhum remanescente.
- Rollback: reverter o commit (inclui a correcao dos fixtures - sem ela,
  os testes antigos voltariam a falhar contra o guard revertido... na
  verdade nao, porque revertendo o guard tambem os fixtures antigos
  voltam a passar; a correcao dos fixtures e compativel com AMBOS os
  estados do guard).

## 3) Plano de testes

- Testes unitarios: 6 testes novos (3 por achado) + 2 arquivos de teste
  existentes corrigidos (7 testes que ja existiam, agora com fixtures
  realistas).
- Testes de integracao: suite completa do backend.
- Testes manuais: nao aplicavel - ambos os cenarios sao deterministicos e
  totalmente reproduziveis via chamada direta as funcoes
  (`liberar_exame_no_portal`, `_sync_exames`) com fixtures controladas,
  sem depender de timing de rede ou navegador.

## 4) Dependencias e bloqueios

- Dependencia 1: `attachment_has_download_source` /
  `resolve_attachment_download_source` (ja existentes, sem modificacao).
- Dependencia 2: `is_portal_released_status` / `_derivar_status_exame` (ja
  existentes, do pacote `atendimento-integridade-prontuario`).

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido (local, SQLite via pytest).
