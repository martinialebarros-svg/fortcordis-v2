# Verify - atendimento-protocolo-previa

Data: 2026-08-12
Responsavel: Claude (pareado com Martiniano)
Status: done

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | preview local: queixa "Paciente com ICC e edema pulmonar..." abriu automaticamente a previa de "ICC compensada" com "Gatilho identificado no diagnostico: \"icc\"" | ok |
| CA-002 | aceitacao | previa mostrou Furosemida/Pimobendan/Espironolactona (frequencia/duracao/via/instrucoes) + orientacoes + retorno, e a contagem de itens da prescricao permaneceu em 2 (inalterada) enquanto a previa estava aberta | ok |
| CA-003 | aceitacao | "Descartar" fechou a previa (contagem de itens permaneceu 2); apos o descarte, a previa nao reapareceu no mesmo diagnostico | ok |
| CA-004 | aceitacao | reselecionar o chip "ICC compensada" reabriu a previa; "Aplicar protocolo" fechou a previa e a contagem de itens da prescricao subiu de 2 para 5, com "Furosemida" presente nos campos do formulario | ok |
| CA-005 | aceitacao | selecionar "Endocardiose B1" (sem gatilho no diagnostico atual) mostrou "Selecionado manualmente - nenhum gatilho do diagnostico atual casou com este protocolo." | ok |
| CA-006 | aceitacao | verificado por leitura de codigo (revisao adversarial): `protocoloPrescricaoDecididoPara` so e gravado quando o protocolo fechado e o recomendado; fechar uma selecao manual nao afeta a recomendacao | ok |
| CA-007 | aceitacao | `npx tsc --noEmit` e `npm run build` do frontend: ambos aprovados (2 rodadas, apos ajuste dos resets) | ok |

## 2) Testes automatizados executados

Nao aplicavel - nao ha suite de testes de componente React no projeto para
este modulo (mesma limitacao registrada em pacotes frontend-only
anteriores).

```bash
cd frontend
npx tsc --noEmit
npm run build
```

Resumo: ambos aprovados, log limpo.

## 3) Verificacao funcional (preview local)

Worktree isolado (`atendimento-protocolo-previa`, branch de `origin/stage`),
banco `fortcordis.db` e `.env` copiados temporariamente (nunca committed,
removidos ao final). Backend e frontend do worktree levantados em portas
dedicadas (`8125`/`3105`). Autenticacao via `fetch('/api/v1/auth/login',
...)` + `localStorage`. Navegacao via `?atendimento_id=1`.

Roteiro executado via DOM/eventos reais (setter nativo de `value` +
`dispatchEvent`, nao apenas leitura visual):

1. Preenchida a queixa principal com "Paciente com ICC e edema pulmonar -
   avaliar terapia."
2. Aberta a aba Prescricao - a previa do protocolo "ICC compensada" abriu
   automaticamente, mostrando o gatilho "icc" e os 3 itens (Furosemida,
   Pimobendan, Espironolactona) com frequencia/duracao/via, a instrucao
   de Furosemida, as orientacoes padrao e o retorno sugerido (7 dias).
3. Clicado "Descartar" - previa fechou, contagem de itens da prescricao
   permaneceu em 2 (nenhuma mudanca no formulario), e a previa nao
   reapareceu no mesmo diagnostico.
4. Clicado novamente no chip "ICC compensada" - previa reabriu.
5. Clicado "Aplicar protocolo" - previa fechou, contagem de itens da
   prescricao subiu para 5, com "Furosemida" presente nos valores dos
   campos do formulario (confirmando a insercao real).
6. Clicado no chip "Endocardiose B1" (sem gatilho no diagnostico atual) -
   previa mostrou a mensagem de selecao manual sem gatilho.

## 4) Revisao adversarial

Agente dedicado (general-purpose) leu o diff real (`git diff origin/stage`)
de `page.tsx` e `AtendimentoPrescricaoWorkspace.tsx`, cobrindo 8 checagens
especificas: fidelidade da previa (mesma funcao de geracao de item usada na
aplicacao real); corretude do toggle no chip; escopo correto de
`protocoloPrescricaoDecididoPara` (so gravado para o protocolo
recomendado); ausencia de loop de re-render no efeito de auto-selecao;
completude dos 3 resets; corretude da passagem de props entre `page.tsx` e
o componente filho (incluindo confirmar que `aplicarProtocoloPrescricao`
removida das props nao deixou referencia pendente no componente filho);
corretude de tipos.

**Veredito: nenhum bug real encontrado.** Todas as 8 checagens passaram
(a primeira tentativa de revisão sofreu uma queda de conexão da API sem
gerar relatorio; a segunda tentativa, idêntica, completou normalmente).

## 5) Regressao e riscos residuais

- **Risco residual 1:** `protocoloPrescricaoDecididoPara` faz comparacao
  exata de string contra `diagnosticoTextoConsolidado` - qualquer edicao no
  texto de diagnostico depois de um descarte faz a recomendacao poder
  reaparecer (inclusive para o mesmo protocolo, se o novo texto ainda
  casar). Comportamento documentado e intencional (ver `intent.md`, secao
  4) - nao e um bug, e o design deliberado (decisao vale para aquele texto
  exato, nao para o protocolo indefinidamente).
- **Risco residual 2:** a previa proativa (sem exigir clique) pode nao ser
  percebida por todos os vets como "so uma sugestao, nada foi aplicado
  ainda" na primeira vez que aparecer - mitigado pelos rotulos explicitos
  "Previa do protocolo" e pelos dois botoes claramente nomeados
  ("Aplicar protocolo"/"Descartar"), mas sem dado de uso real para
  confirmar a percepcao.
- **Risco residual 3:** nao ha runner de teste de componente React no
  projeto para este modulo - cobertura via tsc/build + preview manual,
  mesmo padrao dos pacotes frontend-only anteriores.

## 6) Itens fora de escopo entregues

- Nenhum.

## 7) Decisao de release

- [ ] Aprovado para stage.
- [ ] Aprovado para producao.
- [x] Pendente: aguarda autorizacao explicita para deploy (mesmo processo
  dos pacotes anteriores).
