import hashlib
import json
import os
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

BACKEND_DIR = Path(__file__).resolve().parents[1]
os.chdir(BACKEND_DIR)
sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "sqlite:///./fortcordis.db")
os.environ.setdefault(
    "SECRET_KEY",
    "ecocardiograma-medidas-test-secret-key-1234567890",
)

from app.services.laudo_pdf_service import (  # noqa: E402
    LAUDO_PDF_RENDERER_VERSION,
    compute_laudo_pdf_cache_key,
)
from app.utils.ecocardiograma_medidas import (  # noqa: E402
    extrair_medidas_ecocardiograma_da_descricao,
)


class EcocardiogramaMedidasTest(unittest.TestCase):
    def test_preserva_medidas_2d_e_seletor_textual_do_pdf(self) -> None:
        description = """
## Medidas Ecocardiograficas
- DIVEd_2D: 32,4
- SIVd_2D: 6.2
- VDF_2D: 96
- FE_Teicholz_2D: 57
- VE_tecnica_relatorio: 2d
- Remodelamento_AD: moderado

## Avaliacao Qualitativa
- funcao: Onda E 1.20 m/s.
"""

        measurements = extrair_medidas_ecocardiograma_da_descricao(description)

        self.assertEqual(measurements["DIVEd_2D"], "32.4")
        self.assertEqual(measurements["SIVd_2D"], "6.2")
        self.assertEqual(measurements["VDF_2D"], "96")
        self.assertEqual(measurements["FE_Teicholz_2D"], "57")
        self.assertEqual(measurements["VE_tecnica_relatorio"], "2d")
        self.assertEqual(measurements["Remodelamento_AD"], "moderado")
        self.assertNotIn("funcao", measurements)

    def test_infere_2d_em_laudo_legado_com_apenas_essa_serie(self) -> None:
        measurements = extrair_medidas_ecocardiograma_da_descricao(
            """
## Medidas Ecocardiograficas
- DIVEd_2D: 31.69
- DIVES_2D: 15.39

## Avaliacao Qualitativa
"""
        )

        self.assertEqual(measurements["VE_tecnica_relatorio"], "2d")

    def test_nao_escolhe_tecnica_quando_as_duas_series_coexistem(self) -> None:
        measurements = extrair_medidas_ecocardiograma_da_descricao(
            """
## Medidas Ecocardiograficas
- DIVEd: 30
- DIVEd_2D: 32

## Avaliacao Qualitativa
"""
        )

        self.assertNotIn("VE_tecnica_relatorio", measurements)

    def test_cache_do_pdf_inclui_versao_do_renderizador(self) -> None:
        database = MagicMock()
        database.query.return_value.filter.return_value.first.return_value = (
            SimpleNamespace(id=7)
        )
        stamp = {"laudo_id": 7, "laudo_updated_at": "2026-07-27T10:00:00"}

        with patch(
            "app.services.laudo_pdf_service._carregar_stamp_cache",
            return_value=stamp,
        ):
            cache_key = compute_laudo_pdf_cache_key(database, 7, 3)

        expected_payload = {
            "pdf_renderer_version": LAUDO_PDF_RENDERER_VERSION,
            **stamp,
        }
        expected = hashlib.sha256(
            json.dumps(
                expected_payload,
                sort_keys=True,
                ensure_ascii=True,
            ).encode("utf-8")
        ).hexdigest()
        self.assertEqual(cache_key, expected)


if __name__ == "__main__":
    unittest.main()
