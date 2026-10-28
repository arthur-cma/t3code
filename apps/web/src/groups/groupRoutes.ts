export interface GroupsLocation {
  groupId: string | null;
  channelId: string | null;
}

export function parseGroupsLocation(pathname: string, searchStr: string): GroupsLocation {
  const match = /^\/groups\/([^/?#]+)/.exec(pathname);
  const groupId = match?.[1] === undefined ? null : decodeURIComponent(match[1]);
  const channelId = new URLSearchParams(searchStr).get("channel");
  return { groupId, channelId };
}

export function isGroupsPath(pathname: string): boolean {
  return pathname === "/groups" || pathname.startsWith("/groups/");
}
