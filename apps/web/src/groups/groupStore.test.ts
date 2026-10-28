import { beforeEach, describe, expect, it } from "vite-plus/test";

import { channelMessages, useGroupsStore } from "./groupStore";
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
