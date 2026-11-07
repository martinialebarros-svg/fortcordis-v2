> Registro documental preservado durante a publicacao isolada de tutores em 28/10/2026. O codigo desta feature nao integra esta arvore de producao. A implementacao e a homologacao de stage permanecem no snapshot `07317874b7b09eb7e8e1e076e9db4acc1294c90f`, a restaurar apos a promocao.

# Spec — Comparação com exames anteriores

## Contrato do serviço

`GET /api/v1/laudos/{id}/comparacao-anterior?anterior_id={opcional}` usa autenticação e `laudos.visualizar` existentes. Retorna estado, paciente, snapshot atual, snapshot anterior opcional e opções de id/data. Snapshot contém id, paciente_id, status, data_exame civil e whitelist de medidas. Não expor nome, tutor, contato, texto clínico, imagens, peso atual ou referências.

Somente `data_exame` define cronologia, pelo helper civil compartilhado. Não substituir por criação, atualização ou finalização. A data atual precisa existir e não ser futura. Candidatos: mesmo paciente, outro id, ecocardiograma finalizado, data conhecida estritamente anterior e não futura. Não selecionar outro laudo do mesmo dia. Havendo empate na data mais recente, retornar `data_anterior_ambigua` sem snapshot anterior; todos os candidatos elegíveis permanecem selecionáveis manualmente. ID estabiliza a ordem do seletor, sem definir a sequência clínica. Uma seleção inválida, de outro paciente ou inexistente recebe o mesmo 404 genérico. Paciente órfão recebe 422 genérico; nenhuma busca por nome é permitida.

Laudos concluídos incluem os estados `Finalizado` e `Liberado no portal`: a liberação substitui o status de finalizado, sem retirar a conclusão do exame. Ambos devem participar da seleção automática/manual e passar na validação frontend. Rascunhos e arquivados continuam excluídos. Nenhuma liberação é criada ou revogada pela comparação.

O serviço é somente leitura, dentro de `no_autoflush`. O parser compartilhado extrai as medidas registradas da descrição. A técnica inferida pelo parser é retirada se não houver linha explícita de `VE_tecnica_relatorio`. Sem cálculo, conversão numérica, fallback de peso ou mutação no serviço.

Isolar a primeira seção real de medidas antes de ler valores; uma seção vazia não autoriza capturar medidas de Qualitativa ou de uma segunda seção. A última ocorrência canônica de um campo é autoridade, inclusive vazia ou inválida. Preservar evidência de unidade explícita inválida e de método retirado para bloquear diferenças; não recuperar ocorrências anteriores ou aliases por esse motivo. O parser compartilhado e o PDF permanecem intactos.

## Comparabilidade e apresentação

As linhas são DIVEd, DIVEs, SIVd, SIVs, PLVEd e PLVEs em M e 2D, mais AE/Ao, quando algum exame tem valor registrado. As medidas originais ficam visíveis mesmo quando a diferença não é calculável. Ausência e valor inválido não equivalem a zero.

Comprimentos usam o guard de ambiguidade compartilhado com todos os 18 comprimentos registrados. Converter cm para mm somente com confirmação explícita já salva. Unidade ambígua impede diferença e não recebe rótulo mm. M requer técnica selecionada `modo_m` em ambos. 2D requer `2d` em ambos e a mesma vista válida (`eixo_curto` ou `eixo_longo`). A técnica selecionada para apresentação não é descrita como confirmação independente da aquisição. AE/Ao exige o mesmo método confirmado; método genérico e sueco permanecem distintos. Método `outro` não autoriza diferenças.

Diferença = atual − anterior, duas casas decimais, sem cor normal/anormal, corte diagnóstico, interpretação de evolução ou percentual. Não comparar índices normalizados, volumes, frações ou parâmetros diastólicos neste incremento. O peso por exame não existe no modelo; não usar o cadastro atual como substituto.

## Interface e resiliência

Painel opcional após as medidas no visualizador do ecocardiograma salvo, recolhido inicialmente. Abrir dispara GET independente do carregamento principal, com timeout explícito de 8 segundos. Fechar, desmontar, trocar paciente/laudo/seleção cancela a consulta. Chave da solicitação e flag de validade impedem respostas obsoletas. Validar id atual, paciente top-level e dos dois snapshots, status finalizado do anterior, datas, opções e seleção antes de renderizar medidas. Falhas mostram erro local com nova tentativa; o restante do laudo continua disponível. Estado vazio/data inválida/empate tem redação própria. Seletor manual e link para o documento original.

## Compatibilidade de espécie

Os consumidores frontend devem usar os aliases exatos do classificador compartilhado, já adotados no backend. `Dog`, `Cão`, `cães`, `Cachorro`, `Canine` e flexões suportadas recebem a mesma aplicabilidade de `Canina`. Prefixos como `CaninaXYZ` e `Caninoide` não recebem referências caninas. Preservar o texto original da espécie no formulário e no payload; nenhuma mudança de fórmula, intervalo, domínio de peso, restrição etária ou unidade. Cornell continua exclusivamente canino; o incremento não atribui índice canino a felinos.

## Critérios de aceitação

- CA-001: identidade estrita e permissão de leitura; sem dados pessoais nem escrita.
- CA-002: data explícita, candidatos finalizados anteriores, empate manual e seleção genérica segura.
- CA-003: valores imutáveis; unidade/método/vista condicionam diferenças, contexto completo preservado.
- CA-004: GET opcional, timeout, cancelamento, isolamento de falha e proteção contra resposta antiga.
- CA-005: aliases suportados e controles negativos mantêm paridade sem alterar espécie original.
- CA-006: integração no visualizador, conferência visual local e verificações técnicas.
- CA-007: teste autenticado em stage somente após autorização de publicação.

## Publicação em stage autorizada — 28/10/2026

O usuário solicitou `Deploy origin stage`. Publicar este incremento por PR de feature para `stage`, aguardar checks e workflow terminais e conferir SHA instalado, rotas e assets servidos. Preservar as demais alterações já existentes em stage e os dados de runtime. Produção não integra esta autorização. A conferência visual autenticada continua distinta dos testes automáticos e depende da disponibilidade do navegador e da sessão existente.
