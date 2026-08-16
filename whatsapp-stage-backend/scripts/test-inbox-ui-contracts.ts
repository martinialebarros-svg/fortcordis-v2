import assert from "assert";
import { Request, Response } from "express";
import { isConversationStatus } from "../src/controllers/conversationsController";
import { listApprovedTemplateCatalog } from "../src/controllers/templateCatalogController";

async function run(): Promise<void> {
  assert.strictEqual(isConversationStatus("open"), true);
  assert.strictEqual(isConversationStatus("pending"), true);
  assert.strictEqual(isConversationStatus("closed"), true);
  assert.strictEqual(isConversationStatus("resolved"), false);
  assert.strictEqual(isConversationStatus(null), false);

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
  assert.strictEqual(catalog.data.length, 11);
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
