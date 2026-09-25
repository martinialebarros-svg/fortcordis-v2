import os
import sys
import unittest
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
os.chdir(BACKEND_DIR)
sys.path.insert(0, str(BACKEND_DIR))

from app.utils.referencia_eco_defaults import aplicar_defaults_publicados_caninos
from app.utils.referencia_eco_defaults import obter_tapse_canino_por_peso


class ReferenciaEcoDefaultsTest(unittest.TestCase):
    def test_obter_tapse_canino_por_peso_usa_peso_publicado_mais_proximo(self) -> None:
        self.assertEqual(obter_tapse_canino_por_peso(6.3), (8.5, 13.6))
        self.assertEqual(obter_tapse_canino_por_peso(13.3), (10.0, 16.0))

    def test_aplicar_defaults_caninos_nao_inventa_faixa_mapse(self) -> None:
        referencia = aplicar_defaults_publicados_caninos(
            {
                "especie": "Canina",
                "peso_kg": 6.0,
                "tapse_min": None,
                "tapse_max": None,
                "mapse_min": None,
                "mapse_max": None,
            },
            peso_kg=6.3,
        )

        self.assertEqual(referencia["tapse_min"], 8.5)
        self.assertEqual(referencia["tapse_max"], 13.6)
        self.assertIsNone(referencia["mapse_min"])
        self.assertIsNone(referencia["mapse_max"])

    def test_tapse_fora_da_tabela_nao_reutiliza_extremo(self) -> None:
        for peso in (2.0, 50.0):
            with self.subTest(peso=peso):
                referencia = aplicar_defaults_publicados_caninos({
                    "especie": "Canina", "peso_kg": peso,
                    "tapse_min": None, "tapse_max": None,
                })
                self.assertIsNone(referencia["tapse_min"])
                self.assertIsNone(referencia["tapse_max"])

        referencia_45_kg = aplicar_defaults_publicados_caninos({
            "especie": "Canina", "peso_kg": 45.0,
            "tapse_min": None, "tapse_max": None,
        })
        self.assertEqual((referencia_45_kg["tapse_min"], referencia_45_kg["tapse_max"]), (14.8, 23.7))

    def test_aplicar_defaults_publicados_caninos_preserva_valores_existentes(self) -> None:
        referencia = aplicar_defaults_publicados_caninos(
            {
                "especie": "Canina",
                "peso_kg": 20.0,
                "tapse_min": 1.0,
                "tapse_max": 2.0,
                "mapse_min": 3.0,
                "mapse_max": 4.0,
            },
            peso_kg=20.0,
        )

        self.assertEqual(referencia["tapse_min"], 1.0)
        self.assertEqual(referencia["tapse_max"], 2.0)
        self.assertEqual(referencia["mapse_min"], 3.0)
        self.assertEqual(referencia["mapse_max"], 4.0)


if __name__ == "__main__":
    unittest.main()
