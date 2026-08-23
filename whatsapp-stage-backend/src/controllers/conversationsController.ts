import { Request, Response } from "express";
import { query, withTransaction } from "../services/dbService";
import {
  downloadWhatsAppMedia,
  sendWhatsAppDocumentMessageWithRetry,
  sendWhatsAppMessageWithRetry,
  uploadWhatsAppDocumentWithRetry
} from "../services/whatsappService";
import {
  CustomerServiceWindow,
  describeCustomerServiceWindow
} from "../services/customerServiceWindow";
import { logger } from "../utils/logger";
import { whatsappGraphRecipient } from "../utils/phoneNumber";

const whatsappAccessToken = process.env.WHATSAPP_ACCESS_TOKEN;
const phoneNumberId = process.env.PHONE_NUMBER_ID;

const ATTACHMENT_EXTENSION_MIME_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".csv": "text/csv",
  ".txt": "text/plain"
};

const GENERIC_ATTACHMENT_MIME_TYPES = new Set(["", "application/octet-stream", "application/binary"]);

function resolveAttachmentMimeType(filename: string, reportedMimeType: string): string | null {
  const extension = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  const expectedMimeType = ATTACHMENT_EXTENSION_MIME_TYPES[extension];
  if (!expectedMimeType) return null;
  if (reportedMimeType === expectedMimeType || GENERIC_ATTACHMENT_MIME_TYPES.has(reportedMimeType)) {
    return expectedMimeType;
  }
  return null;
}

const WHATSAPP_DOCUMENT_CAPTION_MAX_LENGTH = 1024;

interface ConversationRow {
  id: string;
  wa_phone_number: string;
  last_inbound_at: Date | string | null;
  [key: string]: unknown;
}

interface PendingMessageReservation {
  id: string;
  wa_message_id: string | null;
  status: string;
  idempotent: boolean;
}

const CONVERSATION_STATUSES = ["open", "pending", "closed"] as const;
type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];

export function isConversationStatus(value: unknown): value is ConversationStatus {
  return typeof value === "string" && CONVERSATION_STATUSES.includes(value as ConversationStatus);
}

