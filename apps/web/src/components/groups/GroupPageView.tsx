import type { EnvironmentProject } from "@t3tools/client-runtime/state/models";
import {
  CopyIcon,
  DownloadIcon,
  EllipsisIcon,
  FilePlus2Icon,
  FileTextIcon,
  ImageIcon,
  LayoutGridIcon,
  LinkIcon,
  MessageSquareIcon,
  NetworkIcon,
  StarIcon,
  TagIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

import { cn } from "../../lib/utils";
import {
  pageBacklinks,
  pageBreadcrumbs,
  pageHeadings,
  pageOutgoingLinks,
  pageWordCount,
  resolveWikiLink,
  type PageHeading,
} from "../../groups/pageLogic";
import { copyPageLink, exportPageMarkdown } from "../../groups/pageActions";
import { normalizePageTags, useGroupsStore } from "../../groups/groupStore";
import type { Group, GroupPage, GroupPageCoverId } from "../../groups/types";
import { GROUP_PAGE_COVER_CLASSES } from "../../groups/types";
import { WorkspacePageHeader } from "../WorkspacePageHeader";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from "../ui/menu";
import { SidebarInset } from "../ui/sidebar";
import { GroupConfirmDialog } from "./GroupActionDialogs";
import { CreatePageDialog } from "./GroupCreateDialogs";
import { GroupPageCanvas } from "./GroupPageCanvas";
import { GroupPageCoverDialog } from "./GroupPageCoverDialog";
import { GroupPageDiscussDialog } from "./GroupPageDiscussDialog";
import { GroupPageEditor } from "./GroupPageEditor";
import { GroupPageGraph } from "./GroupPageGraph";
import { GroupPageTrashDialog } from "./GroupPageTrashDialog";

function PageTitleInput({ page, onSave }: { page: GroupPage; onSave: (title: string) => void }) {
  return (
    <input
      aria-label="Título da página"
      className="w-full rounded-md bg-transparent text-2xl font-semibold text-foreground outline-none placeholder:text-muted-foreground/60 hover:bg-muted/40 focus-visible:bg-muted/40"
      onChange={(event) => onSave(event.target.value)}
      placeholder="Sem título"
      value={page.title}
    />
  );
}

function TagRow({ page, onSave }: { page: GroupPage; onSave: (tags: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const submit = () => {
    const next = normalizePageTags([...page.tags, draft]);
    setDraft("");
    if (next.length === page.tags.length) return;
    onSave(next);
  };
  return (
    <div className="flex flex-wrap items-center gap-1">
      {page.tags.map((tag) => (
        <span
          className="flex items-center gap-1 rounded-md bg-muted/60 px-1.5 py-0.5 text-2xs text-muted-foreground"
          key={tag}
        >
          {tag}
          <button
            aria-label={`Remover tag ${tag}`}
            className="rounded-sm outline-hidden hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            onClick={() => onSave(page.tags.filter((entry) => entry !== tag))}
            type="button"
          >
            <XIcon className="size-3" />
          </button>
        </span>
      ))}
      <form
        className="flex items-center"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <span className="w-24 shrink-0">
          <Input
            aria-label="Adicionar tag"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submit();
              }
            }}
            placeholder="+ tag"
            size="sm"
            value={draft}
          />
        </span>
      </form>
    </div>
  );
}

