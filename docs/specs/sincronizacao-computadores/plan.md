# Plano

1. Inspecionar branches, estado local, instrucoes e colisao com arquivos locais.
2. Preservar referencias anteriores e arquivos de runtime; avancar `stage` e `main`.
   O banco legado `backend/fortcordis.db`, ocultado por flags no indice e removido
   do Git no remoto, deve sair apenas do indice e permanecer intacto no disco.
3. Implementar comando Node.js sem dependencias externas e documentar a rotina.
4. Validar com repositorios temporarios, remoto bare e duas copias; rodar guardrail SDD.
5. Instalar o alias no Samsung, registrar e publicar somente a branch da ferramenta.

## Rollback

- Remover alias com `git config --local --unset alias.sync`.
- A ferramenta pode ser removida sem afetar a aplicacao.
- Referencias locais `codex/backup-samsung-stage-20261017` e
  `codex/backup-samsung-main-20261017` preservam os commits anteriores.
- O backup do runtime fica fora do repositorio em
  `C:\Users\marti\.codex\backups\fortcordis-samsung-20261017-eb4bdb4f`.
  Nao voltar a uma branch antiga sobre o banco local sem preservar esse banco.
