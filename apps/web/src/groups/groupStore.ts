import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { resolveStorage } from "../lib/storage";
import { randomUUID } from "../lib/utils";
import {
  DEFAULT_GROUP_SETTINGS,
  GROUP_ACCENTS,
  type Group,
  type GroupAccent,
  type GroupChannel,
  type GroupMember,
  type GroupMessage,
  type GroupProjectRef,
  type GroupSettings,
  type GroupThreadLink,
} from "./types";

const GROUPS_STORAGE_KEY = "t3code:groups:v1";
const GROUPS_STORAGE_VERSION = 1;

function createId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

function createGroupChannel(name: string, topic = ""): GroupChannel {
  return { id: createId("channel"), name, topic };
}

function createGroupMember(member: Omit<GroupMember, "id">): GroupMember {
  return { ...member, id: createId("member") };
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

  addMember: (groupId: string, member: Omit<GroupMember, "id">) => string;
  updateMember: (
    groupId: string,
    memberId: string,
    patch: Partial<Omit<GroupMember, "id">>,
  ) => void;
  removeMember: (groupId: string, memberId: string) => void;

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
        const duplicate = group.channels.some(
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
        if (!group || group.channels.length <= 1) return false;
        set((state) => {
          const messages = { ...state.messages };
          delete messages[channelId];
          return {
            groups: state.groups.map((candidate) =>
              candidate.id === groupId
                ? {
                    ...candidate,
                    channels: candidate.channels.filter((channel) => channel.id !== channelId),
                  }
                : candidate,
            ),
            messages,
            links: state.links.filter((link) => link.channelId !== channelId),
          };
        });
        return true;
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
        set((state) => ({
          groups: state.groups.map((group) =>
            group.id === groupId
              ? { ...group, members: group.members.filter((member) => member.id !== memberId) }
              : group,
          ),
          links: state.links.filter((link) => link.memberId !== memberId),
        }));
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
