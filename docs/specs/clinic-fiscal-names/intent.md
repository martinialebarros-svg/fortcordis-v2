# Intent - clinic-fiscal-names

Data: 2026-05-03  
Responsavel: Codex  
Status: done

## Contexto

O modulo fiscal ja usa `clinicas.razao_social` como nome do tomador quando o dado existe, mas o cadastro de clinicas no frontend nao expunha esse campo. Isso fazia com que novas clinicas criadas pela tela completa ou pelo cadastro rapido da agenda chegassem ao fiscal apenas com `nome`, que na pratica representa o nome fantasia.

## Objetivo

Expor "Nome Fantasia" e "Razao Social" no cadastro de clinicas sem alterar o contrato de backend existente. O campo `nome` permanece como nome fantasia para preservar compatibilidade com agenda, relatorios, logistica e fiscal; `razao_social` passa a ser preenchido pela UI e usado pelo fiscal como fallback preferencial ja existente.

## Nao objetivos

- Criar coluna `nome_fantasia`.
- Tornar razao social obrigatoria.
- Alterar emissao/exportacao fiscal alem de alimentar o dado cadastral ja consumido.
