# Spec - atendimento-demographics-document-sync

Data: 2026-07-30
Responsavel: Codex
Status: done

## 1) Objetivo

Tornar a correcao cadastral parte natural do atendimento e assegurar que
documentos clinicos reimpressos reflitam o cadastro atual do paciente e do
tutor.

## 2) Requisitos funcionais

- RF-001: o cabecalho clinico deve oferecer uma acao visivel
  `Editar paciente e tutor` quando houver paciente selecionado.
- RF-002: a acao deve abrir e posicionar a complementacao cadastral sem trocar
  de pagina.
- RF-003: a complementacao deve permitir editar, no minimo:
  - nome, especie, raca, sexo, data de nascimento e peso do paciente;
  - nome, contatos, CPF e endereco do tutor.
- RF-004: o salvamento da complementacao deve enviar paciente e tutor juntos
  para o cadastro oficial, sem ignorar silenciosamente falhas do tutor.
- RF-005: atualizacoes parciais do paciente nao podem substituir campos
  omitidos por valores padrao; em particular, omitir `sexo` nunca pode
  redefini-lo como `Macho`.
- RF-006: receita e solicitacao de exame devem resolver o paciente e o tutor
  atualmente vinculados no momento da geracao do PDF.
- RF-007: uma receita ou solicitacao ja registrada deve manter itens,
  orientacoes e exames originais, mas uma nova impressao deve usar nome, sexo e
  tutor atuais no cabecalho.
- RF-008: o cabecalho clinico deve exibir o sexo atual do paciente e informar
  que os dados salvos serao usados nas reimpressoes.

## 3) Requisitos nao funcionais

- NFR-001 (fonte unica): dados demograficos do PDF devem vir do cadastro atual
  de `Paciente` e do `Tutor` atualmente ligado ao paciente.
- NFR-002 (cache): respostas de download de PDF devem enviar
  `Cache-Control: no-store` e cabecalhos equivalentes; a interface tambem deve
  adicionar um identificador unico por impressao.
- NFR-003 (integridade): a correcao cadastral nao pode reescrever itens de
  prescricao, orientacoes, exames, resultados ou conduta clinica.
- NFR-004 (compatibilidade): atendimentos antigos que ainda apontem para um
  tutor anterior devem usar o tutor atual do paciente na nova impressao.
- NFR-005 (escopo): nenhum deploy ou promocao de ambiente faz parte desta
  entrega sem solicitacao explicita.

## 4) Contratos

### Atualizacao de paciente

`PUT /api/v1/pacientes/{paciente_id}` aceita payload parcial. Apenas campos
presentes sao alterados. Campos de tutor presentes no mesmo payload atualizam
o tutor ligado ao paciente.

### Downloads

- `GET /api/v1/atendimentos/{id}/prescricao/pdf`
- `GET /api/v1/atendimentos/{id}/exames/pdf`
- `GET /api/v1/atendimentos/{id}/documentos/{documento_id}/pdf`

As respostas devem impedir cache e gerar o arquivo a partir do contexto
cadastral consultado naquele momento.

## 5) Criterios de aceitacao

- CA-001: do cabecalho clinico, um clique abre a edicao de paciente e tutor.
- CA-002: o campo sexo aparece na complementacao e o valor salvo aparece no
  cabecalho.
- CA-003: salvar nome do tutor e sexo do paciente persiste ambos no cadastro
  oficial.
- CA-004: atualizar somente o nome do paciente preserva sexo, raca e demais
  campos omitidos.
- CA-005: uma receita existente, reimpressa depois da correcao, contem sexo e
  tutor atuais.
- CA-006: uma solicitacao existente, reimpressa depois da correcao, contem
  sexo e tutor atuais.
- CA-007: downloads de PDF retornam politica `no-store` e cada solicitacao da
  interface possui parametro unico.
- CA-008: testes backend, lint, TypeScript, build e guardrail SDD passam.
