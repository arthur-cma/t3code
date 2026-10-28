import type { GroupPage } from "./types";

const WIKI_LINK_PATTERN = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g;
const FENCE_PATTERN = /(^|\n)(```|~~~)[\s\S]*?\2/g;

export interface PageTreeNode {
  page: GroupPage;
  children: PageTreeNode[];
}

export interface PageGraphNode {
  id: string;
  title: string;
  links: number;
}

export interface PageGraphEdge {
  from: string;
  to: string;
}

export interface PageGraph {
  nodes: PageGraphNode[];
  edges: PageGraphEdge[];
}

export interface PageHeading {
  level: number;
  text: string;
  id: string;
}

export function normalizePageTitle(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

/** Titles referenced by `[[wikilinks]]` in the page body, in order of appearance. */
export function extractWikiLinks(content: string): string[] {
  const withoutFences = content.replace(FENCE_PATTERN, "\n");
  const titles: string[] = [];
  for (const match of withoutFences.matchAll(WIKI_LINK_PATTERN)) {
    const title = match[1]?.trim();
    if (title !== undefined && title.length > 0 && !titles.includes(title)) titles.push(title);
  }
  return titles;
}

export function resolveWikiLink(pages: ReadonlyArray<GroupPage>, title: string): GroupPage | null {
  const needle = normalizePageTitle(title);
  if (needle.length === 0) return null;
  return pages.find((page) => normalizePageTitle(page.title) === needle) ?? null;
}

export function pageOutgoingLinks(
  pages: ReadonlyArray<GroupPage>,
  page: GroupPage,
): Array<{ title: string; page: GroupPage | null }> {
  return extractWikiLinks(page.content).map((title) => ({
    title,
    page: resolveWikiLink(pages, title),
  }));
}

/** Pages whose body links to `page`. */
export function pageBacklinks(pages: ReadonlyArray<GroupPage>, page: GroupPage): GroupPage[] {
  const target = normalizePageTitle(page.title);
  if (target.length === 0) return [];
  return pages.filter((candidate) => {
    if (candidate.id === page.id) return false;
    return extractWikiLinks(candidate.content).some(
      (title) => normalizePageTitle(title) === target,
    );
  });
}

export function buildPageTree(pages: ReadonlyArray<GroupPage>, spaceId: string): PageTreeNode[] {
  const inSpace = pages.filter((page) => page.spaceId === spaceId);
  const ids = new Set(inSpace.map((page) => page.id));
  const childrenByParent = new Map<string, GroupPage[]>();
  const roots: GroupPage[] = [];

  for (const page of inSpace) {
    const parentId = page.parentId;
    if (parentId === null || parentId === page.id || !ids.has(parentId)) {
      roots.push(page);
      continue;
    }
    const siblings = childrenByParent.get(parentId) ?? [];
    siblings.push(page);
    childrenByParent.set(parentId, siblings);
  }

  const sortPages = (list: GroupPage[]) =>
    [...list].sort((left, right) => left.title.localeCompare(right.title, "pt-BR"));

  const build = (page: GroupPage, seen: ReadonlySet<string>): PageTreeNode => {
    if (seen.has(page.id)) return { page, children: [] };
    const nextSeen = new Set(seen).add(page.id);
    return {
      page,
      children: sortPages(childrenByParent.get(page.id) ?? []).map((child) =>
        build(child, nextSeen),
      ),
    };
  };

  return sortPages(roots).map((page) => build(page, new Set()));
}

export function pageBreadcrumbs(pages: ReadonlyArray<GroupPage>, pageId: string): GroupPage[] {
  const trail: GroupPage[] = [];
  const seen = new Set<string>();
  let current = pages.find((page) => page.id === pageId) ?? null;
  while (current !== null && !seen.has(current.id)) {
    seen.add(current.id);
    trail.unshift(current);
    const parentId = current.parentId;
    current = parentId === null ? null : (pages.find((page) => page.id === parentId) ?? null);
  }
  return trail;
}

export function searchPages(
  pages: ReadonlyArray<GroupPage>,
  query: string,
  limit = 20,
): GroupPage[] {
  const needle = normalizePageTitle(query);
  if (needle.length === 0) return [...pages].slice(0, limit);
  const scored = pages.flatMap((page) => {
    const title = normalizePageTitle(page.title);
    const content = normalizePageTitle(page.content);
    if (title.startsWith(needle)) return [{ page, score: 0 }];
    if (title.includes(needle)) return [{ page, score: 1 }];
    if (content.includes(needle)) return [{ page, score: 2 }];
    return [];
  });
  scored.sort((left, right) => left.score - right.score);
  return scored.slice(0, limit).map((entry) => entry.page);
}

/** Bidirectional link graph between pages, resolved from wikilinks. */
export function buildPageGraph(pages: ReadonlyArray<GroupPage>): PageGraph {
  const edges: PageGraphEdge[] = [];
  const seen = new Set<string>();
  for (const page of pages) {
    for (const link of pageOutgoingLinks(pages, page)) {
      if (link.page === null || link.page.id === page.id) continue;
      const key = `${page.id}->${link.page.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ from: page.id, to: link.page.id });
    }
  }
  const nodes = pages.map((page) => ({
    id: page.id,
    title: page.title,
    links: edges.filter((edge) => edge.from === page.id || edge.to === page.id).length,
  }));
  return { nodes, edges };
}

export function pageHeadings(content: string): PageHeading[] {
  const headings: PageHeading[] = [];
  const seen = new Map<string, number>();
  for (const line of content.split("\n")) {
    const match = /^(#{1,4})\s+(.+)$/.exec(line.trim());
    if (match === null) continue;
    const level = match[1]?.length ?? 1;
    const text = (match[2] ?? "").trim();
    if (text.length === 0) continue;
    const base = normalizePageTitle(text)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    headings.push({ level, text, id: count === 0 ? base : `${base}-${count}` });
  }
  return headings;
}

/**
 * Rewrites `[[Título]]` as inline code so the markdown preview renders it literally and the
 * page view can turn clicks on those spans into navigation. Fenced code blocks stay untouched.
 */
export function renderWikiLinksAsCode(content: string): string {
  const segments: string[] = [];
  let cursor = 0;
  for (const match of content.matchAll(FENCE_PATTERN)) {
    const index = match.index ?? 0;
    segments.push(
      content.slice(cursor, index).replace(WIKI_LINK_PATTERN, (_raw, title: string) => {
        return `\`[[${title.trim()}]]\``;
      }),
    );
    segments.push(match[0]);
    cursor = index + match[0].length;
  }
  segments.push(
    content.slice(cursor).replace(WIKI_LINK_PATTERN, (_raw, title: string) => {
      return `\`[[${title.trim()}]]\``;
    }),
  );
  return segments.join("");
}

export function pageWordCount(content: string): number {
  return content
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
}

export function wikiLinkTitleFromText(text: string): string | null {
  const match = /^\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]$/.exec(text.trim());
  return match?.[1]?.trim() ?? null;
}
