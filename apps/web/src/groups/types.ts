export type GroupReplyMode = "mentions" | "auto";

export type GroupRuntimeMode = "approval-required" | "auto-accept-edits" | "auto" | "full-access";

export type GroupAccent = "violet" | "emerald" | "amber" | "sky" | "rose" | "slate";

export type GroupMessageKind = "user" | "agent" | "system";

export type GroupChannelKind = "text" | "dm";

export interface GroupProjectRef {
  environmentId: string;
  projectId: string;
}

export interface GroupChannel {
  id: string;
  name: string;
  topic: string;
  kind: GroupChannelKind;
  memberId: string | null;
}

export interface GroupPerson {
  id: string;
  name: string;
  handle: string;
  accent: GroupAccent;
  role: string;
  isOwner: boolean;
  joinedAt: string;
}

export interface GroupMember {
  id: string;
  name: string;
  handle: string;
  instanceId: string;
  driverKind: string;
  model: string;
  autoRespond: boolean;
  role: string;
  reportsTo: string | null;
  personId: string | null;
}

/** A person's own provider/model connected to an agent of the group. */
export interface GroupAgentBinding {
  id: string;
  memberId: string;
  personId: string;
  instanceId: string;
  driverKind: string;
  model: string;
  label: string;
  createdAt: string;
}

export interface GroupMeetingAgendaItem {
  id: string;
  text: string;
  done: boolean;
}

export interface GroupMeeting {
  id: string;
  title: string;
  startedAt: string;
  endedAt: string | null;
  agenda: GroupMeetingAgendaItem[];
  notes: string;
  participants: string[];
}

export interface GroupSpace {
  id: string;
  name: string;
  icon: string;
  createdAt: string;
}

export type GroupPageMode = "document" | "canvas";

export type GroupPageCoverId = "aurora" | "sunset" | "forest" | "ocean" | "graphite";

export type GroupCanvasNodeKind = "note" | "shape" | "text";

export interface GroupCanvasNode {
  id: string;
  kind: GroupCanvasNodeKind;
  x: number;
  y: number;
  width: number;
  height: number;
  color: GroupAccent;
  text: string;
}

export interface GroupPageCanvas {
  nodes: GroupCanvasNode[];
}

export interface GroupPage {
  id: string;
  spaceId: string;
  parentId: string | null;
  title: string;
  icon: string;
  content: string;
  favorite: boolean;
  cover: GroupPageCoverId | "";
  tags: string[];
  mode: GroupPageMode;
  canvas: GroupPageCanvas;
  dailyKey: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const GROUP_PAGE_COVER_CLASSES: Readonly<Record<GroupPageCoverId, string>> = {
  aurora: "bg-linear-to-r from-violet-500/25 via-fuchsia-500/20 to-sky-500/25",
  sunset: "bg-linear-to-r from-rose-500/25 via-orange-400/20 to-amber-400/25",
  forest: "bg-linear-to-r from-emerald-500/25 via-teal-500/20 to-lime-400/20",
  ocean: "bg-linear-to-r from-sky-500/25 via-cyan-400/20 to-blue-500/25",
  graphite: "bg-linear-to-r from-slate-600/30 via-slate-500/20 to-slate-400/25",
};

export const GROUP_PAGE_COVER_LABELS: Readonly<Record<GroupPageCoverId, string>> = {
  aurora: "Aurora",
  sunset: "Entardecer",
  forest: "Floresta",
  ocean: "Oceano",
  graphite: "Grafite",
};

export const GROUP_CANVAS_NODE_CLASSES: Readonly<Record<GroupAccent, string>> = {
  violet: "border-violet-500/30 bg-violet-500/12 text-violet-950 dark:text-violet-100",
  emerald: "border-emerald-500/30 bg-emerald-500/12 text-emerald-950 dark:text-emerald-100",
  amber: "border-amber-500/30 bg-amber-500/12 text-amber-950 dark:text-amber-100",
  sky: "border-sky-500/30 bg-sky-500/12 text-sky-950 dark:text-sky-100",
  rose: "border-rose-500/30 bg-rose-500/12 text-rose-950 dark:text-rose-100",
  slate: "border-slate-500/30 bg-slate-500/12 text-slate-950 dark:text-slate-100",
};

export interface Group {
  id: string;
  name: string;
  description: string;
  accent: GroupAccent;
  replyMode: GroupReplyMode;
  runtimeMode: GroupRuntimeMode;
  projectRef: GroupProjectRef | null;
  channels: GroupChannel[];
  members: GroupMember[];
  meetings: GroupMeeting[];
  spaces: GroupSpace[];
  pages: GroupPage[];
  people: GroupPerson[];
  bindings: GroupAgentBinding[];
  createdAt: string;
}

export interface GroupMessage {
  id: string;
  channelId: string;
  kind: GroupMessageKind;
  authorId: string | null;
  authorName: string;
  text: string;
  createdAt: string;
  streaming?: boolean;
  model?: string | null;
  driverKind?: string | null;
  sourceId?: string;
}

export interface GroupThreadLink {
  channelId: string;
  memberId: string;
  environmentId: string;
  threadId: string;
  since: string;
}

export interface GroupSettings {
  defaultReplyMode: GroupReplyMode;
  defaultRuntimeMode: GroupRuntimeMode;
  includeGroupContext: boolean;
}

export const GROUP_ACCENTS: ReadonlyArray<GroupAccent> = [
  "violet",
  "emerald",
  "amber",
  "sky",
  "rose",
  "slate",
];

export const DEFAULT_GROUP_SETTINGS: GroupSettings = {
  defaultReplyMode: "mentions",
  defaultRuntimeMode: "full-access",
  includeGroupContext: true,
};

export const GROUP_REPLY_MODE_LABELS: Readonly<Record<GroupReplyMode, string>> = {
  mentions: "Só menções",
  auto: "Automático",
};

export const GROUP_REPLY_MODE_DESCRIPTIONS: Readonly<Record<GroupReplyMode, string>> = {
  mentions: "Os agentes respondem apenas quando são mencionados com @handle.",
  auto: "Agentes marcados como automáticos respondem a todas as mensagens; se nenhum estiver marcado, todos respondem.",
};

export const GROUP_RUNTIME_MODE_LABELS: Readonly<Record<GroupRuntimeMode, string>> = {
  "approval-required": "Pedir aprovação",
  "auto-accept-edits": "Aceitar edições",
  auto: "Automático",
  "full-access": "Acesso total",
};

export const GROUP_ACCENT_CLASSES: Readonly<Record<GroupAccent, string>> = {
  violet: "bg-violet-500/15 text-violet-600 dark:text-violet-300",
  emerald: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  amber: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  sky: "bg-sky-500/15 text-sky-600 dark:text-sky-300",
  rose: "bg-rose-500/15 text-rose-600 dark:text-rose-300",
  slate: "bg-slate-500/15 text-slate-600 dark:text-slate-300",
};

export const GROUP_MEMBER_ROLE_PRESETS: ReadonlyArray<string> = [
  "Coordenação",
  "Produto",
  "Design",
  "Engenharia",
  "Pesquisa",
  "Operações",
];
