import assert from "assert";
import { Request, Response } from "express";
import {
  isConversationStatus,
  resolveTextMessageMetadata
} from "../src/controllers/conversationsController";
import { listApprovedTemplateCatalog } from "../src/controllers/templateCatalogController";

async function run(): Promise<void> {
  assert.strictEqual(isConversationStatus("open"), true);
  assert.strictEqual(isConversationStatus("pending"), true);
  assert.strictEqual(isConversationStatus("closed"), true);
  assert.strictEqual(isConversationStatus("resolved"), false);
  assert.strictEqual(isConversationStatus(null), false);

  assert.deepStrictEqual(
    resolveTextMessageMetadata({ body: {} } as Request),
    { source: "agent_api" },
    "ordinary agent messages keep the legacy metadata"
  );
  const botRequest = {
    body: {
      metadata: {
        origem: "bot",
        source: "bot_suggest_reviewed",
        resposta_id: "21",
        idempotency_key: "whatsapp-bot-resposta-21"
      }
    },
    authUser: { authSource: "internal_token" }
  } as unknown as Request;
  assert.deepStrictEqual(resolveTextMessageMetadata(botRequest), botRequest.body.metadata);
  assert.strictEqual(
    resolveTextMessageMetadata({ ...botRequest, authUser: { authSource: "core_api" } } as unknown as Request),
    null,
    "browser-authenticated callers cannot forge the bot badge"
  );
  assert.strictEqual(
    resolveTextMessageMetadata({
      ...botRequest,
      body: { metadata: { ...botRequest.body.metadata, idempotency_key: "arbitrary" } }
    } as unknown as Request),
    null,
    "bot idempotency keys are scoped to response ids"
  );
  assert.strictEqual(
    resolveTextMessageMetadata({
      ...botRequest,
      body: {
        metadata: {
          ...botRequest.body.metadata,
          idempotency_key: "whatsapp-bot-resposta-22"
        }
      }
    } as unknown as Request),
    null,
    "the idempotency key must belong to the declared bot response"
  );

  let responsePayload: unknown = null;
  const response = {
    json(payload: unknown) {
      responsePayload = payload;
      return this;
    }
  } as unknown as Response;

  await listApprovedTemplateCatalog({} as Request, response);

  const catalog = responsePayload as {
    data: Array<{
      key: string;
      variable_labels: string[];
      body_parameter_count: number;
      requires_document: boolean;
      can_copy_as_free_text: boolean;
      meta_approval_live: null;
    }>;
    source: string;
    meta_approval_live: null;
  };

  assert.strictEqual(catalog.source, "configured_catalog");
  assert.strictEqual(catalog.meta_approval_live, null);
  assert.strictEqual(catalog.data.length, 12);
  assert.ok(catalog.data.every((template) => template.variable_labels.length === template.body_parameter_count));
  assert.ok(catalog.data.every((template) => template.meta_approval_live === null));

  const receiptPdf = catalog.data.find((template) => template.key === "receiptPdf");
  assert.ok(receiptPdf);
  assert.strictEqual(receiptPdf?.requires_document, true);
  assert.strictEqual(receiptPdf?.can_copy_as_free_text, false);

  const report = catalog.data.find((template) => template.key === "portalReportAvailable");
  assert.ok(report);
  assert.strictEqual(report?.requires_document, false);
  assert.strictEqual(report?.can_copy_as_free_text, true);

  console.log("Inbox status and configured template catalog contracts passed.");
}

void run().catch((error) => {
  console.error("Inbox UI contract test failed:", error);
  process.exit(1);
});
