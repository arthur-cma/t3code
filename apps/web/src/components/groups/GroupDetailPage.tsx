import { useNavigate } from "@tanstack/react-router";
import { UsersIcon } from "lucide-react";
import { useEffect } from "react";

import { isElectron } from "../../env";
import { useGroupsStore, firstTextChannel } from "../../groups/groupStore";
import { WorkspacePageHeader } from "../WorkspacePageHeader";
import { Button } from "../ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "../ui/empty";
import { SidebarInset } from "../ui/sidebar";
import { GroupChannelView } from "./GroupChannelView";

export function GroupDetailPage({
  groupId,
  channelId,
}: {
  groupId: string;
  channelId: string | null;
}) {
  const navigate = useNavigate();
  const group = useGroupsStore(
    (store) => store.groups.find((candidate) => candidate.id === groupId) ?? null,
  );

  const groupMissing = group === null;
  const channel =
    group === null
      ? null
      : (group.channels.find((candidate) => candidate.id === channelId) ?? null);
  const fallbackChannel = group === null ? null : firstTextChannel(group);

  // Keep the URL in sync with real group state instead of rendering an invalid channel.
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- redirects stale URLs to a valid channel
  useEffect(() => {
    if (groupMissing) {
      void navigate({ to: "/groups", replace: true });
      return;
    }
    if (channel !== null || fallbackChannel === null) return;
    void navigate({
      to: "/groups/$groupId",
      params: { groupId },
      search: { channel: fallbackChannel.id },
      replace: true,
    });
  }, [channel, fallbackChannel, groupId, groupMissing, navigate]);

  if (group === null) return null;

  if (channel === null) {
    return (
      <SidebarInset className="h-dvh min-h-0 overflow-hidden" role="main">
        <WorkspacePageHeader className="border-b border-border/60" electron={isElectron}>
          <h1 className="text-sm font-semibold text-foreground">{group.name}</h1>
        </WorkspacePageHeader>
        <Empty className="flex-1">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UsersIcon />
            </EmptyMedia>
            <EmptyTitle>Este grupo ainda não tem canais</EmptyTitle>
            <EmptyDescription>Crie um canal nas configurações do grupo.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => void navigate({ to: "/groups" })} size="sm" variant="outline">
              Voltar para grupos
            </Button>
          </EmptyContent>
        </Empty>
      </SidebarInset>
    );
  }

  return <GroupChannelView channel={channel} group={group} key={channel.id} />;
}
