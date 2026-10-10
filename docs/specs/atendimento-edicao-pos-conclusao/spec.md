# Spec — Edição após conclusão

Data: 2026-10-10. Status: implementado; validação e escopo de publicação registrados em verify.md.

## Comportamento

- RF-01: um atendimento concluído aceita alterações clínicas pelo fluxo normal de edição e salvamento. Não é necessário criar adendo ou novo atendimento para corrigir o registro.
- RF-02: edição de conteúdo conserva a conclusão e seu vínculo administrativo; não reabre Agenda, não cria ou recalcula OS e não troca o paciente. A data do encontro não é substituída pela data da edição.
- RF-03: recuperar rascunho local preserva status e identificadores confirmados pelo servidor. O conteúdo digitado recuperável é mantido; um backup antigo com Triagem não pode regredir um atendimento concluído.
- RF-04: mudanças clínicas reais registram autor, data e diferenças antes/depois na mesma transação do salvamento. Falha na auditoria impede o salvamento; um autosave sem mudança não cria uma edição fictícia.
- RF-05: documentos emitidos continuam editáveis em seu editor. Salvar um documento de atendimento já existente não depende de salvar campos não relacionados do formulário clínico. Versão obsoleta continua sendo conflito explícito, com texto local preservado.
- RF-06: o prontuário oferece histórico de edições clínicas, de receitas e de documentos, incluindo documentos arquivados, ordenado do mais recente para o mais antigo. Histórico é somente leitura e carregado sob demanda.
- RF-07: `GET /atendimentos/{id}/historico-edicoes?skip=0&limit=50` retorna `{items, total, skip, limit}`. Cada item contém `id`, `created_at`, `usuario_id`, `usuario_nome`, `entidade`, `entidade_id`, `acao`, `descricao` e `alteracoes`, com valores `{antes, depois}` por campo. Reutiliza a autenticação/permissão do módulo; não expõe IP, e-mail ou auditoria de outro atendimento.
- RF-08: histórico mostra estados vazio, carregando e erro com nova tentativa, e permite navegar entre páginas. Resposta atrasada de outro atendimento não substitui o histórico atual.
- RF-09: avisos explicam a edição com histórico. Adendos e receitas complementares continuam disponíveis para organizar a continuidade, sem serem apresentados como única maneira de alterar conteúdo.
- RF-11: receitas emitidas podem ser corrigidas pelo salvamento normal sem confirmação adicional ou receita complementar obrigatória. A alteração conserva a emissão original e registra diferenças duráveis de orientações e itens; PDFs já baixados exigem nova geração.
- RF-12: backup local sincronizado nao pode reverter alteracoes mais novas do servidor. Recuperacao diferencia alteracao local pendente de copia antiga; backup legado ou conflito conserva texto recuperavel e exige escolha explicita antes de substituir conteudo atual, sem comparar timestamps de fuso ambiguo.
- RF-10: editar o texto não atualiza PDFs já baixados. A interface conserva o aviso de geração de novo PDF; “emitido” não significa entregue ao tutor. Nenhum documento real é reemitido por esta implementação.

## Critérios de aceitação

1. Recuperar rascunho com Triagem sobre atendimento Concluido mantém Concluido e o texto local; salvar a edição persiste após nova leitura.
2. Alterar conteúdo de atendimento concluído gera diff durável com responsável, conserva o vínculo com Agenda e OS, e não muda a data do encontro por efeito do salvamento.
3. Falha da escrita de auditoria não deixa conteúdo alterado sem histórico.
4. Editar documento emitido de atendimento concluído conserva sua identidade/data de emissão e registra antes/depois; o mesmo vale para receitas emitidas; outro documento/atendimento não aparece no histórico consultado.
5. Nova sessão vê o histórico; salvamento sem alteração não cria entradas; histórico paginado fica acessível na interface.
6. Erros de save ou histórico são visíveis e não descartam texto digitado.
7. Reabrir uma aba com backup antigo não reverte correção clínica ou receita salva por outra sessão; texto pendente permanece recuperável.

## Limites

Sem restauração automática de uma versão anterior, alteração de identidade do paciente concluído, reabertura administrativa, remoção de trilha, reconstrução de histórico que não foi registrado no passado ou atualização de PDFs já entregues. A proteção de versão dos documentos e as proteções de exames liberados permanecem aplicáveis.

Sem migração de banco: reutiliza `auditoria_eventos`. Histórico antigo é exibido apenas quando existe evidência registrada. Validação local usa pacientes e documentos sintéticos.
