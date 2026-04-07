import axios, { AxiosError } from "axios";
import { logger } from "../utils/logger";

const GRAPH_API_BASE_URL = "https://graph.facebook.com/v17.0";
const DEFAULT_TIMEOUT_MS = 10000;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetry(error: AxiosError): boolean {
  if (error.code === "ECONNABORTED" || !error.response) {
    return true;
  }

  return error.response.status >= 500;
}

interface SendTextMessageParams {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  body: string;
  type?: string;
}

interface GraphMessageResponse {
  messaging_product: string;
  contacts?: Array<{ input: string; wa_id: string }>;
  messages?: Array<{ id: string }>;
}

export async function sendWhatsAppMessageWithRetry(
  params: SendTextMessageParams
): Promise<GraphMessageResponse> {
  const { phoneNumberId, accessToken, to, body, type = "text" } = params;

  if (type !== "text") {
    throw new Error(`Message type '${type}' is not supported yet. Use 'text'.`);
  }

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: {
      body
    }
  };

  const url = `${GRAPH_API_BASE_URL}/${phoneNumberId}/messages`;
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await axios.post<GraphMessageResponse>(url, payload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        timeout: DEFAULT_TIMEOUT_MS
      });

      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;

      if (attempt >= maxAttempts || !shouldRetry(axiosError)) {
        throw error;
      }

      const backoffMs = 300 * 2 ** (attempt - 1);
      logger.warn("Retrying Graph API request", {
        attempt,
        nextWaitMs: backoffMs,
        status: axiosError.response?.status,
        code: axiosError.code
      });

      await wait(backoffMs);
    }
  }

  throw new Error("Unexpected WhatsApp Graph API retry flow termination");
}
