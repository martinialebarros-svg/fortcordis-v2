import importlib.util
import json
import unittest
from pathlib import Path

PATH = Path(__file__).resolve().parents[2] / 'scripts/collect_whatsapp_stage_persistence_diagnostics.py'
spec = importlib.util.spec_from_file_location('stage_diagnostics', PATH)
diagnostics = importlib.util.module_from_spec(spec)
spec.loader.exec_module(diagnostics)


class StagePersistenceDiagnosticsTest(unittest.TestCase):
    def test_pool_limit_and_other_errors_are_classified_without_sensitive_words(self):
        meta = {'details':{'message':'MaxClientsInSessionMode host private.example password SECRET-VALUE',
            'code':'53300','detail':'phone 5585987654321 patient Private Pet',
            'payload':{'name':'Private Tutor'},'sql':'SELECT password FROM private'}}
        line = '[2026-10-12T02:08:37.000Z] [ERROR] Failed to persist webhook event ' + json.dumps(meta)
        result = diagnostics.summarize(line+'\n'+line)
        self.assertEqual(result['events_found'],2)
        self.assertEqual(result['errors'][0]['category'],'connection_capacity')
        self.assertEqual(result['errors'][0]['code'],'53300')
        output = json.dumps(result)
        for sensitive in ('private.example','SECRET-VALUE','5585987654321','Private Pet','Private Tutor','SELECT'):
            self.assertNotIn(sensitive,output)

    def test_unknown_codes_and_unrelated_payloads_never_echo(self):
        journal = '[2026-10-12T02:08:37.000Z] [INFO] inbound SECRET-VALUE\n'
        journal += '[2026-10-12T02:08:37.000Z] [ERROR] Failed to persist webhook event {"details":{"code":"SECRET-VALUE","message":"arbitrary Private Tutor"}}'
        result = diagnostics.summarize(journal)
        self.assertEqual(result['events_found'],1)
        self.assertIsNone(result['errors'][0]['code'])
        self.assertNotIn('SECRET-VALUE',json.dumps(result))

    def test_aggregate_network_error_is_summarized(self):
        journal = 'Unexpected PostgreSQL pool error {"message":"AggregateError","inner_errors":[{"message":"connection reset private-host"}]}'
        self.assertEqual(diagnostics.summarize(journal)['errors'][0]['category'],'connection_unavailable')
        self.assertEqual(diagnostics.summarize('no relevant error')['events_found'],0)
