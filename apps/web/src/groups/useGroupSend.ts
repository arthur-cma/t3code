import type { EnvironmentProject } from "@t3tools/client-runtime/state/models";
import type {
  EnvironmentId,
  ModelSelection,
  ProviderInstanceId,
  ThreadId,
} from "@t3tools/contracts";
import { useState } from "react";

import { newMessageId, newThreadId } from "../lib/utils";
import { useOrchestrationCommand } from "../state/use-orchestration-command";
import { threadEnvironment } from "../state/threads";
import { buildAgentPrompt, resolveResponders, truncateTitle } from "./groupLogic";
import { useGroupsStore } from "./groupStore";
import type { Group, GroupChannel, GroupMember } from "./types";

function isFailure(result: { readonly _tag: string }): boolean {
  return result._tag === "Failure";
}

export function useGroupSend(
  group: Group,
  channel: GroupChannel,
  project: EnvironmentProject | null,
) {
  const createThread = useOrchestrationCommand(threadEnvironment.create, { reportFailure: false });
  const startTurn = useOrchestrationCommand(threadEnvironment.startTurn, { reportFailure: false });
  const [sending, setSending] = useState(false);

  const sendToMember = async (
    member: GroupMember,
    text: string,
    environmentId: EnvironmentId,
    targetProject: EnvironmentProject,
  ): Promise<void> => {
    const store = useGroupsStore.getState();
    const existingLink =
      store.links.find((link) => link.channelId === channel.id && link.memberId === member.id) ??
      null;
    const threadId = existingLink === null ? newThreadId() : (existingLink.threadId as ThreadId);
    const isNewThread = existingLink === null;
    const prompt = buildAgentPrompt({
      group,
      channel,
      member,
      text,
      isNewThread,
      includeGroupContext: store.settings.includeGroupContext,
    });
    const modelSelection: ModelSelection = {
      instanceId: member.instanceId as ProviderInstanceId,
      model: member.model,
    };

    if (isNewThread) {
      const created = await createThread({
        environmentId,
        input: {
          threadId,
          projectId: targetProject.id,
          title: truncateTitle(`Grupo ${group.name} · #${channel.name}`),
          modelSelection,
          runtimeMode: group.runtimeMode,
          interactionMode: "default",
          branch: null,
          worktreePath: null,
        },
      });
      if (isFailure(created)) {
        store.appendSystemMessage(channel.id, `${member.name}: não foi possível iniciar o agente.`);
        return;
      }
      store.upsertThreadLink({
        channelId: channel.id,
        memberId: member.id,
        environmentId: targetProject.environmentId,
        threadId,
        since: new Date().toISOString(),
      });
    }

    const sent = await startTurn({
      environmentId,
      input: {
        threadId,
        message: {
          messageId: newMessageId(),
          role: "user",
          text: prompt,
          attachments: [],
        },
        modelSelection,
        runtimeMode: group.runtimeMode,
        interactionMode: "default",
        dispatchMode: "start",
      },
    });
    if (isFailure(sent)) {
      store.appendSystemMessage(channel.id, `${member.name}: falha ao enviar a mensagem.`);
    }
  };

  const send = async (text: string): Promise<void> => {
    const trimmed = text.trim();
    if (trimmed.length === 0 || sending) return;

    const store = useGroupsStore.getState();
    store.appendUserMessage({ channelId: channel.id, text: trimmed });

    if (group.members.length === 0) {
      store.appendSystemMessage(
        channel.id,
        "Nenhum agente participa deste grupo ainda. Abra as configurações do grupo para adicionar um.",
      );
      return;
    }

    const recipients = resolveResponders({
      members: group.members,
      text: trimmed,
      replyMode: group.replyMode,
    });
    if (recipients.length === 0) {
      store.appendSystemMessage(
        channel.id,
        "Nenhum agente foi chamado. Use @handle para mencionar quem deve responder.",
      );
      return;
    }

    if (project === null) {
      store.appendSystemMessage(
        channel.id,
        "Escolha um workspace nas configurações do grupo antes de conversar com os agentes.",
      );
      return;
    }

    const environmentId = project.environmentId as EnvironmentId;
    setSending(true);
    try {
      await Promise.all(
        recipients.map((member) => sendToMember(member, trimmed, environmentId, project)),
      );
    } catch {
      store.appendSystemMessage(channel.id, "Não foi possível enviar a mensagem para os agentes.");
    } finally {
      setSending(false);
    }
  };

  return { send, sending };
}
