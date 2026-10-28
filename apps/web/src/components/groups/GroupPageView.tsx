import type { EnvironmentProject } from "@t3tools/client-runtime/state/models";
import {
  EyeIcon,
  FilePlus2Icon,
  LinkIcon,
  MessageSquareIcon,
  NetworkIcon,
  PencilIcon,
  StarIcon,
  Trash2Icon,
} from "lucide-react";
import { useRef, useState, type MouseEvent as ReactMouseEvent } from "react";

import {
  pageBacklinks,
  pageBreadcrumbs,
  pageHeadings,
  pageOutgoingLinks,
  pageWordCount,
  renderWikiLinksAsCode,
  resolveWikiLink,
  wikiLinkTitleFromText,
} from "../../groups/pageLogic";
import { useGroupsStore } from "../../groups/groupStore";
import type { Group, GroupPage } from "../../groups/types";
import { cn } from "../../lib/utils";
import ChatMarkdown from "../ChatMarkdown";
import { WorkspacePageHeader } from "../WorkspacePageHeader";
import { Button } from "../ui/button";
import { SidebarInset } from "../ui/sidebar";
import { GroupConfirmDialog } from "./GroupActionDialogs";
import { CreatePageDialog } from "./GroupCreateDialogs";
import { GroupPageDiscussDialog } from "./GroupPageDiscussDialog";
import { GroupPageGraph } from "./GroupPageGraph";