function parsePositiveInt(input: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(input ?? "", 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
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

export async function listConversations(req: Request, res: Response): Promise<void> {
  const page = parsePositiveInt(req.query.page as string | undefined, 1);
  const limit = Math.min(parsePositiveInt(req.query.limit as string | undefined, 20), 100);
  const offset = (page - 1) * limit;

  const status = req.query.status as string | undefined;
  const assigned = req.query.assigned as string | undefined;
  const phone = req.query.phone as string | undefined;
  const search = (req.query.search as string | undefined) || phone;

  const whereClauses: string[] = [];
  const params: unknown[] = [];

  if (status) {
    params.push(status);
    whereClauses.push(`c.status = $${params.length}`);
  }

  if (assigned === "assigned") {
    whereClauses.push("c.last_agent_id IS NOT NULL");
  }

  if (assigned === "unassigned") {
    whereClauses.push("c.last_agent_id IS NULL");
  }

  if (search) {
    params.push(`%${search.trim()}%`);
    whereClauses.push(`(
      c.wa_phone_number ILIKE $${params.length}
      OR COALESCE(c.subject, '') ILIKE $${params.length}
      OR COALESCE(last_message.body, '') ILIKE $${params.length}
    )`);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
  const joinsSql = `
    LEFT JOIN agents assigned_agent ON assigned_agent.id = c.last_agent_id
    LEFT JOIN LATERAL (
      SELECT m.body, m.created_at, m.from_me, m.type
      FROM messages m
      WHERE m.conversation_id = c.id
      ORDER BY m.created_at DESC, m.id DESC
      LIMIT 1
    ) last_message ON true
  `;

  const totalResult = await query<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM conversations c ${joinsSql} ${whereSql}`,
    params
  );

  const dataParams = [...params, limit, offset];
  const dataResult = await query<ConversationRow>(
    `
      SELECT
        c.*,
        (
          c.last_inbound_at IS NOT NULL
          AND (c.last_seen_at IS NULL OR c.last_inbound_at > c.last_seen_at)
        ) AS unread,
        assigned_agent.name AS assigned_agent_name,
        assigned_agent.email AS assigned_agent_email,
        last_message.body AS last_message_body,
        last_message.created_at AS last_message_at,
        last_message.from_me AS last_message_from_me,
        last_message.type AS last_message_type
      FROM conversations c
      ${joinsSql}
      ${whereSql}
      ORDER BY
        unread DESC,
        CASE WHEN (
          c.last_inbound_at IS NOT NULL
          AND (c.last_seen_at IS NULL OR c.last_inbound_at > c.last_seen_at)
        ) THEN c.last_inbound_at END ASC NULLS LAST,
        c.last_activity_at DESC,
        c.id DESC
      LIMIT $${dataParams.length - 1}
      OFFSET $${dataParams.length}
    `,
    dataParams
  );

  res.json({
    data: dataResult.rows.map((conversation) => ({
      ...conversation,
      customer_service_window: describeCustomerServiceWindow(conversation.last_inbound_at)
    })),
    pagination: {
      page,
      limit,
      total: Number.parseInt(totalResult.rows[0]?.total ?? "0", 10)
    }
  });
}

export async function updateConversationStatus(req: Request, res: Response): Promise<void> {
  const conversationId = req.params.id;
  const nextStatus = req.body?.status;

  if (!isConversationStatus(nextStatus)) {
    res.status(422).json({
      error: `status must be one of: ${CONVERSATION_STATUSES.join(", ")}`
    });
    return;
  }

  const result = await withTransaction(async (client) => {
    const current = await client.query<{
      id: string;
      status: string;
      wa_phone_number: string;
    }>(
      `SELECT id, status, wa_phone_number FROM conversations WHERE id = $1 FOR UPDATE`,
      [conversationId]
    );

    const conversation = current.rows[0];
    if (!conversation) {
      return { notFound: true as const };
    }

    if (conversation.status === nextStatus) {
      return { conversation, changed: false };
    }

    const updated = await client.query<ConversationRow>(
      `UPDATE conversations
       SET status = $2, updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [conversationId, nextStatus]
    );

    await client.query(
      `INSERT INTO audit_logs (conversation_id, action, payload, created_at)
       VALUES ($1, 'conversation_status_changed', $2::jsonb, now())`,
      [
        conversationId,
        JSON.stringify({
          source: "api.conversation_status",
          previous_status: conversation.status,
          status: nextStatus
        })
      ]
    );

    return { conversation: updated.rows[0], changed: true };
  });

  if ("notFound" in result) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  res.status(200).json({ data: result.conversation, changed: result.changed });
}

export async function markConversationSeen(req: Request, res: Response): Promise<void> {
  const conversationId = req.params.id;

  const result = await query<{ id: string; last_seen_at: string }>(
    `UPDATE conversations
     SET last_seen_at = now()
     WHERE id = $1
     RETURNING id, last_seen_at`,
    [conversationId]
  );

  if (result.rowCount === 0) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  res.status(200).json({ data: result.rows[0] });
}

