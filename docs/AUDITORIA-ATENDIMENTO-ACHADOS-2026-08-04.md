# Auditoria do modulo de Atendimento Clinico - Achados (2026-08-04)

> **Origem:** workflow de auditoria multi-dimensao (7 agentes de investigacao + 1 verificador ceptico independente por achado), rodado contra `origin/stage` apos os pacotes `atendimento-integridade-prontuario`, `atendimento-persistencia-e-fluidez` e `atendimento-herdar-dados-anteriores` (todos ja em producao).

> **Metodologia:** cada achado abaixo foi reportado por um agente investigador e depois checado por um SEGUNDO agente, instruido a tentar ativamente refuta-lo lendo o codigo atual. So os achados que sobreviveram a essa verificacao (confirmados ou parcialmente confirmados, e nao ja corrigidos por pacotes anteriores) estao listados aqui.

> **Nao confundir com** `docs/AUDITORIA-ATENDIMENTO-MAPA-FASE1.md` (outra iniciativa de auditoria, de 31/07/2026, que ficou so na fase de mapeamento sem achados verificados - ainda nao commitada, provavelmente de outra sessao). Este documento e independente e reflete o estado do codigo em 04/08/2026.

> **Resumo:** 29 achados confirmados - 16 de severidade ALTA, 13 de severidade MEDIA.

---

## 1. [ALTA] Recuperacao de rascunho local em abrirAtendimento() sobrescreve evolucoes/anexos/documentos frescos com uma copia local desatualizada

**Dimensao:** Integridade de dados clinicos  
**Local:** `frontend/app/atendimento/page.tsx:2637`

**Descricao:** Em abrirAtendimento() (linhas 2637-2656), quando existe um backup local (localStorage, chave por atendimento_id, escrito a cada 700ms enquanto o form muda) que difira do hidratado do servidor, o codigo monta `candidato = { ...hydrated, ...parsedBackup.form, id: hydrated.id }` e, se `serializeAtendimentoSnapshot(candidato) !== serializeAtendimentoSnapshot(hydrated)`, adota o candidato inteiro como novo `form`. `serializeAtendimentoSnapshot` usa `buildAtendimentoPayload`, que NAO inclui `evolucoes`, `anexos` nem `documentos` (nem `especie`). Ou seja: a decisao de 'usar o backup local' e tomada olhando so para os campos do payload (textos clinicos, exames, prescricao), mas quando decide usar o backup, ele substitui TAMBEM evolucoes/anexos/documentos/status/triagem_concluida/consulta_concluida pelo estado antigo do backup - mesmo que esses campos tenham mudado no servidor nesse meio-tempo por causa de uma acao que acabou de ser tomada nessa mesma sessao. Alem do problema de exibicao, como o snapshot 'persistido' fica sendo o do servidor (hydrated) e nao o do candidato, o proximo autosave (1.8s depois) reenvia ao backend o `buildAtendimentoPayload(candidato)` - ou seja, campos do payload (exames, prescricao_itens, triagem, diagnostico) que estejam desatualizados no backup local sao persistidos de volta no servidor, revertendo o que quer que tenha mudado la nesse intervalo.

**Cenario de falha:** Vet digita uma frase em 'Anamnese' e, menos de 1.8s depois (antes do autosave remoto disparar), clica em 'Registrar Evolucao' (AtendimentoDocumentosSection.tsx linhas 401-412: `await api.post(.../evolucoes, ...)` seguido de `await abrirAtendimento(selecionado)`). O backup local de 700ms ja capturou a nova frase de anamnese (que ainda nao esta no servidor), entao `candidato` difere de `hydrated` e e adotado. `candidato.evolucoes` vem do backup local, que e anterior ao POST da evolucao - a evolucao recem-registrada desaparece da lista exibida (embora exista no banco), levando o vet a acreditar que o registro falhou e a digitar/registrar de novo (duplicando a evolucao no banco). Alem disso, se o backup local tiver um exame com `resultado` ou item de prescricao mais antigo que o que ja foi salvo por outra aba/sessao, o autosave seguinte reenvia esses valores antigos e sobrescreve a versao mais nova no servidor.

<details><summary>Justificativa da verificacao adversarial</summary>

Verifiquei o codigo atual e o achado procede integralmente.

1) frontend/app/atendimento/page.tsx:2637-2656 (abrirAtendimento): apos buscar `hydrated` do servidor, le o backup local por atendimento_id e monta `candidato = { ...hydrated, ...parsedBackup.form, id: hydrated.id }` (linha 2646). A decisao de adotar o candidato usa `serializeAtendimentoSnapshot(candidato) !== serializeAtendimentoSnapshot(hydrated)` (linha 2647), mas quando adota, adota o objeto INTEIRO (spread de `parsedBackup.form`), nao apenas os campos comparados.

2) frontend/app/atendimento/page.tsx:1181-1255 (buildAtendimentoPayload, usado por serializeAtendimentoSnapshot na linha 1257): confirmei que o payload NAO inclui `evolucoes`, `anexos`, `documentos` nem `especie` (campos existentes no tipo AtendimentoForm, linhas 539-541 e 518, populados em hydrateFormFromDetail linhas 1157-1159/1120). Ou seja, a comparacao de igualdade e cega exatamente para os campos que o spread depois sobrescreve.

3) O backup por atendimento_id (linhas 2570-2588) grava `formRef.current` inteiro (incluindo evolucoes/anexos/documentos) a cada 700ms de inatividade do form, sem excecao para esses campos.

4) Confirmei o cenario de falha citado: em AtendimentoDocumentosSection.tsx:401-412, o botao "Registrar Evolucao" faz `await api.post(.../evolucoes, evolucaoForm)` e depois `await abrirAtendimento(selecionado)` — sem nunca chamar `setForm` no form pai antes disso (evolucaoForm e estado local isolado). Logo o `form.evolucoes` do pai so e atualizado via abrirAtendimento, que le o backup gravado ANTES da evolucao ser criada (contendo a lista antiga de evolucoes) e o aplica por cima do `hydrated` (que ja tem a evolucao nova) — a evolucao recem-criada some da tela mesmo existindo no banco.

5) Confirmei tambem que `lastPersistedSnapshotRef.current = serializeAtendimentoSnapshot(hydrated)` (linha 2684) fica ancorado no snapshot do SERVIDOR, nao no do candidato adotado — exatamente como descrito, isso faz o proximo autosave remoto (1.8s, AUTOSAVE_DELAY_MS=1109) comparar form(=candidato) contra esse snapshot antigo, detectar diferenca e disparar PUT com `buildAtendimentoPayload(candidato)` (linha 3995), reenviando ao servidor exames/prescricao/triagem/diagnostico que vieram do backup desatualizado — podendo reverter dados mais novos gravados no servidor nesse intervalo.

6) Contraste que reforca o achado: no fluxo normal de autosave (linhas 4029-4037) existe `mergeAutoSavedFormState` (linha 1310), que faz merge campo-a-campo cuidadoso entre `current` e `persisted` preservando o restante de `current` implicitamente (nao mexe em evolucoes/anexos/documentos porque nunca precisa). Isso mostra que o time ja tinha o cuidado de nao fazer spread cego em outros lugares — mas essa mesma cautela nao foi aplicada em abrirAtendimento ao aplicar o backup local, que faz um spread bruto do objeto inteiro.

7) Nao ha nenhum guard, filtro ou whitelist de campos entre a leitura do backup (linha 2641) e o `setForm(formParaAplicar)` (linha 2668) que exclua evolucoes/anexos/documentos/especie do candidato. `clearDraftStorage()` chamado na linha 2659 tambem nao limpa a backupKey (so limpa ATENDIMENTO_DRAFT_KEY, pois e chamado sem argumento), entao o backup obsoleto tampouco e invalidado nesse ponto.

Nao encontrei esse item na lista de "ja corrigidos" fornecida — nenhum dos itens listados trata de reconciliacao backup-local vs. servidor em abrirAtendimento.

</details>

---

## 2. [ALTA] Liberar exame no portal sobrescreve permanentemente o campo observacoes do exame com uma mensagem fixa

**Dimensao:** Integridade de dados clinicos  
**Local:** `backend/app/api/v1/endpoints/atendimento.py:4072`

**Descricao:** Em `liberar_exame_no_portal` (linha 4072), `exame.observacoes = PORTAL_EXAME_RELEASE_MESSAGE` sobrescreve incondicionalmente o texto que estava no campo `observacoes` do exame (o mesmo campo editado pelo vet no textarea 'Observacoes complementares da solicitacao' em AtendimentoExamesSection.tsx linha 515-519) por uma string fixa ('Exame liberado no portal da clinica parceira.'). Nao ha backup do valor anterior em lugar nenhum (nem coluna extra, nem log de auditoria com o texto antigo - `_auditar_transicao_exame_portal` so registra status_anterior). Em `revogar_liberacao_exame_no_portal` (linhas 4135-4136), a tentativa de 'desfazer' so zera o campo (`exame.observacoes = ""`) se o valor atual for exatamente a mensagem fixa - ou seja, mesmo revogando a liberacao, o texto clinico original do vet nunca volta: o campo fica vazio.

**Cenario de falha:** Vet preenche 'Observacoes complementares' de um exame de sangue com uma nota clinica relevante (ex.: 'Coleta dificultada, paciente agitado; repetir se resultado inconsistente'), anexa o PDF do resultado e clica em 'Liberar no portal' (botao em AtendimentoExamesSection.tsx linha 452, chamando alternarLiberacaoExameNoPortal -> POST /exames/{id}/portal/liberar). O texto e substituido de forma irreversivel pela mensagem generica de liberacao. Mesmo se o vet depois clicar 'Revogar portal', o campo so fica em branco - a nota clinica original esta perdida para sempre, sem qualquer trilha de recuperacao.

<details><summary>Justificativa da verificacao adversarial</summary>

Confirmei o achado lendo o codigo atual, nao apenas o codigo citado pelo auditor.

1. `backend/app/api/v1/endpoints/atendimento.py:4072` - dentro de `liberar_exame_no_portal` (definida na linha 4036), `exame.observacoes = PORTAL_EXAME_RELEASE_MESSAGE` e executado incondicionalmente, sem checar ou salvar o valor anterior de `exame.observacoes`.

2. `backend/app/api/v1/endpoints/atendimento.py:4008-4032` - `_auditar_transicao_exame_portal` (chamada em 4090 e 4147) so envia `atendimento_id`, `paciente_id`, `status_anterior` e `status_atual` para `registrar_auditoria`. Nao existe nenhum campo `observacoes_anterior` no payload de auditoria. Conferi tambem `backend/app/services/auditoria_service.py:35-70`: `registrar_auditoria` so persiste o que recebe em `detalhes`; nao ha snapshot generico da linha inteira.

3. `backend/app/api/v1/endpoints/atendimento.py:4135-4136` - em `revogar_liberacao_exame_no_portal`, `exame.observacoes` so e zerado (`= ""`) se o valor atual for exatamente igual a `PORTAL_EXAME_RELEASE_MESSAGE`. Nao ha nenhuma tentativa de restaurar o texto original - so existe zerar ou manter a mensagem fixa.

4. `backend/app/models/laudo.py:80` (classe `Exame`, linha 45) - existe uma unica coluna `observacoes = Column(Text)`. Nao ha coluna extra, `observacoes_internas`, historico ou tabela de versionamento que pudesse guardar o texto original antes do overwrite.

5. `frontend/app/atendimento/components/AtendimentoExamesSection.tsx:515-519` - confirmo que este e exatamente o campo que o veterinario edita ("Observacoes complementares da solicitacao (opcional)"), ligado a `exame.observacoes` via `atualizarExame(index, { observacoes: e.target.value })`. E um `<input>`, nao `<textarea>` como o auditor descreveu, mas e o mesmo campo/mesma coluna do backend - divergencia irrelevante para o merito do achado.

6. `frontend/app/atendimento/page.tsx:3859-3895` - `alternarLiberacaoExameNoPortal` so exibe `window.confirm(...)` quando `acao === "revogar"` (linhas 3864-3871). Para `acao === "liberar"` no ha nenhum aviso ao usuario de que o texto em observacoes sera substituido - o overwrite destrutivo e silencioso do ponto de vista do vet.

7. `backend/tests/test_atendimento_portal_exam_release.py:68` e `:116` - o teste existente semeia `observacoes="ECG concluido."` e depois afirma `exame.observacoes == PORTAL_EXAME_RELEASE_MESSAGE`, confirmando que o overwrite e comportamento testado/assumido como correto hoje - nao ha teste cobrindo preservacao ou restauracao do texto.

8. Verifiquei a lista de itens ja corrigidos fornecida: nenhum deles trata da perda do texto de `observacoes` do exame ao liberar no portal. O item mais proximo ("Save do atendimento revogando liberacao 'Liberado no portal' do exame") e sobre o `status` do exame ser revertido acidentalmente no fluxo de save, nao sobre o conteudo de `observacoes` ser destruido no fluxo de liberar/revogar. Tambem conferi `docs/specs/atendimento-integridade-prontuario/spec.md:59-63` (RF-013): essa spec de 2026-07-31 documenta apenas que o revogar deve "limpar a mensagem de liberacao das observacoes quando ela for a mensagem padrao" - ou seja, o proprio design anterior ja assumia perder o texto original sem prever restauracao, e isso nunca foi endereçado como problema em si.

9. `git blame` mostra que a linha 4072 existe desde o commit `5e90249d6` (2026-07-05), sem alteracoes posteriores relacionadas a preservar o texto.

Conclusao: o achado e real, reproduzivel por leitura de codigo, e nao esta na lista de itens ja corrigidos. Existe perda permanente e irreversivel de um dado clinico (nota complementar do exame) sem qualquer copia de seguranca, sem registro do valor anterior na auditoria, sem aviso ao usuario antes da acao destrutiva, e a "revogacao" nao restaura nada - apenas zera o campo quando ele ainda contem a mensagem padrao.

</details>

---

## 3. [ALTA] Exclusao de anexo individual (DELETE /anexos/{id}) nao tem confirmacao no frontend nem guard de consistencia com exame liberado no portal

**Dimensao:** Integridade de dados clinicos  
**Local:** `backend/app/api/v1/endpoints/atendimento.py:4405`

**Descricao:** O endpoint `excluir_anexo` (linhas 4405-4418) chama `_excluir_anexo_registro`, que remove o arquivo fisico do storage (`remove_atendimento_attachment_file`) e deleta a linha do banco, sem nenhuma verificacao de que esse anexo e o PDF que sustenta um exame com status 'Liberado_portal' (o mesmo tipo de guard que ja existe para a exclusao do EXAME inteiro em `_motivo_bloqueio_exclusao_exame`, linhas 1585-1601, mas que nao existe aqui para o anexo isolado). No frontend, `excluirAnexo` (page.tsx linhas 4633-4645) chama `api.delete` diretamente ao clicar em 'Remover', sem `window.confirm` - diferente de `removerExame` (linha 3814), que exige confirmacao explicita antes de marcar exclusao. O gate de liberacao (`liberar_exame_no_portal`, linha 4062-4063) exige 'ao menos um anexo PDF' no momento da liberacao, mas nada impede que esse mesmo PDF seja apagado depois, sem revogar a liberacao antes.

**Cenario de falha:** Exame de ecocardiograma ja liberado no portal para a clinica parceira (status='Liberado_portal', com o PDF do laudo anexado). Por engano, o usuario clica no icone de lixeira ao lado do anexo (unico clique, sem qualquer dialogo de confirmacao) em 'Arquivos do exame' (AtendimentoExamesSection.tsx linha 743-750). O arquivo e removido do disco e do banco imediatamente; o exame continua com status 'Liberado_portal' e sem nenhum PDF vinculado. A clinica parceira, ao tentar abrir o exame no portal, recebe um link quebrado/404, e nada no sistema sinaliza a inconsistencia ate alguem notar manualmente e revogar a liberacao.

<details><summary>Justificativa da verificacao adversarial</summary>

Conferi o codigo atual e o achado procede, sem sobreposicao com os itens ja corrigidos (aqueles tratam da exclusao do EXAME inteiro, nao do anexo isolado).

Backend: `excluir_anexo` (backend/app/api/v1/endpoints/atendimento.py:4405-4418) busca o anexo por id e chama direto `_excluir_anexo_registro` (linhas 970-972), que apenas roda `remove_atendimento_attachment_file` + `db.delete(anexo)` — nenhuma checagem de `exame.status`/`is_portal_released_status` nem de "e o unico PDF do exame liberado". O guard equivalente que o auditor cita, `_motivo_bloqueio_exclusao_exame` (linhas 1585-1601), so e invocado no fluxo de exclusao do EXAME (chamado em 1830, antes de `_excluir_anexos_por_exame` em 1833/1834) — o endpoint DELETE /anexos/{id} nunca passa por ele. Confirmei tambem que `liberar_exame_no_portal` (linhas 4056-4063) exige "ao menos um PDF" so no momento da liberacao, e que a revogacao (`revogar_liberacao_exame_no_portal`, 4110-4166) e um endpoint manual separado, nao acionado automaticamente quando um anexo e apagado depois.

O proprio teste do repo documenta esse fluxo como o comportamento intencional: `test_remover_anexo_individual_depois_excluir_exame_agora_vazio` (backend/tests/test_atendimento_exame_integridade.py:201-215) explica que "o guard exige remover o anexo primeiro (endpoint dedicado DELETE /anexos/{id})" precisamente porque esse endpoint nao tem guard — mas nenhum teste cobre o caso de um exame com status PORTAL_RELEASED_STATUS.

Frontend: `removerExame` (frontend/app/atendimento/page.tsx:3814-3839) exige `window.confirm` antes de marcar exclusao; `excluirAnexo` (linhas 4633-4645) chama `api.delete` diretamente, sem confirm. O botao "Remover" em AtendimentoExamesSection.tsx:743-749 (e o equivalente em AtendimentoDocumentosSection.tsx:460) esta ligado direto a `excluirAnexo`, sem dialogo e sem disable condicionado a `exame.status`/liberacao no portal — nao ha nenhuma referencia a status de liberacao (`Liberado_portal`/`is_portal_released_status`) nesses dois arquivos de frontend.

