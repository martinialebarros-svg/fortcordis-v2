# Spec - portal-clinica-parceira-navegacao-abas

Data: 2026-08-16
Responsavel: Claude (pareado com Martiniano)
Status: implementado

## 1) Escopo funcional

Introduzir navegacao por abas em `PortalClinicaWorkspace.tsx`,
agrupando as 6 secoes hoje empilhadas em 4 abas: Visao geral, Laudos,
Agenda, Financeiro. Nenhum endpoint ou logica de negocio muda - so a
apresentacao.

## 2) Requisitos funcionais (RF)

- RF-1: a tela ganha uma barra de abas logo abaixo do hero/card de
  sessao: "Visao geral" (default), "Laudos", "Agenda", "Financeiro".
- RF-2: em sessao de `admin_preview` (espelho), as abas "Agenda" e
  "Financeiro" nao aparecem - mesmo escopo de hoje (`!isAdminPreview`).
- RF-3: aba "Visao geral" contem, na mesma ordem/estrutura de hoje:
  "Aguardando liberacao" (destaque) + "Resumo da unidade" + "Atividade
  recente da unidade".
- RF-4: aba "Laudos" contem "Filtros de busca" + a lista paginada
  "Exames liberados" (comportamento de busca/filtro/ordenacao
  inalterado).
- RF-5: aba "Agenda" contem "Agendamentos ativos da unidade" (listar e
  cancelar agendamento, inalterado).
- RF-6: aba "Financeiro" contem "Financeiro da unidade" (OS
  pendentes/pagas, download de recibo, inalterado).
- RF-7: trocar de aba nao perde o estado da aba anterior (ex.: filtro
  preenchido em "Laudos" continua preenchido ao voltar da aba
  "Agenda") - troca de aba e so troca de visibilidade, nao
  desmonta/remonta o conteudo.
- RF-8: em viewport mobile, a barra de abas e utilizavel sem hover
  (toque) e sem quebrar layout (rolagem horizontal se nao couber, sem
  overflow da pagina).
- RF-9: o carregamento de dados de "Agenda" e "Financeiro" passa a ser
  lazy - so dispara a chamada (`listPortalClinicAgendamentos`/
  `getPortalClinicFinanceiro`) na primeira vez que a aba correspondente
  e aberta, nao no mount do componente. "Visao geral" e "Laudos"
  continuam carregando no mount (sao o caminho mais comum/a aba
  default).

## 3) Requisitos nao funcionais (NFR)

- NFR-1 (compatibilidade): nenhuma mudanca de contrato de API - mesmos
  endpoints, mesmos payloads.
- NFR-2 (acessibilidade): abas seguem padrao ARIA de tabs
  (`role="tablist"`/`role="tab"`/`role="tabpanel"`,
  `aria-selected`), consistente com o padrao ja usado em
  `frontend/app/atendimento/page.tsx`.
- NFR-3 (performance): RF-9 reduz o numero de chamadas feitas no
  carregamento inicial da tela (de 4 para 2, tipicamente) para sessao
  real; sem cache derrubado ao trocar de aba repetidamente (nao refaz
  fetch se os dados da aba ja foram carregados nesta sessao - so
  refaz via o botao "Atualizar" ja existente em cada secao).
- NFR-4 (visual): "Aguardando liberacao" mantem o mesmo destaque visual
  de hoje (borda ambar, contagem grande) dentro da aba "Visao geral".

## 4) Criterios de aceite (CA)

- CA-1: sessao real com laudo aguardando liberacao - abrir a tela mostra
  a aba "Visao geral" com o destaque de "Aguardando liberacao" visivel
  sem rolagem adicional (alem da ja existente hoje pro hero).
- CA-2: clicar em "Laudos" mostra filtros + lista completa, idêntica ao
  comportamento atual da secao "Exames liberados".
- CA-3: clicar em "Agenda" (sessao real) dispara a chamada de
  agendamentos na primeira vez, exibe a lista e permite cancelar; abrir
  de novo nao rebusca (usa o estado ja carregado).
- CA-4: clicar em "Financeiro" (sessao real) dispara a chamada e mostra
  pendentes/pagos com download de recibo, igual ao comportamento atual.
- CA-5: sessao `admin_preview` (espelho) mostra so 2 abas: "Visao
  geral" e "Laudos" - sem "Agenda"/"Financeiro".
- CA-6: viewport 375px - barra de abas sem overflow horizontal da
  pagina, tocavel, nenhuma aba cortada de forma inutilizavel.
- CA-7: preencher um filtro em "Laudos", trocar para "Agenda" e voltar
  para "Laudos" - filtro continua preenchido.
