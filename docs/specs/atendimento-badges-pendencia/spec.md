# Spec - atendimento-badges-pendencia

Data: 2026-08-11
Responsavel: Claude (pareado com Martiniano)
Status: em andamento

## 1) Comportamento esperado

- `workspaceCards` (`page.tsx`) ganha um campo opcional `pendente?:
  boolean` por card.
- Card "Exames": `pendente = examesPendentesCount > 0`, onde
  `examesPendentesCount = resumoExamesFluxo.aguardando_arquivo +
  resumoExamesFluxo.arquivo_anexado`.
- Card "Prescricao": `pendente = prescricaoErrosCount > 0`.
- Cards "Consulta" e "Documentos": `pendente` omitido (sempre falso).
- No render do badge (`fc-care-tab-badge`), quando `item.pendente` for
  `true`:
  - Classe adicional `fc-care-tab-badge-alert` (fundo `amber-500`,
    texto branco) - visivel tanto na aba ativa quanto inativa.
  - Atributo `title="Ha pendencia real nesta area"` para leitores de
    tela / tooltip.
- Numero exibido no badge continua o mesmo (contagem bruta) - so a cor
  muda.

## 2) Casos de borda

- Exame com `tipo_exame` vazio (linha em edicao, ainda nao
  "solicitado"): nao entra em `resumoExamesFluxo` (filtro existente
  `if (!(item.exame.tipo_exame || "").trim()) return;`), logo nao
  aciona alerta - comportamento inalterado.
- Exame marcado para exclusao (`_destroy`): idem, ja filtrado por
  `resumoExamesFluxo`.
- Prescricao sem itens ativos (`prescricaoErrosCount === 0` por
  definicao, pois nunca foi setado por uma tentativa de salvar
  invalida): badge permanece neutro.
- Erros de prescricao so aparecem apos uma tentativa de "Salvar
  atendimento" com itens incompletos (ver `executarSaveAtendimento`,
  `page.tsx` ~3957) - o badge amber persiste mesmo depois do vet
  navegar para outra aba, funcionando como lembrete visual continuo,
  nao so um alerta pontual no momento do erro.

## 3) Fora de escopo

- Nao adiciona filtro/ordenacao por pendencia na lista de exames (isso
  ja existe via `EXAME_FILTRO_OPCOES`).
- Nao adiciona contador separado de "pendentes" no badge (ex.: "3 (2
  pendentes)") - a auditoria pede so diferenciacao de cor, mantendo o
  numero simples.
