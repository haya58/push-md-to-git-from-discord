import "dotenv/config";
import { Client, GatewayIntentBits } from "discord.js";
import { loadConfig } from "./config.js";
import { initDb } from "./db/db.js";
import { createGitHubClient } from "./github/client.js";
import { registerCommands } from "./discord/commands.js";
import { handleInteraction } from "./discord/handlers.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const db = initDb(config.databasePath);
  const github = createGitHubClient(config.githubToken);

  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  client.once("ready", async () => {
    console.log(`Logged in as ${client.user?.tag}`);
    try {
      await registerCommands(config);
      console.log("Slash commands registered.");
    } catch (error) {
      console.error("Failed to register slash commands.", error);
    }
  });

  client.on("interactionCreate", async (interaction) => {
    try {
      await handleInteraction({ config, db, github }, interaction);
    } catch (error) {
      console.error(error);
      try {
        if (interaction.isRepliable()) {
          const options = {
            content: "エラーが発生しました。時間をおいて再度試してください。",
          };
          if (interaction.deferred || interaction.replied) {
            await interaction.editReply(options);
          } else {
            await interaction.reply({ ...options, ephemeral: true });
          }
        }
      } catch (replyError) {
        console.error(replyError);
      }
    }
  });

  await client.login(config.discordToken);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
