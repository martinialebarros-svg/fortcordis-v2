import os
import sys
import unittest
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
os.chdir(BACKEND_DIR)
sys.path.insert(0, str(BACKEND_DIR))

from app.api.v1.endpoints import laudos


class LaudosEcocardiogramaEstruturadoTest(unittest.TestCase):
    def test_normalizar_ecocardiograma_estruturado_filtra_textos_validos(self) -> None:
        payload = laudos._normalizar_ecocardiograma_estruturado(
            {
                "versao": "1",
                "modo": "teste",
                "usar_no_laudo": True,
                "preset_id": "12",
                "preset_label": "Endocardiose mitral B1",
                "preset_textos": {
                    "valva_mitral": "Preset mitral",
                    "desconhecido": "ignorar",
                },
                "textos": {
                    "valva_mitral": "Texto mitral",
                    "desconhecido": "ignorar",
                    "conclusao": "Conclusao estruturada",
                },
            }
        )

        self.assertIsNotNone(payload)
        self.assertEqual(payload["preset_id"], 12)
        self.assertTrue(payload["usar_no_laudo"])
        self.assertEqual(payload["preset_textos"], {"valva_mitral": "Preset mitral"})
        self.assertEqual(
            payload["textos"],
            {
                "valva_mitral": "Texto mitral",
                "conclusao": "Conclusao estruturada",
            },
        )

    def test_derivar_legado_de_ecocardiograma_estruturado_agrupar_por_bloco(self) -> None:
        derivado = laudos._derivar_legado_de_ecocardiograma_estruturado(
            {
                "textos": {
                    "valva_mitral": "Mitral alterada.",
                    "valva_tricuspide": "Tricuspide normal.",
                    "atrio_esquerdo": "Atrio esquerdo aumentado.",
                    "conclusao": "Conclusao final.",
                }
            }
        )

        self.assertIn("Valva mitral: Mitral alterada.", derivado["qualitativa"]["valvas"])
        self.assertIn("Valva tricuspide: Tricuspide normal.", derivado["qualitativa"]["valvas"])
        self.assertEqual(derivado["qualitativa"]["camaras"], "Atrio esquerdo aumentado.")
        self.assertEqual(derivado["conclusao"], "Conclusao final.")

    def test_ecocardiograma_estruturado_roundtrip_em_anexos(self) -> None:
        normalizado = laudos._normalizar_ecocardiograma_estruturado(
            {
                "usar_no_laudo": True,
                "preset_textos": {
                    "valva_mitral": "Mitral do preset.",
                },
                "textos": {
                    "valva_mitral": "Mitral alterada.",
                },
            }
        )

        anexos = laudos._serializar_anexos(
            None,
            ecocardiograma_estruturado=normalizado,
        )
        extraido = laudos._extrair_ecocardiograma_estruturado_de_anexos(anexos)

        self.assertIsNotNone(extraido)
        self.assertTrue(extraido["usar_no_laudo"])
        self.assertEqual(extraido["preset_textos"]["valva_mitral"], "Mitral do preset.")
        self.assertEqual(extraido["textos"]["valva_mitral"], "Mitral alterada.")

    def test_montar_descricao_ecocardiograma_preserva_bloco_multilinha(self) -> None:
        descricao = laudos._montar_descricao_ecocardiograma(
            {"LA_Ao": "1.50"},
            {
                "valvas": "  - Valva mitral: Texto 1\n  - Valva aortica: Texto 2",
                "camaras": "",
                "funcao": "",
                "pericardio": "",
                "vasos": "",
                "ad_vd": "",
            },
        )

        self.assertIn("- valvas:\n  - Valva mitral: Texto 1\n  - Valva aortica: Texto 2", descricao)


if __name__ == "__main__":
    unittest.main()
