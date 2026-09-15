# Intent - portal-clinica-recibo-os

Data: 2026-08-08
Responsavel: Martiniano + Claude
Status: draft (implementado; aguardando QA/aprovacao humana antes de stage)

## 1) Problema atual

No bloco "Financeiro da unidade" do portal (`portal-clinica-financeiro-os`), a clinica ve que uma
OS esta paga, mas nao tem como baixar um comprovante — precisa pedir ao financeiro interno, que ja
gera esse mesmo recibo (feature `financeiro-recibo-os-recebidas`) para outros fins.

## 2) Objetivo

Reaproveitar a geracao de recibo PDF ja existente para permitir que a clinica baixe, direto do
portal, o recibo de qualquer OS "Pago" da propria unidade.

## 3) Nao objetivos

- Recibo agrupado/consolidado de multiplas OS pelo portal (a rota interna suporta `agrupar=true`;
  o portal, nesta entrega, so baixa um recibo por vez).
- Envio do recibo por WhatsApp/e-mail pelo proprio portal (a clinica baixa o PDF e decide o que
  fazer com ele).
- Mudar o layout/conteudo do recibo em si — e o mesmo PDF que a equipe interna gera.

## 4) Contexto e restricoes

- A geracao original (`gerar_recibos_os_pdf`, `backend/app/api/v1/endpoints/ordens_servico.py`)
  dependia de dados de um `User` interno (nome do emissor, `ConfiguracaoUsuario` para
  assinatura/CRMV) — que nao existem para uma sessao de portal (`PortalSessionContext` nao e um
  `User`). Foi necessario extrair a parte independente de usuario
  (`_carregar_dados_emissor_recibo_empresa`) da parte que monta os dados da OS
  (`_montar_recibos_os`), preservando o comportamento da rota interna (refatoracao pura, sem
  mudanca de comportamento) para poder reaproveitar as duas no portal sem depender de um usuario
  interno.
- No recibo gerado pelo portal, o "emitente" e o nome da propria empresa (Fort Cordis), sem
  assinatura/CRMV de um profissional especifico — como nao ha usuario interno autenticado nesse
  fluxo, nao ha por quem atribuir a assinatura.

## 5) Impacto esperado

- Usuarios impactados: clinicas parceiras (portal externo). Zero mudanca de comportamento para a
  tela interna de Financeiro (mesma rota, mesmo resultado, so implementada com as funcoes
  extraidas).
- Modulos impactados: `backend/app/api/v1/endpoints/ordens_servico.py` (extracao, sem mudanca de
  comportamento), `backend/app/api/v1/endpoints/portal.py` (novo endpoint),
  `frontend/components/portal/PortalClinicaWorkspace.tsx`, `frontend/lib/portal-api.ts`.
- Risco de regressao: no endpoint interno de recibo, mitigado por ser uma extracao pura (mesma
  logica, mesma ordem de chamadas) e pela suite completa de testes de backend continuar verde.

## 6) Riscos iniciais

- **Vazamento entre clinicas**: mitigado exigindo `OrdemServico.clinica_id == clinica.id` (da
  sessao do portal) e `status == "Pago"` antes de gerar qualquer PDF — 404 generico em qualquer
  outro caso (OS de outra clinica, ainda pendente, ou inexistente).
- **Regressao na tela interna de Financeiro**: mitigada por ser uma extracao pura de codigo
  (mesma sequencia de consultas e monsagem de dados), validada pela suite completa de testes de
  backend (685 testes, sem falhas apos a mudanca).

## 7) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
- [ ] QA manual com dados reais (usuario vai liberar para stage para isso).