O cenario de falha e realista: exame ja liberado, PDF unico anexado, um clique no icone de lixeira apaga arquivo fisico e registro sem aviso, sem revogar a liberacao e sem qualquer sinalizacao — a clinica parceira passa a ver link quebrado ate alguem notar manualmente.

</details>

---

## 4. [ALTA] Troca rapida de paciente pode aplicar historico/cadastro complementar do paciente errado, com risco de sobrescrever o cadastro real via PUT /pacientes/{id}

**Dimensao:** Race conditions e gerenciamento de estado (frontend)  
**Local:** `frontend/app/atendimento/page.tsx:2605`

**Descricao:** O efeito que reage a mudanca de `form.paciente_id` (linhas 2605-2618) dispara `carregarHistoricoPaciente(form.paciente_id)` (linhas 2590-2603) e `carregarCadastroComplementar(form.paciente_id)` (linhas 1698-1740) via `void`, sem nenhum token/flag de cancelamento (nao ha o padrao `let active = true` usado em outros efeitos do mesmo arquivo, ex.: linha 1962 para o import de fuse.js). Cada chamada termina com um `setHistoricoPaciente(...)`/`setCadastroComplementar(...)` incondicional assim que sua propria requisicao resolve, sem checar se o paciente selecionado no momento da resposta ainda e o mesmo que originou a chamada.

**Cenario de falha:** Usuario seleciona o Paciente A (dispara fetch de historico/cadastro de A) e, antes da resposta chegar, seleciona o Paciente B (dispara fetch de B). Se a resposta de A chegar depois da de B (rede mais lenta para A, por ter mais historico), `historicoPaciente` e `cadastroComplementar` acabam populados com os dados de A mesmo com `form.paciente_id` corretamente apontando para B. Se o usuario entao clicar em 'Salvar cadastro complementar' (`salvarCadastroComplementarAtual`, linha 3037), o payload e montado a partir de `cadastroComplementar.*` (dados de A) mas o PUT e enviado para `/pacientes/${form.paciente_id}` (linha 3073), ou seja, para o paciente B - sobrescrevendo silenciosamente nome/tutor/telefone/endereco/peso/raca reais de B com os dados de A.

<details><summary>Justificativa da verificacao adversarial</summary>

Conferi o codigo atual e o achado procede exatamente como descrito.

1) `frontend/app/atendimento/page.tsx:2605-2618` - o `useEffect` que reage a `form.paciente_id` dispara `void carregarHistoricoPaciente(form.paciente_id)` e `void carregarCadastroComplementar(form.paciente_id)` sem nenhum token de cancelamento. Contrastando com o padrao `let active = true` usado no mesmo arquivo para o import dinamico de fuse.js (linha 1962-1974), aqui nao ha guarda equivalente.

2) `carregarHistoricoPaciente` (linhas 2590-2603) e `carregarCadastroComplementar` (linhas 1698-1740) fazem `setHistoricoPaciente(...)` / chamam `aplicarCadastroComplementar(...)` (que faz `setCadastroComplementar(...)`, linha 1686-1696) de forma incondicional ao resolver, sem comparar o `pacienteId` do fecho da chamada com o `form.paciente_id` (ou `pacienteSelecionado`) vigente no momento da resposta. Se o usuario trocar de paciente A -> B antes da resposta de A chegar, e a resposta de A chegar depois da de B, o estado `cadastroComplementar` fica populado com os dados de A mesmo com `form.paciente_id` apontando para B.

3) `salvarCadastroComplementarAtual` (linhas 3037-3099) monta o payload inteiramente a partir de `cadastroComplementar.paciente.*` / `cadastroComplementar.tutor.*` (nome, tutor_id, telefones, cpf, endereco, especie, raca, sexo, peso, microchip, observacoes - linhas 3046-3071) e envia `await api.put(\`/pacientes/${pacienteId}\`, pacientePayload)` (linha 3073) onde `pacienteId = Number(form.paciente_id)` (linha 3045). Nao ha nenhuma verificacao de que `cadastroComplementar` corresponde ao `pacienteId` atual antes do PUT.

4) O unico guard existente no botao 'Salvar cadastro' e `disabled={!form.paciente_id || salvandoCadastroComplementar || carregandoCadastroComplementar}` (`AtendimentoCadastroComplementarSection.tsx:75`). Esse `carregandoCadastroComplementar` e um booleano global (nao por-requisicao): ele volta a `false` assim que a PRIMEIRA fetch em voo terminar (ex.: a de B, mais rapida), mesmo que a fetch de A ainda esteja pendente. Quando a resposta de A chega depois, ela sobrescreve `cadastroComplementar` sem religar o flag de loading, entao o botao ja esta habilitado e o usuario pode salvar dados de A sob o id de B.

Nao ha nenhum request-id/ref de "ultima selecao" nem comparacao de paciente no momento da resposta em nenhum dos dois carregadores, nem em `aplicarCadastroComplementar`. O achado nao corresponde a nenhum item da lista de "ja corrigido" (esses tratam de exclusao de exame, revogacao de liberacao no portal, agendamento_id null, autosave/beforeunload, calculo mg/kg, cadastro complementar zerado ao reabrir mesmo paciente, consulta_concluida sobrescrita, DELETE sem guard, filtro de data, indices de exame por posicao, herdar dados do atendimento anterior, layout de botoes, filtro de documentacao incompleta) - nenhum desses trata de troca RAPIDA de paciente com respostas fora de ordem.

</details>

---

## 5. [ALTA] Abrir dois atendimentos em sequencia rapida na lista lateral pode carregar o prontuario do atendimento errado no formulario

**Dimensao:** Race conditions e gerenciamento de estado (frontend)  
**Local:** `frontend/app/atendimento/page.tsx:2620`

**Descricao:** `abrirAtendimento(id)` (linhas 2620-2703) nao possui nenhum guard de concorrencia: nao ha token de requisicao, nao ha AbortController, e o botao que a chama (linha 6375: `<button onClick={() => abrirAtendimento(item.id)}>`) nao fica desabilitado enquanto uma chamada anterior ainda esta em voo. A funcao faz `await api.get(...)`, e so entao chama `setSelecionado(id)` e `setForm(formParaAplicar)` incondicionalmente, alem de setar `lastPersistedSnapshotRef.current` e `hydratingFormRef.current`.

**Cenario de falha:** Usuario clica no atendimento #101 na lista e, antes da resposta chegar, clica no atendimento #205. As duas chamadas a `abrirAtendimento` ficam concorrentes; se a resposta de #101 (que foi disparada primeiro) chegar depois da de #205, o formulario acaba populado com os dados de #101 (paciente, exames, prescricao) mesmo com o ultimo clique tendo sido em #205 - incluindo `setSelecionado(101)` sobrescrevendo o 205 ja aplicado. O item destacado na lista (`selecionado === item.id`) tambem reflete #101, entao a inconsistencia pode passar despercebida; se o veterinario continuar digitando e salvar, as novas anotacoes clinicas sao gravadas no atendimento #101 (potencialmente de outro paciente), nao no #205 que ele pretendia abrir.

<details><summary>Justificativa da verificacao adversarial</summary>

Conferi frontend/app/atendimento/page.tsx:2620-2703 (abrirAtendimento) e nao ha nenhum mecanismo de concorrencia: nao existe token de requisicao, AbortController, nem flag "carregando" que bloqueie chamadas sobrepostas. A unica checagem de guarda (linhas 2621-2628) so dispara `window.confirm` quando `!selecionado && hasEncounterContent(formRef.current)` - ou seja, so protege contra descartar um rascunho nao salvo quando nada esta selecionado ainda; nao impede duas chamadas concorrentes a `abrirAtendimento`, pois em ambos os cliques rapidos `selecionado` ainda e null no momento da checagem (setSelecionado so ocorre apos o await, linha 2658). Apos o `await api.get` (linha 2630), o codigo aplica incondicionalmente `setSelecionado(id)` (linha 2658), `setForm(formParaAplicar)` (linha 2668), `lastPersistedSnapshotRef.current = ...` (linha 2684) e `hydratingFormRef.current` (linhas 2667/2696), sem checar se `id` ainda corresponde ao clique mais recente do usuario. O botao da lista lateral (linha 6375: `<button onClick={() => abrirAtendimento(item.id)} className="w-full text-left">`) tambem nao tem `disabled` nem debounce. Busquei explicitamente por qualquer guard de concorrencia (`AbortController`, `requestIdRef`, `loadTokenRef`, `abortRef`, flags como `abrindoAtendimento`/`carregandoAtendimento`, comparacao `current !== id` pos-await) e o unico uso de AbortController no arquivo e para upload de exames (linhas 1466, 4505-4506), nao relacionado a esta funcao. Confirmei tambem que `loading` (state global, linhas 1346/1983/2001) so e usado no carregamento inicial da pagina, nao durante `abrirAtendimento`. Portanto, se a resposta do primeiro clique (#101) chegar depois da resposta do segundo clique (#205), o `setSelecionado(101)` e `setForm(dadosDe101)` executam por ultimo e sobrescrevem o estado ja aplicado para #205, exatamente como descrito pelo auditor. Este item nao consta na lista de achados ja corrigidos em pacotes anteriores.

</details>

---

## 6. [ALTA] Nenhuma exclusao mutua entre PUT manual e PUT de autosave para o mesmo atendimento ja existente - risco de lost update sem controle de concorrencia no backend

**Dimensao:** Race conditions e gerenciamento de estado (frontend)  
**Local:** `frontend/app/atendimento/page.tsx:6137`

**Descricao:** O botao 'Salvar atendimento' so fica desabilitado com `disabled={salvando || finalizando || (!selecionado && autosaveState === "saving")}` (linha 6137) - a clausula `!selecionado &&` faz com que, assim que o atendimento ja existe (`selecionado` truthy), um autosave em andamento (`autosaveState === "saving"`) deixe de bloquear o clique manual. Dentro de `saveAtendimento` (linhas 3950-4078), o unico guard de idempotencia (`criandoAtendimentoAutomaticoRef`, linhas 3969-3987) so cobre o caso de criacao automatica sem `selecionadoRef.current`; quando `selecionadoRef.current` existe, tanto o modo manual quanto o autosave chamam `api.put(`/atendimentos/${selecionadoRef.current}`, payload)` (linha 3999) sem qualquer lock. O endpoint `PUT /atendimentos/{id}` no backend (`backend/app/api/v1/endpoints/atendimento.py:2994`) faz um read-modify-write simples, sem checagem de versao/`updated_at`, portanto aceita as duas requisicoes concorrentes normalmente.

**Cenario de falha:** Atendimento #42 ja salvo. O timer de autosave dispara `saveAtendimento("autosave")` (PUT com o payload de 2s atras) e, antes dessa resposta voltar, o usuario digita mais uma linha em `plano_terapeutico` e clica manualmente em 'Salvar atendimento' (botao habilitado, pois `selecionado` e truthy), disparando um segundo PUT com o payload mais novo. Se o PUT do autosave for processado pelo backend depois do PUT manual (nao ha nenhuma garantia de ordem entre as duas requisicoes concorrentes), o registro no banco fica com o conteudo mais antigo, apagando a ultima linha digitada mesmo apos o usuario ver a mensagem 'Atendimento atualizado com sucesso.'

<details><summary>Justificativa da verificacao adversarial</summary>

Achado real, verificado ponta a ponta no codigo atual (nao consta na lista de itens ja corrigidos - o item da lista sobre "criacao automatica sem guarda de idempotencia" trata de outro problema, a duplicacao de POST, nao da colisao PUT manual x autosave aqui descrita).

1) frontend/app/atendimento/page.tsx:6137 - confirmado o texto exato: `disabled={salvando || finalizando || (!selecionado && autosaveState === "saving")}`. A clausula `!selecionado &&` realmente faz o botao ficar habilitado durante um autosave "saving" assim que o atendimento ja existe.

2) frontend/app/atendimento/page.tsx:3969-3987 - o unico guard de concorrencia dentro de `saveAtendimento` e `!isAutosave && !selecionadoRef.current && criandoAtendimentoAutomaticoRef.current`, que so atua quando `selecionadoRef.current` e falso (fase de criacao). Quando o atendimento ja existe, esse guard e pulado por completo.

3) frontend/app/atendimento/page.tsx:3998-3999 - tanto o modo manual quanto o autosave chamam exatamente `api.put(`/atendimentos/${selecionadoRef.current}`, payload)` sem qualquer mutex, AbortController ou fila.

4) frontend/lib/axios.ts - a instancia axios usada (`api`) e um client simples, sem interceptor de serializacao/fila de requisicoes por recurso; nada impede duas chamadas PUT concorrentes para o mesmo id.

5) frontend/app/atendimento/page.tsx:1181-1199 (`buildAtendimentoPayload`) - o payload envia o valor corrente completo de campos como `plano_terapeutico` (nao um diff incremental), entao a requisicao que "vencer" no backend sobrescreve integralmente o campo com o snapshot que carregava.

6) backend/app/api/v1/endpoints/atendimento.py:2994-3181 (`atualizar_atendimento`, PUT /{atendimento_id}) - li a funcao inteira: e um read-modify-write simples (`db.query(...).first()` seguido de atribuicoes de campo e commit), sem qualquer comparacao de `updated_at`/versao, sem header If-Match, sem `with_for_update`. Para contraste, o endpoint de finalizacao (linhas ~3376-3408, `_adquirir_lock_finalizacao` e `.with_for_update()`) usa lock explicito - ou seja, o padrao de protecao existe no codebase, mas NAO foi aplicado ao PUT generico usado pelo autosave/save manual.

7) AUTOSAVE_DELAY_MS = 1800 (linha 1109) confirma a janela de debounce citada pelo auditor (~1.8s), plausivel para o cenario descrito: usuario digita, autosave dispara PUT com payload antigo, usuario digita mais uma linha e clica "Salvar" antes da resposta do autosave voltar, gerando dois PUT concorrentes sem garantia de ordem de conclusao no backend.

O cenario de "lost update" e tecnicamente correto: se a resposta do PUT do autosave (payload mais antigo) chegar ao servidor e commitar DEPOIS do PUT manual (payload mais novo), o registro final no banco fica com o conteudo antigo, mesmo com a UI exibindo "Atendimento atualizado com sucesso." (a UI hidrata o formulario a partir da propria resposta do PUT manual, sem refazer um GET pos-race, entao a perda fica invisivel ate a proxima abertura do prontuario). Trata-se de perda silenciosa de dado clinico (ex.: uma linha de plano terapeutico), sem qualquer controle de concorrencia (nem otimista via versao/updated_at, nem lock pessimista, nem mutex no cliente), em um modulo de prontuario medico. A severidade "alta" do auditor esta correta dado o impacto (perda silenciosa de dado clinico com falsa confirmacao de sucesso) e a plausibilidade real do gatilho (habito comum de clicar "Salvar" logo apos parar de digitar).

</details>

---

## 7. [ALTA] SSRF + vazamento do token de storage remoto via campo url livre em anexos "externo"

**Dimensao:** Seguranca (autorizacao, IDOR, validacao de entrada)  
**Local:** `backend/app/api/v1/endpoints/atendimento.py`

**Descricao:** POST /{atendimento_id}/anexos (criar_anexo, linhas 4184-4219) cria um AnexoAtendimento a partir de AnexoPayload (backend/app/schemas/atendimento.py:93-100), cujo campo `url: str` nao tem NENHUMA validacao (sem HttpUrl, sem whitelist de dominio/scheme, sem checagem de tamanho/mime). Diferente do endpoint de upload real (/anexos/upload), que usa atendimento_upload_service com whitelist de extensao/mime e limite de 25MB, este endpoint aceita qualquer string em `url`, sem `caminho_arquivo`. Quando o anexo e baixado via GET /anexos/{anexo_id}/arquivo (baixar_arquivo_anexo, linhas 4389-4402), ele chama build_attachment_download_response -> resolve_attachment_download_source (backend/app/services/attachment_download_service.py:21-40), que so valida scheme http/https e presenca de netloc (_normalize_remote_url, linhas 21-28) sem bloquear IPs privados/loopback/link-local. Em seguida _build_remote_download_response (linhas 76-111) faz um GET server-side com httpx (follow_redirects=True) para essa URL, anexando o header de autenticacao PORTAL_REMOTE_STORAGE_AUTH_TOKEN (via _build_remote_headers, linhas 47-58) e faz stream da resposta de volta ao cliente.

**Cenario de falha:** Qualquer usuario autenticado com permissao de edicao no modulo atendimento_clinico (a maioria dos papeis internos) chama POST /api/v1/atendimentos/{id}/anexos com {"tipo":"resultado","url":"http://169.254.169.254/latest/meta-data/","nome_original":"x.pdf","mime_type":"application/pdf"} e depois GET /api/v1/atendimentos/anexos/{anexo_id}/arquivo. O backend faz a requisicao SSRF para o endpoint interno/metadata e devolve o conteudo ao atacante. Se `url` apontar para um host externo controlado pelo atacante (ex.: https://attacker.example/collect) e PORTAL_REMOTE_STORAGE_AUTH_TOKEN estiver configurado (usado para autenticar no storage real de anexos remotos), esse token secreto e enviado no header Authorization/custom para o servidor do atacante, vazando a credencial de storage.

<details><summary>Justificativa da verificacao adversarial</summary>

Confirmei o achado lendo o codigo atual, ponto a ponto:

1) backend/app/schemas/atendimento.py:93-100 — `AnexoPayload.url` e tipado apenas como `str` (Field simples), sem HttpUrl, sem whitelist de scheme/dominio, sem limite de tamanho/mime.

2) backend/app/api/v1/endpoints/atendimento.py:4184-4219 (`criar_anexo`) — recebe esse payload e grava `url=payload.url` direto no `AnexoAtendimento` com `origem="externo"`, sem nenhuma validacao adicional antes de persistir. Nao ha `caminho_arquivo`, diferente do fluxo real de upload (`upload_anexo`, linhas 4222-4386) que usa `store_atendimento_attachment_file` com dedupe, limite de tamanho (`AttachmentTooLargeError`) e checagem de tipo (`AttachmentTypeError`).

