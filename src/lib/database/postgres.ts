import { Client } from "pg";

export type PostgresConnectionConfig = {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
};

export type DiscoveredColumn = {
  name: string;
  dataType: string;
  nullable: boolean;
  defaultValue: string | null;
  isPrimaryKey: boolean;
};

export type DiscoveredTable = {
  schema: string;
  name: string;
  type: string;
  estimatedRowCount?: number | null;
};

export type DiscoveredTableWithColumns = {
  table: DiscoveredTable;
  columns: DiscoveredColumn[];
};

export type DatabaseSchema = {
  tables: DiscoveredTableWithColumns[];
};

/**
 * Creates a PostgreSQL client for the external business database.
 */
function createClient(config: PostgresConnectionConfig) {
  return new Client({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.username,
    password: config.password,

    ssl:
      config.ssl === false
        ? false
        : {
            rejectUnauthorized: false,
          },
  });
}

/**
 * Test the PostgreSQL connection.
 */
export async function testPostgresConnection(
  config: PostgresConnectionConfig
): Promise<void> {
  const client = createClient(config);

  try {
    await client.connect();
    await client.query("SELECT 1");
  } finally {
    await client.end().catch(() => undefined);
  }
}

/**
 * Discover tables and columns from the PostgreSQL database.
 */
export async function discoverPostgresSchema(
  config: PostgresConnectionConfig
): Promise<DatabaseSchema> {
  const client = createClient(config);

  try {
    await client.connect();

    // ---------------------------------------------------------
    // 1. Discover application/business tables
    // ---------------------------------------------------------
    //
    // For the first version, only discover the public schema.
    // This avoids Supabase internal schemas such as:
    // auth, storage, realtime, vault, etc.
    //
    // ---------------------------------------------------------
    const tablesResult = await client.query(`
      SELECT
        table_schema,
        table_name,
        table_type
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type IN (
          'BASE TABLE',
          'VIEW'
        )
      ORDER BY table_schema, table_name
    `);

    const tables: DiscoveredTableWithColumns[] = [];

    // ---------------------------------------------------------
    // 2. Discover columns for each table
    // ---------------------------------------------------------
    for (const row of tablesResult.rows) {
      const columnsResult = await client.query(
        `
        SELECT
          c.column_name,
          c.data_type,
          c.is_nullable,
          c.column_default,

          CASE
            WHEN EXISTS (
              SELECT 1
              FROM information_schema.table_constraints tc
              JOIN information_schema.key_column_usage kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
                AND tc.table_name = kcu.table_name
              WHERE tc.constraint_type = 'PRIMARY KEY'
                AND kcu.table_schema = c.table_schema
                AND kcu.table_name = c.table_name
                AND kcu.column_name = c.column_name
            )
            THEN true
            ELSE false
          END AS is_primary_key

        FROM information_schema.columns c

        WHERE c.table_schema = $1
          AND c.table_name = $2

        ORDER BY c.ordinal_position
        `,
        [row.table_schema, row.table_name]
      );

      const table: DiscoveredTable = {
        schema: row.table_schema,
        name: row.table_name,
        type: row.table_type,
        estimatedRowCount: null,
      };

      const columns: DiscoveredColumn[] =
        columnsResult.rows.map((column) => ({
          name: column.column_name,
          dataType: column.data_type,
          nullable: column.is_nullable === "YES",
          defaultValue: column.column_default ?? null,
          isPrimaryKey: Boolean(column.is_primary_key),
        }));

      tables.push({
        table,
        columns,
      });
    }

    return {
      tables,
    };
  } finally {
    await client.end().catch(() => undefined);
  }
}