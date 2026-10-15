import os
import unittest
import json
from copy import deepcopy
from io import BytesIO
from pathlib import Path
import re
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "echo-feline-diastolic-test-secret-1234567890")

from pypdf import PdfReader
from PIL import Image

from app.utils.echo_feline_diastolic import feline_diastolic_references
from app.utils.echo_reference_methods import ECHO_REFERENCE_METHOD_VALUES
from app.utils.ecocardiograma_medidas import extrair_medidas_ecocardiograma_da_descricao
from app.utils.pdf_laudo import gerar_pdf_laudo_eco
from app.schemas.ai_echo import EchoStructureRequest
from app.services.ai_echo_context import safe_measurement_context


PARITY_FIXTURE = json.loads(
    (Path(__file__).parent / "fixtures" / "echo_feline_diastolic_parity.json").read_text(encoding="utf-8")
)


def clinical_reference_contract(reference):
    """Compare clinical evidence while allowing UI/PDF-specific guard wording.

    The PDF cites the fusion consensus; the UI guard is a concise warning.
    DOI and numerical text are contractual for descriptive evidence only.
    """
    descriptive = reference["kind"] == "descriptive"
    return {
        "kind": reference["kind"],
        "statistic": reference["statistic"],
        "doi": reference["doi"] if descriptive else "",
        "numeric_text": reference["text"].removeprefix("Média ± DP: ") if descriptive else "",
    }


def synthetic_measurements():
    return {
        "Onda_E": "1.08", "Onda_A": "0.95", "E_A": "1.14", "TD": "51", "TRIV": "40",
        "e_doppler": "0.16", "a_doppler": "0.06", "doppler_tecidual_relacao": "2.67",
        "E_E_linha": "6.75", "E_TRIV": "2.70",
        "Diastolica_metodo": "felino_adulto_nao_sedado_pw_apical_clique_aortico",
        "Diastolica_ondas": "separadas",
        "TDI_metodo": "felino_pw_anel_lateral", "TDI_ondas": "separadas",
    }


def synthetic_report(measurements):
    return {"paciente": {"nome": "TESTE FELINO", "especie": "Felina", "peso": "5.6",
                         "idade": "4 anos", "data_exame": "2026-10-14"},
            "medidas": measurements, "conclusao": "TESTE TECNICO - dados sinteticos, sem finalidade clinica.",
            "qualitativa": {"funcao": "Texto sintetico preservado."}, "clinica": "Clinica teste"}