3) backend/app/services/attachment_download_service.py:21-28 (`_normalize_remote_url`) — so valida `scheme in {http,https}` e presenca de `netloc`; nao existe em lugar nenhum do backend qualquer checagem de IP privado/loopback/link-local (confirmei com `grep -rn "ipaddress|is_private|is_loopback|169.254|SSRF" backend/app` — zero resultados no projeto inteiro).

4) attachment_download_service.py:76-111 (`_build_remote_download_response`) — cria `httpx.Client(follow_redirects=True, ...)`, injeta headers via `_build_remote_headers()` (linhas 47-58) que anexa `settings.PORTAL_REMOTE_STORAGE_AUTH_TOKEN` (existe em backend/app/core/config.py:131-133) em toda requisicao remota, e faz stream do corpo de volta ao cliente via `StreamingResponse`. Nao ha diferenciacao entre "e um host do meu storage legitimo" e "e qualquer URL http/https que o usuario colocou".

5) backend/app/api/v1/endpoints/atendimento.py:4389-4402 (`baixar_arquivo_anexo`) — so exige usuario autenticado (`get_current_user`), sem checagem de dono/role adicional, e chama `build_attachment_download_response` que cai no caminho remoto acima quando `caminho_arquivo` nao existe (que e sempre o caso para anexos criados via `criar_anexo`).

6) Confirmei tambem o modelo de autorizacao em backend/app/core/security.py:17-63 e 152-176: `/api/v1/atendimentos` mapeia para o modulo `atendimento_clinico` (linha 39), POST exige acao `editar` e GET exige `visualizar` (linhas 57-63) — isso bate exatamente com a premissa do auditor de que "a maioria dos papeis internos" com permissao de edicao no modulo consegue disparar o POST, e qualquer usuario autenticado (com visualizar) consegue disparar o GET de download.

7) O servico `attachment_download_service` e compartilhado com `portal.py:1445` e `laudos.py:2323`, ou seja, o mesmo vetor SSRF + vazamento de token existe potencialmente em mais de um endpoint, ampliando o raio de impacto.

Nao ha nenhuma mitigacao (whitelist de dominio, bloqueio de IP privado/metadata, resolucao de DNS/checagem de destino, ou sanitizacao) em qualquer lugar do codigo. O achado nao aparece na lista de itens ja corrigidos em pacotes anteriores da auditoria (que trata de outros temas: exclusao de exame, liberacao no portal, autosave, calculo de dose, etc.) — e um achado de seguranca de infraestrutura de anexos que nao tem sobreposicao com nenhum item daquela lista.

Concordo com a severidade alta: e um SSRF classico (pode atingir metadata de nuvem 169.254.169.254, servicos internos na rede, portas internas) combinado com exfiltracao de um segredo real de infraestrutura (`PORTAL_REMOTE_STORAGE_AUTH_TOKEN`) para um host arbitrario controlado pelo atacante, acessivel por uma populacao grande de usuarios internos autenticados (qualquer papel com permissao de editar em atendimento_clinico), e o mesmo servico vulneravel e reutilizado em laudos e portal.

</details>

---

## 8. [ALTA] Exame.laudo_id aceito sem validar propriedade, permitindo exposicao cruzada de laudo/clinica no portal

**Dimensao:** Seguranca (autorizacao, IDOR, validacao de entrada)  
**Local:** `backend/app/api/v1/endpoints/atendimento.py`

**Descricao:** Em _sync_exames (chamada por criar_atendimento e atualizar_atendimento), a linha `exame.laudo_id = payload.laudo_id` grava o laudo_id vindo do payload do usuario (ExameSolicitacaoPayload.laudo_id, backend/app/schemas/atendimento.py:33) sem checar se o Laudo existe, se pertence ao mesmo paciente do exame/atendimento, ou a mesma clinica. Esse valor depois e usado pelo portal (backend/app/api/v1/endpoints/portal.py) para: (a) decidir clinica do exame via _resolve_exam_clinica_id (linhas 364-377, que cai no clinic_id do laudo quando nao ha atendimento com clinica), (b) liberar visibilidade via _is_exam_released_to_portal (linhas 400-407, que considera o exame liberado se o STATUS DO LAUDO vinculado estiver liberado, mesmo que o laudo seja de outro paciente), e (c) montar listagens da clinica parceira com `clinic_filter = or_(AtendimentoClinico.clinica_id == clinica_id, Laudo.clinic_id == clinica_id)` (portal.py linhas 648-651 e ~1117-1120), que exibe o exame para QUALQUER clinica cujo id bata com o laudo vinculado, independente da clinica real do atendimento.

**Cenario de falha:** Ao salvar um atendimento do Paciente A (tutor A, clinica X), um usuario informa (por erro de digitacao ou maliciosamente) `exames[0].laudo_id = 999`, onde o laudo 999 pertence ao Paciente B (clinica Y) e ja esta com status liberado no portal. O exame do Paciente A passa a ser considerado "liberado no portal" por causa do laudo 999. O tutor do Paciente A, ao abrir seu proprio pet no portal (que so escopa por paciente_id, funcao _assert_tutor_scope), ve na tela desse exame o conteudo do laudo 999 -- um relatorio clinico confidencial de outro paciente/tutor. Da mesma forma, a Clinica Y (login de clinica parceira) passa a enxergar, no seu painel/lista de exames, o resumo (nome do pet, tutor, tipo de exame, status, datas) de um atendimento que na verdade e da Clinica X, por causa do filtro OR baseado em Laudo.clinic_id.

<details><summary>Justificativa da verificacao adversarial</summary>

Confirmei o achado lendo o codigo atual, ponto a ponto:

1. Falta de validacao na escrita: backend/app/api/v1/endpoints/atendimento.py:1822 - `exame.laudo_id = payload.laudo_id` dentro de `_sync_exames` (definida em 1742) grava o valor vindo direto do payload sem NENHUMA checagem (nao busca o Laudo no banco, nao compara paciente_id, nao compara clinica). O campo `Exame.laudo_id` (backend/app/models/laudo.py:51) e um `Integer` puro, sem `ForeignKey` e sem trigger de validacao. O schema `ExameSolicitacaoPayload.laudo_id` (backend/app/schemas/atendimento.py:33) tambem e um `Optional[int]` livre, sem validator. `_sync_exames` e chamada tanto por `criar_atendimento` (atendimento.py:2973) quanto por `atualizar_atendimento` (atendimento.py:3185), ambas atras apenas de `get_current_user` generico (linha 2876), sem qualquer verificacao de propriedade do laudo_id informado.

2. Uso indevido no portal - clinic_id: `_resolve_exam_clinica_id` (portal.py:361-373) cai em `laudo.clinic_id` quando nao ha atendimento/atendimento.clinica_id. `_is_exam_released_to_portal` (portal.py:400-407) considera o exame liberado se o laudo vinculado tiver status liberado, independente de o laudo ser de outro paciente/clinica.

3. Confirmei o vazamento mais grave e concreto: em `listar_exames_clinica_portal` (portal.py:1094-1183), o filtro `clinic_filter = or_(AtendimentoClinico.clinica_id == portal_session.clinica_id, Laudo.clinic_id == portal_session.clinica_id)` (portal.py:1117-1120, replicado em `_build_clinic_operational_panel` linhas 648-651) e aplicado independentemente de `_resolve_exam_clinica_id` - basta o `Exame.laudo_id` apontar para um laudo cujo `clinic_id` seja da Clinica Y para que o exame do Paciente A/Clinica X apareca na listagem da Clinica Y via `_build_exam_summary`, que inclui `paciente_nome`, `tutor_nome`, `especie`, `tipo_exame`, `categoria_exame`, `status`, datas e `observacoes` (portal.py:420-443). Esse vazamento nao depende de `atendimento.clinica_id` ser nulo - e um bug direto na clausula OR da query.

4. Para o cenario do tutor, o vazamento e real mas um pouco mais estreito do que a descricao do auditor sugere: o tutor so ve o proprio paciente (`_assert_tutor_scope`, portal.py:340-350, ainda escopado por paciente_id/tutor_id corretamente) e os anexos exibidos vem de `AnexoAtendimento.exame_id` (portal.py:854-862), ou seja, sao os anexos do proprio exame do Paciente A, nao do laudo 999. O que realmente vaza do laudo estranho para o tutor e: (a) o exame passa a status "liberado" prematuramente/indevidamente so por causa do laudo alheio, e (b) o campo `data_exame` exibido vem de `laudo.data_exame` (portal.py:438, `_build_exam_summary`). Ou seja, nao ha exposicao do "conteudo" do laudo 999 propriamente dito para o tutor - a frase do auditor exagera esse sub-caso - mas o vazamento de status/liberacao indevida e real.

5. Verifiquei a lista de itens ja corrigidos fornecida e nenhum deles cobre validacao de propriedade de `laudo_id`; nao ha guard equivalente em nenhum lugar do arquivo (busquei todas ocorrencias de `laudo_id` em atendimento.py - linhas 1514, 1587-1589, 1822 - as duas primeiras sao apenas leitura/serializacao e checagem de bloqueio de exclusao, nao validacao de propriedade).

Em suma: o nucleo do achado (ausencia de validacao de propriedade/tenant do `laudo_id` em `_sync_exames`, permitindo que a listagem de exames da Clinica Y exiba dados de paciente/tutor de outra clinica, e que o exame seja liberado prematuramente no portal do tutor) esta confirmado e nao corrigido. E um caso classico de IDOR/broken-object-level-authorization que atravessa fronteira de tenant (clinica parceira externa e tutor), com PII/dados clinicos reais expostos na listagem da clinica - isso justifica severidade alta, mesmo com a ressalva de que a alegacao de "exposicao do conteudo do laudo" ao tutor e um pouco mais forte do que o que o codigo realmente entrega (vaza status/data, nao o corpo do laudo).

</details>

---

## 9. [ALTA] PUT /atendimentos/{id} sobrescreve todo o conteudo clinico do prontuario sem nenhum registro de auditoria

**Dimensao:** Auditoria e rastreabilidade  
**Local:** `backend/app/api/v1/endpoints/atendimento.py:3165`

**Descricao:** Em `atualizar_atendimento` (linha 2994), os campos setattr'ados no loop das linhas 3165-3179 (queixa_principal, anamnese, exame_fisico, dados_clinicos, diagnostico_principal/secundario/diferencial, plano_terapeutico, retorno_recomendado, motivo_retorno, observacoes), alem da triagem (3137-3148) e do status quando nao e conclusao (3130-3131), sao sobrescritos diretamente no ORM sem qualquer chamada a `registrar_auditoria`. So existem duas chamadas de auditoria nesse endpoint (linhas 3202-3208 e 3209-3215), e ambas cobrem apenas efeitos colaterais especificos (desvinculo de agendamento e conclusao com pendencias) - nao o conteudo clinico em si. Esse mesmo endpoint e o unico caminho de escrita usado pelo frontend para salvar/autosave do atendimento (frontend/app/atendimento/page.tsx:3999).

**Cenario de falha:** Um usuario autenticado envia PUT /atendimentos/42 alterando diagnostico_principal de "suspeita de cardiomiopatia dilatada" para um texto diferente (ou vazio) depois que a consulta ja foi concluida e o tutor recebeu o laudo. O valor anterior e perdido, nao ha nenhuma linha em auditoria_eventos, e nao existe versao anterior para comparar - o prontuario pode ser reescrito silenciosamente a qualquer momento, inclusive pelo autosave periodico, sem nenhum rastro de quem mudou o que.

<details><summary>Justificativa da verificacao adversarial</summary>

Confirmei lendo o codigo atual de backend/app/api/v1/endpoints/atendimento.py, endpoint `atualizar_atendimento` (PUT /{atendimento_id}, linhas 2994-3216):

1. Triagem (3137-3148): peso, temperatura, FC, FR, PA, SpO2, escore, mucosas, hidratacao e observacoes de triagem sao setattr'ados direto no ORM, sem qualquer chamada a `registrar_auditoria`.
2. Diagnostico (3158-3163): quando `payload.diagnostico is not None`, diagnostico_principal/secundario/diferencial e prognostico sao sobrescritos direto — tambem sem auditoria. (Nota: o achado do auditor cita esses campos como parte do loop 3165-3179, mas na verdade diagnostico_* e setado nesse bloco separado em 3158-3163, ja que nao existem como chaves top-level no payload — `data` exclui "diagnostico" e o model_dump nao achata o objeto aninhado. E um detalhe de localizacao, nao muda a substancia: o efeito de "sobrescrita sem auditoria" e real para esses campos tambem.)
3. O loop 3165-3179 confirma sobrescrita sem auditoria para queixa_principal, anamnese, exame_fisico, dados_clinicos, plano_terapeutico, retorno_recomendado, motivo_retorno e observacoes — esses sim sao chaves diretas do payload.
4. Status (3130-3131): `atendimento.status = status_destino` tambem sem auditoria propria.
5. As unicas duas chamadas de auditoria no endpoint sao `_auditar_desvinculo_agendamento` (3202-3208, definida em 3219-3243) e `_auditar_conclusao_com_pendencias` (3209-3215, definida em 413-434) — ambas cobrem apenas efeitos colaterais pontuais (desvinculo de agendamento, conclusao com documentacao incompleta), nunca o conteudo clinico em si.
6. Verifiquei os guards de conclusao/reabertura (3065-3103): eles so disparam quando `agendamento_referencia` e verdadeiro E o campo `status` esta sendo alterado no payload. Um PUT que omite o campo `status` (ex.: so envia `diagnostico_principal`) faz `status_destino == status_atual`, entao nenhum guard de reabertura dispara — o conteudo clinico de um atendimento ja Concluido pode ser silenciosamente sobrescrito, com ou sem agendamento vinculado, exatamente como descrito no cenario do auditor.
7. Busquei por qualquer mecanismo alternativo de rastreabilidade (SQLAlchemy `event.listens_for`, middleware generico de auditoria em main.py linhas 296-390, colunas de versionamento/historico em models/atendimento_clinico.py) — nao existe nenhum. `registrar_auditoria` (services/auditoria_service.py:35-71) e best-effort e so roda quando explicitamente chamado; nao ha diffing automatico nem tabela de historico/versoes do prontuario.
8. Nao corresponde a nenhum item da lista de achados ja corrigidos (esses tratam de exclusao/liberacao de exame, calculo de prescricao, cadastro complementar, DELETE do atendimento etc. — nenhum trata de auditoria do conteudo clinico geral no PUT).

Conclusao: o achado e real e preciso em sua essencia (apenas a linha exata do diagnostico difere ligeiramente da citada pelo auditor).

</details>

---

## 10. [ALTA] Edicao de exame existente (resultado, valor_referencia, unidade, prioridade, status) nao guarda historico, ao contrario da prescricao

**Dimensao:** Auditoria e rastreabilidade  
**Local:** `backend/app/api/v1/endpoints/atendimento.py:1808`

**Descricao:** `_sync_exames` (linha 1742) sobrescreve diretamente exame.resultado, exame.valor_referencia, exame.unidade, exame.prioridade, exame.status e exame.observacoes (linhas 1807-1820) para um exame ja existente (`payload.id in existentes`), sem guardar o valor anterior em nenhum lugar. Isso contrasta com `_sync_prescricao` (linha 1837), que para cada item existente chama `_registrar_ajuste_prescricao` (linha 1905-1915) e persiste cada mudanca de campo em `PrescricaoItemAjuste` (definido em `_registrar_ajuste_prescricao`, linha 186-213). Nao existe equivalente de `PrescricaoItemAjuste` para `Exame`, nem chamada a `registrar_auditoria`.

**Cenario de falha:** Um hemograma tem resultado="Leucocitose importante, sugestivo de processo infeccioso" salvo em um atendimento. Em um save posterior do mesmo prontuario (o mesmo payload de exames e reenviado a cada PUT/autosave), o campo resultado e alterado para "Normal". O UPDATE substitui o valor sem deixar rastro: nao ha ajuste de exame equivalente ao PrescricaoItemAjuste, nem entrada de auditoria - se o resultado influenciou uma conduta clinica ja tomada, nao ha como provar depois qual foi o valor original registrado.

<details><summary>Justificativa da verificacao adversarial</summary>

Conferido em backend/app/api/v1/endpoints/atendimento.py: `_sync_exames` (def em L1742) para um exame existente (`payload.id in existentes`, L1764-1765) sobrescreve diretamente `exame.prioridade` (L1807), `exame.status` (L1808-1812), `exame.resultado` (L1813), `exame.valor_referencia` (L1814), `exame.unidade` (L1815) e `exame.observacoes` (L1816-1820) sem capturar `previous_values` nem persistir nenhum registro de mudança - ao contrário de `_sync_prescricao` (L1837), que em L1872-1884 monta `previous_values` antes de sobrescrever o item e, em L1905-1915, chama `_registrar_ajuste_prescricao` para cada campo alterado, gravando em `PrescricaoItemAjuste` (import em L62, uso em L203-226).

Verifiquei o model `Exame` em backend/app/models/laudo.py (L45-85): não há nenhuma tabela/coluna de histórico associada (nada como `ExameAjuste`/`HistoricoExame`), apenas colunas de auditoria de criação (`criado_por_id`, `criado_por_nome`, `created_at`) - nenhum rastro de quem alterou o resultado nem quando. Busquei em todo o arquivo por qualquer estrutura equivalente (`grep -rn "ExameAjuste\|ExameHistorico\|exame_ajuste\|HistoricoExame"`) e não encontrei nenhuma.

Também inspecionei o handler PUT `/atendimentos/{atendimento_id}` (L2995) e os pontos onde `registrar_auditoria` é chamado dentro dele (L3227 desvínculo de agendamento, L3280/L3303 finalização) - nenhum desses cobre alteração de campos de exame; são eventos de fluxo de agenda/finalização, não diffs de dados clínicos do exame. `_sync_exames` é chamado em L2973 e L3185 sem qualquer chamada a `registrar_auditoria` para os campos de resultado.

