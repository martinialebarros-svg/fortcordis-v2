# Verify - atendimento-upload-duplicate-guard

Data: 2026-04-04  
Responsavel: Equipe FortCordis  
Status: in-progress

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | guarda de assinatura no upload geral implementada | pending-manual |
| CA-002 | aceitacao | guarda de assinatura no upload por exame implementada | pending-manual |
| CA-003 | aceitacao | cleanup da assinatura em sucesso/erro/cancelamento no `finally` | pending-manual |
| CA-004 | aceitacao | aviso neutro `Upload ja esta em andamento para este arquivo.` | pending-manual |
| CA-005 | aceitacao | lint da tela `app/atendimento/page.tsx` | ok |

## 2) Testes automatizados executados

Comando executado:

```bash
npm --prefix frontend run lint -- --file app/atendimento/page.tsx
```

Resultado:
- Frontend lint: sem warnings/erros.

## 3) Testes manuais

- Local:
- [ ] Upload geral com clique duplo rapido gera apenas uma submissao.
- [ ] Upload por exame com clique duplo rapido gera apenas uma submissao.
- [ ] Durante upload ativo, segunda tentativa mostra aviso neutro de duplicidade.
- [ ] Apos cancelar upload, reenvio imediato do mesmo arquivo funciona.
- [ ] Apos sucesso/erro, novo envio do mesmo arquivo funciona normalmente.

- Stage:
- [ ] Repetir os 5 cenarios acima em `stage.fortcordis.com.br`.

## 4) Regressao e riscos residuais

- Risco residual 1: assinatura por metadados pode nao distinguir arquivos raros com metadados identicos no mesmo contexto.
- Risco residual 2: validacao de "um POST" depende de observacao de logs/rede no teste manual.

## 5) Itens fora de escopo entregues

- Nenhum.

## 6) Decisao de release

- [ ] Aprovado para stage.
- [ ] Aprovado para producao.
- [ ] Nao aprovado (descrever motivo).

Motivo atual:
- Pendente checklist manual local/stage para confirmar CA-001..CA-004.
