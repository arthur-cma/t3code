import { createFileRoute } from "@tanstack/react-router";

import { GroupsSettingsPanel } from "../components/settings/GroupsSettingsPanel";

function SettingsGroupsRoute() {
  return <GroupsSettingsPanel />;
}

export const Route = createFileRoute("/_chat/settings/groups")({
  component: SettingsGroupsRoute,
});
