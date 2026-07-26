import os
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

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

    def test_atualiza_o_mesmo_rascunho_criado_para_o_ditado(self) -> None:
        laudo = SimpleNamespace(
            id=91,
            paciente_id=1,
            agendamento_id=None,
            tipo="ecocardiograma",
            titulo="Rascunho",
            descricao="",
            diagnostico="",
            observacoes="",
            status="Rascunho",
            clinic_id=None,
            data_exame=None,
            medico_solicitante=None,
            anexos=None,
            updated_at=None,
        )
        db = Mock()
        db.query.return_value.filter.return_value.first.return_value = laudo
        payload = {
            "paciente": {
                "nome": "Paciente teste",
                "especie": "Canina",
                "data_exame": "2026-07-25",
            },
            "medidas": {},
            "qualitativa": {},
            "conteudo": {},
            "agendamento_id": "",
            "clinica": "",
            "veterinario": {"nome": "Solicitante"},
            "tipo_laudo": "ecocardiograma",
            "status": "Finalizado",
            "ecocardiograma_estruturado": {
                "usar_no_laudo": True,
                "textos": {
                    "funcao_diastolica": "Disfunção diastólica grau I (padrão senil).",
                    "conclusao": "Disfunção diastólica grau I (padrão senil).",
                },
            },
        }

        with (
            patch.object(laudos, "_resolver_ou_criar_paciente", return_value=42),
            patch.object(
                laudos,
                "_sincronizar_publicacao_laudo_no_portal",
                return_value=(None, None, None, None),
            ),
        ):
            result = laudos.atualizar_laudo(
                91,
                payload,
                db=db,
                current_user=SimpleNamespace(id=7, nome="Usuário teste"),
            )

        self.assertIs(result, laudo)
        self.assertEqual(laudo.id, 91)
        self.assertEqual(laudo.paciente_id, 42)
        self.assertEqual(laudo.status, "Finalizado")
        self.assertEqual(
            laudo.diagnostico,
            "Disfunção diastólica grau I (padrão senil).",
        )
        self.assertIsNone(laudo.agendamento_id)
        db.add.assert_not_called()
        db.commit.assert_called_once()


if __name__ == "__main__":
    unittest.main()
