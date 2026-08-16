# Verify - portal-clinica-parceira-navegacao-abas

Data: 2026-08-16
Responsavel: Claude (pareado com Martiniano)
Status: implementado, confirmado ao vivo em stage

## 1) Matriz de rastreabilidade

| ID | Evidencia | Status |
| --- | --- | --- |
| CA-1 | Sessão `admin_preview` (clínica 11, espelho): aba "Visão geral" abre por padrão com "Aguardando liberação" visível sem rolagem adicional. | ok |
| CA-2 | Aba "Laudos" mostra "Filtros de busca" + "Exames liberados", idêntico ao comportamento anterior. | ok |
| CA-3 | Sessão real (clínica 11, ativada localmente): 1ª abertura de "Agenda" disparou `GET /api/v1/portal/clinicas/agendamentos`; reabrir a aba depois não gerou novo request; conteúdo renderizado corretamente (estado vazio). | ok |
| CA-4 | 1ª abertura de "Financeiro" disparou `GET /api/v1/portal/clinicas/financeiro`; dado real renderizado (Pendente R$460, Pago R$530, OS individuais, botão Recibo). | ok |
| CA-5 | Sessão `admin_preview`: tablist mostra só "Visão geral"/"Laudos" - "Agenda"/"Financeiro" ausentes. | ok |
| CA-6 | Viewport 375px: `document.documentElement.scrollWidth === window.innerWidth` (sem overflow horizontal da página); barra de abas com rolagem horizontal própria. | ok |
| CA-7 | Preenchido "Busca geral" na aba Laudos, trocado para Visão geral e de volta para Laudos - valor do input permaneceu (`teste-persistencia`). | ok |

## 2) Testes automatizados executados

```bash
cd frontend && npx tsc --noEmit --pretty false
# sem saida (0 erros)

cd frontend && npx eslint components/portal/PortalClinicaWorkspace.tsx
# sem saida (0 erros)

cd frontend && npm run build
# build completo, /clinica-parceira e /clinicas/portal/espelho gerados sem erro
```

Não existe suite de testes automatizados (Vitest/RTL) para
`PortalClinicaWorkspace.tsx` - nenhum arquivo de teste cobria este
componente antes desta mudança. Decisão: não criar um harness do zero
só para uma reorganização de apresentação; a cobertura funcional
(CA-3/CA-4/CA-7) veio de verificação manual contra um backend real
(não mockado), descrita abaixo.

## 3) Testes manuais

Ambiente: local (`backend`/`frontend` dev, não stage/produção).

- Cenário 1 (admin preview): login `admin@fortcordis.com` ->
  `/clinicas/portal/espelho?clinica=11` (clínica "casa do caralho") ->
  tablist com 2 abas (Visão geral/Laudos) -> "Visão geral" mostra
  Aguardando liberação/Resumo/Atividade recente -> "Laudos" mostra
  filtros + lista -> preenchido filtro "Busca geral", trocado de aba e
  voltado - valor preservado.
- Cenário 2 (sessão real de clínica parceira): criado convite real via
  `create_clinic_invite` (mesma função usada pelo endpoint de admin)
  para a clínica 11, ativado via `/clinica-parceira/ativar/{token}`
  (fluxo real do produto - nome, senha, confirmação), login efetivado
  automaticamente. Tablist com as 4 abas. Rede confirmada via
  `read_network_requests`: só `GET .../clinicas/exames` no carregamento
  inicial (nenhuma chamada de agendamentos/financeiro); abrir "Agenda"
  disparou `GET .../clinicas/agendamentos` (1x, não repetiu ao
  reabrir); abrir "Financeiro" disparou `GET .../clinicas/financeiro`
  (1x) com dado real renderizado corretamente.
- Cenário 3 (mobile): viewport 375x812 - sem overflow horizontal da
  página; tab bar com rolagem horizontal própria, "Financeiro"
  parcialmente fora da viewport inicial mas acessível por scroll.
- Conta/convite de teste (clínica 11, email `teste-abas@example.com`)
  removidos do banco local ao final da verificação.
- Cenário 4 (stage, 2026-08-16): confirmado a nível de código que o
  bundle JS servido por stage para `/clinica-parceira` contém a
  implementação (`grep` nos chunks publicados por
  `curl` encontrou `portal-tab-visao-geral`, `portal-tab-laudos`,
  `portal-tab-agenda`, `portal-tab-financeiro`). Usuário recarregou a
  sessão real da Clínica #8 e confirmou as 4 abas aparecendo.

## 4) Regressao e riscos residuais

- Risco residual (baixo, restante): verificação de rede completa
  (lazy-load confirmado via `read_network_requests`) foi feita em
  ambiente local; em stage a confirmação foi visual (4 abas presentes)
  - o comportamento de rede em stage não foi reinspecionado, mas usa o
  mesmo código já validado localmente.
  sessão real já usada no achado de `portal-clinica-exame-created-at-fix`.
- Nenhuma regressão encontrada nas 6 seções originais - todo o conteúdo
  e toda a lógica de carregamento/erro permanecem inalterados, só a
  apresentação (agrupamento em abas) e o gatilho de carregamento de
  Agenda/Financeiro (lazy em vez de eager) mudaram.

## 5) Decisao de release

- [ ] Aprovado para stage.
- [ ] Aprovado para producao.
- [ ] Nao aprovado (descrever motivo).