Isso não corresponde a nenhum item da lista de "já corrigidos" fornecida (que trata de exclusão de exame, revogação de liberação no portal, desvínculo de agendamento, cálculo mg/kg da prescrição, etc.) - é uma lacuna distinta e ainda presente: a única entidade com histórico de ajuste financeiro/estrutural é a prescrição, exame não tem equivalente algum.

</details>

---

## 11. [ALTA] DELETE /atendimentos/anexos/{anexo_id} apaga arquivo e registro definitivamente, sem confirmacao e sem auditoria, contornando o guard de exclusao do exame

**Dimensao:** Auditoria e rastreabilidade  
**Local:** `backend/app/api/v1/endpoints/atendimento.py:4405`

**Descricao:** `excluir_anexo` (linha 4405) busca o anexo e chama `_excluir_anexo_registro` (linha 970-972), que remove o arquivo do storage (`remove_atendimento_attachment_file`) e faz `db.delete(anexo)` direto, sem checar o status do exame-pai (laudo_id, liberado no portal) nem chamar `registrar_auditoria`. O guard que bloqueia excluir um EXAME com laudo/anexos/liberado no portal (`_motivo_bloqueio_exclusao_exame`, linha 1585) so se aplica a exclusao do EXAME, nao a exclusao individual do ANEXO - que e justamente o passo que o proprio guard instrui o usuario a fazer primeiro ("Remova os arquivos antes de excluir o exame"). No frontend, o clique no icone de lixeira chama `excluirAnexo` (frontend/app/atendimento/page.tsx:4633-4645) diretamente, sem nenhum dialogo de confirmacao (AtendimentoDocumentosSection.tsx:460, AtendimentoExamesSection.tsx:744).

**Cenario de falha:** Um exame de ECG esta com status "Liberado" no portal da clinica parceira (anexo PDF ja visivel ao tutor/parceiro). Qualquer usuario clica no icone de excluir daquele anexo especifico; sem qualquer confirm() no frontend e sem nenhuma checagem no backend sobre o exame estar liberado no portal, o arquivo e apagado do storage e a linha e removida do banco instantaneamente. O exame continua com status "Liberado" mas sem o PDF que o sustentava, o link do portal quebra, e nao ha nenhum evento de auditoria para investigar quem apagou o arquivo ou quando.

<details><summary>Justificativa da verificacao adversarial</summary>

Conferido no codigo atual: `excluir_anexo` (backend/app/api/v1/endpoints/atendimento.py:4405-4418) busca o `AnexoAtendimento` so por id e chama diretamente `_excluir_anexo_registro` (linha 970-972), que faz `remove_atendimento_attachment_file(anexo.caminho_arquivo)` e `db.delete(anexo)` sem nenhuma checagem do exame-pai e sem chamar `registrar_auditoria` (a funcao esta importada no arquivo, linha 127, e usada em outros endpoints como 422, 3227, 3280, 3303, 3649, 3666, 4018 — mas nao em `excluir_anexo`). O guard `_motivo_bloqueio_exclusao_exame` (linha 1585-1602), que bloqueia por `exame.laudo_id`, `is_portal_released_status(exame.status)` ou anexos pendentes, so e invocado dentro de `_sync_exames` na exclusao do EXAME (linha 1830), nunca no endpoint `DELETE /anexos/{anexo_id}`. O proprio teste do time confirma isso: `test_remover_anexo_individual_depois_excluir_exame_agora_vazio` (backend/tests/test_atendimento_exame_integridade.py:201-215) documenta explicitamente que "o guard exige remover o anexo primeiro (endpoint dedicado DELETE /anexos/{id})" como o "fluxo real de dois passos" para contornar o bloqueio de exclusao do exame — ou seja, o proprio time reconhece (em comentario de teste) que esse endpoint e a porta de saida do guard, sem trata-la como falha a ser fechada.\n\nConfirmei tambem o impacto real no portal: `AnexoAtendimento` e exatamente o modelo servido ao parceiro/tutor externo (backend/app/api/v1/endpoints/portal.py:1391-1399, `baixar_arquivo_anexo_portal`, consulta o mesmo `AnexoAtendimento` por id e retorna 404 'Anexo nao encontrado' se a linha nao existir) — nao ha nenhuma checagem de `is_portal_released_status` ali tambem. Ou seja, apagar o anexo por esse endpoint quebra silenciosamente o link ja liberado ao parceiro, sem qualquer registro de quem/quando.\n\nNo frontend, os dois pontos que chamam `excluirAnexo` (frontend/app/atendimento/components/AtendimentoDocumentosSection.tsx:460 e AtendimentoExamesSection.tsx:744) chamam a funcao direto no onClick; `excluirAnexo` (frontend/app/atendimento/page.tsx:4633-4645) so faz `api.delete` sem qualquer `window.confirm`/`confirm(...)` — diferente de outras exclusoes no mesmo arquivo que usam confirm (linhas 3598, 4211, 4815). Nao ha middleware global de auditoria capturando DELETEs (nenhum middleware de audit em backend/app/main.py). Esse achado e distinto dos itens ja corrigidos da lista ("Exclusao de exame sem confirmacao... guard...") porque aquele item trata da exclusao do EXAME inteiro (ja com guard e confirmacao), enquanto este trata da exclusao do ANEXO individual, que e um endpoint separado e continua sem guard, sem auditoria e sem confirmacao no frontend.

</details>

---

## 12. [ALTA] Alertas clinicos do paciente (ex.: alergia a medicamento) podem ser criados, editados e desativados sem nenhuma auditoria

**Dimensao:** Auditoria e rastreabilidade  
**Local:** `backend/app/api/v1/endpoints/atendimento.py:4485`

**Descricao:** `criar_alerta` (4452-4482), `atualizar_alerta` (4485-4511) e `desativar_alerta` (4514-4527) manipulam `AlertaClinico` (incluindo campo `gravidade`) sem nenhuma chamada a `registrar_auditoria` em nenhum dos tres. A desativacao e um soft-delete (`alerta.ativo = 0`, linha 4525) que remove o item da listagem usada pelo prontuario (`listar_alertas_paciente` filtra `AlertaClinico.ativo == 1`, linha 4431) sem deixar rastro de quem desativou o alerta nem por que.

**Cenario de falha:** Um alerta "Alergia a penicilina - gravidade alta" cadastrado para um paciente e editado por outro usuario para gravidade="baixa", ou desativado (ativo=0) por engano ou de forma intencional. Na proxima consulta o veterinario nao ve mais o alerta (ou ve com gravidade reduzida) na listagem do paciente e pode prescrever o medicamento contraindicado. Depois do incidente, nao ha nenhum evento de auditoria mostrando que o alerta existia, foi alterado/desativado, quando, ou por quem.

<details><summary>Justificativa da verificacao adversarial</summary>

Conferi o codigo atual em backend/app/api/v1/endpoints/atendimento.py:
- criar_alerta (4453-4482): cria AlertaClinico (com `gravidade`, linha 4469) e faz apenas `db.add`/`db.commit`/`db.refresh` (4471-4473); nenhuma chamada a `registrar_auditoria`.
- atualizar_alerta (4486-4511): sobrescreve tipo/titulo/descricao/gravidade (4497-4500) e da `db.commit()` (4501) sem qualquer chamada a `registrar_auditoria` e sem guardar o valor anterior (nao ha snapshot do estado pre-update em nenhum lugar do handler).
- desativar_alerta (4515-4527): faz soft-delete via `alerta.ativo = 0` (4525) e `db.commit()` (4526), tambem sem `registrar_auditoria`.
- listar_alertas_paciente (4423-4434) filtra `AlertaClinico.ativo == 1` (linha 4431); ha um segundo ponto de leitura identico em 4766-4767, tambem filtrando `ativo == 1` — confirma que a desativacao remove o alerta de toda superficie de leitura usada no prontuario.
- O modelo `AlertaClinico` (backend/app/models/atendimento_clinico.py:169-183) so tem `created_at`/`updated_at`, sem `created_by`/`updated_by`/`deleted_by` e sem listener de evento SQLAlchemy que gere trilha automatica.
- `grep -rn "AlertaClinico"` em todo o backend mostra que o unico uso do modelo fora de testes esta em atendimento.py (linhas citadas) e pacientes.py:627-635 (outra leitura filtrando `ativo == 1`); nenhum desses pontos chama `registrar_auditoria`.
- Confirmei que o padrao de auditoria existe e e trivial de usar: `registrar_auditoria` (backend/app/services/auditoria_service.py:35-65) e uma funcao best-effort, com sessao propria, chamada em outros pontos sensiveis do mesmo arquivo (ex.: exclusao de atendimento em ~3649 e ~3666, conclusao com pendencias em 422) — ou seja, ha um padrao estabelecido no proprio arquivo que os tres handlers de alerta simplesmente nao seguem.
- Nao ha nenhum teste cobrindo auditoria de alertas (`grep -rln alerta backend/tests` so retorna dois arquivos que usam AlertaClinico como fixture para outros recursos, sem testar auditoria).
- Esse achado nao corresponde a nenhum item da lista de "ja corrigidos": aqueles tratam de exames, liberacao no portal, desvinculo de agendamento, autosave/localStorage, calculo mg/kg, cadastro complementar, consulta_concluida, DELETE de atendimento, filtro de data, indexacao de exames por posicao, heranca de prescricao, CSS de botoes e filtro de documentacao incompleta — nenhum menciona AlertaClinico.
O cenario de risco clinico do auditor e plausivel e concreto: um alerta de alergia critica pode ser rebaixado de gravidade ou desativado sem nenhum registro de quem/quando/por que, e a proxima consulta simplesmente nao vera mais o alerta (linha 4431 e 4767 filtram ativo==1), sem qualquer trilha para investigacao pos-incidente.

</details>

---

## 13. [ALTA] Rotas cruas PUT/DELETE /exames/{id} em laudos.py contornam todos os guards de exclusao do Atendimento

**Dimensao:** Consistencia entre Atendimento/Agendamento/OrdemServico/Exame/Laudo/Portal  
**Local:** `backend/app/api/v1/endpoints/laudos.py:3234`

**Descricao:** laudos.py expõe rotas CRUD genéricas sobre o mesmo modelo Exame usado pelo Atendimento: GET/PUT/DELETE /exames/{exame_id} (linhas 3200-3248). O DELETE (3234-3248) apaga o Exame com um simples db.delete(exame)/commit, sem nenhuma das checagens de _motivo_bloqueio_exclusao_exame (atendimento.py:1585-1602) - não verifica laudo_id vinculado, não verifica status 'Liberado no portal', não verifica anexos, não chama registrar_auditoria e não limpa os AnexoAtendimento/arquivos físicos (diferente de _excluir_anexos_por_exame usado pelo fluxo do Atendimento). O PUT (3213-3231) faz setattr(exame, field, value) para qualquer campo do payload dict, incluindo atendimento_id, laudo_id e status, sem qualquer validação cruzada.

**Cenario de falha:** O usuário abre a tela de Laudos (frontend/app/laudos/page.tsx:426-436, função deletarExame, que chama api.delete(`/exames/${exameId}`)) e exclui um exame que pertence a um Atendimento em andamento, tem laudo_id preenchido e já está 'Liberado no portal' para a clínica parceira. A exclusão passa direto porque atinge a rota de laudos.py, não a de atendimento.py: o exame some sem confirmação, sem auditoria, deixando anexos órfãos (exame_id inexistente) e revogando de fato o acesso do tutor no portal sem nenhum registro formal de revogação - exatamente os três guards que já foram corrigidos no fluxo do Atendimento continuam ausentes nesta rota paralela.

<details><summary>Justificativa da verificacao adversarial</summary>

Conferi o codigo atual e o achado procede exatamente como descrito. Em backend/app/api/v1/endpoints/laudos.py:3200-3248 existem tres rotas CRUD genericas sobre Exame: GET /exames/{exame_id} (3200-3210), PUT /exames/{exame_id} (3213-3231, que faz setattr(exame, field, value) para qualquer campo do dict recebido, sem nenhuma validacao cruzada de atendimento_id/laudo_id/status) e DELETE /exames/{exame_id} (3234-3248), cujo corpo e apenas `exame = db.query(Exame)...; db.delete(exame); db.commit()` - sem chamar _motivo_bloqueio_exclusao_exame, sem checar laudo_id, sem checar status liberado no portal, sem chamar _excluir_anexos_por_exame e sem registrar_auditoria.

Comparando com o fluxo do Atendimento: o guard _motivo_bloqueio_exclusao_exame existe em backend/app/api/v1/endpoints/atendimento.py:1585-1602 (recusa exclusao se exame.laudo_id estiver preenchido, se is_portal_released_status(exame.status) for verdadeiro, ou se houver anexos) e e efetivamente usado dentro do loop de sincronizacao de exames em atendimento.py:1825-1834, que tambem chama _excluir_anexos_por_exame(db, exame.id) antes do db.delete(exame). Porem esse guard vive somente dentro do fluxo de "salvar atendimento" (_sync_exames), e e um caminho de codigo totalmente distinto e paralelo da rota crua DELETE /exames/{id} em laudos.py - o guard nao e chamado por essa rota, que continua exposta e ativa.

Confirmei tambem que o router de laudos.py e montado com prefix="/api/v1" (backend/app/main.py:414: `app.include_router(laudos.router, prefix="/api/v1", tags=["laudos"])`), portanto a rota fica em /api/v1/exames/{exame_id}, e o frontend chama exatamente essa rota: frontend/app/laudos/page.tsx:426-436 (funcao deletarExame) faz `await api.delete(`/exames/${exameId}`)` apos um `confirm()` simples do browser - sem nenhuma verificacao de negocio equivalente ao guard do atendimento. O confirm() de UI nao substitui o guard de backend (não bloqueia laudo_id/anexos/portal, nao e auditado).

Adicionalmente, encontrei um agravante que o proprio auditor nao citou: existe a tabela PortalPartnerReleaseTarget (backend/app/models/portal_partner.py:29-46) com `exame_id = Column(Integer, nullable=False, index=True)` sem FK/cascade - ou seja, alem dos AnexoAtendimento orfaos, os registros de liberacao ao parceiro do portal tambem ficam orfaos e a liberacao e revogada de fato sem nenhum registro formal (revoked_at nunca e setado), corroborando o cenario de falha alegado.

Esse item nao consta na lista de "ja corrigido" - o item da lista ("Exclusao de exame sem confirmacao explicita, guard contra exame com laudo_id/anexos/liberado no portal") refere-se ao guard ja adicionado dentro do fluxo de save do atendimento.py, nao a esta rota crua e independente em laudos.py, que permanece sem qualquer um dos tres guards.

</details>

---

## 14. [ALTA] Excluir um Laudo não revoga a liberação do Exame no Portal - status e anexo publicado ficam órfãos

**Dimensao:** Consistencia entre Atendimento/Agendamento/OrdemServico/Exame/Laudo/Portal  
**Local:** `backend/app/api/v1/endpoints/laudos.py:2513`

**Descricao:** deletar_laudo (DELETE /laudos/{laudo_id}, linhas 2513-2535) remove apenas o Laudo e suas ImagemLaudo, mas nunca toca no Exame criado/atualizado por _sincronizar_exame_liberado_para_portal (laudos.py:165-207) quando esse laudo foi liberado no portal - esse Exame permanece com status='Liberado no portal' e laudo_id apontando para um registro inexistente. Não existe nenhuma rota /laudos/{id}/portal/revogar no backend (só /portal/liberar e /portal/liberar-clinica), e como esse Exame normalmente não tem atendimento_id (foi criado desacoplado, só para a liberação no portal), ele também não aparece na tela de Atendimento para ser revogado via /exames/{id}/portal/revogar. _is_exam_released_to_portal (portal.py:400-407) confia direto em exam.status, sem checar se o Laudo referenciado ainda existe.

**Cenario de falha:** Um laudo é liberado no portal para a clínica parceira (cria Exame com status 'Liberado no portal' + anexo PDF publicado). Dias depois o veterinário identifica um erro grave no conteúdo e exclui o laudo pela tela de Laudos (frontend/app/laudos/page.tsx:411-424) esperando remover o acesso externo. O laudo some do sistema interno, mas o Exame associado continua 'Liberado no portal' e o anexo PDF publicado permanece intacto: a clínica parceira/tutor continua enxergando e baixando o resultado incorreto no portal indefinidamente, sem nenhuma ação de UI disponível para revogar isso.

<details><summary>Justificativa da verificacao adversarial</summary>

Achado confirmado por leitura direta do codigo atual, sem qualquer guard residual:

1. backend/app/api/v1/endpoints/laudos.py:2513-2535 (`deletar_laudo`) so consulta `Laudo` e `ImagemLaudo`, deleta ambos e da commit. Nao ha nenhuma consulta a `Exame`, nenhuma verificacao de `laudo.status == PORTAL_RELEASED_STATUS`, nenhuma chamada a rotina de revogacao e nenhum toque em `AnexoAtendimento`.

2. O vinculo `Exame.laudo_id` (backend/app/models/laudo.py:51) e um `Integer` simples, sem `ForeignKey`/`ondelete`. Confirmei tambem nas migrations (20260222_04_exames_schema_alignment.py:18 e 20260324_19_exames_schema_drift_compat.py:24) que a coluna e criada como `INTEGER` puro, sem constraint. Ou seja, apagar o Laudo nao gera cascade nem erro de integridade: o `Exame` criado por `_sincronizar_exame_liberado_para_portal` (laudos.py:165-207) fica com `laudo_id` apontando para um registro inexistente e `status='Liberado no portal'` intacto.

3. `_is_exam_released_to_portal` (backend/app/api/v1/endpoints/portal.py:400-407) checa `is_portal_released_status(exam.status)` PRIMEIRO e retorna True imediatamente — nunca valida se o Laudo referenciado ainda existe. Como o proprio `Exame.status` (nao apenas o do Laudo) foi setado para 'Liberado no portal' em `_sincronizar_exame_liberado_para_portal`, a checagem passa mesmo com o Laudo apagado.

4. O download do PDF publicado (`baixar_arquivo_anexo_portal`, portal.py:1391-1448) usa exatamente essa funcao via `_assert_portal_exam_access`, e o `AnexoAtendimento` esta vinculado por `exame_id` (nao por `laudo_id` — ver `_persistir_pdf_laudo_para_portal`, laudos.py:343-417), entao o arquivo no disco e o registro do anexo permanecem intocados e baixaveis normalmente.

