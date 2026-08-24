# Verify - whatsapp-bot-piloto-por-clinica

Data: 2026-08-24
Responsavel: Martiniano + Claude
Status: Fase 1 (schema) entregue; Fases 2-4 pendentes

## Matriz de rastreabilidade

| ID | Tipo | Evidencia planejada | Status |
| --- | --- | --- | --- |
| CA-P01 | aceitacao | postura `todos`, clinica sem linha -> modo institucional, identico a hoje | pendente |
| CA-P02 | aceitacao | postura `piloto`, clinica sem linha -> `suppressed`/`fora_do_piloto`, provider nao chamado | pendente |
| CA-P03 | aceitacao | postura `piloto`, clinica `suggest` -> rascunho normal | pendente |
| CA-P04 | aceitacao | clinica `off` explicito -> `suppressed`/`clinica_desabilitada` mesmo com postura `todos` | pendente |
| CA-P05 | aceitacao | modo por conversa vence o por clinica, nas duas direcoes | pendente |
| CA-P06 | aceitacao | postura `piloto`, tutor sem opt-in -> `fora_do_piloto`; com opt-in -> gera | pendente |
| CA-P07 | aceitacao | migracao idempotente, default `todos` | ok — `test_whatsapp_bot_piloto_migration.test_upgrade_cria_tabela_e_e_idempotente` (aplicada duas vezes em sequencia) + `test_participacao_nasce_todos_e_preserva_comportamento` |
| CA-P08 | aceitacao | `PUT /configuracoes` 403 para nao admin, 422 para valor invalido | pendente |
| CA-P09 | aceitacao | provider fake que falha se chamado, nos caminhos barrados | pendente |
| CB-P01 | borda | `ambiguous` entre clinicas -> `handoff`/`identidade_nao_resolvida`, sem inventar participacao | pendente |
| CB-P02 | borda | clinica inativa com linha habilitada nao volta a ser atendida | pendente |
| CB-P03 | borda | voltar de `piloto` para `todos` preserva os `off` explicitos | pendente |
| CB-P04 | borda | remocao da clinica remove a linha de participacao (cascade) | pendente |
| NFR-P01 | nao funcional | ok — coluna nasce `todos` (inclusive em linha que ja existia, via UPDATE explicito: default de coluna nao preenche linha antiga em todo dialeto) e a tabela nasce vazia. Suite completa 1044/1044 sem alterar nenhuma expectativa existente |
| NFR-P02 | nao funcional | caminho barrado nao chama LLM nem tools de dado | pendente |
| NFR-P03 | nao funcional | ok — `20260824_76` aplicada duas vezes em cada teste, e `no-op` sem `configuracoes` coberto por `test_no_op_sem_configuracoes` |
| NFR-P04 | nao funcional | motivo gravado sem nome de clinica e sem telefone | pendente |

## Testes automatizados a executar

```bash
cd backend
venv/bin/python -m unittest tests.test_whatsapp_bot_piloto_clinica -v
venv/bin/python -m unittest tests.test_whatsapp_bot_gates -v
venv/bin/python -m unittest tests.test_whatsapp_bot_generation -v
venv/bin/python -m unittest tests.test_configuracoes_autorizacao -v
venv/bin/python -m unittest discover -s tests -p "test_*.py"

cd ../frontend
npx vitest run
./node_modules/.bin/eslint app/configuracoes/page.tsx --max-warnings=0
npx tsc --noEmit && npm run build
```

Baseline no momento em que esta spec foi escrita: backend **1040/1040**,
frontend **98/98**.

## Resumo dos resultados (Fase 1, 2026-08-24)

- Migracao `20260824_76_whatsapp_bot_piloto_clinica.py`, no padrao de helpers
  locais por arquivo das migracoes 72-75.
- `test_whatsapp_bot_piloto_migration` (4/4): idempotencia, unicidade de
  `clinica_id`, default `todos` em linha preexistente, e no-op sem
  `configuracoes`.
- Suite completa **1044/1044** (era 1040), sem alterar nenhuma expectativa
  existente — a feature e inerte ate ser ligada.
- **Aplicada de verdade**, nao so em teste: `setup_database.py` num sqlite novo
  criou a tabela e a coluna (`whatsapp_bot_clinica_estado` presente,
  `configuracoes.whatsapp_bot_participacao` presente).
- Modelos `WhatsAppBotClinicaEstado` e a coluna em `Configuracao` adicionados.
  Nada e lido em runtime ainda: resolucao de modo e portao sao a Fase 2.

Decisao de schema registrada: FK `ON DELETE CASCADE` (CB-P04). Participacao de
clinica que nao existe mais nao tem sentido, e restringir a exclusao faria o
cadastro de clinicas depender de uma tabela do bot.

## Testes manuais planejados (stage)

1. Postura `todos` com tudo como esta: nenhuma mudanca de comportamento.
2. Virar para `piloto` sem habilitar ninguem: toda conversa vira
   `fora_do_piloto`, e o preview confirma zero geracao.
3. Habilitar uma clinica em `suggest` e mandar mensagem real por ela: rascunho
   aparece na central.
4. Desabilitar a mesma clinica durante trafego: proximo job vira
   `clinica_desabilitada`, sem restart.
5. Conversa `off` dentro de clinica habilitada: nao responde.
6. Tutor sem opt-in durante o piloto: nao responde.

## Regressao e riscos residuais

- A resolucao de modo passa a ter tres niveis e e atravessada por **todo** job.
  E o ponto de maior risco da feature; por isso a Fase 2 exige que a suite
  inteira passe sem alteracao de expectativa com a postura em `todos`.
- Piloto estreito atrasa o P6.3: menos trafego, mais tempo ate 20 rascunhos
  decididos por persona. Custo aceito no `intent.md`.
- Amostra do piloto pode nao representar o conjunto. Mitigado pela metrica por
  clinica (Fase 4); sem ela, o numero agregado do piloto engana.

## Itens fora de escopo entregues

- Nenhum ate o momento.

## Decisao de release

- [ ] Aprovado para stage.
- [ ] Aprovado para producao com postura `todos` (feature dormente).
- [ ] Aprovado para producao com postura `piloto`.
- [ ] Nao aprovado (descrever motivo).
