# Intent - fiscal-export-ready-clinics-history

Data: 2026-08-04
Responsavel: Codex
Status: done

## 1) Problema atual

No modo multiclínica, a exportação reúne por padrão clínicas com cadastro fiscal incompleto. A validação só acontece no fim, bloqueando todo o arquivo mesmo quando o usuário queria emitir apenas para as clínicas aptas. Também não há trilha de quais relatórios foram emitidos, o que dificulta acompanhar fechamentos mensais e emissões por serviço.

## 2) Objetivo

Permitir selecionar com segurança apenas clínicas com dados fiscais completos, mostrar o valor dos serviços selecionados imediatamente e guardar um histórico auditável de cada relatório efetivamente exportado.

## 3) Não objetivos

- Emitir NFS-e perante a prefeitura ou substituir o sistema de notas fiscais.
- Corrigir automaticamente dados cadastrais incompletos.
- Impedir uma nova emissão de serviços já presentes em um relatório anterior; o histórico dá suporte à revisão humana.

## 4) Contexto e restrições

- A mesma regra de completude deve ser usada na lista, na interface e na validação final da API.
- O histórico deve registrar somente metadados fiscais e operacionais necessários à rastreabilidade, sem paciente ou tutor.
- A data e hora da emissão devem usar o fuso America/Fortaleza.

## 5) Impacto esperado

- Usuários fiscais conseguem fechar somente clínicas aptas sem refazer o lote.
- O valor do lote fica visível antes e depois de consolidar as OS.
- Fechamentos mensais e emissões conforme prestação ficam distinguíveis no histórico.

## 6) Riscos iniciais

- Divergência entre o filtro visual e a regra da API.
- Falha ao gravar o histórico após a geração do arquivo.

## 7) Perguntas abertas

- Nenhuma para a primeira entrega: os dois tipos de emissão serão registrados como metadados informativos.

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo estão claros.
- [x] Escopo e não escopo estão explícitos.
- [x] Restrições estão registradas.
- [x] Riscos iniciais estão mapeados.
