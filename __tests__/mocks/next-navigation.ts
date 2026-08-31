export const mockPush = jest.fn();
export const mockRefresh = jest.fn();
export const mockAssign = jest.fn();

export function mockSearchParams(params: Record<string, string> = {}) {
  return {
    get: (key: string) => params[key] ?? null,
    toString: () => new URLSearchParams(params).toString(),
  };
}
