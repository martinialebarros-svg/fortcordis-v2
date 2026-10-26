"""Synthetic SQLite verification, without network or real records."""
import os
import sys
import unittest
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("SECRET_KEY", "gestao-synthetic-test-secret-key-1234567890")
from app.models.clinica import Clinica
from app.models.financeiro import ContaPagar, ContaReceber, CreditoFinanceiro, OrdemServicoPagamento, Transacao
from app.models.ordem_servico import OrdemServico
from app.services.gestao_financeira import _day, build_financial_metrics


class GestaoFinanceiraTest(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://")
        for model in (Clinica, OrdemServico, Transacao, OrdemServicoPagamento, CreditoFinanceiro, ContaPagar, ContaReceber):
            model.__table__.create(self.engine)
        self.db = sessionmaker(bind=self.engine)()
        self.db.add_all([Clinica(id=1, nome="Sintética A", regiao_operacional="Norte", ativo=True),
                         Clinica(id=2, nome="Sintética B", cidade="Caucaia", ativo=False)])
        self.db.commit()
        self.serial = 0

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def order(self, amount=100, day=1, month=10, status="Pendente", clinic=1, appointment=None):
        self.serial += 1
        o = OrdemServico(numero_os=f"SINT-{self.serial}", paciente_id=1, servico_id=1, clinica_id=clinic,
                         agendamento_id=appointment, valor_final=Decimal(str(amount)),
                         data_atendimento=datetime(2026, month, day, 10), status=status)
        self.db.add(o)
        self.db.flush()
        return o

    def payment(self, o, amount, day=11, month=10, status="Recebido", fee=0, tx=None):
        if tx is None:
            tx = Transacao(tipo="entrada", categoria="consulta", valor=amount, valor_final=amount-fee, valor_taxa=fee,
                           status=status, clinica_id=o.clinica_id, data_transacao=datetime(2026, month, day, 10),
                           data_pagamento=datetime(2026, month, day, 10))
            self.db.add(tx)
            self.db.flush()
        p = OrdemServicoPagamento(ordem_servico_id=o.id, transacao_id=tx.id, forma_pagamento_codigo="pix", forma_pagamento_nome="Pix",
                                  valor_bruto=amount, valor_taxa=fee, valor_liquido=amount-fee, data_recebimento=datetime(2026, month, day, 10))
        self.db.add(p)
        self.db.flush()
        return p, tx

    def credit(self, o, value, status="Ativo"):
        self.db.add(CreditoFinanceiro(tipo_destino="cliente", origem="consumo_credito_os", status=status,
                                     ordem_servico_id=o.id, valor=-value, data_movimento=datetime(2026, 10, 10)))

    def account(self, amount, day=20, month=10, status="Pendente", appointment=None, pay=False, clinic=1):
        cls = ContaPagar if pay else ContaReceber
        kw = {} if pay else {"agendamento_id": appointment}
        a = cls(descricao="Conta sintética", valor=amount, data_vencimento=datetime(2026, month, day), status=status, clinica_id=clinic, **kw)
        self.db.add(a)
        self.db.flush()
        return a

    def metrics(self, assumptions=None, **kwargs):
        self.db.commit()
        return build_financial_metrics(self.db, kwargs.pop("start", date(2026, 10, 1)), kwargs.pop("end", date(2026, 10, 31)),
                                       assumptions=assumptions or {}, today=date(2026, 10, 25), **kwargs)

    def test_unknown_inputs_stay_null(self):
        self.order()
        r = self.metrics()
        for field in ("tributos", "taxas", "repasses", "custos_variaveis", "horas_totais", "valor", "por_hora"):
            self.assertIsNone(r["contribuicao"][field])
        self.assertIsNone(r["caixa"]["saldo_final"])
        self.assertIsNone(r["recebimento"]["prazo_medio_dias"])
        self.assertEqual(r["recebimento"]["sem_vencimento"], 100)

    def test_competence_does_not_repeat_route_cost_or_cash(self):
        a, b = self.order(200), self.order(300)
        self.payment(a, 200, fee=4)
        self.payment(b, 100, fee=2)
        r = self.metrics({"tributos_percentual": 6, "repasses_percentual": 10, "taxas_percentual": 2, "custos_variaveis": 50,
                          "horas_atendimento": 2, "horas_laudos": 1, "horas_deslocamento": 2, "saldo_inicial": 100})
        c = r["contribuicao"]
        self.assertEqual((c["receita_competencia"], c["taxas"], c["taxas_observadas"], c["custos_variaveis"], c["valor"], c["por_hora"]), (500, 10, 6, 50, 360, 72))
        self.assertEqual(r["caixa"]["entradas_confirmadas"], 294)
        self.assertEqual(r["caixa"]["saldo_final"], 394)

    def test_actual_fees_and_zero_denominator(self):
        o = self.order(status="Pago")
        self.payment(o, 100, fee=3)
        c = self.metrics({"tributos_percentual": 0, "repasses_percentual": 0, "custos_variaveis": 0,
                          "horas_atendimento": 0, "horas_laudos": 0, "horas_deslocamento": 0})["contribuicao"]
        self.assertEqual((c["taxas"], c["valor"]), (3, 97))
        self.assertIsNone(c["por_hora"])

    def test_partial_receipts_weighted_delay(self):
        o = self.order(200)
        self.payment(o, 50, day=3)
        self.payment(o, 100, day=11)
        r = self.metrics()["recebimento"]
        self.assertEqual((r["prazo_medio_dias"], r["saldo_aberto"], r["valor_base_prazo"]), (7.33, 50, 150))

    def test_reversal_credit_and_legacy(self):
        o = self.order(status="Pago")
        self.payment(o, 100, day=20, status="Cancelado", fee=4)
        self.payment(o, 30, fee=1)
        self.credit(o, 70)
        self.credit(o, 100, "Cancelado")
        self.order(200, status="Pago")
        r = self.metrics()
        p = r["recebimento"]
        self.assertEqual((p["valor_recebido_bruto"], p["credito_utilizado"], p["prazo_medio_dias"], p["saldo_aberto"], p["os_pagas_sem_comprovante"]), (30, 70, 10, 0, 1))
        self.assertIsNone(p["detalhes"][1]["saldo_aberto"])
        self.assertEqual(r["caixa"]["entradas_confirmadas"], 29)

    def test_grouped_payment_and_duplicate(self):
        a, b = self.order(), self.order(200, clinic=2)
        tx = Transacao(tipo="entrada", categoria="consulta", valor=300, valor_final=297, status="Recebido", data_transacao=datetime(2026, 10, 11))
        self.db.add(tx)
        self.db.flush()
        self.payment(a, 100, tx=tx, fee=1)
        self.payment(b, 200, tx=tx, fee=2)
        self.payment(a, 100, tx=tx, fee=1)
        r = self.metrics()
        self.assertEqual(r["recebimento"]["valor_recebido_bruto"], 300)
        self.assertEqual(r["caixa"]["entradas_confirmadas"], 297)
        self.assertEqual(self.metrics(clinic_id=2)["caixa"]["entradas_confirmadas"], 198)

    def test_inconsistent_shared_transaction_is_not_recounted_as_standalone(self):
        a, b = self.order(), self.order()
        _, tx = self.payment(a, 100)
        self.payment(b, 100, tx=tx)
        r = self.metrics()
        self.assertEqual(r["recebimento"]["valor_recebido_bruto"], 0)
        self.assertEqual(r["caixa"]["entradas_confirmadas"], 0)
        self.assertTrue(r["recebimento"]["lacunas"])

    def test_inconsistent_liquid_allocation_does_not_overstate_cash(self):
        o = self.order()
        _, tx = self.payment(o, 100, fee=1)
        tx.valor_final = 90
        r = self.metrics()
        self.assertEqual(r["caixa"]["entradas_confirmadas"], 0)
        self.assertTrue(r["recebimento"]["lacunas"])

    def test_detail_limit_does_not_truncate_totals(self):
        for _ in range(251):
            self.order(10)
        r = self.metrics()
        self.assertEqual(r["contribuicao"]["receita_competencia"], 2510)
        self.assertEqual(len(r["contribuicao"]["detalhes"]), 250)
        self.assertTrue(r["contribuicao"]["detalhes_limitados"])
        self.assertEqual(r["recebimento"]["total_registros"], 251)

    def test_excess_cash_does_not_become_competence(self):
        self.payment(self.order(status="Pago"), 150, fee=3)
        r = self.metrics()
        self.assertEqual((r["contribuicao"]["receita_competencia"], r["contribuicao"]["taxas"], r["recebimento"]["valor_base_prazo"], r["caixa"]["entradas_confirmadas"]), (100, 2, 100, 147))

    def test_clinic_filters_and_missing_values_preserve_denominator(self):
        for amount, clinic in ((100, 1), (200, 2), (300, None), (400, 999)):
            self.order(amount, clinic=clinic)
        self.order(900, status="Cancelado")
        self.order(900, month=9)
        c = self.metrics()["concentracao"]
        self.assertEqual((c["receita_total"], c["top1_pct"], c["top3_pct"]), (1000, 40, 70))
        self.assertIsNone(c["top5_pct"])
        self.assertEqual(self.metrics(region=" cauCAIA ")["concentracao"]["receita_total"], 200)
        self.assertEqual(self.metrics(region="Não informada")["concentracao"]["receita_total"], 700)
        self.assertFalse(self.metrics(clinic_id=2)["concentracao"]["clinicas"][0]["ativa"])

    def test_cohort_and_cash_dates_separate(self):
        self.payment(self.order(month=9), 100)
        self.payment(self.order(200), 50, month=9, day=30)
        r = self.metrics()
        self.assertEqual((r["concentracao"]["receita_total"], r["recebimento"]["valor_recebido_bruto"], r["recebimento"]["prazo_medio_dias"], r["caixa"]["entradas_confirmadas"]), (200, 50, -1, 100))

    def test_single_due_account_uses_remaining_os_balance(self):
        o = self.order(200, appointment=10)
        self.payment(o, 50)
        self.account(200, day=15, appointment=10)
        r = self.metrics()
        self.assertEqual((r["recebimento"]["saldo_aberto"], r["recebimento"]["vencido"], r["caixa"]["entradas_previstas"], r["caixa"]["entradas_confirmadas"]), (150, 150, 150, 50))

    def test_partial_payment_with_unlinked_installments_has_uncertain_due_allocation(self):
        o = self.order(200, appointment=10)
        self.payment(o, 50)
        self.account(100, day=15, appointment=10)
        self.account(100, day=30, appointment=10)
        r = self.metrics()
        self.assertEqual(r["recebimento"]["saldo_aberto"], 150)
        self.assertEqual(r["recebimento"]["vencido"], 0)
        self.assertEqual(r["recebimento"]["sem_vencimento"], 150)
        self.assertEqual(r["caixa"]["entradas_previstas"], 0)
        self.assertTrue(any("parcela" in v.lower() for v in r["recebimento"]["lacunas"]))

    def test_generated_accounts_precedence_and_filter(self):
        a = self.account(80, status="Pago", pay=True, clinic=2)
        a.data_pagamento = datetime(2026, 10, 10)
        for _ in range(2):
            self.db.add(Transacao(tipo="saida", categoria="outros", valor=80, valor_final=80, status="Pago", data_transacao=datetime(2026, 10, 10), observacoes=f"Gerado do pagamento da conta #{a.id}"))
        self.account(40, day=30, month=9, pay=True, clinic=2)
        self.account(60, clinic=2)
        c = self.metrics({"saldo_inicial": 200}, region="Caucaia")["caixa"]
        self.assertEqual((c["saidas_confirmadas"], c["saidas_previstas"], c["entradas_previstas"], c["saldo_final"]), (80, 40, 60, 140))
        self.assertTrue(any(v["vencido"] and v["data"] == "2026-10-01" for v in c["detalhes"]))

    def test_cancelled_account_transaction_prevents_false_cash(self):
        a = self.account(80, pay=True, status="Pago")
        a.data_pagamento = datetime(2026, 10, 10)
        self.db.add(Transacao(tipo="saida", categoria="outros", valor=80, valor_final=80, status="Cancelado", data_transacao=datetime(2026, 10, 10), observacoes=f"Gerado do pagamento da conta #{a.id}"))
        c = self.metrics()["caixa"]
        self.assertEqual(c["saidas_confirmadas"], 0)
        self.assertTrue(any("estorn" in v.lower() or "cancelad" in v.lower() for v in c["lacunas"]))

    def test_os_account_transaction_not_three_receipts(self):
        o = self.order(appointment=10, status="Pago")
        self.payment(o, 100)
        a = self.account(100, status="Recebido", appointment=10)
        a.data_recebimento = datetime(2026, 10, 11)
        self.db.add(Transacao(tipo="entrada", categoria="outros", valor=100, valor_final=100, status="Recebido", data_transacao=datetime(2026, 10, 11), observacoes=f"Gerado do recebimento da conta #{a.id}"))
        c = self.metrics()["caixa"]
        self.assertEqual((c["entradas_confirmadas"], c["entradas_previstas"]), (100, 0))

    def test_orphan_os_transaction_does_not_also_schedule_full_os_balance(self):
        self.order(appointment=10)
        self.account(100, appointment=10)
        self.db.add(Transacao(tipo="entrada", categoria="consulta", valor=100, valor_final=100, status="Recebido", agendamento_id=10, data_transacao=datetime(2026, 10, 11)))
        r = self.metrics()
        self.assertEqual(r["caixa"]["entradas_previstas"], 0)
        self.assertTrue(r["caixa"]["lacunas"])

    def test_monthly_assumptions_keep_month_end_and_remain_estimates(self):
        c = self.metrics({"movimentos": [{"data": "2026-01-31", "tipo": "saida", "valor": 100, "recorrencia": "mensal"}]}, start=date(2026, 2, 1), end=date(2026, 3, 31), region="Norte")["caixa"]
        self.assertEqual([r["data"] for r in c["detalhes"]], ["2026-02-28", "2026-03-31"])
        self.assertEqual(c["saidas_premissas"], 200)
        self.assertIsNone(c["saldo_final"])
        self.assertEqual(sum(r["saidas_premissas"] for r in c["semanas"]), 200)

    def test_empty_denominators_negative_balance_and_local_dates(self):
        r = self.metrics({"saldo_inicial": -10, "despesas_completas": True})
        self.assertIsNone(r["concentracao"]["top1_pct"])
        self.assertIsNone(r["recebimento"]["prazo_medio_dias"])
        self.assertEqual(r["caixa"]["saldo_final"], -10)
        self.assertFalse(r["caixa"]["parcial"])
        self.assertEqual(_day(datetime(2026, 10, 1, 2, 59, tzinfo=timezone.utc)), date(2026, 9, 30))
        with self.assertRaises(ValueError):
            self.metrics(start=date(2026, 10, 2), end=date(2026, 10, 1))

    def test_unknown_or_negative_os_amounts_are_flagged(self):
        a = self.order(100)
        a.valor_final = None
        self.order(-10)
        r = self.metrics()
        self.assertIsNone(r["contribuicao"]["valor"])
        self.assertTrue(any("valor" in v.lower() for v in r["contribuicao"]["lacunas"]))
        self.assertTrue(r["concentracao"]["lacunas"])

    def test_batched_reads_only_no_clinical_information(self):
        for _ in range(30):
            self.order(10)
        self.db.commit()
        sql = []
        def observe(conn, cursor, statement, parameters, context, executemany):
            sql.append(statement)
        event.listen(self.engine, "before_cursor_execute", observe)
        r = self.metrics()
        event.remove(self.engine, "before_cursor_execute", observe)
        self.assertEqual(len(sql), 7)
        self.assertTrue(all(q.lstrip().upper().startswith("SELECT") for q in sql))
        self.assertNotIn("paciente", str(r))
        self.assertNotIn("tutor", str(r))
        self.assertFalse(self.db.dirty or self.db.new or self.db.deleted)


if __name__ == "__main__":
    unittest.main()
