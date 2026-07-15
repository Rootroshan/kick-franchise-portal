export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function toErrorResponse(err: unknown): Response {
  if (err instanceof HttpError) {
    return Response.json({ error: err.message, code: err.code }, { status: err.status });
  }
  // Never leak internal error details (stack traces, DB errors, secrets) to the browser.
  console.error(err);
  return Response.json({ error: "Internal server error" }, { status: 500 });
}
