import { describe, expect, it } from "vite-plus/test";

import {
  buildAgentPrompt,
  groupInitials,
  mentionCandidates,
  normalizeHandle,
  parseMentions,
  resolveResponders,
  uniqueHandle,
} from "./groupLogic";
import type { Group, GroupChannel, GroupMember } from "./types";

const channel: GroupChannel = {
  id: "channel_1",
  name: "geral",
  topic: "",
  kind: "text",
  memberId: null,
};

function member(overrides: Partial<GroupMember> & Pick<GroupMember, "id" | "handle">): GroupMember {
  return {
    name: overrides.id,
    instanceId: "codex",
    driverKind: "codex",
    model: "gpt-5",
    autoRespond: false,
    role: "",
    reportsTo: null,
    personId: null,
    ...overrides,
  };
}

const ana = member({ id: "ana", handle: "ana", name: "Ana" });
const bia = member({ id: "bia", handle: "bia", name: "Bia", autoRespond: true });

function group(members: GroupMember[]): Group {
  return {
    id: "group_1",
    name: "Estúdio",
    description: "Time de produto",
    accent: "violet",
    replyMode: "mentions",
    runtimeMode: "full-access",
    projectRef: null,
    channels: [channel],
    members,
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
  };
}

describe("groupLogic", () => {
  it("normalizes accents and punctuation into handles", () => {
    expect(normalizeHandle("  João Pedro!! ")).toBe("joao-pedro");
    expect(normalizeHandle("###")).toBe("");
    expect(uniqueHandle("ana", ["ana", "ana-2"])).toBe("ana-3");
  });

  it("offers agents and people as mention candidates", () => {
    const studio = group([ana, bia]);
    const all = mentionCandidates(studio, "");
    expect(all.map((candidate) => `${candidate.kind}:${candidate.handle}`)).toEqual([
      "agent:ana",
      "agent:bia",
      "person:voce",
    ]);
    expect(mentionCandidates(studio, "vo").map((candidate) => candidate.handle)).toEqual(["voce"]);
    expect(mentionCandidates(studio, "zzz")).toEqual([]);
  });

  it("finds mentions case-insensitively and ignores unknown handles", () => {
    expect(parseMentions("@ANA revisa isso com @carla e @bia", [ana, bia])).toEqual([ana, bia]);
    expect(parseMentions("sem menções", [ana])).toEqual([]);
  });

  it("only answers mentioned agents in mentions mode", () => {
    expect(
      resolveResponders({ members: [ana, bia], text: "@ana olha isso", replyMode: "mentions" }),
    ).toEqual([ana]);
    expect(
      resolveResponders({ members: [ana, bia], text: "olha isso", replyMode: "mentions" }),
    ).toEqual([]);
  });

  it("answers automatic members in auto mode, falling back to everyone", () => {
    expect(resolveResponders({ members: [ana, bia], text: "oi", replyMode: "auto" })).toEqual([
      bia,
    ]);
    expect(
      resolveResponders({
        members: [ana, { ...bia, autoRespond: false }],
        text: "oi",
        replyMode: "auto",
      }),
    ).toEqual([ana, { ...bia, autoRespond: false }]);
    expect(resolveResponders({ members: [ana, bia], text: "@ana oi", replyMode: "auto" })).toEqual([
      ana,
      bia,
    ]);
  });

  it("builds new-thread context with rendered mentions", () => {
    const prompt = buildAgentPrompt({
      group: group([ana, bia]),
      channel,
      member: ana,
      text: "@bia revisa",
      isNewThread: true,
      includeGroupContext: true,
    });
    expect(prompt).toContain('grupo "Estúdio"');
    expect(prompt).toContain("Canal atual: #geral");
    expect(prompt).toContain("@Bia revisa");
    expect(prompt).not.toContain("@bia revisa");

    expect(
      buildAgentPrompt({
        group: group([ana, bia]),
        channel,
        member: ana,
        text: "continua",
        isNewThread: false,
        includeGroupContext: true,
      }),
    ).toBe("continua");
  });

  it("derives initials from the group name", () => {
    expect(groupInitials("Estúdio Norte")).toBe("EN");
    expect(groupInitials("Grupo")).toBe("GR");
    expect(groupInitials("   ")).toBe("?");
  });
});
