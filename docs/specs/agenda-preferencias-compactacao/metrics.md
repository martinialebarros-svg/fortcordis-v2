# Medição da programação da Agenda

## Objetivo e limite

Medir a evolução observada dos intervalos programados e dos registros marcados
como realizados após a publicação `fa9781901ab7fa9f2939551a01d06bec6def38c4`
(PR301, deploy concluído aproximadamente em 04/10/2026 às 17:27 UTC).
Não mede duração clínica efetiva, produtividade causal, faturamento ou capacidade
adicional garantida. Não altera registros, usa sugestões ou envia mensagens.

O coletor `scripts/agenda_efficiency_metrics.py` lê somente horários, status,
origem, identificador interno da clínica, duração do catálogo e timestamps de
criação/expiração. Não lê nomes, contatos, pacientes, tutores ou observações.
Identificadores de clínica nunca aparecem na saída. A conexão exige identidade
do projeto no hostname Supabase ou usuário do pooler, sessão PostgreSQL
`REPEATABLE READ`, `read_only=on`, timeout de 15 segundos e rollback ao terminar.
Não importa a aplicação, inicializa workers, usa APIs ou grava no servidor.

## Definições

- **Data e duração:** usa a data/hora exibida pela Agenda, preservando a duração
  persistida `fim - inicio`. Divergências são contadas. Não substitui duração
  desconhecida por 30 minutos; mantém o registro como barreira entre vizinhos.
- **Status:** mede `Agendado`, `Confirmado`, `Em atendimento`, `Realizado` e
  reservas não vencidas no snapshot. Cancelado, Expirado e Faltou ficam nas
  contagens de status, fora das lacunas/ocupação. Reservas sem vencimento são
  identificadas separadamente. `Realizado` é apenas o estado cadastrado, e
  registros com início futuro não entram na contagem de realizados observados.
- **Pares:** ordena toda a agenda de cada dia antes de conferir a mesma clínica;
  outra clínica intercalada impede a junção. Domicílios não são agrupados por
  `clinica_id`. Origem desconhecida não entra nos pares elegíveis.
- **Sobreposição:** inclui horários iguais e intervalos aninhados. Marca todos
  os eventos envolvidos, inclusive entre clínicas diferentes. Nenhum par que
  contenha um desses eventos entra na medida elegível.
- **Lacuna:** `inicio_seguinte - fim_anterior`, em minutos. Mantém contagens dos
  pares negativos separadas. A soma das lacunas positivas e o excesso por par
  acima de 5 minutos reproduzem a auditoria inicial, mas são fragmentos.
- **Folga teórica por bloco:** para cada bloco consecutivo elegível na mesma
  clínica, `max(0, soma(lacunas) - 5 × numero_de_transicoes)`. Intervalos menores
  que 5 consomem a folga do próprio bloco. Nunca soma fragmentos para anunciar
  novos atendimentos; pausas, almoço, preferências e bloqueios não estão
  reconstruídos historicamente e podem justificar intervalos.
- **Sensibilidade conservadora:** calcula os pares novamente com
  `max(duracao_persistida, catalogo_atual)`. É saída separada, não correção da
  história. A comparação principal conserva a duração persistida. Alterações
  posteriores do catálogo podem mudar apenas a sensibilidade.
- **Ocupação:** união dos intervalos, sem duplicar sobreposições, dividida pela
  soma das janelas entre primeiro início e último fim de cada dia. Dias com
  duração desconhecida não entram nessa densidade. Não é percentual da jornada
  disponível: não há histórico de expediente, bloqueios, pausas ou equipes.
- **Atendimentos por dia:** informa registros ativos por dia com agenda e por
  dia corrido; `Realizado` por dia corrido. Os zeros entram no denominador.
- **Exposição:** criação após o deploy é aproximação, não prova de uso do motor.
  Separa todos os registros criados após, ativos criados após e pares elegíveis
  em que ambos foram criados após. Timestamp sem timezone permanece desconhecido.
  Remarcações e aceites anteriores não são reconstruídos; manual e assistente
  não podem ser atribuídos automaticamente por esses campos.

## Períodos comparáveis

Todos os intervalos são `[inicio, fim)`, em Fortaleza. O mês de setembro é uma
referência separada. A comparação padrão usa quatro semanas inteiras, de segunda
a domingo, excluindo toda a semana da implantação para evitar exposição parcial:

| Janela | Datas inclusivas | Dias |
| --- | --- | --- |
| Referência histórica | 01/09 a 30/09/2026 | 30 |
| Pré comparável | 31/08 a 27/09/2026 | 28 |
| Implantação, excluída | 28/09 a 04/10/2026 | 7 |
| Pós comparável | 05/10 a 01/11/2026 | 28 |

Somente semanas pós completas entram em `post_complete_weeks`; o dia atual e
semanas incompletas não contam. O inventário futuro aparece em
`post_window_current_schedule` exclusivamente como programação. Em 02/11/2026,
00:00 Fortaleza, a janela padrão poderá estar completa; a qualidade/amostra
ainda precisará ser examinada.

