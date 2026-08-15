# Intent - clinic-full-catalog-loading

Data: 2026-07-05  
Responsavel: Codex  
Status: done

## 1) Contexto

As telas administrativas que carregam clinicas para busca local dependiam do limite padrao de `GET /clinicas`, hoje `100`. Em stage isso passava despercebido porque a base e menor, mas em producao a busca deixava de encontrar clinicas posicionadas depois do primeiro lote retornado pela API.

## 2) Problema

- `/clinicas` exibia e filtrava apenas as 100 primeiras clinicas ativas.
- Formularios que usam seletor local de clinicas, como `Laudos` e `Ultrassonografia Abdominal`, tambem ficavam limitados ao primeiro lote quando consultavam `/clinicas` sem paginacao explicita.

## 3) Objetivo

Garantir que telas com busca local em memoria carreguem o catalogo completo de clinicas ativas, mesmo quando a base de producao tiver mais de 100 registros.

## 4) Nao objetivos

- Alterar o contrato do endpoint `GET /clinicas`.
- Introduzir busca remota digitando no backend para esse fluxo.
- Mudar o comportamento de telas que ja usam `limit` explicito adequado para o proprio caso.
