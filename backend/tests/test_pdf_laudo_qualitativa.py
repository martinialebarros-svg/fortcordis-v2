import os
import sys
import unittest
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
os.chdir(BACKEND_DIR)
sys.path.insert(0, str(BACKEND_DIR))

from app.utils import pdf_laudo


class PdfLaudoQualitativaTest(unittest.TestCase):
    def test_criar_cabecalho_nao_forca_defaults_de_ritmo_ou_estado(self) -> None:
        elementos = pdf_laudo.criar_cabecalho(
            {
                "paciente": {
                    "nome": "Thor",
                    "especie": "Canina",
                    "raca": "SRD",
                    "sexo": "Macho",
                    "idade": "5 anos",
                    "peso": "10.0",
                    "tutor": "Maria",
                    "solicitante": "Dr. Joao",
                    "data_exame": "14/03/2026",
                    "ritmo": "",
                    "estado": "",
                    "fc": "",
                },
                "clinica": "Clinica Teste",
            }
        )

        textos = [
            item.getPlainText()
            for item in elementos
            if hasattr(item, "getPlainText")
        ]
        texto_unico = "\n".join(textos)

        self.assertNotIn("Sinusal", texto_unico)
        self.assertNotIn("Calmo", texto_unico)
        self.assertNotIn("bpm", texto_unico)


if __name__ == "__main__":
    unittest.main()
