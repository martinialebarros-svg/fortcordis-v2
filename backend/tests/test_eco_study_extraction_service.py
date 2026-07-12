import io
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

from PIL import Image
from reportlab.pdfgen import canvas

BACKEND_DIR = Path(__file__).resolve().parents[1]
os.chdir(BACKEND_DIR)
sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "sqlite:///./fortcordis.db")
os.environ.setdefault("SECRET_KEY", "eco-study-extraction-test-secret-key-1234567890")

from app.services.eco_study_extraction_service import (  # noqa: E402
    MAX_ECO_STUDY_IMPORT_SIZE,
    _keep_most_reliable_candidates,
    consolidate_measurement_candidates,
    extract_measurements_from_text,
    parse_ge_vet_world_header_text,
    parse_eco_study_import_content,
    validate_eco_study_filename,
    validate_eco_study_size,
)


def _png_bytes() -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (120, 80), color="white").save(buffer, format="PNG")
    return buffer.getvalue()


def _pdf_bytes(lines: list[str]) -> bytes:
    buffer = io.BytesIO()
    document = canvas.Canvas(buffer)
    y = 800
    for line in lines:
        document.drawString(60, y, line)
        y -= 22
    document.save()
    return buffer.getvalue()


class EcoStudyExtractionServiceTest(unittest.TestCase):
    def test_extracts_and_normalizes_common_measurements(self) -> None:
        candidates = extract_measurements_from_text(
            """
            LVIDd 3.24 cm
            LVIDs: 2.10 cm
            IVSd 0.71 cm
            LVPWd 0.69 cm
            EF Teich 62 %
            FS 35 %
            LA/Ao 1.62
            MV E Vel 0.85 m/s
            MV A Vel 0.61 m/s
            IVRT 72 ms
            TR Vmax 3.25 m/s
            """,
            source="test",
            confidence=0.99,
        )
        measurements, consolidated, conflicts = consolidate_measurement_candidates(candidates)

        self.assertEqual(measurements["DIVEd"], 32.4)
        self.assertEqual(measurements["DIVES"], 21)
        self.assertEqual(measurements["SIVd"], 7.1)
        self.assertEqual(measurements["PLVEd"], 6.9)
        self.assertEqual(measurements["FE_Teicholz"], 62)
        self.assertEqual(measurements["DeltaD_FS"], 35)
        self.assertEqual(measurements["AE_Ao"], 1.62)
        self.assertEqual(measurements["Onda_E"], 0.85)
        self.assertEqual(measurements["Onda_A"], 0.61)
        self.assertEqual(measurements["TRIV"], 72)
        self.assertEqual(measurements["IT_Vmax"], 3.25)
        self.assertNotIn("e_doppler", measurements)
        self.assertNotIn("a_doppler", measurements)
        self.assertEqual(conflicts, 0)
        self.assertTrue(all(item["texto_origem"] for item in consolidated))

    def test_conflicting_values_are_not_suggested(self) -> None:
        candidates = extract_measurements_from_text("LVIDd 30 mm\nLVIDd 36 mm")
        measurements, consolidated, conflicts = consolidate_measurement_candidates(candidates)

        self.assertNotIn("DIVEd", measurements)
        self.assertEqual(conflicts, 1)
        self.assertEqual({item["status"] for item in consolidated}, {"conflito"})

    def test_does_not_read_e_over_triv_ratio_as_second_triv_measurement(self) -> None:
        candidates = extract_measurements_from_text(
            "TRIV 40.00 ms\nE/triv 14.92",
            source="ocr:test",
        )

        measurements, consolidated, conflicts = consolidate_measurement_candidates(candidates)

        self.assertEqual(measurements["TRIV"], 40)
        self.assertEqual(conflicts, 0)
        self.assertEqual(len([item for item in consolidated if item["campo"] == "TRIV"]), 1)

    def test_accepts_curly_apostrophe_in_tissue_doppler_ratio(self) -> None:
        candidates = extract_measurements_from_text("E/E’ 8.47", source="ocr:test")

        measurements, _, conflicts = consolidate_measurement_candidates(candidates)

        self.assertEqual(measurements["E_E_linha"], 8.47)
        self.assertEqual(conflicts, 0)

    def test_prefers_complete_two_decimal_e_over_e_reading(self) -> None:
        truncated = extract_measurements_from_text(
            "E/E’ 8.2",
            source="ocr:high-contrast",
            confidence=0.93,
        )
        complete = extract_measurements_from_text(
            "E/E 8.23",
            source="ocr:binary",
            confidence=0.78,
        )

        selected = _keep_most_reliable_candidates(truncated + complete)
        measurements, _, conflicts = consolidate_measurement_candidates(selected)

        self.assertEqual(measurements["E_E_linha"], 8.23)
        self.assertEqual(conflicts, 0)

    def test_parses_ge_vet_world_header_without_clinical_inference(self) -> None:
        payload = parse_ge_vet_world_header_text(
            """
            VET WORLD
            BOLINHA, TUTOR TESTE
            19/07/24 12:57:15
            Idade 3Y
            CAO_P
            """
        )

        self.assertIsNotNone(payload)
        self.assertEqual(payload["paciente"]["nome"], "Bolinha")
        self.assertEqual(payload["paciente"]["tutor"], "Tutor Teste")
        self.assertEqual(payload["paciente"]["idade"], "3 anos")
        self.assertEqual(payload["paciente"]["especie"], "Canina")
        self.assertEqual(payload["paciente"]["data_exame"], "2024-07-19")
        self.assertEqual(payload["perfil"], "ge_vet_world")

    def test_validates_extension_and_size(self) -> None:
        with self.assertRaisesRegex(ValueError, "imagem ou PDF"):
            validate_eco_study_filename("estudo.xml")
        with self.assertRaisesRegex(ValueError, "30MB"):
            validate_eco_study_size(b"x" * (MAX_ECO_STUDY_IMPORT_SIZE + 1))

    @patch("app.services.eco_study_extraction_service._extract_text_with_tesseract")
    def test_parses_image_with_ocr_evidence(self, ocr_mock) -> None:
        ocr_mock.return_value = "LVIDd 3.24 cm\nEF Teich 62 %"

        payload = parse_eco_study_import_content("captura.png", _png_bytes())

        self.assertEqual(payload["medidas"]["DIVEd"], 32.4)
        self.assertEqual(payload["medidas"]["FE_Teicholz"], 62)
        self.assertEqual(payload["meta_importacao_estudo"]["formato"], "png")

    def test_parses_pdf_text_layer_without_ocr(self) -> None:
        content = _pdf_bytes(["LVIDd 3.24 cm", "LA/Ao 1.62", "TR Vmax 3.25 m/s"])

        payload = parse_eco_study_import_content("estudo.pdf", content)

        self.assertEqual(payload["medidas"]["DIVEd"], 32.4)
        self.assertEqual(payload["medidas"]["AE_Ao"], 1.62)
        self.assertEqual(payload["medidas"]["IT_Vmax"], 3.25)
        self.assertEqual(payload["meta_importacao_estudo"]["paginas"], 1)
        self.assertTrue(
            all(item["origem"] == "pdf:text" for item in payload["medidas_extraidas"])
        )


if __name__ == "__main__":
    unittest.main()
