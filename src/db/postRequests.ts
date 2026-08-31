import type { Db } from "./db.js";
import type { PostRequest, PostRequestStatus } from "../domain/post.js";

type PostRequestRow = {
  id: string;
  discord_user_id: string;
  discord_channel_id: string;
  discord_message_id: string | null;
  title: string;
  body: string;
  slug: string;
  file_path: string;
  branch_name: string;
  pull_number: number;
  pull_url: string;
  status: string;
  created_at: string;
  updated_at: string;
};

function rowToPostRequest(row: PostRequestRow): PostRequest {
  return {
    id: row.id,
    discordUserId: row.discord_user_id,
    discordChannelId: row.discord_channel_id,
    discordMessageId: row.discord_message_id,
    title: row.title,
    body: row.body,
    slug: row.slug,
    filePath: row.file_path,
    branchName: row.branch_name,
    pullNumber: row.pull_number,
    pullUrl: row.pull_url,
    status: row.status as PostRequestStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type CreatePostRequestInput = {
  id: string;
  discordUserId: string;
  discordChannelId: string;
  title: string;
  body: string;
  slug: string;
  filePath: string;
  branchName: string;
  pullNumber: number;
  pullUrl: string;
  status: PostRequestStatus;
  now: string;
};

export function createPostRequest(
  db: Db,
  input: CreatePostRequestInput,
): PostRequest {
  db.prepare(
    `INSERT INTO post_requests (
      id, discord_user_id, discord_channel_id, discord_message_id,
      title, body, slug, file_path, branch_name,
      pull_number, pull_url, status, created_at, updated_at
    ) VALUES (
      @id, @discordUserId, @discordChannelId, NULL,
      @title, @body, @slug, @filePath, @branchName,
      @pullNumber, @pullUrl, @status, @now, @now
    )`,
  ).run(input);

  const created = getPostRequest(db, input.id);
  if (!created) {
    throw new Error("Failed to create post request");
  }
  return created;
}

export function getPostRequest(
  db: Db,
  id: string,
): PostRequest | undefined {
  const row = db
    .prepare("SELECT * FROM post_requests WHERE id = ?")
    .get(id) as PostRequestRow | undefined;
  return row ? rowToPostRequest(row) : undefined;
}

export function slugExists(db: Db, slug: string): boolean {
  const row = db.prepare("SELECT 1 FROM post_requests WHERE slug = ?").get(slug);
  return row !== undefined;
}

export function setDiscordMessageId(
  db: Db,
  id: string,
  messageId: string,
  now: string,
): void {
  db.prepare(
    "UPDATE post_requests SET discord_message_id = ?, updated_at = ? WHERE id = ?",
  ).run(messageId, now, id);
}

export function setPostRequestStatus(
  db: Db,
  id: string,
  status: PostRequestStatus,
  now: string,
): void {
  db.prepare(
    "UPDATE post_requests SET status = ?, updated_at = ? WHERE id = ?",
  ).run(status, now, id);
}
