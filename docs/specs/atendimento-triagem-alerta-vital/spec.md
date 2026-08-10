# Spec - atendimento-triagem-alerta-vital

Data: 2026-08-09
Responsavel: Claude (pareado com Martiniano)
Status: em andamento

## 1) Escopo funcional

Mudanca aditiva de frontend: novo utilitario de faixas de referencia de
sinais vitais e destaque visual condicional na `AtendimentoTriagemSection`.

## 2) Requisitos funcionais (RF)

- RF-1: novo modulo `frontend/lib/vital-signs-reference.ts` com 4 funcoes
  puras: `avaliarTemperatura`, `avaliarFrequenciaCardiaca`,
  `avaliarFrequenciaRespiratoria` (recebem valor + especie, retornam
  `"baixo" | "alto" | null`) e `avaliarSaturacaoOxigenio` (recebe so o
  valor, limiar unico). Retornam `null` quando o valor e nulo/vazio ou a
  especie nao e reconhecida (`Canina`/`Felina`) - sem falso positivo para
  especies nao suportadas ou dado ausente.
- RF-2: `AtendimentoTriagemSection` recebe a nova prop `especieExibicao`
  (string ou null, ja calculada em `page.tsx`) e usa as 4 funcoes para
  avaliar `form.triagem.{temperatura,frequencia_cardiaca,
  frequencia_respiratoria,saturacao_oxigenio}`.
- RF-3: quando expandida, cada input com valor fora da faixa recebe
  estilo de alerta (borda/fundo amber) e um badge `BAIXO`/`ALTO` ao lado
  do label. Inputs dentro da faixa (ou sem avaliacao possivel) mantem o
  estilo neutro atual.
- RF-4: quando recolhida, se ao menos um dos 4 sinais estiver fora da
  faixa, o resumo troca de neutro (cinza) para alerta (amber, com icone
  de atencao); sem nenhum sinal fora da faixa, o resumo permanece neutro
  como hoje.

## 3) Requisitos nao funcionais (NFR)

- NFR-A (sem falso positivo): paciente sem especie reconhecida, ou campo
  vazio, nunca recebe destaque de alerta.
- NFR-B (nao regressao): comportamento de expandir/recolher, edicao dos
  campos e demais selects/textarea da triagem inalterados.
- NFR-C (compatibilidade): nenhuma mudanca de contrato de API/backend.

## 4) Contratos tecnicos

Nenhuma migration, nenhum endpoint novo. Mudanca 100% frontend.

## 5) Compatibilidade e rollout

- Backward compatibility: sim - so adiciona destaque visual quando
  aplicavel; nenhum dado ou fluxo existente muda.
- Rollback: reverter o commit (sem estado persistido).

## 6) Criterios de aceitacao (CA)

- CA-1: paciente canino com FC = 220 (fora de 60-140) -> resumo
  colapsado em amber com icone de atencao; expandido, input de FC com
  borda/fundo amber e badge "ALTO".
- CA-2: mesmo paciente, temperatura = 38.5 (dentro de 37.5-39.2) -> sem
  destaque no input de temperatura.
- CA-3: paciente sem especie reconhecida (nao canina/felina) com
  qualquer valor de FC/temperatura/FR -> nenhum destaque (SpO2 continua
  avaliado, pois nao depende de especie).
- CA-4: nenhum valor preenchido -> nenhum destaque, resumo colapsado
  neutro como antes.
- CA-5: `npx tsc --noEmit` e `npm run build` sem erros novos.
