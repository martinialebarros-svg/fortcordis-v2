# Plano

1. Reutilizar modelos operacionais e regras de jornada da Agenda; separar agregações financeiras e de capacidade.
2. API `/api/v1/gestao` exclusiva para administrador; consulta sem gravação.
3. Persistir apenas premissas explicitamente salvas, em tabela própria com versão, contexto, autor e auditoria atômica. Conflito concorrente retorna 409.
4. Tela `/gestao`, navegação administrativa, filtros, comparação, fórmulas, registros e lacunas em português.
5. Testes sintéticos de cálculos, datas, exclusões, permissões, revisão concorrente e interface; lint, tipos, build e SDD.

## Migração e reversão

A migração do runner Python existente cria `gestao_premissas` sem semear custos, saldo ou metas. PostgreSQL ativa RLS e revoga acesso direto de PUBLIC, anon e authenticated; somente a API administrativa autorizada usa a tabela. Não há mudanças no contrato de autenticação nem integração nova ao SDK Supabase. Reversão: retirar router/navegação e conservar a tabela para preservar as premissas e sua auditoria; não há necessidade de reverter dados operacionais. Migração ausente produz erro recuperável para salvar/ler premissas, enquanto a simulação permanece independente dessa tabela.

## Candidata e homologação — 06/11/2026

1. Fixar a base main e a origem de Gestão em Stage; construir candidata em checkout separado, sem incorporar funcionalidades paralelas.
2. Revalidar testes, build e integração; complementar a prova PostgreSQL de migração, permissões, persistência, concorrência e auditoria usando cluster temporário local.
3. Homologar as seis métricas e as premissas no navegador com fontes fictícias e armazenamento descartável; manter as premissas compartilhadas de Stage intactas.
4. Coordenar uma janela de Stage, salvar o snapshot paralelo e preparar a restauração antes de instalar a candidata. Aguardar os workflows terminais, conferir SHA, acesso administrativo, proteção anônima e bundles.
5. Restaurar o Stage paralelo, verificar os caminhos não pertencentes à Gestão e os dados/configurações preservados; registrar evidências e limitações. Produção permanece fora deste ciclo.
