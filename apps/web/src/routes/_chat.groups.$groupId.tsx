import { createFileRoute } from "@tanstack/react-router";

import { GroupDetailPage } from "../components/groups/GroupDetailPage";

export interface GroupsSearch {
  channel?: string | undefined;
  page?: string | undefined;
}

function GroupRouteView() {
  const { groupId } = Route.useParams();
  const { channel, page } = Route.useSearch();
  return <GroupDetailPage channelId={channel ?? null} groupId={groupId} pageId={page ?? null} />;
}

export const Route = createFileRoute("/_chat/groups/$groupId")({
  validateSearch: (search: Record<string, unknown>): GroupsSearch => ({
    channel:
      typeof search.channel === "string" && search.channel.length > 0 ? search.channel : undefined,
    page: typeof search.page === "string" && search.page.length > 0 ? search.page : undefined,
  }),
  component: GroupRouteView,
});
