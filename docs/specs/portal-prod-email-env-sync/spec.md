# Spec - portal-prod-email-env-sync

Data: 2026-07-03  
Responsavel: Equipe FortCordis  
Status: done

## 1) Escopo funcional

Sincronizar a configuracao `PORTAL_EMAIL_*` do backend stage para o backend de producao na mesma VPS, com backup do `.env`, restart do servico e validacao de handshake SMTP para restaurar o envio de codigo do portal do tutor em producao.

## 2) Requisitos funcionais (RF)

- RF-001: fornecer um script versionado para copiar apenas as chaves `PORTAL_EMAIL_*` do `.env` stage para o `.env` prod.
- RF-002: o script deve criar backup do `.env` prod antes da alteracao.
- RF-003: o script deve reiniciar o servico `fortcordis-backend` apos atualizar o `.env`.
- RF-004: o script deve validar a autenticacao SMTP usando as credenciais sincronizadas sem expor segredos no log.
- RF-005: disponibilizar um workflow manual para executar a sincronizacao remota na VPS com os secrets existentes.

## 3) Requisitos nao funcionais (NFR)

- NFR-001: a automacao deve reutilizar `VPS_SUDO_PASSWORD` e nao depender de senha digitada no terminal local.
- NFR-002: a execucao deve compartilhar `concurrency.group: fortcordis-vps-deploy`.
- NFR-003: os logs devem registrar backup, merge do `.env`, restart do backend e validacao SMTP.

## 4) Compatibilidade e rollout

- Backward compatibility:
  - nenhuma rota HTTP muda; a entrega de email apenas volta a funcionar em producao.
- Estrategia de rollback:
  - restaurar o backup do `.env` prod criado pelo script e reiniciar `fortcordis-backend`.

## 5) Criterios de aceitacao (CA)

- CA-001: existe um workflow manual para sincronizar `PORTAL_EMAIL_*` de stage para prod.
- CA-002: o workflow cria backup do `.env` prod e reinicia o backend de producao.
- CA-003: a execucao valida handshake SMTP com sucesso usando a configuracao resultante.

## 6) Casos de borda

- CB-001: se alguma chave obrigatoria `PORTAL_EMAIL_*` estiver ausente no stage, a execucao falha sem sobrescrever o prod.
- CB-002: se o backend restart falhar, o erro aparece no workflow e o backup permanece disponivel.
- CB-003: o script nao deve duplicar chaves `PORTAL_EMAIL_*` no `.env` prod.