class FelineDiastolicEvidenceTest(unittest.TestCase):
    def test_legacy_timing_confirmation_does_not_imply_apical_transmitral_view(self):
        for method in ("felino_adulto_nao_sedado_pw_clique_aortico", "felino_adulto_nao_sedado_pw_fim_fluxo"):
            with self.subTest(method=method):
                measurements = {**synthetic_measurements(), "Diastolica_metodo": method}
                before = deepcopy(measurements)
                references = feline_diastolic_references(measurements, "Gato")
                for key in ("Onda_E", "Onda_A", "E_A", "TD", "E_E_linha"):
                    self.assertEqual(references[key]["kind"], "unconfirmed")
                    self.assertEqual(references[key]["doi"], "")
                    self.assertIn("vista apical", references[key]["note"])
                self.assertEqual(references["TRIV"]["kind"], "descriptive")
                self.assertEqual(references["e_doppler"]["kind"], "descriptive")
                self.assertEqual(measurements, before)
                description = "## Medidas Ecocardiograficas\n" + "\n".join(f"- {key}: {value}" for key,value in measurements.items())
                self.assertEqual(extrair_medidas_ecocardiograma_da_descricao(description)["Diastolica_metodo"], method)

    def test_ui_pdf_clinical_contract_matches_shared_primary_evidence_cases(self):
        for case in PARITY_FIXTURE["cases"]:
            with self.subTest(case=case["id"]):
                measurements = {**PARITY_FIXTURE["measurements"], **case["protocol"]}
                before = deepcopy(measurements)
                references = feline_diastolic_references(measurements, case["species"])
                actual = {key: clinical_reference_contract(ref) for key, ref in references.items()}
                expected = {
                    key: PARITY_FIXTURE["evidence"][evidence_id]
                    for key, evidence_id in case["expected"].items()
                }
                self.assertEqual(actual, expected)
                self.assertEqual(measurements, before)
                for key, ref in references.items():
                    with self.subTest(parameter=key):
                        self.assertNotIn("min", ref)
                        self.assertNotIn("max", ref)
                        if ref["kind"] == "descriptive":
                            self.assertIn("±", ref["text"])
                            self.assertTrue(ref["doi"])
                        else:
                            self.assertNotIn("±", ref["text"])
                            self.assertNotEqual(ref["statistic"], "mean_sd")

    def test_confirmed_data_are_descriptive_means_not_intervals(self):
        refs = feline_diastolic_references(synthetic_measurements(), "Felina")
        self.assertEqual(refs["Onda_E"]["text"], "Média ± DP: 0,70 ± 0,14 m/s")
        self.assertEqual(refs["TD"]["doi"], "10.1590/S0103-84782005000600020")
        self.assertEqual(refs["TRIV"]["text"], "Média ± DP: 46,2 ± 7,6 ms")
        self.assertEqual(refs["e_doppler"]["text"], "Média ± DP: 0,11 ± 0,03 m/s")
        for key, ref in refs.items():
            with self.subTest(key=key):
                self.assertNotIn("min", ref)
                self.assertNotIn("max", ref)
                self.assertNotIn("normal", ref)
        self.assertEqual(refs["E_TRIV"]["kind"], "unconfirmed")

    def test_triv_source_follows_the_defined_timing_landmark(self):
        measurements = synthetic_measurements()
        measurements["Diastolica_metodo"] = "felino_adulto_nao_sedado_pw_apical_fim_fluxo"
        ref = feline_diastolic_references(measurements, "Felina")["TRIV"]
        self.assertEqual(ref["doi"], "10.1590/S0103-84782005000600020")
        self.assertEqual(ref["text"], "Média ± DP: 68,75 ± 19,14 ms")

    def test_septal_and_lateral_tdi_data_are_not_interchanged(self):
        measurements = synthetic_measurements()
        measurements["TDI_metodo"] = "felino_pw_anel_septal"
        refs = feline_diastolic_references(measurements, "Felina")
        self.assertEqual(refs["e_doppler"]["text"], "Média ± DP: 0,075 ± 0,026 m/s")
        self.assertEqual(refs["a_doppler"]["text"], "Média ± DP: 0,061 ± 0,017 m/s")
        self.assertEqual(refs["E_E_linha"]["text"], "Média ± DP: 8,7 ± 1,7")

    def test_current_fused_transmitral_separate_tdi_case_preserves_inputs(self):
        measurements = synthetic_measurements()
        measurements["Diastolica_ondas"] = "fundidas"
        before = deepcopy(measurements)
        refs = feline_diastolic_references(measurements, "Felina")
        self.assertEqual(measurements, before)
        for key in ("Onda_E", "Onda_A", "E_A", "TD", "E_E_linha", "E_TRIV"):
            self.assertEqual(refs[key]["kind"], "uninterpretable")
        for key in ("e_doppler", "a_doppler", "doppler_tecidual_relacao", "TRIV"):
            self.assertEqual(refs[key]["kind"], "descriptive")

    def test_feline_species_aliases_retain_fusion_and_independent_tdi_evidence(self):
        measurements = synthetic_measurements()
        measurements["Diastolica_ondas"] = "fundidas"
        expected = feline_diastolic_references(measurements, "Felina")
        for species in ("Gato", "Cat"):
            with self.subTest(species=species):
                references = feline_diastolic_references(measurements, species)
                self.assertEqual(references, expected)
                self.assertEqual(references["E_A"]["kind"], "uninterpretable")
                self.assertEqual(references["e_doppler"]["doi"], "10.1186/s12917-020-02557-3")

    def test_fused_tdi_does_not_invalidate_separate_transmitral_waves(self):
        measurements = synthetic_measurements()
        measurements["TDI_ondas"] = "fundidas"
        refs = feline_diastolic_references(measurements, "Felina")
        self.assertEqual(refs["E_A"]["kind"], "descriptive")
        self.assertEqual(refs["e_doppler"]["kind"], "uninterpretable")
        self.assertEqual(refs["E_E_linha"]["kind"], "uninterpretable")

    def test_no_inference_from_numbers_and_no_canine_changes(self):
        measurements = {key: val for key, val in synthetic_measurements().items()
                        if key not in ECHO_REFERENCE_METHOD_VALUES}
        self.assertTrue(all(ref["kind"] == "unconfirmed" for ref in feline_diastolic_references(measurements, "Felina").values()))
        self.assertEqual(feline_diastolic_references(synthetic_measurements(), "Canina"), {})
        for value in (True, "nan", "inf", "-1", "0", ""):
            self.assertEqual(feline_diastolic_references({"e_doppler": value}, "Felina"), {})

    def test_metadata_survives_description_and_request_validation(self):
        measurements = synthetic_measurements()
        description = "## Medidas Ecocardiográficas\n" + "\n".join(f"- {k}: {v}" for k, v in measurements.items())
        restored = extrair_medidas_ecocardiograma_da_descricao(description)
        for key in ("Diastolica_metodo", "Diastolica_ondas", "TDI_metodo", "TDI_ondas"):
            self.assertEqual(restored[key], measurements[key])
        request = EchoStructureRequest.model_validate({"edited_transcript": "Exame sintetico.", "current_measurements": measurements})
        self.assertEqual(request.current_measurements["Diastolica_ondas"], "separadas")

    def test_fused_peaks_do_not_enter_ai_as_individual_measurements(self):
        measurements = synthetic_measurements()
        measurements["Diastolica_ondas"] = "fundidas"
        safe = safe_measurement_context(measurements, species="Felina")
        self.assertNotIn("E_A", safe)
        self.assertNotIn("E_E_linha", safe)
        self.assertNotIn("E_TRIV", safe)
        self.assertIn("e_doppler", safe)
        self.assertIn("TRIV", safe)


