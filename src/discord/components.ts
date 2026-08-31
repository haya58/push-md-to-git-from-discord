import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type ModalActionRowComponentBuilder,
  type ModalSubmitInteraction,
} from "discord.js";
import { randomUUID } from "node:crypto";
import { DateTime } from "luxon";
import type { BotContext } from "./handlers.js";
import { buildPostMarkdown } from "../domain/markdown.js";
import { generateSlug } from "../domain/slug.js";
import {
  createPostRequest,
  getPostRequest,
  setDiscordMessageId,
  setPostRequestStatus,
  slugExists,
} from "../db/postRequests.js";
import {
  assertSafeToMerge,
  closePullRequest,
  commitMarkdownFile,
  createBranch,
  createPullRequest,
  deleteBranch,
  getBaseRefSha,
  mergePullRequest,
  type GithubContext,
} from "../github/posts.js";

const MAX_EMBED_BODY_LENGTH = 3500;

function isAllowedUser(ctx: BotContext, userId: string): boolean {
  return ctx.config.allowedDiscordUserIds.has(userId);
}

function nowIso(): string {
  return new Date().toISOString();
}

export function buildPostModal(): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId("post_modal")
    .setTitle("記事を投稿");

  const titleInput = new TextInputBuilder()
    .setCustomId("post_title")
    .setLabel("タイトル")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(100);

  const bodyInput = new TextInputBuilder()
    .setCustomId("post_body")
    .setLabel("本文")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(4000);

  const titleRow =
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
      titleInput,
    );
  const bodyRow =
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
      bodyInput,
    );

  modal.addComponents(titleRow, bodyRow);
  return modal;
}

export async function handlePostCommand(
  ctx: BotContext,
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!isAllowedUser(ctx, interaction.user.id)) {
    await interaction.reply({
      content: "このコマンドを実行する権限がありません。",
      ephemeral: true,
    });
    return;
  }

  await interaction.showModal(buildPostModal());
}

function buildConfirmEmbed(input: {
  title: string;
  body: string;
  filePath: string;
  pullUrl: string;
}): EmbedBuilder {
  const bodyPreview =
    input.body.length > MAX_EMBED_BODY_LENGTH
      ? `${input.body.slice(0, MAX_EMBED_BODY_LENGTH)}...`
      : input.body;

  const description = [
    "タイトル:",
    input.title,
    "",
    "本文:",
    bodyPreview,
    "",
    "ファイル:",
    input.filePath,
    "",
    "PR:",
    input.pullUrl,
    "",
    "この内容で公開しますか？",
  ].join("\n");

  return new EmbedBuilder()
    .setTitle("新しい記事を作成しました")
    .setDescription(description)
    .setColor(0x5865f2);
}

function buildConfirmButtons(
  requestId: string,
): ActionRowBuilder<ButtonBuilder> {
  const approve = new ButtonBuilder()
    .setCustomId(`post_approve:${requestId}`)
    .setLabel("公開する")
    .setStyle(ButtonStyle.Primary);

  const cancel = new ButtonBuilder()
    .setCustomId(`post_cancel:${requestId}`)
    .setLabel("取り消す")
    .setStyle(ButtonStyle.Secondary);

  return new ActionRowBuilder<ButtonBuilder>().addComponents(approve, cancel);
}

function buildDisabledButtons(
  requestId: string,
): ActionRowBuilder<ButtonBuilder> {
  const approve = new ButtonBuilder()
    .setCustomId(`post_approve:${requestId}`)
    .setLabel("公開する")
    .setStyle(ButtonStyle.Primary)
    .setDisabled(true);

  const cancel = new ButtonBuilder()
    .setCustomId(`post_cancel:${requestId}`)
    .setLabel("取り消す")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(true);

  return new ActionRowBuilder<ButtonBuilder>().addComponents(approve, cancel);
}

