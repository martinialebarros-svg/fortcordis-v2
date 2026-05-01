# Intent - atendimento-documentos-clinicos

Data: 2026-05-01
Responsavel: Codex
Status: done

## 1) Problema atual

O modulo de atendimento permite registrar evolucoes, prescricoes, solicitacoes de exames e anexos, mas nao oferece um gerador proprio para documentos clinicos livres, como pareceres, atestados, declaracoes e autorizacoes. Hoje um parecer precisa ser montado fora do sistema, perdendo o layout FortCordis e o vinculo direto com o atendimento.

## 2) Objetivo

Permitir criar documentos clinicos dentro do atendimento a partir de templates editaveis, preencher automaticamente dados do paciente/tutor/veterinario, editar o texto final e gerar PDF com o branding ja usado nos documentos FortCordis.

## 3) Nao objetivos

- Criar assinatura eletronicamente verificavel.
- Implementar fluxo de aprovacao ou versionamento completo de documentos.
- Substituir o modulo de laudos especializados.

## 4) Contexto e restricoes

- A geracao de PDF deve reutilizar os helpers existentes de cabecalho, rodape, logomarca e assinatura.
- Os templates devem ser persistidos no backend para nao dependerem do navegador.
- O recurso deve ficar no workspace de Documentos do atendimento.

## 5) Impacto esperado

- Usuarios impactados: veterinarios e equipe administrativa.
- Modulos impactados: atendimento clinico, migracoes, PDF de documentos.
- Risco de regressao: baixo a medio, pois adiciona tabelas/endpoints novos e toca a tela grande de atendimento.

## 6) Riscos iniciais

- Divergencia de layout caso o PDF novo nao reutilize o helper dos laudos.
- Edicao de template afetar apenas novos documentos, nao os documentos ja salvos.

## 7) Perguntas abertas

- Futuramente, documentos emitidos devem ter numero/controle fiscal ou assinatura digital?
- Deve haver permissao especifica para editar templates globais?

## 8) Definition of Ready

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
