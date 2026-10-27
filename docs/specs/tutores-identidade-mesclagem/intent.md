# Intent — tutores-identidade-mesclagem

Data: 2026-10-27
Responsavel: Martiniano + Codex
Status: approved

Clinicas frequentemente informam apenas o primeiro nome do tutor. O nome nao
comprova identidade. Reaproveitar o primeiro homonimo pode vincular um animal
a outra pessoa e sobrescrever contatos. A autorizacao desta entrega abrange
implementar homonimos, identificacao pendente, fim da reutilizacao por nome e
mesclagem assistida com historico e confirmacao.

Cada cadastro tem ID proprio e pode ser complementado depois. Cadastros que
forem confirmados como a mesma pessoa podem ser consolidados por administrador,
preservando os animais, registros clinicos, valores financeiros e proveniencia.

Entrega local isolada de `origin/stage`, sem alterar dados reais, fazer envios,
commits, push ou publicacao. Testes usam fixtures sinteticas e PostgreSQL
descartavel local. Identidade e seguranca de acesso sao verificadas separadamente
de apresentacao da interface.
