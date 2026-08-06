/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Even if tests call route handlers directly, Next.js APIs like `NextResponse`
 * may be imported; they work under Vitest's node environment. These helpers
 * avoid Next internals flakiness by using standard `Response` objects.
 */

export function jsonRequest(
  input: string,
  body: unknown,
  options: { method?: string } = {}
): Request {
  return new Request(input, {
    method: options.method ?? "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function emptyRequest(input: string, options: RequestInit = {}): Request {
  return new Request(input, options);
}

/** Capture a NextResponse/NormalizedResponse -> JSON payload. */
export async function readJson(res: Response): Promise<any> {
  return res.json();
}

export function statusOf(res: Response): number {
  return res.status;
}