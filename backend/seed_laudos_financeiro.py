"""Adiciona dados de teste para laudos e financeiro"""
import os
os.environ['DATABASE_URL'] = 'sqlite:///./fortcordis.db'
os.environ['SECRET_KEY'] = 'test-secret-key'

from app.db.database import SessionLocal
from app.models.laudo import Laudo, Exame
from app.models.financeiro import Transacao
from datetime import datetime, timedelta

db = SessionLocal()

try:
    # Verificar se já tem dados
    if db.query(Laudo).count() == 0:
        print("Criando laudos de teste...")
        laudos = [
            Laudo(
                paciente_id=1,
                veterinario_id=1,
                tipo="consulta",
                titulo="Consulta de Rotina - Rex",
                descricao="Paciente apresentou boa saúde geral",
                diagnostico=" Saudável",
                status="Finalizado",
                data_laudo=datetime.now(),
                criado_por_id=1,
                criado_por_nome="Administrador"
            ),
            Laudo(
                paciente_id=2,
                veterinario_id=1,
                tipo="exame",
                titulo="Exame de Sangue - Luna",
                descricao="Hemograma completo",
                diagnostico="Aguardando resultados",
                status="Rascunho",
                data_laudo=datetime.now(),
                criado_por_id=1,
                criado_por_nome="Administrador"
            ),
        ]
        db.add_all(laudos)
        db.commit()
        print(f"  {len(laudos)} laudos criados")

    if db.query(Exame).count() == 0:
        print("Criando exames de teste...")
        exames = [
            Exame(
                paciente_id=2,
                tipo_exame="Sangue",
                status="Solicitado",
                valor=150.00,
                data_solicitacao=datetime.now(),
                criado_por_id=1,
                criado_por_nome="Administrador"
            ),
            Exame(
                paciente_id=1,
                tipo_exame="Raio-X",
                status="Concluido",
                valor=200.00,
                resultado="Nenhuma anomalia detectada",
                data_solicitacao=datetime.now() - timedelta(days=2),
                data_resultado=datetime.now(),
                criado_por_id=1,
                criado_por_nome="Administrador"
            ),
            Exame(
                paciente_id=3,
                tipo_exame="Ultrassom",
                status="Solicitado",
                valor=350.00,
                data_solicitacao=datetime.now(),
                criado_por_id=1,
                criado_por_nome="Administrador"
            ),
        ]
        db.add_all(exames)
        db.commit()
        print(f"  {len(exames)} exames criados")

    if db.query(Transacao).count() == 0:
        print("Criando transações de teste...")
        transacoes = [
            # Entradas
            Transacao(
                tipo="entrada",
                categoria="consulta",
                valor=150.00,
                valor_final=150.00,
                forma_pagamento="pix",
                status="Recebido",
                paciente_id=1,
                paciente_nome="Rex",
                descricao="Consulta de rotina",
                data_transacao=datetime.now(),
                criado_por_id=1,
                criado_por_nome="Administrador"
            ),
            Transacao(
                tipo="entrada",
                categoria="exame",
                valor=200.00,
                valor_final=180.00,
                desconto=20.00,
                forma_pagamento="cartao_credito",
                status="Recebido",
                paciente_id=2,
                paciente_nome="Luna",
                descricao="Exame de sangue",
                data_transacao=datetime.now() - timedelta(days=1),
                criado_por_id=1,
                criado_por_nome="Administrador"
            ),
            Transacao(
                tipo="entrada",
                categoria="banho_tosa",
                valor=120.00,
                valor_final=120.00,
                forma_pagamento="dinheiro",
                status="Pendente",
                paciente_id=3,
                paciente_nome="Thor",
                descricao="Banho e tosa",
                data_transacao=datetime.now(),
                criado_por_id=1,
                criado_por_nome="Administrador"
            ),
            # Saídas
            Transacao(
                tipo="saida",
                categoria="fornecedor",
                valor=500.00,
                valor_final=500.00,
                forma_pagamento="transferencia",
                status="Pago",
                descricao="Compra de ração",
                data_transacao=datetime.now() - timedelta(days=3),
                criado_por_id=1,
                criado_por_nome="Administrador"
            ),
            Transacao(
                tipo="saida",
                categoria="salario",
                valor=2000.00,
                valor_final=2000.00,
                forma_pagamento="transferencia",
                status="Pago",
                descricao="Pagamento funcionários",
                data_transacao=datetime.now() - timedelta(days=5),
                criado_por_id=1,
                criado_por_nome="Administrador"
            ),
        ]
        db.add_all(transacoes)
        db.commit()
        print(f"  {len(transacoes)} transações criadas")

    print("\nDados de teste criados com sucesso!")

except Exception as e:
    print(f"Erro: {e}")
    db.rollback()
finally:
    db.close()
