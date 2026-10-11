import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { discoverPostgresSchema } from "@/lib/database/postgres";
import { encrypt } from "@/lib/database/crypto";

export async function POST(request: Request) {
  let connectionId: string | null = null;

  try {
    // ---------------------------------------------------------
    // 1. Authenticate user
    // ---------------------------------------------------------
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: "You must be signed in.",
        },
        { status: 401 }
      );
    }

    // ---------------------------------------------------------
    // 2. Server-only admin client
    // ---------------------------------------------------------
    const admin = createAdminClient();

    // ---------------------------------------------------------
    // 3. Read request
    // ---------------------------------------------------------
    let body: Record<string, unknown>;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid JSON request body.",
        },
        { status: 400 }
      );
    }

    const {
      name,
      databaseType,
      host,
      port,
      databaseName,
      username,
      password,
    } = body;

    // ---------------------------------------------------------
    // 4. Validate input
    // ---------------------------------------------------------
    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof host !== "string" ||
      !host.trim() ||
      port === undefined ||
      port === null ||
      typeof databaseName !== "string" ||
      !databaseName.trim() ||
      typeof username !== "string" ||
      !username.trim() ||
      typeof password !== "string" ||
      !password
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Please complete all database connection fields.",
        },
        { status: 400 }
      );
    }

    const parsedPort = Number(port);

    if (
      !Number.isInteger(parsedPort) ||
      parsedPort < 1 ||
      parsedPort > 65535
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid database port.",
        },
        { status: 400 }
      );
    }

    const normalizedDatabaseType =
      typeof databaseType === "string" && databaseType.trim()
        ? databaseType.trim().toLowerCase()
        : "postgresql";

    if (normalizedDatabaseType !== "postgresql") {
      return NextResponse.json(
        {
          success: false,
          error: "Only PostgreSQL databases are currently supported.",
        },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------
    // 5. Find user's brand
    // ---------------------------------------------------------
    const { data: brand, error: brandError } = await admin
      .from("brands")
      .select("id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (brandError || !brand) {
      console.error("[DATA CONNECTION] Brand lookup error:", brandError);

      return NextResponse.json(
        {
          success: false,
          error: "Brand not found for this account.",
        },
        { status: 404 }
      );
    }

    // ---------------------------------------------------------
    // 6. Connect to external PostgreSQL database
    //    and discover schema
    // ---------------------------------------------------------
    const connectionConfig = {
      host: host.trim(),
      port: parsedPort,
      database: databaseName.trim(),
      username: username.trim(),
      password,
      ssl: true,
    };

    console.log("[DATA CONNECTION] Starting database discovery:", {
      host: connectionConfig.host,
      port: connectionConfig.port,
      database: connectionConfig.database,
      username: connectionConfig.username,
    });

    const result = await discoverPostgresSchema(connectionConfig);

    // ---------------------------------------------------------
    // 7. Log discovered schema
    // ---------------------------------------------------------
    console.log(
      "[DISCOVERY] Tables discovered:",
      result.tables.length
    );

    console.log(
      "[DISCOVERY] Table names:",
      result.tables.map(
        ({ table }) => `${table.schema}.${table.name}`
      )
    );

    // ---------------------------------------------------------
    // 8. Handle zero discovered tables
    // ---------------------------------------------------------
    if (result.tables.length === 0) {
      console.warn(
        "[DISCOVERY] Database connection succeeded, but no accessible tables were found."
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "The database connection succeeded, but no accessible tables were found in the public schema. Please verify that the database contains tables and that the provided user has permission to access them.",
        },
        { status: 422 }
      );
    }

    // ---------------------------------------------------------
    // 9. Convert discovered schema into temporary JSON
    //
    // IMPORTANT:
    // These are NOT selected tables yet.
    //
    // They are temporary discovery results used by Step 10.
    //
    // data_connection_tables will only contain tables selected
    // by the user in Step 10.
    // ---------------------------------------------------------
    const discoveredTables = result.tables.map(
      ({ table, columns }) => ({
        table_schema: table.schema,
        table_name: table.name,
        table_type: table.type,
        description: null,

        columns: columns.map((column) => ({
          name: column.name,
          data_type: column.dataType,
          is_nullable: column.nullable,
          is_primary_key: column.isPrimaryKey ?? false,
        })),
      })
    );

    console.log(
      "[DISCOVERY] Prepared temporary schema:",
      JSON.stringify(
        discoveredTables.map((table) => ({
          schema: table.table_schema,
          table: table.table_name,
          columns: table.columns.length,
        })),
        null,
        2
      )
    );

    // ---------------------------------------------------------
    // 10. Save connection metadata
    //
    // IMPORTANT:
    // The database password is NOT stored here.
    //
    // credential_secret_id is reserved for secure credential
    // storage that we can implement later.
    //
    // discovered_tables temporarily stores the schema discovered
    // during onboarding.
    // ---------------------------------------------------------
    const { data: connection, error: connectionError } = await admin
      .from("data_connections")
      .insert({
        user_id: user.id,
        brand_id: brand.id,
        name: name.trim(),
        database_type: normalizedDatabaseType,
        host: host.trim(),
        port: parsedPort,
        database_name: databaseName.trim(),
        username: username.trim(),
        credential_secret_id: null,

        status: "connected",
        last_tested_at: new Date().toISOString(),
        error_message: null,

        // Temporary onboarding discovery result.
        discovered_tables: discoveredTables,
      })
      .select("id")
      .single();

    if (connectionError || !connection) {
      console.error(
        "[DATA CONNECTION] Connection insert error:",
        connectionError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Database connected, but the connection could not be saved.",
        },
        { status: 500 }
      );
    }

    await admin.from("data_connection_secrets").upsert({
      connection_id: connection.id,
      admin_secret: encrypt(password),
      admin_expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    });

    console.log(
      "[DATA CONNECTION] Connection saved:",
      connection.id
    );

    // ---------------------------------------------------------
    // IMPORTANT:
    //
    // DO NOT insert into:
    //   data_connection_tables
    //
    // DO NOT insert into:
    //   data_connection_columns
    //
    // Those tables represent the user's SELECTED/ALLOWED
    // business data, which will be created in Step 10.
    // ---------------------------------------------------------

    // ---------------------------------------------------------
    // 11. Update onboarding progress
    // ---------------------------------------------------------
    const { error: profileError } = await admin
      .from("profiles")
      .update({
        onboarding_step: 10,
      })
      .eq("id", user.id);

    if (profileError) {
      console.error(
        "[DATA CONNECTION] Profile update error:",
        profileError
      );

      // We don't fail the whole database connection because the
      // actual connection/discovery has already succeeded.
    }

    // ---------------------------------------------------------
    // 12. Success
    // ---------------------------------------------------------
    return NextResponse.json({
      success: true,
      connectionId: connection.id,
      tableCount: result.tables.length,
      message:
        "Database connected and schema discovered successfully.",
    });
  } catch (error) {
    console.error("[DATA CONNECTION] Error:", error);

    // ---------------------------------------------------------
    // Cleanup incomplete connection
    // ---------------------------------------------------------
    if (connectionId) {
      try {
        const admin = createAdminClient();

        await admin
          .from("data_connections")
          .delete()
          .eq("id", connectionId);

        console.log(
          "[DATA CONNECTION] Incomplete connection cleaned up:",
          connectionId
        );
      } catch (cleanupError) {
        console.error(
          "[DATA CONNECTION] Cleanup error:",
          cleanupError
        );
      }
    }

    // ---------------------------------------------------------
    // Return useful error to frontend
    // ---------------------------------------------------------
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Unable to connect to the database.";

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}