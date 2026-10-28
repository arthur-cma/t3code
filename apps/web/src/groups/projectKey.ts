import type { GroupProjectRef } from "./types";

const PROJECT_KEY_SEPARATOR = "::";

export function projectKey(ref: GroupProjectRef): string {
  return `${ref.environmentId}${PROJECT_KEY_SEPARATOR}${ref.projectId}`;
}

export function parseProjectKey(value: string): GroupProjectRef | null {
  const [environmentId, projectId] = value.split(PROJECT_KEY_SEPARATOR);
  if (!environmentId || !projectId) return null;
  return { environmentId, projectId };
}
