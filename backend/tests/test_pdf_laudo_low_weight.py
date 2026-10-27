"""Independent low-weight resolver-to-PDF contract, with synthetic patients only."""
import os
import re
import sys
import unittest
from copy import deepcopy
from datetime import date
from io import BytesIO
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "synthetic-low-weight-pdf-test-secret-1234567890")

from pypdf import PdfReader
from app.services.echo_reference_resolver import load_echo_reference, resolve_echo_reference
from app.utils.pdf_laudo import (
    aplicar_referencia_eco, criar_secao_referencias_eco, formatar_referencia, gerar_pdf_laudo_eco,
)

KEYS = {"DIVEd": "lvid_d", "DIVES": "lvid_s", "SIVd": "ivs_d", "SIVs": "ivs_s",
        "PLVEd": "lvpw_d", "PLVES": "lvpw_s"}
MEASUREMENTS = {"VE_tecnica_relatorio": "modo_m", "DIVEd": "20", "DIVES": "12",
                "SIVd": "5", "SIVs": "8", "PLVEd": "5", "PLVES": "8"}


def report(species="Canina", weight=2.5, age="2 anos", reference=None):
    return {"paciente": {"nome": "QA SINTETICO BAIXO PESO", "tutor": "QA TUTOR",
                         "especie": species, "peso": str(weight), "idade": age,
                         "data_exame": "2026-10-27", "raca": "SRD", "sexo": "Macho"},
            "medidas": dict(MEASUREMENTS), "referencia_eco": reference,
            "conclusao": "TESTE SINTETICO. Sem finalidade clinica.",
            "qualitativa": {"funcao": "Texto oficial sintetico preservado."},
            "clinica": "Clinica sintetica"}


def reference(species="Canina", weight=2.5, age="2 anos"):
    return resolve_echo_reference({"especie": species, "peso_kg": weight}, peso_kg=weight,
                                  medidas=MEASUREMENTS, idade=age)


def pdf(payload):
    before = deepcopy(payload)
    data = gerar_pdf_laudo_eco(payload)
    assert payload == before
    reader = PdfReader(BytesIO(data))
    text = re.sub(r"\s+", " ", "\n".join(page.extract_text() or "" for page in reader.pages))
    return reader, text


