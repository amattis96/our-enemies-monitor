import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";
import { createQueryEngine, type QueryEngine } from "../../../src/query/index.ts";
import { callMcpTool, listMcpTools } from "./tools.ts";

export type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: string | number | null | undefined;
  method: string;
  params?: Record<string, unknown> | undefined;
};

export type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

export const MCP_PROTOCOL_VERSION = "2024-11-05";
export const MCP_SERVER_INFO = {
  name: "our-enemies-monitor-mcp",
  version: "0.1.0",
} as const;

export function handleJsonRpcMessage(
  engine: QueryEngine,
  message: unknown,
): JsonRpcResponse | null {
  if (typeof message !== "object" || message === null || !("method" in message)) {
    return {
      jsonrpc: "2.0",
      id: null,
      error: { code: -32600, message: "Invalid JSON-RPC request" },
    };
  }

  const req = message as JsonRpcRequest;
  const id = req.id ?? null;

  // Notifications have no id and require no response.
  if (req.id === undefined && req.method.startsWith("notifications/")) {
    return null;
  }

  switch (req.method) {
    case "initialize":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: MCP_SERVER_INFO,
        },
      };
    case "ping":
      return { jsonrpc: "2.0", id, result: {} };
    case "tools/list":
      return { jsonrpc: "2.0", id, result: { tools: listMcpTools() } };
    case "tools/call": {
      const params = req.params ?? {};
      const name = typeof params.name === "string" ? params.name : "";
      const args = params.arguments ?? {};
      return {
        jsonrpc: "2.0",
        id,
        result: callMcpTool(engine, name, args),
      };
    }
    default:
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `Method not found: ${req.method}` },
      };
  }
}

export function startStdioServer(engine: QueryEngine = createQueryEngine()): void {
  const rl = createInterface({ input: process.stdin, crlfDelay: Number.POSITIVE_INFINITY });

  rl.on("line", (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      const err: JsonRpcResponse = {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error" },
      };
      process.stdout.write(`${JSON.stringify(err)}\n`);
      return;
    }

    const response = handleJsonRpcMessage(engine, parsed);
    if (response !== null) {
      process.stdout.write(`${JSON.stringify(response)}\n`);
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startStdioServer();
}
