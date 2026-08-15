# Spec - portal-clinica-financeiro-os

Data: 2026-08-08
Responsavel: Martiniano + Claude
Status: draft (implementado; aguardando QA)

## 1) Escopo funcional

No portal da clinica parceira, adicionar um bloco "Financeiro da unidade" com um resumo (total e
quantidade pendente/pago) e duas listas — Ordens de Servico pendentes e pagas — da propria
clinica. Nao aparece no modo de espelho administrativo (`admin_preview`).

## 2) Requisitos funcionais (RF)

- RF-001: `GET /api/v1/portal/clinicas/financeiro` retorna, para a clinica da sessao
  (`portal_session.clinica_id`): resumo agregado + lista de OS com status "Pendente" (ate 200) +
  lista de OS com status "Pago" (as 50 mais recentes).
- RF-002: OS com status "Cancelado" nunca aparecem (nem no resumo, nem nas listas).
- RF-003: O resumo (`total_pendente`, `total_pago`, `quantidade_pendente`, `quantidade_pago`) e
  calculado sobre todos os registros da clinica, independente do limite de exibicao das listas.
- RF-004: Cada item da lista inclui numero da OS, status, valor (`valor_final`), data do
  atendimento, nome do pet e nome do servico (via join com `Paciente`/`Servico`).
- RF-005: No frontend, o bloco so carrega/aparece quando a sessao e uma clinica real (nao
  `admin_preview`); tem botao "Atualizar" para recarregar sob demanda.
- RF-006: Quando a quantidade total de "pagas" excede o limite exibido, a UI mostra
  "Mostrando X de Y" para deixar claro que a lista nao e exaustiva (o resumo, sim).

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (seguranca/permissoes): `clinica_id` sempre resolvido a partir do
  `PortalSessionContext` (token) via `_exigir_sessao_clinica_portal` (mesmo helper usado pelos
  endpoints de agendamentos), nunca de parametro do cliente.
- NFR-002 (exposicao minima de dados): a resposta nao inclui forma de pagamento, taxas,
  desconto, `criado_por_nome`, `observacoes` da OS, nem qualquer campo de
  `Transacao`/`ContaPagar`/`ContaReceber`/`CreditoFinanceiro`.
- NFR-003 (consistencia): usa a mesma convencao de status observada em `resumo_financeiro_agenda`
  (agenda.py) — `OrdemServico.status != "Cancelado"` para excluir OS canceladas; aqui filtramos
  explicitamente por `== "Pendente"` / `== "Pago"`, o que tem o mesmo efeito (exclui Cancelado por
  omissao).

## 4) Contratos tecnicos

### API

- `GET /api/v1/portal/clinicas/financeiro`
  - Auth: `PortalSessionContext` (`actor_type == "clinica"`, `clinica_id` presente e ativo).
  - Resposta: `PortalClinicaFinanceiroResponse` (`clinica_id`, `clinica_nome`,
    `summary: PortalClinicaFinanceiroSummaryResponse`,
    `pendentes: PortalClinicaOrdemServicoItemResponse[]`,
    `pagas: PortalClinicaOrdemServicoItemResponse[]`).
  - Erros: 403 (sessao sem clinica ativa).

### Banco/migracoes

- Nenhuma coluna nova. Somente leitura em `ordens_servico` (existente), com join em `pacientes` e
  `servicos` (existentes).
- Migracao necessaria: nao.

### Frontend

- Telas afetadas: `frontend/components/portal/PortalClinicaWorkspace.tsx` (novo bloco "Financeiro
  da unidade"), novas funcoes/tipos em `frontend/lib/portal-api.ts`
  (`getPortalClinicFinanceiro`).
- Estados de UI: carregando / erro / vazio (por lista) / resumo sempre visivel mesmo com listas
  vazias.

## 5) Compatibilidade e rollout

- Backward compatibility: total; endpoint e bloco de UI sao aditivos.
- Feature flag: nao ha. Fica pendente de QA manual do usuario em stage antes de promover para
  main/producao (fluxo definido pelo proprio usuario).
- Estrategia de rollback: reverter os commits de backend/frontend; nenhuma migracao para desfazer.

## 6) Criterios de aceitacao (CA)

- CA-001: Clinica A ve, no portal, apenas as OS com `clinica_id` dela; nao ve OS da Clinica B.
- CA-002: OS "Cancelado" nunca aparece nas listas nem conta para o resumo.
- CA-003: O resumo mostra o total/quantidade reais mesmo quando a lista de "pagas" excede 50
  registros (a UI sinaliza "Mostrando X de Y" nesse caso).
- CA-004: Clinica sem nenhuma OS ve resumo zerado e listas vazias, sem erro.
- CA-005: O bloco de financeiro nao aparece quando a tela esta em modo `admin_preview`.

## 7) Casos de borda

- CB-001: Paciente ou servico com registro removido/orfão (sem correspondencia na tabela) —
  join e `outerjoin`, entao o item aparece com `paciente_nome`/`servico_nome` nulos em vez de
  quebrar a consulta.
- CB-002: Clinica com mais de 200 OS pendentes — lista truncada em 200; resumo continua exato.
  Nao ha aviso de truncamento para "pendentes" nesta primeira versao (assumindo que pendencias
  em aberto raramente passam desse volume); considerar o mesmo aviso de "pagas" se necessario.

## 8) Fora de escopo

- Analytics/dashboards financeiros executivos (ver `portal-access-ui/intent.md`).
- Financeiro para o portal do veterinario parceiro (`actor_type == "parceiro"`).
- Exposicao de `Transacao`, `ContaPagar`, `ContaReceber`, `CreditoFinanceiro`.
- Detalhamento de forma de pagamento/parcelas por OS.
- Emissao de boleto/link de pagamento pelo portal.
