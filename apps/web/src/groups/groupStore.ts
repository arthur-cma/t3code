import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { resolveStorage } from "../lib/storage";
import { randomUUID } from "../lib/utils";
import { uniquePersonHandle } from "./groupLogic";
import { dailyKeyFor, dailyPageContent, dailyPageTitle } from "./pageDoc";
import {
  DEFAULT_GROUP_SETTINGS,
  GROUP_ACCENTS,
  type Group,
  type GroupAccent,
  type GroupAgentBinding,
  type GroupCanvasNode,
  type GroupChannel,
  type GroupChannelKind,
  type GroupMeeting,
  type GroupMember,
  type GroupMessage,
  type GroupPage,
  type GroupPageCanvas,
  type GroupPageCoverId,
  type GroupPageMode,
  type GroupPerson,
  type GroupProjectRef,
  type GroupSettings,
  type GroupSpace,
  type GroupThreadLink,
} from "./types";
import type { GroupSharePayload } from "./groupSync";
import { mergeGroups, mergeMessages } from "./groupSync";

const GROUPS_STORAGE_KEY = "t3code:groups:v1";
const GROUPS_STORAGE_VERSION = 6;

function createId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

function createGroupChannel(
  name: string,
  topic = "",
  kind: GroupChannelKind = "text",
  memberId: string | null = null,
): GroupChannel {
  return { id: createId("channel"), name, topic, kind, memberId };
}

function createGroupMember(member: Omit<GroupMember, "id">): GroupMember {
  return { ...member, id: createId("member") };
}

const DEFAULT_SPACE_ICON = "📁";

function createGroupPerson(input: {
  name: string;
  handle: string;
  role?: string;
  accent?: GroupAccent;
  isOwner?: boolean;
}): GroupPerson {
  return {
    id: createId("person"),
    name: input.name,
    handle: input.handle,
    accent: input.accent ?? "slate",
    role: input.role ?? "",
    isOwner: input.isOwner ?? false,
    joinedAt: new Date().toISOString(),
  };
}

function createOwnerPerson(): GroupPerson {
  return createGroupPerson({ name: "Você", handle: "voce", role: "Proprietário", isOwner: true });
}

function createGroupSpace(name: string, icon = DEFAULT_SPACE_ICON): GroupSpace {
  return { id: createId("space"), name, icon, createdAt: new Date().toISOString() };
}

