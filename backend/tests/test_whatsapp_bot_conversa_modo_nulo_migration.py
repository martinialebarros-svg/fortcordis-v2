import importlib.util
import os
import sys
import tempfile
import unittest
from pathlib import Path

from sqlalchemy import create_engine, inspect, text

BACKEND_DIR = Path(__file__).resolve().parents[1]
os.chdir(BACKEND_DIR)
sys.path.insert(0, str(BACKEND_DIR))


def _carregar(nome: str, arquivo: str):
    caminho = BACKEND_DIR / "migrations" / "versions" / arquivo
    spec = importlib.util.spec_from_file_location(nome, caminho)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Nao foi possivel carregar migracao: {caminho}")
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo


# A 75 cria a tabela com `modo TEXT NOT NULL DEFAULT 'suggest'`; a 78 e a que
# converte. Partir da 75 e o unico jeito de testar a conversao de verdade -
# criar a tabela pelo model produziria uma coluna que ja nasce anulavel.
MIGRACAO_75 = _carregar("migration_20260820_75", "20260820_75_whatsapp_bot_atendimento.py")
MIGRACAO_78 = _carregar(
    "migration_20260825_78", "20260825_78_whatsapp_bot_conversa_modo_nulo.py"
)

TABELA = "whatsapp_bot_conversa_estado"


class WhatsAppBotConversaModoNuloMigrationTest(unittest.TestCase):
    def _engine(self):
        tmpdir = tempfile.TemporaryDirectory()
        engine = create_engine(f"sqlite:///{Path(tmpdir.name) / 'modo-nulo.db'}")
        return tmpdir, engine

    def _modo_nullable(self, engine) -> bool:
        for coluna in inspect(engine).get_columns(TABELA):
            if coluna["name"] == "modo":
                return bool(coluna.get("nullable", True))
        raise AssertionError("coluna 'modo' nao encontrada")

    def test_converte_coluna_e_zera_suggest_incidental(self) -> None:
        tmpdir, engine = self._engine()
        try:
            with engine.begin() as conn:
                MIGRACAO_75.upgrade(conn, "sqlite")
            self.assertFalse(self._modo_nullable(engine), "a 75 deve criar NOT NULL")

            with engine.begin() as conn:
                conn.execute(
                    text(
                        f"INSERT INTO {TABELA} (wa_identity, modo, handoff_motivo) "
                        "VALUES ('5585900000001', 'suggest', 'emergencia')"
                    )
                )
                conn.execute(
                    text(
                        f"INSERT INTO {TABELA} (wa_identity, modo) VALUES ('5585900000002', 'off')"
                    )
                )
                conn.execute(
                    text(
                        f"INSERT INTO {TABELA} (wa_identity, modo) VALUES ('5585900000003', 'auto')"
                    )
                )

            with engine.begin() as conn:
                MIGRACAO_78.upgrade(conn, "sqlite")

            self.assertTrue(self._modo_nullable(engine), "a 78 deve tornar anulavel")

            with engine.begin() as conn:
                linhas = dict(
                    conn.execute(text(f"SELECT wa_identity, modo FROM {TABELA}")).all()
                )
                preservado = conn.execute(
                    text(f"SELECT handoff_motivo FROM {TABELA} WHERE wa_identity = '5585900000001'")
                ).scalar()

            # O 'suggest' incidental vira NULL - e o que devolve a conversa ao
            # portao do piloto. `off` e `auto` sao decisao de gente e ficam.
            self.assertIsNone(linhas["5585900000001"])
            self.assertEqual(linhas["5585900000002"], "off")
            self.assertEqual(linhas["5585900000003"], "auto")
            # O rebuild do SQLite copia coluna a coluna: se alguma ficar de
            # fora, o DROP TABLE seguinte apaga o dado em silencio.
            self.assertEqual(preservado, "emergencia")
        finally:
            engine.dispose()
            tmpdir.cleanup()

    def test_aceita_null_depois_da_conversao(self) -> None:
        tmpdir, engine = self._engine()
        try:
            with engine.begin() as conn:
                MIGRACAO_75.upgrade(conn, "sqlite")
                MIGRACAO_78.upgrade(conn, "sqlite")
                conn.execute(
                    text(f"INSERT INTO {TABELA} (wa_identity, modo) VALUES ('5585900000004', NULL)")
                )
                gravado = conn.execute(
                    text(f"SELECT modo FROM {TABELA} WHERE wa_identity = '5585900000004'")
                ).scalar()
            self.assertIsNone(gravado)
        finally:
            engine.dispose()
            tmpdir.cleanup()

    def test_segundo_run_nao_apaga_override_deliberado(self) -> None:
        """Idempotencia com dente.

        Rodar de novo nao pode zerar um 'suggest' escolhido DEPOIS da
        conversao - por isso a guarda sai cedo quando a coluna ja e anulavel,
        em vez de repetir o UPDATE.
        """
        tmpdir, engine = self._engine()
        try:
            with engine.begin() as conn:
                MIGRACAO_75.upgrade(conn, "sqlite")
                MIGRACAO_78.upgrade(conn, "sqlite")
                conn.execute(
                    text(
                        f"INSERT INTO {TABELA} (wa_identity, modo) VALUES ('5585900000005', 'suggest')"
                    )
                )
                MIGRACAO_78.upgrade(conn, "sqlite")
                gravado = conn.execute(
                    text(f"SELECT modo FROM {TABELA} WHERE wa_identity = '5585900000005'")
                ).scalar()
            self.assertEqual(gravado, "suggest")
        finally:
            engine.dispose()
            tmpdir.cleanup()

    def test_tabela_inexistente_e_no_op(self) -> None:
        tmpdir, engine = self._engine()
        try:
            with engine.begin() as conn:
                MIGRACAO_78.upgrade(conn, "sqlite")
            self.assertNotIn(TABELA, inspect(engine).get_table_names())
        finally:
            engine.dispose()
            tmpdir.cleanup()


if __name__ == "__main__":
    unittest.main()
