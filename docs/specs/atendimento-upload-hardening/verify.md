# Verify - atendimento-upload-hardening

Data: 2026-04-03  
Responsavel: Equipe FortCordis  
Status: approved

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | `test_upload_anexo_returns_201_payload_when_storage_succeeds` | ok |
| CA-002 | aceitacao | `test_upload_anexo_maps_type_error_to_400` | ok |
| CA-003 | aceitacao | `test_upload_anexo_maps_size_error_to_413` + `test_store_attachment_rejects_oversized_before_storage` | ok |
| CA-004 | aceitacao | diff com `accept` no frontend + lint da tela sem erro + validacao manual local/stage (4 cenarios aprovados) | ok |
| CA-005 | aceitacao | suites `test_atendimento_upload_service.py` e `test_atendimento_upload_endpoint.py` | ok |
| NFR-001 | nao funcional | allowlist fixa no service (`pdf/jpg/jpeg/png/webp`) | ok |
| NFR-002 | nao funcional | teste garante rejeicao sem tocar storage (`get_atendimento_upload_storage_dir` nao chamado) | ok |
| NFR-003 | nao funcional | testes para limite exato e acima do limite | ok |
| NFR-004 | nao funcional | logs de rejeicao observados nos testes de endpoint (`arquivo vazio`, `tipo invalido`, `acima do limite`) | ok |

## 2) Testes automatizados executados

Comandos executados:

```bash
# backend (venv do projeto)
backend/.venv/Scripts/python -m unittest backend/tests/test_atendimento_upload_service.py backend/tests/test_atendimento_upload_endpoint.py -v

# frontend
npm --prefix frontend run lint -- --file app/atendimento/page.tsx
```

Resumo dos resultados:
- Backend: 14 testes executados, 14 pass.
- Frontend: lint da tela de atendimento sem warnings/erros.

## 3) Testes manuais

- Cenario 1: upload de PDF valido no bloco "Anexos e Imagens".
- Cenario 2: upload de imagem valida vinculada a exame.
- Cenario 3: upload de arquivo fora da allowlist com retorno de erro claro.
- Cenario 4: upload acima do limite com bloqueio sem persistencia.
- Status atual: concluido (4 cenarios aprovados em local e stage).

## 4) Regressao e riscos residuais

- Risco residual 1: arquivos clinicos validos fora da allowlist inicial.
- Risco residual 2: diferenca de MIME reportado por navegador/proxy.

## 5) Itens fora de escopo entregues

- Nenhum item fora de escopo entregue nesta iteracao.

## 6) Decisao de release

- [x] Aprovado para stage.
- [ ] Aprovado para producao.
- [ ] Nao aprovado (descrever motivo).

Motivo atual:
- Pendente apenas janela e checklist de promocao para producao.

## 7) Checklist operacional rapido (T4.2 - local)

Pre-condicoes:
- Backend e frontend rodando localmente.
- Usuario autenticado com acesso ao modulo atendimento.
- Atendimento existente (ou criar um novo para teste).

Passo a passo:
1. Abrir um atendimento e ir para "Anexos e Imagens".
2. Enviar `arquivo_teste.pdf` (menor que 25MB).
3. Confirmar mensagem de sucesso e item aparecendo na lista de anexos.
4. Abrir preview/download do arquivo enviado.
5. Enviar `imagem_teste.jpg` vinculada a um exame.
6. Confirmar anexo aparece no bloco do exame.
7. Tentar enviar arquivo invalido (`.exe` ou `.txt`) e confirmar erro de tipo.
8. Tentar enviar arquivo >25MB e confirmar erro de limite.

Evidencias minimas para registrar:
- Print do sucesso de PDF.
- Print do sucesso de imagem no exame.
- Print do erro de tipo invalido.
- Print do erro de limite de tamanho.

## 8) Checklist homologacao curta (T4.3 - stage)

Pre-condicoes:
- Deploy da branch em `stage.fortcordis.com.br`.
- Ambiente stage isolado e sem dados de producao.

Passo a passo:
1. Repetir os 8 passos do checklist local em stage.
2. Validar logs do backend para rejeicoes:
- "Upload de anexo rejeitado: arquivo vazio"
- "Upload de anexo rejeitado: tipo invalido"
- "Upload de anexo rejeitado: arquivo acima do limite"
3. Validar que nao houve erro 500 no fluxo de upload.
4. Validar que anexos validos seguem abrindo normalmente no preview/download.

Gate de aprovacao para marcar stage:
- Todos os cenarios de sucesso ok.
- Todos os cenarios de rejeicao retornando 400/413 conforme esperado.
- Sem regressao visual relevante no bloco de anexos.
- Sem erro 500 em logs.

Atualizacao final deste arquivo apos T4.2/T4.3:
- `CA-004` marcado como `ok`.
- `Aprovado para stage` marcado.
- `Nao aprovado` desmarcado.

## 9) Registro Operacional Pos-release (2026-04-04)

Incidente observado:
- Upload de PDF valido (~2.7MB) falhando com `413 Request Entity Too Large` em stage.
- O erro ocorria no Nginx (proxy) antes de chegar ao backend, apesar do limite de 25MB no service de upload.

Causa raiz:
- Configuracao Nginx sem `client_max_body_size` nos blocos de `location /api` (default efetivo menor que esperado para o fluxo).

Correcao aplicada:
- Ajuste de infraestrutura no VPS para ambos domínios:
- stage: `/etc/nginx/sites-enabled/fortcordis-stage` em `location /api` com `client_max_body_size 30m;`
- producao: `/etc/nginx/sites-enabled/fortcordis-app` em `location /api/` com `client_max_body_size 30m;`
- Validacao: `nginx -t` + `systemctl reload nginx`.

Reteste de evidencia:
- Arquivo: `2026-03-30__Nenem__NATALIA_LOPES__Vet_Plus.pdf` (2,724,579 bytes).
- Endpoint stage: `POST /api/v1/atendimentos/11/anexos/upload`.
- Resultado apos ajuste: `201` (upload concluido), com remocao do anexo de teste na sequencia (`DELETE` => `200`).
- Endpoint prod sem token para mesmo arquivo retornou `401` (confirmando que nao houve novo `413` no proxy).
