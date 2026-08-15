# Spec - institutional-portal-prod-cutover

Data: 2026-07-02  
Responsavel: Equipe FortCordis  
Status: done

## 1) Escopo funcional

Provisionar a borda Nginx de producao para o host institucional `fortcordis.com`/`www.fortcordis.com` sem alterar o host do sistema interno. A entrega inclui um script idempotente de infraestrutura e um workflow manual do GitHub Actions para aplicar a configuracao com os secrets atuais da VPS, com suporte opcional a TLS apos o corte de DNS.

## 2) Requisitos funcionais (RF)

- RF-001: criar um script versionado que gere o server block `fortcordis-www` para `fortcordis.com` e `www.fortcordis.com`.
- RF-002: o server block deve fazer proxy de `/` para `127.0.0.1:3000` e `/api/` para `127.0.0.1:8000`.
- RF-003: o script deve ser idempotente, criar backup do site file anterior e validar `nginx -t` antes do reload.
- RF-004: o script deve executar probes locais com `Host` header institucional apos o reload.
- RF-005: o workflow manual deve copiar e executar o script na VPS usando os secrets existentes do GitHub.
- RF-006: o workflow deve aceitar uma opcao para emitir TLS com Certbot somente quando explicitamente solicitado.
- RF-007: a opcao de TLS deve aceitar os formatos booleanos usados pelo `workflow_dispatch` (`true`/`false`) sem depender de conversao manual para `1`/`0`.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (seguranca/permissoes): a automacao nao deve exigir exposicao da senha sudo no chat; deve usar `VPS_SUDO_PASSWORD` do GitHub Actions.
- NFR-002 (operacao): a execucao deve compartilhar `concurrency.group` com os deploys da VPS para evitar contencao.
- NFR-003 (observabilidade): logs do workflow e do script devem identificar backup, validacao Nginx, probes HTTP e status do TLS.

## 4) Contratos tecnicos

### API

- Endpoint: nao aplicavel.
- Metodo: nao aplicavel.
- Payload: nao aplicavel.
- Resposta: nao aplicavel.

### Banco/migracoes

- Tabelas/colunas afetadas: nenhuma.
- Indices/constraints: sem alteracao.
- Migracao necessaria: nao.

### Frontend

- Telas afetadas: nenhuma tela nova; usa o frontend de producao ja publicado.
- Estados de UI: landing institucional e redirecionamentos internos permanecem como estao em producao.
- Regras de exibicao/erro: o host institucional novo nao pode impactar `app.fortcordis.com.br`.

## 5) Compatibilidade e rollout

- Backward compatibility:
  - `app.fortcordis.com.br` continua atendido pelo site file atual.
  - a publicacao de `fortcordis.com`/`www.fortcordis.com` nao altera rotas internas do app.
- Feature flag: nao.
- Estrategia de rollback:
  - restaurar backup do site file gerado pelo script e recarregar o Nginx;
  - remover o symlink `sites-enabled/fortcordis-www` se necessario.

## 6) Criterios de aceitacao (CA)

- CA-001: existe um workflow manual para provisionar o host institucional na VPS de producao.
- CA-002: o workflow usa `concurrency.group: fortcordis-vps-deploy`.
- CA-003: a execucao HTTP-only fecha verde e registra probes locais bem-sucedidos para `fortcordis.com` e `www.fortcordis.com`.
- CA-004: a execucao com TLS exige email do Certbot e valida que o DNS ja aponta para a VPS antes de tentar emitir certificado.

## 7) Casos de borda

- CB-001: se o site file ja existir, o script cria backup antes de sobrescrever.
- CB-002: se o DNS ainda nao apontar para a VPS, a etapa TLS falha com mensagem explicita sem alterar a publicacao HTTP.
- CB-003: se o usuario remoto nao tiver `sudo` sem senha, a automacao usa `VPS_SUDO_PASSWORD`.
- CB-004: se o workflow manual enviar `ENABLE_TLS=true`, a etapa TLS deve ser executada de fato e nao apenas logada como ignorada.

## 8) Fora de escopo

- Alterar o registrador ou o provedor DNS automaticamente.
- Migrar `app.fortcordis.com.br` para outro host.
- Revisao de copy, SEO ou analytics da landing institucional.
