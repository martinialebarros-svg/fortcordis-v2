"""add_clinica_id_to_financeiro_tables

Revision ID: 20260304_07_financeiro_centro_custos
Revises: 20260304_06_agendamentos_reservado_paciente_opcional
Create Date: 2026-03-04 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260304_07_financeiro_centro_custos'
down_revision = '20260304_06_agendamentos_reservado_paciente_opcional'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Adicionar clinica_id na tabela transacoes
    op.add_column('transacoes', sa.Column('clinica_id', sa.Integer(), nullable=True))

    # Adicionar clinica_id na tabela contas_pagar
    op.add_column('contas_pagar', sa.Column('clinica_id', sa.Integer(), nullable=True))

    # Adicionar clinica_id na tabela contas_receber
    op.add_column('contas_receber', sa.Column('clinica_id', sa.Integer(), nullable=True))


def downgrade() -> None:
    # Remover clinica_id da tabela transacoes
    op.drop_column('transacoes', 'clinica_id')

    # Remover clinica_id da tabela contas_pagar
    op.drop_column('contas_pagar', 'clinica_id')

    # Remover clinica_id da tabela contas_receber
    op.drop_column('contas_receber', 'clinica_id')
