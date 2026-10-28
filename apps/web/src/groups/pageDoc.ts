import type { JSONContent } from "@tiptap/core";

import { isClosingFence, parseOpeningFence, serializeEditorDoc } from "~/composer-rich-text-doc";
import { parseInlineMarkdown, type RichTextMark } from "~/composer-rich-text";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

import type { GroupPageMode } from "./types";

export interface PageTemplate {
  id: string;
  label: string;
  description: string;
  icon: string;
  title: string;
  content: string;
  mode: GroupPageMode;
}

const MEETING_TEMPLATE = `## Participantes

- 

## Pauta

- [ ] 

## Decisões

> 

## Próximos passos

- [ ] 
`;

const DECISION_TEMPLATE = `## Contexto

## Decisão

## Alternativas consideradas

- 

## Impacto

## Responsáveis

- [ ] 
`;

const RESEARCH_TEMPLATE = `## Pergunta

## O que já sabemos

## Hipóteses

- 

## Próximos experimentos

- [ ] 
`;

const PROJECT_TEMPLATE = `## Objetivo

## Escopo

## Entregas

- [ ] 

## Riscos

## Referências

- [[ ]]
`;

export const PAGE_TEMPLATES: ReadonlyArray<PageTemplate> = [
  {
    id: "blank",
    label: "Em branco",
    description: "Comece do zero, com o editor de blocos e o quadro disponíveis.",
    icon: "📄",
    title: "",
    content: "",
    mode: "document",
  },
  {
    id: "meeting",
    label: "Notas de reunião",
    description: "Participantes, pauta, decisões e próximos passos.",
    icon: "🗓️",
    title: "Reunião",
    content: MEETING_TEMPLATE,
    mode: "document",
  },
  {
    id: "decision",
    label: "Registro de decisão",
    description: "Contexto, decisão, alternativas e impacto.",
    icon: "🧭",
    title: "Decisão",
    content: DECISION_TEMPLATE,
    mode: "document",
  },
  {
    id: "research",
    label: "Pesquisa",
    description: "Pergunta, evidências, hipóteses e experimentos.",
    icon: "🔬",
    title: "Pesquisa",
    content: RESEARCH_TEMPLATE,
    mode: "document",
  },
  {
    id: "project",
    label: "Projeto",
    description: "Objetivo, escopo, entregas e riscos.",
    icon: "🚀",
    title: "Projeto",
    content: PROJECT_TEMPLATE,
    mode: "document",
  },
  {
    id: "board",
    label: "Quadro em branco",
    description: "Abra direto no modo Quadro, com notas adesivas e formas.",
    icon: "🧩",
    title: "Quadro",
    content: "",
    mode: "canvas",
  },
];

export function pageTemplateById(id: string): PageTemplate | null {
  return PAGE_TEMPLATES.find((template) => template.id === id) ?? null;
}

const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

/** Local calendar day as `YYYY-MM-DD`, matching how daily notes are keyed. */
export function dailyKeyFor(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dailyPageTitle(key: string): string {
  const [year, month, day] = key.split("-");
  const monthName = MONTHS[Number.parseInt(month ?? "", 10) - 1];
  if (year === undefined || monthName === undefined || day === undefined) return key;
  return `${Number.parseInt(day, 10)} de ${monthName} de ${year}`;
}

export function dailyPageContent(key: string): string {
  return `## Foco do dia

- [ ] 

## Notas

## Decisões e aprendizados

## Amanhã

- [[${dailyPageTitle(shiftDailyKey(key, 1))}]]
`;
}

export function shiftDailyKey(key: string, days: number): string {
  const [year, month, day] = key.split("-").map((part) => Number.parseInt(part, 10));
  const date = new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
  date.setDate(date.getDate() + days);
  return dailyKeyFor(date);
}

const MARK_TO_TIPTAP: Record<RichTextMark, string> = {
  bold: "bold",
  italic: "italic",
  strike: "strike",
  code: "code",
};

const WIKI_LINK = /\[\[[^\]\n]+\]\]/g;

