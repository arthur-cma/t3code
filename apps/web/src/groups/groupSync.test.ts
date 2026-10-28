import { describe, expect, it } from "vite-plus/test";

import {
  buildSharePayload,
  decodeGroupShare,
  encodeGroupShare,
  mergeGroups,
  mergeMessages,
} from "./groupSync";
import type { Group, GroupMessage } from "./types";

function baseGroup(overrides: Partial<Group> = {}): Group {
  return {
    id: "group_1",
    name: "Estúdio",
    description: "Time de produto",
    accent: "violet",
    replyMode: "mentions",
    runtimeMode: "full-access",
    projectRef: null,
    channels: [{ id: "channel_1", name: "geral", topic: "", kind: "text", memberId: null }],
    members: [
      {
        id: "member_1",
        name: "Ana",
        handle: "ana",
        instanceId: "codex",
        driverKind: "codex",
        model: "gpt-5",
        autoRespond: true,
        role: "Design",
        reportsTo: null,
        personId: null,
      },
    ],
    meetings: [],
    spaces: [{ id: "space_1", name: "Geral", icon: "📁", createdAt: "2026-01-01T00:00:00.000Z" }],
    pages: [],
    people: [
      {
        id: "person_1",
        name: "Você",
        handle: "voce",
        accent: "slate",
        role: "Proprietário",
        isOwner: true,
        joinedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    bindings: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function message(id: string, channelId: string, createdAt: string): GroupMessage {
  return {
    id,
    channelId,
    kind: "user",
    authorId: null,
    authorName: "Você",
    text: id,
    createdAt,
  };
}

describe("groupSync", () => {
  it("round-trips a share code", () => {
    const group = baseGroup();
    const code = encodeGroupShare(
      buildSharePayload(group, {
        channel_1: [message("m1", "channel_1", "2026-01-01T00:00:00.000Z")],
      }),
    );

    expect(code.startsWith("T3G1.")).toBe(true);
    const decoded = decodeGroupShare(code);
    expect(decoded?.group.id).toBe("group_1");
    expect(decoded?.group.members.map((member) => member.handle)).toEqual(["ana"]);
    expect(decoded?.messages.channel_1?.map((entry) => entry.id)).toEqual(["m1"]);
  });

  it("rejects codes from another format", () => {
    expect(decodeGroupShare("T3G1.nao-e-base64")).toBeNull();
    expect(decodeGroupShare("outro-formato")).toBeNull();
  });

  it("keeps streaming messages out of the invite", () => {
    const group = baseGroup();
    const payload = buildSharePayload(group, {
      channel_1: [
        message("m1", "channel_1", "2026-01-01T00:00:00.000Z"),
        { ...message("m2", "channel_1", "2026-01-01T00:01:00.000Z"), streaming: true },
      ],
      channel_orfa: [message("m3", "channel_orfa", "2026-01-01T00:02:00.000Z")],
    });

    expect(Object.keys(payload.messages)).toEqual(["channel_1"]);
    expect(payload.messages.channel_1?.map((entry) => entry.id)).toEqual(["m1"]);
  });

  it("merges groups without dropping either side", () => {
    const local = baseGroup({
      pages: [
        {
          id: "page_1",
          spaceId: "space_1",
          parentId: null,
          title: "Roadmap",
          icon: "📄",
          content: "local",
          favorite: false,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z",
        },
      ],
    });
    const remote = baseGroup({
      channels: [
        { id: "channel_1", name: "geral", topic: "", kind: "text", memberId: null },
        { id: "channel_2", name: "design", topic: "", kind: "text", memberId: null },
      ],
      pages: [
        {
          id: "page_1",
          spaceId: "space_1",
          parentId: null,
          title: "Roadmap",
          icon: "📄",
          content: "remoto mais novo",
          favorite: true,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-03T00:00:00.000Z",
        },
      ],
      people: [
        ...local.people,
        {
          id: "person_2",
          name: "Bruno",
          handle: "bruno",
          accent: "emerald",
          role: "Produto",
          isOwner: false,
          joinedAt: "2026-01-04T00:00:00.000Z",
        },
      ],
    });

    const merged = mergeGroups(local, remote);

    expect(merged.channels.map((channel) => channel.id)).toEqual(["channel_1", "channel_2"]);
    expect(merged.people.map((person) => person.id)).toEqual(["person_1", "person_2"]);
    expect(merged.pages[0]?.content).toBe("remoto mais novo");
    expect(merged.pages[0]?.favorite).toBe(true);
  });

  it("merges message history by id and keeps chronological order", () => {
    const merged = mergeMessages(
      { channel_1: [message("m2", "channel_1", "2026-01-01T00:02:00.000Z")] },
      {
        channel_1: [
          message("m1", "channel_1", "2026-01-01T00:01:00.000Z"),
          message("m2", "channel_1", "2026-01-01T00:02:00.000Z"),
        ],
      },
    );

    expect(merged.channel_1?.map((entry) => entry.id)).toEqual(["m1", "m2"]);
  });
});
