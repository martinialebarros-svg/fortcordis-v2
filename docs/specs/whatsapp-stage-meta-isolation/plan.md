# Plan - whatsapp-stage-meta-isolation

Data: 2026-08-23

- [x] P1. Confirmar health, auth, identidade Graph e atividade de webhooks em
  stage sem alterar configuracao.
- [x] P2. Confirmar visualmente que o app FortZap aponta para o callback de
  producao e mantém `messages` assinado.
- [x] P3. Parametrizar IDs Meta no deploy/preflight e exigir identidade de
  stage distinta da producao.
- [x] P4. Fazer o workflow de stage gravar segredos e IDs publicos dedicados.
- [x] P5. Remover do workflow de producao a sincronizacao do `.env` Meta de
  stage.
- [x] P6. Adicionar teste focado, prova de relacionamento na Graph API,
  atualizar exemplo de ambiente e runbooks.
- [x] P7. Criar app/WABA/numero de teste de stage no painel Meta.
- [x] P8. Cadastrar GitHub Secrets/Variables de stage com confirmacao explicita.
- [x] P9. Publicar em stage e executar preflight pre-corte, health e smoke
  terminal.
- [ ] P10. Configurar o callback do app de stage, executar teste controlado de
  recebimento e envio e confirmar que producao permaneceu intacta.