function inlineNodes(text: string): JSONContent[] {
  const nodes: JSONContent[] = [];
  let cursor = 0;
  const pushText = (value: string) => {
    for (const span of parseInlineMarkdown(value)) {
      nodes.push({
        type: "text",
        text: span.text,
        ...(span.marks.length === 0
          ? {}
          : { marks: span.marks.map((mark) => ({ type: MARK_TO_TIPTAP[mark] })) }),
      });
    }
  };
  for (const match of text.matchAll(WIKI_LINK)) {
    const index = match.index ?? 0;
    if (index > cursor) pushText(text.slice(cursor, index));
    nodes.push({ type: "text", text: match[0], marks: [{ type: "pageWikiLink" }] });
    cursor = index + match[0].length;
  }
  if (cursor < text.length) pushText(text.slice(cursor));
  return nodes;
}

interface TaskPrefix {
  kind: "task";
  indent: string;
  checked: boolean;
  markerSpace: string;
  contentSpace: string;
  rest: string;
}

interface SimplePrefix {
  kind: "bullet" | "ordered";
  indent: string;
  marker: string;
  space: string;
  rest: string;
}

type ListPrefix = TaskPrefix | SimplePrefix;

function parseListPrefix(line: string): ListPrefix | null {
  const task = /^([ \t]*)-([ \t]+)\[([ xX])\]([ \t]*)(.*)$/.exec(line);
  if (task) {
    return {
      kind: "task",
      indent: task[1] ?? "",
      checked: (task[3] ?? " ").toLowerCase() === "x",
      markerSpace: task[2] ?? " ",
      contentSpace: task[4] ?? "",
      rest: task[5] ?? "",
    };
  }
  const ordered = /^([ \t]*)(\d+[.)])((?:[ \t]+)|$)(.*)$/.exec(line);
  if (ordered) {
    return {
      kind: "ordered",
      indent: ordered[1] ?? "",
      marker: ordered[2] ?? "1.",
      space: ordered[3] ?? " ",
      rest: ordered[4] ?? "",
    };
  }
  const bullet = /^([ \t]*)([-*+])((?:[ \t]+)|$)(.*)$/.exec(line);
  if (bullet) {
    return {
      kind: "bullet",
      indent: bullet[1] ?? "",
      marker: bullet[2] ?? "-",
      space: bullet[3] ?? " ",
      rest: bullet[4] ?? "",
    };
  }
  return null;
}

function listKey(prefix: ListPrefix): string {
  if (prefix.kind === "task") return "task";
  if (prefix.kind === "ordered") return `ordered:${prefix.marker.slice(-1)}`;
  return `bullet:${prefix.marker}`;
}

interface PendingItem {
  prefix: ListPrefix;
  inline: JSONContent[];
  children: PendingList[];
}

interface PendingList {
  key: string;
  start: number;
  items: PendingItem[];
}

function listJson(list: PendingList): JSONContent {
  const items = list.items.map((item) => {
    const content: JSONContent[] = [
      {
        type: "paragraph",
        ...(item.inline.length === 0 ? {} : { content: item.inline }),
      },
      ...item.children.map(listJson),
    ];
    if (item.prefix.kind === "task") {
      return {
        type: "taskItem",
        attrs: {
          checked: item.prefix.checked,
          indent: item.prefix.indent,
          markerSpace: item.prefix.markerSpace,
          contentSpace: item.prefix.contentSpace,
        },
        content,
      };
    }
    return {
      type: "listItem",
      attrs: {
        indent: item.prefix.indent,
        marker: item.prefix.marker,
        space: item.prefix.space,
      },
      content,
    };
  });
  if (list.key === "task") return { type: "taskList", content: items };
  if (list.key.startsWith("ordered")) {
    return { type: "orderedList", attrs: { start: list.start }, content: items };
  }
  return { type: "bulletList", content: items };
}

