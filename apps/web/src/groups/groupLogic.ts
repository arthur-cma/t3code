import type { Group, GroupChannel, GroupMember, GroupPerson, GroupReplyMode } from "./types";

const MENTION_PATTERN = /@([a-z0-9][a-z0-9_-]*)/gi;

export interface MentionQuery {
  start: number;
  end: number;
  query: string;
}

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

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function uniquePersonHandle(
  base: string,
  people: ReadonlyArray<{ handle: string }>,
): string {
  return uniqueHandle(
    base,
    people.map((person) => person.handle),
  );
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

/** The `@token` the caret currently sits in, if any. */
export function findMentionQuery(text: string, caret: number): MentionQuery | null {
  const clamped = Math.max(0, Math.min(caret, text.length));
  const before = text.slice(0, clamped);
  const at = before.lastIndexOf("@");
  if (at === -1) return null;
  const previous = at === 0 ? "" : (before[at - 1] ?? "");
  if (previous.length > 0 && !/\s/.test(previous)) return null;
  const token = before.slice(at + 1);
  if (/\s/.test(token) || token.length > 32) return null;
  return { start: at, end: clamped, query: token };
}

export function applyMention(
  text: string,
  mention: MentionQuery,
  handle: string,
): { text: string; caret: number } {
  const inserted = `@${handle} `;
  const next = `${text.slice(0, mention.start)}${inserted}${text.slice(mention.end)}`;
  return { text: next, caret: mention.start + inserted.length };
}

export function filterMentionCandidates(
  members: ReadonlyArray<GroupMember>,
  query: string,
  limit = 8,
): GroupMember[] {
  const needle = normalizeSearch(query.trim());
  if (needle.length === 0) return members.slice(0, limit);
  const scored = members.flatMap((member) => {
    const handle = normalizeSearch(member.handle);
    const name = normalizeSearch(member.name);
    const role = normalizeSearch(member.role);
    if (handle.startsWith(needle)) return [{ member, score: 0 }];
    if (name.startsWith(needle)) return [{ member, score: 1 }];
    if (handle.includes(needle)) return [{ member, score: 2 }];
    if (name.includes(needle)) return [{ member, score: 3 }];
    if (role.includes(needle)) return [{ member, score: 4 }];
    return [];
  });
  scored.sort((left, right) => left.score - right.score);
  return scored.slice(0, limit).map((entry) => entry.member);
}

export interface MentionCandidate {
  kind: "agent" | "person";
  id: string;
  name: string;
  handle: string;
  role: string;
  member: GroupMember | null;
  person: GroupPerson | null;
}

/**
 * Everyone who can be mentioned in the composer: agents first, then the people in the group.
 * Mentions of people mark the message for them without triggering an agent reply.
 */
export function mentionCandidates(group: Group, query: string, limit = 8): MentionCandidate[] {
  const agents = filterMentionCandidates(group.members, query, limit).map(
    (member): MentionCandidate => ({
      kind: "agent",
      id: member.id,
      name: member.name,
      handle: member.handle,
      role: member.role,
      member,
      person: null,
    }),
  );
  const remaining = Math.max(limit - agents.length, 0);
  if (remaining === 0) return agents;
  const needle = normalizeSearch(query.trim());
  const people = group.people
    .filter((person) => {
      if (needle.length === 0) return true;
      return (
        normalizeSearch(person.handle).includes(needle) ||
        normalizeSearch(person.name).includes(needle) ||
        normalizeSearch(person.role).includes(needle)
      );
    })
    .slice(0, remaining)
    .map((person): MentionCandidate => ({
      kind: "person",
      id: person.id,
      name: person.name,
      handle: person.handle,
      role: person.role,
      member: null,
      person,
    }));
  return [...agents, ...people];
}

export function resolveResponders(input: {
  members: ReadonlyArray<GroupMember>;
  text: string;
  replyMode: GroupReplyMode;
  directMemberId?: string | null;
}): GroupMember[] {
  if (input.directMemberId !== undefined && input.directMemberId !== null) {
    const direct = input.members.find((member) => member.id === input.directMemberId);
    return direct === undefined ? [] : [direct];
  }
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

export interface OrgChartNode {
  member: GroupMember;
  children: OrgChartNode[];
}

/** Builds a reporting tree from `reportsTo`, keeping every member exactly once. */
export function buildOrgChart(members: ReadonlyArray<GroupMember>): OrgChartNode[] {
  const byId = new Map(members.map((member) => [member.id, member]));
  const childrenByParent = new Map<string, GroupMember[]>();
  const roots: GroupMember[] = [];

  for (const member of members) {
    const parentId = member.reportsTo;
    if (parentId === null || parentId === undefined || parentId === member.id) {
      roots.push(member);
      continue;
    }
    const parent = byId.get(parentId);
    if (parent === undefined) {
      roots.push(member);
      continue;
    }
    const siblings = childrenByParent.get(parentId) ?? [];
    siblings.push(member);
    childrenByParent.set(parentId, siblings);
  }

  const build = (member: GroupMember, seen: ReadonlySet<string>): OrgChartNode => {
    if (seen.has(member.id)) return { member, children: [] };
    const nextSeen = new Set(seen).add(member.id);
    return {
      member,
      children: (childrenByParent.get(member.id) ?? []).map((child) => build(child, nextSeen)),
    };
  };

  return roots.map((member) => build(member, new Set()));
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
  const isDm = input.channel.kind === "dm";
  return [
    `Você é ${input.member.name}, um agente participante do grupo "${input.group.name}" no T3 Code.`,
    description.length > 0 ? `Sobre o grupo: ${description}` : null,
    isDm ? "Esta é uma conversa direta com o usuário." : `Canal atual: #${input.channel.name}.`,
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
