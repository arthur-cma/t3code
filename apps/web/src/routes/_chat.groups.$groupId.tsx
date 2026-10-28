import { createFileRoute } from "@tanstack/react-router";

import { GroupDetailPage } from "../components/groups/GroupDetailPage";

function GroupRouteView() {
  const { groupId } = Route.useParams();
  const { channel } = Route.useSearch();
  return <GroupDetailPage channelId={channel ?? null} groupId={groupId} />;
}

export const Route = createFileRoute("/_chat/groups/$groupId")({
  validateSearch: (search: Record<string, unknown>) => ({
    channel:
      typeof search.channel === "string" && search.channel.length > 0 ? search.channel : undefined,
  }),
  component: GroupRouteView,
});