export async function listConversationMessages(req: Request, res: Response): Promise<void> {
  const conversationId = req.params.id;
  const page = parsePositiveInt(req.query.page as string | undefined, 1);
  const limit = Math.min(parsePositiveInt(req.query.limit as string | undefined, 50), 200);
  const offset = (page - 1) * limit;

  const conversation = await query<{ id: string; last_inbound_at: Date | string | null }>(
    `SELECT id, last_inbound_at FROM conversations WHERE id = $1`,
    [conversationId]
  );
  if (conversation.rowCount === 0) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  const totalResult = await query<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM messages WHERE conversation_id = $1`,
    [conversationId]
  );

  const dataResult = await query(
    `
      SELECT *
      FROM messages
      WHERE conversation_id = $1
      ORDER BY created_at ASC, id ASC
      LIMIT $2
      OFFSET $3
    `,
    [conversationId, limit, offset]
  );

  res.json({
    data: dataResult.rows,
    last_inbound_at: conversation.rows[0]?.last_inbound_at ?? null,
    customer_service_window: describeCustomerServiceWindow(
      conversation.rows[0]?.last_inbound_at ?? null
    ),
    pagination: {
      page,
      limit,
      total: Number.parseInt(totalResult.rows[0]?.total ?? "0", 10)
    }
  });
}

const DOWNLOADABLE_MEDIA_TYPES = new Set(["image", "audio", "video", "document", "sticker"]);

export async function getMessageMedia(req: Request, res: Response): Promise<void> {
  const conversationId = req.params.id;
  const messageId = req.params.messageId;

  const result = await query<{ type: string; metadata: Record<string, unknown> | null; from_me: boolean }>(
    `SELECT type, metadata, from_me FROM messages WHERE id = $1 AND conversation_id = $2`,
    [messageId, conversationId]
  );

  const row = result.rows[0];
  if (!row) {
    res.status(404).json({ error: "Message not found" });
    return;
  }

  if (!DOWNLOADABLE_MEDIA_TYPES.has(row.type)) {
    res.status(422).json({ error: "Message does not have downloadable media" });
    return;
  }

  const rawMessage = (row.metadata?.message ?? {}) as Record<string, unknown>;
  const mediaObject = (rawMessage[row.type] ?? {}) as { id?: unknown; filename?: unknown };
  const approvedTemplateMediaId = row.metadata?.wa_media_id;
  const mediaId = typeof mediaObject.id === "string"
    ? mediaObject.id
    : typeof approvedTemplateMediaId === "string" ? approvedTemplateMediaId : null;
  const filename = typeof mediaObject.filename === "string" && mediaObject.filename
    ? mediaObject.filename
    : typeof row.metadata?.document_filename === "string" ? row.metadata.document_filename : null;

  if (!mediaId) {
    res.status(404).json({ error: "Media reference not found for this message" });
    return;
  }

  if (!whatsappAccessToken) {
    res.status(500).json({ error: "Missing WhatsApp API environment configuration" });
    return;
  }

  try {
    const media = await downloadWhatsAppMedia({ mediaId, accessToken: whatsappAccessToken });
    res.setHeader("Content-Type", media.mimeType);
    res.setHeader("Cache-Control", "private, max-age=3600");
    if (row.type === "document" && filename) {
      const asciiFallback = filename.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "");
      const encodedFilename = encodeURIComponent(filename);
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${asciiFallback}"; filename*=UTF-8''${encodedFilename}`
      );
    }
    res.send(media.buffer);
  } catch (error) {
    logger.error("Failed to download WhatsApp media", {
      conversationId,
      messageId,
      mediaId,
      message: error instanceof Error ? error.message : String(error)
    });
    res.status(502).json({ error: "Failed to download media from WhatsApp. It may have expired." });
  }
}

async function insertPendingMessage(
  conversationId: string,
  body: string,
  type: string,
  metadata: Record<string, unknown>
): Promise<string> {
  const inserted = await query<{ id: string }>(
    `
      INSERT INTO messages (
        conversation_id,
        from_me,
        body,
        type,
        metadata,
        status,
        created_at
      )
      VALUES ($1, true, $2, $3, $4::jsonb, 'pending', now())
      RETURNING id
    `,
    [conversationId, body, type, JSON.stringify(metadata)]
  );
  return inserted.rows[0].id;
}

