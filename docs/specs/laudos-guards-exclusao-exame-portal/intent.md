# Intent - laudos-guards-exclusao-exame-portal

Data: 2026-08-06
Responsavel: Claude (Sonnet 5)
Status: done

## 1) Problema atual

Dois achados confirmados por leitura de codigo na auditoria completa do
modulo de Atendimento Clinico (docs/AUDITORIA-ATENDIMENTO-ACHADOS-2026-08-04.md,
achados #13, #14):

- As rotas genericas `PUT /exames/{id}` e `DELETE /exames/{id}` (em
  `laudos.py`) permitiam editar/excluir um exame sem passar por NENHUM dos
  guards que o modulo de Atendimento aplica no mesmo tipo de operacao:
  aceitavam `laudo_id` de um paciente diferente (vazamento cruzado de laudo
  no portal), aceitavam liberacao direta no portal sem o endpoint dedicado
  (que valida PDF e preserva observacoes originais), e excluiam exame com
  laudo vinculado ou anexos sem bloqueio.
- Excluir um Laudo (`DELETE /laudos/{id}`) nao revogava a liberacao do Exame
  no Portal: o Exame ficava com `status='Liberado no portal'` e `laudo_id`
  apontando para um registro que nao existe mais - a clinica parceira ou o
  tutor continuavam vendo o resultado de um laudo excluido.

## 2) Objetivo

Toda rota que edita ou exclui um Exame - seja pelo modulo de Atendimento,
seja pela tela de Laudos - deve respeitar os mesmos guards de integridade e
deixar rastro de auditoria. Excluir um Laudo deve sempre revogar qualquer
liberacao de portal decorrente dele.

## 3) Nao objetivos

- Nao inclui unificar as rotas de edicao/exclusao de exame em um unico
  endpoint (a duplicacao de rota continua existindo; esta feature apenas
  fecha o gap de guards entre elas).
- Nao inclui as demais correcoes da mesma auditoria (auditoria de conteudo
  clinico/alertas, condicoes de corrida no frontend, bloqueios de deploy).

## 4) Contexto e restricoes

- Restricoes tecnicas: os guards reutilizados
  (`_motivo_bloqueio_exclusao_exame`, `revogar_liberacao_exame_no_portal`,
  `_excluir_anexos_por_exame`) ja existem em `atendimento.py` desde a
  feature `atendimento-integridade-prontuario` (commit 3f74a4b6) - esta
  feature apenas os reusa em `laudos.py`, sem redefinir logica.
- Restricoes de prazo: nenhuma.
- Restricoes regulatorio/operacional: exposicao cruzada de laudo/exame de
  paciente errado no portal e um risco de privacidade, nao so tecnico.

## 5) Impacto esperado

- Usuarios impactados: veterinarios/administradores que editam ou excluem
  exames e laudos pela tela de Laudos; clinicas parceiras e tutores que
  acessam o portal.
- Modulos impactados: Laudos, Atendimento (import de guards), Portal
  (efeito indireto - liberacao revogada ao excluir laudo).
- Risco de regressao: baixo - guards sao os mesmos ja usados e testados em
  `atendimento.py`; a mudanca em `laudos.py` e composicao, nao logica nova.

## 6) Riscos iniciais

- Risco 1: `atualizar_exame` e `deletar_exame` ganham parametro
  `request: Request` obrigatorio - qualquer chamador direto (fora de rota
  HTTP) precisa passar esse argumento. Mitigado: os unicos chamadores
  diretos sao os proprios testes, todos atualizados para passar
  `request=`.
- Risco 2: import de `atendimento.py` dentro de `laudos.py` cria
  acoplamento entre os dois modulos - aceito porque os guards de integridade
  de exame logicamente pertencem ao dominio do Atendimento, e duplicar a
  logica seria pior (duas fontes de verdade divergindo com o tempo).

## 7) Perguntas abertas

Nenhuma - implementacao concluida e testada.

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
