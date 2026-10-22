# Plan - Revisão da apresentação do laudo ecocardiográfico

## Incremento 2026-10-15: coerência da narrativa com fusão felina

1. Reaproveitar os avisos numéricos existentes e acrescentar regras determinísticas conservadoras para afirmações transmitrais/teciduais incompatíveis com fusão explicitamente confirmada. Localizar o trecho e oferecer sugestão revisável, sem escrever no laudo.
2. Exibir o mesmo painel compacto em Medidas/Diastólica, Qualitativa e prévia salva, usando espécie e texto efetivamente destinados ao PDF; manter invisível quando não há conflito.
3. Cobrir aliases, fusões independentes, frases negadas/limitadas, conclusão multiparamétrica preservada, valores de estresse isolados e atualização após aplicar/corrigir presets. Preservar medidas, texto, conclusão, catálogo e salvamento.
4. Validar testes focados, tipos, lint, build e SDD; publicar em stage pelo fluxo protegido, conferir UI autenticada e PDF sintético. Produção exige autorização posterior. Rollback: reverter o incremento de avisos, sem migração ou alteração clínica persistida.
5. Em 21/10/2026, com a homologação de stage concluída e autorização de produção, promover somente os 13 arquivos clínicos sobre o main atual, pela exceção de PR isolada prevista no runbook. Manter os seis checks, acompanhar o deploy terminal, conferir a preservação de runtime e os arquivos servidos. Reintegrar imediatamente a documentação em stage sem sobrescrever as entregas paralelas de autenticação e Maps; o código clínico já é idêntico em stage.
6. Corrigir os dois P2 da PR #410 em branch de stage: testes reproduzem a ausência de aviso para picos E/A individuais e a supressão por negação alheia, depois comprovam qualificação local e preservação das ressalvas. Reintegrar também a documentação da promoção anterior. Aguardar o deploy de Auth terminar antes da promoção corretiva e conferir a versão efetivamente instalada; merge ou run cancelado não comprovam publicação.
7. Em 22/10/2026, corrigir o qualificador inicial restante com escopo adjacente/familiar, integrar o stage atual preservando as entregas paralelas e corrigir o pin de SHA do deploy. Publicar em stage pelo PR #413, acompanhar os gates até o fim e conferir SHA/arquivos servidos/UI sintética. A produção fica para depois da homologação de stage. Rollback clínico: reverter somente o helper/painel; não regravar laudos nem presets.

1. Organizar a prévia por grupos do PDF e mostrar rótulos, unidades e faixas selecionadas por espécie/peso.
2. Aplicar na prévia a mesma normalização de comprimentos e DIVEd normalizado usada pelo PDF, com aviso quando o valor persistido divergir.
3. Separar linhas de agenda reconhecidas das observações clínicas na prévia.
4. No PDF, apresentar a conclusão já escrita antes das tabelas, omitir parâmetros não registrados e retirar faixas fixas legadas quando não houver faixa na referência selecionada.
5. Validar casos de referência incompleta, ausência de peso, modo M/2D, dados legados em cm, divergência do valor normalizado e PDF renderizado.
6. Oferecer legenda opcional para imagens temporárias e persistidas usando o campo existente, com confirmação da configuração antes do salvamento do laudo.
7. Transportar ordem e legenda da imagem selecionada ao PDF, numerar as imagens, escapar texto de legenda e invalidar o cache quando a descrição muda.
8. Validar persistência restrita à sessão/laudo, compatibilidade de imagens sem legenda e disposição visual com seis imagens.
9. Ler os blocos qualitativos até o próximo campo conhecido ou seção, mantendo todos os itens redigidos; usar a mesma regra na prévia, na edição e nas duas rotas de PDF.
10. Conferir um exemplo sintético com medidas moderadas: evitar assinatura isolada entre narrativa e imagens e manter a última avaliação qualitativa com a assinatura quando não há imagens.
11. Auditar a fonte das faixas auxiliares, retirar o fallback de MAPSE que tratava intervalo de confiança da média como faixa individual e limitar o fallback de TAPSE aos pesos tabulados de 3 a 45 kg.
12. Resolver faixas por política de proveniência versionada, preservar limites brutos e pedir confirmação do método apenas para TAPSE e AE/Ao felino quando registrados.
13. Suspender comparações sem suporte reconciliado de Vmax e dos padrões legados diastólicos; separar o intervalo ponderal de AE/Ao do limiar clínico geral e aplicar limites de cobertura/peso.
14. Validar importação antes da substituição do catálogo, testar persistência/invalidação do método e igualdade entre formulário, prévia, contexto da IA e PDF; publicar o incremento em stage para revisão.
15. No cálculo de AE/Ao, rastrear a origem transitória da razão para limpar resultados derivados quando seus componentes forem removidos, preservando razões importadas independentes; validar novo/editar e repetir o caso sintético em stage.
16. Apresentar o limite clínico canino `<1,60` apenas com aquisição 2D/eixo curto/diástole inicial confirmada, independente da linha ponderal; identificar método na tabela e trabalhos primários na bibliografia, atualizar cache eco e verificar PDF renderizado. Preservar a política felina e os dados históricos.
17. Identificar o método sueco por uma seleção explícita distinta da confirmação genérica; citar Hansson 2002 como fonte da técnica e separar a origem do limite clínico. Validar persistência, nota/bibliografia condicional, renderização e publicação autorizada em stage.
# Incremento 2026-10-14: consulta diastólica felina

1. Conferir tabelas e métodos primários; separar média ± DP, percentis amostrais e limiares diagnósticos. Priorizar fonte lateral PW explícita de 2020; manter nota de população da fonte septal pequena.
2. Acrescentar metadados de aquisição e fusão por família no dicionário existente, sem migração ou modificação do catálogo. Dois pares compactos de seletores condicionais; nenhum estado pré-inferido.
3. Aplicar os mesmos dados/regras em Referências, prévia, PDF e contexto seguro da IA. Preservar valores e conclusão, suspender a consulta individual de ondas fundidas e novos cálculos até a separação explícita ser confirmada.
4. Testar casos separados/fundidos, sítios, marcos de TRIV, unidades, persistência e invalidação de origem; renderizar PDFs sintéticos. Alinhar spec/verify, revisar diff e guardrail SDD.
5. Preparar o resultado local para publicação posterior no ambiente solicitado; preservar a aba real de Skar em elaboração.

## Correção da paginação após QA de stage (2026-10-14)

1. Preservar evidência de stage #52 com referências corretas e bloco diastólico indevidamente movido para a página seguinte.
2. Permitir continuação por linhas somente do bloco diastólico felino de consulta e repetir os cabeçalhos da tabela; manter outros grupos e conteúdo clínico.
3. Regressão com logo/assinatura/conclusão longa, renderização local, novo cache eco v20 e publicação autorizada de correção em stage.
4. Rebaixar os dois estados do teste #52, inspecionar páginas e registrar resultado; produção fora do escopo.