function ToolbarButton({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      aria-label={title}
      className="flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-xs text-muted-foreground outline-hidden transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

export function GroupPageView({
  group,
  page,
  project,
  onOpenPage,
  onOpenChannel,
}: {
  group: Group;
  page: GroupPage;
  project: EnvironmentProject | null;
  onOpenPage: (pageId: string) => void;
  onOpenChannel: (channelId: string) => void;
}) {
  const updatePage = useGroupsStore((store) => store.updatePage);
  const deletePage = useGroupsStore((store) => store.deletePage);
  const togglePageFavorite = useGroupsStore((store) => store.togglePageFavorite);
  const addPage = useGroupsStore((store) => store.addPage);
  const [mode, setMode] = useState<"edit" | "preview">(() =>
    page.content.trim().length > 0 ? "preview" : "edit",
  );
  const [discussOpen, setDiscussOpen] = useState(false);
  const [graphOpen, setGraphOpen] = useState(false);
  const [subpageOpen, setSubpageOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const space = group.spaces.find((candidate) => candidate.id === page.spaceId) ?? null;
  const crumbs = pageBreadcrumbs(group.pages, page.id).slice(0, -1);
  const outgoing = pageOutgoingLinks(group.pages, page);
  const backlinks = pageBacklinks(group.pages, page);
  const headings = pageHeadings(page.content);
  const words = pageWordCount(page.content);

  const save = (patch: Partial<Pick<GroupPage, "title" | "content" | "icon" | "parentId">>) => {
    updatePage(group.id, page.id, patch);
  };

  const openLink = (title: string) => {
    const linked = resolveWikiLink(group.pages, title);
    if (linked !== null) {
      onOpenPage(linked.id);
      return;
    }
    const created = addPage(group.id, { spaceId: page.spaceId, title });
    if (created !== null) onOpenPage(created);
  };

  const handlePreviewClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    const code = target?.closest("code");
    if (code === null || code === undefined) return;
    const title = wikiLinkTitleFromText(code.textContent ?? "");
    if (title === null) return;
    event.preventDefault();
    openLink(title);
  };

  const wrapSelection = (prefix: string, suffix = prefix) => {
    const element = editorRef.current;
    if (element === null) return;
    const start = element.selectionStart;
    const end = element.selectionEnd;
    const current = page.content;
    const selected = current.slice(start, end);
    const next = `${current.slice(0, start)}${prefix}${selected}${suffix}${current.slice(end)}`;
    save({ content: next });
    requestAnimationFrame(() => {
      element.focus();
      const caret = start + prefix.length + selected.length + suffix.length;
      element.setSelectionRange(caret, caret);
    });
  };

  const prefixLines = (prefix: string) => {
    const element = editorRef.current;
    if (element === null) return;
    const start = element.selectionStart;
    const end = element.selectionEnd;
    const current = page.content;
    const lineStart = current.lastIndexOf("\n", start - 1) + 1;
    const block = current.slice(lineStart, end);
    const prefixed = block
      .split("\n")
      .map((line) => `${prefix}${line}`)
      .join("\n");
    const next = `${current.slice(0, lineStart)}${prefixed}${current.slice(end)}`;
    save({ content: next });
    requestAnimationFrame(() => {
      element.focus();
      const caret = lineStart + prefixed.length;
      element.setSelectionRange(caret, caret);
    });
  };

  const addSubpage = () => {
    setSubpageOpen(true);
  };

  const scrollToHeading = (id: string) => {
    const container = previewRef.current;
    if (container === null) return;
    const target = container.querySelector<HTMLElement>(`[id="${CSS.escape(id)}"]`);
    target?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden" role="main">
      <WorkspacePageHeader className="gap-2 border-b border-border/60">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-muted-foreground">
          <span aria-hidden className="text-sm leading-none">
            {space?.icon ?? "📁"}
          </span>
          <span className="truncate">{space?.name ?? "Espaço"}</span>
          {crumbs.map((crumb) => (
            <span className="flex min-w-0 items-center gap-1.5" key={crumb.id}>
              <span aria-hidden>/</span>
              <button
                className="max-w-40 truncate rounded-sm outline-hidden hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                onClick={() => onOpenPage(crumb.id)}
                type="button"
              >
                {crumb.title}
              </button>
            </span>
          ))}
          <span aria-hidden>/</span>
          <span className="max-w-48 truncate font-medium text-foreground">{page.title}</span>
        </div>

        <Button
          aria-label={mode === "edit" ? "Visualizar página" : "Editar página"}
          onClick={() => setMode((current) => (current === "edit" ? "preview" : "edit"))}
          size="icon-sm"
          variant="ghost"
        >
          {mode === "edit" ? <EyeIcon /> : <PencilIcon />}
        </Button>
        <Button aria-label="Nova subpágina" onClick={addSubpage} size="icon-sm" variant="ghost">
          <FilePlus2Icon />
        </Button>
        <Button
          aria-label={page.favorite ? "Remover dos favoritos" : "Favoritar página"}
          aria-pressed={page.favorite}
          onClick={() => togglePageFavorite(group.id, page.id)}
          size="icon-sm"
          variant="ghost"
        >
          <StarIcon className={cn(page.favorite && "fill-current text-warning")} />
        </Button>
        <Button
          aria-label="Grafo de páginas"
          onClick={() => setGraphOpen(true)}
          size="icon-sm"
          variant="ghost"
        >
          <NetworkIcon />
        </Button>
        <Button
          aria-label="Discutir com agentes"
          onClick={() => setDiscussOpen(true)}
          size="icon-sm"
          variant="ghost"
        >
          <MessageSquareIcon />
        </Button>
        <Button
          aria-label="Excluir página"
          onClick={() => setConfirmDelete(true)}
          size="icon-sm"
          variant="ghost"
        >
          <Trash2Icon />
        </Button>
      </WorkspacePageHeader>

      <div className="flex min-h-0 flex-1">
        <div className="scrollbar-gutter-both min-h-0 flex-1 overflow-y-auto">
          <article className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-5 py-8 sm:px-8">
            <div className="flex items-start gap-2">
              <input
                aria-label="Ícone da página"
                className="mt-1 w-10 shrink-0 rounded-md bg-transparent text-center text-2xl outline-none hover:bg-muted/60 focus-visible:bg-muted/60"
                maxLength={4}
                onChange={(event) => save({ icon: event.target.value })}
                value={page.icon}
              />
              <div className="min-w-0 flex-1">
                <input
                  aria-label="Título da página"
                  className="w-full rounded-md bg-transparent text-2xl font-semibold text-foreground outline-none placeholder:text-muted-foreground/60 hover:bg-muted/40 focus-visible:bg-muted/40"
                  onChange={(event) => save({ title: event.target.value })}
                  placeholder="Sem título"
                  value={page.title}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {words} palavra(s) · atualizada em{" "}
                  {new Date(page.updatedAt).toLocaleString("pt-BR")}
                </p>
              </div>
            </div>

            {mode === "edit" ? (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-0.5 rounded-md border border-border/60 bg-muted/20 px-1 py-0.5">
                  <ToolbarButton onClick={() => wrapSelection("**")} title="Negrito">
                    B
                  </ToolbarButton>
                  <ToolbarButton onClick={() => wrapSelection("*")} title="Itálico">
                    I
                  </ToolbarButton>
                  <ToolbarButton onClick={() => wrapSelection("`")} title="Código">
                    {"</>"}
                  </ToolbarButton>
                  <ToolbarButton onClick={() => prefixLines("## ")} title="Título">
                    H2
                  </ToolbarButton>
                  <ToolbarButton onClick={() => prefixLines("- ")} title="Lista">
                    •
                  </ToolbarButton>
                  <ToolbarButton onClick={() => prefixLines("> ")} title="Citação">
                    ❝
                  </ToolbarButton>
                  <ToolbarButton onClick={() => wrapSelection("[", "](url)")} title="Link">
                    <LinkIcon className="size-3.5" />
                  </ToolbarButton>
                  <ToolbarButton onClick={() => wrapSelection("[[", "]]")} title="Link para página">
                    [[ ]]
                  </ToolbarButton>
                </div>
                <textarea
                  aria-label="Conteúdo da página"
                  className="min-h-[55vh] w-full resize-y rounded-lg border border-input bg-background px-4 py-3 font-mono text-sm leading-relaxed text-foreground shadow-xs outline-none placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/24 focus-visible:ring-inset"
                  onChange={(event) => save({ content: event.target.value })}
                  placeholder="Escreva em markdown. Use [[Título]] para linkar outra página."
                  ref={editorRef}
                  spellCheck
                  value={page.content}
                />
                <p className="text-2xs text-muted-foreground">
                  Markdown · [[wikilinks]] criam páginas quando o título não existe
                </p>
              </div>
            ) : (
              <div
                className="min-h-[40vh] rounded-lg"
                onClickCapture={handlePreviewClick}
                ref={previewRef}
              >
                {page.content.trim().length === 0 ? (
                  <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border/70 px-4 py-10 text-center">
                    <p className="text-sm text-muted-foreground">Esta página está vazia.</p>
                    <Button onClick={() => setMode("edit")} size="sm" variant="outline">
                      <PencilIcon />
                      Escrever
                    </Button>
                  </div>
                ) : (
                  <ChatMarkdown
                    className="[&_code]:cursor-pointer [&_code]:rounded [&_code]:bg-primary/10 [&_code]:px-1 [&_code]:text-primary"
                    cwd={project?.workspaceRoot}
                    text={renderWikiLinksAsCode(page.content)}
                  />
                )}
              </div>
            )}

            <section className="flex flex-col gap-2 border-t border-border/60 pt-4">
              <h2 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                <LinkIcon className="size-3" />
                Conexões
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <p className="text-2xs text-muted-foreground">
                    Links desta página ({outgoing.length})
                  </p>
                  {outgoing.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Nenhum link. Use [[Título]] no conteúdo.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-0.5">
                      {outgoing.map((link) => (
                        <li key={link.title}>
                          <button
                            className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-sm text-foreground outline-hidden hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                            onClick={() => openLink(link.title)}
                            type="button"
                          >
                            <span aria-hidden>{link.page?.icon ?? "➕"}</span>
                            <span className="min-w-0 flex-1 truncate">{link.title}</span>
                            {link.page === null ? (
                              <span className="shrink-0 text-2xs text-muted-foreground">criar</span>
                            ) : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-2xs text-muted-foreground">Backlinks ({backlinks.length})</p>
                  {backlinks.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Nenhuma página menciona esta ainda.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-0.5">
                      {backlinks.map((source) => (
                        <li key={source.id}>
                          <button
                            className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-sm text-foreground outline-hidden hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                            onClick={() => onOpenPage(source.id)}
                            type="button"
                          >
                            <span aria-hidden>{source.icon}</span>
                            <span className="min-w-0 flex-1 truncate">{source.title}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </section>
          </article>
        </div>

        <aside className="hidden w-56 shrink-0 flex-col border-l border-border/60 bg-sidebar/40 xl:flex">
          <div className="border-b border-border/60 px-3 py-2">
            <h2 className="text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
              Nesta página
            </h2>
          </div>
          <div className="scrollbar-gutter-both min-h-0 flex-1 overflow-y-auto px-2 py-2">
            {headings.length === 0 ? (
              <p className="px-1 text-xs leading-relaxed text-muted-foreground">
                Adicione títulos com ## para montar o sumário.
              </p>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {headings.map((heading) => (
                  <li key={heading.id}>
                    <button
                      className="w-full truncate rounded-md px-1.5 py-1 text-left text-xs text-muted-foreground outline-hidden hover:bg-muted/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                      onClick={() => scrollToHeading(heading.id)}
                      style={{ paddingLeft: `${6 + (heading.level - 1) * 10}px` }}
                      type="button"
                    >
                      {heading.text}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="border-t border-border/60 px-3 py-2 text-2xs leading-relaxed text-muted-foreground">
            Atalhos: [[ para linkar · ## para títulos
          </p>
        </aside>
      </div>

      <GroupPageDiscussDialog
        group={group}
        onOpenChange={setDiscussOpen}
        onSent={onOpenChannel}
        open={discussOpen}
        page={page}
        project={project}
      />
      <GroupPageGraph
        group={group}
        onOpenChange={setGraphOpen}
        onOpenPage={onOpenPage}
        open={graphOpen}
      />
      <CreatePageDialog
        defaultParentId={page.id}
        defaultSpaceId={page.spaceId}
        group={group}
        onCreated={(pageId) => {
          setSubpageOpen(false);
          onOpenPage(pageId);
        }}
        onOpenChange={setSubpageOpen}
        open={subpageOpen}
      />
      <GroupConfirmDialog
        confirmLabel="Excluir página"
        description="A página e as subpáginas dela serão removidas. Esta ação não pode ser desfeita."
        onConfirm={() => {
          setConfirmDelete(false);
          deletePage(group.id, page.id);
        }}
        onOpenChange={setConfirmDelete}
        open={confirmDelete}
        title={`Excluir página ${page.title}?`}
      />
    </SidebarInset>
  );
}