5. As listagens do portal (`listar_exames_clinica_portal`, `listar_exames_parceiro_portal`, `listar_exames_pet_portal` em portal.py:1095+) fazem `.outerjoin(Laudo, Laudo.id == Exame.laudo_id)` e filtram com `_portal_exam_release_filter()` (portal.py:393-397), que e satisfeito so por `Exame.status` via OR — logo o exame orfao continua aparecendo nessas listas (a listagem de tutor, que nao depende de `Laudo.clinic_id`, e a mais claramente afetada).

6. Nao existe rota `/laudos/{id}/portal/revogar`. A unica rota de revogacao e `POST /api/v1/atendimentos/exames/{exame_id}/portal/revogar` (atendimento.py:4110-4166), que so e chamada pelo frontend dentro da secao de exames de um atendimento especifico (frontend/app/atendimento/components/AtendimentoExamesSection.tsx, populada por `examesVisiveis` do form do atendimento corrente). Como `_resolver_atendimento_id_para_anexo_portal` (laudos.py:210-232) so associa `atendimento_id` quando consegue casar por `agendamento_id`, um exame criado apenas para liberacao direta de laudo tipicamente fica com `atendimento_id` nulo/0 e nunca aparece nessa tela — nao ha nenhuma tela de "Exames" global que liste por `exame_id` isolado.

7. Confirmei tambem que o frontend `deletarLaudo` (frontend/app/laudos/page.tsx:411-421) so faz `confirm()` generico e `DELETE /laudos/{id}`, sem qualquer chamada previa de revogacao.

8. Este achado e distinto dos itens ja corrigidos na lista fornecida (que tratam de exclusao de Exame via tela de atendimento, com guard proprio, e nao de exclusao de Laudo via tela de Laudos) — nenhum desses guards aparece em `deletar_laudo`.

Cadeia completa de causa raiz -> impacto verificada em codigo real, sem mitigacao encontrada.

</details>

---

## 15. [ALTA] Reversão de OS na exclusão do atendimento concluído cancela a OS sem desfazer o recebimento financeiro já registrado

**Dimensao:** Consistencia entre Atendimento/Agendamento/OrdemServico/Exame/Laudo/Portal  
**Local:** `backend/app/api/v1/endpoints/atendimento.py:3619`

**Descricao:** O guard de exclusão de atendimento concluído (já implementado, com confirmação e auditoria) localiza a OS ativa via _buscar_os_ativa - que considera 'ativa' qualquer OS com status != 'Cancelado', incluindo status 'Pago' - e força ordem_servico_ativa.status = 'Cancelado' diretamente (atendimento.py:3619-3622). Isso ignora o fluxo dedicado desfazer_recebimento_ordem (PATCH /ordens-servico/{id}/desfazer-recebimento, ordens_servico.py:2041-2139), que é o único lugar do sistema que cancela as Transacao vinculadas ao recebimento (status='Cancelado', data_pagamento=None) e cancela os CreditoFinanceiro gerados/consumidos naquele pagamento.

**Cenario de falha:** Atendimento é finalizado e a OS é gerada; a recepção recebe o pagamento via PATCH /ordens-servico/{id}/receber, que marca a OS como 'Pago' e cria uma Transacao de entrada com status 'Recebido'/'Pago' (podendo também consumir crédito do cliente). Em seguida alguém exclui o Atendimento (ex.: paciente errado) confirmando a exclusão. A OS vira 'Cancelado' silenciosamente, mas a Transacao já criada permanece com status 'Pago'/'Recebido' e nenhum CreditoFinanceiro consumido é restituído. Os relatórios do Financeiro (que somam Transacao.status in ('Recebido','Pago')) continuam contabilizando a receita normalmente, enquanto o módulo de Ordens de Serviço mostra a OS cancelada - os dois painéis divergem de forma permanente sobre se o valor foi efetivamente recebido, e nenhum estorno de crédito ocorre.

<details><summary>Justificativa da verificacao adversarial</summary>

Verifiquei o codigo atual e o achado procede integralmente.

1. `_buscar_os_ativa` (atendimento.py:488-497) filtra apenas `OrdemServico.status != "Cancelado"` (ou None), portanto retorna a OS mesmo quando ela esta com status "Pago".

2. Em `excluir_atendimento` (atendimento.py:3579-3622), o bloco de reversao (linhas 3611-3622) apenas: (a) volta o agendamento para "Confirmado"; (b) chama `_buscar_os_ativa` e forca `ordem_servico_ativa.status = "Cancelado"` diretamente (linha 3621), sem nenhuma checagem do status anterior da OS e sem tocar em `Transacao`/`CreditoFinanceiro`. Confirmei com `grep` que o arquivo `atendimento.py` nao contem nenhuma referencia a `Transacao` ou `CreditoFinanceiro` em todo o arquivo.

3. O fluxo dedicado `desfazer_recebimento_ordem` (ordens_servico.py:2041-2139) e de fato o unico lugar que: cancela as `Transacao` vinculadas ao recebimento (status="Cancelado", data_pagamento=None, linhas 2084-2089) e cancela os `CreditoFinanceiro` de origem "excedente_pagamento_os"/"consumo_credito_os" (linhas 2100-2113). O endpoint de exclusao de atendimento nao chama essa funcao nem replica sua logica.

4. Confirmei tambem que `receber_ordem` (ordens_servico.py:1643 em diante) de fato marca a OS como "Pago" e cria `Transacao` tipo "entrada" com status "Recebido"/"Pago" (linhas 1758, 1815+), e que os relatorios financeiros somam por `Transacao.status.in_(["Recebido", "Pago"])` (financeiro.py:1773), corroborando o cenario de divergencia permanente descrito pelo auditor.

5. O teste existente para esse guard (`test_atendimento_delete_guard.py`, metodo `_seed_vinculado` linha 87-127) semeia a OS com `status="Pendente"`, nunca "Pago" - ou seja, o cenario de recebimento ja registrado nunca e exercitado pelos testes atuais, reforcando que a lacuna nao foi endereçada em pacotes anteriores.

Este achado nao consta na lista de itens ja corrigidos (que trata de guard de confirmacao de exclusao, ausencia de reversao de agendamento/OS de forma generica, etc. - todos ja resolvidos), mas e um problema diferente e mais especifico: a reversao existe, porem e feita de forma incompleta/incorreta quando a OS ja tinha recebimento financeiro.

</details>

---

## 16. [ALTA] carregarBase: Promise.all fail-fast bloqueia todo o modulo por falha de um unico endpoint, com toast de erro que se autodestroi em 8s

**Dimensao:** Tratamento de erros e feedback ao usuario  
**Local:** `frontend/app/atendimento/page.tsx:1984`

**Descricao:** `carregarBase` (linhas 1981-2003) carrega 5 recursos independentes (pacientes, clinicas, banco de medicamentos, catalogo de exames, frases clinicas) com `Promise.all`. Se qualquer um dos 5 rejeitar, nenhum dos `setPacientes/setClinicas/setMedicamentos/setCatalogoExames/setClinicalPhrases` roda -- mesmo que os outros 4 requests tenham respondido com sucesso -- e o usuario ve apenas o toast generico 'Erro ao carregar dados de atendimento.' (linha 1999). Esse toast de erro se autodestroi sozinho apos 8 segundos (useEffect das linhas 1533-1561, `setTimeout(..., 8000)`), sem nenhum botao de 'tentar novamente' visivel na tela apos o `loading` voltar a false (linha 6050-6052 so cobre o estado de loading, nao o de erro pos-carregamento).

**Cenario de falha:** O endpoint `/atendimentos/frases-clinicas` tem uma instabilidade transitoria (timeout, 500) enquanto pacientes/clinicas/medicamentos/catalogo respondem normalmente. O `Promise.all` rejeita inteiro, a tela de atendimento carrega vazia (sem lista de pacientes, sem clinicas, sem banco de medicamentos, sem catalogo de exames), o vet ve um toast vermelho por 8 segundos que some sozinho, e depois disso a tela fica permanentemente vazia e sem qualquer indicacao visual de erro -- a unica saida e recarregar a pagina inteira (F5), mesmo que 4 dos 5 recursos estivessem disponiveis.

<details><summary>Justificativa da verificacao adversarial</summary>

Conferi o código atual e o achado procede exatamente como descrito.

1) frontend/app/atendimento/page.tsx:1984-1999 — `carregarBase` dispara os 5 GETs (`/pacientes`, `/clinicas`, `/atendimentos/medicamentos/banco`, `/atendimentos/exames/catalogo`, `/atendimentos/frases-clinicas`) dentro de um único `Promise.all`. Se qualquer uma rejeitar, o `catch` (linha 1998-1999) é o único caminho executado e nenhum dos `setPacientes/setClinicas/setMedicamentos/setCatalogoExames/setPaineisExames/setClinicalPhrases` (linhas 1991-1996) roda, mesmo que as outras 4 respostas tenham chegado com sucesso — não há `Promise.allSettled` nem tratamento por-request.

2) frontend/app/atendimento/page.tsx:1875-1882 — `carregarBase()` só é chamado uma vez, no mount (`useEffect(..., [router])`), sem nenhum retry automático ou manual em outro ponto do arquivo (busquei por "tentar novamente"/"recarregar"/"reload" e só aparecem em `recarregarDocumentosAtendimento`, que é outra função, não relacionada a essa carga inicial).

3) frontend/app/atendimento/page.tsx:1533-1561 e 6032-6039 — o erro só é exibido como um toast (`erroPopup`) que se autodestrói via `window.setTimeout(..., 8000)` (linha 1556-1560), e esse mesmo timeout chama `setErro("")`, apagando também o estado de erro subjacente. Não existe nenhum banner persistente vinculado a `erro`/`erroPopup` fora desse toast fixo (grep confirma que `erroPopup` só aparece nas linhas 1348, 6032-6039 e 6058-6071).

4) frontend/app/atendimento/page.tsx:6050-6052 — o único gate condicional de render é `if (loading) return <...Carregando...>`; assim que `finally { setLoading(false) }` roda (independente de sucesso ou falha), o restante da página (listagem de pacientes, filtros, formulário) é renderizado normalmente, com os arrays vazios (`[]==pacientes/clinicas/medicamentos/catalogoExames`) — não há um estado de erro dedicado pós-loading, exatamente como o auditor descreveu.

O cenário de falha (frases-clinicas com 500/timeout enquanto os outros 4 endpoints respondem) é plausível e não fica coberto por nenhum guard: o `Promise.all` faz a tela inteira falhar por causa de um recurso secundário (frases clínicas para autocomplete), derrubando junto pacientes/clínicas/medicamentos/catálogo de exames, que são essenciais para operar o atendimento. Isso não está na lista de itens já corrigidos nesta auditoria (que trata de exclusão de exame, revogação de liberação no portal, autosave/beforeunload, cálculo mg/kg, DELETE sem guard, filtro de datas, etc. — nada sobre carregamento inicial fail-fast).

</details>

---

## 17. [MEDIA] _sync_exames sobrescreve laudo_id do exame sem a mesma protecao de staleness aplicada ao status

**Dimensao:** Integridade de dados clinicos  
**Local:** `backend/app/api/v1/endpoints/atendimento.py:1822`

**Descricao:** Em `_sync_exames` (linha 1822), `exame.laudo_id = payload.laudo_id` e aplicado incondicionalmente a cada save do atendimento, usando o valor que o frontend enviou. Diferente de `status`, que e derivado no servidor via `_derivar_status_exame` (linhas 1576-1582) justamente para 'nao revogar liberacao no portal a cada save' (comentario do proprio schema em `ExameSolicitacaoPayload`, linha 10-13), `laudo_id` nao tem essa mesma protecao. `Exame.laudo_id` e escrito de forma independente por `laudos.py` (ex.: linha 193, `_sincronizar_exame_liberado_para_portal`) quando um laudo e vinculado/liberado para portal a partir do modulo de Laudos - um fluxo que roda fora do formulario de atendimento. Se a pagina de atendimento estiver aberta (ex.: em outra aba) com uma copia em memoria desse exame anterior a vinculacao (laudo_id nulo), qualquer save subsequente do atendimento (autosave incluso) reenvia `laudo_id: item.laudo_id || null` = null para esse exame, apagando o vinculo no banco - mesmo que o `status` do exame permaneca 'Liberado_portal' (esse sim preservado), gerando um registro inconsistente: exame marcado como liberado no portal mas sem laudo_id associado.

**Cenario de falha:** Vet abre o Atendimento #500 (exame 'Ecocardiograma' ainda sem laudo, laudo_id=null) e deixa a aba aberta enquanto digita observacoes gerais periodicamente (mantendo o autosave ativo). Em outra aba/sessao, um laudo e liberado no portal para esse mesmo exame, setando `Exame.laudo_id = laudo.id`. Na aba do atendimento, sem que a pagina seja recarregada, o proximo ciclo de autosave (a cada mudanca de campo, debounce de 1.8s) reenvia o payload de exames com `laudo_id: null` para esse item (porque o estado em memoria nunca foi atualizado), e o backend regrava `exame.laudo_id = None` - desvinculando silenciosamente o laudo ja liberado do exame, enquanto o status 'Liberado_portal' permanece, deixando o exame em estado inconsistente sem o vet perceber.

<details><summary>Justificativa da verificacao adversarial</summary>

Achado real e nao consta na lista de itens ja corrigidos (que trata apenas da revogacao de `status`, nao de `laudo_id`).

Confirmado no codigo atual:
- backend/app/api/v1/endpoints/atendimento.py:1822 — em `_sync_exames`, `exame.laudo_id = payload.laudo_id` e aplicado incondicionalmente a cada item do payload, sem nenhum guard de staleness.
- Contraste com `status`: atendimento.py:1808-1812 deriva `exame.status` via `_derivar_status_exame` (que em atendimento.py:1576-1577 preserva o status quando `is_portal_released_status(status_atual)` e verdadeiro), exatamente como documentado em backend/app/schemas/atendimento.py:10-13 ("status ... e ignorado pelo backend ... para nao revogar liberacao no portal a cada save"). Nao existe equivalente para `laudo_id` — o campo e sobrescrito bruto.
- Escrita independente confirmada: backend/app/api/v1/endpoints/laudos.py:165-207 (`_sincronizar_exame_liberado_para_portal`), linha 193, seta `exame.laudo_id = laudo.id` a partir do fluxo de liberacao de laudo no portal — endpoint totalmente separado do formulario de atendimento.
- Frontend confirma o vetor de disparo: frontend/app/atendimento/page.tsx:1228 envia `laudo_id: item.laudo_id || null` a partir do estado em memoria em todo save (manual ou autosave); linha 1109 confirma debounce de autosave de 1800ms (AUTOSAVE_DELAY_MS), batendo com o cenario do auditor. Nao ha nenhum polling/refetch periodico no arquivo (busquei setInterval/refetch/SWR/EventSource/WebSocket, nenhum resultado) que atualizaria o `laudo_id` em memoria enquanto a aba fica aberta.
- Verifiquei se `mergeAutoSavedFormState` (page.tsx:1310-1327, com `laudo_id: currentItem.laudo_id ?? persistedItem.laudo_id ?? null` na linha 1320) protegeria o caso — nao protege: `hydrated` nesse merge e a resposta do PROPRIO save que acabou de rodar `_sync_exames` e ja gravou `laudo_id=null` no banco na mesma transacao; entao `persistedItem.laudo_id` chega igualmente nulo. Esse merge resolve apenas corridas entre digitacao do usuario e o round-trip do proprio autosave, nao uma mudanca externa feita por outra sessao/aba.
- Impacto real confirmado: backend/app/api/v1/endpoints/portal.py usa `Exame.laudo_id` como chave de join/lookup para exibir o laudo liberado no portal do parceiro (varios pontos, ex.: portal.py:373-374, 403-404, 434, 1182, 1278, 1334). Zerar `laudo_id` enquanto `status` permanece 'Liberado_portal' quebra a exibicao do laudo no portal externo sem erro visivel para o vet.
- Efeito amplificador (nao citado pelo auditor, mas relevante para severidade): laudos.py:420-425 (`_sincronizar_publicacao_laudo_no_portal`) localiza o exame via `Exame.laudo_id == laudo.id`; se esse campo for zerado pela corrida, uma futura republicacao/edicao do mesmo laudo deixaria de encontrar o exame original e criaria um novo `Exame` orfao (laudos.py:179-191), duplicando o registro.

</details>

---

## 18. [MEDIA] Save manual sobrescreve o formulario inteiro com a resposta do servidor, descartando edicoes feitas durante o round-trip (sem o merge que o autosave usa)

**Dimensao:** Race conditions e gerenciamento de estado (frontend)  
**Local:** `frontend/app/atendimento/page.tsx:4010`

**Descricao:** No branch `mode === "manual"` de `saveAtendimento` (linhas 4006-4023), apos o `await api.put/post`, o codigo faz `hydratingFormRef.current = true; setForm(hydrated);` - uma substituicao total e incondicional do formulario pelo snapshot devolvido pelo servidor (que reflete o payload enviado ANTES do await, nao o estado atual). Isso contrasta com o branch de autosave logo abaixo (linhas 4028-4037), que usa `mergeAutoSavedFormState(current, hydrated)` dentro de um `setForm(current => ...)` funcional, justamente para preservar edicoes feitas pelo usuario durante a espera da rede. Nenhum dos campos de texto do formulario fica desabilitado durante `salvando` (so botoes especificos ficam, ex.: linhas 6137, 6152, 6163), entao o usuario pode continuar digitando livremente enquanto o PUT/POST manual esta em voo.

**Cenario de falha:** Usuario clica em 'Salvar atendimento' (ou aciona um fluxo que chama `saveAtendimento("manual")` internamente, como `baixarPdfAtendimento` linha 5243 ou `obterAtendimentoIdParaDocumento` linha 4676) e, enquanto a requisicao esta em voo (rede lenta, alguns segundos), continua digitando em 'exame fisico' ou adiciona um novo item de prescricao. Quando a resposta retorna, `setForm(hydrated)` substitui o formulario inteiro pelo snapshot antigo (sem a nova linha/item), apagando silenciosamente a edicao feita durante o intervalo - sem nenhum aviso, e com `autosaveState` marcado como 'saved' logo em seguida, entao nada sinaliza ao usuario que algo foi perdido.

