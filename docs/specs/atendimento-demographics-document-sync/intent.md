# Intent - atendimento-demographics-document-sync

Data: 2026-07-30
Responsavel: Codex
Status: done

## Problema

Durante o atendimento, dados visiveis no cabecalho clinico nao possuem uma
acao evidente de correcao. A complementacao cadastral permite alterar parte do
cadastro, mas nao expoe o sexo do paciente e pode enviar uma atualizacao
incompleta.

Receitas e solicitacoes de exame sao geradas por uma URL estavel. Sem uma
politica explicita contra cache, uma reimpressao pode reutilizar o PDF anterior
mesmo depois de o cadastro oficial ser corrigido.

## Resultado desejado

Permitir que a equipe corrija rapidamente paciente e tutor a partir do
cabecalho clinico, persistir os dados no cadastro oficial e garantir que toda
nova impressao ou reimpressao de receita e solicitacao de exame use nome, sexo
e tutor atuais, sem alterar o conteudo clinico ja registrado.
