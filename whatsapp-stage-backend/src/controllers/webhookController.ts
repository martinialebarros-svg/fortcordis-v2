import { Request, Response } from "express";
import { query } from "../services/dbService";
import { verifyXHubSignature } from "../utils/signature";
import { logger } from "../utils/logger";

interface WebhookChangeValue {
  messaging_product?: string;
  metadata?: {
    display_phone_number?: string;
    phone_number_id?: string;
  };
  contacts?: Array<{
    profile?: { name?: string };
    wa_id?: string;
  }>;
  messages?: Array<Record<string, any>>;
  statuses?: Array<Record<string, any>>;
}

interface WebhookPayload {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      field?: string;
      value?: WebhookChangeValue;
    }>;
  }>;
}

const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
const appSecret = process.env.WHATSAPP_APP_SECRET;
const allowUnsigned = process.env.WEBHOOK_ALLOW_UNSIGNED === "true" && process.env.NODE_ENV !== "production";

function extractMessageBody(message: Record<string, any>): string {
  const type = message.type;

  switch (type) {
    case "text":
      return message.text?.body ?? "";
    case "button":
      return message.button?.text ?? "";
    case "interactive":
      return JSON.stringify(message.interactive ?? {});
    case "image":
      return message.image?.caption ?? "[image]";
    case "audio":
      return "[audio]";
    case "video":
      return message.video?.caption ?? "[video]";
    case "document":
      return message.document?.filename ?? "[document]";
    default:
      return "";
  }
}

async function touchConversation(conversationId: string): Promise<void> {
  await query(
    `
      UPDATE conversations
      SET updated_at = now(),
          last_activity_at = now()
      WHERE id = $1
    `,
    [conversationId]
  );
}

async function findOrCreateConversation(phone: string, waPsid?: string | null, subject?: string | null): Promise<{ id: string }> {
  const existing = await query<{ id: string }>(
    `
      SELECT id
      FROM conversations
      WHERE wa_phone_number = $1
         OR ($2::text IS NOT NULL AND wa_psid = $2)
      ORDER BY id ASC
      LIMIT 1
    `,
    [phone, waPsid ?? null]
  );

  if (existing.rows[0]) {
    const id = existing.rows[0].id;

    await query(
      `
        UPDATE conversations
        SET wa_psid = COALESCE($2, wa_psid),
            subject = COALESCE(subject, $3),
            updated_at = now(),
            last_activity_at = now()
        WHERE id = $1
      `,
      [id, waPsid ?? null, subject ?? null]
    );

    return { id };
  }

  const created = await query<{ id: string }>(
    `
      INSERT INTO conversations (
        wa_phone_number,
        wa_psid,
        subject,
        status,
        last_activity_at,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, 'open', now(), now(), now())
      RETURNING id
    `,
    [phone, waPsid ?? null, subject ?? null]
  );

  return { id: created.rows[0].id };
}

async function handleContacts(value: WebhookChangeValue): Promise<void> {
  const contacts = value.contacts ?? [];

  for (const contact of contacts) {
    const waId = contact.wa_id;
    if (!waId) {
      continue;
    }

    const conversation = await findOrCreateConversation(waId, waId, contact.profile?.name ?? null);

    await query(
      `
        INSERT INTO audit_logs (conversation_id, action, payload, created_at)
        VALUES ($1, 'contact_update', $2::jsonb, now())
      `,
      [conversation.id, JSON.stringify({ source: "webhook.contacts", contact })]
    );
  }
}

async function handleInboundMessages(value: WebhookChangeValue): Promise<void> {
  const messages = value.messages ?? [];
  const contactsByWaId = new Map<string, { profile?: { name?: string }; wa_id?: string }>();

  for (const contact of value.contacts ?? []) {
    if (contact.wa_id) {
      contactsByWaId.set(contact.wa_id, contact);
    }
  }

  for (const message of messages) {
    const from = message.from as string | undefined;
    if (!from) {
      continue;
    }

    const waMessageId = (message.id as string | undefined) ?? null;

    if (waMessageId) {
      const existing = await query<{ id: string }>(
        `SELECT id FROM messages WHERE wa_message_id = $1 LIMIT 1`,
        [waMessageId]
      );

      if (existing.rowCount && existing.rowCount > 0) {
        logger.debug("Ignoring duplicate webhook message", { waMessageId });
        continue;
      }
    }

    const contact = contactsByWaId.get(from);
    const conversation = await findOrCreateConversation(from, contact?.wa_id ?? null, contact?.profile?.name ?? null);

    await query(
      `
        INSERT INTO messages (
          conversation_id,
          wa_message_id,
          from_me,
          body,
          type,
          metadata,
          status,
          created_at
        )
        VALUES ($1, $2, false, $3, $4, $5::jsonb, 'received', now())
      `,
      [
        conversation.id,
        waMessageId,
        extractMessageBody(message),
        (message.type as string | undefined) ?? "text",
        JSON.stringify({
          contact,
          message,
          metadata: value.metadata
        })
      ]
    );

    await touchConversation(conversation.id);
  }
}

async function handleStatuses(value: WebhookChangeValue): Promise<void> {
  const statuses = value.statuses ?? [];

  for (const statusEvent of statuses) {
    const waMessageId = statusEvent.id as string | undefined;
    const status = (statusEvent.status as string | undefined) ?? "received";

    if (!waMessageId) {
      continue;
    }

    const updateResult = await query<{ conversation_id: string }>(
      `
        UPDATE messages
        SET status = $1,
            metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb
        WHERE wa_message_id = $3
        RETURNING conversation_id
      `,
      [status, JSON.stringify({ latest_status_event: statusEvent }), waMessageId]
    );

    for (const row of updateResult.rows) {
      await touchConversation(row.conversation_id);
    }
  }
}

async function processWebhook(payload: WebhookPayload): Promise<void> {
  if (payload.object !== "whatsapp_business_account") {
    logger.warn("Ignoring unsupported webhook object", { object: payload.object });
    return;
  }

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages" || !change.value) {
        continue;
      }

      await handleContacts(change.value);
      await handleInboundMessages(change.value);
      await handleStatuses(change.value);
    }
  }
}

export function verifyWebhook(req: Request, res: Response): void {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === verifyToken && typeof challenge === "string") {
    res.status(200).type("text/plain").send(challenge);
    return;
  }

  res.sendStatus(403);
}

export function receiveWebhook(req: Request, res: Response): void {
  const signatureHeader = req.header("x-hub-signature-256") ?? undefined;

  if (!allowUnsigned) {
    if (!appSecret || !verifyXHubSignature(req.rawBody, signatureHeader, appSecret)) {
      logger.warn("Webhook signature validation failed");
      res.sendStatus(401);
      return;
    }
  } else if (appSecret && signatureHeader && !verifyXHubSignature(req.rawBody, signatureHeader, appSecret)) {
    logger.warn("Webhook signature validation failed in debug mode");
    res.sendStatus(401);
    return;
  }

  res.sendStatus(200);

  void processWebhook(req.body as WebhookPayload).catch((error: Error) => {
    logger.error("Webhook background processing failed", { message: error.message });
  });
}