async function reservePendingTextMessage(
  conversationId: string,
  body: string,
  type: string,
  metadata: Record<string, unknown>
): Promise<PendingMessageReservation> {
  const idempotencyKey = typeof metadata.idempotency_key === "string"
    ? metadata.idempotency_key.trim()
    : "";
  if (!idempotencyKey) {
    return {
      id: await insertPendingMessage(conversationId, body, type, metadata),
      wa_message_id: null,
      status: "pending",
      idempotent: false
    };
  }

  return withTransaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [idempotencyKey]);
    const existing = await client.query<{ id: string; wa_message_id: string | null; status: string }>(
      `
        SELECT id, wa_message_id, status
        FROM messages
        WHERE metadata->>'idempotency_key' = $1
        LIMIT 1
      `,
      [idempotencyKey]
    );
    const row = existing.rows[0];
    if (row && row.status !== "failed") {
      return { ...row, idempotent: true };
    }
    if (row) {
      const retried = await client.query<{ id: string; wa_message_id: string | null; status: string }>(
        `
          UPDATE messages
          SET conversation_id = $1,
              body = $2,
              type = $3,
              metadata = $4::jsonb,
              wa_message_id = NULL,
              status = 'pending',
              created_at = now()
          WHERE id = $5
          RETURNING id, wa_message_id, status
        `,
        [conversationId, body, type, JSON.stringify(metadata), row.id]
      );
      return { ...retried.rows[0], idempotent: false };
    }
    const inserted = await client.query<{ id: string; wa_message_id: string | null; status: string }>(
      `
        INSERT INTO messages (
          conversation_id, from_me, body, type, metadata, status, created_at
        )
        VALUES ($1, true, $2, $3, $4::jsonb, 'pending', now())
        RETURNING id, wa_message_id, status
      `,
      [conversationId, body, type, JSON.stringify(metadata)]
    );
    return { ...inserted.rows[0], idempotent: false };
  });
}

export function resolveTextMessageMetadata(req: Request): Record<string, unknown> | null {
  const requested = req.body?.metadata;
  if (requested === undefined || requested === null) {
    return { source: "agent_api" };
  }
  const authenticatedRequest = req as Request & {
    authUser?: { authSource?: "core_api" | "internal_token" };
  };
  if (authenticatedRequest.authUser?.authSource !== "internal_token") {
    return null;
  }
  if (typeof requested !== "object" || Array.isArray(requested)) {
    return null;
  }
  const source = requested.source;
  const origem = requested.origem;
  const respostaId = requested.resposta_id;
  const idempotencyKey = requested.idempotency_key;
  if (
    source !== "bot_suggest_reviewed" ||
    origem !== "bot" ||
    typeof respostaId !== "string" || !/^\d{1,20}$/.test(respostaId) ||
    typeof idempotencyKey !== "string" ||
    idempotencyKey !== `whatsapp-bot-resposta-${respostaId}`
  ) {
    return null;
  }
  return { source, origem, resposta_id: respostaId, idempotency_key: idempotencyKey };
}

async function markMessageSent(
  messageId: string,
  waMessageId: string | null,
  metadataPatch: Record<string, unknown>
): Promise<void> {
  await query(
    `
      UPDATE messages
      SET wa_message_id = $1,
          status = 'sent',
          metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb
      WHERE id = $3
    `,
    [waMessageId, JSON.stringify(metadataPatch), messageId]
  );
}

async function markMessageFailed(messageId: string, error: any): Promise<void> {
  await query(
    `
      UPDATE messages
      SET status = 'failed',
          metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb
      WHERE id = $2
    `,
    [
      JSON.stringify({
        graph_error: {
          message: error?.message,
          status: error?.response?.status,
          data: error?.response?.data
        }
      }),
      messageId
    ]
  );
}

export function decodeMultipartFilename(rawFilename: string): string {
  // Busboy/Multer decode multipart header parameters as latin1 by default,
  // even though browsers send the filename as raw UTF-8 bytes — without
  // this round-trip, accented names (ex.: "laudo-coração.pdf") arrive
  // mangled ("laudo-coraÃ§Ã£o.pdf").
  return Buffer.from(rawFilename, "latin1").toString("utf8");
}

const ATTACHMENT_FILENAME_MAX_LENGTH = 200;

