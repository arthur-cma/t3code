import type { EnvironmentId, ThreadId } from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import * as Option from "effect/Option";
import { useEffect } from "react";

import { useEnvironmentThread } from "../state/threads";
import { useGroupsStore } from "./groupStore";
import type { GroupThreadLink } from "./types";

export interface GroupReplyLink {
  link: GroupThreadLink;
  memberName: string;
  memberModel: string | null;
  memberDriverKind: string | null;
}

export function GroupThreadSync({ replies }: { replies: ReadonlyArray<GroupReplyLink> }) {
  return (
    <>
      {replies.map((reply) => (
        <ThreadReplySync key={`${reply.link.channelId}:${reply.link.memberId}`} reply={reply} />
      ))}
    </>
  );
}

function ThreadReplySync({ reply }: { reply: GroupReplyLink }) {
  const { link, memberName, memberModel, memberDriverKind } = reply;
  const state = useEnvironmentThread(
    link.environmentId as EnvironmentId,
    link.threadId as ThreadId,
  );
  const projection = Option.getOrNull(state.data);
  const upsertAgentMessage = useGroupsStore((store) => store.upsertAgentMessage);

  // The group transcript mirrors assistant messages from each linked T3 thread.
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- mirrors provider output into the persisted group transcript
  useEffect(() => {
    if (projection === null) return;
    const sinceMillis = Date.parse(link.since);
    for (const message of projection.messages) {
      if (message.role !== "assistant") continue;
      if (DateTime.toEpochMillis(message.createdAt) < sinceMillis) continue;
      if (message.text.trim().length === 0 && !message.streaming) continue;
      const sourceId = `${link.threadId}:${message.id}`;
      upsertAgentMessage({
        id: `agent:${sourceId}`,
        channelId: link.channelId,
        kind: "agent",
        authorId: link.memberId,
        authorName: memberName,
        model: memberModel,
        driverKind: memberDriverKind,
        text: message.text,
        createdAt: DateTime.formatIso(message.createdAt),
        streaming: message.streaming,
        sourceId,
      });
    }
  }, [link, memberDriverKind, memberName, memberModel, projection, upsertAgentMessage]);

  return null;
}
