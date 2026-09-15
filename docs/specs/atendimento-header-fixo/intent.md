# Intent - atendimento-header-fixo

Data: 2026-08-10
Responsavel: Claude (pareado com Martiniano)
Status: em andamento

## 1) Problema atual

GitHub issue #20 ("[UX] Header do prontuário não é fixo: paciente e
ações desaparecem ao rolar"), origem achado #1 da auditoria UX/fluxo
(`docs/AUDITORIA-ATENDIMENTO-UX-FLUXO-2026-08-09.md`, issue de tracking
#57): `.fc-care-header` (contem a faixa de paciente/tutor/peso/alertas
e os botoes "Novo atendimento", "Laudar", "Salvar atendimento" e
"Finalizar atendimento") e uma `<section>` comum, sem
`position: sticky`. So o painel lateral (aside) tem `xl:sticky`; o
header, a navegacao por abas e todo o conteudo de trabalho rolam junto
com a pagina.

Ao trabalhar na aba Exames, Prescricao ou no editor clinico guiado, o
veterinario rola a pagina para baixo e perde de vista qual
paciente/tutor esta editando e os unicos botoes "Salvar
atendimento"/"Finalizar atendimento" da tela - precisa rolar de volta
ao topo para salvar ou finalizar.

## 2) Objetivo

Manter `.fc-care-header` visivel ao rolar a pagina em telas largas,
usando o mesmo padrao ja estabelecido no proprio arquivo para o painel
lateral (`xl:sticky`), sem alterar o comportamento em telas menores que
`xl` (1280px).

**Achado durante a revisao adversarial (adicionado ao escopo):** o
proprio painel lateral (`.fc-care-sidebar`, "Atendimentos recentes") e
a aside de alertas/radar clinico (`.fc-care-aside`) ja usavam
`xl:sticky` com offsets pequenos (`top-6`/`top-3`, 24px/12px) - muito
menores que a altura real do header fixo (~280-320px, variavel com o
conteudo). Tornar so o header sticky, sem ajustar esses offsets,
criaria uma sobreposicao real: o header (com `z-20`) cobriria o topo
desses paineis sempre que ambos estivessem fixos simultaneamente -
inclusive a aside de alertas criticos (`atendimento-radar-alertas-
todas-abas`, issue #47), a mesma que motivou uma correcao anterior por
risco clinico. Corrigido neste mesmo pacote: os offsets `top` do
painel lateral e da aside foram aumentados (500px/488px) para folga
segura acima da altura real do header, e o `max-height` da aside foi
recalculado para continuar cabendo dentro do viewport a partir do novo
offset.

Uma segunda rodada de revisao adversarial (confirmatoria, apos a
primeira correcao) apontou que a medicao inicial da altura do header
(320.5px, usada para calcular a folga de 420px/408px) foi feita em
viewport 1440px, mais largo que o minimo em que o breakpoint `xl` ja
ativa esse comportamento (1280px) - e sem confirmar o cenario com o
bloco condicional "Horario da OS" (aparece quando ha agendamento
vinculado) somado ao rotulo de botao mais longo. Em vez de reproduzir
essa combinacao especifica no preview (o ambiente de preview local
apresentou instabilidade recorrente nesta sessao), a decisao foi
aumentar a folga para um valor confortavelmente acima do pior caso
teorico estimado pela propria revisao (~416.5px = 320.5px medido + 2
fileiras extras de botoes quebrando linha, ~48px cada) - offsets finais
500px/488px, aproximadamente 84px de folga sobre esse pior caso
teorico, em vez de reduzir o escopo a uma unica medicao pontual.

## 3) Nao objetivos

- Nao extrair uma barra de contexto compacta separada (a alternativa
  mais leve sugerida pelo issue) - a sugestao primaria do proprio issue
  ("tornar `.fc-care-header` ... sticky top-0 com fundo opaco") e
  suficiente e mais simples de implementar corretamente (mudanca so de
  CSS, sem reestruturar o JSX que hoje coloca titulo e acoes na mesma
  linha flex).
- Nao tornar o header sticky abaixo do breakpoint `xl` (1280px) -
  mesmo criterio ja usado pelo painel lateral (`xl:sticky`) nesta
  pagina; evita que o header (que empilha botoes em `flex-col` em telas
  estreitas, ficando bem mais alto) ocupe permanentemente boa parte da
  tela em tablet/mobile.
- Nao adicionar comportamento de "encolher ao rolar" (ex.: esconder
  titulo/descricao e mostrar so uma barra compacta apos X pixels de
  scroll) - fora do escopo "esforço pequeno" do issue; o header
  permanece do mesmo tamanho, so fixo.
- Nao mudar o background/gradiente do header - ja e efetivamente opaco
  (alpha 0.94-0.98 nas cores do gradiente), atendendo ao pedido de
  "fundo opaco" do issue sem precisar de alteracao.
