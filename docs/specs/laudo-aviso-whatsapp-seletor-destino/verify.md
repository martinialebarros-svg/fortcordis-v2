# Verify - laudo-aviso-whatsapp-seletor-destino

Data: 2026-09-17
Responsavel: Martiniano
Status: in-progress

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | `test_envia_so_para_o_veterinario_escolhido`: com `destinos: ["veterinario:5"]` o provedor e chamado uma vez so, no numero do veterinario; a clinica volta `ignorado`/`nao_selecionado` | ok |
| CA-002 | aceitacao | `test_envia_so_para_a_clinica_quando_e_a_unica_escolhida`: com `destinos: ["clinica"]`, os dois veterinarios voltam `nao_selecionado` e `whatsapp_parceiro_status` segue nulo | ok |
| CA-003 | aceitacao | `test_sem_o_campo_destinos_avisa_todo_mundo`: sem `destinos`, os tres numeros sao chamados | ok |
| CA-004 | aceitacao | `test_lista_vazia_de_destinos_responde_422`: 422 e `whatsapp_envios` continua nulo (nada foi enviado) | ok |
| CA-005 | aceitacao | `test_destino_nao_elegivel_responde_422_nomeando_a_chave`: `veterinario:999` responde 422 com a chave no `detail`, sem envio | ok |
| CA-006 | aceitacao | `test_envio_novo_preserva_o_resultado_dos_destinos_nao_escolhidos`: segundo envio, so para o veterinario, mantem intacto o registro da clinica (mesmo `em`) | ok |
| CA-007 | aceitacao | Os mesmos testes conferem `whatsapp_liberacao_status` e `whatsapp_parceiro_status`: so mudam para quem foi tentado. A suite de `test_laudo_portal_whatsapp_parceiro.py` segue verde sem alteracao | ok |
| CA-008 | aceitacao | `test_envio_novo_preserva_o_resultado_dos_destinos_nao_escolhidos` le `whatsapp_envios` no item de `listar_laudos`; o GET de um laudo devolve o mesmo campo | ok |
| CA-009 | aceitacao | `AvisoWhatsAppDialog` montado nas duas telas; o botao passou a chamar `abrirSeletorAvisoWhatsApp`, e nao ha mais `confirm()` no caminho do aviso | pendente - conferir em stage |
| CA-010 | aceitacao | `getDestinosSelecionaveis` testado em `lib/laudo-whatsapp-aviso.test.ts` (nomes e chaves dos tres destinos; veterinario nao liberado fica de fora); a janela mostra "Já avisado em ..." e o erro do ultimo envio | ok |
| CA-011 | aceitacao | `getSelecaoInicialAviso` testado: com a clinica `enviado` e um veterinario `falhou`, a selecao inicial e o que falhou mais o que nunca recebeu | ok |
| CA-012 | aceitacao | Botao de enviar com `disabled={enviando || selecionados.length === 0}` | pendente - conferir em stage |
| CA-013 | aceitacao | O handler das duas telas continua usando `resumirRespostaAvisoWhatsApp` (toast/alerta) e atualiza as badges com o que volta na resposta | pendente - conferir em stage |
| CA-014 | aceitacao | `laudo com um destino so abre com ele marcado` em `lib/laudo-whatsapp-aviso.test.ts` | ok |
| CA-015 | aceitacao | `test_migracao_do_mapa_de_envios_e_idempotente`: `upgrade()` duas vezes na mesma conexao, coluna presente e a coluna de resumo preservada | ok |

## 2) Comandos executados

```bash
cd backend
DATABASE_URL="sqlite:///./fortcordis-ci.db" venv/bin/python -m pytest tests/test_laudo_portal_whatsapp_seletor.py -q
DATABASE_URL="sqlite:///./fortcordis-ci.db" venv/bin/python -m pytest tests/ -k "laudo or whatsapp or portal" -q

cd frontend
npx vitest run
npx tsc --noEmit
npx eslint app/laudos/page.tsx "app/laudos/[id]/page.tsx" app/laudos/components/AvisoWhatsAppDialog.tsx lib/laudo-whatsapp-aviso.ts --max-warnings=0
npx next build
```

### Resultado - 2026-09-17

- `pytest tests/test_laudo_portal_whatsapp_seletor.py`: 7 testes novos passaram.
- `pytest -k "laudo or whatsapp or portal"`: 634 passaram, 7 pulados — nenhuma
  regressao nas specs anteriores do aviso.
- `vitest run`: 44 arquivos, 331 testes (6 novos em `laudo-whatsapp-aviso`).
- `tsc --noEmit`, `eslint --max-warnings=0`, `next build`: sem erros.

## 3) Verificacao manual

Pendente em stage: abrir a Central de laudos num laudo com clinica e
veterinario liberados e conferir CA-009, CA-012 e CA-013 — a janela abrindo no
lugar do `confirm()`, o botao desabilitado sem selecao, e o toast/badges depois
do envio. O envio em si recusa 4xx em stage (a conta de la nao tem o modelo
aprovado), o que serve para checar o caminho de erro.

Em producao, o que fecha o ciclo e o oposto do que motivou a spec: avisar so o
destino que faltava e confirmar que o outro **nao** recebeu mensagem nova.

## 4) Risco residual

- O mapa `whatsapp_envios` guarda o ultimo envio, nao o historico. Reenvio
  sobrescreve o registro anterior; quem precisa da linha do tempo continua
  dependendo da auditoria.
- A pre-selecao olha para "o ultimo envio foi aceito pela API", nao para "a
  mensagem chegou". Um destino cuja mensagem foi aceita mas nao entregue entra
  desmarcado, como se ja tivesse sido avisado.
- Laudos avisados antes desta spec nao tem `whatsapp_envios`; a pre-selecao cai
  nas colunas de resumo, que para varios veterinarios valem para o conjunto.
  Com dois veterinarios num laudo antigo, os dois aparecem com o mesmo status.
