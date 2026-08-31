import { REST, Routes, SlashCommandBuilder } from "discord.js";
import type { Config } from "../config.js";

export const postCommand = new SlashCommandBuilder()
  .setName("post")
  .setDescription("記事を投稿します");

export async function registerCommands(config: Config): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(config.discordToken);

  await rest.put(
    Routes.applicationGuildCommands(config.discordClientId, config.discordGuildId),
    { body: [postCommand.toJSON()] },
  );
}
