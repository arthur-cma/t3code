import { toastManager } from "~/components/ui/toast";
import { writeTextToClipboard } from "~/hooks/useCopyToClipboard";

import type { GroupPage } from "./types";

/** Stable share link for a page, honoring the hash history used inside Electron. */
export function pageUrl(groupId: string, pageId: string): string {
  if (typeof window === "undefined") return "";
  const suffix = `/groups/${encodeURIComponent(groupId)}?page=${encodeURIComponent(pageId)}`;
  if (window.location.hash.startsWith("#/")) {
    return `${window.location.origin}${window.location.pathname}#${suffix}`;
  }
  return `${window.location.origin}${suffix}`;
}

export async function copyPageLink(groupId: string, pageId: string): Promise<void> {
  const url = pageUrl(groupId, pageId);
  const copied = await writeTextToClipboard(url, "page link");
  toastManager.add(
    copied
      ? { type: "success", title: "Link copiado", description: url }
      : { type: "error", title: "Não foi possível copiar o link", description: url },
  );
}

export function pageMarkdownFile(page: GroupPage): string {
  const heading = page.title.trim().length > 0 ? page.title.trim() : "Sem título";
  return `# ${heading}\n\n${page.content.trim()}\n`;
}

function fileSlug(title: string): string {
  const slug = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return slug.length > 0 ? slug : "pagina";
}

export function exportPageMarkdown(page: GroupPage): void {
  if (typeof URL.createObjectURL !== "function") return;
  const blob = new Blob([pageMarkdownFile(page)], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${fileSlug(page.title)}.md`;
  anchor.rel = "noopener";
  anchor.click();
  URL.revokeObjectURL(url);
  toastManager.add({ type: "success", title: "Markdown exportado" });
}
