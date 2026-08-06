import { logger } from "./logger";

function pathnameFrom(req: Request): string {
  try {
    return new URL(req.url).pathname;
  } catch {
    return req.url;
  }
}

function searchFrom(req: Request): string | undefined {
  try {
    return new URL(req.url).search || undefined;
  } catch {
    return undefined;
  }
}

export function logRequest(req: Request, context?: string) {
  const pathname = pathnameFrom(req);
  logger.info(
    {
      method: req.method,
      url: pathname,
      search: searchFrom(req),
      context,
    },
    `${req.method} ${pathname}`
  );
}

export function logError(error: unknown, context?: string) {
  logger.error({ err: error, context }, context || "Unhandled error");
}