export function sanitizeAttachmentFilename(rawFilename: string): string {
  const trimmed = rawFilename.trim();
  if (!trimmed) return "anexo";
  if (trimmed.length <= ATTACHMENT_FILENAME_MAX_LENGTH) return trimmed;

  const dotIndex = trimmed.lastIndexOf(".");
  const hasExtension = dotIndex > 0 && dotIndex < trimmed.length - 1;
  const extension = hasExtension ? trimmed.slice(dotIndex) : "";
  const stem = hasExtension ? trimmed.slice(0, dotIndex) : trimmed;

  const stemCodePoints = Array.from(stem);
  const maxStemLength = Math.max(1, ATTACHMENT_FILENAME_MAX_LENGTH - extension.length);
  const truncatedStem = stemCodePoints.slice(0, maxStemLength).join("");

  return `${truncatedStem}${extension}` || "anexo";
}

async function sendAttachmentMessage(
  res: Response,
  conversationId: string,
  waPhoneNumber: string,
  file: Express.Multer.File,
  mimeType: string,
  caption: string,
  accessToken: string,
  phoneNumberId: string
): Promise<void> {
  const filename = sanitizeAttachmentFilename(decodeMultipartFilename(file.originalname));
  const localMessageId = await insertPendingMessage(conversationId, filename, "document", {
    source: "agent_api",
    ...(caption ? { caption } : {})
  });

  let media: Awaited<ReturnType<typeof uploadWhatsAppDocumentWithRetry>>;
  let graphResponse: Awaited<ReturnType<typeof sendWhatsAppDocumentMessageWithRetry>>;
  try {
    media = await uploadWhatsAppDocumentWithRetry({
      phoneNumberId,
      accessToken,
      filename,
      content: file.buffer,
      mimeType
    });

    graphResponse = await sendWhatsAppDocumentMessageWithRetry({
      phoneNumberId,
      accessToken,
      to: whatsappGraphRecipient(waPhoneNumber),
      mediaId: media.id,
      filename,
      caption: caption || undefined
    });
  } catch (error: any) {
    logger.error("Graph API attachment send failed", {
      conversationId,
      localMessageId,
      message: error?.message
    });

    await markMessageFailed(localMessageId, error);
    await touchConversation(conversationId);

    res.status(502).json({
      error: "Failed to send attachment to WhatsApp Graph API",
      local_message_id: localMessageId
    });
    return;
  }

  const waMessageId = graphResponse.messages?.[0]?.id ?? null;

  try {
    await markMessageSent(localMessageId, waMessageId, {
      graph_response: graphResponse,
      message: {
        type: "document",
        document: { id: media.id, filename, ...(caption ? { caption } : {}) }
      }
    });
    await touchConversation(conversationId);
  } catch (error: any) {
    logger.error("Failed to persist sent attachment message state", {
      conversationId,
      localMessageId,
      waMessageId,
      message: error?.message
    });
  }

  res.status(201).json({ id: localMessageId, wa_message_id: waMessageId, status: "sent" });
}