`INSUFFICIENT_SAMPLE` impede diferenças antes de completar a janela ou quando
não há médias definidas nos dois períodos. Com janelas completas e médias
definidas, a diferença é apenas descritiva, com classificação
`DESCRIPTIVE_SMALL_SAMPLE` se um lado tiver menos de 20 pares elegíveis. O limiar
20 é um aviso operacional, não cálculo de poder estatístico ou significância.
No baseline existem 16 pares elegíveis, portanto esse aviso já é esperado.
Mesmo acima do limiar o resultado continua `DESCRIPTIVE_COMPARISON_ONLY`, sem
estimativa causal. As diferenças de duração persistida e de sensibilidade do
catálogo são rotuladas separadamente.

As opções `--weeks` (1–8) e `--minimum-pairs` permitem um protocolo descritivo
diferente, mas devem ser escolhidas antes de observar os resultados e mantidas
iguais nas coletas. Não reduzir o limiar apenas para obter uma classificação
favorável. Comparar também status, mix de durações, dias com agenda, demanda e
qualidade cadastral; estes fatores podem explicar mudanças observadas.

## Baseline confirmado em produção

Coleta em 04/10/2026 à noite, com saída agregada em
`evidence/metrics-baseline-2026-10-04.json`. Replica os números da auditoria
original do snapshot de código `e67f6a27`:

| Indicador | Setembro |
| --- | ---: |
| Registros totais | 177 |
| Realizado / Cancelado / Expirado / Faltou | 143 / 31 / 2 / 1 |
| Dias com registros ativos | 24 |
| Registros ativos por dia com agenda | 5,958 |
| Pares consecutivos na mesma clínica | 29 |
| Pares na mesma clínica com lacuna negativa | 9 |
| Lacunas positivas / soma de minutos | 16 / 315 |
| Soma dos excessos por par acima de 5 min | 235 min |
| Pares elegíveis, excluindo eventos sobrepostos | 16 |
| Folga teórica por blocos elegíveis | 195 min |
| Pares elegíveis na sensibilidade do catálogo atual | 15 |
| Folga teórica na sensibilidade do catálogo | 195 min |
| União de intervalos / janela entre primeiro e último | 5.515 / 9.170 min |
| Densidade dentro dessa janela | 60,142% |

Há 7 registros ativos com duração persistida diferente do catálogo atual. O
número de eventos envolvidos em qualquer sobreposição (28) não é o número de
pares negativos na mesma clínica (9): o primeiro também abrange outras
clínicas e intervalos aninhados. A diferença de 235 para 195 minutos decorre
das exclusões de sobreposição e das transições necessárias dentro dos blocos.
Esses 195 minutos não são tempo ocioso clínico comprovado ou novos exames.

A janela pré comparável tem 159 registros, dos quais 130 `Realizado`, em 22 dias
com agenda; 16 pares elegíveis com duração persistida e 15 na sensibilidade.
A folga teórica é 200 minutos na duração persistida e 195 na sensibilidade.

**Resultado pós atual: amostra insuficiente.** Ainda não há dia da janela pós
completo, nem semanas completas. A programação futura contém 30 registros
(27 ativos), incluindo 3 ativos criados após o deploy; não há par elegível
com ambos criados após. Isto não comprova ganho ou ausência de ganho do motor.
`causal_gain`, `additional_appointments_claimed` e as diferenças permanecem nulos.

## Reexecução sem arquivo no servidor

Na estação autorizada, no root do checkout:

```sh
ssh -i "$HOME/.ssh/codex_fortcordis_prod_20260603" \
  -o IdentitiesOnly=yes -o BatchMode=yes martiniano@216.238.116.77 \
  'cd /var/www/fortcordis-v2/backend && PYTHONDONTWRITEBYTECODE=1 venv/bin/python - --env-file /var/www/fortcordis-v2/backend/.env --expected-database-ref wycxoueogfxdhyouhfhw --release-finished-at 2026-10-04T17:27:00+00:00' \
  < scripts/agenda_efficiency_metrics.py \
  > /tmp/fortcordis-agenda-efficiency.json
```

O `.env` fica no host; sua URL/chave não é impressa ou copiada. O identificador
público do projeto serve apenas como guarda de ambiente. Falha de leitura,
identidade ou limite encerra com código 1, sem imprimir exceção com credenciais.
Código 0 significa coleta válida, inclusive quando `INSUFFICIENT_SAMPLE`.
Executar apenas quando autorizado; não há monitor/automação ou envio externo.
Datas/status existentes podem mudar: guardar cada JSON agregado com timestamp
preserva a evidência original, mas não congela o banco nem reconstitui o passado.

Testes sintéticos, sem rede ou banco real:

```sh
python3 -m unittest discover -s scripts/tests -p 'test_agenda_efficiency_metrics.py' -v
python3 -m py_compile scripts/agenda_efficiency_metrics.py
```

20 testes cobrem 40/5, transição zero, sobreposições aninhadas, clínicas
intercaladas, dados incompletos, catálogo versus história, futuro versus
observado, criação aproximada, privacidade, identidade e rollback/read-only.