<details><summary>Justificativa da verificacao adversarial</summary>

Conferi o codigo atual em frontend/app/atendimento/page.tsx. Em saveAtendimento (linha 3950), o branch `if (mode === "manual")` (linhas 4006-4023) captura `currentForm = formRef.current` no inicio da funcao (linha 3953), monta o payload (linha 3995) e, apos o `await api.put/post` (linhas 3998-4002), faz `hydratingFormRef.current = true; setForm(hydrated);` (linhas 4010-4011) - uma substituicao direta e incondicional do estado pelo snapshot devolvido pelo servidor, que reflete apenas o payload enviado ANTES do await. Isso contrasta com o branch `else` (autosave, linhas 4028-4037), que usa `setForm((current) => mergeAutoSavedFormState({...current, exames: ...}, hydrated))` - a forma funcional com `current` como base do merge, preservando exatamente os campos de texto (queixa, anamnese, exame_fisico, dados_clinicos, etc.) que tenham mudado durante o round-trip, ja que `mergeAutoSavedFormState` (linha 1310) faz `{...current, ...}` e so sobrescreve id/exames/prescricao_itens com regras item-a-item, nunca os campos de texto simples.
Verifiquei tambem que nenhum campo de texto e desabilitado durante `salvando`: em page.tsx apenas botoes usam `disabled={salvando || ...}` (linhas 6137, 6152, 6163); o componente que renderiza os textareas de anamnese/exame_fisico/diagnostico/plano, frontend/app/atendimento/components/AtendimentoConsultaEditorSection.tsx, nem recebe a prop `salvando` (confirmado via grep - so ha disableds de paginacao de etapa, linhas 219 e 231); e AtendimentoExamesSection.tsx / AtendimentoPrescricaoAside.tsx so usam `salvando` para desabilitar botoes de acao (PDF, salvar), nao os inputs dos itens. Logo, o usuario pode digitar ou adicionar item de prescricao livremente enquanto o PUT/POST manual esta em voo, e o retorno da resposta apaga essa edicao silenciosamente via `setForm(hydrated)`, com `autosaveState` virando "saved" logo em seguida (linha 4014), sem sinalizar perda.
Confirmei ainda os dois pontos de entrada citados pelo auditor que tambem disparam esse mesmo `saveAtendimento("manual")` fora do clique direto no botao: `obterAtendimentoIdParaDocumento` (linhas 4672-4679, chama na linha 4676) e o fluxo de PDF em torno da linha 5243 - ambos passam pelo mesmo branch problematico.
Este achado NAO consta na lista de itens ja corrigidos em pacotes anteriores (que fala de merge de calculo mg/kg, exclusao de exame, revogacao de liberacao no portal, etc. - nada sobre a assimetria manual-vs-autosave no proprio merge do formulario). E um bug real e distinto, nao corrigido.

</details>

---

## 19. [MEDIA] Guard de reentrancia de 'salvar documento clinico' e setado depois do primeiro await, permitindo criacao duplicada em duplo clique

**Dimensao:** Race conditions e gerenciamento de estado (frontend)  
**Local:** `frontend/app/atendimento/page.tsx:4731`

**Descricao:** `salvarDocumentoClinico` (linhas 4723-4761) e `criarDocumentoClinicoDeTemplate` (linhas 4693-4721) chamam `await obterAtendimentoIdParaDocumento()` (linha 4731 / linha 4699) ANTES de setar `setSalvandoDocumentoClinico(true)` (linha 4735 / linha 4703). Os botoes que disparam essas funcoes (`frontend/app/atendimento/components/AtendimentoDocumentosSection.tsx`, linhas 147-151 e 227-231) so ficam `disabled` quando `salvandoDocumentoClinico` e true - ou seja, ficam habilitados durante toda a janela do primeiro `await`, que pode incluir um `saveAtendimento("manual")` completo disparado por `obterAtendimentoIdParaDocumento` (linhas 4672-4679) quando o snapshot esta desatualizado. Nao existe nenhum ref/flag sincrono setado no topo da funcao para bloquear uma segunda invocacao antes desse ponto.

**Cenario de falha:** Usuario preenche titulo/corpo de um documento clinico novo (sem `documentoClinicoForm.id`) e clica duas vezes seguidas em 'Salvar' (ou clica, a rede demora, e ele clica de novo achando que nao registrou o clique). Como `salvandoDocumentoClinico` ainda e `false` durante o `await obterAtendimentoIdParaDocumento()` da primeira chamada, a segunda chamada tambem passa pelo guard do botao e executa seu proprio `await obterAtendimentoIdParaDocumento()` em paralelo; como `documentoClinicoForm.id` e falsy nas duas execucoes, ambas caem no ramo `api.post(`/atendimentos/${atendimentoId}/documentos`, payload)` (linha 4744), criando dois documentos clinicos duplicados (e, se o usuario tambem gerar o PDF em seguida, dois PDFs registrados como emitidos) a partir de um unico clique logico do usuario.

<details><summary>Justificativa da verificacao adversarial</summary>

Conferi o codigo atual e o achado procede exatamente como descrito. Em frontend/app/atendimento/page.tsx: `salvarDocumentoClinico` (linhas 4723-4761) faz `const atendimentoId = await obterAtendimentoIdParaDocumento();` na linha 4731 e so chama `setSalvandoDocumentoClinico(true)` na linha 4735, dentro do bloco `try` seguinte; `criarDocumentoClinicoDeTemplate` (linhas 4693-4721) tem o mesmo padrao (`await obterAtendimentoIdParaDocumento()` na linha 4699, `setSalvandoDocumentoClinico(true)` so na linha 4703). `obterAtendimentoIdParaDocumento` (linhas 4672-4679) pode disparar um `await saveAtendimento("manual")` completo (linha 4676) quando o snapshot do form diverge do ultimo persistido ou `autosaveState === "error"` - ou seja, uma chamada de rede real pode ocorrer antes de qualquer flag sincrona ser setada. Nao existe nenhum `useRef` (ex.: `salvandoDocumentoClinicoRef`) ou outra flag sincrona no topo dessas duas funcoes; busquei por padroes de guard (`debounce`, `isSubmittingRef`, `inFlightRef`, refs de documento) em todo o arquivo e o unico mecanismo de idempotencia sincrono existente (`criandoAtendimentoAutomaticoRef`, linhas 3969-3987) protege apenas a criacao automatica do ATENDIMENTO em modo autosave, nao o fluxo de documentos clinicos. Confirmei tambem os botoes em frontend/app/atendimento/components/AtendimentoDocumentosSection.tsx: o botao "Criar" (template) tem `disabled={!documentoTemplateSelecionado || salvandoDocumentoClinico}` e o botao "Salvar documento" tem `disabled={salvandoDocumentoClinico || !documentoClinicoForm.titulo.trim() || !documentoClinicoForm.corpo.trim()}` - ambos dependem exclusivamente do estado React `salvandoDocumentoClinico`, que so vira `true` depois do primeiro `await`. No backend, `POST /{atendimento_id}/documentos` (backend/app/api/v1/endpoints/atendimento.py, linha 2473) nao tem chave de idempotencia, entao duas chamadas concorrentes de fato criam duas linhas de documento distintas. O item nao consta na lista de achados ja corrigidos (que trata apenas da idempotencia de criacao do ATENDIMENTO em autosave, nao dos documentos clinicos). Cenario de duplo clique/clique-apos-rede-lenta e realista, ja que o guard de botao aparenta proteger mas na pratica deixa uma janela aberta sempre que `obterAtendimentoIdParaDocumento` precisa re-salvar o atendimento. Consequencia e duplicacao de registro (documento clinico e potencialmente PDF), exigindo limpeza manual, mas sem perda de dados e com exclusao disponivel na UI - severidade media e proporcional.

</details>

---

## 20. [MEDIA] Guard de liberacao no portal (_anexo_eh_pdf) confia em metadado do cliente em vez de confirmar existencia real do arquivo

**Dimensao:** Seguranca (autorizacao, IDOR, validacao de entrada)  
**Local:** `backend/app/api/v1/endpoints/atendimento.py`

**Descricao:** liberar_exame_no_portal (linha 4035) exige `if not any(_anexo_eh_pdf(anexo) for anexo in anexos)` antes de liberar o exame ao portal. _anexo_eh_pdf (linhas 1605-1608) apenas checa `anexo.mime_type == 'application/pdf'` ou nome/url terminando em `.pdf` -- campos totalmente controlados pelo cliente quando o anexo foi criado via POST /{atendimento_id}/anexos (criar_anexo, origem='externo', sem caminho_arquivo). Ele nao usa attachment_has_download_source/resolve_attachment_download_source (que verificam se ha um arquivo local existente ou uma URL remota valida) para confirmar que existe de fato um resultado baixavel antes de liberar.

**Cenario de falha:** Um usuario cria um anexo falso via POST /{atendimento_id}/anexos com {"tipo":"resultado","url":"http://qualquer-coisa","mime_type":"application/pdf","nome_original":"laudo.pdf","exame_id":X}, sem nunca ter feito upload de um arquivo real. Em seguida chama POST /exames/{X}/portal/liberar: o guard passa (pois mime_type bate com 'application/pdf'), o exame muda de status para liberado e passa a aparecer para o tutor/clinica no portal como resultado disponivel, mesmo sem nenhum arquivo real armazenado. Quando o tutor/clinica tenta baixar esse "resultado", o backend tenta buscar a URL fake (podendo, combinado com o achado de SSRF acima, apontar para um endpoint interno ou vazar o token de storage), ou simplesmente retorna erro para um exame que o sistema ja marcou como oficialmente liberado.

<details><summary>Justificativa da verificacao adversarial</summary>

Codigo atual confirma o achado ponta a ponta.

1) `_anexo_eh_pdf` (backend/app/api/v1/endpoints/atendimento.py:1605-1608) so olha `mime_type` e a extensao de `nome_original/url/caminho_arquivo`:
```
mime = (anexo.mime_type or "").strip().lower()
nome = (anexo.nome_original or anexo.url or anexo.caminho_arquivo or "").strip().lower()
return mime == "application/pdf" or nome.endswith(".pdf")
```
Nenhuma verificacao de que existe conteudo real (arquivo local ou URL de fato baixavel).

2) `liberar_exame_no_portal` usa exclusivamente esse guard antes de liberar (atendimento.py:4062-4063): `if not any(_anexo_eh_pdf(anexo) for anexo in anexos): raise HTTPException(422, ...)`. Passando o guard, o exame e liberado (status = PORTAL_RELEASED_STATUS, data_resultado preenchida) sem checar `attachment_has_download_source`/`resolve_attachment_download_source`.

3) O endpoint `POST /{atendimento_id}/anexos` (`criar_anexo`, atendimento.py:4184-4219) grava `origem="externo"` com `url`, `nome_original` e `mime_type` vindos 100% do payload do cliente e sem `caminho_arquivo`. O schema `AnexoPayload` (backend/app/schemas/atendimento.py:93-100) declara `url: str` sem qualquer validador de formato (nao e `HttpUrl`, nao ha checagem de esquema). Ou seja, e trivial criar um anexo com `mime_type="application/pdf"` e `url="http://qualquer-coisa"` sem nunca ter enviado um arquivo real, e depois chamar `POST /exames/{id}/portal/liberar` com sucesso — reproduzi o fluxo lendo o codigo linha a linha e nao ha nenhum outro guard intermediario.

4) Confirmei que o helper mais robusto existe e e usado em outro lugar: `resolve_attachment_download_source`/`attachment_has_download_source` (backend/app/services/attachment_download_service.py:31-44) checa `os.path.exists(caminho_arquivo)` OU uma URL com esquema http/https bem formada, e e chamado em `portal.py:416` (listagem) e `portal.py:1366` (geracao de download-url) — mas NAO em `liberar_exame_no_portal`. Isso mostra que o padrao correto ja existe no repo mas nao foi aplicado neste guard especifico, reforcando que a omissao e uma lacuna real, nao uma limitacao arquitetural.

5) Os testes existentes (`backend/tests/test_atendimento_portal_exam_release.py:44-141`) so cobrem "sem nenhum anexo" (bloqueado, 422) e "anexo com caminho_arquivo real" (liberado) — nao ha nenhum teste que exercite anexo com metadado falso (mime_type/nome batendo mas sem caminho_arquivo/URL real), confirmando que esse caso nunca foi validado nem corrigido.

Nao consta na lista de itens ja corrigidos em pacotes anteriores (nenhum item trata do guard de liberacao vs. existencia real do anexo).

Ressalva sobre severidade: o `attachment_has_download_source` sugerido pelo auditor tambem aceitaria a URL de exemplo do PoC (`http://qualquer-coisa` tem esquema+netloc validos), entao a troca isolada do guard nao bloqueia 100% o cenario citado — precisaria adicionalmente restringir esquemas/hosts ou exigir `caminho_arquivo` para anexos de origem 'externo'/'upload' tipo 'resultado'. Isso nao invalida o achado (o guard atual e estritamente mais fraco, aceitando qualquer string terminando em '.pdf' mesmo sem URL nenhuma), apenas indica que a correcao completa exige mais que so trocar a funcao de checagem.

</details>

---

## 21. [MEDIA] Documentos clinicos gerados (atestados, receituarios avulsos, declaracoes) podem ser editados ou apagados definitivamente sem nenhuma auditoria

**Dimensao:** Auditoria e rastreabilidade  
**Local:** `backend/app/services/atendimento/document_crud_service.py:61`

**Descricao:** `atualizar_documento_atendimento` (linha 61-89) sobrescreve titulo, corpo e status do documento diretamente nas linhas 68-81 sem guardar a versao anterior nem chamar auditoria. `excluir_documento_atendimento` (linha 93-99) faz `db.delete(documento)` (exclusao definitiva, linha 95) tambem sem qualquer registro. Os endpoints que chamam esses services (`atualizar_documento_atendimento` e `excluir_documento_atendimento` em backend/app/api/v1/endpoints/atendimento.py:2521-2551) tambem nao adicionam auditoria - so repassam para o service e retornam o resultado.

**Cenario de falha:** Um veterinario gera um atestado para o tutor recomendando 10 dias de repouso ao paciente, entrega/imprime o documento, e depois edita o mesmo registro via PUT /atendimentos/7/documentos/15 mudando o corpo para "3 dias de repouso", ou simplesmente exclui o documento com DELETE. Nao ha versionamento nem log de auditoria: se o conteudo original do atestado for contestado depois (por exemplo, em uma disputa sobre a orientacao dada), nao existe como reconstituir o que foi de fato emitido nem quem alterou/apagou o registro.

<details><summary>Justificativa da verificacao adversarial</summary>

Confirmei o codigo atual e o achado procede integralmente.

1) backend/app/services/atendimento/document_crud_service.py:61-90 (`atualizar_documento_atendimento`): sobrescreve `documento.titulo` (linha 74), `documento.corpo` (linha 79) e `documento.status` (linha 84) diretamente no registro existente, sem salvar em nenhuma tabela de historico/versao e sem chamar qualquer rotina de auditoria antes do `db.commit()` (linha 88). O modelo `DocumentoAtendimento` (backend/app/models/atendimento_clinico.py:111-125) so tem `created_at`/`updated_at`, sem campos de versionamento (ex.: `versao`, `conteudo_anterior`, `editado_por_id`).

2) backend/app/services/atendimento/document_crud_service.py:93-100 (`excluir_documento_atendimento`): faz `db.delete(documento)` (linha 95) - exclusao fisica definitiva - e tambem sem qualquer log.

3) Os endpoints em backend/app/api/v1/endpoints/atendimento.py:2519-2551 apenas repassam para o service e retornam. Pior: em ambos os handlers (`PUT` e `DELETE` de documentos) ha `_ = current_user` logo apos a assinatura (descartando explicitamente a identidade do usuario autenticado), entao nem sequer haveria como reconstituir "quem" fez a alteracao mesmo que quisessem depois.

4) Verifiquei que o codebase JA POSSUI um mecanismo de auditoria generico e maduro (`app/services/auditoria_service.registrar_auditoria`, gravando em `AuditoriaEvento`) usado extensivamente no mesmo arquivo `atendimento.py` para acoes de sensibilidade comparavel: DESVINCULAR_AGENDAMENTO (linha ~3227), ATENDIMENTO_EXCLUIDO (linha ~3649, no DELETE de atendimento completo - correspondente a um item ja corrigido na lista de exclusoes), ATENDIMENTO_FINALIZADO (linha ~3280). Ou seja, o padrao de auditoria estabelecido no proprio modulo simplesmente nao foi aplicado ao CRUD de documentos clinicos (atestados/receituarios/declaracoes) - nao e falta de infraestrutura, e uma lacuna pontual.

5) Confirmei que este item NAO esta na lista de "ja corrigidos": a exclusao em cascata de documentos dentro do DELETE de atendimento completo (atendimento.py:3645-3646, `for documento in documentos: db.delete(documento)`) tambem nao gera um evento de auditoria por documento individual, apenas o evento agregado `ATENDIMENTO_EXCLUIDO` do atendimento como um todo - mas o achado do auditor e especificamente sobre a edicao/exclusao AVULSA de um documento via `PUT/DELETE /atendimentos/{id}/documentos/{id}` mantendo o atendimento aberto, que e um fluxo distinto e continua 100% sem rastro.

6) Busquei por testes cobrindo auditoria nesses dois endpoints (`grep` por "documentos/" + put/delete em backend/tests) e nao encontrei nenhum - reforcando que a lacuna nunca foi endereçada.

Nao ha nenhum guard, soft-delete, tabela de historico ou chamada a `registrar_auditoria` que refute o achado.

</details>

---

## 22. [MEDIA] N+1 real em _sync_exames/_sync_prescricao, disparado a cada autosave (PUT)

**Dimensao:** Performance (N+1, fetches redundantes, re-renders)  
**Local:** `backend/app/api/v1/endpoints/atendimento.py:1776`

