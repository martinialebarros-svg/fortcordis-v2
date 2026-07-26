import os
import sys
import unittest
from io import BytesIO
from pathlib import Path

from pypdf import PdfReader

BACKEND_DIR = Path(__file__).resolve().parents[1]
os.chdir(BACKEND_DIR)
sys.path.insert(0, str(BACKEND_DIR))

from app.utils.pdf_laudo import gerar_pdf_laudo_eco  # noqa: E402


def _base_report(selected_technique: str) -> dict:
    return {
        "paciente": {
            "nome": "Paciente teste",
            "especie": "Canina",
            "raca": "SRD",
            "sexo": "Macho",
            "idade": "5 anos",
            "peso": "10",
            "tutor": "Tutor teste",
            "data_exame": "2026-07-26",
        },
        "medidas": {
            "DIVEd": "30",
            "DIVEd_2D": "32",
            "VE_tecnica_relatorio": selected_technique,
            "IT_Vmax": "3.6",
            "IT_Grad": "51.84",
            "PAD_estimada": "10",
            "PSAP": "61.84",
            "e_doppler": "0.08",
        },
        "qualitativa": {},
        "conclusao": "Laudo de teste.",
        "clinica": "Clínica teste",
    }


def _pdf_text(payload: dict) -> str:
    content = gerar_pdf_laudo_eco(payload)
    reader = PdfReader(BytesIO(content))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


class PdfLaudoEchoMeasurementsTest(unittest.TestCase):
    def test_selected_lv_technique_controls_pdf_measurement_block(self) -> None:
        mode_m_text = _pdf_text(_base_report("modo_m"))
        mode_2d_text = _pdf_text(_base_report("2d"))

        self.assertIn("VE - Modo M", mode_m_text)
        self.assertNotIn("VE - Modo 2D", mode_m_text)
        self.assertIn("VE - Modo 2D", mode_2d_text)
        self.assertNotIn("VE - Modo M", mode_2d_text)
        self.assertIn("PSAP estimada", mode_2d_text)
        self.assertIn("61.84 mmHg", mode_2d_text)
        self.assertIn("0.08 m/s", mode_2d_text)


if __name__ == "__main__":
    unittest.main()
