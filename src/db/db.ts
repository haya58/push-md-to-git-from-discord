import Database from "better-sqlite3";
import { CREATE_POST_REQUESTS_TABLE } from "./schema.js";

export type Db = Database.Database;

export function initDb(databasePath: string): Db {
  const db = new Database(databasePath);
  db.pragma("journal_mode = WAL");
  db.exec(CREATE_POST_REQUESTS_TABLE);
  return db;
}
