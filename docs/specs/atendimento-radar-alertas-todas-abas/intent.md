# Intent - atendimento-radar-alertas-todas-abas

Data: 2026-08-09
Responsavel: Claude (pareado com Martiniano)
Status: em andamento

## 1) Problema atual

GitHub issue #47 ("[UX] Radar de alertas clinicos desaparece nas abas
Exames e Prescricao"), origem achado #28 da auditoria UX/fluxo
(`docs/AUDITORIA-ATENDIMENTO-UX-FLUXO-2026-08-09.md`, issue de tracking
#57): o radar de alertas clinicos do paciente (alergias, contraindicacoes
etc., cada um com `gravidade` em `baixa`/`media`/`alta`/`critica`) so
aparece como aside completo (`AtendimentoClinicalRadarAside`) nas abas
Consulta e Documentos (`showClinicalRadarAside = isConsultaWorkspace ||
isDocumentosWorkspace`, `frontend/app/atendimento/page.tsx`). A aba
Prescricao ja tinha aside propria (`AtendimentoPrescricaoAside`) mas sem
os alertas. A aba Exames nao tinha aside nenhuma.

Resultado: um veterinario prescrevendo um medicamento ou solicitando um
exame para um paciente com alergia grave conhecida nao via esse alerta em
lugar nenhum da tela - risco clinico direto, marcado como prioritario na
auditoria ("Achado com risco clinico direto - priorizar").

## 2) Objetivo

Garantir que alertas de gravidade alta/critica fiquem visiveis nas abas
Exames e Prescricao, sem duplicar o radar completo (que traz tambem
progresso de preenchimento, historico do paciente etc. - informacao fora
de contexto nessas abas) e sem forcar uma coluna lateral vazia quando nao
ha nada a alertar.

## 3) Nao objetivos

- Nao adicionar alertas na aba Bibliotecas (nao ha contexto de paciente
  selecionado ali).
- Nao alterar `AtendimentoClinicalRadarAside` nem o comportamento das
  abas Consulta/Documentos.
- Nao mudar a fonte dos alertas (`historicoPaciente.alertas`) nem o
  endpoint que os popula.
- Nao resolver os outros 36 achados da auditoria UX/fluxo nesta sessao.
