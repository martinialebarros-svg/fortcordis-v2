import { Request, Response } from "express";
import { query, withTransaction } from "../services/dbService";
import { sendWhatsAppMessageWithRetry } from "../services/whatsappService";
import { logger } from "../utils/logger";

const whatsappAccessToken = process.env.WHATSAPP_ACCESS_TOKEN;
const phoneNumberId = process.env.PHONE_NUMBER_ID;

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

  if (phone) {
    params.push(`%${phone}%`);
    whereClauses.push(`c.wa_phone_number ILIKE $${params.length}`);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const totalResult = await query<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM conversations c ${whereSql}`,
    params
  );

  const dataParams = [...params, limit, offset];
  const dataResult = await query(
    `
      SELECT
        c.*,
        (
          SELECT m.body
          FROM messages m
          WHERE m.conversation_id = c.id
          ORDER BY m.created_at DESC
          LIMIT 1
        ) AS last_message_body,
        (
          SELECT m.created_at
          FROM messages m
          WHERE m.conversation_id = c.id
          ORDER BY m.created_at DESC
          LIMIT 1
        ) AS last_message_at
      FROM conversations c
      ${whereSql}
      ORDER BY c.last_activity_at DESC NULLS LAST, c.id DESC
      LIMIT $${dataParams.length - 1}
      OFFSET $${dataParams.length}
    `,
    dataParams
  );

  res.json({
    data: dataResult.rows,
    pagination: {
      page,
      limit,
      total: Number.parseInt(totalResult.rows[0]?.total ?? "0", 10)
    }
  });
}

export async function listConversationMessages(req: Request, res: Response): Promise<void> {
  const conversationId = req.params.id;
  const page = parsePositiveInt(req.query.page as string | undefined, 1);
  const limit = Math.min(parsePositiveInt(req.query.limit as string | undefined, 50), 200);
  const offset = (page - 1) * limit;

  const conversation = await query(`SELECT id FROM conversations WHERE id = $1`, [conversationId]);
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
    pagination: {
      page,
      limit,
      total: Number.parseInt(totalResult.rows[0]?.total ?? "0", 10)
    }
  });
}

export async function sendConversationMessage(req: Request, res: Response): Promise<void> {
  const conversationId = req.params.id;
  const body = req.body?.body;
  const type = req.body?.type ?? "text";

  if (typeof body !== "string" || body.trim().length === 0) {
    res.status(400).json({ error: "body is required" });
    return;
  }

  if (!whatsappAccessToken || !phoneNumberId) {
    res.status(500).json({ error: "Missing WhatsApp API environment configuration" });
    return;
  }

  const conversationResult = await query<{ id: string; wa_phone_number: string }>(
    `SELECT id, wa_phone_number FROM conversations WHERE id = $1`,
    [conversationId]
  );

  const conversation = conversationResult.rows[0];
  if (!conversation) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  const insertedMessage = await query<{ id: string }>(
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
    [conversationId, body.trim(), type, JSON.stringify({ source: "agent_api" })]
  );

  const localMessageId = insertedMessage.rows[0].id;

  try {
    const graphResponse = await sendWhatsAppMessageWithRetry({
      phoneNumberId,
      accessToken: whatsappAccessToken,
      to: conversation.wa_phone_number,
      body: body.trim(),
      type
    });

    const waMessageId = graphResponse.messages?.[0]?.id ?? null;

    await query(
      `
        UPDATE messages
        SET wa_message_id = $1,
            status = 'sent',
            metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb
        WHERE id = $3
      `,
      [waMessageId, JSON.stringify({ graph_response: graphResponse }), localMessageId]
    );

    await touchConversation(conversationId);

    res.status(201).json({
      id: localMessageId,
      wa_message_id: waMessageId,
      status: "sent"
    });
  } catch (error: any) {
    logger.error("Graph API send failed", {
      conversationId,
      localMessageId,
      message: error?.message
    });

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
        localMessageId
      ]
    );

    await touchConversation(conversationId);

    res.status(502).json({
      error: "Failed to send message to WhatsApp Graph API",
      local_message_id: localMessageId
    });
  }
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
      `SELECT id FROM conversations WHERE id = $1`,
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
        UPDATE conversation_participants
        SET left_at = now()
        WHERE conversation_id = $1
          AND agent_id = $2
          AND left_at IS NULL
      `,
      [conversationId, agentId]
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
      [conversationId, agentId, JSON.stringify({ source: "api.claim" })]
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
      `SELECT id, last_agent_id FROM conversations WHERE id = $1`,
      [conversationId]
    );

    if (conversation.rowCount === 0) {
      return { notFound: "conversation" as const };
    }

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
      [conversationId, agentId, JSON.stringify({ source: "api.unclaim" })]
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
