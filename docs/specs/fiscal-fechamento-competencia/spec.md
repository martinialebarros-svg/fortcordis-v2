# Especificação — fechamento fiscal por competência

## Requisitos

- RF-01: prévia mensal YYYY-MM baseada em data_atendimento da OS no fuso America/Fortaleza, sem depender do pagamento. Datas sem fuso já existentes seguem a convenção local da OS. Informar claramente a necessidade de conferir data de prestação.
- RF-02: listar serviços, valores e pendências; excluir canceladas do total elegível. Cadastros incompletos e pacotes já preparados ficam visíveis e não selecionáveis. Não esconder clínicas inativas que têm serviços históricos.
- RF-03: pacote só aceita seleção integralmente válida, no mês solicitado, sem IDs repetidos, canceladas ou OS já vinculadas a outro pacote. Exclusividade por OS garantida no banco, inclusive sob concorrência. Erro não gera pacote parcial.
- RF-04: requisição tem chave de idempotência; repetição da mesma operação devolve o pacote persistido. Reuso da chave com outro conteúdo falha. Baixar novamente mantém identidade, bytes, seleção e valores.
- RF-05: exportações legadas são aviso de conferência; inclusão exige reconhecimento explícito. Elas não comprovam envio ou nota emitida. Preservar histórico legado.
- RF-06: ZIP contém XLSX (resumo por tomador/competência, serviços/OS e pendências), PDF de conferência, texto copiável e manifesto. Não incluir paciente, tutor ou informação clínica. Cadastro do tomador PJ vem da clínica; PF vem do cadastro do tomador. Agrupar CPF/CNPJ confirmado e competência sem misturar pessoas.
- RF-07: pacote não presume ISS, CNAE do tomador como atividade do prestador ou emissão fiscal. Identificar relatório informativo para contador.
- RF-08: frontend oferece mês/ano, prévia, seleção de aptas, conferência das datas, preparação e download do mesmo pacote no histórico. Nenhuma chamada de envio ou emissão de nota.
- RF-09: rotas autenticadas e protegidas pela permissão fiscal existente. Falha de histórico/consulta não é apresentada como ausência de registros.
- RF-10: preservar CPF/CNPJ como texto, inclusive CNPJ alfanumérico já cadastrado; validar dígitos verificadores sem apagar letras. Referência: [manual da Receita Federal](https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/documentos-tecnicos/cnpj/manual-dv-cnpj.pdf). Consulta externa automática de CNPJ não é alterada nesta etapa.
- RF-11: canário de stage executa sob o usuário efetivo do serviço backend informado pelo systemd; mantém as permissões restritas do arquivo de configuração e não imprime credenciais.
  Cadastros sintéticos preenchem as chaves normalizadas e espécie vazia exigidas pelo schema legado confirmado em stage; cada serviço recebe nome único e os números de OS respeitam VARCHAR(50). Nenhuma restrição do banco é relaxada para o teste.

## Contrato

- GET /fiscal/fechamentos/previa?competencia=YYYY-MM: competência, datas limite, items com elegivel/motivos_pendencia/fechamento_id/exportacoes_anteriores e resumo de quantidades/valores.
- POST /fiscal/fechamentos: competencia, os_ids, chave_idempotencia UUID, confirmar_datas_prestacao e confirmar_exportacoes_anteriores. Devolve ZIP e X-Fechamento-Id.
- GET /fiscal/fechamentos: histórico dos pacotes preparados.
- GET /fiscal/fechamentos/{id}/download: pacote persistido, sem novo registro.

## Critérios de aceite

1. Serviço 31/08 recebido depois permanece em agosto; setembro não entra na seleção agosto. Limites UTC/local respeitados.
   Fixtures PostgreSQL declaram o fuso da prestação explicitamente; testes usam sessão UTC para não depender do fuso da máquina ou do runner.
2. Canceladas não entram na preparação nem nos totais aptos; IDs repetidos e inexistentes são recusados.
3. Concorrência e repetição não duplicam OS; retry preserva os bytes. Segundo pacote de OS já preparada retorna conflito com pacote anterior.
4. Resumo por documento reconcilia com detalhes usando valores monetários exatos; pacote omite dados clínicos e contém informações do tomador e prestador.
5. Exportação legada exige reconhecimento, não é confundida com emissão da nota; baixar pacote é segunda via do mesmo pacote.
6. Página e API servidas em stage correspondem ao SHA validado. A publicação posterior em produção exige autorização explícita e preserva o código fiscal aprovado, sem copiar dados de teste, emitir notas ou enviar informações automaticamente.

## Rollback

Migração aditiva com tabelas novas de pacotes e vínculo exclusivo por OS. Reversão da aplicação mantém tabelas e histórico inertes; não apagar pacotes durante rollback. Dados existentes não são reclassificados.
