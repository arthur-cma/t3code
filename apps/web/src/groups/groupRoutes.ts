export interface GroupsLocation {
  groupId: string | null;
  channelId: string | null;
  pageId: string | null;
}

export function parseGroupsLocation(pathname: string, searchStr: string): GroupsLocation {
  const match = /^\/groups\/([^/?#]+)/.exec(pathname);
  const groupId = match?.[1] === undefined ? null : decodeURIComponent(match[1]);
  const search = new URLSearchParams(searchStr);
  return {
    groupId,
    channelId: search.get("channel"),
    pageId: search.get("page"),
  };
}

export function isGroupsPath(pathname: string): boolean {
  return pathname === "/groups" || pathname.startsWith("/groups/");
}
