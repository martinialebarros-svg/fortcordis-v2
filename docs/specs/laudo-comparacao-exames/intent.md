# Intent — Comparação com exames anteriores

## Problema e autorização

Após a entrega de referências e coerência, o usuário escolheu comparar exames anteriores do mesmo paciente e autorizou prosseguir. Abrir cada documento manualmente dificulta conferir valores registrados. A comparação deve ser opcional e não acrescentar etapas à emissão.

## Resultado esperado

No visualizador de um ecocardiograma salvo, consultar um exame anterior finalizado pelo identificador do paciente e pela data de aquisição. Exibir dimensões do VE e AE/Ao lado a lado, com diferenças aritméticas somente quando as unidades e os métodos registrados forem compatíveis. Preservar a interpretação do veterinário.

## Limites

Implementação e validação locais. Publicação exige pedido específico. Sem migração, diagnóstico, redação automática, alteração de dados clínicos, bibliografia, presets ou PDF. Não usar nomes como identidade nem o peso atual como peso histórico. O modelo não armazena o peso por exame; índices dependentes desse peso ficam fora deste incremento.

Em 28/10/2026, após a validação local, o usuário autorizou `Deploy origin stage`. A entrega inclui agora commit, PR para stage, checks terminais, deployment e smoke do ambiente. Produção continua fora do escopo.
