# Intent

Corrigir o link do Waze exibido nos agendamentos para usar o pin manual confirmado na clinica.

## Contexto

Quando a geolocalizacao do Google Maps era ajustada manualmente no cadastro da clinica, a agenda ainda abria o Waze usando uma busca textual por endereco. Isso podia levar o usuario ao ponto original do endereco, e nao ao pin corrigido.

## Resultado esperado

- Links do Waze na agenda devem priorizar latitude/longitude salvas na clinica.
- Se a clinica nao tiver coordenadas validas, o link deve continuar funcionando por endereco como fallback.
- A correcao deve valer para a agenda em lista e para a agenda FullCalendar.
