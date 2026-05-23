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
        clinica_base_cidade: str = "Fortaleza",
        clinica_base_estado: str = "CE",
        clinica_ancora_cidade: str = "Fortaleza",
        clinica_ancora_estado: str = "CE",
    ) -> tuple[Clinica, Clinica]:
        clinica_base = Clinica(
            nome="Pet Xodo",
            ativo=True,
            latitude=clinica_base_coords[0],
            longitude=clinica_base_coords[1],
            cidade=clinica_base_cidade,
            estado=clinica_base_estado,
        )
        clinica_ancora = Clinica(
            nome="Pet Sanus Caucaia",
            ativo=True,
            latitude=clinica_ancora_coords[0],
            longitude=clinica_ancora_coords[1],
            cidade=clinica_ancora_cidade,
            estado=clinica_ancora_estado,
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
                    {"data": "2099-05-21", "ativo": False, "inicio": "08:00", "fim": "18:00", "motivo": "Fechado"},
                ],
            )
            clinica_base, clinica_ancora = self._seed_clinicas(db)
            self._criar_agendamento(db, clinica_id=clinica_ancora.id, data="2099-05-21", hora="10:00")

            with patch.object(agenda, "_obter_duracao_deslocamento_cacheado", return_value=(10, "mock")) as mocked:
                possui_ancora = agenda._existe_ancora_proxima_no_dia(
                    db,
                    clinica_id=clinica_base.id,
                    data_iso="2099-05-21",
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
                    {"data": "2099-05-21", "ativo": True, "inicio": "08:00", "fim": "12:00", "motivo": "Janela reduzida"},
                ],
            )
            clinica_base, clinica_ancora = self._seed_clinicas(db)
            self._criar_agendamento(db, clinica_id=clinica_ancora.id, data="2099-05-21", hora="15:00")
            self._criar_agendamento(db, clinica_id=clinica_ancora.id, data="2099-05-22", hora="09:30")

            payload = agenda.SugestaoProximidadePayload(
                clinica_id=clinica_base.id,
                data="2099-05-21",
                data_contato="2099-05-19",
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
            self.assertEqual(resposta["item"]["data"], "2099-05-22")
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
                    return cls(2099, 5, 19, 14, 20, 0, tzinfo=tz)
                return cls(2099, 5, 19, 14, 20, 0)

        tmpdir, db, engine = self._build_session()
        try:
            self._seed_config(db, excecoes=[])
            clinica_base, _ = self._seed_clinicas(db)

            payload = agenda.SugestaoHorarioPayload(
                data="2099-05-19",
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
                self.assertGreaterEqual(inicio, datetime(2099, 5, 19, 14, 30))
        finally:
            db.close()
            engine.dispose()
            tmpdir.cleanup()

    def test_sugestoes_horario_priorizam_slot_apos_ancora_mesma_clinica_mais_60min(self) -> None:
        tmpdir, db, engine = self._build_session()
        try:
            self._seed_config(db, excecoes=[])
            clinica_base, _ = self._seed_clinicas(db)
            self._criar_agendamento(
                db,
                clinica_id=clinica_base.id,
                data="2099-05-25",
                hora="10:00",
                status="Agendado",
            )

            payload = agenda.SugestaoHorarioPayload(
                data="2099-05-25",
                clinica_id=clinica_base.id,
                duracao_minutos=30,
                intervalo_minutos=30,
                limite=8,
                perfil_deslocamento="comercial",
            )

            with patch.object(agenda, "_obter_duracao_deslocamento_cacheado", return_value=(0, "mesma_clinica")):
                resposta = agenda.sugerir_horarios_agenda(
                    payload=payload,
                    db=db,
                    current_user=SimpleNamespace(id=1),
                )

            self.assertTrue(resposta["ok"])
            self.assertGreater(len(resposta["items"]), 0)
            primeiro = resposta["items"][0]
            self.assertEqual(str(primeiro.get("inicio") or ""), "2099-05-25 11:00")
            self.assertEqual(int(primeiro.get("preferencia_ancora_ordem", 99)), 0)
        finally:
            db.close()
            engine.dispose()
            tmpdir.cleanup()

    def test_sugestoes_horario_bloqueiam_data_passada(self) -> None:
        class DateTimeFixa(datetime):
            @classmethod
            def now(cls, tz=None):
                if tz is not None:
                    return cls(2099, 5, 19, 14, 20, 0, tzinfo=tz)
                return cls(2099, 5, 19, 14, 20, 0)

        tmpdir, db, engine = self._build_session()
        try:
            self._seed_config(db, excecoes=[])
            clinica_base, _ = self._seed_clinicas(db)

            payload = agenda.SugestaoHorarioPayload(
                data="2099-05-18",
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
            self.assertEqual(resposta["total_encontrados"], 0)
            self.assertEqual(resposta["items"], [])
            self.assertIn("datas passadas", str(resposta.get("motivo", "")))
        finally:
            db.close()
            engine.dispose()
            tmpdir.cleanup()

    def test_sugestao_proximidade_bloqueia_data_passada(self) -> None:
        class DateTimeFixa(datetime):
            @classmethod
            def now(cls, tz=None):
                if tz is not None:
                    return cls(2099, 5, 19, 9, 0, 0, tzinfo=tz)
                return cls(2099, 5, 19, 9, 0, 0)

        tmpdir, db, engine = self._build_session()
        try:
            self._seed_config(db, excecoes=[])
            clinica_base, _ = self._seed_clinicas(db)

            payload = agenda.SugestaoProximidadePayload(
                clinica_id=clinica_base.id,
                data="2099-05-18",
                data_contato="2099-05-17",
                perfil_deslocamento="comercial",
                limite_minutos=25,
                janela_dias_proximidade=3,
                incluir_mesma_clinica=False,
            )

            with patch.object(agenda, "datetime", DateTimeFixa):
                resposta = agenda.sugerir_agendamento_proximo(
                    payload=payload,
                    db=db,
                    current_user=SimpleNamespace(id=1),
                )

            self.assertTrue(resposta["ok"])
            self.assertFalse(resposta["sugerir"])
            self.assertIsNone(resposta["item"])
            self.assertIn("datas passadas", str(resposta.get("mensagem", "")))
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
            self._criar_agendamento(db, clinica_id=clinica_ancora.id, data="2099-05-21", hora="09:00")

            payload = agenda.SugestaoProximidadePayload(
                clinica_id=clinica_base.id,
                data="2099-05-21",
                data_contato="2099-05-19",
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
                ["2099-05-22", "2099-05-23"],
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
            clinica_base, clinica_ancora = self._seed_clinicas(
                db,
                clinica_base_cidade="Fortaleza",
                clinica_ancora_cidade="Caucaia",
            )
            self._criar_agendamento(db, clinica_id=clinica_ancora.id, data="2099-05-21", hora="09:00")

            payload = agenda.SugestaoProximidadePayload(
                clinica_id=clinica_base.id,
                data="2099-05-21",
                data_contato="2099-05-19",
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
                ["2099-05-22", "2099-05-23"],
            )
        finally:
            db.close()
            engine.dispose()
            tmpdir.cleanup()

    def test_politica_oferta_prioriza_d0_quando_ha_ancora_em_d0_sem_ancora_d2_d3(self) -> None:
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
                clinica_base_coords=(-3.7320, -38.5270),
                clinica_ancora_coords=(-3.7325, -38.5275),
            )
            self._criar_agendamento(db, clinica_id=clinica_ancora.id, data="2099-05-19", hora="09:00")

            regras_rota = agenda._obter_regras_rota_agenda(db)
            with patch.object(agenda, "_obter_duracao_deslocamento_cacheado", return_value=(12, "mock")):
                politica = agenda._classificar_politica_oferta(
                    db,
                    clinica_id=clinica_base.id,
                    data_contato_iso="2099-05-19",
                    perfil_deslocamento="comercial",
                    regras_rota=regras_rota,
                )

            self.assertTrue(politica.get("base_proxima"))
            self.assertTrue(politica.get("ancora_d0"))
            self.assertFalse(politica.get("ancora_d2"))
            self.assertFalse(politica.get("ancora_d3"))
            self.assertTrue(politica.get("prioridade_d0_aplicada"))
            self.assertEqual(politica.get("dias_preferenciais"), [0])
        finally:
            db.close()
            engine.dispose()
            tmpdir.cleanup()

    def test_politica_oferta_prioriza_d0_quando_d0_vazio_sem_ancora_d2_d3(self) -> None:
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
            clinica_base, _ = self._seed_clinicas(
                db,
                clinica_base_coords=(-3.7320, -38.5270),
                clinica_ancora_coords=(-3.8200, -38.6500),
            )

            regras_rota = agenda._obter_regras_rota_agenda(db)
            politica = agenda._classificar_politica_oferta(
                db,
                clinica_id=clinica_base.id,
                data_contato_iso="2099-05-19",
                perfil_deslocamento="comercial",
                regras_rota=regras_rota,
            )

            self.assertTrue(politica.get("base_proxima"))
            self.assertTrue(politica.get("sem_agendamentos_d0"))
            self.assertFalse(politica.get("ancora_d2"))
            self.assertFalse(politica.get("ancora_d3"))
            self.assertTrue(politica.get("prioridade_d0_aplicada"))
            self.assertEqual(politica.get("dias_preferenciais"), [0])
        finally:
            db.close()
            engine.dispose()
            tmpdir.cleanup()

    def test_politica_oferta_nao_prioriza_d0_quando_existe_ancora_d2_ou_d3(self) -> None:
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
                clinica_base_coords=(-3.7320, -38.5270),
                clinica_ancora_coords=(-3.7325, -38.5275),
            )
            self._criar_agendamento(db, clinica_id=clinica_ancora.id, data="2099-05-19", hora="09:00")
            self._criar_agendamento(db, clinica_id=clinica_ancora.id, data="2099-05-21", hora="10:00")

            regras_rota = agenda._obter_regras_rota_agenda(db)
            with patch.object(agenda, "_obter_duracao_deslocamento_cacheado", return_value=(12, "mock")):
                politica = agenda._classificar_politica_oferta(
                    db,
                    clinica_id=clinica_base.id,
                    data_contato_iso="2099-05-19",
                    perfil_deslocamento="comercial",
                    regras_rota=regras_rota,
                )

            self.assertTrue(politica.get("base_proxima"))
            self.assertTrue(politica.get("ancora_d0"))
            self.assertTrue(politica.get("ancora_d2"))
            self.assertFalse(politica.get("prioridade_d0_aplicada"))
            self.assertEqual(politica.get("dias_preferenciais"), [2])
        finally:
            db.close()
            engine.dispose()
            tmpdir.cleanup()

    def test_ancora_d2_fallback_mesma_cidade_com_um_agendamento_valido(self) -> None:
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
            clinica_base, clinica_ancora = self._seed_clinicas(
                db,
                clinica_base_cidade="Fortaleza",
                clinica_ancora_cidade="Fortaleza",
            )
            self._criar_agendamento(db, clinica_id=clinica_ancora.id, data="2099-05-21", hora="09:00")

            payload = agenda.SugestaoProximidadePayload(
                clinica_id=clinica_base.id,
                data="2099-05-21",
                data_contato="2099-05-19",
                perfil_deslocamento="comercial",
                limite_minutos=25,
                janela_dias_proximidade=3,
                incluir_mesma_clinica=False,
            )

            with patch.object(agenda, "_obter_duracao_deslocamento_cacheado", return_value=(0, "sem_matriz")):
                resposta = agenda.sugerir_agendamento_proximo(
                    payload=payload,
                    db=db,
                    current_user=SimpleNamespace(id=1),
                )

            self.assertTrue(resposta["ok"])
            self.assertTrue(resposta["sugerir"])
            self.assertIsNotNone(resposta.get("item"))
            politica = resposta.get("politica_oferta") or {}
            self.assertTrue(politica.get("ancora_d2"))
            self.assertEqual(politica.get("datas_preferenciais"), ["2099-05-21"])
            self.assertEqual(str(resposta["item"].get("fonte_deslocamento") or ""), "fallback_mesma_cidade")
        finally:
            db.close()
            engine.dispose()
            tmpdir.cleanup()

    def test_ancora_d2_fallback_cluster_mesma_cidade_quando_sem_matriz(self) -> None:
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
            clinica_base, clinica_ancora = self._seed_clinicas(
                db,
                clinica_base_cidade="Fortaleza",
                clinica_ancora_cidade="Fortaleza",
            )
            clinica_ancora_2 = Clinica(nome="Casa Pet", ativo=True, cidade="Fortaleza", estado="CE")
            db.add(clinica_ancora_2)
            db.commit()
            db.refresh(clinica_ancora_2)

            self._criar_agendamento(db, clinica_id=clinica_ancora.id, data="2099-05-21", hora="09:00")
            self._criar_agendamento(db, clinica_id=clinica_ancora_2.id, data="2099-05-21", hora="10:30")

            payload = agenda.SugestaoProximidadePayload(
                clinica_id=clinica_base.id,
                data="2099-05-21",
                data_contato="2099-05-19",
                perfil_deslocamento="comercial",
                limite_minutos=25,
                janela_dias_proximidade=3,
                incluir_mesma_clinica=False,
            )

            with patch.object(agenda, "_obter_duracao_deslocamento_cacheado", return_value=(0, "sem_matriz")):
                resposta = agenda.sugerir_agendamento_proximo(
                    payload=payload,
                    db=db,
                    current_user=SimpleNamespace(id=1),
                )

            self.assertTrue(resposta["ok"])
            self.assertTrue(resposta["sugerir"])
            self.assertIsNotNone(resposta.get("item"))
            politica = resposta.get("politica_oferta") or {}
            self.assertTrue(politica.get("ancora_d2"))
            self.assertEqual(politica.get("datas_preferenciais"), ["2099-05-21"])
            self.assertEqual(str(resposta["item"].get("fonte_deslocamento") or ""), "fallback_mesma_cidade")
        finally:
            db.close()
            engine.dispose()
            tmpdir.cleanup()

    def test_ancora_d2_considera_status_em_atendimento(self) -> None:
        tmpdir, db, engine = self._build_session()
        try:
            self._seed_config(db, excecoes=[])
            clinica_base, clinica_ancora = self._seed_clinicas(db)
            self._criar_agendamento(
                db,
                clinica_id=clinica_ancora.id,
                data="2099-05-21",
                hora="09:00",
                status="Em atendimento",
            )

            with patch.object(agenda, "_obter_duracao_deslocamento_cacheado", return_value=(12, "mock")):
                possui_ancora = agenda._existe_ancora_proxima_no_dia(
                    db,
                    clinica_id=clinica_base.id,
                    data_iso="2099-05-21",
                    limite_minutos=20,
                    perfil_deslocamento="comercial",
                )

            self.assertTrue(possui_ancora)
        finally:
            db.close()
            engine.dispose()
            tmpdir.cleanup()

    def test_ancora_d2_fallback_por_proximidade_geografica_com_cadastro_inconsistente(self) -> None:
        tmpdir, db, engine = self._build_session()
        try:
            self._seed_config(db, excecoes=[])
            clinica_base, clinica_ancora = self._seed_clinicas(
                db,
                clinica_base_coords=(-3.7320, -38.5270),
                clinica_ancora_coords=(-3.7285, -38.5240),
                clinica_base_cidade="Fortaleza",
                clinica_base_estado="CE",
                clinica_ancora_cidade="Aldeota",
                clinica_ancora_estado="CE",
            )
            self._criar_agendamento(db, clinica_id=clinica_ancora.id, data="2099-05-21", hora="09:00")

            with patch.object(agenda, "_obter_duracao_deslocamento_cacheado", return_value=(0, "sem_matriz")):
                possui_ancora = agenda._existe_ancora_proxima_no_dia(
                    db,
                    clinica_id=clinica_base.id,
                    data_iso="2099-05-21",
                    limite_minutos=20,
                    perfil_deslocamento="comercial",
                )

            self.assertTrue(possui_ancora)
        finally:
            db.close()
            engine.dispose()
            tmpdir.cleanup()

    def test_rank_prioriza_deslocamento_antes_data_preferencial(self) -> None:
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
            clinica_base = Clinica(
                nome="Vet World",
                ativo=True,
                latitude=-3.7320,
                longitude=-38.5270,
                cidade="Fortaleza",
                estado="CE",
            )
            clinica_ancora_longa = Clinica(
                nome="Celeiro",
                ativo=True,
                latitude=-3.8100,
                longitude=-38.6100,
                cidade="Fortaleza",
                estado="CE",
            )
            clinica_ancora_curta = Clinica(
                nome="Casa Pet",
                ativo=True,
                latitude=-3.7330,
                longitude=-38.5280,
                cidade="Fortaleza",
                estado="CE",
            )
            db.add_all([clinica_base, clinica_ancora_longa, clinica_ancora_curta])
            db.commit()
            db.refresh(clinica_base)
            db.refresh(clinica_ancora_longa)
            db.refresh(clinica_ancora_curta)

            # Data preferencial (D+2): 2099-05-21 -> deslocamento pior.
            self._criar_agendamento(
                db,
                clinica_id=clinica_ancora_longa.id,
                data="2099-05-21",
                hora="10:00",
                status="Agendado",
            )
            # Fora da data preferencial: 2099-05-22 -> deslocamento melhor.
            self._criar_agendamento(
                db,
                clinica_id=clinica_ancora_curta.id,
                data="2099-05-22",
                hora="10:00",
                status="Agendado",
            )

            payload = agenda.SugestaoProximidadePayload(
                clinica_id=clinica_base.id,
                data="2099-05-21",
                data_contato="2099-05-19",
                perfil_deslocamento="comercial",
                limite_minutos=60,
                janela_dias_proximidade=3,
                incluir_mesma_clinica=False,
            )

            def _duracao_side_effect(
                _db,
                *,
                origem_clinica_id: int,
                destino_clinica_id: int,
                perfil: str,
                permitir_estimativa_fallback: bool = True,
                cache=None,
            ):
                if int(destino_clinica_id) == int(clinica_ancora_longa.id):
                    return (53, "mock")
                if int(destino_clinica_id) == int(clinica_ancora_curta.id):
                    return (10, "mock")
                return (30, "mock")

            with patch.object(agenda, "_obter_duracao_deslocamento_cacheado", side_effect=_duracao_side_effect):
                resposta = agenda.sugerir_agendamento_proximo(
                    payload=payload,
                    db=db,
                    current_user=SimpleNamespace(id=1),
                )

            self.assertTrue(resposta["ok"])
            self.assertTrue(resposta["sugerir"])
            self.assertEqual(str(resposta["item"]["data"]), "2099-05-22")
            self.assertEqual(int(resposta["item"]["duracao_deslocamento_min"]), 10)
        finally:
            db.close()
            engine.dispose()
            tmpdir.cleanup()

    def test_sugestao_proximidade_ignora_ancora_passada_no_dia_atual(self) -> None:
        class DateTimeFixa(datetime):
            @classmethod
            def now(cls, tz=None):
                if tz is not None:
                    return cls(2026, 5, 20, 22, 38, 0, tzinfo=tz)
                return cls(2026, 5, 20, 22, 38, 0)

        tmpdir, db, engine = self._build_session()
        try:
            self._seed_config(db, excecoes=[])
            clinica_base, _ = self._seed_clinicas(db)
            self._criar_agendamento(
                db,
                clinica_id=clinica_base.id,
                data="2099-05-20",
                hora="13:30",
                status="Agendado",
            )

            payload = agenda.SugestaoProximidadePayload(
                clinica_id=clinica_base.id,
                data="2099-05-20",
                data_contato="2099-05-20",
                perfil_deslocamento="comercial",
                limite_minutos=25,
                janela_dias_proximidade=1,
                incluir_mesma_clinica=True,
            )

            with patch.object(agenda, "datetime", DateTimeFixa):
                resposta = agenda.sugerir_agendamento_proximo(
                    payload=payload,
                    db=db,
                    current_user=SimpleNamespace(id=1),
                )

            self.assertTrue(resposta["ok"])
            self.assertFalse(resposta["sugerir"])
            self.assertIsNone(resposta.get("item"))
        finally:
            db.close()
            engine.dispose()
            tmpdir.cleanup()

    def test_sugestao_proximidade_ignora_ancora_sem_slot_operacional(self) -> None:
        tmpdir, db, engine = self._build_session()
        try:
            self._seed_config(
                db,
                excecoes=[
                    {"data": "2099-05-23", "ativo": True, "inicio": "10:00", "fim": "11:00", "motivo": "Janela curta"},
                ],
            )
            clinica_base, clinica_ancora = self._seed_clinicas(db)
            self._criar_agendamento(
                db,
                clinica_id=clinica_ancora.id,
                data="2099-05-23",
                hora="10:30",
                status="Agendado",
            )

            payload = agenda.SugestaoProximidadePayload(
                clinica_id=clinica_base.id,
                data="2099-05-23",
                data_contato="2099-05-21",
                duracao_minutos=30,
                perfil_deslocamento="comercial",
                limite_minutos=25,
                janela_dias_proximidade=2,
                incluir_mesma_clinica=False,
            )

            with patch.object(agenda, "_obter_duracao_deslocamento_cacheado", return_value=(20, "mock")):
                resposta = agenda.sugerir_agendamento_proximo(
                    payload=payload,
                    db=db,
                    current_user=SimpleNamespace(id=1),
                )

            self.assertTrue(resposta["ok"])
            self.assertFalse(resposta["sugerir"])
            self.assertIsNone(resposta.get("item"))
        finally:
            db.close()
            engine.dispose()
            tmpdir.cleanup()


if __name__ == "__main__":
    unittest.main()
