# Plano

1. Extrair funções de painéis customizados para `app/services/atendimento/painel_service.py`.
2. Atualizar endpoints para consumir service mantendo assinatura e fluxo existentes.
3. Extrair CRUD de frases clínicas para `app/services/atendimento/clinical_phrase_crud_service.py`.
4. Atualizar endpoints de frases clínicas para consumir service mantendo contrato.
5. Extrair CRUD de templates para `app/services/atendimento/document_template_crud_service.py`.
6. Atualizar endpoints de templates para consumir service mantendo contrato.
7. Extrair CRUD de documentos para `app/services/atendimento/document_crud_service.py` (listar, atualizar, excluir + helpers de serialização/getter).
8. Atualizar endpoints de documentos para consumir service mantendo contrato.
9. Executar testes focados de painéis, frases clínicas e documentos para validar não-regressão.
10. Publicar evidências no verify.