export async function sendConversationMessage(req: Request, res: Response): Promise<void> {
  const conversationId = req.params.id;
  const file = req.file;
  const caption = typeof req.body?.body === "string" ? req.body.body.trim() : "";
  const type = req.body?.type ?? "text";

  if (!file && caption.length === 0) {
    res.status(400).json({ error: "body is required" });
    return;
  }

  const resolvedAttachmentMimeType = file
    ? resolveAttachmentMimeType(decodeMultipartFilename(file.originalname), file.mimetype)
    : null;
  if (file && !resolvedAttachmentMimeType) {
    res.status(422).json({ error: "Unsupported attachment file type" });
    return;
  }

  if (file && caption.length > WHATSAPP_DOCUMENT_CAPTION_MAX_LENGTH) {
    res.status(422).json({
      error: `Attachment caption exceeds ${WHATSAPP_DOCUMENT_CAPTION_MAX_LENGTH} characters`,
      code: "CAPTION_TOO_LONG"
    });
    return;
  }

  if (file && file.buffer.length === 0) {
    res.status(422).json({ error: "Attachment file is empty" });
    return;
  }

  if (!whatsappAccessToken || !phoneNumberId) {
    res.status(500).json({ error: "Missing WhatsApp API environment configuration" });
    return;
  }

  const conversationResult = await query<{
    id: string;
    wa_phone_number: string;
    last_inbound_at: Date | string | null;
  }>(
    `SELECT id, wa_phone_number, last_inbound_at FROM conversations WHERE id = $1`,
    [conversationId]
  );

  const conversation = conversationResult.rows[0];
  if (!conversation) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  const customerServiceWindow: CustomerServiceWindow = describeCustomerServiceWindow(
    conversation.last_inbound_at
  );
  if (!customerServiceWindow.is_open) {
    res.status(409).json({
      error: "Customer service window is closed. Use an approved template.",
      code: "CUSTOMER_SERVICE_WINDOW_CLOSED",
      customer_service_window: customerServiceWindow
    });
    return;
  }

  if (file) {
    await sendAttachmentMessage(
      res,
      conversationId,
      conversation.wa_phone_number,
      file,
      resolvedAttachmentMimeType as string,
      caption,
      whatsappAccessToken,
      phoneNumberId
    );
    return;
  }

  const messageMetadata = resolveTextMessageMetadata(req);
  if (!messageMetadata) {
    res.status(422).json({ error: "Invalid bot message metadata" });
    return;
  }
  const reservation = await reservePendingTextMessage(
    conversationId,
    caption,
    type,
    messageMetadata
  );
  const localMessageId = reservation.id;
  if (reservation.idempotent) {
    if (["sent", "delivered", "read"].includes(reservation.status)) {
      res.status(200).json({
        id: localMessageId,
        wa_message_id: reservation.wa_message_id,
        status: "sent",
        idempotent: true
      });
      return;
    }
    res.status(409).json({
      error: "Message send is already in progress",
      code: "MESSAGE_SEND_IN_PROGRESS",
      local_message_id: localMessageId
    });
    return;
  }

  let graphResponse: any;
  try {
    graphResponse = await sendWhatsAppMessageWithRetry({
      phoneNumberId,
      accessToken: whatsappAccessToken,
      to: whatsappGraphRecipient(conversation.wa_phone_number),
      body: caption,
      type
    });
  } catch (error: any) {
    logger.error("Graph API send failed", {
      conversationId,
      localMessageId,
      message: error?.message
    });

    try {
      await markMessageFailed(localMessageId, error);
      await touchConversation(conversationId);
    } catch (persistenceError: any) {
      logger.error("Failed to persist WhatsApp send failure", {
        conversationId,
        localMessageId,
        message: persistenceError?.message
      });
    }

    res.status(502).json({
      error: "Failed to send message to WhatsApp Graph API",
      local_message_id: localMessageId
    });
    return;
  }

  const waMessageId = graphResponse.messages?.[0]?.id ?? null;
  try {
    await markMessageSent(localMessageId, waMessageId, { graph_response: graphResponse });
  } catch (error: any) {
    // A Graph API já aceitou a mensagem. Manter a reserva em `pending` é
    // intencionalmente fail-closed: uma repetição idempotente não pode chamar
    // a Graph novamente e duplicar a mensagem externa.
    logger.error("WhatsApp send accepted but local confirmation failed", {
      conversationId,
      localMessageId,
      message: error?.message
    });
    res.status(202).json({
      id: localMessageId,
      wa_message_id: waMessageId,
      status: "accepted_unconfirmed",
      idempotent: false
    });
    return;
  }

  try {
    await touchConversation(conversationId);
  } catch (error: any) {
    logger.error("WhatsApp message sent but conversation touch failed", {
      conversationId,
      localMessageId,
      message: error?.message
    });
  }

  res.status(201).json({
    id: localMessageId,
    wa_message_id: waMessageId,
    status: "sent",
    idempotent: false
  });
}

