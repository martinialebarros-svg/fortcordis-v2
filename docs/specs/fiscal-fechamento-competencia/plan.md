# Plano

1. Implementar serviço de prévia/preparação, persistência e migração aditiva após o máximo remoto de stage.
2. Implementar formatos XLSX/PDF/texto/manifesto e ZIP com valores exatos e agrupamento por documento/mês.
3. Integrar página fiscal ao fechamento mensal e histórico de pacotes, preservando acesso ao cadastro.
4. Testar elegibilidade, mês/fuso, duplicidade concorrente, idempotência, documentos e UI; executar lint, typecheck, build e guardrail SDD.
5. Abrir PR para stage, aguardar checks, integrar e verificar deploy/smoke.
6. Após autorização de produção, publicar somente o fiscal sobre o main atual, mantendo byte a byte o código fiscal aprovado em stage. Quando stage contiver alterações de outros módulos ainda sem autorização, usar PR isolado com a exceção de fluxo `hotfix` e registrar o motivo; não promover o restante de stage. Reintegrar a evidência em stage depois da publicação.
7. Não copiar banco, pacotes ou fixtures de stage. Conferir migração aditiva, preservação do runtime de produção, workflows terminais, SHA instalado, domínios/bundles e API protegida. Não emitir notas, preparar pacote real ou enviar mensagens durante a verificação.
