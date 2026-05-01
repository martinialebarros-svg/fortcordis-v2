# Plan - atendimento-documentos-clinicos

Data: 2026-05-01
Responsavel: Codex
Status: done

## 1) Sequencia de fases

- Fase 1 (DB/migracoes): criar tabelas e seed de templates veterinarios.
- Fase 2 (backend/API): expor CRUD de templates/documentos e PDF.
- Fase 3 (frontend): adicionar UI na aba Documentos do atendimento.
- Fase 4 (verificacao): cobrir criacao por template e PDF em testes backend, rodar lint/testes possiveis.

## 2) Tarefas por fase

### Fase 1

- [x] T1.1 Adicionar modelos SQLAlchemy.
- [x] T1.2 Criar migracao versionada com indices e templates iniciais.
- Criterio de conclusao: tabelas novas podem ser criadas em SQLite/Postgres.
- Risco: drift de schema em ambientes antigos.
- Rollback: deixar tabelas sem uso e remover chamadas de UI/API.

### Fase 2

- [x] T2.1 Criar schemas Pydantic.
- [x] T2.2 Criar endpoints de templates/documentos.
- [x] T2.3 Criar PDF usando helpers existentes.
- Criterio de conclusao: documento criado por template e PDF retornando bytes validos.
- Risco: rotas dinamicas conflitarem com rotas estaticas.
- Rollback: remover novos endpoints do router.

### Fase 3

- [x] T3.1 Adicionar estados e chamadas API na pagina de atendimento.
- [x] T3.2 Adicionar editor de documentos e templates em `AtendimentoDocumentosSection`.
- Criterio de conclusao: usuario consegue criar, editar, salvar e gerar PDF.
- Risco: tela de atendimento ja e grande e sensivel a erros de tipagem.
- Rollback: ocultar a secao de documentos clinicos.

### Fase 4

- [x] T4.1 Adicionar testes backend focados.
- [x] T4.2 Rodar verificacoes automatizadas finais.
- Criterio de conclusao: testes relevantes passam ou falhas ficam registradas.
- Risco: suite completa pode depender de servicos/estado local.
- Rollback: manter teste focado e registrar limitacoes.

## 3) Plano de testes

- Testes unitarios: renderizacao de template e PDF.
- Testes de integracao: CRUD de template/documento via funcoes dos endpoints com SQLite temporario.
- Testes manuais: criar parecer, editar texto, gerar PDF.

## 4) Dependencias e bloqueios

- Configuracao de logomarca/assinatura existente.
- Autenticacao bearer para download de PDF.

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido: local.
