import json
import os
import sys
import tempfile
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

BACKEND_DIR = Path(__file__).resolve().parents[1]
os.chdir(BACKEND_DIR)
sys.path.insert(0, str(BACKEND_DIR))
os.environ.setdefault("DATABASE_URL", "sqlite:///./fortcordis.db")
os.environ.setdefault("SECRET_KEY", "agenda-janela-operacional-test-secret-key-1234567890")

from app.api.v1.endpoints import agenda
from app.models.agendamento import Agendamento
from app.models.clinica import Clinica
from app.models.configuracao import Configuracao


def _agenda_semanal_aberta() -> dict[str, dict[str, object]]:
    return {
        str(dia): {"ativo": True, "inicio": "08:00", "fim": "18:00"}
        for dia in range(1, 8)
    }


class AgendaSugestaoJanelaOperacionalTest(unittest.TestCase):
    def _build_session(self):
        tmpdir = tempfile.TemporaryDirectory()
        db_path = Path(tmpdir.name) / "agenda-sugestao-janela-operacional.db"
        engine = create_engine(f"sqlite:///{db_path}")
        for table in (
            Configuracao.__table__,
            Clinica.__table__,
            Agendamento.__table__,
        ):
            table.create(engine, checkfirst=True)
        session = sessionmaker(bind=engine, autocommit=False, autoflush=False)()
        return tmpdir, session, engine

    def _seed_config(self, db, *, excecoes: list[dict], regras_rota: dict | None = None):
        config = Configuracao(
            agenda_semanal=json.dumps(_agenda_semanal_aberta()),
            agenda_feriados=json.dumps([]),
            agenda_excecoes=json.dumps(excecoes),
            agenda_rota_regras=json.dumps(regras_rota) if regras_rota is not None else None,
        )
        db.add(config)
        db.commit()

    def _seed_clinicas(
        self,
        db,
        *,
        clinica_base_coords: tuple[float | None, float | None] = (None, None),
        clinica_ancora_coords: tuple[float | None, float | None] = (None, None),
    ) -> tuple[Clinica, Clinica]:
        clinica_base = Clinica(
            nome="Pet Xodo",
            ativo=True,
            latitude=clinica_base_coords[0],
            longitude=clinica_base_coords[1],
        )
        clinica_ancora = Clinica(
            nome="Pet Sanus Caucaia",
            ativo=True,
            latitude=clinica_ancora_coords[0],
            longitude=clinica_ancora_coords[1],
        )
        db.add_all([clinica_base, clinica_ancora])
        db.commit()
        db.refresh(clinica_base)
        db.refresh(clinica_ancora)
        return clinica_base, clinica_ancora

    def _criar_agendamento(self, db, *, clinica_id: int, data: str, hora: str, status: str = "Agendado") -> Agendamento:
        inicio = datetime.fromisoformat(f"{data}T{hora}:00")
        agendamento = Agendamento(
            clinica_id=clinica_id,
            inicio=inicio,
            fim=inicio + timedelta(minutes=30),
            data=data,
            hora=hora,
            status=status,
            clinica="Clinica teste",
        )
        db.add(agendamento)
        db.commit()
        db.refresh(agendamento)
        return agendamento

    def test_ancora_d2_nao_considera_dia_fechado(self) -> None:
        tmpdir, db, engine = self._build_session()
        try:
            self._seed_config(
                db,
                excecoes=[
                    {"data": "2026-05-21", "ativo": False, "inicio": "08:00", "fim": "18:00", "motivo": "Fechado"},
                ],
            )
            clinica_base, clinica_ancora = self._seed_clinicas(db)
            self._criar_agendamento(db, clinica_id=clinica_ancora.id, data="2026-05-21", hora="10:00")

            with patch.object(agenda, "_obter_duracao_deslocamento_cacheado", return_value=(10, "mock")) as mocked:
                possui_ancora = agenda._existe_ancora_proxima_no_dia(
                    db,
                    clinica_id=clinica_base.id,
                    data_iso="2026-05-21",
                    limite_minutos=20,
                    perfil_deslocamento="comercial",
                )

            self.assertFalse(possui_ancora)
            mocked.assert_not_called()
        finally:
            db.close()
            engine.dispose()
            tmpdir.cleanup()

    def test_sugestao_proximidade_ignora_agendamento_fora_janela(self) -> None:
        tmpdir, db, engine = self._build_session()
        try:
            self._seed_config(
                db,
                excecoes=[
                    # Janela especial curta para o dia 21: qualquer ancora fora deste intervalo deve ser ignorada.
                    {"data": "2026-05-21", "ativo": True, "inicio": "08:00", "fim": "12:00", "motivo": "Janela reduzida"},
                ],
            )
            clinica_base, clinica_ancora = self._seed_clinicas(db)
            self._criar_agendamento(db, clinica_id=clinica_ancora.id, data="2026-05-21", hora="15:00")
            self._criar_agendamento(db, clinica_id=clinica_ancora.id, data="2026-05-22", hora="09:30")

            payload = agenda.SugestaoProximidadePayload(
                clinica_id=clinica_base.id,
                data="2026-05-21",
                data_contato="2026-05-19",
                perfil_deslocamento="comercial",
                limite_minutos=25,
                janela_dias_proximidade=3,
                incluir_mesma_clinica=False,
            )

            with patch.object(agenda, "_obter_duracao_deslocamento_cacheado", return_value=(12, "mock")):
                resposta = agenda.sugerir_agendamento_proximo(
                    payload=payload,
                    db=db,
                    current_user=SimpleNamespace(id=1),
                )

            self.assertTrue(resposta["ok"])
            self.assertTrue(resposta["sugerir"])
            self.assertEqual(resposta["item"]["data"], "2026-05-22")
            self.assertEqual(int(resposta.get("itens_ignorados_janela", 0)), 1)
        finally:
            db.close()
            engine.dispose()
            tmpdir.cleanup()

    def test_sugestoes_horario_ignoram_slots_passados_no_dia_atual(self) -> None:
        class DateTimeFixa(datetime):
            @classmethod
            def now(cls, tz=None):
                if tz is not None:
                    return cls(2026, 5, 19, 14, 20, 0, tzinfo=tz)
                return cls(2026, 5, 19, 14, 20, 0)

        tmpdir, db, engine = self._build_session()
        try:
            self._seed_config(db, excecoes=[])
            clinica_base, _ = self._seed_clinicas(db)

            payload = agenda.SugestaoHorarioPayload(
                data="2026-05-19",
                clinica_id=clinica_base.id,
                duracao_minutos=30,
                intervalo_minutos=30,
                limite=8,
                perfil_deslocamento="comercial",
            )

            with patch.object(agenda, "datetime", DateTimeFixa):
                resposta = agenda.sugerir_horarios_agenda(
                    payload=payload,
                    db=db,
                    current_user=SimpleNamespace(id=1),
                )

            self.assertTrue(resposta["ok"])
            self.assertGreater(len(resposta["items"]), 0)
            primeiro_inicio = str(resposta["items"][0]["inicio"])
            self.assertTrue(primeiro_inicio.endswith("14:30"))
            for item in resposta["items"]:
                inicio = datetime.strptime(item["inicio"], "%Y-%m-%d %H:%M")
                self.assertGreaterEqual(inicio, datetime(2026, 5, 19, 14, 30))
        finally:
            db.close()
            engine.dispose()
            tmpdir.cleanup()

    def test_sugestao_proximidade_distante_sem_ancora_d2_prioriza_dias_politica(self) -> None:
        tmpdir, db, engine = self._build_session()
        try:
            self._seed_config(
                db,
                excecoes=[],
                regras_rota={
                    "base": {
                        "label": "Casa",
                        "address": "Av da Universidade, 1949",
                        "zip_code": "60020-180",
                        "lat": -3.7319,
                        "lng": -38.5267,
                    },
                    "thresholds": {
                        "nearby_anchor_max_travel_min": 20,
                        "distant_clinic_min_travel_from_base_min": 35,
                        "low_frequency_max_bookings_30d": 3,
                        "max_insertion_detour_min": 25,
                        "safe_margin_min": 5,
                    },
                    "offer_policy": {
                        "default_first_offer_days_ahead": [2],
                        "distant_low_frequency_first_offer_days_ahead": [3, 4],
                        "allow_d2_if_anchor_exists": True,
                        "emergency_first_offer_days_ahead": [1, 2],
                    },
                    "route_policy": {
                        "end_of_route_window_start": "16:00",
                        "prefer_near_base_at_end_of_route": True,
                        "bonus_near_base_score": 15,
                        "penalty_far_base_score": 10,
                        "reject_clear_inefficiency": True,
                    },
                    "fallback_policy": {
                        "suggest_alternative_slots_when_blocked": True,
                        "max_alternative_suggestions": 3,
                        "allow_extra_slot_start_or_end_route_for_emergency": True,
                    },
                    "clinic_overrides": [],
                },
            )
            clinica_base, clinica_ancora = self._seed_clinicas(
                db,
                clinica_base_coords=(-3.9320, -38.4700),
                clinica_ancora_coords=(-3.7320, -38.5270),
            )
            self._criar_agendamento(db, clinica_id=clinica_ancora.id, data="2026-05-21", hora="09:00")

            payload = agenda.SugestaoProximidadePayload(
                clinica_id=clinica_base.id,
                data="2026-05-21",
                data_contato="2026-05-19",
                perfil_deslocamento="comercial",
                limite_minutos=25,
                janela_dias_proximidade=3,
                incluir_mesma_clinica=False,
            )

            with patch.object(agenda, "_obter_duracao_deslocamento_cacheado", return_value=(42, "mock")):
                resposta = agenda.sugerir_agendamento_proximo(
                    payload=payload,
                    db=db,
                    current_user=SimpleNamespace(id=1),
                )

            self.assertTrue(resposta["ok"])
            self.assertFalse(resposta["sugerir"])
            self.assertIsNone(resposta.get("item"))
            politica = resposta.get("politica_oferta") or {}
            self.assertTrue(politica.get("distante_base"))
            self.assertTrue(politica.get("baixa_frequencia"))
            self.assertFalse(politica.get("ancora_d2"))
            self.assertEqual(
                politica.get("datas_preferenciais"),
                ["2026-05-22", "2026-05-23"],
            )
        finally:
            db.close()
            engine.dispose()
            tmpdir.cleanup()

    def test_sugestao_proximidade_sem_base_geo_aplica_regra_conservadora(self) -> None:
        tmpdir, db, engine = self._build_session()
        try:
            self._seed_config(
                db,
                excecoes=[],
                regras_rota={
                    "base": {
                        "label": "Casa",
                        "address": "Av da Universidade, 1949",
                        "zip_code": "60020-180",
                        "lat": None,
                        "lng": None,
                    },
                    "thresholds": {
                        "nearby_anchor_max_travel_min": 20,
                        "distant_clinic_min_travel_from_base_min": 35,
                        "low_frequency_max_bookings_30d": 3,
                        "max_insertion_detour_min": 25,
                        "safe_margin_min": 5,
                    },
                    "offer_policy": {
                        "default_first_offer_days_ahead": [2],
                        "distant_low_frequency_first_offer_days_ahead": [3, 4],
                        "allow_d2_if_anchor_exists": True,
                        "emergency_first_offer_days_ahead": [1, 2],
                    },
                    "route_policy": {
                        "end_of_route_window_start": "16:00",
                        "prefer_near_base_at_end_of_route": True,
                        "bonus_near_base_score": 15,
                        "penalty_far_base_score": 10,
                        "reject_clear_inefficiency": True,
                    },
                    "fallback_policy": {
                        "suggest_alternative_slots_when_blocked": True,
                        "max_alternative_suggestions": 3,
                        "allow_extra_slot_start_or_end_route_for_emergency": True,
                    },
                    "clinic_overrides": [],
                },
            )
            clinica_base, clinica_ancora = self._seed_clinicas(db)
            self._criar_agendamento(db, clinica_id=clinica_ancora.id, data="2026-05-21", hora="09:00")

            payload = agenda.SugestaoProximidadePayload(
                clinica_id=clinica_base.id,
                data="2026-05-21",
                data_contato="2026-05-19",
                perfil_deslocamento="comercial",
                limite_minutos=25,
                janela_dias_proximidade=3,
                incluir_mesma_clinica=False,
            )

            with patch.object(agenda, "_obter_duracao_deslocamento_cacheado", return_value=(42, "mock")):
                resposta = agenda.sugerir_agendamento_proximo(
                    payload=payload,
                    db=db,
                    current_user=SimpleNamespace(id=1),
                )

            self.assertTrue(resposta["ok"])
            self.assertFalse(resposta["sugerir"])
            politica = resposta.get("politica_oferta") or {}
            self.assertTrue(politica.get("distante_base"))
            self.assertFalse(politica.get("ancora_d2"))
            self.assertEqual(
                politica.get("datas_preferenciais"),
                ["2026-05-22", "2026-05-23"],
            )
        finally:
            db.close()
            engine.dispose()
            tmpdir.cleanup()


if __name__ == "__main__":
    unittest.main()
