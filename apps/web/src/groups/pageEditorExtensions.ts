import { Mark, mergeAttributes } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";

import {
  ComposerBlockExtensions,
  ComposerCodeBlockExtension,
  ComposerCodeExtension,
  ComposerItalicExtension,
  ComposerListExtensions,
  ComposerTaskItemExtension,
  ComposerTaskListExtension,
} from "~/composer-rich-text-doc";

/** `[[Título]]` keeps its literal text in Markdown but renders as a navigable link. */
export const PageWikiLinkExtension = Mark.create({
  name: "pageWikiLink",
  inclusive: false,
  parseHTML() {
    return [{ tag: "span[data-page-wikilink]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { "data-page-wikilink": "", class: "page-wikilink" }),
      0,
    ];
  },
});

/**
 * Blocks the page editor shares with the composer, so page Markdown round-trips
 * through the same serializer without losing list markers or code fences.
 */
export const PAGE_EDITOR_EXTENSIONS = [
  StarterKit.configure({
    blockquote: false,
    bulletList: false,
    codeBlock: false,
    heading: false,
    horizontalRule: false,
    listItem: false,
    link: false,
    orderedList: false,
    underline: false,
    dropcursor: false,
    gapcursor: false,
    trailingNode: false,
    code: false,
    listKeymap: false,
    italic: false,
  }),
  ComposerItalicExtension,
  ComposerCodeExtension,
  ComposerCodeBlockExtension,
  ...ComposerBlockExtensions,
  ...ComposerListExtensions,
  ComposerTaskListExtension,
  ComposerTaskItemExtension,
  PageWikiLinkExtension,
];