class PdfLaudoLowWeightTest(unittest.TestCase):
    def test_real_pdf_loader_keeps_the_same_precise_weight_for_reference_and_renderer(self):
        from app.models.laudo import Laudo
        from app.models.paciente import Paciente
        from app.models.configuracao import Configuracao, ConfiguracaoUsuario
        from app.services.laudo_pdf_service import render_laudo_pdf
        from app.api.v1.endpoints.laudos import gerar_pdf_laudo

        cases = [(entrypoint, species, weight) for entrypoint in ("service", "endpoint")
                 for species, weight in (("Felina", 2.25), ("Canina", 2.65))]
        for entrypoint, species, weight in cases:
            with self.subTest(entrypoint=entrypoint, species=species, weight=weight):
                patient = SimpleNamespace(id=8, nome="QA PESO PRECISO", especie=species,
                                          peso_kg=weight, tutor_id=None, nascimento=None,
                                          observacoes="", raca="SRD", sexo="Macho")
                description = "## Medidas Ecocardiograficas\n" + "\n".join(
                    f"- {key}: {value}" for key, value in MEASUREMENTS.items()) + "\n\n## Avaliacao Qualitativa\n"
                laudo = SimpleNamespace(id=91, paciente_id=8, clinic_id=None,
                                        medico_solicitante="Clinica sintetica", data_exame=date(2026, 10, 27),
                                        data_laudo=None, descricao=description, diagnostico="Teste sintetico.",
                                        observacoes="", anexos=None, tipo="ecocardiograma")
                rows = {Laudo: laudo, Paciente: patient, Configuracao: None, ConfiguracaoUsuario: None}
                database = MagicMock()
                def query_for(model):
                    query = MagicMock()
                    query.filter.return_value = query
                    query.first.return_value = rows.get(model)
                    query.all.return_value = []
                    return query
                database.query.side_effect = query_for
                with patch("app.services.laudo_pdf_service.compute_laudo_pdf_cache_key", return_value="synthetic-cache-key"), \
                     patch("app.api.v1.endpoints.laudos.compute_laudo_pdf_cache_key", return_value="synthetic-cache-key"), \
                     patch("app.api.v1.endpoints.laudos.get_cached_laudo_pdf_job", return_value=None), \
                     patch("app.services.laudo_pdf_service._listar_imagens_incluidas_no_pdf", return_value=[]), \
                     patch("app.services.laudo_pdf_service.extrair_idade_paciente", return_value="2 anos"), \
                     patch("app.api.v1.endpoints.laudos._extrair_ecocardiograma_cabecalho_de_anexos", return_value={}), \
                     patch("app.api.v1.endpoints.laudos._extrair_pressao_arterial_de_anexos", return_value=None), \
                     patch("app.services.echo_reference_resolver.load_echo_reference", wraps=load_echo_reference) as loader, \
                     patch("app.utils.pdf_laudo.gerar_pdf_laudo_eco", return_value=b"synthetic-renderer-capture") as renderer:
                    user = SimpleNamespace(id=1, nome="QA VETERINARIO")
                    if entrypoint == "endpoint":
                        response = gerar_pdf_laudo(91, db=database, current_user=user)
                        self.assertEqual(response.media_type, "application/pdf")
                    else:
                        generated = render_laudo_pdf(database, 91, user)
                        self.assertEqual(generated.content, b"synthetic-renderer-capture")
                payload = renderer.call_args.args[0]
                self.assertEqual(loader.call_args.kwargs["weight_kg"], weight)
                self.assertEqual(float(payload["paciente"]["peso"]), weight)
                selected = payload["referencia_eco"]
                self.assertEqual(selected["patient_weight_kg"], weight)
                rendered = resolve_echo_reference(selected, peso_kg=float(payload["paciente"]["peso"]),
                                                   medidas=payload["medidas"], idade=payload["paciente"]["idade"])
                expected = reference(species, weight)
                for prefix in KEYS.values():
                    self.assertEqual(rendered[f"{prefix}_min"], expected[f"{prefix}_min"])
                    self.assertEqual(rendered[f"{prefix}_max"], expected[f"{prefix}_max"])
                database.add.assert_not_called()
                database.commit.assert_not_called()

    def test_no_catalog_loader_supplies_six_source_bound_dimensions_without_database_writes(self):
        database = MagicMock()
        query = database.query.return_value
        query.filter.return_value = query
        query.all.return_value = []
        for species, doi in (("Canina", "10.3389/fvets.2022.918457"), ("Gato", "10.1111/jvim.14569")):
            with self.subTest(species=species):
                resolved = load_echo_reference(database, species=species, weight_kg=2,
                                               medidas=MEASUREMENTS, idade="2 anos")
                self.assertIsNotNone(resolved)
                self.assertEqual(resolved["reference_origin"], "computed")
                for prefix in KEYS.values():
                    self.assertEqual(resolved["range_metadata"][prefix]["doi"], doi)
                    self.assertGreater(resolved[f"{prefix}_min"], 0)
                    self.assertGreater(resolved[f"{prefix}_max"], resolved[f"{prefix}_min"])
                for prefix in ("ao", "la", "la_ao", "tapse", "mapse", "fs", "ef", "vmax_ao", "vmax_pulm"):
                    self.assertIsNone(resolved[f"{prefix}_min"])
                    self.assertIsNone(resolved[f"{prefix}_max"])
                database.add.assert_not_called()
                database.commit.assert_not_called()

    def test_estimates_have_text_but_never_numerical_comparison_bounds(self):
        parameters = [{"chave": key, "unidade": "mm"} for key in KEYS]
        for species, weight, age, context in (("Canina", 1, "2 anos", "weight_extrapolation"),
                                             ("Felina", 1, "2 anos", "weight_extrapolation"),
                                             ("Canina", 2.5, None, "age_unconfirmed")):
            with self.subTest(species=species, weight=weight, age=age):
                resolved = reference(species, weight, age)
                for key, parameter in zip(KEYS, aplicar_referencia_eco(parameters, resolved)):
                    meta = resolved["range_metadata"][KEYS[key]]
                    self.assertEqual(meta["status"], "estimated")
                    self.assertEqual(meta["estimate_context"], context)
                    self.assertIsNone(parameter["ref_min"])
                    self.assertIsNone(parameter["ref_max"])
                    self.assertTrue(parameter["ref_text"].startswith("Est." if weight < 1.5 else "Adultos"))

    def test_juvenile_has_neither_comparison_bounds_nor_adult_estimates(self):
        for species in ("Canina", "Felina"):
            resolved = reference(species, 2, "7m")
            for prefix in KEYS.values():
                meta = resolved["range_metadata"][prefix]
                self.assertEqual(meta["status"], "unavailable")
                self.assertIsNone(resolved[f"{prefix}_min"])
                self.assertIsNone(resolved[f"{prefix}_max"])
                self.assertNotIn("estimate_min", meta)
                self.assertNotIn("estimate_max", meta)

    def test_canine_bibliography_attributes_the_computed_m_ranges_to_isayama(self):
        payload = report(reference=reference())
        text = " ".join(item.getPlainText() for item in criar_secao_referencias_eco(payload)
                        if hasattr(item, "getPlainText"))
        self.assertIn("Isayama et al. (2022)", text)
        self.assertIn("10.3389/fvets.2022.918457", text)
        self.assertIn("Tabela 2", text)
        self.assertIn("limites alométricos aproximados", text.lower())
        # Cornell may still document its separately labelled normalized index;
        # it must not be presented as the source of these six calculated limits.
        self.assertNotRegex(text, r"Tabela 2 de Cornell|limites alométricos aproximados[^.]*Cornell")

    def test_actual_renderer_without_catalog_prints_the_correct_six_intervals_and_sources(self):
        for species, weight, source in (("Canina", 2.5, "Isayama"), ("Felina", 2.25, "Häggström")):
            with self.subTest(species=species):
                payload = report(species, weight)
                reader, text = pdf(payload)
                expected = reference(species, weight)
                self.assertGreaterEqual(len(reader.pages), 1)
                for prefix in KEYS.values():
                    self.assertIn(formatar_referencia(expected[f"{prefix}_min"], expected[f"{prefix}_max"], "mm"), text)
                self.assertIn(source, text)
                self.assertIn("Texto oficial sintetico preservado.", text)
                if species == "Canina":
                    self.assertIn("10.3389/fvets.2022.918457", text)
                else:
                    self.assertIn("interpolação", text)
                    self.assertNotIn("Isayama", text)

    def test_actual_estimated_pdf_labels_extrapolation_and_never_recasts_it_as_an_interval(self):
        for species in ("Canina", "Felina"):
            _, text = pdf(report(species, 1))
            resolved = reference(species, 1)
            self.assertIn("Est.:", text)
            self.assertIn("estimativa por extrapolação abaixo de 1,5 kg", text)
            self.assertIn("não constitui intervalo individual validado", text)
            self.assertIn("não permite classificação automática", text)
            for prefix in KEYS.values():
                meta = resolved["range_metadata"][prefix]
                self.assertNotIn(formatar_referencia(meta["estimate_min"], meta["estimate_max"], "mm"), text)

    def test_actual_unknown_age_pdf_is_neutral_and_known_juvenile_retracts_an_adult_carrier(self):
        _, unknown = pdf(report(age=None))
        self.assertIn("Adultos:", unknown)
        self.assertIn("confirmar idade/maturidade", unknown)
        carrier = reference(weight=2, age="2 anos")
        _, juvenile = pdf(report(weight=2, age="7m", reference=carrier))
        self.assertIn("adultos não aplicada a paciente em crescimento", juvenile)
        self.assertNotIn("Dimensões em modo M: limites alométricos aproximados calculados", juvenile)
        self.assertNotIn("Isayama", juvenile)
        self.assertNotIn("Est.:", juvenile)
        self.assertNotIn("Adultos:", juvenile)
        for prefix in KEYS.values():
            self.assertNotIn(formatar_referencia(carrier[f"{prefix}_min"], carrier[f"{prefix}_max"], "mm"), juvenile)

    def test_known_centimeter_provenance_matches_mm_pdf_and_ambiguous_lengths_have_no_range(self):
        mm = report()
        cm = deepcopy(mm)
        for key in KEYS:
            cm["medidas"][key] = str(float(cm["medidas"][key]) / 10)
            cm["medidas"][f"unidade_confirmada_{key}"] = "cm"
        self.assertEqual(pdf(mm)[1], pdf(cm)[1])
        ambiguous = report()
        for key in KEYS:
            ambiguous["medidas"][key] = str(float(ambiguous["medidas"][key]) / 10)
        _, text = pdf(ambiguous)
        self.assertIn("unidade a confirmar", text.lower())
        resolved = reference()
        for prefix in ("lvid_d", "ivs_d", "lvpw_d"):
            self.assertNotIn(formatar_referencia(resolved[f"{prefix}_min"], resolved[f"{prefix}_max"], "mm"), text)

    def test_weight_change_recomputes_a_stale_carrier_and_preserves_its_raw_history(self):
        carrier = reference(weight=2)
        before = deepcopy(carrier)
        payload = report(weight=2.5, reference=carrier)
        _, text = pdf(payload)
        current = reference(weight=2.5)
        self.assertIn(formatar_referencia(current["lvid_d_min"], current["lvid_d_max"], "mm"), text)
        self.assertNotIn(formatar_referencia(carrier["lvid_d_min"], carrier["lvid_d_max"], "mm"), text)
        self.assertEqual(carrier, before)
        self.assertEqual(resolve_echo_reference(current), current)

    def test_custom_ranges_survive_without_becoming_isayama_or_rewritten_catalog(self):
        custom = {"especie": "Canina", "peso_kg": 2.5,
                  **{f"{prefix}_{end}": value for prefix in KEYS.values() for end, value in (("min", 1), ("max", 99))}}
        original = deepcopy(custom)
        _, text = pdf(report(reference=custom))
        self.assertIn("1.00 - 99.00 mm", text)
        self.assertNotIn("Isayama", text)
        self.assertEqual(custom, original)

    def test_2d_does_not_receive_the_m_fallback_or_extend_visser_below_its_domain(self):
        for weight in (2.7, 2.5):
            payload = report(weight=weight)
            payload["medidas"] = {"VE_tecnica_relatorio": "2d", "VE_vista_2D": "eixo_curto", "DIVEd_2D": "22"}
            _, text = pdf(payload)
            self.assertNotIn("Isayama", text)
            if weight >= 2.6:
                self.assertIn("Visser et al. (2019)", text)
            else:
                self.assertNotIn("Visser et al. (2019)", text)

    def test_unknown_species_cannot_receive_feline_or_toy_dog_limits(self):
        _, text = pdf(report("Equina", 2))
        self.assertNotIn("Isayama", text)
        self.assertNotIn("Häggström", text)
        self.assertNotIn("Est.:", text)


if __name__ == "__main__":
    unittest.main()