**Descricao:** Dentro do loop `for payload in exames_payload:` de `_sync_exames` (linhas 1755-1826), para CADA item de exame do payload o codigo executa `db.query(CatalogoExame).filter(CatalogoExame.id == payload.catalogo_exame_id).first()` (linha 1778) e, se houver, `db.query(PainelExame).filter(PainelExame.id == payload.painel_exame_id).first()` (linha 1782) — uma query por exame, em vez de um unico `.filter(CatalogoExame.id.in_(ids))` fora do loop (o mesmo padrao usado corretamente em `_contar_anexos_por_exame`/`_map_ajustes_por_item`, que sao batched). O mesmo tipo de padrao aparece em `_sync_prescricao` (linha 1887-1891): `_obter_nome_medicamento` roda `db.query(Medicamento)` por item de prescricao sempre que `medicamento_nome` vier vazio. Esses dois helpers sao chamados tanto em `criar_atendimento` (POST, linha 2973-2974) quanto em `atualizar_atendimento` (PUT, linha 3184-3187) — e o PUT e exatamente o endpoint do autosave do frontend, que dispara a cada ~1.8s de digitacao (AUTOSAVE_DELAY_MS em frontend/app/atendimento/page.tsx:1109, efeito com dependencia `form` inteiro em page.tsx:4208), mesmo quando nenhum campo de exame mudou.

**Cenario de falha:** Um atendimento cardiologico com um painel de 8 exames solicitados (cada um com catalogo_exame_id preenchido, tipico do fluxo 'adicionar painel' em page.tsx:3559/3580) fica aberto enquanto o veterinario digita a anamnese. A cada ~1.8s o autosave dispara um PUT que executa `_sync_exames` sobre os 8 itens: isso gera 8 (ou 16, se houver painel_exame_id) queries extras de SELECT so para reconfirmar dados de catalogo que nao mudaram, em toda unica requisicao de autosave da sessao — multiplicando a carga no banco proporcionalmente ao numero de exames e a frequencia de digitacao, sem nenhum ganho (os dados do catalogo nao mudam a cada keystroke).

<details><summary>Justificativa da verificacao adversarial</summary>

Confirmei o N+1 lendo o codigo atual, nao consta na lista de itens ja corrigidos (que trata de guards de exclusao/liberacao/reabertura, nao de performance de query).

Backend, `backend/app/api/v1/endpoints/atendimento.py`:
- `_sync_exames` (linhas 1742-1834): dentro do `for payload in exames_payload:` (1755), para cada item com `catalogo_exame_id` roda `db.query(CatalogoExame).filter(...).first()` (linha 1778, sem condicao de "so se mudou") e, se houver `painel_exame_id`, mais `db.query(PainelExame).filter(...).first()` (linha 1782). Nenhuma memoizacao/dedupe por id repetido entre itens do mesmo payload; cada iteracao dispara sua propria query.
- Contraste real com o resto do mesmo arquivo: `_contar_anexos_por_exame` (linhas 1551-1562) e batched com `group_by` numa unica query, e `_map_ajustes_por_item` (chamada em 1956) tambem e batched — confirma que o padrao correto ja existe no arquivo e nao foi reaproveitado em `_sync_exames`.
- `_obter_nome_medicamento` (linhas 1727-1739) roda `db.query(Medicamento).filter(Medicamento.id == medicamento_id).first()` (linha 1736) por item sempre que `medicamento_nome` vier vazio; chamada em loop dentro de `_sync_prescricao` (linha 1887-1891).
- Ambos os helpers sao chamados em `criar_atendimento` (POST, 2973-2974) e `atualizar_atendimento` (PUT, 3184-3187), condicionados apenas a `payload.exames is not None` (3184) e `"prescricao" in data` (3186).

Schema, `backend/app/schemas/atendimento.py:172-173`: `AtendimentoUpdatePayload.exames: Optional[List[...]] = None` e `prescricao: Optional[...] = None` — ou seja, so nao disparam se o cliente omitir o campo.

Frontend, `frontend/app/atendimento/page.tsx`:
- `buildAtendimentoPayload` (1181-1255) SEMPRE inclui as chaves `exames` (1203) e `prescricao` (1232), mesmo quando so um campo de texto (ex.: anamnese) mudou — logo `payload.exames is not None` e `"prescricao" in data` sao verdadeiros em todo PUT, nao so quando exames/prescricao realmente mudam.
- `buildExamFromCatalog` (3498-3509) ja preenche `tipo_exame`, `categoria_exame`, `preparo`, `prioridade`, `valor` no cliente a partir do catalogo no momento da selecao — ou seja, o requery de `CatalogoExame`/`PainelExame` no backend a cada save e puramente redundante mesmo nos casos normais de uso (nao serve para nenhum dado que o cliente ainda nao tenha mandado).
- O efeito de autosave (4160-4208) depende de `form` inteiro e dispara `saveAtendimento("autosave")` (4200) apos `AUTOSAVE_DELAY_MS = 1800` (linha 1109) de inatividade sempre que o snapshot serializado mudar — incluindo quando so texto clinico foi editado.

Cenario do auditor e plausivel e verificavel: atendimento com painel de 8 exames (cada um com `catalogo_exame_id`) aberto enquanto o veterinario digita anamnese gera, a cada pausa de digitacao (~1.8s), um PUT que reexecuta `_sync_exames` sobre os 8 itens inalterados = ate 16 SELECTs extras (8 CatalogoExame + 8 PainelExame se aplicavel) que nao adicionam nenhum dado novo, ja que o cliente ja mandou os campos denormalizados.

Ajuste de severidade: as queries sao lookups por chave primaria (indexadas, baratas isoladamente) e o autosave e debounced (nao dispara a cada tecla, so a cada pausa de ~1.8s), o que reduz o impacto absoluto por escrita comparado a um N+1 classico sobre uma listagem paginada/em massa. Ainda assim e um desperdicio real e sistematico (toda sessao de edicao de atendimento com exames/painel, mesmo editando so texto), que soma latencia de rede por round-trip de DB e carga desnecessaria em cenarios de multiplos atendimentos abertos simultaneamente numa clinica. Rebaixo de "alta" para "media": e um problema real e vale corrigir (mover os `db.query(CatalogoExame.id.in_(ids))` / `PainelExame.id.in_(ids))` para fora do loop, no mesmo padrao ja usado em `_contar_anexos_por_exame`), mas nao configura risco alto de indisponibilidade/timeout como um N+1 classico sobre coleções grandes ou listagens.

</details>

---

## 23. [MEDIA] Timeline do paciente faz varredura nao limitada e reconsulta AtendimentoClinico duas vezes na mesma requisicao

**Dimensao:** Performance (N+1, fetches redundantes, re-renders)  
**Local:** `backend/app/api/v1/endpoints/atendimento.py:4539`

**Descricao:** O endpoint `GET /atendimentos/paciente/{paciente_id}/historico` (linha 4697) primeiro busca atendimentos do paciente respeitando o parametro `limite` (linha 4710-4716, default 12, vindo de `carregarHistoricoPaciente` em frontend/app/atendimento/page.tsx:2590/2598), mas depois chama `_montar_timeline_paciente(db, paciente_id)` (linha 4813), que executa uma SEGUNDA query, INDEPENDENTE e SEM LIMITE, em `AtendimentoClinico` filtrando so por `paciente_id` (linhas 4539-4544), e a partir dela busca `EvolucaoClinica`/`AnexoAtendimento` para TODOS esses atendimentos (nao so os `limite` mais recentes), alem de `Exame` e `Laudo` tambem sem limite por `paciente_id` (linhas 4563-4574). Ou seja, cada chamada a esse endpoint faz duas consultas redundantes na mesma tabela (uma limitada, outra nao) e falha em aplicar o proprio parametro `limite` da rota as tabelas relacionadas.

**Cenario de falha:** Um paciente cardiopata cronico acompanhado ha anos no FortCordis acumula centenas de atendimentos, exames e laudos. Toda vez que o usuario abre esse paciente no modulo de Atendimento (selecao manual do paciente, `abrirAtendimento`, ou logo apos qualquer save/finalizacao — 4 pontos distintos em page.tsx que chamam `carregarHistoricoPaciente`), o backend varre TODO o historico do paciente (nao apenas os 12 mais recentes) para montar a timeline, refazendo esse trabalho pesado repetidamente na mesma sessao (a cada troca de paciente, a cada save manual). O custo cresce linearmente com o volume historico do paciente e independe do `limite` pedido pelo frontend, tornando a abertura de pacientes antigos progressivamente mais lenta com o tempo de uso do sistema.

<details><summary>Justificativa da verificacao adversarial</summary>

Confirmado no codigo atual. Em backend/app/api/v1/endpoints/atendimento.py:4710-4716, `historico_paciente` busca `AtendimentoClinico` filtrado por `paciente_id` respeitando `.limit(limite)` (default 10, chamado do frontend com `limite=12` em frontend/app/atendimento/page.tsx:2590). Em seguida, na linha 4813, chama `_montar_timeline_paciente(db, paciente_id)`, cuja definicao em atendimento.py:4538-4544 executa uma segunda query independente em `AtendimentoClinico` filtrando so por `paciente_id`, SEM `.limit()` e SEM reaproveitar a lista `atendimentos` ja carregada no escopo do endpoint. A partir dessa segunda lista completa (`atendimento_ids`, linha 4545), busca-se `EvolucaoClinica` (4547-4554) e `AnexoAtendimento` (4555-4562) para todos os atendimentos historicos do paciente, e `Exame` (4563-4567) e `Laudo` (4569-4573) tambem filtrados so por `paciente_id`, sem limite algum. O mesmo endpoint `/timeline` (linha 4817-4836) chama a mesma funcao sem limite, entao o problema nao e exclusivo do endpoint de historico. Confirmei via `grep` em frontend/app/atendimento/page.tsx que ha 4 pontos de chamada a `carregarHistoricoPaciente` (linhas 2616, 2664, 4026, 4128), batendo com a alegacao do auditor de que isso se repete a cada troca de paciente e apos saves/finalizacoes. Verifiquei o historico de commits (`git log` no arquivo) e a lista de itens ja corrigidos: o unico commit de performance relacionado e `cc4bc389 perf(atendimento): remove N+1 in list endpoint (FOR-27)`, que ataca um endpoint de LISTAGEM distinto (confirmado via `git show --stat`, que so toca esse mesmo arquivo mas para outra funcao), nao a timeline do paciente. Portanto este achado nao esta na lista de itens ja resolvidos e permanece real.

</details>

---

## 24. [MEDIA] Fetches de contexto do paciente sem cancelamento permitem resposta antiga sobrescrever paciente mais recente

**Dimensao:** Performance (N+1, fetches redundantes, re-renders)  
**Local:** `frontend/app/atendimento/page.tsx:2605`

**Descricao:** O efeito que reage a mudanca de `form.paciente_id` (linhas 2605-2618) dispara `carregarHistoricoPaciente(form.paciente_id)` (linha 2590-2603) e `carregarCadastroComplementar(form.paciente_id)` (linha 1698-1740) sem qualquer AbortController, request-id ou flag de 'ultima requisicao valida' — o unico uso de AbortController no arquivo e para upload de anexos (uploadAbortControllersRef, linha 1466). Cada chamada apenas faz `setHistoricoPaciente(response.data)` / `setCadastroComplementar(...)` quando a Promise resolve, sem checar se o paciente selecionado ainda e o mesmo, nem cancelar a requisicao anterior.

**Cenario de falha:** O usuario seleciona rapidamente o Paciente A e, antes da resposta chegar, troca para o Paciente B (comum ao navegar por resultados de busca de paciente). Se a requisicao de historico/cadastro do Paciente A demorar mais que a do Paciente B (por exemplo, exatamente pelo problema de timeline nao limitada do achado anterior, que fica mais lento quanto mais antigo/extenso for o historico do paciente), a resposta de A chega DEPOIS da de B e sobrescreve `historicoPaciente`/`cadastroComplementar` na tela — o formulario mostra os dados do Paciente B mas a lateral de contexto clinico (alertas, peso historico, cadastro complementar, timeline) exibe informacoes do Paciente A, um cenario real de dado clinico trocado na tela sem qualquer erro visivel ao usuario.

<details><summary>Justificativa da verificacao adversarial</summary>

Verifiquei o codigo atual em frontend/app/atendimento/page.tsx. O unico AbortController do arquivo e uploadAbortControllersRef (linha 1466), usado somente em upload de anexos (linhas 4460-4559) - confirmado via grep, nao ha nenhum outro mecanismo de cancelamento, request-id incremental ou 'ultima requisicao valida' no arquivo inteiro (grep por requestId/reqId/latestRequest/staleRequest/lastRequest nao retornou nada).

carregarHistoricoPaciente (linhas 2590-2603) e carregarCadastroComplementar (linhas 1698-1740) sao chamadas de forma fire-and-forget pelo useEffect de linhas 2605-2618 quando form.paciente_id muda por selecao manual do usuario (o guard hydratingFormRef.current na linha 2610 so bloqueia hidratacoes programaticas, nao a corrida entre duas selecoes manuais consecutivas). Ambas as funcoes, ao resolver, chamam setHistoricoPaciente(response.data) (linha 2599) / aplicarCadastroComplementar(...) (linha 1730) incondicionalmente, sem comparar pacienteId recebido como parametro contra o form.paciente_id (ou pacienteSelecionado) vigente no momento da resolucao. Nao ha closure guard, ref de 'ultimo id solicitado' nem cleanup no useEffect que invalide a promise anterior.

O dado sobrescrito nao e cosmetico: historicoPaciente alimenta alertasAtivos (linha 5552) e o timeline clinico (linha 5551) exibidos na lateral de contexto (props passadas em linhas 6792 e 6874), alem de participar do calculo de peso/triagem (linhas 2292-2348). Isso confirma o cenario de falha do auditor: numa troca rapida A->B, se a resposta de A demorar mais (ex.: paciente com historico maior/mais lento), ela chega depois e sobrescreve os dados de contexto clinico (alertas, peso, timeline, cadastro complementar) do paciente B ja selecionado, sem qualquer erro visivel. Este item nao consta na lista de achados ja corrigidos anteriormente (que trata de exclusao de exame, liberacao de portal, agendamento_id, autosave/beforeunload, calculo mg/kg, cadastro complementar zerado ao reabrir, DELETE sem guard, filtro de data, indices de exame por posicao, herdar dados do atendimento anterior, layout de botoes, filtro de documentacao incompleta - nenhum trata de race condition de fetch por troca rapida de paciente).

</details>

---

## 25. [MEDIA] Conteúdo de exame já liberado no portal continua editável sem auditoria após a liberação

**Dimensao:** Consistencia entre Atendimento/Agendamento/OrdemServico/Exame/Laudo/Portal  
**Local:** `backend/app/api/v1/endpoints/atendimento.py:1813`

**Descricao:** _derivar_status_exame preserva o status 'Liberado no portal' durante o save (não regride o status), mas os campos de conteúdo do mesmo exame - resultado, valor_referencia, unidade, observacoes (atendimento.py:1813-1820) - continuam sendo sobrescritos incondicionalmente a cada PUT, independente do status atual, e sem nenhum registro de auditoria equivalente ao _registrar_ajuste_prescricao usado para itens de prescrição (_sync_prescricao, linhas 1905-1915). No frontend, o textarea de resultado (AtendimentoExamesSection.tsx:528-531) não tem disabled condicionado a exameLiberadoNoPortal, permitindo a edição livremente pela UI.

**Cenario de falha:** Um exame é liberado no portal com a interpretação 'sem alterações significativas'. Dias depois, por engano ou revisão, o veterinário edita o campo resultado desse mesmo exame no prontuário e salva o atendimento (ou o autosave grava um valor decorrente de merge incorreto). O conteúdo que a clínica parceira/tutor já visualizou no portal muda silenciosamente para o novo texto, sem nova notificação de liberação, sem histórico do texto anterior e sem trilha de quem alterou e quando - o que foi efetivamente comunicado/baixado pelo destinatário externo diverge do que o prontuário mostra depois.

<details><summary>Justificativa da verificacao adversarial</summary>

Confirmei o achado lendo o codigo atual.

1) Sobrescrita incondicional dos campos de conteudo: em `_sync_exames` (backend/app/api/v1/endpoints/atendimento.py:1742-1834), o status do exame e preservado via `_derivar_status_exame` (linhas 1808-1812, que checa `is_portal_released_status(status_atual)` em 1576-1577), mas logo em seguida, sem nenhuma condicional sobre o status atual do exame, as linhas 1813-1820 fazem:
```
exame.resultado = (payload.resultado or "").strip() or None
exame.valor_referencia = (payload.valor_referencia or "").strip() or None
exame.unidade = (payload.unidade or "").strip() or None
exame.observacoes = (payload.observacoes or "").strip() or (...) or ""
```
Isso roda tanto no POST (linha 2973) quanto no PUT /atendimentos/{id} (linha 3184-3185), sem nenhum guard equivalente ao que existe para exclusao de exame liberado (`_motivo_bloqueio_exclusao_exame`, linha 1592) ou para o proprio status.

2) Ausencia de auditoria por campo: existe um mecanismo de auditoria granular para prescricao (`_registrar_ajuste_prescricao`, linhas 186-213, que grava `PrescricaoItemAjuste` com valor_anterior/valor_novo/responsavel/timestamp, chamado dentro de `_sync_prescricao`). Nao ha equivalente para `Exame` — busquei por `ExameAjuste`/model analogo e nao existe. A unica auditoria de exame e `_auditar_transicao_exame_portal` (linha 4008), disparada somente pelos endpoints explicitos `/exames/{id}/portal/liberar` (linha 4035) e `/portal/revogar` (linha 4110) — nao pelo save generico via `_sync_exames`.

3) Frontend sem trava: em AtendimentoExamesSection.tsx, `exameLiberadoNoPortal` (linha 385) so e usado para alternar o botao liberar/revogar (linhas 448-482); o textarea de `resultado` (linhas 527-533) e o input de `observacoes` (linhas 514-519) nao tem `disabled` condicionado a isso, confirmando edicao livre pela UI.

