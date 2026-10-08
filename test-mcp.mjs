import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const username = "postgres.dvecnkwxuabwxswomwhf";
const password = "123456789/*-chaima";
const host = "aws-1-eu-west-1.pooler.supabase.com";
const port = 6543;
const database = "postgres";

const databaseUrl =
  `postgresql://${encodeURIComponent(username)}:${encodeURIComponent(password)}` +
  `@${host}:${port}/${database}?sslmode=require`;

console.log("Starting MCP...");
console.log("Database URL:");
console.log(
  databaseUrl.replace(
    encodeURIComponent(password),
    "********"
  )
);

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
    DATABASE_URL: databaseUrl,
    ALLOW_WRITES: "0",
    NODE_TLS_REJECT_UNAUTHORIZED: "0",
  },
});

const client = new Client(
  {
    name: "mcp-test",
    version: "1.0.0",
  },
  {
    capabilities: {},
  }
);

try {
  await client.connect(transport);

  console.log("MCP client connected.");

  const result = await client.callTool({
    name: "pg_list_tables",
    arguments: {
      schema: "public",
      includeViews: false,
    },
  });

  console.log("RESULT:");
  console.dir(result, { depth: null });

  await client.close();
  await transport.close();
} catch (error) {
  console.error("MCP TEST FAILED:");
  console.error(error);

  try {
    await client.close();
  } catch {}

  try {
    await transport.close();
  } catch {}
}