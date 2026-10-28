import { HashIcon, SendIcon, SettingsIcon, UsersIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { isElectron } from "../../env";
import { GROUP_REPLY_MODE_LABELS, type Group, type GroupChannel } from "../../groups/types";
import { channelMessages, threadLinksForChannel, useGroupsStore } from "../../groups/groupStore";
import { GroupThreadSync, type GroupReplyLink } from "../../groups/GroupThreadSync";
import { useGroupSend } from "../../groups/useGroupSend";
import { useProjects } from "../../state/entities";
import { ProviderInstanceIcon } from "../chat/ProviderInstanceIcon";
import { WorkspacePageHeader } from "../WorkspacePageHeader";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../ui/empty";
import { SidebarInset } from "../ui/sidebar";
import { Spinner } from "../ui/spinner";
import { Textarea } from "../ui/textarea";
import { GroupAvatar } from "./GroupAvatar";
import { GroupMessageRow } from "./GroupMessageRow";
import { GroupSettingsDialog } from "./GroupSettingsDialog";

export function GroupChannelView({ group, channel }: { group: Group; channel: GroupChannel }) {
  const projects = useProjects();
  const messages = useGroupsStore((store) => channelMessages(store.messages, channel.id));
  const links = useGroupsStore((store) => store.links);
  const channelLinks = threadLinksForChannel(links, channel.id);
  const project =
    group.projectRef === null
      ? null
      : (projects.find(
          (candidate) =>
            candidate.environmentId === group.projectRef?.environmentId &&
            candidate.id === group.projectRef?.projectId,
        ) ?? null);
  const { send, sending } = useGroupSend(group, channel, project);
  const [draft, setDraft] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // New messages and streamed replies should bring the transcript back to the bottom.
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- follows the live transcript
  useEffect(() => {
    const element = scrollRef.current;
    if (element === null || messages.length === 0) return;
    element.scrollTop = element.scrollHeight;
  }, [messages]);

  const replyLinks: GroupReplyLink[] = channelLinks.flatMap((link) => {
    const member = group.members.find((candidate) => candidate.id === link.memberId);
    if (member === undefined) return [];
    return [
      {
        link,
        memberName: member.name,
        memberModel: member.model,
        memberDriverKind: member.driverKind,
      },
    ];
  });

  const insertMention = (handle: string) => {
    setDraft((current) => {
      const separator = current.length === 0 || /\s$/.test(current) ? "" : " ";
      return `${current}${separator}@${handle} `;
    });
    composerRef.current?.focus();
  };

  const submit = () => {
    const value = draft.trim();
    if (value.length === 0 || sending) return;
    setDraft("");
    void send(value);
  };

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden" role="main">
      <WorkspacePageHeader className="gap-2 border-b border-border/60" electron={isElectron}>
        <GroupAvatar group={group} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-baseline gap-1.5">
            <h1 className="truncate text-sm font-semibold text-foreground">{group.name}</h1>
            <span className="flex min-w-0 items-center gap-0.5 text-xs text-muted-foreground">
              <HashIcon className="size-3 shrink-0" />
              <span className="truncate">{channel.name}</span>
            </span>
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {channel.topic.length > 0 ? channel.topic : group.description || "Sem descrição"}
          </p>
        </div>
        <div className="hidden items-center -space-x-1.5 sm:flex">
          {group.members.slice(0, 4).map((member) => (
            <span
              aria-label={member.name}
              className="flex size-6 items-center justify-center rounded-full border border-background bg-muted"
              key={member.id}
              role="img"
            >
              <ProviderInstanceIcon
                badgeContent="none"
                displayName={member.name}
                driverKind={member.driverKind as never}
                size="compact"
              />
            </span>
          ))}
          {group.members.length > 4 ? (
            <span className="flex size-6 items-center justify-center rounded-full border border-background bg-muted text-2xs text-muted-foreground">
              +{group.members.length - 4}
            </span>
          ) : null}
        </div>
        <Button
          aria-label="Configurações do grupo"
          onClick={() => setSettingsOpen(true)}
          size="icon-sm"
          variant="ghost"
        >
          <SettingsIcon />
        </Button>
      </WorkspacePageHeader>

      <div className="flex min-h-0 flex-1 flex-col">
        <div
          className="scrollbar-gutter-both min-h-0 flex-1 overflow-y-auto overscroll-contain"
          ref={scrollRef}
        >
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 sm:px-6">
            {messages.length === 0 ? (
              <Empty size="compact">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <UsersIcon />
                  </EmptyMedia>
                  <EmptyTitle>Comece a conversa em #{channel.name}</EmptyTitle>
                  <EmptyDescription>
                    {group.members.length === 0
                      ? "Adicione agentes ao grupo para começar."
                      : group.replyMode === "auto"
                        ? "Os agentes automáticos respondem assim que você enviar uma mensagem."
                        : "Mencione um agente com @handle para receber uma resposta."}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              messages.map((message) => (
                <GroupMessageRow
                  key={message.id}
                  message={message}
                  workspaceRoot={project?.workspaceRoot}
                />
              ))
            )}
            <GroupThreadSync replies={replyLinks} />
          </div>
        </div>

        <div className="border-t border-border/60 bg-background/80 backdrop-blur-sm">
          <div className="mx-auto w-full max-w-3xl px-4 py-3 sm:px-6">
            {group.members.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border/70 px-4 py-5 text-center">
                <p className="text-sm text-muted-foreground">Nenhum agente neste grupo ainda.</p>
                <Button onClick={() => setSettingsOpen(true)} size="sm" variant="outline">
                  <UsersIcon />
                  Adicionar agentes
                </Button>
              </div>
            ) : (
              <>
                <div className="mb-2 flex flex-wrap items-center gap-1">
                  <span className="mr-1 text-xs text-muted-foreground">Mencionar</span>
                  {group.members.map((member) => (
                    <button
                      className="flex items-center gap-1 rounded-md border border-border/60 bg-muted/40 px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring focus-visible:outline-none"
                      key={member.id}
                      onClick={() => insertMention(member.handle)}
                      type="button"
                    >
                      <ProviderInstanceIcon
                        badgeContent="none"
                        displayName={member.name}
                        driverKind={member.driverKind as never}
                        size="compact"
                      />
                      @{member.handle}
                      {member.autoRespond ? (
                        <span
                          aria-label="Responde automaticamente"
                          className="size-1 rounded-full bg-success"
                        />
                      ) : null}
                    </button>
                  ))}
                  <Badge className="ml-auto" size="sm" variant="secondary">
                    {GROUP_REPLY_MODE_LABELS[group.replyMode]}
                  </Badge>
                </div>
                <Textarea
                  aria-label={`Mensagem em #${channel.name}`}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      !event.shiftKey &&
                      !event.nativeEvent.isComposing
                    ) {
                      event.preventDefault();
                      submit();
                    }
                  }}
                  placeholder={`Mensagem em #${channel.name}`}
                  ref={composerRef}
                  size="sm"
                  value={draft}
                />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-xs text-muted-foreground">
                    Enter envia · Shift+Enter quebra linha
                    {group.replyMode === "mentions" ? " · use @handle para chamar um agente" : ""}
                  </p>
                  <Button
                    aria-label="Enviar mensagem"
                    disabled={draft.trim().length === 0 || sending}
                    onClick={submit}
                    size="icon-sm"
                  >
                    {sending ? <Spinner /> : <SendIcon />}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <GroupSettingsDialog group={group} onOpenChange={setSettingsOpen} open={settingsOpen} />
    </SidebarInset>
  );
}
