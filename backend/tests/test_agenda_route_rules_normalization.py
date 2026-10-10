"""Pisos municipais permanecem estáveis ao carregar e salvar configurações."""

import json
import unittest

from app.core.agenda_route_rules import (
    DEFAULT_AGENDA_ROTA_REGRAS,
    carregar_agenda_rota_regras,
    normalizar_agenda_rota_regras,
)


class AgendaRouteRulesNormalizationTest(unittest.TestCase):
    @staticmethod
    def _normalizar(pisos):
        return normalizar_agenda_rota_regras({
            "route_policy": {"first_appointment_city_floors": pisos},
        })

    def test_round_trip_preserva_ate_cinquenta_municipios_adicionais(self):
        for quantidade in (46, 47, 50, 51):
            with self.subTest(quantidade=quantidade):
                regras = self._normalizar({
                    f"municipio {indice:02d}": "10:15"
                    for indice in range(quantidade)
                })
                pisos = regras["route_policy"]["first_appointment_city_floors"]
                esperados = {
                    **DEFAULT_AGENDA_ROTA_REGRAS["route_policy"]["first_appointment_city_floors"],
                    **{
                        f"municipio {indice:02d}": "10:15"
                        for indice in range(min(quantidade, 50))
                    },
                }
                self.assertEqual(pisos, esperados)
                self.assertEqual(normalizar_agenda_rota_regras(regras), regras)
                self.assertEqual(carregar_agenda_rota_regras(json.dumps(regras)), regras)

    def test_alias_e_defaults_tardios_atualizam_piso_sem_consumir_limite(self):
        pisos = {
            " São Gonçalo do Amarante ": "09:15",
            **{f"municipio {indice:02d}": "10:15" for indice in range(49)},
            "SAO GONCALO DO AMARANTE": "11:45",
            "CAUCAIA": "08:45",
            " Maracanaú ": "09:30",
            "Eusébio": "09:45",
            "Itaitinga": "10:00",
            "municipio excedente": "12:00",
        }
        regras = self._normalizar(pisos)
        normalizados = regras["route_policy"]["first_appointment_city_floors"]
        self.assertEqual(len(normalizados), 54)
        self.assertEqual(normalizados["sao goncalo do amarante"], "11:45")
        self.assertEqual(normalizados["caucaia"], "08:45")
        self.assertEqual(normalizados["maracanau"], "09:30")
        self.assertEqual(normalizados["eusebio"], "09:45")
        self.assertEqual(normalizados["itaitinga"], "10:00")
        self.assertNotIn("municipio excedente", normalizados)
        self.assertEqual(normalizar_agenda_rota_regras(regras), regras)

    def test_chaves_vazias_ou_invalidas_nao_consumem_limite(self):
        regras = self._normalizar({
            "": "09:00",
            "  ": "09:00",
            "---": "09:00",
            None: "09:00",
            False: "09:00",
            **{f"municipio {indice:02d}": "10:15" for indice in range(50)},
        })
        pisos = regras["route_policy"]["first_appointment_city_floors"]
        self.assertEqual(len(pisos), 54)
        self.assertNotIn("", pisos)
        self.assertEqual(pisos["municipio 49"], "10:15")
        self.assertEqual(normalizar_agenda_rota_regras(regras), regras)

    def test_horarios_invalidos_preservam_fallback_compativel(self):
        regras = self._normalizar({
            "Caucaia": None,
            "Aquiraz": "25:00",
            "Fortaleza": "00:00",
        })
        pisos = regras["route_policy"]["first_appointment_city_floors"]
        self.assertEqual(pisos["caucaia"], "08:30")
        self.assertEqual(pisos["aquiraz"], "08:00")
        self.assertEqual(pisos["fortaleza"], "00:00")
        self.assertEqual(normalizar_agenda_rota_regras(regras), regras)
