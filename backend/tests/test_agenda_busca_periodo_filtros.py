import os
import sys
import tempfile
import unittest
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

BACKEND_DIR = Path(__file__).resolve().parents[1]
os.chdir(BACKEND_DIR)
sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "sqlite:///./fortcordis.db")
os.environ.setdefault("SECRET_KEY", "agenda-busca-periodo-test-secret-key-1234567890")

from app.api.v1.endpoints import agenda
from app.models.agendamento import Agendamento
from app.models.clinica import Clinica
from app.models.configuracao import Configuracao
from app.models.paciente import Paciente
from app.models.servico import Servico
from app.models.tutor import Tutor


class AgendaBuscaPeriodoFiltrosTest(unittest.TestCase):
    def _build_session(self):
        tmpdir = tempfile.TemporaryDirectory()
        db_path = Path(tmpdir.name) / "agenda-busca-periodo.db"
        engine = create_engine(f"sqlite:///{db_path}")
        for table in (
            Agendamento.__table__,
            Tutor.__table__,
            Paciente.__table__,
            Clinica.__table__,
            Servico.__table__,
            Configuracao.__table__,
        ):
            table.create(engine, checkfirst=True)
        session = sessionmaker(bind=engine, autocommit=False, autoflush=False)()
        return tmpdir, session, engine

    def _seed_base(self, db):
        tutor_1 = Tutor(nome="Maria Oliveira", telefone="85999990001", ativo=1)
        tutor_2 = Tutor(nome="Joao Pereira", telefone="85999990002", ativo=1)

        db.add_all([tutor_1, tutor_2])
        db.commit()
        db.refresh(tutor_1)
        db.refresh(tutor_2)

        paciente_1 = Paciente(tutor_id=tutor_1.id, nome="Luna", especie="Canina", ativo=1)
        paciente_2 = Paciente(tutor_id=tutor_2.id, nome="Thor", especie="Canina", ativo=1)
        clinica_1 = Clinica(nome="Pet Center", ativo=True)
        clinica_2 = Clinica(nome="Cardio Vet", ativo=True)
        servico_1 = Servico(nome="Ecocardiograma", ativo=True)
        servico_2 = Servico(nome="Consulta", ativo=True)

        db.add_all([paciente_1, paciente_2, clinica_1, clinica_2, servico_1, servico_2])
        db.commit()

        db.refresh(paciente_1)
        db.refresh(paciente_2)
        db.refresh(clinica_1)
        db.refresh(clinica_2)
        db.refresh(servico_1)
        db.refresh(servico_2)

        return {
            "tutor_1": tutor_1,
            "tutor_2": tutor_2,
            "paciente_1": paciente_1,
            "paciente_2": paciente_2,
            "clinica_1": clinica_1,
            "clinica_2": clinica_2,
            "servico_1": servico_1,
            "servico_2": servico_2,
        }

    def _criar_agendamento(
        self,
        db,
        *,
        data: str,
        hora: str,
        status: str,
        paciente_id=None,
        clinica_id=None,
        servico_id=None,
        paciente_nome=None,
        tutor_nome=None,
        clinica_nome=None,
        servico_nome=None,
    ):
        inicio = datetime.fromisoformat(f"{data}T{hora}:00")
        agendamento = Agendamento(
            paciente_id=paciente_id,
            clinica_id=clinica_id,
            servico_id=servico_id,
            inicio=inicio,
            fim=inicio,
            data=data,
            hora=hora,
            status=status,
            paciente=paciente_nome,
            tutor=tutor_nome,
            clinica=clinica_nome,
            servico=servico_nome,
        )
        db.add(agendamento)
        db.commit()
        db.refresh(agendamento)
        return agendamento

    def test_busca_por_periodo_e_nome_paciente_com_fallback_legado(self) -> None:
        tmpdir, db, engine = self._build_session()
        try:
            base = self._seed_base(db)
            ag_1 = self._criar_agendamento(
                db,
                data="2026-07-10",
                hora="09:00",
                status="Agendado",
                paciente_id=base["paciente_1"].id,
                clinica_id=base["clinica_1"].id,
                servico_id=base["servico_1"].id,
            )
            self._criar_agendamento(
                db,
                data="2026-07-11",
                hora="11:00",
                status="Confirmado",
                paciente_id=base["paciente_2"].id,
                clinica_id=base["clinica_2"].id,
                servico_id=base["servico_2"].id,
            )
            ag_legado = self._criar_agendamento(
                db,
                data="2026-07-12",
                hora="14:00",
                status="Agendado",
                paciente_nome="Luna Legacy",
                tutor_nome="Maria Legacy",
                clinica_nome="Clinica Legada",
                servico_nome="Servico Legado",
            )
            self._criar_agendamento(
                db,
                data="2026-08-02",
                hora="10:00",
                status="Agendado",
                paciente_id=base["paciente_1"].id,
                clinica_id=base["clinica_1"].id,
                servico_id=base["servico_1"].id,
            )

            resultado = agenda.listar_agendamentos(
                data_inicio="2026-07-01",
                data_fim="2026-07-31",
                paciente_nome="Luna",
                db=db,
                current_user=SimpleNamespace(id=1),
            )

            self.assertEqual(resultado["total"], 2)
            ids = [item["id"] for item in resultado["items"]]
            self.assertEqual(ids, [ag_1.id, ag_legado.id])
        finally:
            db.close()
            engine.dispose()
            tmpdir.cleanup()

    def test_filtros_combinados_por_periodo_tutor_status_clinica_servico(self) -> None:
        tmpdir, db, engine = self._build_session()
        try:
            base = self._seed_base(db)
            self._criar_agendamento(
                db,
                data="2026-07-15",
                hora="08:30",
                status="Confirmado",
                paciente_id=base["paciente_1"].id,
                clinica_id=base["clinica_1"].id,
                servico_id=base["servico_1"].id,
            )
            ag_match = self._criar_agendamento(
                db,
                data="2026-07-15",
                hora="10:00",
                status="Realizado",
                paciente_id=base["paciente_2"].id,
                clinica_id=base["clinica_2"].id,
                servico_id=base["servico_2"].id,
            )
            self._criar_agendamento(
                db,
                data="2026-07-20",
                hora="12:00",
                status="Realizado",
                paciente_id=base["paciente_2"].id,
                clinica_id=base["clinica_1"].id,
                servico_id=base["servico_2"].id,
            )

            resultado = agenda.listar_agendamentos(
                data_inicio="2026-07-01",
                data_fim="2026-07-31",
                status="Realizado",
                clinica_id=base["clinica_2"].id,
                servico_id=base["servico_2"].id,
                tutor_nome="Joao",
                db=db,
                current_user=SimpleNamespace(id=1),
            )

            self.assertEqual(resultado["total"], 1)
            self.assertEqual(len(resultado["items"]), 1)
            self.assertEqual(resultado["items"][0]["id"], ag_match.id)
            self.assertEqual(resultado["items"][0]["status"], "Realizado")
        finally:
            db.close()
            engine.dispose()
            tmpdir.cleanup()


if __name__ == "__main__":
    unittest.main()
