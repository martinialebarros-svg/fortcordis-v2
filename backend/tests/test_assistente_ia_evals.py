import json
import os
import sys
import unittest
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
os.chdir(BACKEND_DIR)
sys.path.insert(0, str(BACKEND_DIR))

from app.services.assistente_ia_service import _assistant_instructions
from app.services.assistente_ia_tools import TOOL_DEFINITIONS


class AssistenteIAEvalContractTest(unittest.TestCase):
    def test_casos_de_regressao_referenciam_ferramentas_estritas_e_roteadas(self) -> None:
        payload = json.loads((BACKEND_DIR / "evals" / "assistente_ia_admin_cases.json").read_text())
        definitions = {item["name"]: item for item in TOOL_DEFINITIONS}
        instructions = _assistant_instructions(
            type("Admin", (), {"nome": "Admin"})(),
            "Nenhuma memoria aprovada.",
        )
        self.assertGreaterEqual(len(payload["cases"]), 13)
        for case in payload["cases"]:
            tool_name = case["expected_tool"]
            self.assertIn(tool_name, definitions, case["id"])
            self.assertTrue(definitions[tool_name]["strict"], case["id"])
            self.assertFalse(definitions[tool_name]["parameters"]["additionalProperties"], case["id"])
            self.assertIn(tool_name, instructions, case["id"])

        cases = {case["id"]: case for case in payload["cases"]}
        self.assertIn("solicitação da clínica", cases["reschedule"]["prompt"])
        self.assertEqual(
            cases["clinical-draft-context-first"]["expected_tool"],
            "obter_contexto_laudo",
        )
        self.assertEqual(
            cases["clinical-draft-save-explicit"]["expected_tool"],
            "salvar_rascunho_clinico",
        )
        self.assertIn("conteúdo", cases["clinical-draft-save-explicit"]["prompt"])

    def test_instrucoes_distinguem_contexto_de_gravacao_do_rascunho(self) -> None:
        instructions = _assistant_instructions(
            type("Admin", (), {"nome": "Admin"})(),
            "Nenhuma memoria aprovada.",
        )

        self.assertIn("Solicitacao do administrador", instructions)
        self.assertIn("obter_contexto_laudo primeiro", instructions)
        self.assertIn("salvar_rascunho_clinico", instructions)
        self.assertIn("solicitar_bloqueio_agenda diretamente", instructions)

    def test_acoes_operacionais_do_eval_nunca_sao_escritas_genericas(self) -> None:
        tool_names = {item["name"] for item in TOOL_DEFINITIONS}
        self.assertFalse({"executar_sql", "chamar_endpoint", "escrever_banco", "finalizar_laudo"} & tool_names)
        self.assertNotIn("finalizar_laudo", tool_names)


if __name__ == "__main__":
    unittest.main()
