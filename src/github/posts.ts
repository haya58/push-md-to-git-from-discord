import type { Octokit } from "@octokit/rest";
import type { Config } from "../config.js";

export type GithubContext = {
  octokit: Octokit;
  config: Config;
};

export async function getBaseRefSha(ctx: GithubContext): Promise<string> {
  const { octokit, config } = ctx;
  const baseRef = await octokit.git.getRef({
    owner: config.githubOwner,
    repo: config.githubRepo,
    ref: `heads/${config.githubBaseBranch}`,
  });
  return baseRef.data.object.sha;
}

export async function createBranch(
  ctx: GithubContext,
  branchName: string,
  sha: string,
): Promise<void> {
  const { octokit, config } = ctx;
  await octokit.git.createRef({
    owner: config.githubOwner,
    repo: config.githubRepo,
    ref: `refs/heads/${branchName}`,
    sha,
  });
}

export async function commitMarkdownFile(
  ctx: GithubContext,
  input: {
    filePath: string;
    branchName: string;
    markdown: string;
    title: string;
  },
): Promise<void> {
  const { octokit, config } = ctx;
  await octokit.repos.createOrUpdateFileContents({
    owner: config.githubOwner,
    repo: config.githubRepo,
    path: input.filePath,
    message: `Add post: ${input.title}`,
    content: Buffer.from(input.markdown, "utf8").toString("base64"),
    branch: input.branchName,
  });
}

export async function createPullRequest(
  ctx: GithubContext,
  input: {
    branchName: string;
    title: string;
    slug: string;
    filePath: string;
  },
): Promise<{ number: number; url: string }> {
  const { octokit, config } = ctx;
  const pr = await octokit.pulls.create({
    owner: config.githubOwner,
    repo: config.githubRepo,
    title: `Add post: ${input.title}`,
    head: input.branchName,
    base: config.githubBaseBranch,
    body: [
      "Discordから作成された投稿です。",
      "",
      `- Title: ${input.title}`,
      `- Slug: ${input.slug}`,
      `- File: ${input.filePath}`,
    ].join("\n"),
  });
  return { number: pr.data.number, url: pr.data.html_url };
}

export async function assertSafeToMerge(
  ctx: GithubContext,
  input: { pullNumber: number; branchName: string },
): Promise<void> {
  const { octokit, config } = ctx;

  const pr = await octokit.pulls.get({
    owner: config.githubOwner,
    repo: config.githubRepo,
    pull_number: input.pullNumber,
  });

  if (pr.data.state !== "open") {
    throw new Error("PR is not open");
  }
  if (pr.data.base.ref !== config.githubBaseBranch) {
    throw new Error("Unexpected base branch");
  }
  if (pr.data.head.ref !== input.branchName) {
    throw new Error("Unexpected head branch");
  }

  const files = await octokit.pulls.listFiles({
    owner: config.githubOwner,
    repo: config.githubRepo,
    pull_number: input.pullNumber,
  });

  if (files.data.length !== 1) {
    throw new Error("Unexpected number of changed files");
  }

  const safe = files.data.every((file) =>
    file.filename.startsWith(`${config.postsDirectory}/`),
  );
  if (!safe) {
    throw new Error("Unexpected changed file");
  }
}

export async function mergePullRequest(
  ctx: GithubContext,
  input: { pullNumber: number; title: string },
): Promise<void> {
  const { octokit, config } = ctx;
  await octokit.pulls.merge({
    owner: config.githubOwner,
    repo: config.githubRepo,
    pull_number: input.pullNumber,
    merge_method: "squash",
    commit_title: `Add post: ${input.title}`,
  });
}

export async function closePullRequest(
  ctx: GithubContext,
  pullNumber: number,
): Promise<void> {
  const { octokit, config } = ctx;
  await octokit.pulls.update({
    owner: config.githubOwner,
    repo: config.githubRepo,
    pull_number: pullNumber,
    state: "closed",
  });
}

export async function deleteBranch(
  ctx: GithubContext,
  branchName: string,
): Promise<void> {
  const { octokit, config } = ctx;
  try {
    await octokit.git.deleteRef({
      owner: config.githubOwner,
      repo: config.githubRepo,
      ref: `heads/${branchName}`,
    });
  } catch (error) {
    console.warn(`Failed to delete branch: ${branchName}`, error);
  }
}
