/** The server answered, and not with success. */
export class HttpError extends Error {
  readonly status: number;
  readonly url: string;
  /** The server's own `error` or `message`, when it sent JSON carrying one. */
  readonly serverMessage: string | undefined;

  constructor(url: string, status: number, statusText: string, serverMessage?: string) {
    super(`${url} responded ${status} ${statusText}`.trim());
    this.name = "HttpError";
    this.status = status;
    this.url = url;
    this.serverMessage = serverMessage;
  }
}

/** The request never got an answer: offline, DNS, TLS, reset, or timed out. */
export class NetworkError extends Error {
  readonly timedOut: boolean;

  constructor(url: string, timedOut: boolean, cause: unknown) {
    super(timedOut ? `${url} did not answer in time` : `${url} could not be reached`, { cause });
    this.name = "NetworkError";
    this.timedOut = timedOut;
  }
}

export interface RequestOptions {
  method?: "POST" | "DELETE";
  body?: unknown;
  timeoutMs: number;
  /** Lets the request outlive a WebView reload, for telemetry sent just before one. */
  keepalive?: boolean;
}

async function serverMessage(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.json()) as { error?: unknown; message?: unknown };
    const message = body.error ?? body.message;
    return typeof message === "string" ? message : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Sends JSON and parses a JSON answer.
 *
 * @throws {HttpError} on a non-2xx status.
 * @throws {NetworkError} when no answer arrived within `timeoutMs`.
 */
export async function requestJson<T>(url: string, options: RequestOptions): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    let response: Response;
    let text: string;
    try {
      response = await fetch(url, {
        method: options.method ?? "POST",
        headers: { "Content-Type": "application/json" },
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
        ...(options.keepalive ? { keepalive: true } : {}),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new HttpError(
          url,
          response.status,
          response.statusText,
          await serverMessage(response),
        );
      }

      text = await response.text();
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new NetworkError(url, controller.signal.aborted, error);
    }

    return (text ? JSON.parse(text) : {}) as T;
  } finally {
    clearTimeout(timer);
  }
}
