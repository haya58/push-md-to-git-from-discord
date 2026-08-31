import type { Interaction } from "discord.js";
import type { Octokit } from "@octokit/rest";
import type { Config } from "../config.js";
import type { Db } from "../db/db.js";
import {
  handleApproveButton,
  handleCancelButton,
  handleModalSubmit,
  handlePostCommand,
} from "./components.js";

export type BotContext = {
  config: Config;
  db: Db;
  github: Octokit;
};

const MODAL_ID = "post_modal";
const APPROVE_PREFIX = "post_approve:";
const CANCEL_PREFIX = "post_cancel:";

export async function handleInteraction(
  ctx: BotContext,
  interaction: Interaction,
): Promise<void> {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "post") {
      await handlePostCommand(ctx, interaction);
    }
    return;
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId === MODAL_ID) {
      await handleModalSubmit(ctx, interaction);
    }
    return;
  }

  if (interaction.isButton()) {
    if (interaction.customId.startsWith(APPROVE_PREFIX)) {
      const requestId = interaction.customId.slice(APPROVE_PREFIX.length);
      await handleApproveButton(ctx, interaction, requestId);
      return;
    }

    if (interaction.customId.startsWith(CANCEL_PREFIX)) {
      const requestId = interaction.customId.slice(CANCEL_PREFIX.length);
      await handleCancelButton(ctx, interaction, requestId);
      return;
    }
  }
}