export async function claimConversation(req: Request, res: Response): Promise<void> {
  const conversationId = req.params.id;
  const agentId = req.body?.agent_id;

  if (!agentId) {
    res.status(400).json({ error: "agent_id is required" });
    return;
  }

  const result = await withTransaction(async (client) => {
    const conversation = await client.query<{ id: string }>(
      `SELECT id FROM conversations WHERE id = $1 FOR UPDATE`,
      [conversationId]
    );

    if (conversation.rowCount === 0) {
      return { notFound: "conversation" as const };
    }

    const agent = await client.query<{ id: string }>(
      `SELECT id FROM agents WHERE id = $1 AND active = true`,
      [agentId]
    );

    if (agent.rowCount === 0) {
      return { notFound: "agent" as const };
    }

    await client.query(
      `
        SELECT id
        FROM conversation_participants
        WHERE conversation_id = $1
          AND left_at IS NULL
        FOR UPDATE
      `,
      [conversationId]
    );

    await client.query(
      `
        UPDATE conversation_participants
        SET left_at = now()
        WHERE conversation_id = $1
          AND left_at IS NULL
      `,
      [conversationId]
    );

    const participant = await client.query<{ id: string }>(
      `
        INSERT INTO conversation_participants (
          conversation_id,
          agent_id,
          joined_at
        )
        VALUES ($1, $2, now())
        RETURNING id
      `,
      [conversationId, agentId]
    );

    await client.query(
      `
        UPDATE conversations
        SET last_agent_id = $2,
            updated_at = now(),
            last_activity_at = now()
        WHERE id = $1
      `,
      [conversationId, agentId]
    );

    await client.query(
      `
        INSERT INTO audit_logs (conversation_id, agent_id, action, payload, created_at)
        VALUES ($1, $2, 'claim', $3::jsonb, now())
      `,
      [
        conversationId,
        agentId,
        JSON.stringify({
          source: "api.claim",
          note: "conversation row locked with FOR UPDATE before claim"
        })
      ]
    );

    return { participantId: participant.rows[0].id };
  });

  if ((result as any).notFound === "conversation") {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  if ((result as any).notFound === "agent") {
    res.status(404).json({ error: "Agent not found or inactive" });
    return;
  }

  res.status(200).json({
    message: "Conversation claimed",
    participant_id: (result as any).participantId
  });
}

export async function unclaimConversation(req: Request, res: Response): Promise<void> {
  const conversationId = req.params.id;
  const agentId = req.body?.agent_id;

  if (!agentId) {
    res.status(400).json({ error: "agent_id is required" });
    return;
  }

  const result = await withTransaction(async (client) => {
    const conversation = await client.query<{ id: string; last_agent_id: string | null }>(
      `SELECT id, last_agent_id FROM conversations WHERE id = $1 FOR UPDATE`,
      [conversationId]
    );

    if (conversation.rowCount === 0) {
      return { notFound: "conversation" as const };
    }

    await client.query(
      `
        SELECT id
        FROM conversation_participants
        WHERE conversation_id = $1
          AND left_at IS NULL
        FOR UPDATE
      `,
      [conversationId]
    );

    const participants = await client.query<{ id: string }>(
      `
        UPDATE conversation_participants
        SET left_at = now()
        WHERE conversation_id = $1
          AND agent_id = $2
          AND left_at IS NULL
        RETURNING id
      `,
      [conversationId, agentId]
    );

    if (participants.rowCount === 0) {
      return { notFound: "assignment" as const };
    }

    await client.query(
      `
        UPDATE conversations
        SET last_agent_id = CASE WHEN last_agent_id = $2 THEN NULL ELSE last_agent_id END,
            updated_at = now(),
            last_activity_at = now()
        WHERE id = $1
      `,
      [conversationId, agentId]
    );

    await client.query(
      `
        INSERT INTO audit_logs (conversation_id, agent_id, action, payload, created_at)
        VALUES ($1, $2, 'unclaim', $3::jsonb, now())
      `,
      [
        conversationId,
        agentId,
        JSON.stringify({
          source: "api.unclaim",
          note: "conversation row locked with FOR UPDATE before unclaim"
        })
      ]
    );

    return { affected: participants.rowCount };
  });

  if ((result as any).notFound === "conversation") {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  if ((result as any).notFound === "assignment") {
    res.status(404).json({ error: "No active claim found for this agent in this conversation" });
    return;
  }

  res.status(200).json({ message: "Conversation unclaimed" });
}
