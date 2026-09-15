# Spec - meta-app-publication

Data: 2026-08-12
Responsavel: Martiniano + Codex
Status: stage-implementation

## Requisitos funcionais

- RF-001: disponibilizar uma politica de privacidade publica, sem autenticacao, em `/privacidade`.
- RF-002: disponibilizar termos de uso publicos, sem autenticacao, em `/termos`.
- RF-003: disponibilizar instrucoes publicas de exclusao de dados, sem autenticacao, em `/exclusao-de-dados`.
- RF-004: as paginas devem identificar a Fort Cordis, o canal de contato e o uso da Plataforma WhatsApp Business.
- RF-005: a pagina de exclusao deve orientar validacao de identidade sem solicitar senha, token ou dado clinico.

## Requisitos nao funcionais

- NFR-001: as paginas devem ser responsivas e legiveis em telas moveis e desktop.
- NFR-002: as paginas nao dependem de sessao, banco de dados ou API autenticada.
- NFR-003: os textos nao devem expor segredo tecnico, dado de paciente ou dado de tutor.
- NFR-004: metadados devem fornecer titulo, descricao e URL canonica por rota.

## Criterios de aceitacao

- CA-001: as tres rotas compilam no build Next.js.
- CA-002: requisicoes anonimas para as tres rotas retornam `200` em stage.
- CA-003: a politica menciona finalidades, compartilhamento, retencao, seguranca e direitos.
- CA-004: os termos deixam claro que o canal nao substitui atendimento veterinario de emergencia.
- CA-005: as instrucoes de exclusao informam canal, dados minimos, validacao, prazo de resposta e hipoteses de retencao.
