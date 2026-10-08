import { NextResponse } from "next/server";
import { discoverDatabaseSchema } from "@/lib/mcp/postgres";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      host,
      port,
      database,
      username,
      password,
    } = body;

    if (!host || !port || !database || !username || !password) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing database connection information.",
        },
        { status: 400 }
      );
    }

    const result = await discoverDatabaseSchema({
      host,
      port: Number(port),
      database,
      username,
      password,
      ssl: true,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("MCP database discovery error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown MCP connection error.",
      },
      { status: 500 }
    );
  }
}