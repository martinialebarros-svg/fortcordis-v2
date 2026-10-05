import copy
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts.sync_feline_diastolic_presets import DEFAULT_FILE, PATTERNS, synchronize
from app.services import frases_ecocardiograma_estruturado_teste_service as service


class FelineDiastolicPresetTests(unittest.TestCase):
    def test_sync_is_idempotent_and_preserves_custom_choice(self):
        bank = json.loads(DEFAULT_FILE.read_text(encoding="utf-8"))
        synchronize(bank)
        before = copy.deepcopy(bank)
        self.assertEqual(synchronize(bank), [])
        self.assertEqual(bank, before)

        # Simulate an older runtime bank before the five new options existed.
        bank["presets"] = [
            item for item in bank["presets"]
            if not item["key"].startswith("felino_diastolica_")
        ]
        aspect = next(item for item in bank["aspectos"] if item["key"] == "funcao_diastolica")
        titles = {item[1] for item in PATTERNS}
        aspect["frases"] = [item for item in aspect["frases"] if item["titulo"] not in titles]
        custom = next(item for item in bank["presets"] if item["key"] == "hcm_leve")
        custom["selecoes"].append({
            "aspecto": "funcao_diastolica", "frase_titulo": "Disfunção diástólica leve", "frase_id": 104,
        })
        first_changes = synchronize(bank)
        self.assertEqual(len(first_changes), 10)
        self.assertEqual(synchronize(bank), [])
        self.assertEqual(len([p for p in bank["presets"] if p["key"].startswith("felino_diastolica_")]), 5)
        self.assertEqual(custom["selecoes"][-1], {
            "aspecto": "funcao_diastolica", "frase_titulo": "Disfunção diástólica leve", "frase_id": 104,
        })
        self.assertTrue(all(
            [selection["aspecto"] for selection in preset["selecoes"]] == ["funcao_diastolica"]
            for preset in bank["presets"] if preset["key"].startswith("felino_diastolica_")
        ))
        self.assertNotIn("senil", " ".join(item[2] for item in PATTERNS).lower())

    def test_each_new_preset_resolves_only_the_diastolic_aspect(self):
        with tempfile.TemporaryDirectory() as directory:
            file = Path(directory) / "frases.json"
            file.write_bytes(DEFAULT_FILE.read_bytes())
            with patch.object(service, "FRASES_FILE", file), patch.object(service, "DATA_DIR", file.parent), patch.object(
                service, "RUNTIME_BACKUP_DIR", file.parent / "backups"
            ):
                payload = service.get_payload()
                for preset in payload["presets"]:
                    if not preset["key"].startswith("felino_diastolica_"):
                        continue
                    resolved = service.apply_preset(preset["id"])
                    self.assertEqual(list(resolved["textos"]), ["funcao_diastolica"])
                    self.assertTrue(resolved["textos"]["funcao_diastolica"])


if __name__ == "__main__":
    unittest.main()
