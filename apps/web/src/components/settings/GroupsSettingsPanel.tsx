import { useNavigate } from "@tanstack/react-router";
import { HashIcon, RotateCcwIcon, UsersIcon } from "lucide-react";
import { useState } from "react";

import { useGroups, useGroupsStore } from "../../groups/groupStore";
import {
  GROUP_REPLY_MODE_DESCRIPTIONS,
  GROUP_REPLY_MODE_LABELS,
  GROUP_RUNTIME_MODE_LABELS,
  type GroupReplyMode,
  type GroupRuntimeMode,
} from "../../groups/types";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";
import { SettingsPageContainer, SettingsRow, SettingsSection } from "./settingsLayout";

export function GroupsSettingsPanel() {
  const groups = useGroups();
  const settings = useGroupsStore((store) => store.settings);
  const updateSettings = useGroupsStore((store) => store.updateSettings);
  const resetAll = useGroupsStore((store) => store.resetAll);
  const navigate = useNavigate();
  const [confirmReset, setConfirmReset] = useState(false);

  const channelCount = groups.reduce((total, group) => total + group.channels.length, 0);
  const agentCount = groups.reduce((total, group) => total + group.members.length, 0);

  return (
    <SettingsPageContainer>
      <SettingsSection id="groups" title="Groups">
        <SettingsRow
          control={
            <Select
              onValueChange={(value) => {
                if (value === "mentions" || value === "auto") {
                  updateSettings({ defaultReplyMode: value satisfies GroupReplyMode });
                }
              }}
              value={settings.defaultReplyMode}
            >
              <SelectTrigger aria-label="Default reply mode" className="w-full min-w-0" size="sm">
                <SelectValue>{GROUP_REPLY_MODE_LABELS[settings.defaultReplyMode]}</SelectValue>
              </SelectTrigger>
              <SelectPopup align="end" alignItemWithTrigger={false}>
                <SelectItem value="mentions">{GROUP_REPLY_MODE_LABELS.mentions}</SelectItem>
                <SelectItem value="auto">{GROUP_REPLY_MODE_LABELS.auto}</SelectItem>
              </SelectPopup>
            </Select>
          }
          description={GROUP_REPLY_MODE_DESCRIPTIONS[settings.defaultReplyMode]}
          title="Default reply mode"
        />
        <SettingsRow
          control={
            <Select
              onValueChange={(value) => {
                if (typeof value === "string" && value in GROUP_RUNTIME_MODE_LABELS) {
                  updateSettings({ defaultRuntimeMode: value as GroupRuntimeMode });
                }
              }}
              value={settings.defaultRuntimeMode}
            >
              <SelectTrigger
                aria-label="Default agent permissions"
                className="w-full min-w-0"
                size="sm"
              >
                <SelectValue>{GROUP_RUNTIME_MODE_LABELS[settings.defaultRuntimeMode]}</SelectValue>
              </SelectTrigger>
              <SelectPopup align="end" alignItemWithTrigger={false}>
                {Object.entries(GROUP_RUNTIME_MODE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
          }
          description="Permissions used when a group creates new agent threads."
          title="Default agent permissions"
        />
        <SettingsRow
          control={
            <Switch
              aria-label="Include group context"
              checked={settings.includeGroupContext}
              onCheckedChange={(checked) => updateSettings({ includeGroupContext: checked })}
              size="sm"
            />
          }
          description="New agent threads receive the group name, description and channel as context."
          title="Include group context"
        />
      </SettingsSection>

      <SettingsSection
        title="Your groups"
        titleAction={
          <span className="text-xs font-normal text-muted-foreground">
            {groups.length} groups · {channelCount} channels · {agentCount} agents
          </span>
        }
      >
        {groups.length === 0 ? (
          <SettingsRow
            control={
              <Button onClick={() => void navigate({ to: "/groups" })} size="sm" variant="outline">
                <UsersIcon />
                Open groups
              </Button>
            }
            description="Groups are shared channels where several agents answer in one transcript."
            title="No groups yet"
          />
        ) : (
          groups.map((group) => (
            <SettingsRow
              control={
                <Button
                  onClick={() =>
                    void navigate({
                      to: "/groups/$groupId",
                      params: { groupId: group.id },
                      search: { channel: group.channels[0]?.id },
                    })
                  }
                  size="sm"
                  variant="outline"
                >
                  Open
                </Button>
              }
              description={
                <span className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <HashIcon className="size-3" />
                    {group.channels.length}
                  </span>
                  <span className="flex items-center gap-1">
                    <UsersIcon className="size-3" />
                    {group.members.length}
                  </span>
                  <Badge size="sm" variant="secondary">
                    {GROUP_REPLY_MODE_LABELS[group.replyMode]}
                  </Badge>
                </span>
              }
              key={group.id}
              title={group.name}
            />
          ))
        )}
      </SettingsSection>

      <SettingsSection title="Reset">
        <SettingsRow
          control={
            confirmReset ? (
              <span className="flex items-center gap-2">
                <Button onClick={() => setConfirmReset(false)} size="sm" variant="outline">
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    setConfirmReset(false);
                    resetAll();
                  }}
                  size="sm"
                  variant="destructive"
                >
                  Reset everything
                </Button>
              </span>
            ) : (
              <Button
                disabled={groups.length === 0}
                onClick={() => setConfirmReset(true)}
                size="sm"
                variant="destructive-outline"
              >
                <RotateCcwIcon />
                Reset groups
              </Button>
            )
          }
          description="This cannot be undone."
          title="Reset all groups"
        />
      </SettingsSection>
    </SettingsPageContainer>
  );
}
