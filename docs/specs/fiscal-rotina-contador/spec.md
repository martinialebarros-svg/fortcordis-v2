# Especificação — preparação semanal e por serviço

## Comportamento

- RF-01: rotina padrão semanal, referência domingo às 17h em America/Fortaleza. Abertura no mês atual; não buscar agosto/setembro como fila histórica por padrão nem presumir notas emitidas a partir da informação de relatórios já enviados.
- RF-02: o primeiro domingo às 17h não anterior ao instante atual é o corte sugerido. Pode ser conferida um domingo explícito. A fila inclui o backlog ainda não preparado da competência selecionada até o corte, sem transportar OS de outro mês. Uma semana que atravessa meses conserva pacotes separados por competência.
- RF-03: a preferência por clínica é semanal ou por serviço, com indicador de pagamento dependente de NF. O padrão inicial da Vet Fauna é por serviço com esse indicador, identificado pelo CNPJ normalizado 14986833000188. Uma preferência explícita prevalece; não identificar por nome aproximado ou ID de outro ambiente. PF segue a rotina padrão.
- RF-04: por serviço prepara exatamente uma OS por pacote. Duas OS do mesmo tipo de exame continuam operações distintas. O lote semanal exclui clínicas configuradas por serviço. Canceladas, documentos incompletos, valor inválido e OS já vinculada seguem protegidos.
- RF-05: data passada ou OS paga não comprovam realização. Usar vínculo explícito com agenda realizada, atendimento concluído ou laudo finalizado, sem procurar coincidência por paciente/data. Prestação futura ou sem comprovação permanece pendente na nova rotina.
- RF-06: preparação/download sempre explícitos, com conferência das datas e reconhecimento de exportações antigas. O servidor valida o modo, a competência, o corte, a preferência vigente, a realização e o filtro de clínica sob os locks necessários. Seleção inválida não persiste pacote parcial.
- RF-07: retry com mesma chave/contexto recupera os mesmos bytes, inclusive depois de passar um domingo. Reutilizar chave com payload diferente falha. As rotas mensais antigas e seus fingerprints permanecem compatíveis.
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

1. Semana padrão, corte domingo 17h e fuso calculados no servidor; inclui backlog sem misturar competências nem selecionar prestação futura.
2. Vet Fauna por serviço e preferência explícita editável prevalecem; preparação individual recusa múltiplas OS e semanal recusa exceção por serviço.
3. Evidência de realização, documentação, valores, exclusividade, escopo e retry validados no backend; cliente desatualizado não contorna as regras.
4. Andamento manual linear, auditável e idempotente, com CAS sob concorrência; independência entre OS e arquivo imutável.
5. Migração aditiva repetível e RLS/revogações comprovadas; nenhuma alteração em NotaFiscal, pagamento ou mensageria.
6. Interface mostra o corte consultado pela API e usa exatamente essa data na preparação. Resposta com corte diferente do domingo escolhido bloqueia a seleção. Interface padrão semanal, prioridade por serviço, preferências e histórico por OS conferidos; mudança de contexto descarta respostas antigas e exige nova conferência.
7. Stage publicado com CI/deploy terminais, SHA instalado, canário sintético transitório limpo e smoke autenticado/HTTP/bundles aprovados. As demonstrações mantidas por solicitação do usuário pertencem somente ao banco de stage.

## Publicação autorizada

Em 15/10/2026, com retomada autorizada em 16/10, o usuário autorizou a promoção para produção com sexta-feira às 18h de Fortaleza e Vet Fauna por serviço. Publicar somente aplicação/migração já validada em stage por PR protegida; não copiar cadastros, OS, preferências de teste ou pacotes do banco de stage. A preferência da clínica real será conferida/configurada no próprio cadastro de produção, sem alterar seus dados fiscais. Não emitir notas, enviar informações ao contador, gerar pacotes reais ou registrar etapas históricas como parte da publicação.

Na retomada, a promoção padrão `stage -> main` foi preparada, mas stage recebeu em paralelo um incremento clínico autorizado apenas para stage. O recorte desta publicação usa o snapshot fiscal `43c81a7c` em PR isolada com o escape explícito `hotfix`, preservando todos os gates e sem exceção de critérios pendentes. A alteração clínica permanece em stage; a ancestralidade e a documentação da publicação serão reintegradas a stage após o merge, sem revertê-la.

## Rollback

Reverter somente a aplicação mantém tabelas de preferência/eventos inertes, claims e pacotes originais preservados. Não apagar pacotes, eventos ou preferências no rollback. A migração não reescreve OS ou histórico legado; não há reversão de pagamento, emissão ou envio para desfazer.


## Ajuste autorizado em 18/10/2026

A referência semanal passa a domingo às 17h de Fortaleza para incluir atendimentos de sábado. Novos cortes explícitos aceitam somente domingos; o limite é inclusivo às 17h e prestações futuras continuam bloqueadas. Uma semana que termina em outro mês permite conferir cada competência separadamente, sem misturar OS.

O servidor fornece o mesmo corte à prévia, ao snapshot e aos quatro arquivos do pacote. A tela apresenta “Corte deste pacote”, sem substituir o corte conferido pela próxima referência. Mudanças de corte exigem nova consulta e conferência; resposta divergente bloqueia a preparação.

Não há cron ou geração/envio automático. Vet Fauna continua por serviço. Pacotes persistidos não serão reescritos: download e retry com UUID/contexto originais conservam bytes, checksum e corte histórico de sexta às 18h. Uma nova UUID não permite preparar um novo pacote com esse corte antigo. O pacote real #1 não é corrigido ou recriado nesta alteração.

Esta etapa implementa e valida localmente o novo padrão; não autoriza nova publicação ou alteração dos dados de produção.

## Publicação e preparação autorizadas em 18/10/2026

O usuário autorizou publicar o novo corte e preparar os documentos para encaminhamento manual ao contador em 19/10/2026. Promover o recorte fiscal pelos gates protegidos, preservando os dados operacionais e quaisquer outras entregas em andamento. Depois, conferir em produção as OS de outubro até 18/10 às 17h, preparar somente aptas ainda sem pacote e recuperar a segunda via do pacote #1 sem duplicar claims. Vet Fauna permanece por serviço. Não emitir notas nem enviar documentos ou mensagens. A divergência de corte do pacote #1 será apresentada separadamente, sem reescrever seu arquivo imutável.

Retry de UUID histórica com seleção ou confirmações divergentes mantém conflito 409 e fechamento_id do pacote original, inclusive sem data_corte explícita. O fallback de virada de semana aplica-se apenas à UUID que ainda não estava carregada na entrada da operação.
