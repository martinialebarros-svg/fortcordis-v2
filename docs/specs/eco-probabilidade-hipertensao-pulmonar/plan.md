# Plano — Probabilidade de HP

1. Confirmar fontes primárias e contrato clínico, incluindo espécies, incompletos e confirmações.
2. Implementar modelos puros equivalentes TS/Python e fixtures compartilhadas de matriz/limites.
3. Integrar painel compartilhado a novos/edição, reaproveitar medidas e proteger revisão após edição/reimportação.
4. Integrar persistência segura, PDF/portal/bibliografia e alinhar as sugestões existentes da IA.
5. Testar matriz, dados ausentes, técnicas, espécie, round-trip, rascunhos, PDF e regressões existentes. Conferir tipos/lint/build; documentar limites reais de homologação.

Etapas 1–5 concluídas localmente em 02/11/2026; evidências em verify.md. Revisão independente incluiu correções de finitude de AP/Ao e graduação textual da IA, com regressões finais. Usuário autorizou “publique” em resposta explícita à oferta de stage: este ciclo inclui commit/PR, publicação e homologação em stage. Produção depende de pedido posterior. Não promover automaticamente a fase 1b ou outros incrementos paralelos.

Trabalho na worktree existente, branch `codex/echo-pulmonary-probability-20261102`, base stage `461a1a414cbab64ea16217a0c263efdf27271198`. Preservar os dois documentos não commitados da fase1b (`laudo-fluxo-confeccao`) e output/; não pertencem ao incremento HP. Não alterar dados reais nem publicar sem novo pedido.

Rollback: opt-in ausente conserva o comportamento legado; dados adicionais são aditivos na descrição, sem migração. Não remover medidas/paciente/arquivos runtime nem modificar frases compartilhadas. Retirar só a UI/derivação do incremento se necessário, preservando dados brutos.