export async function handleModalSubmit(
  ctx: BotContext,
  interaction: ModalSubmitInteraction,
): Promise<void> {
  const title = interaction.fields.getTextInputValue("post_title").trim();
  const body = interaction.fields.getTextInputValue("post_body").trim();

  if (title === "" || body === "") {
    await interaction.reply({
      content: "タイトルと本文を入力してください。",
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: false });

  const now = DateTime.now().setZone(ctx.config.timezone);
  const requestId = randomUUID();
  const slug = generateSlug(now, (candidate) => slugExists(ctx.db, candidate));
  const filePath = `${ctx.config.postsDirectory}/${slug}.md`;
  const branchName = `post/${slug}`;
  const date = now.toISO({ suppressMilliseconds: true });

  const markdown = buildPostMarkdown({ title, body, slug, date: date ?? "" });

  const githubCtx: GithubContext = {
    octokit: ctx.github,
    config: ctx.config,
  };

  try {
    const baseSha = await getBaseRefSha(githubCtx);
    await createBranch(githubCtx, branchName, baseSha);
    await commitMarkdownFile(githubCtx, {
      filePath,
      branchName,
      markdown,
      title,
    });
    const pr = await createPullRequest(githubCtx, {
      branchName,
      title,
      slug,
      filePath,
    });

    createPostRequest(ctx.db, {
      id: requestId,
      discordUserId: interaction.user.id,
      discordChannelId: interaction.channelId ?? "",
      title,
      body,
      slug,
      filePath,
      branchName,
      pullNumber: pr.number,
      pullUrl: pr.url,
      status: "waiting_approval",
      now: nowIso(),
    });

    const message = await interaction.editReply({
      embeds: [buildConfirmEmbed({ title, body, filePath, pullUrl: pr.url })],
      components: [buildConfirmButtons(requestId)],
    });

    setDiscordMessageId(ctx.db, requestId, message.id, nowIso());
  } catch (error) {
    console.error(error);
    await interaction.editReply({
      content: "投稿の作成に失敗しました。\n時間をおいて再度試してください。",
    });
  }
}

function canOperateButton(
  ctx: BotContext,
  userId: string,
  discordUserId: string,
): boolean {
  return isAllowedUser(ctx, userId) || userId === discordUserId;
}

export async function handleApproveButton(
  ctx: BotContext,
  interaction: ButtonInteraction,
  requestId: string,
): Promise<void> {
  const request = getPostRequest(ctx.db, requestId);
  if (!request) {
    await interaction.reply({
      content: "投稿が見つかりません。",
      ephemeral: true,
    });
    return;
  }

  if (!canOperateButton(ctx, interaction.user.id, request.discordUserId)) {
    await interaction.reply({
      content: "この操作を行う権限がありません。",
      ephemeral: true,
    });
    return;
  }

  await interaction.deferUpdate();

  const githubCtx: GithubContext = {
    octokit: ctx.github,
    config: ctx.config,
  };

  try {
    await assertSafeToMerge(githubCtx, {
      pullNumber: request.pullNumber,
      branchName: request.branchName,
    });
    await mergePullRequest(githubCtx, {
      pullNumber: request.pullNumber,
      title: request.title,
    });
    await deleteBranch(githubCtx, request.branchName);
    setPostRequestStatus(ctx.db, requestId, "merged", nowIso());

    await interaction.editReply({
      components: [buildDisabledButtons(requestId)],
    });

    await interaction.followUp({
      content: [
        "公開処理を開始しました。",
        "数十秒後に以下のURLで確認できます。",
        "",
        `${ctx.config.siteBaseUrl}/posts/${request.slug}/`,
      ].join("\n"),
    });
  } catch (error) {
    console.error(error);
    await interaction.followUp({
      content:
        "まだ公開できません。\nGitHub Actionsのチェック完了後にもう一度押してください。",
    });
  }
}

export async function handleCancelButton(
  ctx: BotContext,
  interaction: ButtonInteraction,
  requestId: string,
): Promise<void> {
  const request = getPostRequest(ctx.db, requestId);
  if (!request) {
    await interaction.reply({
      content: "投稿が見つかりません。",
      ephemeral: true,
    });
    return;
  }

  if (!canOperateButton(ctx, interaction.user.id, request.discordUserId)) {
    await interaction.reply({
      content: "この操作を行う権限がありません。",
      ephemeral: true,
    });
    return;
  }

  await interaction.deferUpdate();

  const githubCtx: GithubContext = {
    octokit: ctx.github,
    config: ctx.config,
  };

  try {
    await closePullRequest(githubCtx, request.pullNumber);
    await deleteBranch(githubCtx, request.branchName);
    setPostRequestStatus(ctx.db, requestId, "cancelled", nowIso());

    await interaction.editReply({
      components: [buildDisabledButtons(requestId)],
    });

    await interaction.followUp({
      content: "投稿を取り消しました。",
    });
  } catch (error) {
    console.error(error);
    await interaction.followUp({
      content: "取り消しに失敗しました。時間をおいて再度試してください。",
    });
  }
}
