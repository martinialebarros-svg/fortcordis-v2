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
    LAUDO_PDF_ECO_RENDERER_VERSION,
    LAUDO_PDF_RENDERER_VERSION,
    compute_laudo_pdf_cache_key,
)
from app.utils.ecocardiograma_medidas import (  # noqa: E402
    extrair_medidas_ecocardiograma_da_descricao,
)
from app.api.v1.endpoints.laudos import _montar_descricao_ecocardiograma  # noqa: E402


class EcocardiogramaMedidasTest(unittest.TestCase):
    def test_preserva_medidas_2d_e_seletor_textual_do_pdf(self) -> None:
        description = """
## Medidas Ecocardiograficas
- DIVEd_2D: 32,4
- SIVd_2D: 6.2
- VDF_2D: 96
- FE_Teicholz_2D: 57
- VE_tecnica_relatorio: 2d
- VE_vista_2D: eixo_curto
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
        self.assertEqual(measurements["VE_vista_2D"], "eixo_curto")
        self.assertEqual(measurements["Remodelamento_AD"], "moderado")
        self.assertNotIn("funcao", measurements)

    def test_vista_2d_confirmada_sobrevive_salvamento_e_rejeita_valor_invalido(self) -> None:
        saved = _montar_descricao_ecocardiograma({"VE_vista_2D": "eixo_longo", "DIVEd_2D": "32"}, {})
        self.assertEqual(extrair_medidas_ecocardiograma_da_descricao(saved)["VE_vista_2D"], "eixo_longo")
        invalid = saved.replace("eixo_longo", "vista_desconhecida")
        self.assertNotIn("VE_vista_2D", extrair_medidas_ecocardiograma_da_descricao(invalid))

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

    def test_preserva_apenas_confirmacao_valida_de_unidade_por_medida(self) -> None:
        measurements = extrair_medidas_ecocardiograma_da_descricao("""
## Medidas Ecocardiograficas
- DIVEd: 2,5
- unidade_confirmada_DIVEd: cm
- SIVd: 3,0
- unidade_confirmada_SIVd: mm
- unidade_confirmada_TAPSE: cm
- unidade_confirmada_Aorta: metros

## Avaliacao Qualitativa
""")
        self.assertEqual(measurements["DIVEd"], "2.5")
        self.assertEqual(measurements["unidade_confirmada_DIVEd"], "cm")
        self.assertEqual(measurements["unidade_confirmada_SIVd"], "mm")
        self.assertNotIn("unidade_confirmada_TAPSE", measurements)
        self.assertNotIn("unidade_confirmada_Aorta", measurements)

    def test_confirmacao_da_unidade_sobrevive_ao_salvamento_e_leitura(self) -> None:
        saved = _montar_descricao_ecocardiograma(
            {"DIVEd": "2.5", "unidade_confirmada_DIVEd": "cm"}, {}
        )
        self.assertEqual(
            extrair_medidas_ecocardiograma_da_descricao(saved)["unidade_confirmada_DIVEd"],
            "cm",
        )

    def test_cache_do_pdf_inclui_versao_do_renderizador(self) -> None:
        self.assertEqual(LAUDO_PDF_ECO_RENDERER_VERSION, "2026-10-03-eco-2d-visser-index-v14")
        database = MagicMock()
        database.query.return_value.filter.return_value.first.return_value = (
            SimpleNamespace(id=7, tipo="ecocardiograma")
        )
        stamp = {"laudo_id": 7, "laudo_updated_at": "2026-07-27T10:00:00"}

        with patch(
            "app.services.laudo_pdf_service._carregar_stamp_cache",
            return_value=stamp,
        ):
            cache_key = compute_laudo_pdf_cache_key(database, 7, 3)

        expected_payload = {
            "pdf_renderer_version": LAUDO_PDF_ECO_RENDERER_VERSION,
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

    def test_cache_de_outra_modalidade_preserva_versao_anterior(self) -> None:
        database = MagicMock()
        database.query.return_value.filter.return_value.first.return_value = (
            SimpleNamespace(id=7, tipo="pressao_arterial")
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
            json.dumps(expected_payload, sort_keys=True, ensure_ascii=True).encode("utf-8")
        ).hexdigest()
        self.assertEqual(cache_key, expected)


if __name__ == "__main__":
    unittest.main()
