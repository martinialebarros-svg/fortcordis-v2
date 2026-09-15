# Verify - atendimento-documentos-template-categorias

Data: 2026-08-13
Responsavel: Claude (pareado com Martiniano)
Status: done

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | preview local (JS): `querySelectorAll('optgroup')` retornou 6 grupos, com `label` igual ao `tipo` de cada template ("parecer", "atestado", "declaracao", "encaminhamento", "autorizacao", "orientacoes") | ok |
| CA-002 | aceitacao | preview local: template extra ("Atestado de repouso", `tipo: "atestado"`) inserido no banco copiado; confirmado que o grupo "atestado" contem AMBOS "Atestado de saude" e "Atestado de repouso" | ok |
| CA-003 | aceitacao | preview local: selecionada programaticamente a opcao "Atestado de repouso" (dentro do grupo); `select.value` atualizou corretamente para "7" (id do template) | ok |
| CA-004 | aceitacao | preview local: ordem dos grupos no DOM = parecer, atestado, declaracao, encaminhamento, autorizacao, orientacoes - identica a ordem por `ordem` no banco (10, 20/21, 30, 40, 50, 60) | ok |
| CA-005 | aceitacao | `npx tsc --noEmit` e `npm run build` do frontend: ambos aprovados (2 rodadas - incluindo uma apos testar e reverter uma remocao de cast, ver secao 4) | ok |

## 2) Testes automatizados executados

Nao aplicavel - nao ha suite de testes de componente React no projeto
para este modulo (mesma limitacao registrada em pacotes frontend-only
anteriores).

```bash
cd frontend
npx tsc --noEmit
npm run build
```

Resumo: ambos aprovados, log limpo.

## 3) Verificacao funcional (preview local)

Worktree isolado (`atendimento-documentos-template-categorias`, branch de
`origin/stage`), banco `fortcordis.db` e `.env` copiados temporariamente
(nunca committed, removidos ao final). Backend e frontend do worktree
levantados em portas dedicadas (`8132`/`3112`). Autenticacao via
`fetch('/api/v1/auth/login', ...)` + `localStorage`.

Roteiro executado:

1. Inspecionado o banco copiado: 6 templates seed, cada um com `tipo`
   distinto. Para exercitar o cenario real do achado (templates de nomes
   parecidos do MESMO tipo), inserido diretamente no banco copiado (nunca
   commitado, removido ao final) um 7o template: "Atestado de repouso",
   `tipo: "atestado"`, `ordem: 21` (logo apos "Atestado de saude",
   `ordem: 20`).
2. Login, navegacao ate `/atendimento`, aba "Documentos".
3. Confirmado via JS (`querySelectorAll('optgroup')`): 6 `<optgroup>` no
   total; o grupo `"atestado"` contendo corretamente as 2 opcoes
   ("Atestado de saude" e "Atestado de repouso"); os demais 5 grupos com
   1 opcao cada; ordem dos grupos identica a ordem de `ordem` no backend.
4. Selecionada programaticamente a opcao "Atestado de repouso" (disparando
   `change`): confirmado que `select.value` atualizou para "7" (id
   correto).
5. Console/rede: unico erro e o pre-existente `/api/v1/alertas-internos`
   (mesma causa documentada nos pacotes anteriores #50/#30/#41);
   `GET /atendimentos/documentos/templates?include_inactive=1` retornou
   200 OK.

## 4) Revisao adversarial

Agente dedicado (general-purpose) leu o diff real (`git diff
origin/stage`) do unico arquivo alterado, cobrindo 7 checagens
especificas: corretude do agrupamento e do fallback `"Outros"`;
preservacao de `key`/`value` das options; garantia de ordem via
`Object.entries` (sem `.sort()` introduzido); ausencia de regressao no
resto do componente; confirmacao de que `criarDocumentoClinicoDeTemplate`
(que envia `template_id` direto ao backend, sem depender da estrutura do
select) nao precisou de nenhuma mudanca; validade HTML de `<optgroup>`
misturado com uma `<option>` solta no mesmo `<select>`.

**Veredito: nenhum bug real encontrado.**

O agente tambem apontou, como observacao lateral (nao classificada como
bug), que o cast `(templates as AtendimentoDocumentosSectionProps[])` no
`.map()` interno pareceria redundante, com base numa reproducao isolada
que compilou sem o cast usando `tsc --strict` "equivalente". **Essa
conclusao foi verificada e refutada**: ao remover o cast no arquivo real
do worktree e rodar `npx tsc --noEmit` com o `tsconfig.json` real do
projeto, o build falhou (`error TS18046: 'templates' is of type
'unknown'`) - a reproducao isolada do agente nao replicava exatamente a
configuracao/versao do TypeScript do projeto. O cast foi imediatamente
restaurado e o `tsc --noEmit` voltou a passar. Este e um exemplo concreto
de por que achados de revisao adversarial sao verificados no ambiente
real antes de aplicados, mesmo quando "inofensivos".

## 5) Regressao e riscos residuais

- **Risco residual 1:** nao ha runner de teste de componente React no
  projeto para este modulo - cobertura via tsc/build + preview manual com
  dados reais (incluindo um template extra inserido especificamente para
  testar o agrupamento com 2+ itens do mesmo tipo).
- **Risco residual 2:** o preview local expos um erro pre-existente e nao
  relacionado (`alertas-internos`, tabela ausente no snapshot do banco
  copiado) - documentado como nota nao-bloqueante, fora do escopo deste
  pacote.
- **Risco residual 3 (aceito, documentado em `intent.md`):** o preview do
  corpo do template (segunda parte da sugestao original do achado #44)
  permanece nao implementado, pois exigiria um endpoint novo. Registrado
  como item futuro separado, nao como debito deste pacote.

## 6) Itens fora de escopo entregues

- Nenhum.

## 7) Decisao de release

- [ ] Aprovado para stage.
- [ ] Aprovado para producao.
- [x] Pendente: aguarda autorizacao explicita para deploy (mesmo processo
  dos pacotes anteriores).
