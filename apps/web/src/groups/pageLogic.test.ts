import { describe, expect, it } from "vite-plus/test";

import {
  buildPageGraph,
  buildPageTree,
  extractWikiLinks,
  pageBacklinks,
  pageBreadcrumbs,
  pageHeadings,
  pageOutgoingLinks,
  renderWikiLinksAsCode,
  resolveWikiLink,
  searchPages,
  wikiLinkTitleFromText,
} from "./pageLogic";
import type { GroupPage } from "./types";

function page(overrides: Partial<GroupPage> & Pick<GroupPage, "id" | "title">): GroupPage {
  return {
    spaceId: "space_1",
    parentId: null,
    icon: "📄",
    content: "",
    favorite: false,
    cover: "",
    tags: [],
    mode: "document",
    canvas: { nodes: [] },
    dailyKey: null,
    deletedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const roadmap = page({ id: "p1", title: "Roadmap", content: "Veja [[Pesquisa]] e [[Design]]." });
const research = page({ id: "p2", title: "Pesquisa", content: "Base do [[Roadmap]]." });
const design = page({ id: "p3", title: "Design", parentId: "p1" });
const specs = page({ id: "p4", title: "Specs", parentId: "p3" });

describe("wiki links", () => {
  it("extracts unique titles in order", () => {
    expect(extractWikiLinks("[[A]] [[B|apelido]] [[A]] [[C#secao]]")).toEqual(["A", "B", "C"]);
  });

  it("ignores links inside fenced code", () => {
    expect(extractWikiLinks("[[Fora]]\n```\n[[Dentro]]\n```\n")).toEqual(["Fora"]);
  });

  it("resolves titles case and accent insensitively", () => {
    expect(resolveWikiLink([research], "pesquisa")?.id).toBe("p2");
    expect(resolveWikiLink([research], "Pesquiza")).toBeNull();
  });

  it("finds outgoing links and backlinks", () => {
    expect(
      pageOutgoingLinks([roadmap, research, design], roadmap).map((link) => link.page?.id),
    ).toEqual(["p2", "p3"]);
    expect(pageBacklinks([roadmap, research, design], roadmap).map((entry) => entry.id)).toEqual([
      "p2",
    ]);
  });

  it("renders links as inline code outside fences", () => {
    expect(renderWikiLinksAsCode("[[Roadmap]]\n```\n[[X]]\n```")).toBe(
      "`[[Roadmap]]`\n```\n[[X]]\n```",
    );
  });

  it("reads a title back from the rendered code text", () => {
    expect(wikiLinkTitleFromText("[[Roadmap]]")).toBe("Roadmap");
    expect(wikiLinkTitleFromText("[[Roadmap|ver]]")).toBe("Roadmap");
    expect(wikiLinkTitleFromText("nada")).toBeNull();
  });
});

describe("page tree", () => {
  const pages = [roadmap, research, design, specs];

  it("nests children under their parent", () => {
    const tree = buildPageTree(pages, "space_1");
    expect(tree.map((node) => node.page.id)).toEqual(["p2", "p1"]);
    const roadmapNode = tree.find((node) => node.page.id === "p1");
    expect(roadmapNode?.children[0]?.page.id).toBe("p3");
    expect(roadmapNode?.children[0]?.children[0]?.page.id).toBe("p4");
  });

  it("builds breadcrumbs from the root", () => {
    expect(pageBreadcrumbs(pages, "p4").map((entry) => entry.title)).toEqual([
      "Roadmap",
      "Design",
      "Specs",
    ]);
  });

  it("builds a bidirectional graph without duplicates", () => {
    const graph = buildPageGraph(pages);
    expect(graph.edges).toEqual([
      { from: "p1", to: "p2" },
      { from: "p1", to: "p3" },
      { from: "p2", to: "p1" },
    ]);
    expect(graph.nodes.find((node) => node.id === "p1")?.links).toBe(3);
  });
});

describe("page search and outline", () => {
  const pages = [roadmap, research, design];

  it("prefers title matches over content matches", () => {
    expect(searchPages(pages, "pesquisa").map((entry) => entry.id)).toEqual(["p2", "p1"]);
    expect(searchPages(pages, "roadmap").map((entry) => entry.id)).toEqual(["p1", "p2"]);
  });

  it("extracts headings with slug ids", () => {
    expect(pageHeadings("# Plano\n## Ação\n## Ação")).toEqual([
      { level: 1, text: "Plano", id: "plano" },
      { level: 2, text: "Ação", id: "acao" },
      { level: 2, text: "Ação", id: "acao-1" },
    ]);
  });
});
