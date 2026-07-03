# Spec - patient-tutor-portal-readiness

Data: 2026-06-30
Responsavel: Equipe FortCordis
Status: done

## 1) Escopo funcional

Reformar o cadastro de pacientes/tutores para que a operacao consiga preparar dados do portal de exames sem depender de IDs invisiveis ou tutor como texto solto.

## 2) Requisitos funcionais

- RF-001: a edicao de clinica deve mostrar o ID interno usado no portal da clinica parceira.
- RF-002: a lista de pacientes deve mostrar `Pet #id` e `Tutor #id` quando houver tutor vinculado.
- RF-003: o cadastro de novo paciente deve separar dados do tutor e dados do pet.
- RF-004: o cadastro de novo paciente deve aceitar email, telefone, WhatsApp, CPF e endereco do tutor.
- RF-005: o cadastro de novo paciente deve permitir salvar um pet e continuar cadastrando outro para o mesmo tutor.
- RF-006: a edicao de paciente deve mostrar `ID do pet` e `ID do tutor`.
- RF-007: a edicao de paciente deve permitir atualizar dados complementares do tutor junto com os dados do pet.
- RF-008: a API de pacientes deve manter compatibilidade com payloads antigos que enviam apenas `tutor`.

## 3) Requisitos nao funcionais

- NFR-001: a mudanca nao deve criar migracao pesada; deve reaproveitar a tabela `tutores` e o campo `pacientes.tutor_id`.
- NFR-002: dados de tutor em branco nao devem apagar dados existentes inadvertidamente.
- NFR-003: a interface deve continuar responsiva em desktop e mobile.
- NFR-004: a reforma deve preservar listagem, edicao e exclusao em lote de pacientes.

## 4) Contratos tecnicos

### API

- `POST /api/v1/pacientes` passa a aceitar:
  - `tutor_id`
  - `tutor_email`
  - `tutor_telefone`
  - `tutor_whatsapp`
  - `tutor_cpf`
  - `tutor_cep`
  - `tutor_endereco`
  - `tutor_numero`
  - `tutor_complemento`
  - `tutor_bairro`
  - `tutor_cidade`
  - `tutor_estado`
- `PUT /api/v1/pacientes/{paciente_id}` aceita os mesmos campos.
- `GET /api/v1/pacientes` retorna `tutor_id`, `tutor_email`, `tutor_telefone` e `tutor_whatsapp`.
- `GET /api/v1/pacientes/{paciente_id}` retorna os dados complementares do tutor.

### Banco/migracoes

- Sem migracao nova.
- Usa `tutores` existente para dados do responsavel.
- Usa `pacientes.tutor_id` existente para multiplos pets por tutor.

### Frontend

- Telas afetadas:
  - `frontend/app/clinicas/[id]/page.tsx`
  - `frontend/app/pacientes/page.tsx`
  - `frontend/app/pacientes/novo/page.tsx`
  - `frontend/app/pacientes/[id]/page.tsx`

## 5) Criterios de aceitacao

- CA-001: edicao de clinica exibe o ID da clinica.
- CA-002: lista de pacientes exibe ID do pet e ID do tutor.
- CA-003: novo paciente salva dados complementares do tutor.
- CA-004: novo paciente permite salvar outro pet mantendo o mesmo tutor.
- CA-005: edicao de paciente mostra ID do pet, ID do tutor e dados complementares do tutor.
- CA-006: API reutiliza o mesmo tutor para mais de um pet quando `tutor_id` e fornecido.
- CA-007: testes backend e build frontend passam.

## 6) Fora de escopo

- Busca/autocomplete dedicado de tutores.
- Mesclagem assistida de tutores duplicados.
- Portal por CPF ou email sem informar IDs.
- WhatsApp via API Meta antes da liberacao da empresa.

