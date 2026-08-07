# Intent - atendimento-exame-guard-liberacao-conteudo

Data: 2026-08-07
Responsavel: Claude (Sonnet 5)
Status: done

## 1) Problema atual

Dois achados de severidade media da auditoria completa
(docs/AUDITORIA-ATENDIMENTO-ACHADOS-2026-08-04.md, achados #20 e #25), ambos
sobre a integridade do exame liberado no portal da clinica parceira:

- **#20**: `liberar_exame_no_portal` exigia apenas que
  `_anexo_eh_pdf(anexo)` fosse verdadeiro antes de liberar - essa funcao so
  confere `mime_type`/extensao do NOME do arquivo, campos totalmente
  controlados pelo cliente ao criar um anexo "externo"
  (`POST /{id}/anexos`, sem upload real). Um anexo com
  `url="http://qualquer-coisa"`, `mime_type="application/pdf"` e
  `nome_original="laudo.pdf"`, sem nunca ter passado por upload, passava
  pelo guard e liberava o exame como "resultado disponivel" no portal -
  mesmo sem nenhum arquivo real armazenado.
- **#25**: `_derivar_status_exame` preserva o status "Liberado no portal"
  contra sobrescrita por autosave (corrigido em pacote anterior), mas os
  CAMPOS de conteudo do mesmo exame - `resultado`, `valor_referencia`,
  `unidade`, `observacoes` - continuavam sendo sobrescritos
  incondicionalmente a cada PUT, independente do status atual do exame. O
  conteudo que a clinica parceira/tutor ja visualizou no portal podia mudar
  silenciosamente, sem nova notificacao e sem trilha de quem alterou.

## 2) Objetivo

Um exame so pode ser liberado no portal quando existe de fato algo
baixavel. Enquanto um exame esta liberado no portal, seu conteudo (nao so o
status) fica protegido contra sobrescrita silenciosa por save/autosave -
apenas revogar a liberacao reabre esses campos para edicao.

## 3) Nao objetivos

- Nao inclui restringir esquemas/hosts para anexos "externo" na CRIACAO
  (`POST /{id}/anexos`) - a auditoria (achado #20, secao "Ressalva sobre
  severidade") ja nota que mesmo com `attachment_has_download_source`, uma
  URL com host publico real (ainda que nao seja de fato o storage
  legitimo) passaria o guard. Fechar esse residual exigiria uma allowlist
  de hosts confiaveis para anexo "externo", que e uma mudanca de politica
  mais ampla, fora do escopo desta correcao pontual.
- Nao inclui auditoria por campo da mudanca de conteudo de exame
  (`exame_ajustes` ja rastreia `resultado`/`valor_referencia`/`unidade`/
  `observacoes` desde o pacote `atendimento-auditoria-conteudo-exame-alertas`
  - a proteção contra sobrescrita e o que faltava, nao o rastro).

## 4) Contexto e restricoes

- Restricoes tecnicas: `attachment_has_download_source` (achado #20) ja
  existe em `app/services/attachment_download_service.py`, com validacao
  anti-SSRF (`_hostname_resolves_to_public_address`) - reusado sem
  modificacao.
- Restricoes de prazo: nenhuma.
- Restricoes regulatorio/operacional: ambos os achados sao sobre a
  integridade do que a clinica parceira/tutor externos veem no portal -
  risco de exposicao/confianca, nao so tecnico.

## 5) Impacto esperado

- Usuarios impactados: veterinarios liberando exames no portal (#20);
  clinicas parceiras e tutores que acessam o portal (#20 e #25, pela
  integridade do que veem).
- Modulos impactados: apenas `backend/app/api/v1/endpoints/atendimento.py`.
- Risco de regressao: baixo - #20 adiciona uma condicao AND a um guard
  existente (so pode ficar mais restritivo); #25 move 3 atribuicoes para
  dentro de um `if` que ja existia (protegendo `observacoes`).

## 6) Riscos iniciais

- Risco 1 (identificado e corrigido durante a implementacao): os testes
  existentes de liberacao no portal usavam `caminho_arquivo` apontando para
  um caminho que nunca era escrito de fato no disco (ex.: `/tmp/ecg-luke.pdf`)
  - o novo guard de #20 corretamente rejeitava esse fixture. Corrigido
  escrevendo um arquivo real dentro do `tmpdir` de cada teste.
- Risco 2 (mitigado): #25 poderia bloquear demais se `exame.status` fosse
  lido ANTES da chamada a `_derivar_status_exame` - confirmado por leitura
  de codigo que a ordem e: deriva o status primeiro, so depois aplica o
  guard de conteudo usando o status ja derivado (preservado).

## 7) Perguntas abertas

Nenhuma - implementacao concluida e testada.

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
