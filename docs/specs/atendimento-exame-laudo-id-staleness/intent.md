# Intent - atendimento-exame-laudo-id-staleness

Data: 2026-08-07
Responsavel: Claude (Sonnet 5)
Status: done

## 1) Problema atual

Achado #17 da auditoria completa (docs/AUDITORIA-ATENDIMENTO-ACHADOS-2026-08-04.md):
`_sync_exames` sobrescreve `Exame.laudo_id` sem a mesma protecao de
staleness que `_derivar_status_exame` ja aplica ao `status`.

O atendimento nunca oferece, na sua propria tela, um jeito de vincular ou
desvincular um laudo de um exame - esse vinculo e sempre criado por
`laudos.py` (ex.: ao gerar/finalizar um laudo a partir de um exame). O
formulario do atendimento apenas faz round-trip do `laudo_id` que recebeu
na ultima hidratacao (`buildAtendimentoPayload`, `frontend/app/atendimento/page.tsx:1228`).

Cenario de falha: o vet abre um atendimento (form hidratado com
`laudo_id: null` para um exame ainda sem laudo). Em outra aba/sessao, um
laudo e gerado e vinculado a esse mesmo exame via `laudos.py`
(`exame.laudo_id = laudo.id`). O atendimento aberto continua com o
snapshot antigo (`laudo_id: null`) em memoria. No proximo autosave ou save
manual, o payload envia `laudo_id: null` - e `_sync_exames`
(`atendimento.py:1903-1916`) aceita esse valor vazio incondicionalmente,
apagando o vinculo que a outra aba tinha acabado de criar.

## 2) Objetivo

Um payload com `laudo_id` vazio nunca pode desvincular um laudo ja
vinculado no banco - apenas uma acao explicita (hoje, exclusiva de
`laudos.py`) pode fazer isso.

## 3) Nao objetivos

- Nao inclui dar ao atendimento uma UI para vincular/desvincular laudo
  manualmente - essa continua sendo responsabilidade exclusiva de
  `laudos.py`.
- Nao inclui auditoria de mudanca de `laudo_id` (o `_registrar_ajuste_exame`
  do pacote `atendimento-auditoria-conteudo-exame-alertas` rastreia 6
  campos; `laudo_id` nao esta entre eles e fica fora do escopo aqui).
- Nao inclui corrigir `mergeAutoSavedFormState` no frontend
  (`page.tsx:1320`, que tambem nunca atualiza o `laudo_id` em memoria a
  partir da resposta do servidor) - investigado e descartado: `laudo_id`
  nunca e exibido em nenhum componente do atendimento
  (`grep laudo_id frontend/app/atendimento/components/*.tsx` = vazio), e a
  correcao do backend torna esse valor desatualizado inofensivo
  independente do que o cliente insista em reenviar.

## 4) Contexto e restricoes

- Restricoes tecnicas: a correcao precisa preservar os 4 comportamentos ja
  travados por teste em `test_atendimento_exame_laudo_id_propriedade.py`
  (laudo de outro paciente ignorado, laudo do mesmo paciente aceito, laudo
  inexistente ignorado, round-trip do mesmo laudo preserva o vinculo) - o
  gap e especificamente o caso NAO coberto: exame que JA tem laudo e
  recebe um payload com `laudo_id` vazio.
- Restricoes de prazo: nenhuma.
- Restricoes regulatorio/operacional: nenhuma alem da integridade do
  prontuario ja discutida nos pacotes anteriores da mesma auditoria.

## 5) Impacto esperado

- Usuarios impactados: veterinarios com o atendimento aberto no momento em
  que um laudo e gerado/vinculado a um dos exames daquele atendimento por
  outra aba/sessao/usuario.
- Modulos impactados: apenas `_sync_exames` em `atendimento.py`.
- Risco de regressao: minimo - a mudanca adiciona um `elif` que so
  intercepta o caso especifico (payload vazio + vinculo ja existente no
  banco); os demais caminhos (novo exame, laudo diferente, round-trip)
  passam pelos ramos ja existentes e testados.

## 6) Riscos iniciais

- Risco 1: nenhum caminho legitimo do atendimento precisa desvincular um
  laudo - confirmado por leitura de codigo (nenhum controle de UI no
  frontend edita `laudo_id`; os unicos assignments em `atendimento.py`
  ficam dentro de `_sync_exames`).
- Risco 2: a nova protecao poderia mascarar um caso real de "usuario quer
  desvincular" - nao existe hoje esse caso no atendimento (so em
  `laudos.py`, que tem seu proprio caminho de exclusao/revogacao ja
  corrigido nos pacotes anteriores).

## 7) Perguntas abertas

Nenhuma - implementacao concluida e testada.

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
