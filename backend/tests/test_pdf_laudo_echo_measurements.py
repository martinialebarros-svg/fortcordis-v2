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
from app.utils.ecocardiograma_medidas import (  # noqa: E402
    extrair_medidas_ecocardiograma_da_descricao,
)


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
            "VDF": "99",
            "VDF_2D": "96",
            "VSF": "34",
            "VSF_2D": "41",
            "FE_Teicholz": "66",
            "FE_Teicholz_2D": "57",
            "DeltaD_FS": "36",
            "DeltaD_FS_2D": "30",
            "VE_tecnica_relatorio": selected_technique,
            "IT_Vmax": "3.6",
            "IT_Grad": "51.84",
            "PAD_estimada": "10",
            "PSAP": "61.84",
            "e_doppler": "0.08",
            "E_TRIV": "2.93",
            "E_E_linha": "14",
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
        self.assertIn("99.00 ml", mode_m_text)
        self.assertNotIn("96.00 ml", mode_m_text)
        self.assertIn("96.00 ml", mode_2d_text)
        self.assertNotIn("99.00 ml", mode_2d_text)
        self.assertIn("57.00 %", mode_2d_text)
        self.assertNotIn("66.00 %", mode_2d_text)
        self.assertIn("PSAP estimada", mode_2d_text)
        self.assertIn("61.84 mmHg", mode_2d_text)
        self.assertIn("0.08 m/s", mode_2d_text)
        self.assertIn("E/TRIV", mode_2d_text)
        self.assertIn("2.93", mode_2d_text)
        self.assertRegex(
            mode_2d_text,
            r"aumento das pressões\s+de\s+enchimento\s+do VE",
        )
        self.assertIn("E/E'", mode_2d_text)
        self.assertIn("14.00", mode_2d_text)

    def test_persisted_2d_measurements_generate_2d_block(self) -> None:
        payload = _base_report("modo_m")
        payload["medidas"] = extrair_medidas_ecocardiograma_da_descricao(
            """
## Medidas Ecocardiograficas
- DIVEd_2D: 31.69
- SIVd_2D: 5.96
- PLVEd_2D: 5.06
- DIVES_2D: 15.39
- SIVs_2D: 8.65
- PLVES_2D: 8.10
- VDF_2D: 40
- VSF_2D: 6
- FE_Teicholz_2D: 85
- DeltaD_FS_2D: 51
- VE_tecnica_relatorio: 2d

## Avaliacao Qualitativa
"""
        )

        text = _pdf_text(payload)

        self.assertIn("VE - Modo 2D", text)
        self.assertNotIn("VE - Modo M", text)
        self.assertIn("31.69 mm", text)
        self.assertIn("40.00 ml", text)
        self.assertIn("85.00 %", text)


if __name__ == "__main__":
    unittest.main()
