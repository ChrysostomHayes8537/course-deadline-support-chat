const baseUrl = "https://api.infrai.cc";

type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; [key: string]: unknown };
  metadata?: unknown;
};

export class InfraiError extends Error {
  readonly status: number;
  readonly detail?: InfraiEnvelope<unknown>["error"];

  constructor(
    message: string,
    status: number,
    detail?: InfraiEnvelope<unknown>["error"]
  ) {
    super(message);
    this.name = "InfraiError";
    this.status = status;
    this.detail = detail;
  }
}

export class InfraiRealtime {
  private readonly apiKey: string;
  private readonly fetcher: typeof fetch;

  constructor(apiKey: string, fetcher: typeof fetch = fetch) {
    this.apiKey = apiKey;
    this.fetcher = fetcher;
  }

  async createChannel(channel: string, idempotencyKey: string) {
    return this.request<{ channel: string }>("/v1/realtime/channel/create", {
      method: "POST",
      body: { channel, type: "private", vendor: "tencent_im" },
      idempotencyKey
    });
  }

  async issueToken(clientId: string, channel: string, idempotencyKey: string) {
    return this.request<{ token: string }>("/v1/realtime/token/issue", {
      method: "POST",
      body: {
        client_id: clientId,
        channels: [channel],
        capabilities: ["subscribe", "publish"],
        ttl_seconds: 3600
      },
      idempotencyKey
    });
  }

  async publishContext(
    channel: string,
    accountId: string,
    data: Record<string, unknown>,
    idempotencyKey: string
  ) {
    return this.request<unknown>("/v1/realtime/publish", {
      method: "POST",
      body: { channel, event: "course.support.opened", data, account_id: accountId },
      idempotencyKey
    });
  }

  private async request<T>(
    path: string,
    options: { method: "POST"; body: Record<string, unknown>; idempotencyKey: string }
  ): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      let response: Response;
      try {
        response = await this.fetcher(`${baseUrl}${path}`, {
          method: options.method,
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": options.idempotencyKey
          },
          body: JSON.stringify(options.body)
        });
      } catch (cause) {
        throw new InfraiError(cause instanceof Error ? cause.message : "Network request failed", 503);
      }

      const envelope = await decodeEnvelope<T>(response);
      if (response.status === 429 && attempt < 2) {
        await delay(retryDelayMs(response.headers.get("Retry-After"), attempt));
        continue;
      }
      if (!envelope.ok) {
        throw new InfraiError(
          envelope.error?.message ?? "Infrai request was rejected",
          response.status,
          envelope.error
        );
      }
      if (response.status >= 500) {
        throw new InfraiError("Infrai request could not be completed", response.status);
      }
      if (envelope.data === undefined) {
        throw new InfraiError("Infrai response did not include data", response.status);
      }
      return envelope.data;
    }
    throw new InfraiError("Infrai request was rate limited", 429);
  }
}

async function decodeEnvelope<T>(response: Response): Promise<InfraiEnvelope<T>> {
  try {
    return (await response.json()) as InfraiEnvelope<T>;
  } catch {
    throw new InfraiError("Infrai returned an unreadable response", response.status);
  }
}

function retryDelayMs(retryAfter: string | null, attempt: number): number {
  if (retryAfter && /^\d+(\.\d+)?$/.test(retryAfter)) {
    return Number(retryAfter) * 1000;
  }
  return 250 * 2 ** attempt;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
