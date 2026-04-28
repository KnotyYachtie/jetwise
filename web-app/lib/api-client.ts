export async function api<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const hasBody = init?.body != null;
  const res = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    try {
      const j = JSON.parse(text) as { error?: string };
      throw new Error(j.error || text || `HTTP ${res.status}`);
    } catch (e) {
      if (e instanceof SyntaxError) {
        throw new Error(text || `HTTP ${res.status}`);
      }
      throw e;
    }
  }
  return res.json() as Promise<T>;
}
