# Especificacao — isolamento de workers

## Papeis de processo

`FORTCORDIS_PROCESS_ROLE` aceita somente `all`, `api` ou `worker`.

- `all` e o padrao local: a aplicacao FastAPI mantem o comportamento existente
  e inicia os trabalhos em segundo plano.
- `api` impede a inicializacao e a parada de workers no ciclo de vida HTTP.
- `worker` e usado pelo executavel `python -m app.worker`, que valida o runtime,
  inicia os jobs e aguarda sinal de parada.

## Trabalhos transferidos

O processo dedicado retoma os jobs persistidos de PDFs, XML, estudos ECO e IA
incompletos; tambem executa limpeza de deduplicacao, push, lembretes e bot de
WhatsApp, missoes da Mente e limpeza de IA por voz.

## Implantacao

O script de deploy deve criar e habilitar `<backend>-worker.service`, escrever
um `drop-in` na unidade HTTP para fixar `FORTCORDIS_PROCESS_ROLE=api` e somente
entao reiniciar API e worker. O deploy falha se o worker nao estiver `active`.
Quando a unidade HTTP declara `User` e/ou `Group`, a unidade de worker herda os
mesmos valores para nao ampliar privilegios.

O rollback para uma revisao anterior a esta funcionalidade remove esses dois
artefatos antes de reiniciar a API, restaurando o modo integrado anterior.

## Observabilidade

O endpoint de saude da API informa o papel do processo e se os workers sao
gerenciados externamente. Nessa situacao, a ausencia de threads no processo
HTTP nao deve gerar alerta enganoso; a disponibilidade do worker e confirmada
pelo `systemctl` no deploy. Os gates de runtime e canario autenticado devem
preservar a validacao de threads apenas quando
`background_workers_managed_externally=false`.