function HeadingSection({
  headings,
  onJump,
}: {
  headings: PageHeading[];
  onJump: (heading: PageHeading) => void;
}) {
  return (
    <aside className="hidden w-56 shrink-0 flex-col border-l border-border/60 bg-sidebar/40 xl:flex">
      <div className="border-b border-border/60 px-3 py-2">
        <h2 className="text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
          Nesta página
        </h2>
      </div>
      <div className="scrollbar-gutter-both min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {headings.length === 0 ? (
          <p className="px-1 text-xs leading-relaxed text-muted-foreground">
            Adicione títulos para montar o sumário.
          </p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {headings.map((heading) => (
              <li key={heading.id}>
                <button
                  className="w-full truncate rounded-md px-1.5 py-1 text-left text-xs text-muted-foreground outline-hidden hover:bg-muted/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  onClick={() => onJump(heading)}
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
        Digite / para blocos · [[ para linkar
      </p>
    </aside>
  );
}

function InfoChip({ children }: { children: ReactNode }) {
  return <span className="truncate">{children}</span>;
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
  const duplicatePage = useGroupsStore((store) => store.duplicatePage);
  const togglePageFavorite = useGroupsStore((store) => store.togglePageFavorite);
  const addPage = useGroupsStore((store) => store.addPage);
  const [discussOpen, setDiscussOpen] = useState(false);
  const [graphOpen, setGraphOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [subpageOpen, setSubpageOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [coverOpen, setCoverOpen] = useState(false);
  const editorWrapRef = useRef<HTMLDivElement>(null);

  const space = group.spaces.find((candidate) => candidate.id === page.spaceId) ?? null;
  const crumbs = pageBreadcrumbs(group.pages, page.id).slice(0, -1);
  const outgoing = pageOutgoingLinks(group.pages, page);
  const backlinks = pageBacklinks(group.pages, page);
  const headings = pageHeadings(page.content);
  const words = pageWordCount(page.content);
  const isCanvas = page.mode === "canvas";

  const save = (
    patch: Partial<
      Pick<
        GroupPage,
        "title" | "content" | "icon" | "parentId" | "cover" | "tags" | "mode" | "canvas"
      >
    >,
  ) => {
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

  const jumpToHeading = (heading: PageHeading) => {
    const container = editorWrapRef.current;
    if (container === null) return;
    const elements = Array.from(container.querySelectorAll<HTMLElement>("h1, h2, h3, h4"));
    const target = elements.find(
      (element) => (element.textContent ?? "").trim() === heading.text.trim(),
    );
    target?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  const coverStrip =
    page.cover === "" ? null : (
      <div
        className={cn(
          "relative h-36 w-full border-b border-border/60",
          GROUP_PAGE_COVER_CLASSES[page.cover],
        )}
      >
        <div className="absolute right-3 bottom-3 flex items-center gap-1">
          <Button onClick={() => setCoverOpen(true)} size="xs" variant="outline">
            Trocar capa
          </Button>
          <Button
            aria-label="Remover capa"
            onClick={() => save({ cover: "" })}
            size="icon-xs"
            variant="outline"
          >
            <XIcon />
          </Button>
        </div>
      </div>
    );

  const pageHeading = (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-2">
        <input
          aria-label="Ícone da página"
          className="mt-1 w-10 shrink-0 rounded-md bg-transparent text-center text-2xl outline-none hover:bg-muted/60 focus-visible:bg-muted/60"
          maxLength={4}
          onChange={(event) => save({ icon: event.target.value })}
          value={page.icon}
        />
        <div className="min-w-0 flex-1">
          <PageTitleInput onSave={(title) => save({ title })} page={page} />
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
            <InfoChip>{words} palavra(s)</InfoChip>
            <span aria-hidden>·</span>
            <InfoChip>{isCanvas ? "Quadro" : "Documento"}</InfoChip>
            <span aria-hidden>·</span>
            <InfoChip>atualizada em {new Date(page.updatedAt).toLocaleString("pt-BR")}</InfoChip>
            {page.dailyKey === null ? null : (
              <>
                <span aria-hidden>·</span>
                <InfoChip>diário</InfoChip>
              </>
            )}
          </p>
        </div>
      </div>
      <TagRow onSave={(tags) => save({ tags })} page={page} />
    </div>
  );

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
          aria-label="Modo documento"
          aria-pressed={!isCanvas}
          onClick={() => save({ mode: "document" })}
          size="icon-sm"
          variant={isCanvas ? "ghost" : "secondary"}
        >
          <FileTextIcon />
        </Button>
        <Button
          aria-label="Modo quadro"
          aria-pressed={isCanvas}
          onClick={() => save({ mode: "canvas" })}
          size="icon-sm"
          variant={isCanvas ? "secondary" : "ghost"}
        >
          <LayoutGridIcon />
        </Button>
        <Button
          aria-label="Nova subpágina"
          onClick={() => setSubpageOpen(true)}
          size="icon-sm"
          variant="ghost"
        >
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
        <Menu>
          <MenuTrigger
            render={<Button aria-label="Mais ações da página" size="icon-sm" variant="ghost" />}
          >
            <EllipsisIcon />
          </MenuTrigger>
          <MenuPopup align="end">
            <MenuItem onClick={() => setCoverOpen(true)}>
              <ImageIcon />
              {page.cover === "" ? "Adicionar capa" : "Trocar capa"}
            </MenuItem>
            <MenuItem onClick={() => exportPageMarkdown(page)}>
              <DownloadIcon />
              Exportar markdown
            </MenuItem>
            <MenuItem onClick={() => void copyPageLink(group.id, page.id)}>
              <CopyIcon />
              Copiar link
            </MenuItem>
            <MenuItem
              onClick={() => {
                const created = duplicatePage(group.id, page.id);
                if (created !== null) onOpenPage(created);
              }}
            >
              <FilePlus2Icon />
              Duplicar página
            </MenuItem>
            <MenuItem onClick={() => setTrashOpen(true)}>
              <Trash2Icon />
              Abrir lixeira
            </MenuItem>
            <MenuSeparator />
            <MenuItem onClick={() => setConfirmDelete(true)} variant="destructive">
              <Trash2Icon />
              Mover para a lixeira
            </MenuItem>
          </MenuPopup>
        </Menu>
      </WorkspacePageHeader>

      {isCanvas ? (
        <>
          {coverStrip}
          <div className="mx-auto w-full max-w-3xl shrink-0 px-5 pt-4 pb-3 sm:px-8">
            {pageHeading}
          </div>
          <GroupPageCanvas
            key={`${page.id}:canvas`}
            onChange={(canvas) => save({ canvas })}
            page={page}
          />
        </>
      ) : (
        <div className="flex min-h-0 flex-1">
          <div className="scrollbar-gutter-both min-h-0 flex-1 overflow-y-auto">
            {coverStrip}
            <article className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-5 pt-6 pb-10 sm:px-8">
              {pageHeading}

              <div ref={editorWrapRef}>
                <GroupPageEditor
                  key={page.id}
                  onChange={(markdown) => {
                    if (markdown === page.content) return;
                    save({ content: markdown });
                  }}
                  onOpenPageLink={openLink}
                  onSwitchToCanvas={() => save({ mode: "canvas" })}
                  value={page.content}
                />
              </div>

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
                                <span className="shrink-0 text-2xs text-muted-foreground">
                                  criar
                                </span>
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

              <section className="flex flex-col gap-1 border-t border-border/60 pt-4">
                <h2 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  <TagIcon className="size-3" />
                  Tags
                </h2>
                {page.tags.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Use tags para agrupar páginas por assunto e encontrá-las na busca.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {page.tags.map((tag) => `#${tag}`).join(" · ")}
                  </p>
                )}
              </section>
            </article>
          </div>

          <HeadingSection headings={headings} onJump={jumpToHeading} />
        </div>
      )}

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
      <GroupPageCoverDialog
        initial={page.cover}
        onOpenChange={setCoverOpen}
        onSubmit={(cover: GroupPageCoverId | "") => save({ cover })}
        open={coverOpen}
      />
      <GroupPageTrashDialog
        group={group}
        onOpenChange={setTrashOpen}
        onRestored={onOpenPage}
        open={trashOpen}
      />
      <GroupConfirmDialog
        confirmLabel="Mover para a lixeira"
        description="A página e as subpáginas vão para a lixeira e podem ser restauradas depois."
        onConfirm={() => {
          setConfirmDelete(false);
          deletePage(group.id, page.id);
        }}
        onOpenChange={setConfirmDelete}
        open={confirmDelete}
        title={`Mover ${page.title} para a lixeira?`}
      />
    </SidebarInset>
  );
}
