import type { ZodType } from "zod";
import { HttpError, toErrorResponse } from "@/server/modules/identity/errors";

/** Parses and validates a JSON request body against a Zod schema. Throws a typed 400 on failure. */
export async function parseJsonBody<Output>(req: Request, schema: ZodType<Output, any, any>): Promise<Output> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new HttpError(400, `Validation failed: ${result.error.issues.map((i) => i.message).join(", ")}`, "VALIDATION_ERROR");
  }
  return result.data;
}

export function parseSearchParams<Output>(url: string, schema: ZodType<Output, any, any>): Output {
  const { searchParams } = new URL(url);
  const obj = Object.fromEntries(searchParams.entries());
  const result = schema.safeParse(obj);
  if (!result.success) {
    throw new HttpError(400, `Invalid query params: ${result.error.issues.map((i) => i.message).join(", ")}`, "VALIDATION_ERROR");
  }
  return result.data;
}

/** Wraps a route handler body so any thrown HttpError (or unexpected error) becomes a safe typed response. */
export function withErrorHandling(fn: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    try {
      return await fn(req);
    } catch (err) {
      return toErrorResponse(err);
    }
  };
}

export { HttpError };
