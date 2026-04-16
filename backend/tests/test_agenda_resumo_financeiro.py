import os
import sys
import tempfile
import unittest
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

BACKEND_DIR = Path(__file__).resolve().parents[1]
os.chdir(BACKEND_DIR)
sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "sqlite:///./fortcordis.db")
os.environ.setdefault("SECRET_KEY", "agenda-resumo-financeiro-test-secret-key-1234567890")

from app.api.v1.endpoints import agenda
from app.models.agendamento import Agendamento
from app.models.clinica import Clinica
from app.models.ordem_servico import OrdemServico
from app.models.servico import Servico
from app.services.precos_service import calcular_preco_servico


class AgendaResumoFinanceiroTest(unittest.TestCase):
    def _build_session(self):
        tmpdir = tempfile.TemporaryDirectory()
        db_path = Path(tmpdir.name) / "agenda-resumo-financeiro.db"
        engine = create_engine(f"sqlite:///{db_path}")
        for table in (
            Agendamento.__table__,
            OrdemServico.__table__,
            Clinica.__table__,
            Servico.__table__,
        ):
            table.create(engine, checkfirst=True)
        session = sessionmaker(bind=engine, autocommit=False, autoflush=False)()
        return tmpdir, session, engine

    def _criar_agendamento(
        self,
        db,
        *,
        data: str,
        hora: str,
        status: str = "Agendado",
        clinica_id: int = 1,
        servico_id: int = 1,
    ) -> Agendamento:
        inicio = datetime.fromisoformat(f"{data}T{hora}:00")
        agendamento = Agendamento(
            paciente_id=1,
            clinica_id=clinica_id,
            servico_id=servico_id,
            inicio=inicio,
            fim=inicio,
            data=data,
            hora=hora,
            status=status,
        )
        db.add(agendamento)
        db.commit()
        db.refresh(agendamento)
        return agendamento

    def test_resumo_financeiro_ignora_falha_de_preco_em_agendamento_individual(self) -> None:
        tmpdir, db, engine = self._build_session()
        try:
            self._criar_agendamento(db, data="2026-04-16", hora="09:00", clinica_id=11, servico_id=101)
            self._criar_agendamento(db, data="2026-04-16", hora="11:00", clinica_id=22, servico_id=202)
            current_user = SimpleNamespace(tem_papel=lambda papel: papel == "admin")

            def fake_calcular_preco_servico(**kwargs):
                if kwargs["servico_id"] == 101:
                    raise RuntimeError("pricing schema drift")
                return Decimal("300.00")

            with patch.object(agenda, "calcular_preco_servico", side_effect=fake_calcular_preco_servico), patch.object(
                agenda.logger,
                "exception",
            ):
                resumo = agenda.resumo_financeiro_agenda(
                    data="2026-04-16",
                    db=db,
                    current_user=current_user,
                )

            self.assertEqual(resumo["qtd_agendados"], 2)
            self.assertEqual(resumo["valor_agendado"], 300.0)
        finally:
            db.close()
            engine.dispose()
            tmpdir.cleanup()

    def test_calcular_preco_servico_faz_fallback_quando_tabela_customizada_nao_existe(self) -> None:
        tmpdir, db, engine = self._build_session()
        try:
            clinica = Clinica(nome="Clinica teste", tabela_preco_id=4)
            servico = Servico(
                nome="Consulta",
                preco=Decimal("199.90"),
                preco_fortaleza_comercial=Decimal("150.00"),
                preco_fortaleza_plantao=Decimal("180.00"),
                preco_rm_comercial=Decimal("170.00"),
                preco_rm_plantao=Decimal("200.00"),
                preco_domiciliar_comercial=Decimal("220.00"),
                preco_domiciliar_plantao=Decimal("250.00"),
            )
            db.add_all([clinica, servico])
            db.commit()
            db.refresh(clinica)
            db.refresh(servico)

            db.execute(OrdemServico.__table__.delete())
            db.commit()

            valor = calcular_preco_servico(
                db=db,
                clinica_id=clinica.id,
                servico_id=servico.id,
                usar_preco_clinica=True,
            )

            self.assertEqual(valor, Decimal("199.90"))
        finally:
            db.close()
            engine.dispose()
            tmpdir.cleanup()


if __name__ == "__main__":
    unittest.main()