/** Parses the Markdown stored on a page into the Tiptap schema the page editor uses. */
export function pageMarkdownToDocJson(markdown: string): JSONContent {
  const source = markdown.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  const lines = source.split("\n");
  const blocks: JSONContent[] = [];
  let rootLists: PendingList[] = [];
  let stack: { indent: string; container: PendingList[]; list: PendingList }[] = [];

  const flushLists = () => {
    for (const list of rootLists) blocks.push(listJson(list));
    rootLists = [];
    stack = [];
  };
  const openList = (container: PendingList[], key: string, start: number): PendingList => {
    const list = { key, start, items: [] };
    container.push(list);
    return list;
  };
  const pushListItem = (prefix: ListPrefix) => {
    const key = listKey(prefix);
    const indent = prefix.indent;
    const start = prefix.kind === "ordered" ? Number.parseInt(prefix.marker, 10) || 1 : 1;
    const item: PendingItem = { prefix, inline: inlineNodes(prefix.rest), children: [] };
    for (;;) {
      const top = stack.at(-1);
      if (!top) {
        stack.push({ indent, list: openList(rootLists, key, start), container: rootLists });
        continue;
      }
      if (top.indent === indent) {
        if (top.list.key !== key) top.list = openList(top.container, key, start);
        top.list.items.push(item);
        return;
      }
      if (top.indent !== "" && !indent.startsWith(top.indent)) {
        if (stack.length > 1) {
          stack.pop();
          continue;
        }
        top.indent = indent;
        if (top.list.key !== key) top.list = openList(top.container, key, start);
        top.list.items.push(item);
        return;
      }
      const parent = top.list.items.at(-1);
      if (parent === undefined) {
        top.list.items.push(item);
        return;
      }
      const list = openList(parent.children, key, start);
      stack.push({ indent, list, container: parent.children });
      list.items.push(item);
      return;
    }
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    // Blank lines separate blocks in Markdown; they are not empty paragraphs.
    if (line.trim().length === 0) {
      flushLists();
      continue;
    }
    const opening = parseOpeningFence(line);
    if (opening !== null) {
      flushLists();
      const body: string[] = [];
      let cursor = index + 1;
      let close = "";
      while (cursor < lines.length) {
        const candidate = lines[cursor] ?? "";
        if (isClosingFence(candidate, opening.fence)) {
          close = `\n${candidate}`;
          break;
        }
        body.push(candidate);
        cursor += 1;
      }
      const content = body.join("\n");
      blocks.push({
        type: "codeBlock",
        attrs: { language: opening.language, fence: opening.fence, close },
        ...(content.length === 0 ? {} : { content: [{ type: "text", text: content }] }),
      });
      index = cursor;
      continue;
    }
    if (/^([-*_])(?:[ \t]*\1){2,}[ \t]*$/.test(line)) {
      flushLists();
      blocks.push({ type: "horizontalRule", attrs: { source: line } });
      continue;
    }
    const heading = /^(#{1,6})([ \t]+)(.*)$/.exec(line);
    if (heading) {
      flushLists();
      const inline = inlineNodes(heading[3] ?? "");
      blocks.push({
        type: "heading",
        attrs: { level: heading[1]?.length ?? 1, space: heading[2] ?? " " },
        ...(inline.length === 0 ? {} : { content: inline }),
      });
      continue;
    }
    const quote = /^>[ \t]?(.*)$/.exec(line);
    if (quote) {
      flushLists();
      const paragraphs: string[] = [quote[1] ?? ""];
      let cursor = index + 1;
      while (cursor < lines.length) {
        const next = /^>[ \t]?(.*)$/.exec(lines[cursor] ?? "");
        if (!next) break;
        paragraphs.push(next[1] ?? "");
        cursor += 1;
      }
      index = cursor - 1;
      blocks.push({
        type: "blockquote",
        attrs: { prefix: "> " },
        content: paragraphs.map((paragraph) => {
          const inline = inlineNodes(paragraph);
          return {
            type: "paragraph",
            ...(inline.length === 0 ? {} : { content: inline }),
          };
        }),
      });
      continue;
    }
    const prefix = parseListPrefix(line);
    if (prefix !== null) {
      pushListItem(prefix);
      continue;
    }
    flushLists();
    const inline = inlineNodes(line);
    blocks.push({
      type: "paragraph",
      ...(inline.length === 0 ? {} : { content: inline }),
    });
  }
  flushLists();

  if (blocks.at(-1)?.type === "horizontalRule") blocks.push({ type: "paragraph" });
  return { type: "doc", content: blocks.length === 0 ? [{ type: "paragraph" }] : blocks };
}

/** Serializes the page editor document back to the Markdown stored on the page. */
export function pageDocToMarkdown(doc: ProseMirrorNode): string {
  return serializeEditorDoc(doc).value;
}
