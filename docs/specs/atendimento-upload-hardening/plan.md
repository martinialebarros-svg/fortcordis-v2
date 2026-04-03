# Plan - atendimento-upload-hardening

Data: 2026-04-03  
Responsavel: Equipe FortCordis  
Status: done

## 1) Sequencia de fases

- Fase 1 (backend validacao): allowlist de tipo + normalizacao de validacao.
- Fase 2 (backend endpoint): integrar erros HTTP e logs de rejeicao.
- Fase 3 (frontend): alinhar input `type=file` e mensagens para o usuario.
- Fase 4 (qualidade): testes automatizados + homologacao em stage.

## 2) Tarefas por fase

### Fase 1

- [x] T1.1 Definir allowlist oficial (MIME e extensao) para piloto.
- [x] T1.2 Criar helper de validacao de tipo para upload de atendimento.
- [x] T1.3 Garantir regra de tamanho e mensagem consistente.
- Criterio de conclusao: helper de validacao aprovado e reutilizavel no endpoint.
- Risco: lista inicial excluir formato usado no dia a dia.
- Rollback: restaurar comportamento anterior removendo validacao nova.

### Fase 2

- [x] T2.1 Integrar validacao no endpoint `upload_anexo`.
- [x] T2.2 Mapear erros de tipo/tamanho para `400`/`413` de forma explicita.
- [x] T2.3 Adicionar logs para rejeicoes com motivo.
- Criterio de conclusao: endpoint rejeita casos invalidos sem gravar dados.
- Risco: regressao em fluxo de upload associado a exame.
- Rollback: revert do bloco do endpoint e service de upload.

### Fase 3

- [x] T3.1 Definir `accept` no input de upload em `frontend/app/atendimento/page.tsx`.
- [x] T3.2 Manter exibicao de erro por `detail` da API para casos invalidos.
- [x] T3.3 Revisar mensagem de sucesso/erro para clareza operacional.
- Criterio de conclusao: UX evita selecao de tipos nao permitidos e apresenta erro claro.
- Risco: comportamento diferente entre navegadores no filtro `accept`.
- Rollback: retirar `accept` e manter apenas validacao server-side.

### Fase 4

- [x] T4.1 Criar testes backend para sucesso e rejeicao.
- [x] T4.2 Executar validacao manual de upload na tela de atendimento.
- [x] T4.3 Rodar homologacao curta em stage antes de promocao.
- Criterio de conclusao: criterios de aceitacao mapeados com evidencia no `verify.md`.
- Risco: cobertura insuficiente de cenarios reais.
- Rollback: bloquear promocao para prod ate ampliar evidencias.

## 3) Plano de testes

- Testes unitarios/backend:
- Criar arquivo novo em `backend/tests/` para upload de anexos.
- Cobrir tipo permitido, tipo invalido, vazio e acima do limite.
- Testes de integracao:
- Exercitar endpoint real com `TestClient` e banco de teste.
- Testes manuais:
- Upload geral e upload vinculado a exame na tela de atendimento.
- Download/preview de anexo aceito.
- Confirmacao de mensagem de erro para tipo nao permitido.

## 4) Dependencias e bloqueios

- Dependencia 1: validar em stage com equipe se allowlist inicial cobre os anexos reais. (concluido)
- Dependencia 2: ambiente stage disponivel para homologacao de fluxo. (concluido)

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado para evoluir.
- [x] `spec.md` rascunhado com RF/NFR/CA.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido (local/stage).
