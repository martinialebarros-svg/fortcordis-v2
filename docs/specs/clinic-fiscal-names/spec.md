# Spec - clinic-fiscal-names

Data: 2026-05-03  
Responsavel: Codex  
Status: done

## 1) Escopo funcional

Adicionar campos fiscais visiveis ao cadastro de clinicas. A UI deve mostrar `Nome Fantasia` usando o campo existente `nome` e `Razao Social` usando o campo existente `razao_social`. O cadastro rapido de clinica no modal de agendamento tambem deve enviar `razao_social` para evitar clinicas novas sem dado fiscal.

## 2) Requisitos funcionais (RF)

- RF-001: a tela de nova clinica deve exibir `Nome Fantasia *` e `Razao Social`.
- RF-002: a tela de edicao de clinica deve carregar, exibir e salvar `razao_social`.
- RF-003: o cadastro rapido de clinica no modal de agendamento deve permitir preencher `Razao Social` e enviar o campo no `POST /clinicas`.
- RF-004: a listagem de clinicas deve permitir busca por `razao_social` e exibir o dado quando preenchido.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (compatibilidade): preservar `nome` como identificador principal/nome fantasia usado pelos demais modulos.
- NFR-002 (operacao): nao exigir migracao, pois `razao_social` ja existe no modelo/API.
- NFR-003 (seguranca): nao alterar permissoes nem endpoints autenticados.

## 4) Contratos tecnicos

### API

- Endpoints: `POST /clinicas`, `PUT /clinicas/{id}`, `GET /clinicas`, `GET /clinicas/{id}`.
- Payload: `nome` continua obrigatorio; `razao_social` continua opcional.
- Resposta: sem mudanca de formato; serializer ja retorna `razao_social`.

### Banco/migracoes

- Tabelas/colunas afetadas: leitura/escrita de `clinicas.razao_social`.
- Indices/constraints: sem alteracao.
- Migracao necessaria: nao.

### Frontend

- Telas afetadas: `/clinicas`, `/clinicas/novo`, `/clinicas/[id]` e modal `NovoAgendamentoModal`.
- Estados de UI: adicionar `razao_social` aos formularios completos e `clinica_nova_razao_social` ao cadastro rapido.
- Regras: `Razao Social` nao bloqueia salvamento; `Nome Fantasia` permanece obrigatorio.

## 5) Compatibilidade e rollout

- Backward compatibility: clientes existentes continuam usando `nome`; fiscal usa `razao_social` quando preenchido e fallback para `nome`.
- Feature flag: nao.
- Rollback: reverter commit da feature e redeploy.

## 6) Criterios de aceitacao (CA)

- CA-001: nova clinica salva `nome` como Nome Fantasia e `razao_social` quando informado.
- CA-002: edicao de clinica preserva e atualiza `razao_social`.
- CA-003: cadastro rapido via agenda envia `razao_social` no payload de criacao.
- CA-004: listagem encontra clinicas por razao social.

## 7) Casos de borda

- CB-001: razao social vazia deve salvar como string vazia sem bloquear o cadastro.
- CB-002: clinicas antigas sem razao social seguem visiveis e editaveis.

## 8) Fora de escopo

- Emissao automatica de NFS-e.
- Normalizacao ou validacao de CNPJ/razao social.
