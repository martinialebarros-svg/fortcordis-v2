# Verify - agenda-reserva-mensagem-edicao

Data: 2026-08-07
Responsavel: Martiniano + Claude
Status: in-progress

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | Leitura de codigo: `formData.marcar_como_reserva` (inicializado de `agendamento.status === "Reservado"` na abertura em edicao) agora controla a exibicao do bloco em `NovoAgendamentoModal.tsx`. Nao clicado em navegador real (sem login/dados de stage neste ambiente). | pendente (QA manual) |
| CA-002 | aceitacao | Leitura de codigo: `gerarMensagemManualEdicao` chama `construirMensagemAgendaPosCriacao`, que le `pacienteSelecionadoMensagem`/`nomeTutorReservaManual` a partir do `formData` atual — mesmos campos preenchidos ao selecionar paciente/tutor no formulario. Nao clicado em navegador real. | pendente (QA manual) |
| CA-003 | aceitacao | Leitura de codigo + tsc/eslint: X e botao secundario agora fazem `isEditando ? setMensagemAgendaCriada(null) : onClose()`, o que preserva `formData` (nenhum reset associado a esse estado). Nao clicado em navegador real. | pendente (QA manual) |
| CA-004 | aceitacao | Leitura de codigo: bloco inteiro condicionado a `!isEditando \|\| formData.marcar_como_reserva`; para agendamento nao-reserva em edicao, `formData.marcar_como_reserva` e `false` e o bloco nao renderiza. | ok (logica) |
| CA-005 | aceitacao | Leitura de codigo: ramo `!isEditando` de ambos os botoes de fechamento permanece `onClose()`, igual ao comportamento anterior. | ok (logica) |
| NFR-001 | nao funcional | Geracao e local/sincrona (mesma funcao usada hoje na criacao); sem chamada de rede nova. | ok |
| NFR-002 | nao funcional | Nenhum novo dado exposto; mesma leitura de `formData`/listas ja carregadas para quem edita o agendamento. | ok |

## 2) Testes automatizados executados

Comandos (em `frontend/`):

```bash
npm install
npx tsc --noEmit -p tsconfig.json
npx eslint app/agenda/NovoAgendamentoModal.tsx
npm run test
```

Resumo dos resultados:
- `tsc --noEmit`: sem erros.
- `eslint` no arquivo alterado: sem erros/avisos.
- `npm run test` (vitest + node --test): 3 suites vitest / 22 testes — todos ok. 2 suites do
  runner nativo (`lib/api-error.test.ts`, `lib/atendimento-form-merge.test.ts`) falham por
  `ERR_MODULE_NOT_FOUND` ao resolver import sem extensao — falha pre-existente de configuracao do
  `node --test` neste ambiente, **nao relacionada a esta mudanca** (arquivos nao tocados neste
  diff; git status confirma que so `NovoAgendamentoModal.tsx` foi alterado).
- Boot do `next dev` local + `GET /agenda` retornou 200, HTML sem marcadores de erro
  (`Internal Server Error` / `Application error` / `Unhandled Runtime Error`) — confirma que o
  componente compila e renderiza no runtime do Next, mesmo sem autenticacao.

## 3) Testes manuais

- **Nao executados neste ambiente**: este sandbox nao tem backend/DB/autenticacao configurados
  (sem `.env`, sem Postgres/Supabase acessivel), portanto nao foi possivel logar, abrir um
  agendamento real com status "Reservado" e clicar nos botoes fim a fim.
- Pendente para quem revisar (local ou stage): abrir um agendamento "Reservado" com dados de
  paciente/tutor pendentes, preencher os dados, clicar em "Gerar mensagem de confirmacao" e
  confirmar que a mensagem mostra os dados preenchidos; clicar em "Voltar ao formulario" e
  confirmar que os campos preenchidos continuam la; clicar em "Salvar Alteracoes" normalmente
  depois.

## 4) Regressao e riscos residuais

- Risco residual 1: os 5 CAs foram verificados por leitura de codigo/tipagem, nao por clique real
  em navegador autenticado — recomenda-se QA manual (checklist acima) antes ou logo depois do
  merge/deploy em stage.
- Risco residual 2: nenhum teste automatizado cobre especificamente este componente (nao existia
  suite previa para `NovoAgendamentoModal.tsx`); regressao futura no arquivo pode nao ser
  detectada por CI.

## 5) Itens fora de escopo entregues

- Nenhum.

## 6) Decisao de release

- [ ] Aprovado para stage.
- [ ] Aprovado para producao.
- [x] Nao aprovado ainda — pendente de QA manual com dados reais (ver secao 3) antes do deploy.
