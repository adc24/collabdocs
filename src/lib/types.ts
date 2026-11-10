export type RichNode = {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: RichNode[];
};
export type User = { id: string; name: string; email: string; color: string };
export type Collaborator = User & { permission: "editor" | "viewer" };
export type DocumentRecord = {
  id: string;
  title: string;
  content: RichNode;
  ownerId: string;
  color: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  owner: User;
  collaborators: Collaborator[];
  starred: boolean;
  permission: "owner" | "editor" | "viewer";
};
export type WorkspaceView =
  "all" | "mine" | "shared" | "starred" | "trash" | "templates";
export type TemplateId = "blank" | "project" | "meeting" | "brainstorm";
