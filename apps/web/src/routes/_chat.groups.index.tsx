import { createFileRoute } from "@tanstack/react-router";

import { GroupsOverviewPage } from "../components/groups/GroupsOverviewPage";

export const Route = createFileRoute("/_chat/groups/")({
  component: GroupsOverviewPage,
});
