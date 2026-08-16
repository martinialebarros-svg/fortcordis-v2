import os
import sys
import tempfile
import unittest
import unittest.mock
from datetime import datetime, timedelta
from pathlib import Path
from types import SimpleNamespace

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

BACKEND_DIR = Path(__file__).resolve().parents[1]
os.chdir(BACKEND_DIR)
sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "sqlite:///./fortcordis.db")
os.environ.setdefault("SECRET_KEY", "laudos-fila-pendentes-test-secret-key-1234567890")

from app.api.v1.endpoints import laudos
from app.models.agendamento import Agendamento
from app.models.atendimento_clinico import AtendimentoClinico
from app.models.clinica import Clinica
from app.models.configuracao import Configuracao
from app.models.laudo import Exame, Laudo
from app.models.paciente import Paciente
from app.models.tutor import Tutor


class LaudosFilaPendentesTest(unittest.TestCase):
    def _build_session(self):
        tmpdir = tempfile.TemporaryDirectory()
        db_path = Path(tmpdir.name) / "laudos-fila-pendentes.db"
        engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
        for table in (
            Paciente.__table__,
            Tutor.__table__,
            Clinica.__table__,
            Agendamento.__table__,
            AtendimentoClinico.__table__,
            Exame.__table__,
            Laudo.__table__,
            Configuracao.__table__,
        ):
            table.create(engine, checkfirst=True)
        session_factory = sessionmaker(bind=engine, autocommit=False, autoflush=False)
        return tmpdir, session_factory(), engine

    def _user(self):
        return SimpleNamespace(id=1, nome="Dr Teste")

    def _seed_atendimento(self, db, *, agendamento_status: str, data_atendimento: datetime, clinica_id=None):
        tutor = Tutor(nome="Tutor Teste")
        db.add(tutor)
        db.flush()
        paciente = Paciente(nome="Paciente Teste", tutor_id=tutor.id)
        db.add(paciente)
        db.flush()
        agendamento = Agendamento(inicio=data_atendimento, status=agendamento_status)
        db.add(agendamento)
        db.flush()
        atendimento = AtendimentoClinico(
            paciente_id=paciente.id,
            tutor_id=tutor.id,
            clinica_id=clinica_id,
            agendamento_id=agendamento.id,
            veterinario_id=1,
            data_atendimento=data_atendimento,
            status="Concluido",
        )
        db.add(atendimento)
        db.commit()
        return paciente, tutor, agendamento, atendimento

    def test_exame_realizado_sem_laudo_aparece_na_fila(self) -> None:
        tmpdir, db, engine = self._build_session()
        try:
            _, _, _, atendimento = self._seed_atendimento(
                db, agendamento_status="Realizado", data_atendimento=datetime(2026, 8, 10, 10, 0)
            )
            exame = Exame(atendimento_id=atendimento.id, paciente_id=atendimento.paciente_id, tipo_exame="Ecocardiograma")
            db.add(exame)
            db.commit()

            resultado = laudos.listar_laudos_pendentes(db=db, current_user=self._user())

            self.assertEqual(resultado["total"], 1)
            self.assertEqual(resultado["items"][0]["exame_id"], exame.id)
            self.assertFalse(resultado["items"][0]["tem_rascunho"])
        finally:
            db.close()
            engine.dispose()
            tmpdir.cleanup()

    def test_exame_com_laudo_rascunho_aparece_na_fila(self) -> None:
        tmpdir, db, engine = self._build_session()
        try:
            _, _, _, atendimento = self._seed_atendimento(
                db, agendamento_status="Realizado", data_atendimento=datetime(2026, 8, 10, 10, 0)
            )
            laudo = Laudo(paciente_id=atendimento.paciente_id, veterinario_id=1, tipo="ecocardiograma", titulo="L", status="Rascunho")
            db.add(laudo)
            db.commit()
            exame = Exame(
                atendimento_id=atendimento.id,
                paciente_id=atendimento.paciente_id,
                tipo_exame="Ecocardiograma",
                laudo_id=laudo.id,
            )
            db.add(exame)
            db.commit()

            resultado = laudos.listar_laudos_pendentes(db=db, current_user=self._user())

            self.assertEqual(resultado["total"], 1)
            self.assertTrue(resultado["items"][0]["tem_rascunho"])
        finally:
            db.close()
            engine.dispose()
            tmpdir.cleanup()

    def test_exame_de_agendamento_nao_realizado_nao_aparece(self) -> None:
        tmpdir, db, engine = self._build_session()
        try:
            _, _, _, atendimento = self._seed_atendimento(
                db, agendamento_status="Confirmado", data_atendimento=datetime(2026, 8, 10, 10, 0)
            )
            exame = Exame(atendimento_id=atendimento.id, paciente_id=atendimento.paciente_id, tipo_exame="Ecocardiograma")
            db.add(exame)
            db.commit()

            resultado = laudos.listar_laudos_pendentes(db=db, current_user=self._user())

            self.assertEqual(resultado["total"], 0)
        finally:
            db.close()
            engine.dispose()
            tmpdir.cleanup()

    def test_exame_com_laudo_finalizado_nao_aparece(self) -> None:
        tmpdir, db, engine = self._build_session()
        try:
            _, _, _, atendimento = self._seed_atendimento(
                db, agendamento_status="Realizado", data_atendimento=datetime(2026, 8, 10, 10, 0)
            )
            laudo = Laudo(paciente_id=atendimento.paciente_id, veterinario_id=1, tipo="ecocardiograma", titulo="L", status="Finalizado")
            db.add(laudo)
            db.commit()
            exame = Exame(
                atendimento_id=atendimento.id,
                paciente_id=atendimento.paciente_id,
                tipo_exame="Ecocardiograma",
                laudo_id=laudo.id,
            )
            db.add(exame)
            db.commit()

            resultado = laudos.listar_laudos_pendentes(db=db, current_user=self._user())

            self.assertEqual(resultado["total"], 0)
        finally:
            db.close()
            engine.dispose()
            tmpdir.cleanup()

    def test_exame_sem_atendimento_nao_aparece(self) -> None:
        tmpdir, db, engine = self._build_session()
        try:
            paciente = Paciente(nome="Paciente Solto")
            db.add(paciente)
            db.commit()
            exame = Exame(paciente_id=paciente.id, tipo_exame="Eletrocardiograma")
            db.add(exame)
            db.commit()

            resultado = laudos.listar_laudos_pendentes(db=db, current_user=self._user())

            self.assertEqual(resultado["total"], 0)
        finally:
            db.close()
            engine.dispose()
            tmpdir.cleanup()

    def test_exame_atrasado_recebe_selo_atrasado(self) -> None:
        tmpdir, db, engine = self._build_session()
        try:
            # Realizado ha bem mais de 48h uteis (dias corridos, sem feriado).
            data_antiga = datetime.utcnow() - timedelta(days=10)
            _, _, _, atendimento = self._seed_atendimento(
                db, agendamento_status="Realizado", data_atendimento=data_antiga
            )
            exame = Exame(atendimento_id=atendimento.id, paciente_id=atendimento.paciente_id, tipo_exame="Ecocardiograma")
            db.add(exame)
            db.commit()

            resultado = laudos.listar_laudos_pendentes(db=db, current_user=self._user())

            self.assertTrue(resultado["items"][0]["atrasado"])
        finally:
            db.close()
            engine.dispose()
            tmpdir.cleanup()

    def test_urgente_aparece_primeiro_mesmo_sendo_mais_recente(self) -> None:
        tmpdir, db, engine = self._build_session()
        try:
            _, _, _, atendimento_antigo = self._seed_atendimento(
                db, agendamento_status="Realizado", data_atendimento=datetime(2026, 8, 1, 10, 0)
            )
            exame_antigo = Exame(
                atendimento_id=atendimento_antigo.id,
                paciente_id=atendimento_antigo.paciente_id,
                tipo_exame="Ecocardiograma",
                urgente_laudo=False,
            )
            db.add(exame_antigo)

            _, _, _, atendimento_recente = self._seed_atendimento(
                db, agendamento_status="Realizado", data_atendimento=datetime(2026, 8, 15, 10, 0)
            )
            exame_urgente = Exame(
                atendimento_id=atendimento_recente.id,
                paciente_id=atendimento_recente.paciente_id,
                tipo_exame="Ecocardiograma",
                urgente_laudo=True,
            )
            db.add(exame_urgente)
            db.commit()

            resultado = laudos.listar_laudos_pendentes(db=db, current_user=self._user())

            self.assertEqual(resultado["total"], 2)
            self.assertEqual(resultado["items"][0]["exame_id"], exame_urgente.id)
            self.assertTrue(resultado["items"][0]["urgente"])
        finally:
            db.close()
            engine.dispose()
            tmpdir.cleanup()

    def test_toggle_urgente_via_atualizar_exame(self) -> None:
        tmpdir, db, engine = self._build_session()
        try:
            paciente = Paciente(nome="Paciente Teste")
            db.add(paciente)
            db.commit()
            exame = Exame(paciente_id=paciente.id, tipo_exame="Ecocardiograma")
            db.add(exame)
            db.commit()

            from fastapi import Request

            request = Request(
                {
                    "type": "http",
                    "method": "PUT",
                    "path": f"/api/v1/exames/{exame.id}",
                    "headers": [],
                    "client": ("127.0.0.1", 1234),
                    "server": ("testserver", 80),
                    "scheme": "http",
                    "query_string": b"",
                }
            )
            with unittest.mock.patch(
                "app.api.v1.endpoints.laudos.registrar_auditoria", return_value=None
            ):
                laudos.atualizar_exame(
                    exame_id=exame.id,
                    exame_data={"urgente_laudo": True},
                    request=request,
                    db=db,
                    current_user=self._user(),
                )

            db.refresh(exame)
            self.assertTrue(exame.urgente_laudo)
        finally:
            db.close()
            engine.dispose()
            tmpdir.cleanup()

    def test_agilidade_calcula_percentual_e_tendencia(self) -> None:
        tmpdir, db, engine = self._build_session()
        try:
            agora = datetime.utcnow()

            # Janela atual (ultimos 90 dias): 1 no prazo, 1 atrasado -> 50%.
            _, _, _, atendimento_1 = self._seed_atendimento(
                db, agendamento_status="Realizado", data_atendimento=agora - timedelta(days=10)
            )
            laudo_1 = Laudo(
                paciente_id=atendimento_1.paciente_id,
                veterinario_id=1,
                tipo="ecocardiograma",
                titulo="L1",
                status="Finalizado",
                finalizado_em=agora - timedelta(days=10) + timedelta(hours=10),
            )
            db.add(laudo_1)
            db.commit()
            db.add(
                Exame(
                    atendimento_id=atendimento_1.id,
                    paciente_id=atendimento_1.paciente_id,
                    tipo_exame="Ecocardiograma",
                    laudo_id=laudo_1.id,
                )
            )

            _, _, _, atendimento_2 = self._seed_atendimento(
                db, agendamento_status="Realizado", data_atendimento=agora - timedelta(days=20)
            )
            laudo_2 = Laudo(
                paciente_id=atendimento_2.paciente_id,
                veterinario_id=1,
                tipo="ecocardiograma",
                titulo="L2",
                status="Finalizado",
                finalizado_em=agora - timedelta(days=5),  # 15 dias corridos depois = bem atrasado
            )
            db.add(laudo_2)
            db.commit()
            db.add(
                Exame(
                    atendimento_id=atendimento_2.id,
                    paciente_id=atendimento_2.paciente_id,
                    tipo_exame="Ecocardiograma",
                    laudo_id=laudo_2.id,
                )
            )
            db.commit()

            resultado = laudos.obter_agilidade_laudos(db=db, current_user=self._user())

            self.assertEqual(resultado["janela_atual"]["total_finalizados"], 2)
            self.assertEqual(resultado["janela_atual"]["no_prazo"], 1)
            self.assertEqual(resultado["janela_atual"]["percentual_no_prazo"], 50.0)
            # Sem dados na janela anterior (91-180 dias atras) -> tendencia None.
            self.assertIsNone(resultado["tendencia"])
        finally:
            db.close()
            engine.dispose()
            tmpdir.cleanup()


if __name__ == "__main__":
    unittest.main()
