import os
import sys
import unittest
from io import BytesIO
from pathlib import Path
from PIL import Image as PILImage

from pypdf import PdfReader

BACKEND_DIR = Path(__file__).resolve().parents[1]
os.chdir(BACKEND_DIR)
sys.path.insert(0, str(BACKEND_DIR))

from app.utils.pdf_laudo import gerar_pdf_laudo_eco  # noqa: E402
from app.utils.ecocardiograma_medidas import (  # noqa: E402
    extrair_medidas_ecocardiograma_da_descricao,
)
from app.utils.referencia_eco_defaults import aplicar_defaults_publicados_caninos  # noqa: E402


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
    def test_pdf_numbers_images_and_uses_only_recorded_captions(self) -> None:
        image_buffer = BytesIO()
        PILImage.new("RGB", (320, 240), "white").save(image_buffer, format="JPEG")
        content = image_buffer.getvalue()
        payload = _base_report("modo_m")
        payload["medidas"] = {"DIVEd": "30", "VE_tecnica_relatorio": "modo_m"}
        payload["imagens"] = [
            {"conteudo": content, "descricao": "Doppler da IT <3,6 m/s>"},
            {"conteudo": content, "descricao": ""},
            *[content for _ in range(4)],
        ]

        content_pdf = gerar_pdf_laudo_eco(payload)
        reader = PdfReader(BytesIO(content_pdf))
        text = "\n".join(page.extract_text() or "" for page in reader.pages)

        self.assertIn("Imagem 1 - Doppler da IT <3,6 m/s>", text)
        self.assertIn("Imagem 2", text)
        self.assertIn("Imagem 6", text)
        self.assertEqual(text.count("Imagem 1"), 1)
        self.assertEqual(len(reader.pages), 2)
        image_page_text = reader.pages[1].extract_text() or ""
        self.assertIn("Paciente: Paciente teste", image_page_text)
        self.assertIn("Data do exame: 2026-07-26", image_page_text)

    def test_short_qualitative_stays_on_first_page(self) -> None:
        payload = _base_report("modo_m")
        payload["medidas"] = {"DIVEd": "30", "VE_tecnica_relatorio": "modo_m"}
        payload["qualitativa"] = {"pericardio": "Sem derrame pericárdico."}
        reader = PdfReader(BytesIO(gerar_pdf_laudo_eco(payload)))

        self.assertEqual(len(reader.pages), 1)
        text = reader.pages[0].extract_text() or ""
        self.assertIn("ANÁLISE QUALITATIVA", text)
        self.assertIn("Sem derrame pericárdico.", text)
        self.assertEqual(text.count("Médico Veterinário"), 1)

    def test_moderate_report_does_not_leave_signature_alone_on_a_page(self) -> None:
        payload = _base_report("modo_m")
        payload["paciente"].update({
            "nome": "PACIENTE DEMONSTRATIVO", "tutor": "Demonstração",
            "data_exame": "24/09/2026",
        })
        payload["clinica"] = "Clínica demonstrativa"
        payload["conclusao"] = (
            "EXEMPLO SINTÉTICO - SEM VALIDADE CLÍNICA. "
            "Este documento mostra apenas a estrutura e a leitura do PDF."
        )
        payload["medidas"] = {
            "DIVEd": "30", "SIVd": "6", "Aorta": "17", "Atrio_esquerdo": "19",
            "AE_Ao": "1.12", "Onda_E": "0.70", "Onda_A": "0.50", "E_A": "1.40",
            "VE_tecnica_relatorio": "modo_m",
        }
        payload["qualitativa"] = {
            "valvas": "Texto demonstrativo de avaliação qualitativa.\n- Segundo item preservado.",
            "pericardio": "Texto demonstrativo sem achado clínico real.",
        }

        no_images = PdfReader(BytesIO(gerar_pdf_laudo_eco(payload)))
        self.assertEqual(len(no_images.pages), 2)
        last_text = no_images.pages[-1].extract_text() or ""
        self.assertIn("Pericárdio", last_text)
        self.assertIn("Médico Veterinário", last_text)

        image_buffer = BytesIO()
        PILImage.new("RGB", (680, 440), "white").save(image_buffer, format="JPEG")
        payload["imagens"] = [image_buffer.getvalue() for _ in range(6)]
        with_images = PdfReader(BytesIO(gerar_pdf_laudo_eco(payload)))
        self.assertEqual(len(with_images.pages), 2)
        image_page_text = with_images.pages[-1].extract_text() or ""
        self.assertIn("Médico Veterinário", image_page_text)
        self.assertIn("Imagem 6", image_page_text)

    def test_image_numbers_and_patient_identification_continue_across_pages(self) -> None:
        image_buffer = BytesIO()
        PILImage.new("RGB", (320, 240), "white").save(image_buffer, format="JPEG")
        payload = _base_report("modo_m")
        payload["medidas"] = {"DIVEd": "30", "VE_tecnica_relatorio": "modo_m"}
        payload["imagens"] = [image_buffer.getvalue() for _ in range(13)]
        reader = PdfReader(BytesIO(gerar_pdf_laudo_eco(payload)))

        self.assertEqual(len(reader.pages), 4)
        for page in reader.pages[1:]:
            text = page.extract_text() or ""
            self.assertIn("Paciente: Paciente teste", text)
            self.assertIn("Data do exame: 2026-07-26", text)
        self.assertIn("Imagem 13", reader.pages[-1].extract_text() or "")
    def test_pdf_omits_unmeasured_rows_and_unavailable_reference_ranges(self) -> None:
        payload = _base_report("modo_m")
        payload["medidas"] = {"DIVEd": "30", "VE_tecnica_relatorio": "modo_m"}
        text = _pdf_text(payload)

        self.assertIn("30.00 mm", text)
        self.assertIn("Faixas de referência indisponíveis", text)
        self.assertLess(text.index("CONCLUSÃO"), text.index("ANÁLISE QUANTITATIVA"))
        self.assertEqual(text.count("CONCLUSÃO"), 1)
        self.assertNotIn("16.00 - 24.00 mm", text)
        self.assertNotIn("Vmax aorta", text)
        self.assertNotIn("Regurgitações", text)

    def test_pdf_uses_only_complete_selected_reference_ranges(self) -> None:
        payload = _base_report("modo_m")
        payload["medidas"] = {"DIVEd": "30", "SIVd": "7", "VE_tecnica_relatorio": "modo_m"}
        payload["referencia_eco"] = {
            "especie": "Canina", "peso_kg": 10,
            "lvid_d_min": 20, "lvid_d_max": 40,
            "ivs_d_min": 5,
        }
        text = _pdf_text(payload)

        self.assertIn("20.00 - 40.00 mm", text)
        self.assertNotIn("3.50 - 5.50 mm", text)
        self.assertIn("Referência selecionada do cadastro", text)

    def test_pdf_keeps_measured_mapse_without_unsupported_auxiliary_range(self) -> None:
        payload = _base_report("modo_m")
        payload["medidas"] = {
            "TAPSE": "12", "MAPSE": "8", "VE_tecnica_relatorio": "modo_m",
        }
        payload["referencia_eco"] = aplicar_defaults_publicados_caninos({
            "especie": "Canina", "peso_kg": 10,
            "tapse_min": None, "tapse_max": None,
            "mapse_min": None, "mapse_max": None,
        })
        text = _pdf_text(payload)

        self.assertIn("TAPSE (excursão sistólica do plano anular tricúspide)\n12.00 mm\n9.20 - 14.70 mm", text)
        self.assertIn("MAPSE (excursão sistólica do plano anular mitral)\n8.00 mm\n--", text)

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
        self.assertNotIn("sugestivo de aumento das pressões", mode_2d_text)
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
