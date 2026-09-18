# Verify - laudo-aviso-whatsapp-seletor-destino

Data: 2026-09-17
Responsavel: Martiniano
Status: done

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
| CA-009 | aceitacao | Conferido em stage (secao 3): a janela "Avisar por WhatsApp" abriu nas duas telas — Central de laudos e visualizacao do laudo 49 —, sem `confirm()` nativo | ok |
| CA-010 | aceitacao | `getDestinosSelecionaveis` testado em `lib/laudo-whatsapp-aviso.test.ts` (nomes e chaves dos tres destinos; veterinario nao liberado fica de fora); a janela mostra "Já avisado em ..." e o erro do ultimo envio | ok |
| CA-011 | aceitacao | `getSelecaoInicialAviso` testado: com a clinica `enviado` e um veterinario `falhou`, a selecao inicial e o que falhou mais o que nunca recebeu | ok |
| CA-012 | aceitacao | Conferido em stage: desmarcando os dois destinos, o botao virou "Enviar (0)" com `disabled === true` | ok |
| CA-013 | aceitacao | Conferido em stage: depois do envio a janela fechou, o toast ambar trouxe "O envio para Martiniano falhou: ..." (nomeando o veterinario) e a badge "WhatsApp parceiro falhou" apareceu na linha | ok |
| CA-014 | aceitacao | `laudo com um destino so abre com ele marcado` em `lib/laudo-whatsapp-aviso.test.ts` | ok |
| CA-015 | aceitacao | `test_migracao_do_mapa_de_envios_e_idempotente`: `upgrade()` duas vezes na mesma conexao, coluna presente e a coluna de resumo preservada | ok |
| CA-016 | aceitacao | `test_destino_escolhido_sem_numero_nao_derruba_o_envio_dos_outros`: clinica liberada sem numero + veterinario escolhidos juntos; so o veterinario e chamado, a clinica volta `ignorado`/`sem_whatsapp`. Dois testes de `resumirRespostaAvisoWhatsApp` cobrem o aviso ambar ("A clínica não tem WhatsApp cadastrado.") e o caso em que ninguem tem numero. Conferido em stage (secao 3) | ok |

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

### Correcao depois do merge em stage - 2026-09-18

A primeira versao recusava com 422 qualquer destino escolhido que nao tivesse
numero cadastrado. Como a janela lista quem esta liberado no portal sem saber
dos telefones, um laudo com clinica sem WhatsApp — o caso do laudo 49 em stage —
travava o envio inteiro: a clinica vinha pre-marcada e o clique so devolvia
erro, sem avisar nem o veterinario. Agora o 422 fica para destino que nao esta
liberado; sem numero volta a ser `ignorado`/`sem_whatsapp`, e o toast diz quem
ficou sem numero (CA-005 e CA-016).

### Resultado - 2026-09-17

- `pytest tests/test_laudo_portal_whatsapp_seletor.py`: 7 testes novos passaram.
- `pytest -k "laudo or whatsapp or portal"`: 634 passaram, 7 pulados — nenhuma
  regressao nas specs anteriores do aviso.
- `vitest run`: 44 arquivos, 331 testes (6 novos em `laudo-whatsapp-aviso`).
- `tsc --noEmit`, `eslint --max-warnings=0`, `next build`: sem erros.

## 3) Verificacao manual

### Feito em stage - 2026-09-18

Laudo 49 (Bolinha), clinica "Martiniano Barros" (liberada, **sem WhatsApp
cadastrado**) e veterinario "Martiniano" (liberado, com numero). O envio recusa
4xx em stage por desenho — a conta de la nao tem o modelo aprovado —, o que
serviu para exercitar tambem o caminho de erro.

1. **A janela no lugar do `confirm()` (CA-009).** Abriu nas duas telas, com o
   titulo "Avisar por WhatsApp" e a linha "Quem recebe o aviso de laudo
   disponível? Já marcamos quem ainda não foi avisado."
2. **Lista e pre-selecao (CA-010, CA-011).** Os dois destinos apareceram com
   nome e papel; o veterinario trouxe "Último envio falhou: WhatsApp provider
   rejected or did not complete the template delivery" e ambos vieram marcados,
   por nenhum ter envio aceito.
3. **Sem selecao nao envia (CA-012).** Desmarcando os dois, o botao virou
   "Enviar (0)" e ficou desabilitado.
4. **Envio e feedback (CA-013).** Com so o veterinario marcado, a janela fechou,
   o toast ambar trouxe "O envio para Martiniano falhou: ..." e a badge
   "WhatsApp parceiro falhou" apareceu na linha.
5. **Destino sem numero junto (CA-016).** Marcando os dois, a chamada **nao**
   foi recusada: o veterinario foi tentado e o toast avisou que a clinica nao
   tem WhatsApp cadastrado. Antes da correcao, essa mesma combinacao devolvia
   422 e ninguem era avisado.

O texto do toast emendava o erro do provedor na frase seguinte ("...template
delivery a clínica não tem..."), porque o erro nem sempre termina em ponto.
Corrigido junto, com teste.

### Pendente em producao

Confirmar o que motivou a spec: avisar so o destino que faltava e ver que o
outro **nao** recebeu mensagem nova.

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
