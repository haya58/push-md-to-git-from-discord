export type Config = {
  discordToken: string;
  discordClientId: string;
  discordGuildId: string;
  allowedDiscordUserIds: Set<string>;
  githubToken: string;
  githubOwner: string;
  githubRepo: string;
  githubBaseBranch: string;
  siteBaseUrl: string;
  postsDirectory: string;
  databasePath: string;
  timezone: string;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function loadConfig(): Config {
  const allowedDiscordUserIds = new Set(
    (process.env.ALLOWED_DISCORD_USER_IDS ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id.length > 0),
  );

  return {
    discordToken: requireEnv("DISCORD_TOKEN"),
    discordClientId: requireEnv("DISCORD_CLIENT_ID"),
    discordGuildId: requireEnv("DISCORD_GUILD_ID"),
    allowedDiscordUserIds,
    githubToken: requireEnv("GITHUB_TOKEN"),
    githubOwner: requireEnv("GITHUB_OWNER"),
    githubRepo: requireEnv("GITHUB_REPO"),
    githubBaseBranch: process.env.GITHUB_BASE_BRANCH ?? "main",
    siteBaseUrl: requireEnv("SITE_BASE_URL"),
    postsDirectory: process.env.POSTS_DIRECTORY ?? "site/content/posts",
    databasePath: process.env.DATABASE_PATH ?? "./bot.sqlite",
    timezone: process.env.TIMEZONE ?? "Asia/Tokyo",
  };
}
