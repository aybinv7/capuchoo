/**
 * The few Capuchoo MCP calls the harness needs, over the stateless endpoint with an API key. The
 * key comes from the environment and is never logged or written to results.
 */
export interface McpClient {
  call<T = unknown>(tool: string, args: Record<string, unknown>): Promise<T>;
}

export function createMcpClient(endpoint: string, apiKey: string): McpClient {
  let id = 0;
  return {
    async call<T>(tool: string, args: Record<string, unknown>) {
      id += 1;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id,
          method: "tools/call",
          params: { name: tool, arguments: args },
        }),
      });
      if (!response.ok) throw new Error(`${tool}: the server answered ${response.status}`);
      const body = (await response.json()) as {
        result?: { content: Array<{ text: string }>; isError?: boolean };
        error?: { message: string };
      };
      if (body.error) throw new Error(`${tool}: ${body.error.message}`);
      const text = body.result?.content[0]?.text ?? "null";
      const data = JSON.parse(text) as T & { error?: string };
      if (body.result?.isError) throw new Error(`${tool}: ${data.error ?? text}`);
      return data;
    },
  };
}
