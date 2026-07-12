# Verify - institutional-portal-landing

Data: 2026-06-16
Responsavel: Equipe FortCordis
Status: done

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | Browser via proxy local `127.0.0.1:3012` com upstream `Host: fortcordis.com.br` + `curl -H 'Host: fortcordis.com.br' http://127.0.0.1:3002/`; extensao do matcher para `fortcordis.com` e `www.fortcordis.com` revisada em `frontend/lib/host-routing.ts` | ok |
| CA-002 | aceitacao | Browser `http://localhost:3002/` + `curl http://127.0.0.1:3002/` | ok |
| CA-003 | aceitacao | Revisao de `frontend/app/page.tsx` | ok |
| CA-004 | aceitacao | Revisao de `frontend/app/area-pacientes/page.tsx` | ok |
| CA-005 | aceitacao | Revisao de `frontend/app/clinica-parceira/page.tsx` | ok |
| CA-006 | aceitacao | `npm run build` em `frontend/` | ok |
| CA-007 | aceitacao | Browser desktop 1280px e mobile 390x844 sem overflow horizontal; hero e rotas publicas renderizados | ok |
| NFR-001 | nao funcional | Copy de seguranca nas paginas publicas | ok |
| NFR-002 | nao funcional | Copy LGPD sem anexos sensiveis fora do portal | ok |
| NFR-003 | nao funcional | Asset local `frontend/public/brand/fortcordis-portal-hero.jpg` | ok |
| NFR-004 | nao funcional | `isInstitutionalHost(host)` preservado em `frontend/app/page.tsx` | ok |
| CB-005 | borda | Revisao de copy em `frontend/app/page.tsx` e `frontend/app/area-pacientes/page.tsx` sem promessa de WhatsApp antes da aprovacao Meta | ok |
| CA-008 | aceitacao | Browser em 1280x720 e 390x844: `scroll-behavior: smooth`, `animation-timeline: view()`, destinos com margem e copy acentuada | ok |
| CA-009 | aceitacao | Revisao da hierarquia de copy em `frontend/app/page.tsx`, `frontend/app/area-pacientes/page.tsx` e `frontend/app/clinica-parceira/page.tsx` | ok |
| NFR-005 | nao funcional | `prefers-reduced-motion: reduce` restaura rolagem automatica e remove animacoes de entrada | ok |

## 2) Testes automatizados executados

Comandos:

```bash
# frontend
npm run build
```

Resumo dos resultados:
- Frontend: `npm run build` concluido com sucesso em 2026-06-16 e reexecutado em 2026-06-30 apos ajuste de copy email-only.
- Backend: nao aplicavel.

## 3) Testes manuais

- Cenario 1: `/` com host institucional via proxy local `127.0.0.1:3012`:
  - H1 `Fort Cordis`, imagem hero presente, links para tutor/clinica/app presentes.
  - Sem overflow horizontal em desktop 1280px e mobile 390px.
- Cenario 2: `/` em `localhost:3002`:
  - H1 `FortCordis`, campos de email e senha presentes, preservando login administrativo.
- Cenario 3: `/area-pacientes`:
  - H1 de tutor presente, sem placeholder de construcao, sem overflow em mobile e desktop.
  - Copy preliminar orienta codigo temporario no email cadastrado, sem prometer WhatsApp antes da liberacao da API da Meta.
- Cenario 4: `/clinica-parceira`:
  - H1 de clinica parceira presente, sem placeholder de construcao, sem overflow em mobile e desktop.
- Cenario 5: rota interna em host institucional:
  - `curl -I -H 'Host: fortcordis.com.br' http://127.0.0.1:3002/dashboard` retornou `307` para `http://app.fortcordis.com.br/dashboard`.
  - Em 2026-07-02, `frontend/lib/host-routing.ts` foi ampliado para tratar `fortcordis.com` e `www.fortcordis.com` como hosts institucionais com redirecionamento das rotas internas para `app.fortcordis.com.br`; falta publicar a mudanca e alinhar DNS/Nginx/certificado em producao.
- Cenario 6: home institucional:
  - Copy preliminar orienta codigo temporario enviado ao email cadastrado e remove mencoes de acesso por WhatsApp.
- Console browser:
  - Sem erros de console nas rotas publicas verificadas.
- Status: concluido.

### Refinamento de 2026-07-12

- Links `#acesso` e `#saude-pet` navegados no browser sem alteracao de dados.
- Secoes de destino chegaram com margem visual e sem overflow horizontal.
- Copy visivel da home institucional e da area do tutor revisada para acentos e cedilhas.
- Copy visivel da pagina da clinica parceira revisada, incluindo as secoes de governanca e downloads.
- Links `#governanca` e `#downloads` validados em 1280x720 e 390x844; destinos com 16px de margem, `scroll-behavior: smooth` e animacao `fc-public-section-reveal` com `animation-timeline: view()`.
- Pagina da clinica parceira sem overflow horizontal nas duas resolucoes.
- Console do navegador sem erros em desktop e mobile.
- `npm run lint`, `npx tsc --noEmit --pretty false` e `npm run build`: ok; 33 paginas compiladas.
- Copy reposicionada para qualidade do servico na home, area do tutor e clinica parceira; referencias
  a protecao de dados permanecem como apoio, sem protagonismo na mensagem institucional.

## 4) Regressao e riscos residuais

- Risco residual 1: a landing foi seguida pelas fases `portal-secure-access-foundation` e `portal-access-ui`; os riscos funcionais do acesso real agora ficam rastreados nesses SDDs.
- Risco residual 2: copy final pode precisar de revisao juridica/comercial antes de producao.
- Risco residual 3: o host novo `www.fortcordis.com` depende de publicacao do frontend com matcher atualizado e de corte operacional no DNS/Nginx/TLS; antes disso, o dominio pode continuar servindo a origem anterior.

## 5) Itens fora de escopo entregues

- Nenhum item fora de escopo entregue nesta iteracao.

## 6) Decisao de release

- [x] Aprovado para stage.
- [ ] Aprovado para producao.
- [ ] Nao aprovado (descrever motivo).
