import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { DatabaseConnectionConfig } from "./types";

export async function createPostgresMcpClient(
  config: DatabaseConnectionConfig
) {
  const databaseUrl = buildDatabaseUrl(config);

  console.log("[MCP] Starting PostgreSQL MCP");
  console.log("[MCP] Host:", config.host);
  console.log("[MCP] Port:", config.port);
  console.log("[MCP] Database:", config.database);
  console.log("[MCP] User:", config.username);

  const transport = new StdioClientTransport({
    command: process.platform === "win32" ? "cmd.exe" : "npx",

    args:
      process.platform === "win32"
        ? [
            "/c",
            "npx",
            "-y",
            "@yawlabs/postgres-mcp@0.13.6",
          ]
        : [
            "-y",
            "@yawlabs/postgres-mcp@0.13.6",
          ],

    env: {
      ...process.env,

      // PostgreSQL connection used by the MCP server.
      DATABASE_URL: databaseUrl,

      // Keep the MCP read-only.
      ALLOW_WRITES: "0",

      // Supabase/managed PostgreSQL can use a certificate
      // chain that Node's default trust store does not recognize.
      //
      // This keeps the connection encrypted with TLS while
      // disabling certificate-chain verification ONLY inside
      // the PostgreSQL MCP process.
      POSTGRES_SSL_REJECT_UNAUTHORIZED: "false",
    },
  });

  const client = new Client(
    {
      name: "marketing-intelligence-platform",
      version: "1.0.0",
    },
    {
      capabilities: {},
    }
  );

  try {
    await client.connect(transport);

    console.log("[MCP] Connected successfully");

    return {
      client,
      transport,
    };
  } catch (error) {
    await transport.close().catch(() => undefined);

    console.error("[MCP] Connection failed:", error);

    throw new Error(
      `Failed to connect to PostgreSQL MCP: ${
        error instanceof Error
          ? error.message
          : String(error)
      }`
    );
  }
}

function buildDatabaseUrl(
  config: DatabaseConnectionConfig
): string {
  const username = encodeURIComponent(config.username);
  const password = encodeURIComponent(config.password);
  const host = config.host;

  const baseUrl =
    `postgresql://${username}:${password}` +
    `@${host}:${config.port}/${config.database}`;

  // The MCP package explicitly supports managed PostgreSQL
  // connections with TLS.
  //
  // Certificate verification is controlled by:
  // POSTGRES_SSL_REJECT_UNAUTHORIZED=false
  //
  // Keep TLS enabled.
  return `${baseUrl}?sslmode=require`;
}