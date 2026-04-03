# Spec - atendimento-upload-hardening

Data: 2026-04-03  
Responsavel: Equipe FortCordis  
Status: approved

## 1) Escopo funcional

Endurecer upload de anexos do atendimento para reduzir risco de upload indevido e consumo excessivo de memoria. A entrega cobre validacao de tipo de arquivo, validacao de tamanho com erro consistente, alinhamento minimo de UX no frontend e testes automatizados no backend para cenarios positivos e negativos.

Decisao da fase piloto:
- Allowlist oficial: `.pdf`, `.jpg`, `.jpeg`, `.png`, `.webp`.
- MIME oficial: `application/pdf`, `image/jpeg`, `image/png`, `image/webp`.
- Excecao controlada: `application/octet-stream` e aceito somente quando a extensao estiver na allowlist.

## 2) Requisitos funcionais (RF)

- RF-001: `POST /api/v1/atendimentos/{atendimento_id}/anexos/upload` deve aceitar apenas tipos permitidos por allowlist.
- RF-002: validacao de tipo deve considerar extensao normalizada e MIME informado, com regra explicita de compatibilidade.
- RF-003: arquivo vazio deve continuar rejeitado com mensagem clara.
- RF-004: arquivo acima do limite deve ser rejeitado sem persistir registro no banco nem arquivo final no disco.
- RF-005: upload valido deve manter resposta de sucesso no mesmo formato atual (`_serialize_anexo`).
- RF-006: rejeicoes por tipo/tamanho devem retornar erro com mensagem objetiva para o frontend.
- RF-007: frontend deve orientar selecao com `accept` no input de arquivo e exibir mensagem de erro retornada pela API.
- RF-008: adicionar testes automatizados cobrindo aceite e rejeicao de tipo/tamanho.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (seguranca/permissoes): reduzir superficie de upload indevido com allowlist explicita.
- NFR-002 (confiabilidade): nenhum artefato parcial deve ficar no storage apos upload rejeitado.
- NFR-003 (performance/memoria): manter validacao de tamanho robusta e evitar consumo desnecessario em casos acima do limite.
- NFR-004 (observabilidade): registrar motivo de rejeicao de upload para diagnostico em stage/producao.

## 4) Contratos tecnicos

### API

- Endpoint: `POST /api/v1/atendimentos/{atendimento_id}/anexos/upload`
- Metodo: multipart (`arquivo`, `tipo`, `descricao`, `exame_id?`)
- Sucesso: sem mudanca no JSON de retorno atual.
- Erros esperados:
- `400` arquivo vazio.
- `400` tipo nao permitido.
- `413` arquivo acima do limite permitido.
- `404` atendimento/exame nao encontrado.

### Banco/migracoes

- Tabelas/colunas afetadas: `anexos_atendimentos` (somente escrita de dados ja existentes).
- Indices/constraints: sem alteracao.
- Migracao necessaria: nao.

### Frontend

- Tela afetada: `frontend/app/atendimento/page.tsx`.
- Estados de UI: manter `uploadingAttachmentKey`, `setErro`, `setSucesso`.
- Regras de exibicao/erro: exibir `detail` da API quando upload for rejeitado por tipo/tamanho.

## 5) Compatibilidade e rollout

- Backward compatibility: contrato de sucesso permanece estavel.
- Feature flag (se houver): opcional; preferencia inicial sem flag, com rollout controlado por stage.
- Estrategia de rollback: revert do commit da feature e retorno ao comportamento anterior de upload.

## 6) Criterios de aceitacao (CA)

- CA-001: upload de `pdf`, `jpg`, `jpeg`, `png`, `webp` dentro do limite retorna `201` e anexo criado.
- CA-002: upload de extensao/MIME fora da allowlist retorna `400` com detalhe de tipo nao permitido.
- CA-003: upload com tamanho acima do limite retorna `413` e nao cria registro em `anexos_atendimentos`.
- CA-004: input de arquivo no frontend usa `accept` alinhado com allowlist backend.
- CA-005: suite de testes backend inclui ao menos 1 caso valido e 3 casos invalidos (vazio, tipo invalido, acima do limite).

## 7) Casos de borda

- CB-001: arquivo com extensao permitida e MIME generico (`application/octet-stream`).
- CB-002: nome de arquivo sem extensao.
- CB-003: arquivo exatamente no limite de tamanho.
- CB-004: arquivo com nome contendo caracteres especiais/pasta.

## 8) Fora de escopo

- Remocao imediata de todo upload em memoria via stream chunked completo (pode entrar em iteracao seguinte).
- Politica global de storage/retencao de todos os anexos do sistema.
