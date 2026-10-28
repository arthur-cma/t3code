import { getSchemaByResolvedExtensions, resolveExtensions } from "@tiptap/core";
import { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { describe, expect, it } from "vite-plus/test";

import {
  dailyKeyFor,
  dailyPageContent,
  dailyPageTitle,
  pageDocToMarkdown,
  pageMarkdownToDocJson,
  pageTemplateById,
  PAGE_TEMPLATES,
  shiftDailyKey,
} from "./pageDoc";
import { PAGE_EDITOR_EXTENSIONS } from "./pageEditorExtensions";

const schema = getSchemaByResolvedExtensions(resolveExtensions(PAGE_EDITOR_EXTENSIONS));

function roundTrip(markdown: string): string {
  const doc = ProseMirrorNode.fromJSON(schema, pageMarkdownToDocJson(markdown));
  doc.check();
  return pageDocToMarkdown(doc);
}

describe("pageDoc", () => {
  it("round-trips headings, styling and paragraphs", () => {
    expect(roundTrip("# Título\n\nTexto **negrito**, *itálico* e `código`.")).toBe(
      "# Título\nTexto **negrito**, *itálico* e `código`.",
    );
  });

  it("round-trips lists with their markers and nesting", () => {
    const markdown = "- um\n- dois\n  - aninhado\n1. primeiro\n2. segundo";
    expect(roundTrip(markdown)).toBe("- um\n- dois\n  - aninhado\n1. primeiro\n2. segundo");
  });

  it("round-trips task lists and quotes", () => {
    expect(roundTrip("- [x] feito\n- [ ] pendente")).toBe("- [x] feito\n- [ ] pendente");
    expect(roundTrip("> uma fala\n> outra linha")).toBe("> uma fala\n> outra linha");
  });

  it("keeps fenced code and dividers", () => {
    expect(roundTrip("```ts\nconst x = 1;\n```")).toBe("```ts\nconst x = 1;\n```");
    expect(roundTrip("---")).toBe("---");
  });

  it("keeps wikilinks literal while marking them", () => {
    const json = pageMarkdownToDocJson("Veja [[Pesquisa]] e [[Design|time]].");
    const doc = ProseMirrorNode.fromJSON(schema, json);
    const links: string[] = [];
    doc.descendants((node) => {
      if (node.marks.some((mark) => mark.type.name === "pageWikiLink")) {
        links.push(node.text ?? "");
      }
    });
    expect(links).toEqual(["[[Pesquisa]]", "[[Design|time]]"]);
    expect(pageDocToMarkdown(doc)).toBe("Veja [[Pesquisa]] e [[Design|time]].");
  });

  it("parses an empty body as one paragraph", () => {
    const json = pageMarkdownToDocJson("");
    expect(json.content).toEqual([{ type: "paragraph" }]);
    expect(pageDocToMarkdown(ProseMirrorNode.fromJSON(schema, json))).toBe("");
  });

  it("offers templates and finds them by id", () => {
    expect(PAGE_TEMPLATES.length).toBeGreaterThan(3);
    expect(pageTemplateById("meeting")?.mode).toBe("document");
    expect(pageTemplateById("board")?.mode).toBe("canvas");
    expect(pageTemplateById("nao-existe")).toBeNull();
    expect(pageTemplateById("meeting")?.content).toContain("## Pauta");
  });

  it("formats daily keys and titles", () => {
    const key = dailyKeyFor(new Date(2026, 9, 28, 15, 30));
    expect(key).toBe("2026-10-28");
    expect(dailyPageTitle(key)).toBe("28 de outubro de 2026");
    expect(shiftDailyKey("2026-10-31", 1)).toBe("2026-11-01");
    expect(shiftDailyKey("2026-03-01", -1)).toBe("2026-02-28");
    expect(dailyPageContent("2026-10-28")).toContain("[[29 de outubro de 2026]]");
  });
});
