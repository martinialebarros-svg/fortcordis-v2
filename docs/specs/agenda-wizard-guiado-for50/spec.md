# Spec - agenda-wizard-guiado-for50

Data: 2026-05-22  
Responsavel: Martiniano + Codex  
Status: done

## 1) Escopo funcional

Transformar o modal de novo agendamento em fluxo guiado pelo assistente, tornando explicita a tomada de decisao da secretaria sobre a oferta sugerida (aceite ou recusa) antes de permitir salvar.

## 2) Requisitos funcionais (RF)

- RF-001: no modo de criacao (`Novo Agendamento`), o assistente deve exigir clinica, servico e data para gerar oferta.
- RF-002: assistente deve apresentar oferta atual com contexto de deslocamento e risco.
- RF-003: fluxo deve expor acao explicita `Cliente aceitou este horario`.
- RF-004: fluxo deve expor acao explicita `Horario nao atende necessidade do cliente` para pedir proxima oferta.
- RF-005: quando nao houver oferta valida, fluxo deve permitir seguir manualmente apenas com justificativa registrada.
- RF-006: botao de salvar no modo novo deve permanecer bloqueado ate conclusao do fluxo guiado.
- RF-007: no modo de edicao, manter comportamento anterior sem obrigatoriedade do wizard.
- RF-008: quando a politica de oferta indicar clinica distante + baixa frequencia sem ancora em D+2, o wizard deve priorizar `datas_preferenciais` (ex.: D+3/D+4) em vez de forcar data de proximidade fora da politica.
- RF-009: `data_contato` do assistente deve ser fixada no instante de abertura do modal `Novo Agendamento` e reutilizada durante toda a sessao para evitar drift de D+N.
- RF-010: no modo novo, data/hora manuais devem ficar bloqueadas enquanto o fluxo do assistente estiver `pendente` ou `aceito`, liberando ajuste manual apenas quando estado for `sem_opcao`.
- RF-011: ao gerar sugestoes automaticas, o wizard nao deve sobrescrever silenciosamente a data selecionada no formulario; a data do formulario deve ser alterada apenas por aceite explicito de oferta.
- RF-012: o card do assistente guiado deve exibir progresso explicito por etapas (1/4 a 4/4), incluindo etapa atual e status visual de concluidas/ativas.
- RF-013: o assistente deve apresentar visao panoramica com todas as ofertas validas, evitando fluxo linear de "proxima oferta" para reduzir perguntas ao cliente.
- RF-014: a acao de recusa total (`sem_opcao`) so pode ser habilitada apos consulta/visualizacao das ofertas panoramicas.
- RF-015: o assistente nao deve sugerir horarios para datas passadas; ao receber data anterior a hoje, deve retornar resposta orientativa sem itens.
- RF-016: para clinica proxima da base, quando nao houver ancora em D+2 e D+3, o assistente deve priorizar D0 se houver ancora em D0 ou se D0 estiver sem agendamentos.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (compatibilidade): nenhuma quebra no contrato de APIs existentes do modal e dos endpoints de sugestao.
- NFR-002 (auditabilidade): decisao do assistente (aceite ou sem opcao) deve ser anexada em `observacoes` do agendamento novo.
- NFR-003 (ux operacional): feedback visual imediato para status do fluxo (pendente, aceito, sem opcao).

## 4) Contratos tecnicos

### Frontend

- Arquivo afetado: `frontend/app/agenda/NovoAgendamentoModal.tsx`.
- Estados novos: controle de indice da oferta, decisao do assistente, motivo sem opcao e itens ignorados por janela.
- Regra de submit: bloqueio condicional no modo novo enquanto decisao estiver pendente.

### Backend

- Arquivo afetado: `backend/app/api/v1/endpoints/agenda.py`.
- Endpoints atualizados: `POST /agenda/sugestoes-horario` e `POST /agenda/sugestao-proximidade`.
- Regra: bloquear sugestao para `data < hoje_local`, retornando `ok=true` com `items=[]` (sugestoes-horario) e `sugerir=false`/`item=null` (proximidade), com mensagem orientativa.
- Consumo de campos opcionais de `sugestao-proximidade` (`itens_ignorados_janela`, `politica_oferta`, `item.data_preferencial`) para controlar a data-base do fluxo guiado.

## 5) Compatibilidade e rollout

- Backward compatibility: modo `Editar Agendamento` preservado.
- Rollout: deploy normal de frontend; sem migracoes.
- Rollback: revert do commit da FOR-50.

## 6) Criterios de aceitacao (CA)

- CA-001: ao abrir `Novo Agendamento`, salvar fica bloqueado ate concluir decisao do assistente.
- CA-002: apos aceitar oferta sugerida, salvar fica habilitado.
- CA-003: apos recusar todas as opcoes, fluxo exige motivo para liberar salvamento manual.
- CA-004: `Editar Agendamento` continua permitindo salvar sem passar pelo wizard.
- CA-005: mensagem visual informa quando opcoes foram ignoradas por agenda fechada/janela operacional.
- CA-006: quando houver sugestao de proximidade fora da politica de oferta para clinica distante/baixa frequencia, o wizard nao deve adotar essa data automaticamente; deve buscar pela primeira `data_preferencial`.
- CA-007: `POST /agenda/sugestao-proximidade` recebe `data_contato` fixa da sessao do modal e mantem a mesma referencia temporal enquanto o modal estiver aberto.
- CA-008: antes de `sem_opcao`, secretaria nao consegue editar hora manualmente; ao entrar em `sem_opcao`, data/hora manual ficam disponiveis para fallback.
- CA-009: ao clicar `Gerar melhor oferta`, a data digitada no formulario permanece preservada, evitando "prender" as proximas buscas em uma data autoescolhida.
- CA-010: o modal deve mostrar progresso do wizard com etapa atual e trilha visual (`Preparar dados` -> `Panorama de ofertas` -> `Desfecho`) sem ambiguidade para a secretaria.
- CA-011: apos gerar ofertas, a secretaria deve visualizar todas as opcoes em lista panoramica, cada uma com acao de aceite direto.
- CA-012: botao `Nenhuma oferta atende...` deve aparecer apenas quando houver panorama consultado e decisao ainda pendente.
- CA-013: para data passada, endpoints de sugestao nao retornam oferta e respondem com mensagem explicita para selecionar hoje ou data futura.
- CA-014: com clinica proxima da base e sem ancora D+2/D+3, `dias_preferenciais` deve ser `[0]` quando D0 tiver ancora ou estiver vazio.

## 7) Casos de borda

- CB-001: secretaria troca clinica/servico/data apos gerar oferta -> fluxo deve resetar para evitar sugestao stale.
- CB-002: sem sugestao retornada pela API -> liberar fluxo manual somente com motivo.
- CB-003: sugestao de proximidade aplicada automaticamente sem ofertas validas deve cair em `sem_opcao` com orientacao de motivo/excecao.
- CB-004: quando existir ancora em D+2 ou D+3 para clinica proxima da base, a regra de prioridade D0 nao deve ser aplicada.

## 8) Fora de escopo

- Regras de permissao por papel para excecao de horario no wizard (tratado no FOR-51).
- Persistencia dedicada de trilha de decisao em tabela propria.
