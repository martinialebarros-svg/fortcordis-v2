# Spec

## Escopo

Atualizar a montagem de links do Waze usados nos cards e detalhes de agendamento.

## Requisitos

- A agenda deve carregar `latitude`, `longitude`, `numero`, `bairro` e `endereco_normalizado` da clinica ao preparar o mapa local de enderecos.
- Quando `latitude` e `longitude` forem numericas, finitas, dentro dos limites validos e diferentes de `0,0`, o Waze deve receber destino por coordenadas.
- A URL web deve usar `https://waze.com/ul?ll=<lat>,<lng>&navigate=yes`.
- A URL de aplicativo deve usar `waze://?ll=<lat>,<lng>&navigate=yes`.
- Se as coordenadas forem ausentes ou invalidas, o Waze deve usar busca textual por endereco.
- A logica compartilhada deve evitar divergencia entre agenda em lista e FullCalendar.

## Fora de escopo

- Alterar persistencia de pin manual no cadastro de clinicas.
- Alterar geocoding do Google Maps.
- Alterar calculo logistico de deslocamento.
