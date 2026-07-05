import os
import sys
import tempfile
import unittest
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from starlette.requests import Request

BACKEND_DIR = Path(__file__).resolve().parents[1]
os.chdir(BACKEND_DIR)
sys.path.insert(0, str(BACKEND_DIR))

from app.api.v1.endpoints import laudos
from app.core.portal_release import PORTAL_RELEASED_STATUS
from app.models.laudo import Exame, Laudo


def _make_request() -> Request:
    scope = {
        "type": "http",
        "method": "POST",
        "path": "/api/v1/laudos/1/portal/liberar-clinica",
        "raw_path": b"/api/v1/laudos/1/portal/liberar-clinica",
        "query_string": b"",
        "headers": [],
        "client": ("testclient", 50000),
        "server": ("testserver", 80),
        "scheme": "http",
        "http_version": "1.1",
    }
    return Request(scope)


class LaudoPortalReleaseTest(unittest.TestCase):
    def _build_session(self):
        tmpdir = tempfile.TemporaryDirectory()
        db_path = Path(tmpdir.name) / "laudo-portal-release.db"
        engine = create_engine(f"sqlite:///{db_path}")
        for table in (Laudo.__table__, Exame.__table__):
            table.create(engine, checkfirst=True)
        session = sessionmaker(bind=engine, autocommit=False, autoflush=False)()
        return tmpdir, session, engine

    def test_liberar_laudo_cria_exame_publicado_no_portal(self) -> None:
        tmpdir, db, engine = self._build_session()
        try:
            laudo = Laudo(
                paciente_id=182,
                veterinario_id=7,
                tipo="ecocardiograma",
                titulo="Laudo ecocardiografico - Luna",
                status="Finalizado",
                clinic_id=8,
                data_exame=datetime(2026, 7, 4, 15, 30),
                criado_por_id=7,
                criado_por_nome="Dr. Martiniano",
            )
            db.add(laudo)
            db.commit()
            db.refresh(laudo)

            current_user = SimpleNamespace(id=7, nome="Dr. Martiniano", email="vet@example.com")
            with patch.object(laudos, "registrar_auditoria", return_value=None) as audit_mock:
                response = laudos.liberar_laudo_para_portal_clinica(
                    laudo.id,
                    request=_make_request(),
                    db=db,
                    current_user=current_user,
                )

            db.refresh(laudo)
            exame = db.query(Exame).filter(Exame.laudo_id == laudo.id).first()

            self.assertEqual(response["status"], PORTAL_RELEASED_STATUS)
            self.assertEqual(laudo.status, PORTAL_RELEASED_STATUS)
            self.assertIsNotNone(exame)
            self.assertEqual(exame.status, PORTAL_RELEASED_STATUS)
            self.assertEqual(exame.paciente_id, laudo.paciente_id)
            self.assertEqual(exame.tipo_exame, "Ecocardiograma")
            self.assertEqual(exame.categoria_exame, "Laudo")
            audit_mock.assert_called_once()
        finally:
            db.close()
            engine.dispose()
            tmpdir.cleanup()

    def test_liberar_laudo_sem_clinica_e_bloqueado(self) -> None:
        tmpdir, db, engine = self._build_session()
        try:
            laudo = Laudo(
                paciente_id=182,
                veterinario_id=7,
                tipo="ecocardiograma",
                titulo="Laudo sem clinica",
                status="Finalizado",
                clinic_id=None,
                criado_por_id=7,
                criado_por_nome="Dr. Martiniano",
            )
            db.add(laudo)
            db.commit()
            db.refresh(laudo)

            current_user = SimpleNamespace(id=7, nome="Dr. Martiniano", email="vet@example.com")
            with self.assertRaises(HTTPException) as ctx:
                laudos.liberar_laudo_para_portal_clinica(
                    laudo.id,
                    request=_make_request(),
                    db=db,
                    current_user=current_user,
                )

            self.assertEqual(ctx.exception.status_code, 422)
            self.assertEqual(db.query(Exame).count(), 0)
        finally:
            db.close()
            engine.dispose()
            tmpdir.cleanup()


if __name__ == "__main__":
    unittest.main()
