import type { Group, GroupMessage } from "./types";

const SHARE_PREFIX = "T3G1.";
const SHARE_KIND = "t3code.group.share";
const SHARE_VERSION = 1;

export interface GroupSharePayload {
  kind: typeof SHARE_KIND;
  version: number;
  exportedAt: string;
  group: Group;
  messages: Record<string, GroupMessage[]>;
}

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): string {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeGroupShare(payload: Omit<GroupSharePayload, "kind" | "version">): string {
  const body: GroupSharePayload = {
    kind: SHARE_KIND,
    version: SHARE_VERSION,
    ...payload,
  };
  return `${SHARE_PREFIX}${toBase64(JSON.stringify(body))}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function decodeGroupShare(code: string): GroupSharePayload | null {
  const trimmed = code.trim();
  if (!trimmed.startsWith(SHARE_PREFIX)) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(fromBase64(trimmed.slice(SHARE_PREFIX.length)));
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  if (parsed.kind !== SHARE_KIND || typeof parsed.version !== "number") return null;
  if (!isRecord(parsed.group)) return null;
  if (typeof parsed.group.id !== "string" || typeof parsed.group.name !== "string") return null;
  const messages = isRecord(parsed.messages) ? parsed.messages : {};
  return {
    kind: SHARE_KIND,
    version: parsed.version,
    exportedAt:
      typeof parsed.exportedAt === "string" ? parsed.exportedAt : new Date().toISOString(),
    group: parsed.group as unknown as Group,
    messages: messages as Record<string, GroupMessage[]>,
  };
}

function unionById<T extends { id: string }>(
  local: ReadonlyArray<T>,
  remote: ReadonlyArray<T>,
): T[] {
  const merged = [...local];
  const seen = new Set(local.map((entry) => entry.id));
  for (const entry of remote) {
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    merged.push(entry);
  }
  return merged;
}

function mergePages(local: Group["pages"], remote: Group["pages"]): Group["pages"] {
  const byId = new Map(local.map((page) => [page.id, page]));
  for (const page of remote) {
    const current = byId.get(page.id);
    if (current === undefined) {
      byId.set(page.id, page);
      continue;
    }
    if (page.updatedAt > current.updatedAt) byId.set(page.id, page);
  }
  return [...byId.values()];
}

export function mergeMessages(
  local: Record<string, GroupMessage[]>,
  remote: Record<string, GroupMessage[]>,
): Record<string, GroupMessage[]> {
  const merged: Record<string, GroupMessage[]> = { ...local };
  for (const [channelId, incoming] of Object.entries(remote)) {
    if (!Array.isArray(incoming)) continue;
    const existing = merged[channelId] ?? [];
    const byId = new Map(existing.map((message) => [message.id, message]));
    for (const message of incoming) {
      if (typeof message?.id !== "string") continue;
      if (!byId.has(message.id)) byId.set(message.id, message);
    }
    merged[channelId] = [...byId.values()].sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt),
    );
  }
  return merged;
}

/**
 * Local-first merge: anything created on either side survives, local edits win for records that
 * are not time-stamped, and pages keep the newest body.
 */
export function mergeGroups(local: Group, remote: Group): Group {
  return {
    ...local,
    name: remote.name.length > 0 ? remote.name : local.name,
    description: local.description.length > 0 ? local.description : remote.description,
    channels: unionById(local.channels, remote.channels),
    members: unionById(local.members, remote.members),
    meetings: unionById(local.meetings, remote.meetings),
    spaces: unionById(local.spaces, remote.spaces),
    pages: mergePages(local.pages, remote.pages),
    people: unionById(local.people, remote.people),
    bindings: unionById(local.bindings, remote.bindings),
  };
}

/** Everything a person needs to join the same organization on their own T3 Code. */
export function buildSharePayload(
  group: Group,
  messages: Record<string, GroupMessage[]>,
): Omit<GroupSharePayload, "kind" | "version"> {
  const channelIds = new Set(group.channels.map((channel) => channel.id));
  const sharedMessages: Record<string, GroupMessage[]> = {};
  for (const [channelId, entries] of Object.entries(messages)) {
    if (!channelIds.has(channelId)) continue;
    sharedMessages[channelId] = entries.filter((message) => message.streaming !== true);
  }
  return {
    exportedAt: new Date().toISOString(),
    group,
    messages: sharedMessages,
  };
}
