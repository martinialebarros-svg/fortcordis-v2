"""Testes do lint de formato da matriz do verify.md.

O lint existe porque o gate de promocao so le tabela com coluna `Status`
(RF-004 de `promocao-bloqueia-criterio-pendente`). Matriz com outro cabecalho
-- `| Criterio | Evidencia | Resultado |`, herdado de specs anteriores ao gate
-- fica invisivel, e um `pendente` ali atravessa a promocao.
"""
import importlib.util
import sys
import unittest
from pathlib import Path


REPO_DIR = Path(__file__).resolve().parents[2]
SCRIPT_PATH = REPO_DIR / "scripts" / "ci" / "check_verify_matrix_format.py"
SPEC = importlib.util.spec_from_file_location("check_verify_matrix_format", SCRIPT_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f"Nao foi possivel carregar o lint de matriz: {SCRIPT_PATH}")
LINT = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = LINT
SPEC.loader.exec_module(LINT)

CANONICA = (
    "| ID | Tipo | Evidencia | Status |\n"
    "| --- | --- | --- | --- |\n"
    "| CA-001 | aceitacao | teste x | ok |\n"
)
LEGADA = (
    "| Criterio | Evidencia | Resultado |\n"
    "| --- | --- | --- |\n"
    "| CA-001 | teste x | pendente |\n"
)


class MatrizLegivelTest(unittest.TestCase):
    def test_cabecalho_canonico_e_legivel(self) -> None:
        self.assertTrue(LINT.tem_matriz_legivel(CANONICA))

    def test_cabecalho_legado_nao_e_legivel(self) -> None:
        self.assertFalse(LINT.tem_matriz_legivel(LEGADA))

    def test_status_acentuado_ou_maiusculo_ainda_e_legivel(self) -> None:
        for cabecalho in ["| ID | Status |", "| id | status |", "| ID | STATUS |"]:
            conteudo = f"{cabecalho}\n| --- | --- |\n| CA-001 | ok |\n"
            self.assertTrue(LINT.tem_matriz_legivel(conteudo), cabecalho)

    def test_verify_so_com_prosa_nao_e_legivel(self) -> None:
        self.assertFalse(LINT.tem_matriz_legivel("# Verify\n\n- CA-001: passou\n"))

    def test_basta_uma_tabela_com_status(self) -> None:
        # Tabela de etapas antes da matriz nao pode confundir a deteccao.
        conteudo = "| Etapa | Resultado |\n| --- | --- |\n| Deploy | ok |\n\n" + CANONICA
        self.assertTrue(LINT.tem_matriz_legivel(conteudo))

    def test_tabela_de_etapas_sozinha_nao_basta(self) -> None:
        self.assertFalse(
            LINT.tem_matriz_legivel("| Etapa | Resultado |\n| --- | --- |\n| Deploy | ok |\n")
        )


class EscopoDoDiffTest(unittest.TestCase):
    def test_so_olha_verify_de_spec(self) -> None:
        arquivos = [
            "docs/specs/feature-a/verify.md",
            "docs/specs/feature-a/spec.md",
            "docs/specs/templates/verify.md",
            "backend/app/main.py",
            "docs/RUNBOOK-STAGE-PROD.md",
        ]
        self.assertEqual(LINT.verify_tocados(arquivos), ["docs/specs/feature-a/verify.md"])

    def test_diff_sem_verify_dispensa_o_lint(self) -> None:
        resultado = LINT.avaliar(["backend/app/main.py"], str(REPO_DIR))
        self.assertTrue(resultado.passou)


class RepoTest(unittest.TestCase):
    def test_template_canonico_passa_no_proprio_lint(self) -> None:
        template = REPO_DIR / "docs" / "specs" / "templates" / "verify.md"
        self.assertTrue(LINT.tem_matriz_legivel(template.read_text(encoding="utf-8")))

    def test_matrizes_convertidas_ficaram_legiveis_pelo_gate(self) -> None:
        # As 19 specs cuja matriz foi migrada de `Criterio/Evidencia/Resultado`.
        convertidas = [
            "agenda-formalizacao-portal-clinicas",
            "agenda-reserva-expirada-reabilitacao",
            "agenda-reserva-formalizacao-dados-pendentes",
            "laudo-whatsapp-liberacao-status",
            "perf18-authenticated-latency-gate",
            "whatsapp-acesso-midia-recebida",
            "whatsapp-atendente-auto-selecao",
            "whatsapp-central-atendimento-ui",
            "whatsapp-equipe-atendentes-edicao",
            "whatsapp-fila-nao-lida-urgencia",
            "whatsapp-fila-respostas",
            "whatsapp-lembrete-automatico-consulta",
            "whatsapp-lembrete-prontidao-clinicas",
            "whatsapp-mensagem-reacao-emoji",
            "whatsapp-notificacao-push-mensagem-recebida",
            "whatsapp-portal-clinic-invite-template",
            "whatsapp-produtividade-equipe",
            "whatsapp-reenvio-mensagem-falha",
            "whatsapp-smoke-test-isolamento-limpeza",
        ]
        for feature in convertidas:
            caminho = REPO_DIR / "docs" / "specs" / feature / "verify.md"
            self.assertTrue(caminho.is_file(), feature)
            self.assertTrue(
                LINT.tem_matriz_legivel(caminho.read_text(encoding="utf-8")), feature
            )


if __name__ == "__main__":
    unittest.main()
