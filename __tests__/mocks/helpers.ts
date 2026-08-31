export function jsonRequest(url: string, body?: unknown, method = "POST"): Request {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export function getRequest(url: string): Request {
  return new Request(url, { method: "GET" });
}

export async function parseJson<T = Record<string, unknown>>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

export function mockAuthSession(user: {
  id: string;
  role?: "USER" | "ADMIN";
  email?: string;
  name?: string;
}) {
  return {
    user: {
      id: user.id,
      role: user.role ?? "USER",
      email: user.email ?? "user@example.com",
      name: user.name ?? "Test User",
    },
    expires: new Date(Date.now() + 3600_000).toISOString(),
  };
}

export function apiBody<T extends Record<string, unknown>>(body: Record<string, unknown>): T {
  return body as T;
}
