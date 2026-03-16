import os
import sys
import tempfile
import unittest
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
os.chdir(BACKEND_DIR)
sys.path.insert(0, str(BACKEND_DIR))

from app.services import frases_ecocardiograma_estruturado_teste_service as service


class FrasesEcocardiogramaEstruturadoTesteServiceTest(unittest.TestCase):
    def test_create_phrase_persists_new_phrase_in_aspect(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            data_dir = Path(tmp)
            frases_file = data_dir / "frases_ecocardiograma_estruturado_teste.json"

            original_data_dir = service.DATA_DIR
            original_frases_file = service.FRASES_FILE
            try:
                service.DATA_DIR = data_dir
                service.FRASES_FILE = frases_file

                created = service.create_phrase(
                    {
                        "aspecto": "conclusao",
                        "titulo": "Conclusao com disfuncao diastolica grau 1",
                        "texto": (
                            "Achados compativeis com endocardiose de valva mitral em estagio B1 "
                            "associada a disfuncao diastolica grau 1."
                        ),
                        "tags": ["conclusao", "endocardiose", "b1"],
                    }
                )
                payload = service.get_payload()
                aspecto_conclusao = next(
                    item for item in payload["aspectos"] if item["key"] == "conclusao"
                )

                self.assertIsInstance(created["id"], int)
                self.assertTrue(
                    any(
                        frase["titulo"] == "Conclusao com disfuncao diastolica grau 1"
                        for frase in aspecto_conclusao["frases"]
                    )
                )
            finally:
                service.DATA_DIR = original_data_dir
                service.FRASES_FILE = original_frases_file

    def test_create_phrase_rejects_duplicate_title_in_same_aspect(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            data_dir = Path(tmp)
            frases_file = data_dir / "frases_ecocardiograma_estruturado_teste.json"

            original_data_dir = service.DATA_DIR
            original_frases_file = service.FRASES_FILE
            try:
                service.DATA_DIR = data_dir
                service.FRASES_FILE = frases_file

                payload = service.get_payload()
                primeira_frase = payload["aspectos"][0]["frases"][0]

                with self.assertRaisesRegex(
                    ValueError, "Ja existe uma frase com esse titulo neste aspecto."
                ):
                    service.create_phrase(
                        {
                            "aspecto": payload["aspectos"][0]["key"],
                            "titulo": primeira_frase["titulo"],
                            "texto": "Texto alternativo para validar duplicidade.",
                            "tags": [],
                        }
                    )
            finally:
                service.DATA_DIR = original_data_dir
                service.FRASES_FILE = original_frases_file


if __name__ == "__main__":
    unittest.main()
