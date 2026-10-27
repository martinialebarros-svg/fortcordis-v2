import os
import sys
import unittest
from datetime import date, datetime, timedelta
from pathlib import Path
from unittest.mock import patch

BACKEND_DIR = Path(__file__).resolve().parents[1]
os.chdir(BACKEND_DIR)
sys.path.insert(0, str(BACKEND_DIR))

from app.utils.paciente_helpers import (
    atualizar_observacoes_com_idade,
    extrair_idade_paciente,
    normalizar_sexo_paciente,
)


class PacienteHelpersTest(unittest.TestCase):
    def test_sem_data_de_referencia_preserva_contrato_atual_dos_outros_callers(self) -> None:
        class FrozenDate(date):
            @classmethod
            def today(cls):
                return cls(2026, 1, 14)
        with patch("app.utils.paciente_helpers.date", FrozenDate):
            self.assertEqual(extrair_idade_paciente("2018-01-15", ""), "8a")
            self.assertEqual(extrair_idade_paciente("2018-01-15", "", data_referencia=None), "8a")
            self.assertEqual(extrair_idade_paciente("2018-01-15", "", data_referencia=FrozenDate.today()), "7a 11m")

    def test_idade_na_data_do_exame_usa_meses_completos_e_preserva_data_civil(self) -> None:
        for reference, expected in (
            (date(2018, 8, 15), "7m"), (date(2019, 1, 14), "11m"),
            (date(2019, 1, 15), "1a"), (date(2020, 1, 15), "2a"),
            ("2018-08-15", "7m"),
            ("2018-08-14T23:30:00-03:00", "6m"),
            (datetime.fromisoformat("2018-08-15T00:30:00+03:00"), "7m"),
        ):
            with self.subTest(reference=reference):
                self.assertEqual(extrair_idade_paciente(
                    "2018-01-15", "Idade: 9 anos", data_referencia=reference,
                ), expected)

    def test_data_de_referencia_invalida_futura_ou_antes_do_nascimento_nao_confirma_adulto(self) -> None:
        for reference in ("invalida", "2018-02-30", date.today() + timedelta(days=1), date(2017, 1, 15)):
            with self.subTest(reference=reference):
                self.assertEqual(extrair_idade_paciente(
                    "2018-01-15", "Idade: 9 anos", data_referencia=reference,
                ), "")

    def test_idade_textual_sem_nascimento_nao_reconstroi_data_de_nascimento(self) -> None:
        observations = "Idade: 7 meses\nPaciente sintetico"
        self.assertEqual(extrair_idade_paciente(
            None, observations, data_referencia=date(2018, 8, 15),
        ), "7 meses")
        self.assertEqual(observations, "Idade: 7 meses\nPaciente sintetico")
        self.assertEqual(extrair_idade_paciente(
            None, "Sem idade", data_referencia=date(2018, 8, 15),
        ), "")

    def test_normalizar_sexo_paciente_corrige_variantes(self) -> None:
        self.assertEqual(normalizar_sexo_paciente("Fêmea"), "Fêmea")
        self.assertEqual(normalizar_sexo_paciente("Femea"), "Fêmea")
        self.assertEqual(normalizar_sexo_paciente("FÃªmea"), "Fêmea")
        self.assertEqual(normalizar_sexo_paciente("Macho"), "Macho")

    def test_extrair_idade_paciente_prioriza_observacoes(self) -> None:
        self.assertEqual(
            extrair_idade_paciente(None, "Idade: 10 anos\nPaciente cardiopata"),
            "10 anos",
        )

    def test_atualizar_observacoes_com_idade_substitui_linha_existente(self) -> None:
        atualizado = atualizar_observacoes_com_idade(
            "Paciente cardiopata\nIdade: 8 anos\nRetorno em 30 dias",
            "10 anos",
        )
        self.assertEqual(
            atualizado,
            "Idade: 10 anos\nPaciente cardiopata\nRetorno em 30 dias",
        )


if __name__ == "__main__":
    unittest.main()
