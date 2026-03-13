import os
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

BACKEND_DIR = Path(__file__).resolve().parents[1]
os.chdir(BACKEND_DIR)
sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "sqlite:///./fortcordis.db")
os.environ.setdefault(
    "SECRET_KEY",
    "xml-import-test-secret-key-1234567890",
)

from app.services.xml_import_jobs import (
    MAX_XML_IMPORT_SIZE,
    decode_xml_import_base64,
    parse_xml_import_content,
    serialize_xml_import_job,
)


class XmlImportJobsTest(unittest.TestCase):
    def test_parse_xml_import_content_requires_xml_extension(self) -> None:
        with self.assertRaisesRegex(ValueError, "Arquivo deve ser um XML"):
            parse_xml_import_content("exame.txt", b"<xml />")

    def test_parse_xml_import_content_enforces_size_limit(self) -> None:
        oversized = b"a" * (MAX_XML_IMPORT_SIZE + 1)
        with self.assertRaisesRegex(ValueError, "XML excede o limite de 5MB"):
            parse_xml_import_content("exame.xml", oversized)

    def test_decode_invalid_base64_raises_clean_message(self) -> None:
        with self.assertRaisesRegex(ValueError, "Conteudo base64 invalido"):
            decode_xml_import_base64("%%%")

    @patch("app.services.xml_import_jobs.parse_xml_eco", return_value={"paciente": {"nome": "Bob"}})
    def test_parse_xml_import_content_returns_parser_payload(self, parser_mock) -> None:
        result = parse_xml_import_content("exame.xml", b"<xml></xml>")

        self.assertEqual(result["paciente"]["nome"], "Bob")
        parser_mock.assert_called_once()

    def test_serialize_xml_import_job_includes_completed_payload(self) -> None:
        job = SimpleNamespace(
            id=12,
            status="completed",
            arquivo_nome="exame.xml",
            erro=None,
            resultado_json='{"paciente":{"nome":"Luna"}}',
            created_at=None,
            started_at=None,
            finished_at=None,
        )

        payload = serialize_xml_import_job(job)

        self.assertEqual(payload["job_id"], 12)
        self.assertEqual(payload["dados"]["paciente"]["nome"], "Luna")


if __name__ == "__main__":
    unittest.main()
