import {
  createPostgresMcpClient,
} from "./client";

import type {
  DatabaseConnectionConfig,
  DiscoveredTable,
  DiscoveredColumn,
  DatabaseSchema,
} from "./types";

export async function discoverDatabaseSchema(
  config: DatabaseConnectionConfig
): Promise<DatabaseSchema> {
  const { client, transport } =
    await createPostgresMcpClient(config);

  try {
    console.log("[MCP] Discovering database tables...");

    const tables = await listTables(client);

    console.log(
      `[MCP] Found ${tables.length} tables`
    );

    const tablesWithColumns = [];

    for (const table of tables) {
      console.log(
        `[MCP] Describing ${table.schema}.${table.name}`
      );

      const description = await describeTable(
        client,
        table.schema,
        table.name
      );

      tablesWithColumns.push({
        table,
        columns: description.columns,
      });
    }

    return {
      tables: tablesWithColumns,
    };
  } finally {
    await client.close().catch(() => undefined);
    await transport.close().catch(() => undefined);

    console.log("[MCP] Connection closed");
  }
}

async function listTables(
  client: any
): Promise<DiscoveredTable[]> {
  const result = await client.callTool({
    name: "pg_list_tables",
    arguments: {
      schema: "public",
      includeViews: false,
    },
  });

  return extractTables(result);
}

async function describeTable(
  client: any,
  schema: string,
  table: string
): Promise<{
  columns: DiscoveredColumn[];
}> {
  const result = await client.callTool({
    name: "pg_describe_table",
    arguments: {
      schema,
      table,
    },
  });

  const data = extractStructuredData(result);

  return {
    columns: Array.isArray(data?.columns)
      ? data.columns
      : [],
  };
}

/**
 * Extract the actual structured payload returned by MCP.
 *
 * Supports:
 *
 * 1. result.structuredContent
 *
 * 2. JSON stored in result.content[].text
 *
 * This makes the application compatible with both
 * response styles exposed by MCP tools.
 */
function extractStructuredData(result: any): any {
  if (!result) {
    throw new Error(
      "MCP returned an empty response."
    );
  }

  // Preferred MCP structured response.
  if (result.structuredContent) {
    return result.structuredContent;
  }

  // Fallback: JSON encoded inside text content.
  if (Array.isArray(result.content)) {
    const textContent = result.content.find(
      (item: any) =>
        item?.type === "text" &&
        typeof item?.text === "string"
    );

    if (textContent?.text) {
      try {
        return JSON.parse(textContent.text);
      } catch {
        throw new Error(
          `Unable to parse MCP text response: ${textContent.text}`
        );
      }
    }
  }

  throw new Error(
    "MCP returned no structured data or JSON text content."
  );
}

function extractTables(
  result: any
): DiscoveredTable[] {
  const data = extractStructuredData(result);

  /**
   * Your working MCP test showed:
   *
   * structuredContent: {
   *   rows: [...]
   * }
   *
   * Therefore pg_list_tables is normalized from rows.
   */
  if (Array.isArray(data?.rows)) {
    return data.rows.map(normalizeTable);
  }

  /**
   * Also support a direct array in case the MCP
   * response changes or another version is used.
   */
  if (Array.isArray(data)) {
    return data.map(normalizeTable);
  }

  /**
   * Finally support a { tables: [...] } shape.
   */
  if (Array.isArray(data?.tables)) {
    return data.tables.map(normalizeTable);
  }

  throw new Error(
    `Unexpected pg_list_tables response: ${JSON.stringify(data)}`
  );
}

function normalizeTable(
  row: any
): DiscoveredTable {
  return {
    schema:
      row.schema ??
      row.table_schema ??
      "public",

    name:
      row.name ??
      row.table_name,

    type:
      row.type ??
      row.table_type ??
      "table",

    estimatedRowCount:
      row.estimatedRowCount ??
      row.estimated_row_count ??
      null,
  };
}