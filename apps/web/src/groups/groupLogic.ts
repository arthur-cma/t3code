import type { Group, GroupChannel, GroupMember, GroupReplyMode } from "./types";

const MENTION_PATTERN = /@([a-z0-9][a-z0-9_-]*)/gi;

export function normalizeHandle(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 24);
}

export function uniqueHandle(base: string, existing: ReadonlyArray<string>): string {
  const normalized = normalizeHandle(base) || "agente";
  const taken = new Set(existing.map((handle) => handle.toLowerCase()));
  if (!taken.has(normalized)) return normalized;
  for (let suffix = 2; suffix < 100; suffix += 1) {
    const candidate = `${normalized}-${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${normalized}-${Date.now().toString(36)}`;
}

export function parseMentions(text: string, members: ReadonlyArray<GroupMember>): GroupMember[] {
  const byHandle = new Map(members.map((member) => [member.handle.toLowerCase(), member]));
  const found = new Set<GroupMember>();
  for (const match of text.matchAll(MENTION_PATTERN)) {
    const handle = match[1]?.toLowerCase();
    if (handle === undefined) continue;
    const member = byHandle.get(handle);
    if (member !== undefined) found.add(member);
  }
  return members.filter((member) => found.has(member));
}

export function resolveResponders(input: {
  members: ReadonlyArray<GroupMember>;
  text: string;
  replyMode: GroupReplyMode;
}): GroupMember[] {
  const mentioned = parseMentions(input.text, input.members);
  if (input.replyMode === "mentions") return mentioned;
  const automatic = input.members.filter((member) => member.autoRespond);
  const autoResponders = automatic.length > 0 ? automatic : input.members;
  const responders = new Set([...mentioned, ...autoResponders]);
  return input.members.filter((member) => responders.has(member));
}

function renderMentionsForPrompt(text: string, members: ReadonlyArray<GroupMember>): string {
  const byHandle = new Map(members.map((member) => [member.handle.toLowerCase(), member]));
  return text.replace(MENTION_PATTERN, (raw, handle: string) => {
    const member = byHandle.get(handle.toLowerCase());
    return member === undefined ? raw : `@${member.name}`;
  });
}

export function groupInitials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return `${words[0]![0] ?? ""}${words[1]![0] ?? ""}`.toUpperCase();
}

export function buildAgentPrompt(input: {
  group: Group;
  channel: GroupChannel;
  member: GroupMember;
  text: string;
  isNewThread: boolean;
  includeGroupContext: boolean;
}): string {
  const body = renderMentionsForPrompt(input.text, input.group.members);
  if (!input.isNewThread || !input.includeGroupContext) return body;
  const description = input.group.description.trim();
  return [
    `Você é ${input.member.name}, um agente participante do grupo "${input.group.name}" no T3 Code.`,
    description.length > 0 ? `Sobre o grupo: ${description}` : null,
    `Canal atual: #${input.channel.name}.`,
    'Responda como em um chat de equipe: direto, útil e sem prefixos como "Assistente:".',
    "",
    body,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

export function truncateTitle(value: string, max = 60): string {
  const singleLine = value.replace(/\s+/g, " ").trim();
  return singleLine.length <= max ? singleLine : `${singleLine.slice(0, max - 1)}…`;
}
