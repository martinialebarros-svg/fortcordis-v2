import express, { NextFunction, Request, Response } from "express";
import multer from "multer";
import {
  claimConversation,
  getMessageMedia,
  listConversationMessages,
  listConversations,
  markConversationSeen,
  sendConversationMessage,
  updateConversationStatus,
  unclaimConversation
} from "./controllers/conversationsController";
import { createAgent, listAgents, updateAgent } from "./controllers/agentsController";
import { receiveWebhook, verifyWebhook } from "./controllers/webhookController";
import { getWebhookEventsCleanupRuntimeState } from "./services/webhookEventsCleanupService";
import { logger } from "./utils/logger";
import { requireApiAuth } from "./middleware/auth";
import { sendAgendaReservation } from "./controllers/agendaAutomationController";
import { sendApprovedUtilityTemplate } from "./controllers/templateAutomationController";
import { sendApprovedDocumentTemplate } from "./controllers/documentTemplateAutomationController";
import { listApprovedTemplateCatalog } from "./controllers/templateCatalogController";
import { executeSmokeCleanup, previewSmokeCleanup } from "./controllers/smokeCleanupController";

const app = express();
const uploadAttachment = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 }
});

app.use(
  express.json({
    verify: (req: Request, _res: Response, buf: Buffer) => {
      req.rawBody = Buffer.from(buf);
    }
  })
);

app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    observability: {
      webhookEventsCleanup: getWebhookEventsCleanupRuntimeState()
    }
  });
});

app.get("/webhook", verifyWebhook);
app.post("/webhook", receiveWebhook);

// Conversations/agents are protected: valid app token or internal automation token.
app.use("/conversations", requireApiAuth);
app.use("/agents", requireApiAuth);
app.use("/automation", requireApiAuth);
app.use("/admin", requireApiAuth);

app.get("/conversations", asyncHandler(listConversations));
app.get("/conversations/:id/messages", asyncHandler(listConversationMessages));
app.get("/conversations/:id/messages/:messageId/media", asyncHandler(getMessageMedia));
app.post(
  "/conversations/:id/messages",
  uploadAttachment.single("attachment"),
  asyncHandler(sendConversationMessage)
);
app.patch("/conversations/:id/status", asyncHandler(updateConversationStatus));
app.patch("/conversations/:id/seen", asyncHandler(markConversationSeen));
app.post("/conversations/:id/claim", asyncHandler(claimConversation));
app.post("/conversations/:id/unclaim", asyncHandler(unclaimConversation));

app.get("/agents", asyncHandler(listAgents));
app.post("/agents", asyncHandler(createAgent));
app.patch("/agents/:id", asyncHandler(updateAgent));
app.post("/automation/agenda/reservations", asyncHandler(sendAgendaReservation));
app.get("/automation/templates", asyncHandler(listApprovedTemplateCatalog));
app.post("/automation/templates", asyncHandler(sendApprovedUtilityTemplate));
app.post(
  "/automation/document-templates",
  uploadAttachment.single("document"),
  asyncHandler(sendApprovedDocumentTemplate)
);

app.get("/admin/whatsapp-smoke-cleanup/preview", asyncHandler(previewSmokeCleanup));
app.post("/admin/whatsapp-smoke-cleanup/execute", asyncHandler(executeSmokeCleanup));

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    res.status(err.code === "LIMIT_FILE_SIZE" ? 413 : 422).json({ error: "Invalid file upload." });
    return;
  }
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
