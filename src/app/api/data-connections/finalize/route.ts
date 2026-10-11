import { NextResponse } from "next/server";
import { Client } from "pg";
import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encrypt, decrypt } from "@/lib/database/crypto";

type SelTable = {
  schema: string; name: string; description: string;
  columns: { name: string; selected: boolean; description?: string }[];
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { connectionId, tables } = (await request.json()) as
    { connectionId: string; tables: SelTable[] };
  const admin = createAdminClient();

  // 1. The connection must belong to this user
  const { data: conn } = await admin.from("data_connections")
    .select("*").eq("id", connectionId).eq("user_id", user.id).single();
  if (!conn) return NextResponse.json({ error: "Connection not found." }, { status: 404 });

  const { data: sec } = await admin.from("data_connection_secrets")
    .select("*").eq("connection_id", connectionId).single();
  if (!sec?.admin_secret || new Date(sec.admin_expires_at) < new Date())
    return NextResponse.json(
      { error: "Setup session expired. Please reconnect your database." }, { status: 410 });

  // 2. Validate selection against what was really discovered
  const discovered = conn.discovered_tables as any[];
  const grants: SelTable[] = [];
  for (const t of tables) {
    const real = discovered.find(d => d.table_schema === t.schema && d.table_name === t.name);
    if (!real) return NextResponse.json({ error: `Unknown table ${t.name}` }, { status: 400 });
    const realCols = new Set(real.columns.map((c: any) => c.name));
    const cols = t.columns.filter(c => c.selected && realCols.has(c.name));
    if (cols.length === 0)
      return NextResponse.json({ error: `Select at least one column in ${t.name}` }, { status: 400 });
    grants.push({ ...t, columns: cols });
  }

  // 3. Create the read-only role (one transaction)
  const roleName = `agent_${conn.brand_id.replace(/-/g, "").slice(0, 12)}`;
  const rolePassword = crypto.randomBytes(32).toString("base64url");

  const db = new Client({
    host: conn.host, port: conn.port, database: conn.database_name,
    user: conn.username, password: decrypt(sec.admin_secret),
    ssl: { rejectUnauthorized: false },
  });
  await db.connect();
  try {
    const q = (s: string) => db.escapeIdentifier(s);
    const exists = await db.query("select 1 from pg_roles where rolname = $1", [roleName]);

    await db.query("BEGIN");
    if (exists.rowCount) {
      await db.query(`ALTER ROLE ${q(roleName)} LOGIN PASSWORD ${db.escapeLiteral(rolePassword)}`);
      // re-running setup: start from zero permissions
      for (const s of new Set(grants.map(g => g.schema)))
        await db.query(`REVOKE ALL ON ALL TABLES IN SCHEMA ${q(s)} FROM ${q(roleName)}`);
    } else {
      await db.query(`CREATE ROLE ${q(roleName)} LOGIN PASSWORD ${db.escapeLiteral(rolePassword)}`);
    }
    await db.query(`ALTER ROLE ${q(roleName)} SET statement_timeout = '10s'`);
    await db.query(`ALTER ROLE ${q(roleName)} SET default_transaction_read_only = on`);
    await db.query(`ALTER ROLE ${q(roleName)} CONNECTION LIMIT 5`);

    for (const s of new Set(grants.map(g => g.schema))) {
      await db.query(`GRANT USAGE ON SCHEMA ${q(s)} TO ${q(roleName)}`);
      await db.query(`REVOKE CREATE ON SCHEMA ${q(s)} FROM ${q(roleName)}`);
    }
    for (const g of grants) {
      const cols = g.columns.map(c => q(c.name)).join(", ");
      await db.query(`GRANT SELECT (${cols}) ON ${q(g.schema)}.${q(g.name)} TO ${q(roleName)}`);

      // If Row Level Security is on, the role would silently see 0 rows
      const rls = await db.query(
        `select c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
         where n.nspname=$1 and c.relname=$2`, [g.schema, g.name]);
      if (rls.rows[0]?.relrowsecurity) {
        const pol = `${roleName}_read`;
        await db.query(`DROP POLICY IF EXISTS ${q(pol)} ON ${q(g.schema)}.${q(g.name)}`);
        await db.query(
          `CREATE POLICY ${q(pol)} ON ${q(g.schema)}.${q(g.name)} FOR SELECT TO ${q(roleName)} USING (true)`);
      }
    }
    await db.query("COMMIT");
  } catch (e) {
    await db.query("ROLLBACK").catch(() => {});
    console.error("[FINALIZE] role setup failed:", (e as Error).message);
    return NextResponse.json(
      { error: "Could not create the read-only access. Check that the connected user can create roles." },
      { status: 500 });
  } finally {
    await db.end();
  }

  // 4. Store the agent credentials, wipe the admin password
  await admin.from("data_connection_secrets").update({
    agent_username: roleName,
    agent_secret: encrypt(rolePassword),
    agent_ready_at: new Date().toISOString(),
    admin_secret: null,
    admin_expires_at: null,
  }).eq("connection_id", connectionId);

  // 5. Save tables and columns (descriptions) server-side
  await admin.from("data_connection_tables").delete().eq("connection_id", connectionId);
  const { data: inserted, error: tErr } = await admin.from("data_connection_tables")
    .insert(grants.map(g => ({
      connection_id: connectionId, table_schema: g.schema, table_name: g.name,
      description: g.description.trim(), enabled: true,
    }))).select("id, table_schema, table_name");
  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });

  for (const row of inserted!) {
    const g = grants.find(x => x.schema === row.table_schema && x.name === row.table_name)!;
    const real = discovered.find(d => d.table_schema === g.schema && d.table_name === g.name);
    const byName = new Map(real.columns.map((c: any) => [c.name, c]));
    await admin.from("data_connection_columns").insert(
      g.columns.map(c => {
        const rc: any = byName.get(c.name);
        return {
          table_id: row.id, column_name: c.name, data_type: rc.data_type,
          is_nullable: rc.is_nullable, is_primary_key: rc.is_primary_key,
          description: c.description?.trim() || null, selected: true,
        };
      }));
  }

  await admin.from("data_connections").update({ discovered_tables: null }).eq("id", connectionId);
  await admin.from("profiles").update({ onboarding_step: 11 }).eq("id", user.id);

  return NextResponse.json({ success: true });
}