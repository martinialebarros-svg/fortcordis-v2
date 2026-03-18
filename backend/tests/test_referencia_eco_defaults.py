import os
import sys
import unittest
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
os.chdir(BACKEND_DIR)
sys.path.insert(0, str(BACKEND_DIR))

from app.utils.referencia_eco_defaults import aplicar_defaults_publicados_caninos
from app.utils.referencia_eco_defaults import obter_mapse_canino_por_peso
from app.utils.referencia_eco_defaults import obter_tapse_canino_por_peso


class ReferenciaEcoDefaultsTest(unittest.TestCase):
    def test_obter_tapse_canino_por_peso_usa_peso_publicado_mais_proximo(self) -> None:
        self.assertEqual(obter_tapse_canino_por_peso(6.3), (8.5, 13.6))
        self.assertEqual(obter_tapse_canino_por_peso(13.3), (10.0, 16.0))

    def test_obter_mapse_canino_por_peso_converte_cm_para_mm(self) -> None:
        self.assertEqual(obter_mapse_canino_por_peso(10), (6.5, 7.5))
        self.assertEqual(obter_mapse_canino_por_peso(20), (10.3, 11.3))
        self.assertEqual(obter_mapse_canino_por_peso(45), (12.1, 18.1))

    def test_aplicar_defaults_publicados_caninos_preenche_campos_ausentes(self) -> None:
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
        self.assertEqual(referencia["mapse_min"], 6.5)
        self.assertEqual(referencia["mapse_max"], 7.5)

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
