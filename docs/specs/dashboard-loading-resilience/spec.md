# Spec - dashboard-loading-resilience

Data: 2026-09-07
Responsável: Codex / equipe FortCordis
Status: em implementação

## Escopo funcional

- RF-001: Dashboard deve iniciar em paralelo as leituras seguras existentes de Agenda, Pacientes, Clínicas e Serviços.
- RF-002: uma seção bem-sucedida deve permanecer visível se outra seção falhar ou exceder o timeout existente.
- RF-003: valores de uma seção pendente ou falha devem ser exibidos como desconhecidos, nunca como contagem zero.
- RF-004: a falha deve identificar as seções indisponíveis e oferecer nova tentativa somente para elas.
- RF-005: uma tentativa substituída ou o desmontagem da rota deve cancelar as leituras pendentes; respostas tardias não podem sobrescrever dados atuais.
- RF-006: a Agenda deve ter estado próprio de carregamento, erro e nova tentativa, sem afetar os indicadores já confirmados.

## Requisitos não funcionais

- NFR-001: usar somente `GET` idempotentes e a política compartilhada de timeout de 15 segundos; mutações não são tocadas.
- NFR-002: contratos, permissões e payloads das APIs existentes permanecem inalterados.
- NFR-003: erros técnicos podem ir ao console por seção, sem registrar payload clínico, financeiro ou identificadores.
- NFR-004: a mudança melhora recuperação e transparência da interface, mas não substitui a correção da conectividade de entrada da VPS.

## Critérios de aceitação

- CA-001: os quatro requests são iniciados sem aguardar a resposta de Agenda.
- CA-002: a falha de uma seção não remove os valores já confirmados das demais.
- CA-003: sucesso, falha e cancelamento possuem cobertura unitária.
- CA-004: o alerta lista somente as seções falhas e o botão repete somente essas leituras.
- CA-005: lint, TypeScript, build e guardrail SDD concluem sem falhas.

## Rollback

Reverter apenas os arquivos desta feature restaura o comportamento anterior; não há migração ou dado persistido para recuperar.