class FelineDiastolicPdfTest(unittest.TestCase):
    def test_legacy_pdf_preserves_values_and_requires_apical_reconfirmation(self):
        measurements = {**synthetic_measurements(), "Diastolica_metodo": "felino_adulto_nao_sedado_pw_clique_aortico"}
        before = deepcopy(measurements)
        text = re.sub(r"\s+", " ", "\n".join(page.extract_text() for page in PdfReader(BytesIO(gerar_pdf_laudo_eco(synthetic_report(measurements)))).pages))
        self.assertNotIn("0,70 ± 0,14", text)
        self.assertNotIn("1,12 ± 0,22", text)
        self.assertNotIn("7,8 ± 2,92", text)
        self.assertIn("46,2 ± 7,6", text)
        self.assertIn("0,11 ± 0,03", text)
        self.assertIn("apical esquerda de 4 câmaras", text)
        self.assertIn("Referência de TRIV:", text)
        self.assertIn("apical esquerda de 5 câmaras", text)
        self.assertIn("1.08 m/s", text)
        self.assertIn("6.75", text)
        self.assertEqual(measurements, before)

    def test_branded_header_keeps_quantitative_rows_on_first_page_and_repeats_headers(self):
        logo = BytesIO()
        Image.new("RGB", (320, 320), "#e5f5f5").save(logo, format="PNG")
        signature = BytesIO()
        Image.new("RGB", (300, 100), "#e5eef5").save(signature, format="PNG")
        for waves in ("separadas", "fundidas"):
            with self.subTest(waves=waves):
                measurements = synthetic_measurements()
                measurements["Diastolica_ondas"] = waves
                payload = synthetic_report(measurements)
                payload["paciente"].update({"nome": "TESTE DIASTOLICA FELINA STAGE", "tutor": "TESTE TECNICO",
                                             "sexo": "Macho", "raca": "SRD", "estado": "Agitado"})
                # Force a row-wise continuation with the same branded header
                # that exposed the empty first-page quantitative section.
                payload["conclusao"] = ("TESTE TECNICO EM STAGE - dados sinteticos, sem finalidade clinica. "
                                        "Documento para verificar referencias diastolicas e opcoes de fusao. ") * 3
                before = deepcopy(payload)
                pages = [re.sub(r"\s+", " ", page.extract_text()) for page in PdfReader(BytesIO(
                    gerar_pdf_laudo_eco(payload, logomarca_bytes=logo.getvalue(), assinatura_bytes=signature.getvalue())
                )).pages]
                self.assertEqual(payload, before)
                self.assertIn("ANÁLISE QUANTITATIVA", pages[0])
                self.assertIn("Onda E", pages[0])
                self.assertIn("1.08 m/s", pages[0])
                for page in pages:
                    if "Onda E" in page or "E/E'" in page:
                        for label in ("Diastólica", "Parâmetro", "Valor", "Referência"):
                            self.assertIn(label, page)
                text = " ".join(pages)
                self.assertEqual(text.count("Onda E"), 1)
                self.assertEqual(text.count("E/E'"), 1)
                self.assertIn("0,11 ± 0,03", text)
                self.assertLess(text.index("ANÁLISE QUALITATIVA"), text.index("REFERÊNCIAS BIBLIOGRÁFICAS"))

    def test_species_aliases_keep_fusion_guard_and_independent_tdi_in_pdf(self):
        measurements = synthetic_measurements()
        measurements["Diastolica_ondas"] = "fundidas"
        for species in ("Gato", "Cat"):
            with self.subTest(species=species):
                payload = synthetic_report(measurements)
                payload["paciente"]["especie"] = species
                before = deepcopy(payload)
                data = gerar_pdf_laudo_eco(payload)
                text = re.sub(r"\s+", " ", "\n".join(page.extract_text() for page in PdfReader(BytesIO(data)).pages))
                self.assertEqual(payload, before)
                self.assertIn("Ondas E/A transmitrais fundidas", text)
                self.assertIn("0,11 ± 0,03", text)
                self.assertIn("10.1186/s12917-020-02557-3", text)
                self.assertIn("10.1111/jvim.15745", text)
                self.assertNotIn("0,70 ± 0,14", text)
                self.assertNotIn("7,8 ± 2,92", text)

    def test_pdf_sources_after_qualitative_even_without_weight_catalog(self):
        payload = synthetic_report(synthetic_measurements())
        payload["paciente"].pop("peso")
        before = deepcopy(payload)
        data = gerar_pdf_laudo_eco(payload)
        self.assertEqual(payload, before)
        text = re.sub(r"\s+", " ", "\n".join(p.extract_text() for p in PdfReader(BytesIO(data)).pages))
        self.assertIn("0,70 ± 0,14", text)
        self.assertIn("0,11 ± 0,03", text)
        for doi in ("10.1111/j.1939-1676.2008.0066.x", "10.1590/S0103-84782005000600020", "10.1186/s12917-020-02557-3"):
            self.assertIn(doi, text)
        self.assertLess(text.index("ANÁLISE QUALITATIVA"), text.index("REFERÊNCIAS BIBLIOGRÁFICAS"))
        self.assertNotIn("≤12", text)
        self.assertNotIn("≤2,5", text)

    def test_fusion_note_preserves_raw_values_and_separate_tdi_reference(self):
        measurements = synthetic_measurements()
        measurements["Diastolica_ondas"] = "fundidas"
        text = re.sub(r"\s+", " ", "\n".join(p.extract_text() for p in PdfReader(BytesIO(gerar_pdf_laudo_eco(synthetic_report(measurements)))).pages))
        self.assertIn("Ondas E/A transmitrais fundidas", text)
        self.assertIn("1.14", text)
        self.assertIn("6.75", text)
        self.assertIn("0,11 ± 0,03", text)
        self.assertIn("10.1111/jvim.15745", text)
        self.assertNotIn("0,70 ± 0,14", text)
        self.assertNotIn("7,8 ± 2,92", text)

    def test_unknown_methods_do_not_create_bibliography_or_descriptive_data(self):
        measurements = {"Onda_E": "1.08", "e_doppler": "0.16"}
        text = "\n".join(p.extract_text() for p in PdfReader(BytesIO(gerar_pdf_laudo_eco(synthetic_report(measurements)))).pages)
        self.assertNotIn("REFERÊNCIAS BIBLIOGRÁFICAS", text)
        self.assertNotIn("Média ± DP", text)
