# Intent

## Problema

No modal **Cadastrar Animal** da Agenda, o campo de raça era texto livre. Isso
permitia grafias divergentes para a mesma raça e não oferecia uma forma segura
de manter as opções disponíveis no cadastro.

## Resultado esperado

Disponibilizar um catálogo de raças por espécie, ordenado alfabeticamente, no
qual a equipe possa cadastrar, editar e excluir opções sem alterar a raça já
gravada nos pacientes existentes.

## Limites da entrega

- A gestão atende ao modal de cadastro de animal da Agenda.
- O catálogo aproveita a persistência local de raças já existente no frontend.
- Não haverá sincronização entre navegadores nem atualização em massa de
  prontuários nesta entrega.
