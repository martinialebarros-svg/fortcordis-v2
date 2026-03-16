import os
import sys
import unittest
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
os.chdir(BACKEND_DIR)
sys.path.insert(0, str(BACKEND_DIR))

from app.utils.paciente_helpers import (
    atualizar_observacoes_com_idade,
    extrair_idade_paciente,
    normalizar_sexo_paciente,
)


class PacienteHelpersTest(unittest.TestCase):
    def test_normalizar_sexo_paciente_corrige_variantes(self) -> None:
        self.assertEqual(normalizar_sexo_paciente("Fêmea"), "Fêmea")
        self.assertEqual(normalizar_sexo_paciente("Femea"), "Fêmea")
        self.assertEqual(normalizar_sexo_paciente("FÃªmea"), "Fêmea")
        self.assertEqual(normalizar_sexo_paciente("Macho"), "Macho")

    def test_extrair_idade_paciente_prioriza_observacoes(self) -> None:
        self.assertEqual(
            extrair_idade_paciente(None, "Idade: 10 anos\nPaciente cardiopata"),
            "10 anos",
        )

    def test_atualizar_observacoes_com_idade_substitui_linha_existente(self) -> None:
        atualizado = atualizar_observacoes_com_idade(
            "Paciente cardiopata\nIdade: 8 anos\nRetorno em 30 dias",
            "10 anos",
        )
        self.assertEqual(
            atualizado,
            "Idade: 10 anos\nPaciente cardiopata\nRetorno em 30 dias",
        )


if __name__ == "__main__":
    unittest.main()
