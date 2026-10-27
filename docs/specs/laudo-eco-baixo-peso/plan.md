Registro preservado para integridade documental. Nesta publicacao de tutores
em 2026-10-27, o codigo desta feature permanece exclusivo de stage. As evidencias
abaixo nao significam instalacao em producao. Restauracao de stage pelo snapshot f48220c6.

# Plano

1. Preservar a implementação local de coerência canina e o clone principal, trabalhando na worktree anexada `eco-diastolic-references`, branch `codex/echo-canine-narrative-coherence-20261026`, base local `ab216935`. Não atualizar branches nem publicar durante esta implementação.
2. Reproduzir a perda de intervalos por cobertura do catálogo e a ausência de carrier em catálogo vazio. Conferir fontes primárias para espécie, peso, população, modalidade, estatística e unidades antes de calcular.
3. Acrescentar fallback efêmero somente para seis dimensões em modo M abaixo de 3 kg. Reutilizar o resolver da API/PDF, preservar `catalog_ranges` e adotar a mesma política na seleção local e prévia.
4. Separar limites publicados/calculados de estimativas não comparáveis; não liberar verde/acima/abaixo em extrapolação ou idade desconhecida, nem limites adultos em juvenil conhecido. Manter os domínios próprios das outras medidas.
5. Invalidar somente cache eco; conferir consumidores PDF, atribuição bibliográfica, fonte menor após análise qualitativa e avisos necessários. Não editar PDFs fornecidos ou dados de pacientes.
6. Executar testes direcionados, regressões, paridade Python/TypeScript, UI real por componentes, PDF real do renderer com renderização de todas as páginas, tipos/lint/build e guardrail SDD.

## Rollback

Reverter somente este helper/resolver/integração e a versão de cache eco. Não há migração nem dados clínicos ou catálogo gravados para restaurar. Antes de uma publicação posterior, atualizar a base e respeitar a fila compartilhada de releases e o caminho protegido stage -> main.
