# Intencao

Autorizado pelo pedido do usuario: "criar uma regra que, como perfil de admin, a gente pode fazer esse tipo de alteracao".

A correcao de um atendimento das 08:00 para 07:00 no proprio dia e bloqueada pelo calculo de primeira saida, que usa a hora atual, casa, deslocamento e margem segura. O override de deslocamento existente nao se aplica a esse calculo.

Permitir a administradores corrigir explicitamente o inicio para um horario ja passado em um atendimento existente, dispensando apenas a primeira saida nessa requisicao. Manter horario de funcionamento, conflitos de slot, origem/destino, reservas e deslocamento entre atendimentos. Nao ampliar o override para criacao ou horarios futuros, nao persistir uma dispensa reutilizavel, nao mudar permissoes e nao tocar em producao.

Risco: usar uma flag do cliente como autorizacao. Mitigacao: verificar `tem_papel("admin")` no servidor, inicio efetivamente alterado e novo inicio <= relogio local do servidor, com auditoria de antes/depois e autor.
