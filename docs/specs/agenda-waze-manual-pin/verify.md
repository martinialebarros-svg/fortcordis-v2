# Verify

## Verificacoes executadas

- `npx eslint app/agenda/page.tsx app/agenda/fullcalendar/page.tsx lib/waze.ts --max-warnings=0`
- `npm run build`
- `git diff --check -- frontend/lib/waze.ts frontend/app/agenda/page.tsx frontend/app/agenda/fullcalendar/page.tsx`

## Casos cobertos

- Clinica com pin manual salvo em latitude/longitude gera link do Waze por `ll`.
- Clinica sem coordenadas validas ainda gera link por endereco textual.
- Agenda em lista e FullCalendar usam a mesma regra.

## Observacao

`npm run lint` completo ainda falha por erro preexistente em `frontend/public/sw.js:57`, fora do escopo desta correcao.
