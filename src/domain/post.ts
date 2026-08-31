export type PostRequestStatus =
  | "created"
  | "waiting_approval"
  | "merged"
  | "cancelled"
  | "failed";

export type PostRequest = {
  id: string;
  discordUserId: string;
  discordChannelId: string;
  discordMessageId: string | null;
  title: string;
  body: string;
  slug: string;
  filePath: string;
  branchName: string;
  pullNumber: number;
  pullUrl: string;
  status: PostRequestStatus;
  createdAt: string;
  updatedAt: string;
};
