import os
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException

BACKEND_DIR = Path(__file__).resolve().parents[1]
os.chdir(BACKEND_DIR)
sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "sqlite:///./fortcordis.db")
os.environ.setdefault("SECRET_KEY", "whatsapp-template-test-secret-key-1234567890")

from app.api.v1.endpoints.ordens_servico import _numeros_whatsapp_os
from app.core.config import settings
from app.services.whatsapp_template_delivery_service import (
    WhatsAppTemplateDeliveryError,
    send_approved_utility_template,
)


class WhatsAppTemplateDeliveryTest(unittest.TestCase):
    def test_generic_delivery_uses_authenticated_internal_contract(self):
        response = SimpleNamespace(
            status_code=201,
            json=lambda: {"message_id": "wamid.receipt.contract", "idempotent": False},
        )
        with (
            patch.object(settings, "WHATSAPP_AGENDA_ENABLED", True),
            patch.object(settings, "WHATSAPP_AGENDA_SERVICE_URL", "http://127.0.0.1:3010"),
            patch.object(settings, "WHATSAPP_AGENDA_INTERNAL_TOKEN", "internal-secret"),
            patch("app.services.whatsapp_template_delivery_service.httpx.post", return_value=response) as post,
        ):
            result = send_approved_utility_template(
                template_key="receiptAvailable",
                subject_type="ordem_servico",
                subject_id=51,
                destination="5585988881111",
                parameters=["Animal Care", "OS-51", "Gamora", "R$ 350,00"],
                idempotency_key="receipt-idempotency-51",
            )

        self.assertEqual(result["message_id"], "wamid.receipt.contract")
        kwargs = post.call_args.kwargs
        self.assertEqual(kwargs["headers"]["X-WhatsApp-Internal-Token"], "internal-secret")
        self.assertEqual(kwargs["json"]["template_key"], "receiptAvailable")
        self.assertEqual(kwargs["json"]["subject_type"], "ordem_servico")
        self.assertEqual(kwargs["json"]["parameters"][3], "R$ 350,00")

    def test_generic_delivery_fails_closed_without_message_id(self):
        response = SimpleNamespace(status_code=201, json=lambda: {"idempotent": False})
        with (
            patch.object(settings, "WHATSAPP_AGENDA_ENABLED", True),
            patch.object(settings, "WHATSAPP_AGENDA_SERVICE_URL", "http://127.0.0.1:3010"),
            patch.object(settings, "WHATSAPP_AGENDA_INTERNAL_TOKEN", "internal-secret"),
            patch("app.services.whatsapp_template_delivery_service.httpx.post", return_value=response),
        ):
            with self.assertRaises(WhatsAppTemplateDeliveryError):
                send_approved_utility_template(
                    template_key="pendingPaymentReminder",
                    subject_type="ordem_servico",
                    subject_id=52,
                    destination="5585988881111",
                    parameters=["Animal Care", "OS-52", "Gamora", "R$ 350,00"],
                    idempotency_key="payment-idempotency-52",
                )

    def test_finance_recipient_is_bound_to_registered_contact(self):
        clinic = SimpleNamespace(
            nome="Animal Care",
            whatsapps=["(85) 98888-1111", "5585877772222"],
            telefone="(85) 98888-1111",
        )
        partner_os = SimpleNamespace(origem_atendimento="clinica_parceira")
        name, numbers = _numeros_whatsapp_os(partner_os, clinica=clinic, tutor=None)
        self.assertEqual(name, "Animal Care")
        self.assertEqual(numbers, ["5585988881111", "5585877772222"])

        tutor = SimpleNamespace(nome="Maria", whatsapp="(85) 99999-3333", telefone=None)
        home_os = SimpleNamespace(origem_atendimento="domiciliar")
        name, numbers = _numeros_whatsapp_os(home_os, clinica=None, tutor=tutor)
        self.assertEqual(name, "Maria")
        self.assertEqual(numbers, ["5585999993333"])

        with self.assertRaises(HTTPException) as missing:
            _numeros_whatsapp_os(home_os, clinica=None, tutor=None)
        self.assertEqual(missing.exception.status_code, 409)


if __name__ == "__main__":
    unittest.main()