Nuance que ajusto na narrativa do auditor (sem enfraquecer a conclusao): o schema `PortalExamSummaryResponse` (backend/app/schemas/portal.py:63-80) NAO expoe o campo `resultado` nem `valor_referencia`/`unidade` ao portal externo — so `observacoes`. Ou seja, a "interpretacao resumida do resultado" citada no cenario de falha nao e, hoje, o texto que a clinica parceira ve. Porem `observacoes` E renderizado ao vivo para o parceiro externo em frontend/components/portal/PortalClinicaWorkspace.tsx:780-782/998-1000 e PortalPartnerWorkspace.tsx:723-725, e esse mesmo campo recebe a mensagem fixa de liberacao em atendimento.py:4072 (`PORTAL_EXAME_RELEASE_MESSAGE`) que pode ser silenciosamente sobrescrita pelo mesmo caminho de save sem auditoria nem nova notificacao — logo o nucleo do achado (conteudo externamente visivel mutavel sem trilha apos liberacao) se sustenta, ainda que por um campo diferente do citado como exemplo. `valor_referencia`/`unidade` seguem sobrescritos sem auditoria mas hoje sem efeito externo (gap de rastreabilidade interna, nao de exposicao externa).

Este item nao consta na lista de "ja corrigidos" (que trata de regressao de status, nao de conteudo).

</details>

---

## 26. [MEDIA] carregarCadastroComplementar sem catch: rejeicao nao tratada em chamadas void

**Dimensao:** Tratamento de erros e feedback ao usuario  
**Local:** `frontend/app/atendimento/page.tsx:1698`

**Descricao:** A funcao `carregarCadastroComplementar` (linhas 1698-1740) usa `try { ... } finally { setCarregandoCadastroComplementar(false); }` sem nenhum bloco `catch` no nivel externo (so ha um catch interno, silencioso, para a busca de tutor). Se `api.get('/pacientes/${normalized}')` rejeitar (rede instavel, 401/403 por sessao expirada, 500), a excecao se propaga para fora da funcao. A funcao e chamada em tres pontos via `void carregarCadastroComplementar(...)` (linhas 1942, 2616 e 2666), ou seja, fire-and-forget: nao ha nenhum `.catch()` no chamador. Nao existe handler global de `unhandledrejection` no frontend (confirmado por busca no repositorio), entao o erro vira uma unhandled promise rejection pura.

**Cenario de falha:** Veterinario troca de paciente no formulario (dispara o useEffect da linha 2605-2618) ou abre um atendimento existente (linha 2666) no momento em que a API de pacientes/tutores esta lenta ou fora do ar. O `finally` ainda desliga o spinner `carregandoCadastroComplementar`, entao a tela simplesmente para de carregar sem preencher nenhum dado do cadastro complementar (telefone, endereco, CPF do tutor) -- e nenhuma mensagem de erro e exibida. O vet acha que o paciente nao tem cadastro complementar, quando na verdade a chamada falhou silenciosamente.

<details><summary>Justificativa da verificacao adversarial</summary>

Confirmei lendo o codigo atual em frontend/app/atendimento/page.tsx:1698-1740. A funcao `carregarCadastroComplementar` tem `try { setCarregandoCadastroComplementar(true); ... } finally { setCarregandoCadastroComplementar(false); }` (linhas 1705-1739) sem nenhum `catch` no nivel externo — apenas catches internos e silenciosos (linhas 1712-1717 e 1720-1728) para tutor, que tem fallback proprio. A chamada `api.get(`/pacientes/${normalized}`)` (linha 1707) e as demais nao estao protegidas: se rejeitarem, a excecao se propaga para fora da funcao async.

Os tres call sites via `void carregarCadastroComplementar(...)` (linhas 1942, 2617 e 2666) nao encadeiam `.catch()`. Em particular a linha 2666 esta dentro do `try` de `abrirAtendimento` (que comeca na linha 2629), mas isso e irrelevante: como a chamada nao e `await`ada (`void`), a rejeicao ocorre de forma assincrona fora do frame de execucao sincrono do `try`/`catch` envolvente e nao e capturada por ele — vira unhandled promise rejection de qualquer forma. O mesmo vale para a linha 2617, dentro de um `useEffect` (linhas 2605-2618) que dispara ao trocar `form.paciente_id`.

Verifiquei tambem que nao existe handler global: `grep -rn "unhandledrejection"` em todo o frontend nao retornou nenhum resultado, e `app/layout.tsx` nao registra nenhum listener desse tipo. O interceptor de resposta em `lib/axios.ts` (linhas ~54-71) apenas calcula `error.userMessage` via `extractApiErrorMessage` e da `Promise.reject(error)` — nao exibe toast/mensagem por conta propria; so redireciona para `/` no caso especifico de 401 (sessao expirada), que e o unico subcaso do cenario do auditor que teria algum feedback visivel (redirect de login), mas isso e incidental ao interceptor e nao ao tratamento na pagina. Para timeout de rede, 403 ou 500, nao ha qualquer sinalizacao ao usuario.

O unico consumo de `carregandoCadastroComplementar` no JSX e uma unica prop repassada a um componente filho (linha 6594), controlando apenas o estado de "carregando"; nao encontrei nenhum estado de erro companheiro (ex.: `erroCadastroComplementar`) sendo setado nem exibido. Isso confirma o cenario descrito: o spinner desliga (finally) e a tela simplesmente fica sem os dados do cadastro complementar, sem qualquer mensagem de erro — o vet pode concluir erroneamente que o paciente nao tem cadastro complementar.

Este item nao consta na lista de achados ja corrigidos em pacotes anteriores da auditoria (que trata de: exclusao de exame, revogacao de liberacao no portal, PUT com agendamento_id, beforeunload/autosave, calculo mg/kg, cadastro complementar *zerado ao reabrir mesmo paciente* [problema distinto: perda de dados, nao tratamento de erro], consulta_concluida sobrescrito, DELETE sem guard, filtro de data, estado de exames por indice, herdar dados do atendimento anterior, layout do cabecalho, filtro de documentacao incompleta) — e um problema diferente e ainda presente no codigo atual.

</details>

---

## 27. [MEDIA] carregarFrasesClinicas sem try/catch algum, chamada via void no botao 'Atualizar banco'

**Dimensao:** Tratamento de erros e feedback ao usuario  
**Local:** `frontend/app/atendimento/page.tsx:4980`

**Descricao:** `carregarFrasesClinicas` (linhas 4980-4983) e a unica das funcoes de recarregamento de listas base que nao possui absolutamente nenhum tratamento de erro: `const response = await api.get(...); setClinicalPhrases(response.data?.frases || []);` sem try/catch. Ela e usada via `void carregarFrasesClinicas()` no onClick do botao 'Atualizar banco' em AtendimentoBibliotecasSection.tsx:79. Compare com a funcao irma `carregarMedicamentosBanco` (page.tsx:4887-4897), que trata o mesmo tipo de chamada com try/catch e `setErro(...)` -- a assimetria confirma que a ausencia de tratamento aqui e uma lacuna, nao uma decisao deliberada.

**Cenario de falha:** Vet clica em 'Atualizar banco' na secao de frases clinicas durante uma instabilidade momentanea de rede/API. A requisicao falha, a excecao nao e capturada em lugar nenhum (rejeicao nao tratada), nenhum toast de erro aparece, o botao nao mostra estado de carregamento e a lista de frases clinicas continua exatamente como estava -- o vet nao tem nenhuma pista de que a atualizacao falhou e pode seguir editando com dados desatualizados.

<details><summary>Justificativa da verificacao adversarial</summary>

Conferi o codigo atual em frontend/app/atendimento/page.tsx:4980-4983: `const carregarFrasesClinicas = async () => { const response = await api.get("/atendimentos/frases-clinicas?include_inactive=1&limit=1000"); setClinicalPhrases(response.data?.frases || []); };` -- de fato nao ha try/catch, nao ha setErro, nao ha estado de loading. Comparando com a funcao irma carregarMedicamentosBanco (page.tsx:4887-4897), esta sim envolve a chamada equivalente em try/catch com `setErro(extractApiErrorMessageSync(e, "Erro ao atualizar banco de medicamentos."))` no catch -- a assimetria e real e visivel lado a lado no mesmo arquivo.

Confirmei tambem o ponto de uso: AtendimentoBibliotecasSection.tsx:79 chama `onClick={() => void carregarFrasesClinicas()}` no botao "Atualizar banco" (linha 84), sem disabled/loading e sem qualquer wrapper de erro no proprio componente (o botao gemeo de medicamentos, linha 451, chama `carregarMedicamentosBanco()` que tem tratamento).

Verifiquei tambem se existe alguma rede de seguranca global que pudesse mascarar a lacuna: o interceptor de resposta do axios em frontend/lib/axios.ts:53-71 apenas normaliza a mensagem de erro (`extractApiErrorMessage`) e trata 401 (redirect), mas sempre re-rejeita a promise (`return Promise.reject(error)`) -- nao exibe toast nem atualiza nenhum estado de erro global. Nao ha handler de `unhandledrejection`/`window.onerror`/ErrorBoundary em frontend/app ou frontend/lib que capture rejeicoes nao tratadas e as traduza em feedback visual. Ou seja, quando a chamada falha, a rejeicao realmente fica sem tratamento nenhum na UI: nenhum toast, nenhuma sinalizacao, e `clinicalPhrases` simplesmente nao e atualizado -- exatamente o cenario descrito pelo auditor.

Nao encontrei este item na lista de achados ja corrigidos em pacotes anteriores da auditoria (a lista cobre exclusao de exame, liberacao de portal, agendamento_id, autosave/beforeunload, calculo mg/kg, cadastro complementar, consulta_concluida, DELETE de atendimento, filtro de data, indices de exames, herdar atendimento anterior, layout do cabecalho, filtro de documentacao incompleta -- nenhum trata de carregarFrasesClinicas ou do botao "Atualizar banco" de frases clinicas).

Severidade: concordo com "media" do auditor. E uma falha real de feedback ao usuario (silent failure), mas o impacto pratico e limitado -- afeta apenas a atualizacao de um banco de referencia (frases clinicas prontas para preenchimento de texto), nao ha risco de perda de dados, sobrescrita indevida ou dado clinico critico (diferente de medicamentos/doses). O vet pode continuar trabalhando com a lista desatualizada sem saber, o que e um problema de usabilidade/confianca, mas nao um risco de seguranca do paciente ou integridade de dados salvos.

</details>

---

## 28. [MEDIA] abrirAnexo usa extrator sincrono de erro para resposta blob, perdendo a mensagem real do backend

**Dimensao:** Tratamento de erros e feedback ao usuario  
**Local:** `frontend/app/atendimento/page.tsx:4611`

**Descricao:** `abrirAnexo` (linhas 4581-4616) faz `api.get(..., { responseType: 'blob' })` e, no catch (linha 4611), usa `extractApiErrorMessageSync(e, 'Erro ao abrir anexo.')`. Quando a resposta e blob, `error.response.data` e um objeto `Blob`, e `extractApiErrorMessageSync` (frontend/lib/api-error.ts:32-54) nao sabe ler Blob -- ele so trata string/objeto JSON ja parseado ou cai para `error.message`. Para erros HTTP, o axios normalmente preenche `error.message` com um texto tecnico em ingles tipo 'Request failed with status code 404', que a funcao sincrona retorna diretamente ao usuario. As outras duas chamadas com `responseType: 'blob'` no mesmo arquivo (geracao de PDF de documento, linha 4808, e de receita/exames, linha 5270) usam corretamente a versao assincrona `extractApiErrorMessage`, que sabe fazer `blob.text()` e extrair o `detail` real do JSON de erro do backend -- confirmando que esta e uma inconsistencia isolada, nao um padrao intencional.

**Cenario de falha:** Vet clica em 'Visualizar' ou 'Baixar' um anexo cujo arquivo fisico foi removido do armazenamento (ou o download_url expirou). O backend responde 404 com `{'detail': 'Arquivo nao encontrado no armazenamento.'}`, mas como a resposta veio como blob, o vet ve a mensagem generica em ingles 'Request failed with status code 404' em vez do motivo real e acionavel, sem nenhuma orientacao do que fazer.

<details><summary>Justificativa da verificacao adversarial</summary>

Confirmado por leitura direta do codigo atual. Em frontend/app/atendimento/page.tsx, a funcao abrirAnexo (linhas 4580-4613) faz `api.get(normalizeApiPath(anexo.download_url), { responseType: "blob" })` e no catch (linha 4611) usa `extractApiErrorMessageSync(e, "Erro ao abrir anexo.")` - a versao SINCRONA. Em frontend/lib/api-error.ts, extractApiErrorMessageSync (linhas 31-51) so trata `response.data` via readDetailFromObject (que exige propriedades `detail`/`message` presentes no objeto - um Blob nao tem essas propriedades, entao retorna null) ou via string com JSON.parse; nunca chama `blob.text()` (isso so acontece na versao async extractApiErrorMessage, linhas 53-73). Assim, quando o download falha, o fluxo cai para `topLevelMessage = error.message` (linha 46-48), que no axios e a mensagem tecnica generica em ingles (ex.: "Request failed with status code 404"), perdendo o detail real. Confirmei tambem no backend que o endpoint GET /atendimentos/anexos/{anexo_id}/arquivo (backend/app/api/v1/endpoints/atendimento.py:4388-4400) delega a build_attachment_download_response, que quando o arquivo nao existe no storage local ou remoto levanta HTTPException(404, detail="Arquivo nao encontrado no armazenamento.") (backend/app/services/attachment_download_service.py, funcoes build_attachment_download_response e _build_remote_download_response) - ou seja, ha de fato uma mensagem acionavel em portugues que se perde. Confirmei ainda a inconsistencia apontada pelo auditor: as outras duas chamadas com responseType "blob" no mesmo arquivo - baixarPdfDocumentoClinico (linha 4776, catch nao mostrado mas endpoint semelhante) e a geracao de PDF de receita/exames em (linha 5248, catch na linha ~5270) - usam `await extractApiErrorMessage(e, ...)`, a versao assincrona que corretamente chama `blob.text()` e faz parse do JSON de erro. Nao encontrei nenhum guard, try/catch adicional ou tratamento especial em abrirAnexo que mitigue isso, nem commits recentes (git log) que tenham tocado este trecho. O achado nao corresponde a nenhum item da lista de "ja corrigidos".

</details>

---

## 29. [MEDIA] Upload multiplo de resultados de exame: falha no meio do lote descarta arquivos restantes sem avisar quantos foram ignorados

**Dimensao:** Tratamento de erros e feedback ao usuario  
**Local:** `frontend/app/atendimento/page.tsx:4444`

**Descricao:** `uploadArquivosResultadoExame` (linhas 4428-4457) itera sequencialmente sobre os arquivos soltos/selecionados e, se `uploadAnexoArquivo` retornar `false` para algum arquivo (limite de 25MB, extensao nao permitida, erro de rede), executa `break` e interrompe o lote -- mas na sequencia (linhas 4455-4456) sempre chama `clearExamUploadDraft`/`clearExamDropState`, limpando qualquer rastro do estado de upload pendente. A unica mensagem de erro que o vet ve e a especifica do arquivo que falhou (ex.: 'Arquivo excede o limite de 25MB', vinda de `uploadAnexoArquivo`), sem nenhuma indicacao de que os demais arquivos do lote nunca chegaram a ser enviados.

**Cenario de falha:** Vet arrasta 5 imagens de resultado de exame para a dropzone de um exame (`onDrop`, AtendimentoExamesSection.tsx:565-574, que chama `void uploadArquivosResultadoExame(index, files)` quando `files.length > 1`). O 2º arquivo excede 25MB: o loop quebra, os arquivos 3, 4 e 5 nunca sao enviados. O vet ve apenas 'Arquivo excede o limite de 25MB' e, ao ver o exame com 1 anexo (o 1º arquivo, que teve sucesso), presume que so o arquivo problematico ficou de fora -- sem saber que 3 resultados de exame inteiros nunca foram anexados ao prontuario.

<details><summary>Justificativa da verificacao adversarial</summary>

Codigo atual confirma o achado exatamente como descrito. Em frontend/app/atendimento/page.tsx:4428-4457, `uploadArquivosResultadoExame` itera sequencialmente sobre `arquivosValidos` (linha 4444) chamando `uploadAnexoArquivo` para cada arquivo; se este retornar `false` (linha 4451-4453) o loop e interrompido com `break`, mas nas linhas 4455-4456 o codigo SEMPRE chama `clearExamUploadDraft(...)` e `clearExamDropState(...)` incondicionalmente (fora de qualquer branch condicional ao sucesso), sem nenhum contador ou mensagem sobre quantos arquivos ficaram sem enviar.

Verifiquei tambem `uploadAnexoArquivo` (linhas 4468-4563): a validacao de tamanho (linha 4480, limite `ATENDIMENTO_ATTACHMENT_MAX_SIZE_BYTES = 25*1024*1024` definido na linha 829) dispara `setErro("Arquivo excede o limite de 25MB")` (linha 4481) e retorna `false` — essa e a UNICA mensagem que fica visivel ao vet; nao ha nenhum `setSucesso`/`setErro` agregado do tipo "X de Y arquivos enviados" em lugar nenhum do arquivo (busquei por "arquivos enviados", "ignorad", "falharam", "arquivos restantes" e nao ha ocorrencia relevante).

Confirmei o cenario de disparo em frontend/app/atendimento/components/AtendimentoExamesSection.tsx:565-574 (`onDrop`) e 585-593 (`onChange` do input `multiple`): quando `files.length > 1`, chama `void uploadArquivosResultadoExame(index, files)`, batendo com a descricao do auditor.

Este achado NAO corresponde a nenhum item da lista de "ja corrigido" (que trata de indexacao por posicao vs chave estavel — ja resolvido via `getExameStateKey`/`exameKey`, algo ortogonal ao problema de feedback de lote aqui). O `index` usado em `uploadArquivosResultadoExame` continua sendo o indice posicional do array `formRef.current.exames`, mas isso e correto/esperado para essa funcao e nao mitiga o problema relatado.

</details>

---
