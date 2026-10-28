import { useNavigate } from "@tanstack/react-router";
import { UsersIcon } from "lucide-react";
import { useEffect } from "react";

import { isElectron } from "../../env";
import { firstTextChannel, pageById, useGroupsStore } from "../../groups/groupStore";
import { useProjects } from "../../state/entities";
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
import { GroupPageView } from "./GroupPageView";

export function GroupDetailPage({
  groupId,
  channelId,
  pageId,
}: {
  groupId: string;
  channelId: string | null;
  pageId: string | null;
}) {
  const navigate = useNavigate();
  const projects = useProjects();
  const group = useGroupsStore(
    (store) => store.groups.find((candidate) => candidate.id === groupId) ?? null,
  );

  const groupMissing = group === null;
  const channel =
    group === null
      ? null
      : (group.channels.find((candidate) => candidate.id === channelId) ?? null);
  const fallbackChannel = group === null ? null : firstTextChannel(group);
  const page = group === null ? null : pageById(group, pageId);
  const project =
    group?.projectRef === null || group === null
      ? null
      : (projects.find(
          (candidate) =>
            candidate.environmentId === group.projectRef?.environmentId &&
            candidate.id === group.projectRef?.projectId,
        ) ?? null);

  // Keep the URL in sync with real group state instead of rendering an invalid target.
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- redirects stale URLs to a valid target
  useEffect(() => {
    if (groupMissing) {
      void navigate({ to: "/groups", replace: true });
      return;
    }
    if (pageId !== null) {
      if (page !== null) return;
      if (fallbackChannel !== null) {
        void navigate({
          to: "/groups/$groupId",
          params: { groupId },
          search: { channel: fallbackChannel.id },
          replace: true,
        });
        return;
      }
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
  }, [channel, fallbackChannel, groupId, groupMissing, navigate, page, pageId]);

  if (group === null) return null;

  if (page !== null) {
    return (
      <GroupPageView
        group={group}
        key={page.id}
        onOpenChannel={(targetChannelId) => {
          void navigate({
            to: "/groups/$groupId",
            params: { groupId: group.id },
            search: { channel: targetChannelId },
          });
        }}
        onOpenPage={(targetPageId) => {
          void navigate({
            to: "/groups/$groupId",
            params: { groupId: group.id },
            search: { page: targetPageId },
          });
        }}
        page={page}
        project={project}
      />
    );
  }

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
