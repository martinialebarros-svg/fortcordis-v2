import assert from "assert";
import axios from "axios";
import { Request, Response } from "express";
import { pool, query } from "../src/services/dbService";
import { reservePendingTextMessage, resolveTextMessageMetadata, sendConversationMessage } from "../src/controllers/conversationsController";

async function run() {
  const url = new URL(process.env.DATABASE_URL || "");
  assert.ok(url.hostname === "127.0.0.1" && /test/.test(url.pathname));
  process.env.WHATSAPP_BOT_AUTO_SEND_ENABLED = "true";
  const conversations: string[] = [];
  let agentId: string | undefined;
  const metadata = (id: string) => ({ source: "bot_auto", origem: "bot", resposta_id: id,
    idempotency_key: `whatsapp-bot-resposta-${id}`, inbound_wa_message_id: `wamid.${id}` });
  const create = async (id: string) => {
    const r = await query<{id: string}>("INSERT INTO conversations (wa_phone_number, last_inbound_at) VALUES ($1, now()) RETURNING id", [`5585000${id}`]);
    const cid = r.rows[0].id;
    conversations.push(cid);
    await query("INSERT INTO messages (conversation_id, from_me, body, type, wa_message_id, status) VALUES ($1, false, 'horario?', 'text', $2, 'received')", [cid, `wamid.${id}`]);
    return cid;
  };
  const request = (cid: string, id: string) => ({ params: {id: cid}, body: {body: "Resposta publica", type: "text", metadata: metadata(id)}, authUser: {authSource: "internal_token"} } as unknown as Request);
  let graphCalls = 0;
  const originalPost = axios.post;
  axios.post = (async () => { graphCalls++; throw Object.assign(new Error("simulated timeout"), {code: "ETIMEDOUT"}); }) as typeof axios.post;
  try {
    const req = request("1", "101");
    assert.deepStrictEqual(resolveTextMessageMetadata(req), metadata("101"));
    assert.strictEqual(resolveTextMessageMetadata({...req, authUser: {authSource: "core_api"}} as unknown as Request), null);
    assert.strictEqual(resolveTextMessageMetadata({...req, body: {metadata: {...metadata("101"), inbound_wa_message_id: ""}}} as Request), null);

    const cid = await create("101");
    const reservations = await Promise.all([
      reservePendingTextMessage(cid, "Resposta", "text", metadata("101")),
      reservePendingTextMessage(cid, "Resposta", "text", metadata("101")),
    ]);
    assert.strictEqual(reservations.filter(r => !r.idempotent).length, 1);
    assert.strictEqual(reservations[0].id, reservations[1].id);
    await query("UPDATE messages SET status='failed' WHERE id=$1", [reservations[0].id]);
    const retry = await reservePendingTextMessage(cid, "Resposta", "text", metadata("101"));
    assert.strictEqual(retry.idempotent, true);
    assert.strictEqual(retry.status, "failed");

    for (const [i, change] of [
      "UPDATE conversations SET last_inbound_at = now() - interval '25 hours' WHERE id=$1",
      "INSERT INTO messages (conversation_id, from_me, body, type, wa_message_id, status) VALUES ($1, false, 'outra pergunta', 'text', 'wamid.new', 'received')",
      "INSERT INTO messages (conversation_id, from_me, body, type, status) VALUES ($1, true, 'resposta humana', 'text', 'sent')",
    ].entries()) {
      const id = String(110+i);
      const changed = await create(id);
      await query(change, [changed]);
      assert.strictEqual((await reservePendingTextMessage(changed, "Resposta", "text", metadata(id))).status, "bot_conversation_changed");
    }
    const agent = await query<{id: string}>("INSERT INTO agents (name,email) VALUES ('Bot Test', 'bot-operacao@example.invalid') RETURNING id");
    agentId = agent.rows[0].id;
    const claimed = await create("119");
    await query("UPDATE conversations SET last_agent_id=$2 WHERE id=$1", [claimed, agentId]);
    assert.strictEqual((await reservePendingTextMessage(claimed, "Resposta", "text", metadata("119"))).status, "bot_conversation_changed");

    const disabled = await create("120");
    process.env.WHATSAPP_BOT_AUTO_SEND_ENABLED = "false";
    assert.strictEqual((await reservePendingTextMessage(disabled, "Resposta", "text", metadata("120"))).status, "bot_conversation_changed");
    process.env.WHATSAPP_BOT_AUTO_SEND_ENABLED = "true";

    const timeout = await create("130");
    let status = 0;
    const res = {status(value: number) {status=value;return this;}, json() {return this;}} as unknown as Response;
    await sendConversationMessage(request(timeout, "130"), res);
    assert.strictEqual(status, 502);
    assert.strictEqual(graphCalls, 1, "automatic Graph calls never retry an ambiguous failure");
    await sendConversationMessage(request(timeout, "130"), res);
    assert.strictEqual(status, 409);
    assert.strictEqual(graphCalls, 1, "repeated HTTP requests cannot send again");
    console.log("Automatic bot contracts passed: authentication, concurrent reservation, stale reply, window, kill switch, ambiguous delivery.");
  } finally {
    axios.post = originalPost;
    await query("DELETE FROM messages WHERE conversation_id = ANY($1::bigint[])", [conversations]);
    await query("DELETE FROM conversations WHERE id = ANY($1::bigint[])", [conversations]);
    if (agentId) await query("DELETE FROM agents WHERE id=$1", [agentId]);
    await pool.end();
  }
}
run().catch(e => { console.error(e); process.exitCode=1; });
