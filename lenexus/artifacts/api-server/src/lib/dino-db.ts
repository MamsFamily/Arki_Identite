import { AsyncLocalStorage } from "node:async_hooks";
import { database, rows as sqliteRows, run as sqliteRun, type Row, HttpError } from "./tribe-store";

type Client = {query: (sql:string,params:unknown[]) => Promise<{rows:Record<string,unknown>[];rowCount:number|null}>};
const current = new AsyncLocalStorage<Client>();
// The only SQLite path is the isolated test harness, never a runtime fallback.
export const sqliteDinoTests = () => process.env.ARKI_DINO_TEST_SQLITE === "1";
async function client(): Promise<Client> {
  const selected = current.getStore();
  if (selected) return selected;
  if (!process.env.DATABASE_URL) throw new HttpError(503,"Le stockage durable des dinos n'est pas configuré.");
  return (await import("@workspace/db")).pool;
}
function pgSql(sql:string) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}
export async function dinoRows(sql:string,...params:(string|number|null)[]):Promise<Row[]> {
  if (sqliteDinoTests()) return sqliteRows(sql,...params);
  return (await (await client()).query(pgSql(sql),params)).rows as Row[];
}
export async function dinoRun(sql:string,...params:(string|number|null)[]) {
  if (sqliteDinoTests()) {
    const result = sqliteRun(sql,...params);
    return {changes:Number(result.changes),lastInsertRowid:Number(result.lastInsertRowid)};
  }
  const insert = /^\s*INSERT INTO site_dino_(?:species|history)/i.test(sql);
  const result = await (await client()).query(pgSql(sql)+(insert?" RETURNING id":""),params);
  return {changes:result.rowCount || 0,lastInsertRowid:Number(result.rows[0]?.id || 0)};
}
export async function dinoTransaction<T>(key:string,callback:()=>Promise<T>):Promise<T> {
  if (sqliteDinoTests()) {
    database().exec("BEGIN IMMEDIATE");
    try {const value=await callback();database().exec("COMMIT");return value;}
    catch(e){database().exec("ROLLBACK");throw e;}
  }
  const pool = (await import("@workspace/db")).pool;
  const connection = await pool.connect();
  try {
    await connection.query("BEGIN");
    // Serializes even new or deleted records; revision checks cannot race.
    await connection.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[key]);
    const value = await current.run(connection,callback);
    await connection.query("COMMIT"); return value;
  } catch(error) {await connection.query("ROLLBACK");throw error;}
  finally {connection.release();}
}