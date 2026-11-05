# Especificação — idade e nascimento

## Contrato
- RF-01: nascimento opcional aceita data civil exata ou ano com quatro dígitos; idade informada opcional aceita anos, meses, semanas e dias. Número isolado significa anos.
- RF-02: fonte persistida `idade_fonte` distingue `nascimento` e `idade`; a última entrada editada ou seleção explícita governa o cálculo, preservando a alternativa sem a sobrescrever.
- RF-03: `idade_informada` e `idade_referencia` preservam declaração e data-base. A idade avança como estimativa; não gerar nem armazenar nascimento calculado a partir dela.
- RF-04: valores calculados de idade informada e ano isolado são identificados como estimados. Ano isolado expressa intervalo, nunca dia/mês fictícios. Datas inválidas/futuras e idade negativa são rejeitadas; referência histórica anterior à idade plausível não cria valor negativo.
- RF-05: cadastro, Agenda, Atendimento, novos laudos/edição (incluindo pressão arterial, ECG e ultrassonografia abdominal), importação assistida, prévia, PDFs e contexto dos assistentes compartilham resolução. Documentos usam a data do exame/atendimento; cadastro usa hoje em Fortaleza.
- RF-06: salvar campo alheio não reancora a idade. Cadastro legado mantém resolução anterior até alteração explícita; observações legadas não são migradas presumindo data ou fonte. Observações não relacionadas são preservadas.
- RF-07: autosave privado conserva campos e origem, mas não muda cadastro/laudo. Atualização explícita mantém transação, revisão, permissões e recibo atuais. Cache de PDF considera demografia usada.
- RF-08: fontes estimadas não removem proteção de referências pediátricas; intervalos que cruzem um ano não confirmam adulto automaticamente.

## Critérios de aceitação
- CA-01: só idade, só data, só ano, alternância de fonte e limpeza sem alternativa funcionam após salvar/reabrir.
- CA-02: avanço no tempo, virada do ano, aniversário e fevereiro, histórico, entradas inválidas e conflito legado têm provas determinísticas.
- CA-03: prévia/atualização/PDF usam a mesma fonte e data, sem apagar observações ou reancorar por gravação alheia.
- CA-04: interfaces relevantes oferecem os dois campos e mostram origem/estimativa; importação não cria nascimento.
- CA-05: migração aditiva idempotente SQLite/PostgreSQL sem backfill; validações locais, tipos, lint, build e SDD passam.

## Compatibilidade
Migração adiciona três colunas nullable; não altera RLS, permissões, vínculo tutor/pet ou dados existentes. Rollback de aplicação preserva colunas; não apagar dados para reverter. Deploy requer migração antes do backend. Sem mudança de produção nesta implementação.

## Publicação autorizada — 05/11/2026
Usuário solicitou “publique”. Ciclo Stage isolado → produção por PR direta stage/main → restauração de Stage com os trabalhos paralelos. Migração 106 após máximo remoto 105, sem backfill. Sem edição de cadastro real, assinatura, envio ou reemissão de documento real neste release.

## Compatibilidade detectada no gate completo — 05/11/2026
Data civil de fallback (`date`, sem horário) preserva o dia, enquanto timestamps UTC continuam convertidos para Fortaleza. A suíte legada agora verifica idade histórica também na pressão arterial, usa a resolução central atual nos mocks de IA/PDF e monta laudos reais na fixture do cache de imagens. O primeiro quality-gate foi interrompido antes de instalar; log de falha preservado, sem supressão de testes.

## Contrato de publicação — 05/11/2026

Promoção autorizada somente da árvore desta funcionalidade sobre main, após testes e homologação instalada de Stage. Restauração deve recompor todas as fontes anteriores de Stage, integrar a ascendência da promoção e preservar Nginx, configurações por ambiente e dados runtime. A conferência instalada cobre as sete rotas de cadastro/edição, laudos/ECG, Agenda, Atendimento e ultrassonografia, além de API protegida e cálculo de idade. Resultados e limites estão em `verify.md` e nas PRs de publicação/restauração.

