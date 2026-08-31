export type PostMarkdownInput = {
  title: string;
  body: string;
  slug: string;
  date: string;
};

export function buildPostMarkdown(input: PostMarkdownInput): string {
  return `---
title: ${JSON.stringify(input.title)}
date: ${JSON.stringify(input.date)}
slug: ${JSON.stringify(input.slug)}
---

${input.body.trim()}
`;
}
