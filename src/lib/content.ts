import type { RichNode } from "./types";

export const EMPTY_CONTENT: RichNode = {
  type: "doc",
  content: [{ type: "paragraph" }],
};
const blockTypes = new Set([
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "codeBlock",
  "horizontalRule",
]);
const nodeTypes = new Set(["doc", "text", "hardBreak", ...blockTypes]);
const markTypes = new Set(["bold", "italic", "underline", "strike", "code"]);
export function validateContent(value: unknown): value is RichNode {
  if (!value || typeof value !== "object" || (value as RichNode).type !== "doc")
    return false;
  if (JSON.stringify(value).length > 1_000_000) return false;
  let count = 0;
  const visit = (n: RichNode, depth: number): boolean => {
    if (
      !n ||
      typeof n !== "object" ||
      depth > 32 ||
      ++count > 25000 ||
      !nodeTypes.has(n.type)
    )
      return false;
    if (
      n.text !== undefined &&
      (n.type !== "text" || typeof n.text !== "string" || !n.text.length)
    )
      return false;
    if (n.type === "text" && typeof n.text !== "string") return false;
    if (
      n.marks &&
      (!Array.isArray(n.marks) ||
        n.marks.some((m) => !m || !markTypes.has(m.type)))
    )
      return false;
    if (n.attrs) {
      if (typeof n.attrs !== "object") return false;
      if (
        n.attrs.textAlign &&
        !["left", "center", "right", "justify"].includes(
          String(n.attrs.textAlign),
        )
      )
        return false;
      if (n.type === "heading" && ![1, 2, 3].includes(Number(n.attrs.level)))
        return false;
    }
    if (
      n.content &&
      (!Array.isArray(n.content) ||
        !n.content.every((c) => visit(c, depth + 1)))
    )
      return false;
    if (
      ["text", "hardBreak", "horizontalRule"].includes(n.type) &&
      n.content?.length
    )
      return false;
    if (
      ["paragraph", "heading"].includes(n.type) &&
      n.content?.some((c) => !["text", "hardBreak"].includes(c.type))
    )
      return false;
    if (n.type === "codeBlock" && n.content?.some((c) => c.type !== "text"))
      return false;
    if (
      ["doc", "blockquote", "listItem"].includes(n.type) &&
      n.content?.some((c) => !blockTypes.has(c.type))
    )
      return false;
    if (
      ["bulletList", "orderedList"].includes(n.type) &&
      (!n.content?.length || n.content.some((c) => c.type !== "listItem"))
    )
      return false;
    if (n.type === "listItem" && n.content?.[0]?.type !== "paragraph")
      return false;
    return true;
  };
  return visit(value as RichNode, 0);
}
function inline(text: string): RichNode[] {
  const nodes: RichNode[] = [];
  const pattern = /(\*\*(.+?)\*\*|__(.+?)__|`([^`]+)`|~~(.+?)~~|\*([^*]+)\*)/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const at = match.index ?? 0;
    if (at > last) nodes.push({ type: "text", text: text.slice(last, at) });
    const inner = match[2] || match[3] || match[4] || match[5] || match[6];
    const mark =
      match[2] || match[3]
        ? "bold"
        : match[4]
          ? "code"
          : match[5]
            ? "strike"
            : "italic";
    nodes.push({ type: "text", text: inner, marks: [{ type: mark }] });
    last = at + match[0].length;
  }
  if (last < text.length) nodes.push({ type: "text", text: text.slice(last) });
  return nodes;
}
export function fromText(text: string, markdown = true): RichNode {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const content: RichNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i++];
    if (!line.trim()) continue;
    if (!markdown) {
      content.push({
        type: "paragraph",
        content: [{ type: "text", text: line }],
      });
      continue;
    }
    if (/^```/.test(line)) {
      const code: string[] = [];
      while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]);
      i++;
      content.push({
        type: "codeBlock",
        attrs: { language: line.slice(3).trim() || null },
        ...(code.join("\n")
          ? { content: [{ type: "text", text: code.join("\n") }] }
          : {}),
      });
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.+)/);
    if (heading) {
      content.push({
        type: "heading",
        attrs: { level: Math.min(3, heading[1].length) },
        content: inline(heading[2]),
      });
      continue;
    }
    if (/^\s*([-*_])\1\1+\s*$/.test(line)) {
      content.push({ type: "horizontalRule" });
      continue;
    }
    if (/^>\s?/.test(line)) {
      content.push({
        type: "blockquote",
        content: [
          { type: "paragraph", content: inline(line.replace(/^>\s?/, "")) },
        ],
      });
      continue;
    }
    const list = line.match(/^\s*(?:([-*+])|(\d+)\.)\s+(.+)/);
    if (list) {
      const ordered = Boolean(list[2]);
      const items: RichNode[] = [
        {
          type: "listItem",
          content: [{ type: "paragraph", content: inline(list[3]) }],
        },
      ];
      while (i < lines.length) {
        const next = lines[i].match(/^\s*(?:([-*+])|(\d+)\.)\s+(.+)/);
        if (!next || Boolean(next[2]) !== ordered) break;
        items.push({
          type: "listItem",
          content: [{ type: "paragraph", content: inline(next[3]) }],
        });
        i++;
      }
      content.push({
        type: ordered ? "orderedList" : "bulletList",
        ...(ordered ? { attrs: { start: Number(list[2]) } } : {}),
        content: items,
      });
      continue;
    }
    content.push({ type: "paragraph", content: inline(line) });
  }
  return {
    type: "doc",
    content: content.length ? content : [{ type: "paragraph" }],
  };
}
export function plainText(node: RichNode): string {
  if (node.type === "text") return node.text || "";
  return (node.content || [])
    .map(plainText)
    .join(["paragraph", "heading"].includes(node.type) ? "" : "\n");
}
export function toMarkdown(node: RichNode): string {
  if (node.type === "text") {
    let text = node.text || "";
    for (const mark of node.marks || []) {
      const token = (
        { bold: "**", italic: "*", strike: "~~", code: "`" } as Record<
          string,
          string
        >
      )[mark.type];
      if (token) text = token + text + token;
    }
    return text;
  }
  const children = (node.content || []).map(toMarkdown);
  if (node.type === "doc") return children.join("\n\n");
  if (node.type === "heading")
    return "#".repeat(Number(node.attrs?.level || 1)) + " " + children.join("");
  if (node.type === "paragraph") return children.join("");
  if (node.type === "bulletList")
    return children.map((c) => "- " + c).join("\n");
  if (node.type === "orderedList")
    return children.map((c, i) => `${i + 1}. ${c}`).join("\n");
  if (node.type === "codeBlock")
    return (
      "```" + (node.attrs?.language || "") + "\n" + children.join("") + "\n```"
    );
  if (node.type === "blockquote")
    return children.map((c) => "> " + c).join("\n");
  if (node.type === "horizontalRule") return "---";
  if (node.type === "hardBreak") return "\n";
  return children.join("\n");
}