function createGroupPage(input: {
  spaceId: string;
  parentId: string | null;
  title: string;
  icon?: string;
  content?: string;
  cover?: GroupPageCoverId | "";
  tags?: string[];
  mode?: GroupPageMode;
  dailyKey?: string | null;
}): GroupPage {
  const now = new Date().toISOString();
  return {
    id: createId("page"),
    spaceId: input.spaceId,
    parentId: input.parentId,
    title: input.title.trim() || "Sem título",
    icon: input.icon ?? "📄",
    content: input.content ?? "",
    favorite: false,
    cover: input.cover ?? "",
    tags: input.tags ?? [],
    mode: input.mode ?? "document",
    canvas: { nodes: [] },
    dailyKey: input.dailyKey ?? null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeCanvas(value: unknown): GroupPageCanvas {
  const nodes = (value as Partial<GroupPageCanvas> | null)?.nodes;
  if (!Array.isArray(nodes)) return { nodes: [] };
  const colors = new Set<string>(GROUP_ACCENTS);
  return {
    nodes: nodes.flatMap((node): GroupCanvasNode[] => {
      if (typeof node !== "object" || node === null) return [];
      const candidate = node as Partial<GroupCanvasNode>;
      if (typeof candidate.id !== "string") return [];
      const kind =
        candidate.kind === "shape" || candidate.kind === "text" ? candidate.kind : "note";
      const x = typeof candidate.x === "number" && Number.isFinite(candidate.x) ? candidate.x : 0;
      const y = typeof candidate.y === "number" && Number.isFinite(candidate.y) ? candidate.y : 0;
      const width =
        typeof candidate.width === "number" &&
        Number.isFinite(candidate.width) &&
        candidate.width > 0
          ? candidate.width
          : 220;
      const height =
        typeof candidate.height === "number" &&
        Number.isFinite(candidate.height) &&
        candidate.height > 0
          ? candidate.height
          : 160;
      return [
        {
          id: candidate.id,
          kind,
          x,
          y,
          width,
          height,
          color:
            typeof candidate.color === "string" && colors.has(candidate.color)
              ? candidate.color
              : "amber",
          text: typeof candidate.text === "string" ? candidate.text : "",
        },
      ];
    }),
  };
}

/** Drops duplicate and empty tags while keeping the author's order. */
export function normalizePageTags(tags: ReadonlyArray<string>): string[] {
  const result: string[] = [];
  for (const tag of tags) {
    const trimmed = tag.trim();
    if (trimmed.length === 0) continue;
    if (result.some((entry) => entry.toLowerCase() === trimmed.toLowerCase())) continue;
    result.push(trimmed);
  }
  return result;
}

interface CreateGroupInput {
  name: string;
  description?: string;
  projectRef: GroupProjectRef | null;
  accent?: GroupAccent;
  replyMode?: Group["replyMode"];
  runtimeMode?: Group["runtimeMode"];
}

interface GroupsState {
  groups: Group[];
  activeGroupId: string | null;
  messages: Record<string, GroupMessage[]>;
  links: GroupThreadLink[];
  settings: GroupSettings;

  createGroup: (input: CreateGroupInput) => string;
  updateGroup: (groupId: string, patch: Partial<Omit<Group, "id" | "createdAt">>) => void;
  deleteGroup: (groupId: string) => void;
  setActiveGroupId: (groupId: string | null) => void;

  addChannel: (groupId: string, name: string, topic?: string) => string | null;
  updateChannel: (
    groupId: string,
    channelId: string,
    patch: Partial<Omit<GroupChannel, "id">>,
  ) => void;
  deleteChannel: (groupId: string, channelId: string) => boolean;
  openDm: (groupId: string, memberId: string) => string | null;

  addMember: (groupId: string, member: Omit<GroupMember, "id">) => string;
  updateMember: (
    groupId: string,
    memberId: string,
    patch: Partial<Omit<GroupMember, "id">>,
  ) => void;
  removeMember: (groupId: string, memberId: string) => void;

  startMeeting: (groupId: string, title?: string) => string;
  updateMeeting: (
    groupId: string,
    meetingId: string,
    patch: Partial<Omit<GroupMeeting, "id">>,
  ) => void;
  deleteMeeting: (groupId: string, meetingId: string) => void;

  addSpace: (groupId: string, name: string, icon?: string) => string | null;
  updateSpace: (groupId: string, spaceId: string, patch: Partial<Omit<GroupSpace, "id">>) => void;
  deleteSpace: (groupId: string, spaceId: string) => boolean;

  addPage: (
    groupId: string,
    input: {
      spaceId?: string | null;
      parentId?: string | null;
      title?: string;
      icon?: string;
      content?: string;
      cover?: GroupPageCoverId | "";
      tags?: string[];
      mode?: GroupPageMode;
      dailyKey?: string | null;
    },
  ) => string | null;
  updatePage: (
    groupId: string,
    pageId: string,
    patch: Partial<Omit<GroupPage, "id" | "createdAt" | "updatedAt">>,
  ) => void;
  /** Moves the page and its subpages to the trash. */
  deletePage: (groupId: string, pageId: string) => void;
  restorePage: (groupId: string, pageId: string) => boolean;
  deletePageForever: (groupId: string, pageId: string) => void;
  emptyPageTrash: (groupId: string) => void;
  duplicatePage: (groupId: string, pageId: string) => string | null;
  ensureDailyPage: (groupId: string, spaceId?: string) => string | null;
  togglePageFavorite: (groupId: string, pageId: string) => void;

  addPerson: (
    groupId: string,
    person: { name: string; handle: string; role?: string; accent?: GroupAccent },
  ) => string | null;
  updatePerson: (
    groupId: string,
    personId: string,
    patch: Partial<Omit<GroupPerson, "id" | "joinedAt">>,
  ) => void;
  removePerson: (groupId: string, personId: string) => boolean;

  addBinding: (
    groupId: string,
    binding: Omit<GroupAgentBinding, "id" | "createdAt">,
  ) => string | null;
  removeBinding: (groupId: string, bindingId: string) => void;

  importGroupShare: (payload: GroupSharePayload) => string;

  addMessage: (message: GroupMessage) => void;
  appendUserMessage: (input: {
    channelId: string;
    text: string;
    authorName?: string;
  }) => GroupMessage;
  appendSystemMessage: (channelId: string, text: string) => void;
  upsertAgentMessage: (message: GroupMessage & { sourceId: string }) => void;
  clearChannelMessages: (channelId: string) => void;

  upsertThreadLink: (link: GroupThreadLink) => void;
  removeThreadLinksForMember: (memberId: string) => void;

  updateSettings: (patch: Partial<GroupSettings>) => void;
  resetAll: () => void;
}

const EMPTY_MESSAGES: GroupMessage[] = [];

export function channelMessages(
  messages: Record<string, GroupMessage[]>,
  channelId: string | null | undefined,
): GroupMessage[] {
  return channelId === null || channelId === undefined
    ? EMPTY_MESSAGES
    : (messages[channelId] ?? EMPTY_MESSAGES);
}

export function threadLinksForChannel(
  links: ReadonlyArray<GroupThreadLink>,
  channelId: string,
): GroupThreadLink[] {
  return links.filter((link) => link.channelId === channelId);
}

export function textChannels(group: Group): GroupChannel[] {
  return group.channels.filter((channel) => channel.kind !== "dm");
}

export function dmChannels(group: Group): GroupChannel[] {
  return group.channels.filter((channel) => channel.kind === "dm");
}

export function dmChannelForMember(group: Group, memberId: string): GroupChannel | null {
  return (
    group.channels.find((channel) => channel.kind === "dm" && channel.memberId === memberId) ?? null
  );
}

export function firstTextChannel(group: Group): GroupChannel | null {
  return textChannels(group)[0] ?? group.channels[0] ?? null;
}

export function firstSpace(group: Group): GroupSpace | null {
  return group.spaces[0] ?? null;
}

export function pageById(group: Group, pageId: string | null): GroupPage | null {
  if (pageId === null) return null;
  return group.pages.find((page) => page.id === pageId && page.deletedAt === null) ?? null;
}

export function pageIncludingTrashById(group: Group, pageId: string): GroupPage | null {
  return group.pages.find((page) => page.id === pageId) ?? null;
}

/** Every page id in the subtree rooted at `pageId`, including the root. */
export function pageSubtree(pages: ReadonlyArray<GroupPage>, pageId: string): Set<string> {
  const ids = new Set<string>([pageId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const page of pages) {
      if (page.parentId !== null && ids.has(page.parentId) && !ids.has(page.id)) {
        ids.add(page.id);
        grew = true;
      }
    }
  }
  return ids;
}

export function trashedPages(group: Group): GroupPage[] {
  return group.pages
    .filter((page) => page.deletedAt !== null)
    .sort((left, right) => (right.deletedAt ?? "").localeCompare(left.deletedAt ?? ""));
}

export function dailyPages(group: Group): GroupPage[] {
  return group.pages
    .filter((page) => page.dailyKey !== null && page.deletedAt === null)
    .sort((left, right) => (right.dailyKey ?? "").localeCompare(left.dailyKey ?? ""));
}

export function todayDailyPage(group: Group): GroupPage | null {
  const key = dailyKeyFor(new Date());
  return group.pages.find((page) => page.dailyKey === key && page.deletedAt === null) ?? null;
}

export function recentPages(group: Group, limit = 6): GroupPage[] {
  return group.pages
    .filter((page) => page.deletedAt === null)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, limit);
}

export function favoritePages(group: Group): GroupPage[] {
  return group.pages
    .filter((page) => page.favorite && page.deletedAt === null)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

/**
 * Repairs groups persisted by older builds (or written mid-upgrade by an HMR reload), where
 * DMs, roles, hierarchy, meetings, spaces, pages, people and bindings did not exist yet.
 * Ids are derived from the group id so repeated runs stay stable.
 */
export function normalizeGroups(persisted: unknown): Group[] {
  if (!Array.isArray(persisted)) return [];
  return persisted.flatMap((value): Group[] => {
    if (typeof value !== "object" || value === null) return [];
    const group = value as Partial<Group>;
    if (typeof group.id !== "string" || typeof group.name !== "string") return [];
    const createdAt = group.createdAt ?? new Date().toISOString();
    const members = (group.members ?? []).map((member) => ({
      ...member,
      role: member.role ?? "",
      reportsTo: member.reportsTo ?? null,
      personId: member.personId ?? null,
    }));
    const spaces =
      Array.isArray(group.spaces) && group.spaces.length > 0
        ? group.spaces
        : [
            {
              id: `${group.id}:space:geral`,
              name: "Geral",
              icon: DEFAULT_SPACE_ICON,
              createdAt,
            },
          ];
    const firstSpaceId = spaces[0]?.id ?? null;
    const pages = (group.pages ?? []).map((page) => ({
      ...page,
      spaceId: page.spaceId ?? firstSpaceId ?? "",
      parentId: page.parentId ?? null,
      icon: page.icon ?? "📄",
      content: page.content ?? "",
      favorite: page.favorite ?? false,
      cover: page.cover ?? "",
      tags: normalizePageTags(Array.isArray(page.tags) ? page.tags : []),
      mode: page.mode === "canvas" ? ("canvas" as const) : ("document" as const),
      canvas: normalizeCanvas(page.canvas),
      dailyKey:
        typeof page.dailyKey === "string" && page.dailyKey.length > 0 ? page.dailyKey : null,
      deletedAt: page.deletedAt ?? null,
      createdAt: page.createdAt ?? createdAt,
      updatedAt: page.updatedAt ?? page.createdAt ?? createdAt,
    }));
    return [
      {
        ...group,
        id: group.id,
        name: group.name,
        description: group.description ?? "",
        accent: group.accent ?? "violet",
        replyMode: group.replyMode ?? "mentions",
        runtimeMode: group.runtimeMode ?? "full-access",
        projectRef: group.projectRef ?? null,
        members,
        channels: (group.channels ?? []).map((channel) => ({
          ...channel,
          kind: channel.kind ?? "text",
          memberId: channel.memberId ?? null,
        })),
        meetings: group.meetings ?? [],
        spaces,
        pages,
        people:
          Array.isArray(group.people) && group.people.length > 0
            ? group.people
            : [
                {
                  id: `${group.id}:person:owner`,
                  name: "Você",
                  handle: "voce",
                  accent: "slate" as const,
                  role: "Proprietário",
                  isOwner: true,
                  joinedAt: createdAt,
                },
              ],
        bindings: Array.isArray(group.bindings) ? group.bindings : [],
        createdAt,
      },
    ];
  });
}

export const useGroupsStore = create<GroupsState>()(
  persist(
    (set, get) => ({
      groups: [],
      activeGroupId: null,
      messages: {},
      links: [],
      settings: DEFAULT_GROUP_SETTINGS,

      createGroup: (input) => {
        const groupId = createId("group");
        const accent =
          input.accent ?? GROUP_ACCENTS[get().groups.length % GROUP_ACCENTS.length] ?? "violet";
        const group: Group = {
          id: groupId,
          name: input.name.trim() || "Novo grupo",
          description: input.description?.trim() ?? "",
          accent,
          replyMode: input.replyMode ?? get().settings.defaultReplyMode,
          runtimeMode: input.runtimeMode ?? get().settings.defaultRuntimeMode,
          projectRef: input.projectRef,
          channels: [createGroupChannel("geral", "Conversa principal do grupo")],
          members: [],
          meetings: [],
          spaces: [createGroupSpace("Geral")],
          pages: [],
          people: [createOwnerPerson()],
          bindings: [],
          createdAt: new Date().toISOString(),
        };
        set((state) => ({
          groups: [...state.groups, group],
          activeGroupId: groupId,
        }));
        return groupId;
      },

      updateGroup: (groupId, patch) => {
        set((state) => ({
          groups: state.groups.map((group) =>
            group.id === groupId ? { ...group, ...patch } : group,
          ),
        }));
      },

      deleteGroup: (groupId) => {
        const group = get().groups.find((candidate) => candidate.id === groupId) ?? null;
        if (group === null) return;
        set((state) => {
          const messages = { ...state.messages };
          for (const channel of group.channels) delete messages[channel.id];
          const remaining = state.groups.filter((candidate) => candidate.id !== groupId);
          return {
            groups: remaining,
            messages,
            links: state.links.filter(
              (link) => !group.channels.some((channel) => channel.id === link.channelId),
            ),
            activeGroupId:
              state.activeGroupId === groupId ? (remaining[0]?.id ?? null) : state.activeGroupId,
          };
        });
      },

      setActiveGroupId: (groupId) => set({ activeGroupId: groupId }),

      addChannel: (groupId, name, topic = "") => {
        const trimmed = name.trim().replace(/^#/, "");
        if (trimmed.length === 0) return null;
        const group = get().groups.find((candidate) => candidate.id === groupId);
        if (!group) return null;
        const duplicate = textChannels(group).some(
          (channel) => channel.name.toLowerCase() === trimmed.toLowerCase(),
        );
        if (duplicate) return null;
        const channel = createGroupChannel(trimmed, topic.trim());
        set((state) => ({
          groups: state.groups.map((candidate) =>
            candidate.id === groupId
              ? { ...candidate, channels: [...candidate.channels, channel] }
              : candidate,
          ),
        }));
        return channel.id;
      },

      updateChannel: (groupId, channelId, patch) => {
        set((state) => ({
          groups: state.groups.map((group) =>
            group.id === groupId
              ? {
                  ...group,
                  channels: group.channels.map((channel) =>
                    channel.id === channelId ? { ...channel, ...patch } : channel,
                  ),
                }
              : group,
          ),
        }));
      },

      deleteChannel: (groupId, channelId) => {
        const group = get().groups.find((candidate) => candidate.id === groupId);
        if (!group) return false;
        const channel = group.channels.find((candidate) => candidate.id === channelId);
        if (channel === undefined) return false;
        if (channel.kind !== "dm" && textChannels(group).length <= 1) return false;
        set((state) => {
          const messages = { ...state.messages };
          delete messages[channelId];
          return {
            groups: state.groups.map((candidate) =>
              candidate.id === groupId
                ? {
                    ...candidate,
                    channels: candidate.channels.filter((entry) => entry.id !== channelId),
                  }
                : candidate,
            ),
            messages,
            links: state.links.filter((link) => link.channelId !== channelId),
          };
        });
        return true;
      },

      openDm: (groupId, memberId) => {
        const group = get().groups.find((candidate) => candidate.id === groupId);
        if (group === undefined) return null;
        const member = group.members.find((candidate) => candidate.id === memberId);
        if (member === undefined) return null;
        const existing = dmChannelForMember(group, memberId);
        if (existing !== null) return existing.id;
        const channel = createGroupChannel(
          member.handle,
          `Conversa direta com ${member.name}`,
          "dm",
          memberId,
        );
        set((state) => ({
          groups: state.groups.map((candidate) =>
            candidate.id === groupId
              ? { ...candidate, channels: [...candidate.channels, channel] }
              : candidate,
          ),
        }));
        return channel.id;
      },

      addMember: (groupId, member) => {
        const created = createGroupMember(member);
        set((state) => ({
          groups: state.groups.map((group) =>
            group.id === groupId ? { ...group, members: [...group.members, created] } : group,
          ),
        }));
        return created.id;
      },

      updateMember: (groupId, memberId, patch) => {
        set((state) => ({
          groups: state.groups.map((group) =>
            group.id === groupId
              ? {
                  ...group,
                  members: group.members.map((member) =>
                    member.id === memberId ? { ...member, ...patch } : member,
                  ),
                }
              : group,
          ),
        }));
      },

      removeMember: (groupId, memberId) => {
        const group = get().groups.find((candidate) => candidate.id === groupId);
        const dmChannelIds = new Set(
          (group?.channels ?? [])
            .filter((channel) => channel.kind === "dm" && channel.memberId === memberId)
            .map((channel) => channel.id),
        );
        set((state) => {
          const messages = { ...state.messages };
          for (const channelId of dmChannelIds) delete messages[channelId];
          return {
            groups: state.groups.map((candidate) =>
              candidate.id === groupId
                ? {
                    ...candidate,
                    channels: candidate.channels.filter((channel) => !dmChannelIds.has(channel.id)),
                    members: candidate.members
                      .filter((member) => member.id !== memberId)
                      .map((member) =>
                        member.reportsTo === memberId ? { ...member, reportsTo: null } : member,
                      ),
                  }
                : candidate,
            ),
            messages,
            links: state.links.filter(
              (link) => link.memberId !== memberId && !dmChannelIds.has(link.channelId),
            ),
          };
        });
      },

      startMeeting: (groupId, title) => {
        const meeting: GroupMeeting = {
          id: createId("meeting"),
          title: title?.trim() || "Reunião",
          startedAt: new Date().toISOString(),
          endedAt: null,
          agenda: [],
          notes: "",
          participants: [],
        };
        set((state) => ({
          groups: state.groups.map((group) =>
            group.id === groupId ? { ...group, meetings: [meeting, ...group.meetings] } : group,
          ),
        }));
        return meeting.id;
      },

      updateMeeting: (groupId, meetingId, patch) => {
        set((state) => ({
          groups: state.groups.map((group) =>
            group.id === groupId
              ? {
                  ...group,
                  meetings: group.meetings.map((meeting) =>
                    meeting.id === meetingId ? { ...meeting, ...patch } : meeting,
                  ),
                }
              : group,
          ),
        }));
      },

      deleteMeeting: (groupId, meetingId) => {
        set((state) => ({
          groups: state.groups.map((group) =>
            group.id === groupId
              ? {
                  ...group,
                  meetings: group.meetings.filter((meeting) => meeting.id !== meetingId),
                }
              : group,
          ),
        }));
      },

      addSpace: (groupId, name, icon) => {
        const trimmed = name.trim();
        if (trimmed.length === 0) return null;
        const group = get().groups.find((candidate) => candidate.id === groupId);
        if (group === undefined) return null;
        const duplicate = group.spaces.some(
          (space) => space.name.toLowerCase() === trimmed.toLowerCase(),
        );
        if (duplicate) return null;
        const space = createGroupSpace(trimmed, icon);
        set((state) => ({
          groups: state.groups.map((candidate) =>
            candidate.id === groupId
              ? { ...candidate, spaces: [...candidate.spaces, space] }
              : candidate,
          ),
        }));
        return space.id;
      },

      updateSpace: (groupId, spaceId, patch) => {
        set((state) => ({
          groups: state.groups.map((group) =>
            group.id === groupId
              ? {
                  ...group,
                  spaces: group.spaces.map((space) =>
                    space.id === spaceId ? { ...space, ...patch } : space,
                  ),
                }
              : group,
          ),
        }));
      },

      deleteSpace: (groupId, spaceId) => {
        const group = get().groups.find((candidate) => candidate.id === groupId);
        if (group === undefined) return false;
        if (group.spaces.length <= 1) return false;
        set((state) => ({
          groups: state.groups.map((candidate) =>
            candidate.id === groupId
              ? {
                  ...candidate,
                  spaces: candidate.spaces.filter((space) => space.id !== spaceId),
                  pages: candidate.pages.filter((page) => page.spaceId !== spaceId),
                }
              : candidate,
          ),
        }));
        return true;
      },

      addPage: (groupId, input) => {
        const group = get().groups.find((candidate) => candidate.id === groupId);
        if (group === undefined) return null;
        const spaceId = input.spaceId ?? group.spaces[0]?.id ?? null;
        if (spaceId === null) return null;
        const page = createGroupPage({
          spaceId,
          parentId: input.parentId ?? null,
          title: input.title ?? "Sem título",
          ...(input.icon === undefined ? {} : { icon: input.icon }),
          ...(input.content === undefined ? {} : { content: input.content }),
          ...(input.cover === undefined ? {} : { cover: input.cover }),
          ...(input.tags === undefined ? {} : { tags: input.tags }),
          ...(input.mode === undefined ? {} : { mode: input.mode }),
          ...(input.dailyKey === undefined ? {} : { dailyKey: input.dailyKey }),
        });
        set((state) => ({
          groups: state.groups.map((candidate) =>
            candidate.id === groupId
              ? { ...candidate, pages: [...candidate.pages, page] }
              : candidate,
          ),
        }));
        return page.id;
      },

      updatePage: (groupId, pageId, patch) => {
        set((state) => ({
          groups: state.groups.map((group) =>
            group.id === groupId
              ? {
                  ...group,
                  pages: group.pages.map((page) =>
                    page.id === pageId
                      ? { ...page, ...patch, updatedAt: new Date().toISOString() }
                      : page,
                  ),
                }
              : group,
          ),
        }));
      },

      deletePage: (groupId, pageId) => {
        const group = get().groups.find((candidate) => candidate.id === groupId);
        if (group === undefined) return;
        const doomed = pageSubtree(group.pages, pageId);
        const deletedAt = new Date().toISOString();
        set((state) => ({
          groups: state.groups.map((candidate) =>
            candidate.id === groupId
              ? {
                  ...candidate,
                  pages: candidate.pages.map((page) =>
                    doomed.has(page.id) && page.deletedAt === null
                      ? { ...page, deletedAt, favorite: false }
                      : page,
                  ),
                }
              : candidate,
          ),
        }));
      },

      restorePage: (groupId, pageId) => {
        const group = get().groups.find((candidate) => candidate.id === groupId);
        const page = group?.pages.find((candidate) => candidate.id === pageId);
        if (group === undefined || page === undefined || page.deletedAt === null) return false;
        const restored = pageSubtree(group.pages, pageId);
        const parentDeleted =
          page.parentId !== null &&
          (group.pages.find((candidate) => candidate.id === page.parentId)?.deletedAt ?? null) !==
            null;
        set((state) => ({
          groups: state.groups.map((candidate) =>
            candidate.id === groupId
              ? {
                  ...candidate,
                  pages: candidate.pages.map((entry) =>
                    entry.id === pageId
                      ? {
                          ...entry,
                          deletedAt: null,
                          parentId: parentDeleted ? null : entry.parentId,
                        }
                      : restored.has(entry.id)
                        ? { ...entry, deletedAt: null }
                        : entry,
                  ),
                }
              : candidate,
          ),
        }));
        return true;
      },

      deletePageForever: (groupId, pageId) => {
        const group = get().groups.find((candidate) => candidate.id === groupId);
        if (group === undefined) return;
        const doomed = pageSubtree(group.pages, pageId);
        set((state) => ({
          groups: state.groups.map((candidate) =>
            candidate.id === groupId
              ? {
                  ...candidate,
                  pages: candidate.pages
                    .filter((page) => !doomed.has(page.id))
                    .map((page) =>
                      page.parentId !== null && doomed.has(page.parentId)
                        ? { ...page, parentId: null }
                        : page,
                    ),
                }
              : candidate,
          ),
        }));
      },

      emptyPageTrash: (groupId) => {
        set((state) => ({
          groups: state.groups.map((candidate) =>
            candidate.id === groupId
              ? {
                  ...candidate,
                  pages: candidate.pages.filter((page) => page.deletedAt === null),
                }
              : candidate,
          ),
        }));
      },

      duplicatePage: (groupId, pageId) => {
        const group = get().groups.find((candidate) => candidate.id === groupId);
        const source = group?.pages.find((candidate) => candidate.id === pageId);
        if (group === undefined || source === undefined) return null;
        const ids = new Map<string, string>();
        const doomed = pageSubtree(group.pages, pageId);
        for (const id of doomed) ids.set(id, createId("page"));
        const now = new Date().toISOString();
        const copies = group.pages
          .filter((page) => doomed.has(page.id))
          .map((page): GroupPage => {
            const copyId = ids.get(page.id) ?? createId("page");
            return {
              ...page,
              id: copyId,
              parentId:
                page.id === pageId ? source.parentId : (ids.get(page.parentId ?? "") ?? null),
              title: page.id === pageId ? `${page.title} (cópia)` : page.title,
              favorite: false,
              dailyKey: null,
              deletedAt: null,
              createdAt: now,
              updatedAt: now,
            };
          });
        const rootId = ids.get(pageId) ?? null;
        if (rootId === null) return null;
        set((state) => ({
          groups: state.groups.map((candidate) =>
            candidate.id === groupId
              ? { ...candidate, pages: [...candidate.pages, ...copies] }
              : candidate,
          ),
        }));
        return rootId;
      },

      ensureDailyPage: (groupId, spaceId) => {
        const group = get().groups.find((candidate) => candidate.id === groupId);
        if (group === undefined) return null;
        const key = dailyKeyFor(new Date());
        const existing = group.pages.find((page) => page.dailyKey === key);
        if (existing !== undefined) {
          if (existing.deletedAt !== null) get().restorePage(groupId, existing.id);
          return existing.id;
        }
        const targetSpaceId = spaceId ?? group.spaces[0]?.id ?? null;
        if (targetSpaceId === null) return null;
        const page = createGroupPage({
          spaceId: targetSpaceId,
          parentId: null,
          title: dailyPageTitle(key),
          icon: "🗓️",
          content: dailyPageContent(key),
          dailyKey: key,
        });
        set((state) => ({
          groups: state.groups.map((candidate) =>
            candidate.id === groupId
              ? { ...candidate, pages: [...candidate.pages, page] }
              : candidate,
          ),
        }));
        return page.id;
      },

      togglePageFavorite: (groupId, pageId) => {
        set((state) => ({
          groups: state.groups.map((group) =>
            group.id === groupId
              ? {
                  ...group,
                  pages: group.pages.map((page) =>
                    page.id === pageId ? { ...page, favorite: !page.favorite } : page,
                  ),
                }
              : group,
          ),
        }));
      },

      addPerson: (groupId, person) => {
        const name = person.name.trim();
        if (name.length === 0) return null;
        const group = get().groups.find((candidate) => candidate.id === groupId);
        if (group === undefined) return null;
        const handle = uniquePersonHandle(person.handle || name, [
          ...group.people,
          ...group.members,
        ]);
        const created = createGroupPerson({
          name,
          handle,
          ...(person.role === undefined ? {} : { role: person.role }),
          ...(person.accent === undefined ? {} : { accent: person.accent }),
        });
        set((state) => ({
          groups: state.groups.map((candidate) =>
            candidate.id === groupId
              ? { ...candidate, people: [...candidate.people, created] }
              : candidate,
          ),
        }));
        return created.id;
      },

      updatePerson: (groupId, personId, patch) => {
        set((state) => ({
          groups: state.groups.map((group) =>
            group.id === groupId
              ? {
                  ...group,
                  people: group.people.map((person) =>
                    person.id === personId ? { ...person, ...patch } : person,
                  ),
                }
              : group,
          ),
        }));
      },

      removePerson: (groupId, personId) => {
        const group = get().groups.find((candidate) => candidate.id === groupId);
        const person = group?.people.find((candidate) => candidate.id === personId);
        if (group === undefined || person === undefined || person.isOwner) return false;
        set((state) => ({
          groups: state.groups.map((candidate) =>
            candidate.id === groupId
              ? {
                  ...candidate,
                  people: candidate.people.filter((entry) => entry.id !== personId),
                  members: candidate.members.map((member) =>
                    member.personId === personId ? { ...member, personId: null } : member,
                  ),
                  bindings: candidate.bindings.filter((binding) => binding.personId !== personId),
                }
              : candidate,
          ),
        }));
        return true;
      },

      addBinding: (groupId, binding) => {
        const group = get().groups.find((candidate) => candidate.id === groupId);
        if (group === undefined) return null;
        if (!group.members.some((member) => member.id === binding.memberId)) return null;
        const duplicate = group.bindings.some(
          (entry) =>
            entry.memberId === binding.memberId &&
            entry.personId === binding.personId &&
            entry.instanceId === binding.instanceId &&
            entry.model === binding.model,
        );
        if (duplicate) return null;
        const created: GroupAgentBinding = {
          ...binding,
          id: createId("binding"),
          createdAt: new Date().toISOString(),
        };
        set((state) => ({
          groups: state.groups.map((candidate) =>
            candidate.id === groupId
              ? { ...candidate, bindings: [...candidate.bindings, created] }
              : candidate,
          ),
        }));
        return created.id;
      },

      removeBinding: (groupId, bindingId) => {
        set((state) => ({
          groups: state.groups.map((group) =>
            group.id === groupId
              ? {
                  ...group,
                  bindings: group.bindings.filter((binding) => binding.id !== bindingId),
                }
              : group,
          ),
        }));
      },

      importGroupShare: (payload) => {
        const remote = payload.group;
        const existing = get().groups.find((group) => group.id === remote.id) ?? null;
        const merged = existing === null ? remote : mergeGroups(existing, remote);
        set((state) => {
          const groups =
            existing === null
              ? [...state.groups, merged]
              : state.groups.map((group) => (group.id === merged.id ? merged : group));
          return {
            groups,
            messages: mergeMessages(state.messages, payload.messages),
            activeGroupId: merged.id,
          };
        });
        return merged.id;
      },

      addMessage: (message) => {
        set((state) => ({
          messages: {
            ...state.messages,
            [message.channelId]: [...(state.messages[message.channelId] ?? []), message],
          },
        }));
      },

      appendUserMessage: ({ channelId, text, authorName = "Você" }) => {
        const message: GroupMessage = {
          id: createId("message"),
          channelId,
          kind: "user",
          authorId: null,
          authorName,
          text,
          createdAt: new Date().toISOString(),
        };
        get().addMessage(message);
        return message;
      },

      appendSystemMessage: (channelId, text) => {
        get().addMessage({
          id: createId("message"),
          channelId,
          kind: "system",
          authorId: null,
          authorName: "Sistema",
          text,
          createdAt: new Date().toISOString(),
        });
      },

      upsertAgentMessage: (message) => {
        set((state) => {
          const existing = state.messages[message.channelId] ?? [];
          const index = existing.findIndex((candidate) => candidate.sourceId === message.sourceId);
          if (index === -1) {
            return {
              messages: {
                ...state.messages,
                [message.channelId]: [...existing, message],
              },
            };
          }
          const current = existing[index];
          if (current === undefined) return state;
          if (current.text === message.text && current.streaming === message.streaming)
            return state;
          const next = [...existing];
          next[index] = { ...current, text: message.text, streaming: message.streaming ?? false };
          return { messages: { ...state.messages, [message.channelId]: next } };
        });
      },

      clearChannelMessages: (channelId) => {
        set((state) => {
          const messages = { ...state.messages };
          delete messages[channelId];
          return { messages };
        });
      },

      upsertThreadLink: (link) => {
        set((state) => {
          const index = state.links.findIndex(
            (candidate) =>
              candidate.channelId === link.channelId && candidate.memberId === link.memberId,
          );
          if (index === -1) return { links: [...state.links, link] };
          const next = [...state.links];
          next[index] = link;
          return { links: next };
        });
      },

      removeThreadLinksForMember: (memberId) => {
        set((state) => ({ links: state.links.filter((link) => link.memberId !== memberId) }));
      },

      updateSettings: (patch) => {
        set((state) => ({ settings: { ...state.settings, ...patch } }));
      },

      resetAll: () => {
        set({
          groups: [],
          activeGroupId: null,
          messages: {},
          links: [],
          settings: DEFAULT_GROUP_SETTINGS,
        });
      },
    }),
    {
      name: GROUPS_STORAGE_KEY,
      version: GROUPS_STORAGE_VERSION,
      storage: createJSONStorage(() =>
        resolveStorage(typeof window !== "undefined" ? window.localStorage : undefined),
      ),
      migrate: (persisted) => {
        const state = persisted as { groups?: unknown } | null;
        return { ...state, groups: normalizeGroups(state?.groups) } as unknown as GroupsState;
      },
      // Older builds, and HMR reloads that bumped the version without re-running `migrate`,
      // can leave groups without spaces/pages/people. Normalize on every rehydration.
      merge: (persisted, current) => {
        const state = persisted as { groups?: unknown } | null;
        return {
          ...current,
          ...(persisted as Partial<GroupsState> | null),
          groups: normalizeGroups(state?.groups),
        };
      },
      partialize: (state) => ({
        groups: state.groups,
        activeGroupId: state.activeGroupId,
        messages: state.messages,
        links: state.links,
        settings: state.settings,
      }),
    },
  ),
);

export function useGroups(): Group[] {
  return useGroupsStore((state) => state.groups);
}
