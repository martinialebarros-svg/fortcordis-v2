# Especificação — preparação semanal e por serviço

## Comportamento

- RF-01: rotina padrão semanal, referência sexta-feira às 18h em America/Fortaleza. Abertura no mês atual; não buscar agosto/setembro como fila histórica por padrão nem presumir notas emitidas a partir da informação de relatórios já enviados.
- RF-02: a primeira sexta às 18h não anterior ao instante atual é o corte sugerido. Pode ser conferida uma sexta explícita. A fila inclui o backlog ainda não preparado da competência selecionada até o corte, sem transportar OS de outro mês. Uma semana que atravessa meses conserva pacotes separados por competência.
- RF-03: a preferência por clínica é semanal ou por serviço, com indicador de pagamento dependente de NF. O padrão inicial da Vet Fauna é por serviço com esse indicador, identificado pelo CNPJ normalizado 14986833000188. Uma preferência explícita prevalece; não identificar por nome aproximado ou ID de outro ambiente. PF segue a rotina padrão.
- RF-04: por serviço prepara exatamente uma OS por pacote. Duas OS do mesmo tipo de exame continuam operações distintas. O lote semanal exclui clínicas configuradas por serviço. Canceladas, documentos incompletos, valor inválido e OS já vinculada seguem protegidos.
- RF-05: data passada ou OS paga não comprovam realização. Usar vínculo explícito com agenda realizada, atendimento concluído ou laudo finalizado, sem procurar coincidência por paciente/data. Prestação futura ou sem comprovação permanece pendente na nova rotina.
- RF-06: preparação/download sempre explícitos, com conferência das datas e reconhecimento de exportações antigas. O servidor valida o modo, a competência, o corte, a preferência vigente, a realização e o filtro de clínica sob os locks necessários. Seleção inválida não persiste pacote parcial.
- RF-07: retry com mesma chave/contexto recupera os mesmos bytes, inclusive depois de passar uma sexta-feira. Reutilizar chave com payload diferente falha. As rotas mensais antigas e seus fingerprints permanecem compatíveis.
- RF-08: contexto do lote e pendências pertencem à mesma rotina/competência/filtro do pacote. Por serviço restringe as pendências ao tomador selecionado. Não incluir dados clínicos ou cadastros de outras clínicas em teste isolado.
- RF-09: andamento individual por OS: preparado → enviado ao contador → nota recebida → nota encaminhada à clínica. Cada avanço exige ação e confirmação manual, versão esperada, chave idempotente e evento auditável com ator/data. Referência da nota é exigida ao registrar seu recebimento. Não pular, retroceder ou interpretar download como envio.
- RF-10: o andamento se ancora no vínculo e no snapshot do pacote; preserva histórico mesmo se uma OS operacional deixar de existir. Atualizar preferência ou andamento nunca modifica ZIP, checksum ou snapshot original.
- RF-11: nenhuma chamada de emissão de NotaFiscal, WhatsApp, email, worker ou cron. Não alterar status/pagamento da OS, agenda ou atendimento. O registro manual de uma nota recebida não emite nem cria uma nota fiscal no sistema existente.
- RF-12: novas tabelas privadas com RLS e REVOKE de PUBLIC/anon/authenticated; autenticação e permissão fiscal existentes continuam obrigatórias. Atualização concorrente usa locks/CAS e integridade no banco, com conflito visível.

## Contrato

- GET `/fiscal/rotinas`: padrão semanal e preferências efetivas por clínica, incluindo origem e versão.
- PUT `/fiscal/rotinas/clinicas/{id}`: modo, pagamento_depende_nf e versao_esperada; salvamento explícito, sem alterar cadastro tributário.
- GET `/fiscal/rotinas/previa`: competencia, modo (semanal/por_servico/mensal), data_corte e clinica_id opcionais; devolve prévia fiscal e contexto da rotina. Mensal nessa nova tela é conferência somente leitura.
- POST `/fiscal/rotinas/preparar`: requisição de fechamento existente com modo, data_corte e clinica_id opcionais; devolve ZIP e os headers de identidade/checksum existentes.
- GET `/fiscal/fechamentos/{id}/andamentos`: estado, versão e eventos por OS a partir do pacote persistido.
- POST `/fiscal/os/{id}/andamento`: destino, versão esperada, UUID, confirmação de ação manual e referência/observação; devolve o estado atual.

## Critérios de aceite

1. Semana padrão, corte sexta 18h e fuso calculados no servidor; inclui backlog sem misturar competências nem selecionar prestação futura.
2. Vet Fauna por serviço e preferência explícita editável prevalecem; preparação individual recusa múltiplas OS e semanal recusa exceção por serviço.
3. Evidência de realização, documentação, valores, exclusividade, escopo e retry validados no backend; cliente desatualizado não contorna as regras.
4. Andamento manual linear, auditável e idempotente, com CAS sob concorrência; independência entre OS e arquivo imutável.
5. Migração aditiva repetível e RLS/revogações comprovadas; nenhuma alteração em NotaFiscal, pagamento ou mensageria.
6. Interface padrão semanal, prioridade por serviço, preferências e histórico por OS conferidos; mudança de contexto descarta respostas antigas e exige nova conferência.
7. Stage publicado com CI/deploy terminais, SHA instalado, canário sintético limpo e smoke autenticado/HTTP/bundles aprovados. Produção não é alterada por este trabalho.

## Rollback

Reverter somente a aplicação mantém tabelas de preferência/eventos inertes, claims e pacotes originais preservados. Não apagar pacotes, eventos ou preferências no rollback. A migração não reescreve OS ou histórico legado; não há reversão de pagamento, emissão ou envio para desfazer.
