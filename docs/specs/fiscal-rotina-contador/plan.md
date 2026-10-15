# Plano

1. Reutilizar o worktree fiscal isolado, atualizado de origin/stage, preservando o checkout principal e as outras features.
2. Criar preferências fiscais separadas por clínica e eventos de andamento por OS, com migração aditiva após o máximo remoto 97, RLS e revogações públicas. Não reclassificar OS nem modificar datas, recebimentos ou pacotes já preparados.
3. Implementar prévia por rotina e preparação manual sobre o núcleo transacional existente. Preservar o fingerprint e os bytes das operações mensais antigas; contexto de rotina participa da idempotência das operações novas.
4. Usar vínculos operacionais diretos para confirmar realização; não inferir prestação a partir de pagamento, data ou coincidência de paciente. Validar novamente preferência, escopo e realização na preparação.
5. Acrescentar fila semanal, fila por serviço, conferência mensal, preferências explícitas e acompanhamento manual por OS. Recuperar segunda via sem alterar o arquivo.
6. Testar cortes/fusos/mês, backlog, preferência padrão e Vet Fauna, seleção individual, concorrência, idempotência e transições. Conferir ausência de NotaFiscal e mensageria, privacidade do pacote e limpeza do canário sintético de stage.
7. Publicar por PR de feature para stage, aguardar CI/deploy terminais, verificar SHA, migração, runtime/restore, rotas/bundles e UI autenticada. O canário usa apenas fixtures próprias e remove suas linhas em conexão separada.
8. Registrar evidência e limitações sem promover main. Uma futura publicação em produção depende de nova autorização.
