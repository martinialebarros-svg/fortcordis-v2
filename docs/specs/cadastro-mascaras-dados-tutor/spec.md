# Spec - cadastro-mascaras-dados-tutor

Data: 2026-07-16
Responsavel: Equipe FortCordis
Status: done

## 1) Escopo funcional

Aplicar uma experiencia unica de digitacao e persistencia para identificadores e contatos estruturados de tutores e clinicas.

## 2) Requisitos funcionais

- RF-001: telefone e WhatsApp devem ser formatados como `(00) 0000-0000` ou `(00) 00000-0000` durante a digitacao.
- RF-002: CPF deve ser formatado como `000.000.000-00` durante a digitacao.
- RF-003: CEP deve ser formatado como `00000-000` durante a digitacao.
- RF-004: novo paciente, edicao de paciente e complementacao cadastral no atendimento devem usar o mesmo comportamento.
- RF-005: valores ja existentes devem ser apresentados formatados, mesmo quando a API retornar apenas digitos.
- RF-006: os payloads devem enviar somente digitos para telefone, WhatsApp, CPF e CEP.
- RF-007: novo cadastro e edicao de clinica devem formatar CNPJ, telefone e CEP.
- RF-008: CNPJ deve ser formatado como `00.000.000/0000-00` e enviado somente com digitos.

## 3) Requisitos nao funcionais

- NFR-001: reutilizar os formatadores centrais de `frontend/lib/atendimento-cadastro.ts`.
- NFR-002: limitar a quantidade de caracteres conforme o formato de cada campo.
- NFR-003: disponibilizar teclado numerico ou telefonico adequado em dispositivos moveis.
- NFR-004: manter compatibilidade com valores vazios e registros antigos formatados ou nao formatados.

## 4) Telas afetadas

- `frontend/app/pacientes/novo/page.tsx`
- `frontend/app/pacientes/[id]/page.tsx`
- `frontend/app/atendimento/page.tsx`
- `frontend/app/atendimento/components/AtendimentoCadastroComplementarSection.tsx`
- `frontend/app/clinicas/novo/page.tsx`
- `frontend/app/clinicas/[id]/page.tsx`

## 5) Criterios de aceitacao

- CA-001: telefone e WhatsApp aceitam apenas ate 11 digitos e exibem mascara adequada.
- CA-002: CPF aceita apenas ate 11 digitos e exibe a mascara completa.
- CA-003: CEP aceita apenas ate 8 digitos e exibe a mascara completa.
- CA-004: colar um valor com pontuacao ou letras resulta em um valor visual valido.
- CA-005: salvar qualquer uma das telas envia os campos mascarados sem caracteres de formatacao.
- CA-006: CNPJ aceita apenas ate 14 digitos, exibe a mascara completa e e enviado sem formatacao.
- CA-007: lint e build do frontend passam.

## 6) Fora de escopo

- Validacao matematica do CPF.
- Confirmacao de titularidade de telefone ou WhatsApp.
- Alteracao retroativa dos registros ja persistidos no banco.
