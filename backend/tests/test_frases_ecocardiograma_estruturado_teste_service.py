import os
import sys
import tempfile
import unittest
from copy import deepcopy
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

    def test_updates_generate_runtime_backups(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            data_dir = Path(tmp)
            frases_file = data_dir / "frases_ecocardiograma_estruturado_teste.json"
            runtime_backup_dir = data_dir / "runtime_backups" / "frases_ecocardiograma_estruturado_teste"

            original_data_dir = service.DATA_DIR
            original_frases_file = service.FRASES_FILE
            original_runtime_backup_dir = service.RUNTIME_BACKUP_DIR
            try:
                service.DATA_DIR = data_dir
                service.FRASES_FILE = frases_file
                service.RUNTIME_BACKUP_DIR = runtime_backup_dir

                service.get_payload()
                service.create_phrase(
                    {
                        "aspecto": "conclusao",
                        "titulo": "Conclusao teste backup",
                        "texto": "Texto de conclusao para validar backup automatico.",
                        "tags": ["backup"],
                    }
                )
                service.update_phrase(
                    1,
                    {
                        "aspecto": "valva_mitral",
                        "titulo": "Aspecto habitual",
                        "texto": "Texto atualizado para validar snapshot de runtime.",
                        "tags": ["atualizado"],
                    },
                )

                backups = sorted(runtime_backup_dir.glob("*.json"))
                self.assertGreaterEqual(len(backups), 2)
            finally:
                service.DATA_DIR = original_data_dir
                service.FRASES_FILE = original_frases_file
                service.RUNTIME_BACKUP_DIR = original_runtime_backup_dir

    def test_preset_changes_generate_runtime_backups(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            data_dir = Path(tmp)
            frases_file = data_dir / "frases_ecocardiograma_estruturado_teste.json"
            runtime_backup_dir = data_dir / "runtime_backups" / "frases_ecocardiograma_estruturado_teste"

            original_data_dir = service.DATA_DIR
            original_frases_file = service.FRASES_FILE
            original_runtime_backup_dir = service.RUNTIME_BACKUP_DIR
            try:
                service.DATA_DIR = data_dir
                service.FRASES_FILE = frases_file
                service.RUNTIME_BACKUP_DIR = runtime_backup_dir

                service.get_payload()
                created = service.save_preset(
                    {
                        "label": "Preset teste runtime",
                        "patologia": "Teste",
                        "grau": "Leve",
                        "descricao": "Preset para validar backup no ciclo de salvar/excluir.",
                        "selecoes": [
                            {
                                "aspecto": "valva_mitral",
                                "frase_titulo": "Aspecto habitual",
                            }
                        ],
                    }
                )
                payload_after_create = service.get_payload()
                self.assertTrue(
                    any(
                        preset["id"] == created["id"]
                        for preset in payload_after_create.get("presets") or []
                    )
                )

                service.delete_preset(int(created["id"]))

                payload_after_delete = service.get_payload()
                self.assertFalse(
                    any(
                        preset["id"] == created["id"]
                        for preset in payload_after_delete.get("presets") or []
                    )
                )

                backup_names = [path.name for path in sorted(runtime_backup_dir.glob("*.json"))]
                self.assertTrue(any("__save_preset" in name for name in backup_names))
                self.assertTrue(any("__delete_preset" in name for name in backup_names))
            finally:
                service.DATA_DIR = original_data_dir
                service.FRASES_FILE = original_frases_file
                service.RUNTIME_BACKUP_DIR = original_runtime_backup_dir

    def test_corrupted_store_is_recovered_from_runtime_backup(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            data_dir = Path(tmp)
            frases_file = data_dir / "frases_ecocardiograma_estruturado_teste.json"
            runtime_backup_dir = data_dir / "runtime_backups" / "frases_ecocardiograma_estruturado_teste"

            original_data_dir = service.DATA_DIR
            original_frases_file = service.FRASES_FILE
            original_runtime_backup_dir = service.RUNTIME_BACKUP_DIR
            try:
                service.DATA_DIR = data_dir
                service.FRASES_FILE = frases_file
                service.RUNTIME_BACKUP_DIR = runtime_backup_dir

                payload = service.get_payload()
                payload = deepcopy(payload)
                conclusao = next(item for item in payload["aspectos"] if item["key"] == "conclusao")
                conclusao["frases"].append(
                    {
                        "id": 999,
                        "titulo": "Conclusao recuperavel",
                        "texto": "Conteudo que deve voltar apos corrupcao do arquivo.",
                        "tags": ["recovery"],
                        "ativo": 1,
                    }
                )
                service.import_store(payload)
                service._snapshot_current_store("manual_recovery_snapshot")

                frases_file.write_text("{arquivo_corrompido:", encoding="utf-8")

                recovered = service.get_payload()
                recovered_conclusao = next(
                    item for item in recovered["aspectos"] if item["key"] == "conclusao"
                )
                self.assertTrue(
                    any(
                        frase["titulo"] == "Conclusao recuperavel"
                        for frase in recovered_conclusao["frases"]
                    )
                )
            finally:
                service.DATA_DIR = original_data_dir
                service.FRASES_FILE = original_frases_file
                service.RUNTIME_BACKUP_DIR = original_runtime_backup_dir


if __name__ == "__main__":
    unittest.main()
