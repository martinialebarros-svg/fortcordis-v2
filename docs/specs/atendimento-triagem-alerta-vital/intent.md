# Intent - atendimento-triagem-alerta-vital

Data: 2026-08-09
Responsavel: Claude (pareado com Martiniano)
Status: em andamento

## 1) Problema atual

GitHub issue #28 ("[UX] Triagem recolhida por padrao nao destaca sinais
vitais fora da faixa normal"), origem achado #9 da auditoria UX/fluxo
(`docs/AUDITORIA-ATENDIMENTO-UX-FLUXO-2026-08-09.md`, issue de tracking
#57): `triagemExpandida` inicia em `false` e o card de triagem
(`AtendimentoTriagemSection.tsx`) so mostra, quando recolhido, uma linha
de texto neutro fixo (`Peso - kg · FC - bpm · FR - mpm · PA -`). Mesmo
expandida, os inputs de temperatura/FC/FR/SpO2/PA nao tem faixa de
referencia aplicada.

Um vet que reabre um atendimento com um sinal claramente anormal (ex.:
FC 220 bpm) nao recebe nenhum sinal visual que force atencao - precisa
expandir manualmente e comparar de memoria contra a faixa esperada da
especie.

## 2) Objetivo

Aplicar faixas de referencia basicas por especie (canina/felina) aos
sinais vitais numericos da triagem (temperatura, FC, FR; SpO2 usa limiar
unico, sem variacao por especie) e usar essas faixas para destacar
visualmente valores fora do esperado tanto no resumo colapsado quanto
nos proprios inputs quando expandidos.

## 3) Nao objetivos

- Nao forcar a expansao automatica da triagem quando houver valor
  anormal - a sugestao da auditoria trata isso como "considerar", nao
  como requisito; manter o controle de expandir/recolher 100% manual
  evita mudar o comportamento padrao da tela alem do necessario para
  fechar a lacuna real (falta de sinal visual).
- Nao adicionar faixas de referencia para peso, pressao arterial (texto
  livre, sem faixa numerica padronizavel neste pacote), mucosas,
  hidratacao ou escore de condicao corporal.
- Nao adicionar faixas para outras especies alem de canina/felina - as
  duas unicas ja suportadas pelo cadastro de paciente
  (`AtendimentoCadastroComplementarSection`); outras especies apenas nao
  recebem o destaque (comportamento atual preservado).
- Nao mudar o endpoint/schema de triagem no backend - os valores ja sao
  numericos; a avaliacao contra faixa e 100% client-side, so para
  destaque visual.
- As faixas usadas sao valores de referencia gerais amplamente citados
  em clinica veterinaria (nao um protocolo especifico da clinica) -
  servem como sinal de atencao, nao como diagnostico.
