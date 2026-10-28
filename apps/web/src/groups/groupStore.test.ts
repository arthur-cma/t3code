import { beforeEach, describe, expect, it } from "vite-plus/test";

import { channelMessages, normalizeGroups, useGroupsStore } from "./groupStore";
import { DEFAULT_GROUP_SETTINGS } from "./types";

const store = () => useGroupsStore.getState();

function createGroup() {
  return store().createGroup({
    name: "Estúdio",
    description: "Time de produto",
    projectRef: { environmentId: "env_1", projectId: "project_1" },
  });
}

describe("groupStore", () => {
  beforeEach(() => {
    store().resetAll();
  });

  it("creates a group with a default channel and accent", () => {
    const groupId = createGroup();
    const group = store().groups.find((candidate) => candidate.id === groupId);

    expect(group).toBeDefined();
    expect(group?.channels.map((channel) => channel.name)).toEqual(["geral"]);
    expect(group?.accent).toBe("violet");
    expect(store().activeGroupId).toBe(groupId);
    expect(store().settings).toEqual(DEFAULT_GROUP_SETTINGS);
  });

  it("rejects duplicate and empty channel names", () => {
    const groupId = createGroup();
    expect(store().addChannel(groupId, "geral")).toBeNull();
    expect(store().addChannel(groupId, "   ")).toBeNull();

    const channelId = store().addChannel(groupId, "#design", "Trabalho visual");
    expect(channelId).not.toBeNull();
    expect(
      store()
        .groups.find((group) => group.id === groupId)
        ?.channels.map((channel) => channel.name),
    ).toEqual(["geral", "design"]);
  });

  it("keeps at least one channel per group", () => {
    const groupId = createGroup();
    const group = store().groups.find((candidate) => candidate.id === groupId);
    const channelId = group?.channels[0]?.id ?? "";

    expect(store().deleteChannel(groupId, channelId)).toBe(false);

    const secondChannelId = store().addChannel(groupId, "design") ?? "";
    expect(store().deleteChannel(groupId, secondChannelId)).toBe(true);
  });

  it("adds, updates and removes members", () => {
    const groupId = createGroup();
    const memberId = store().addMember(groupId, {
      name: "Ana",
      handle: "ana",
      instanceId: "codex",
      driverKind: "codex",
      model: "gpt-5",
      autoRespond: true,
      role: "Design",
      reportsTo: null,
      personId: null,
    });

    expect(store().groups[0]?.members).toHaveLength(1);

    store().updateMember(groupId, memberId, { autoRespond: false, name: "Ana Paula" });
    expect(store().groups[0]?.members[0]).toMatchObject({ name: "Ana Paula", autoRespond: false });

    store().removeMember(groupId, memberId);
    expect(store().groups[0]?.members).toHaveLength(0);
  });

  it("deduplicates streamed agent replies by source id", () => {
    const groupId = createGroup();
    const channelId = store().groups.find((group) => group.id === groupId)?.channels[0]?.id ?? "";
    const base = {
      id: "agent:source_1",
      channelId,
      kind: "agent" as const,
      authorId: "member_1",
      authorName: "Ana",
      createdAt: "2026-01-01T00:00:00.000Z",
      sourceId: "thread_1:message_1",
    };

    store().upsertAgentMessage({ ...base, text: "Primeira parte", streaming: true });
    store().upsertAgentMessage({ ...base, text: "Resposta completa", streaming: false });

    const messages = channelMessages(store().messages, channelId);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ text: "Resposta completa", streaming: false });
  });

  it("deletes the group transcript and thread links with the group", () => {
    const groupId = createGroup();
    const channelId = store().groups.find((group) => group.id === groupId)?.channels[0]?.id ?? "";

    store().appendUserMessage({ channelId, text: "Olá" });
    store().upsertThreadLink({
      channelId,
      memberId: "member_1",
      environmentId: "env_1",
      threadId: "thread_1",
      since: "2026-01-01T00:00:00.000Z",
    });

    store().deleteGroup(groupId);

    expect(store().groups).toHaveLength(0);
    expect(store().messages[channelId]).toBeUndefined();
    expect(store().links).toHaveLength(0);
    expect(store().activeGroupId).toBeNull();
  });

  it("adds people, connects their AIs and removes them safely", () => {
    const groupId = createGroup();
    const owner = store().groups[0]?.people[0];
    expect(owner?.isOwner).toBe(true);

    const personId = store().addPerson(groupId, {
      name: "Bruno",
      handle: "bruno",
      role: "Produto",
    });
    expect(personId).not.toBeNull();
    expect(store().addPerson(groupId, { name: "   ", handle: "" })).toBeNull();

    const memberId = store().addMember(groupId, {
      name: "Ana",
      handle: "ana",
      instanceId: "codex",
      driverKind: "codex",
      model: "gpt-5",
      autoRespond: true,
      role: "Design",
      reportsTo: null,
      personId: null,
    });

    store().updateMember(groupId, memberId, { personId });
    const bindingId = store().addBinding(groupId, {
      memberId,
      personId: personId ?? "",
      instanceId: "codex",
      driverKind: "codex",
      model: "gpt-5",
      label: "Bruno · Codex",
    });
    expect(bindingId).not.toBeNull();
    expect(
      store().addBinding(groupId, {
        memberId,
        personId: personId ?? "",
        instanceId: "codex",
        driverKind: "codex",
        model: "gpt-5",
        label: "Bruno · Codex",
      }),
    ).toBeNull();

    expect(store().removePerson(groupId, owner?.id ?? "")).toBe(false);
    expect(store().removePerson(groupId, personId ?? "")).toBe(true);

    const group = store().groups.find((candidate) => candidate.id === groupId);
    expect(group?.people.map((person) => person.id)).not.toContain(personId);
    expect(group?.bindings).toHaveLength(0);
    expect(group?.members[0]?.personId).toBeNull();
  });

  it("imports an invite and merges it into the existing group", () => {
    const groupId = createGroup();
    const group = store().groups.find((candidate) => candidate.id === groupId);
    expect(group).toBeDefined();
    if (group === undefined) return;

    const channelId = group.channels[0]?.id ?? "";
    store().appendUserMessage({ channelId, text: "Bem-vindo" });

    const imported = store().importGroupShare({
      kind: "t3code.group.share",
      version: 1,
      exportedAt: "2026-01-01T00:00:00.000Z",
      group: {
        ...group,
        channels: [
          ...group.channels,
          { id: "channel_novo", name: "design", topic: "", kind: "text", memberId: null },
        ],
      },
      messages: {
        channel_novo: [
          {
            id: "message_novo",
            channelId: "channel_novo",
            kind: "user",
            authorId: null,
            authorName: "Bruno",
            text: "Oi",
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      },
    });

    expect(imported).toBe(groupId);
    expect(store().groups).toHaveLength(1);
    expect(store().groups[0]?.channels.map((channel) => channel.name)).toEqual(["geral", "design"]);
    expect(store().messages.channel_novo).toHaveLength(1);
    expect(store().activeGroupId).toBe(groupId);
  });

  it("repairs groups persisted before spaces, pages and people existed", () => {
    const legacy = {
      id: "group_antigo",
      name: "Estúdio",
      description: "Time",
      accent: "emerald",
      replyMode: "mentions",
      runtimeMode: "full-access",
      projectRef: null,
      channels: [{ id: "channel_1", name: "geral", topic: "" }],
      members: [
        {
          id: "member_1",
          name: "Ana",
          handle: "ana",
          instanceId: "codex",
          driverKind: "codex",
          model: "gpt-5",
          autoRespond: true,
        },
      ],
      meetings: [],
      createdAt: "2026-01-01T00:00:00.000Z",
    };

    const [group] = normalizeGroups([legacy]);
    expect(group?.channels[0]).toMatchObject({ kind: "text", memberId: null });
    expect(group?.members[0]).toMatchObject({ role: "", reportsTo: null, personId: null });
    expect(group?.spaces).toHaveLength(1);
    expect(group?.pages).toEqual([]);
    expect(group?.people[0]).toMatchObject({ isOwner: true, handle: "voce" });
    expect(group?.bindings).toEqual([]);

    // Deterministic ids keep repeated repairs from duplicating records.
    const [again] = normalizeGroups([legacy]);
    expect(again?.spaces[0]?.id).toBe(group?.spaces[0]?.id);
    expect(again?.people[0]?.id).toBe(group?.people[0]?.id);

    expect(normalizeGroups(null)).toEqual([]);
    expect(normalizeGroups([{ name: "sem id" }])).toEqual([]);
  });

  it("normalizes persisted groups on every rehydration", () => {
    const options = useGroupsStore.persist.getOptions();
    const merged = options.merge?.(
      {
        groups: [
          {
            id: "group_antigo",
            name: "Estúdio",
            channels: [{ id: "channel_1", name: "geral", topic: "" }],
          },
        ],
        messages: {},
      },
      useGroupsStore.getState(),
    );

    expect(merged?.groups[0]?.pages).toEqual([]);
    expect(merged?.groups[0]?.spaces).toHaveLength(1);
    expect(merged?.groups[0]?.people).toHaveLength(1);
  });

  it("updates settings and resets everything", () => {
    createGroup();
    store().updateSettings({ defaultReplyMode: "auto", includeGroupContext: false });

    expect(store().settings.defaultReplyMode).toBe("auto");
    expect(store().settings.includeGroupContext).toBe(false);

    store().resetAll();
    expect(store().groups).toHaveLength(0);
    expect(store().settings).toEqual(DEFAULT_GROUP_SETTINGS);
  });
});
