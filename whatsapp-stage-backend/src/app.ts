import express, { NextFunction, Request, Response } from "express";
import {
  claimConversation,
  listConversationMessages,
  listConversations,
  sendConversationMessage,
  unclaimConversation
} from "./controllers/conversationsController";
import { createAgent, listAgents } from "./controllers/agentsController";
import { receiveWebhook, verifyWebhook } from "./controllers/webhookController";
import { logger } from "./utils/logger";

const app = express();

app.use(
  express.json({
    verify: (req: Request, _res: Response, buf: Buffer) => {
      req.rawBody = Buffer.from(buf);
    }
  })
);

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.get("/webhook", verifyWebhook);
app.post("/webhook", receiveWebhook);

// TODO: add authentication and ACL for agent endpoints before production.
app.get("/conversations", asyncHandler(listConversations));
app.get("/conversations/:id/messages", asyncHandler(listConversationMessages));
app.post("/conversations/:id/messages", asyncHandler(sendConversationMessage));
app.post("/conversations/:id/claim", asyncHandler(claimConversation));
app.post("/conversations/:id/unclaim", asyncHandler(unclaimConversation));

app.get("/agents", asyncHandler(listAgents));
app.post("/agents", asyncHandler(createAgent));

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error("Unhandled request error", { message: err.message });
  res.status(500).json({ error: "Internal server error" });
});

function asyncHandler<TReq extends Request, TRes extends Response>(
  handler: (req: TReq, res: TRes) => Promise<void>
): (req: TReq, res: TRes, next: NextFunction) => Promise<void> {
  return async (req: TReq, res: TRes, next: NextFunction) => {
    try {
      await handler(req, res);
    } catch (error) {
      next(error);
    }
  };
}

export default app;
