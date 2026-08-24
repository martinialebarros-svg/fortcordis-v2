# Verify - whatsapp-bot-piloto-por-clinica

Data: 2026-08-24
Responsavel: Martiniano + Claude
Status: Fases 1-3 entregues; Fase 4 (metrica por clinica) pendente

## Matriz de rastreabilidade

| ID | Tipo | Evidencia planejada | Status |
| --- | --- | --- | --- |
| CA-P01 | aceitacao | ok — `test_whatsapp_bot_piloto_clinica.test_todos_sem_linha_de_clinica_nao_bloqueia`; e a suite inteira passou sem alterar expectativa alguma |
| CA-P02 | aceitacao | ok — `test_piloto_sem_linha_de_clinica_bloqueia` + `test_bloqueio_nao_chama_provider` (provider com `side_effect=AssertionError`) |
| CA-P03 | aceitacao | ok — `test_piloto_com_clinica_habilitada_gera` |
| CA-P04 | aceitacao | ok — `test_clinica_off_explicito_bloqueia_mesmo_em_todos` |
| CA-P05 | aceitacao | ok — `test_conversa_vence_clinica_off` e `test_conversa_off_vence_clinica_habilitada` |
| CA-P06 | aceitacao | ok — `test_piloto_tutor_sem_opt_in_bloqueia` e `test_piloto_tutor_com_opt_in_gera` |
| CA-P07 | aceitacao | migracao idempotente, default `todos` | ok — `test_whatsapp_bot_piloto_migration.test_upgrade_cria_tabela_e_e_idempotente` (aplicada duas vezes em sequencia) + `test_participacao_nasce_todos_e_preserva_comportamento` |
| CA-P08 | aceitacao | ok — `test_configuracoes_autorizacao`: `test_nao_admin_nao_pode_alterar_participacao_do_bot` (403), `test_participacao_invalida_e_rejeitada_422` (422), `test_admin_pode_ligar_o_piloto` |
| CA-P09 | aceitacao | ok — `test_bloqueio_nao_chama_provider`: `provider.generate` levanta se chamado, e o resultado e `suppressed`/`fora_do_piloto` com `texto_gerado` nulo |
| CB-P01 | borda | ok — `test_identidade_nao_resolvida_em_piloto_bloqueia_sem_inventar_clinica`: mesmo com clinica habilitada no banco, sem `match_type` nao ha participacao |
| CB-P02 | borda | ok — `test_clinica_inativa_nao_aparece_na_listagem` (parcial: cobre a listagem; o escopo das tools ja filtra clinica ativa) |
| CB-P03 | borda | ok — `test_voltar_para_todos_preserva_off_explicito` |
| CB-P04 | borda | remocao da clinica remove a linha de participacao (cascade) | pendente |
| NFR-P01 | nao funcional | ok — coluna nasce `todos` (inclusive em linha que ja existia, via UPDATE explicito: default de coluna nao preenche linha antiga em todo dialeto) e a tabela nasce vazia. Suite completa 1044/1044 sem alterar nenhuma expectativa existente |
| NFR-P02 | nao funcional | ok — o portao roda logo apos `_escopo_da_persona` e antes de tools e provider; `test_bloqueio_nao_chama_provider` trava |
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


## Resumo dos resultados (Fase 2, 2026-08-24)

- `resolve_participacao` e `resolve_modo_efetivo` em `whatsapp_bot_gates`;
  portao em `gerar_resposta` logo apos `_escopo_da_persona`; endpoints
  `GET /whatsapp/bot/clinicas` e `PUT /whatsapp/bot/clinicas/{id}`;
  `whatsapp_bot_participacao` na allowlist de `PUT /configuracoes`, admin-only.
- **23 testes novos** (16 no arquivo do piloto, 3 de autorizacao, e os demais
  ajustes de fixture). Suite completa **1063/1063** (era 1040).
- **Criterio da fase cumprido**: com a postura em `todos`, nenhuma expectativa
  existente mudou. A feature e invisivel ate ser ligada.

### Correcao de desenho durante a implementacao

A primeira versao de `resolve_modo_efetivo` **recalculava** o modo a partir do
institucional, sobrescrevendo o que o chamador ja tinha resolvido. Dois testes
existentes quebraram e expuseram o erro: o parametro `modo` virava mentira, e
duas leituras da mesma coisa podiam discordar.

Corrigido para receber `modo_atual` e **nunca** recalcular — a funcao so
substitui quando a clinica tem modo proprio. `_process_job` tambem passa o
`estado` que ja resolveu, evitando reconsultar a mesma linha no caminho quente.

### Verificacao por mutacao

- Desligar o bloqueio do piloto (`if False`) derruba 4 testes.
- Inverter a precedencia, fazendo a clinica vencer a conversa, derruba 3.

Sem isso, os testes poderiam estar apenas descrevendo o codigo em vez de
travar a decisao.


## Resumo dos resultados (Fase 3, 2026-08-24)

Secao "Quem o bot atende" no painel do bot, acima da prontidao: seletor de
postura, filtro por nome e lista de clinicas ativas.

Tres decisoes de tela que nao sao cosmeticas:

1. **Cada linha diz o efeito, nao a marcacao.** "atendida pelo bot" / "fora do
   atendimento" vem do campo `participa`, calculado no backend. Mostrar so
   `modo` faria a mesma marcacao parecer a mesma coisa nas duas posturas,
   quando significa o oposto.
2. **`Automatico` nao aparece nos botoes por clinica.** So `Desligado` e
   `Sugerir`. O envio automatico nao existe; oferecer o botao criaria a
   impressao de que existe, num painel cuja funcao e justamente dizer a verdade
   sobre o que o bot faz.
3. **O texto de apoio muda com a postura**, porque a consequencia de "sem
   marcacao" se inverte entre `todos` e `piloto`.

Validacao: frontend **98/98**, `eslint` sem warning, `tsc --noEmit` limpo,
`next build` concluido. Backend inalterado nesta fase (**1063/1063**).

### Nao verificado ainda

Uso real da tela em stage: depende de publicar e de haver clinica ativa
cadastrada no ambiente. A prova de que o backend responde ja existe nos testes
de endpoint da Fase 2.
