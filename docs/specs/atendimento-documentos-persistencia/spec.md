# Spec - Persistencia dos documentos clinicos

Data: 2026-09-29. Status: validado localmente, nao publicado.

## Comportamento

- RF-01: documentos sao recursos independentes. PUT do atendimento nao sincroniza nem substitui a colecao, inclusive com lista vazia/antiga enviada por cliente.
- RF-02: DELETE do documento passa a arquivar mantendo ID, atendimento_id, titulo, corpo e emitido_at. Listagem e detalhe incluem arquivados; interface os separa e oferece restauracao.
- RF-03: POST /atendimentos/{id}/documentos/{documento_id}/restaurar restaura para emitido quando ha emitido_at, ou rascunho. Arquivado nao pode ser editado ou emitido sem restauracao.
- RF-04: API serializa versao opaca (hash de identidade, conteudo, status e timestamps). PUT, DELETE, restauracao e PDF exigem a versao lida. Ausencia retorna 428; divergencia retorna 409 sem alterar o documento. UI preserva o editor no erro e permite atualizar a lista para comparacao.
- RF-05: UPDATE/arquivo/restauracao/PDF adquirem lock do documento e releem o identity map antes da comparacao. No PostgreSQL, operacoes simultaneas baseadas na mesma versao nao podem ambas sobrescrever o documento. PUT sem alteracoes e idempotente e nao renova a versao.
- RF-06: status nao pode ser fabricado por PUT; emissao decorre da geracao de PDF. Auditoria de criacao, mudanca, PDF, arquivo e restauracao e gravada na mesma transacao; falha de auditoria reverte a operacao.
- RF-07: exclusao do atendimento com documentos, inclusive arquivados, retorna 409. Criacao do documento e exclusao do pai bloqueiam o registro pai para impedir corrida entre verificacao e criacao.
- RF-08: timestamps dos documentos sao UTC com offset explicito na API. As colunas legadas sem fuso conservam valores UTC, conforme runtime implantado verificado; nao ha conversao global de datas de atendimento. O cartao mostra emitido_at quando disponivel, identificado como Emissao, em America/Fortaleza.
- RF-09: cliente valida MIME/tamanho/assinatura %PDF- antes do download. URL nao e revogada imediatamente: permanece acessivel para Abrir PDF e Baixar novamente, sendo revogada ao substituir o arquivo ou desmontar a pagina. Mensagem descreve PDF recebido e download solicitado, sem afirmar entrega ou abertura.
- RF-11: digitacao feita durante PUT/PDF e preservada no editor, enquanto a versao salva e atualizada. Resposta de outro atendimento ou documento nao troca o editor atual.
- RF-10: salvar/criar/emitir exige confirmacao do ID na lista retornada pelo servidor; ausencia nao usa fallback ficticio de sucesso. Requisicoes de lista antigas ou de outro atendimento nao substituem a lista atual.

## Contrato e compatibilidade

Sem migracao: reutiliza status arquivado e colunas existentes. GET lista/detalhe acrescenta versao. PUT/restaurar recebem versao no JSON; DELETE e GET PDF recebem versao por query string (hash sem conteudo clinico). Titulo/corpo nao sao enviados em query string.

Abas antigas que nao enviem versao recebem 428 e devem recarregar; backend e frontend devem ser publicados juntos em futura entrega autorizada. O selo Emitido significa PDF gerado no servidor, nao confirmacao de download ou entrega ao tutor. PDF ainda e gerado sob demanda, nao armazenado como binario imutavel.

## Criterios de aceitacao

1. Criar documento, salvar atendimento, recarregar e abrir outra sessao conserva ID e texto.
2. Atualizacao concorrente ou obsoleta nao sobrescreve; remocao vira arquivo reversivel; nenhuma perda silenciosa.
3. Navegador recebe arquivo PDF real; arquivo salvo e reaberto, texto e pagina renderizada conferidos. Selo isolado nao e prova.
4. Horario de emissao e exibido em Fortaleza e nao substituido pelo horario de edicao.
5. Auditoria permite reconstruir operacoes futuras e falhas nao deixam escrita sem auditoria.

## Gate automatizado

Os workflows de stage e producao instalam `backend/requirements-test.txt` alem das dependencias de runtime. A suite unittest existente permanece obrigatoria. As regressoes pytest de documentos sao executadas explicitamente, incluindo as duas disputas simultaneas em PostgreSQL 16 descartavel no runner, banco `document_test` e schemas isolados. Nenhum banco remoto participa desses testes.

## Limites e rollback

Nao restaurar o documento real investigado nem reemitir o parecer da paciente nesta etapa. Conteudo clinico preservado fora do repositorio. Nenhum envio externo.

Reverter o codigo nao remove linhas arquivadas, mas reintroduz exclusao definitiva e elimina as precondicoes. Uma futura reversao requer avaliar essa perda de protecao. Bancos SQLite nao implementam SELECT FOR UPDATE; a garantia de serializacao simultanea e validada no PostgreSQL de producao, com instancia local descartavel.

## Atualizacao de contrato em 2026-10-10

O prontuario passa a oferecer consulta do historico de edicoes por atendimento, com antes/depois, autor e data, inclusive para documentos arquivados. A edicao de documentos emitidos continua permitida. A protecao de versao, a auditoria transacional e a independencia do documento permanecem obrigatorias.

Contrato e evidencias desta alteracao: [spec](../atendimento-edicao-pos-conclusao/spec.md) e [verify](../atendimento-edicao-pos-conclusao/verify.md). A evidencia de publicacao de entregas anteriores nao comprova a publicacao desta atualizacao.
