# Intent - alertas-internos-cancelamento-portal

Data: 2026-08-08
Responsavel: Martiniano + Claude
Status: draft (implementado; aguardando QA/aprovacao humana antes de stage)

## 1) Problema atual

Quando uma clinica cancela um agendamento pelo portal (`portal-clinica-agendamentos-ativos`), a
equipe interna so descobre isso conferindo a agenda ou a auditoria — nao ha nenhum aviso proativo.
O canal proativo que existe (push notification) nao e confiavel: o usuario apontou que o
dispositivo da secretaria nem sempre esta com notificacoes push habilitadas, entao depender so
disso corre o risco real de ninguem ficar sabendo do cancelamento.

Pesquisa confirmou que nao existe hoje nenhum mecanismo de alerta interno persistente: o unico
mecanismo "ao vivo" e um toast de SSE efetivo (`frontend/lib/agenda-realtime-toast.ts`), que so
existe na pagina de Agenda, se autodissolve com `setTimeout` e desconecta quando a aba fica em
segundo plano — e nem estava conectado ao cancelamento pelo portal.

## 2) Objetivo

Criar um alerta interno explicito e persistente (nao depende de push, nao desaparece por conta
propria) para avisar a equipe sempre que uma clinica cancelar um agendamento pelo portal, visivel
em qualquer pagina interna do sistema até ser marcado como lido.

## 3) Nao objetivos

- Enviar push notification adicional para este evento (o alerta interno persistente e o mecanismo
  principal desta entrega; push continua existindo para outros fluxos, sem mudanca).
- Roteamento por papel/permissao (ex.: "so recepcao ve") — o alerta e visivel para qualquer usuario
  interno autenticado, de proposito: restringir por papel poderia ir contra o objetivo de
  "minimizar a chance de ninguem ver".
- Push em tempo real via SSE para a pagina de Agenda especificamente (o toast existente nao foi
  conectado a este evento nesta entrega — o alerta persistente e poll-based, com atraso de ate
  ~45s, o que e aceitavel para o caso de uso: nao e uma emergencia de segundos).
- Um "centro de notificacoes" generico para todos os tipos de evento do sistema — esta entrega cria
  a infraestrutura (tabela, endpoints, sino) mas o UNICO produtor de alertas, por enquanto, e o
  cancelamento de agendamento pelo portal.

## 4) Contexto e restricoes

- Nao ha tabela/mecanismo de notificacao interna existente para reaproveitar
  (`AlertaClinico` e por paciente/clinico, nao para a equipe; `PushScheduledNotification` e so a
  fila de envio de push, sem leitura/estado de "lido"). Foi necessario criar um mecanismo novo.
- O alerta e criado na MESMA transacao do cancelamento (`app/services/alerta_interno_service.py`,
  chamado antes do `db.commit()` em `cancelar_agendamento_clinica_portal`), ao contrario do padrao
  best-effort de `registrar_auditoria` (sessao propria, engole erro) — a decisao aqui e
  deliberada: como o alerta E a entrega principal desta feature (nao um log acessorio), prefere-se
  que o cancelamento falhe junto se o alerta nao puder ser salvo, em vez de "ter sucesso" e deixar
  a equipe sem aviso silenciosamente.
- O sino fica fixo no canto superior direito (`position: fixed`) em vez de integrado à barra
  lateral, porque o layout interno (`layout-dashboard.tsx`) nao tem uma barra superior compartilhada
  entre mobile e desktop — fixed garante visibilidade em qualquer pagina/viewport sem reestruturar
  o layout existente.
- Frequencia de atualizacao: polling a cada 45s (nao SSE/websocket) — mais simples de implementar e
  testar, e suficiente para o caso de uso (nao e uma emergencia de segundos).

## 5) Impacto esperado

- Usuarios impactados: toda a equipe interna (o sino aparece em qualquer pagina que usa
  `DashboardLayout`).
- Modulos impactados: nova tabela `alertas_internos` (migracao), novo modelo/servico/endpoints,
  `backend/app/api/v1/endpoints/portal.py` (chama o novo servico no cancelamento),
  `frontend/app/layout-dashboard.tsx` (monta o sino), novo componente
  `frontend/components/layout/AlertasInternosBell.tsx`.
- Risco de regressao: baixo — tabela nova, endpoints novos, unico ponto de integracao com codigo
  existente e a chamada adicional dentro do cancelamento do portal (ja teste antes/depois).

## 6) Riscos iniciais

- **Alerta nunca marcado como lido / lista cresce sem parar**: mitigado com paginacao
  (`limit`, ate 200) e ordenacao por mais recente primeiro; "marcar tudo como lido" da equipe
  reduz a fila rapidamente. Sem expiracao automatica nesta entrega (ver Fora de escopo).
- **Alerta visivel para qualquer usuario interno, incluindo quem nao deveria agir**: aceito
  deliberadamente (ver secao 3) — o custo de "mais gente vendo um aviso operacional" e menor que o
  risco de "a pessoa certa nao ver".
- **Nao substitui contato direto com a clinica quando o cancelamento e proximo do horario**: o
  alerta e informativo; qualquer acao de contato ainda depende da equipe.

## 7) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
- [ ] QA manual com dados reais e sessao logada (usuario vai liberar para stage para isso — o
      sino e client-only e nao pode ser verificado visualmente neste ambiente sem backend real).
