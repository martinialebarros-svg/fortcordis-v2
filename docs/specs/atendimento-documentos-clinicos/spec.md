# Spec - atendimento-documentos-clinicos

Data: 2026-05-01
Responsavel: Codex
Status: done

## 1) Escopo funcional

Adicionar ao modulo de atendimento uma area de documentos clinicos com templates editaveis e documentos salvos por atendimento. O usuario pode criar um documento a partir de um template, revisar o texto final e gerar PDF no layout FortCordis.

## 2) Requisitos funcionais (RF)

- RF-001: Listar, criar, editar, desativar e reativar templates de documentos clinicos.
- RF-002: Criar documentos dentro de um atendimento usando um template ou texto livre.
- RF-003: Substituir variaveis de contexto como `{{paciente_nome}}`, `{{tutor_nome}}`, `{{veterinario_nome}}`, `{{crmv}}` e dados clinicos do atendimento.
- RF-004: Salvar documentos editados no prontuario do atendimento.
- RF-005: Gerar PDF do documento com cabecalho, logomarca, assinatura e rodape do FortCordis.
- RF-006: `{{tutor_nome}}` deve refletir o tutor atual vinculado ao paciente, mesmo quando o atendimento foi criado antes da alteracao do cadastro.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (performance): A listagem de templates/documentos deve usar consultas simples indexadas por status, tipo e atendimento.
- NFR-002 (seguranca/permissoes): Endpoints usam autenticacao existente; PDF usa bearer header e rejeita token por query string.
- NFR-003 (compatibilidade): Novas tabelas nao alteram contratos atuais de prescricoes, exames, anexos ou evolucoes.

## 4) Contratos tecnicos

### API

- `GET /api/v1/atendimentos/documentos/templates`
- `POST /api/v1/atendimentos/documentos/templates`
- `PUT /api/v1/atendimentos/documentos/templates/{template_id}`
- `DELETE /api/v1/atendimentos/documentos/templates/{template_id}`
- `POST /api/v1/atendimentos/{atendimento_id}/documentos`
- `PUT /api/v1/atendimentos/{atendimento_id}/documentos/{documento_id}`
- `DELETE /api/v1/atendimentos/{atendimento_id}/documentos/{documento_id}`
- `GET /api/v1/atendimentos/{atendimento_id}/documentos/{documento_id}/pdf`

### Banco/migracoes

- Tabelas novas: `documentos_atendimento_templates`, `documentos_atendimento`.
- Indices: nome/tipo/ativo de templates; atendimento/template/status de documentos.
- Migracao necessaria: sim, `20260501_33_atendimento_documentos_templates.py`.

### Frontend

- Tela afetada: `frontend/app/atendimento/page.tsx`.
- Componente afetado: `AtendimentoDocumentosSection`.
- Estados de UI: template selecionado, editor de documento, editor de template, loading de salvar/gerar PDF.

## 5) Compatibilidade e rollout

- Backward compatibility: contratos existentes continuam aceitando os mesmos payloads.
- Feature flag: nao.
- Rollback: remover a secao de UI e desabilitar endpoints novos; tabelas podem permanecer sem impacto nos fluxos atuais.

## 6) Criterios de aceitacao (CA)

- CA-001: Um template "Parecer medico veterinario" existe como seed e pode gerar documento com dados do paciente.
- CA-002: O texto final do documento pode ser editado e salvo no atendimento.
- CA-003: O PDF gerado usa o mesmo helper de cabecalho/assinatura/rodape FortCordis.
- CA-004: Templates podem ser criados, editados, desativados e reativados.

## 7) Casos de borda

- CB-001: Template inativo nao deve gerar novo documento.
- CB-002: Documento sem titulo ou corpo deve ser rejeitado.
- CB-003: Variavel desconhecida deve permanecer no texto para revisao manual.
- CB-004: Rascunhos criados por template e ainda nao editados podem ser re-renderizados com contexto atual ao gerar PDF; documentos ja emitidos ou editados manualmente preservam o texto salvo.

## 8) Fora de escopo

- Assinatura digital com certificacao.
- Historico completo de revisoes de cada documento.
