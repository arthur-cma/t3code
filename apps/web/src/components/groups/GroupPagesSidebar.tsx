import {
  CalendarDaysIcon,
  ChevronRightIcon,
  ClockIcon,
  CopyIcon,
  DownloadIcon,
  FilePlus2Icon,
  FileTextIcon,
  FolderPlusIcon,
  LayoutGridIcon,
  PlusIcon,
  StarIcon,
  Trash2Icon,
} from "lucide-react";
import { useState } from "react";

import { useNowMinute } from "../../hooks/useNowMinute";
import { copyPageLink, exportPageMarkdown } from "../../groups/pageActions";
import { buildPageTree, searchPages, type PageTreeNode } from "../../groups/pageLogic";
import { dailyKeyFor } from "../../groups/pageDoc";
import {
  dailyPages,
  favoritePages,
  pageSubtree,
  recentPages,
  trashedPages,
  useGroupsStore,
} from "../../groups/groupStore";
import type { Group, GroupPage, GroupSpace } from "../../groups/types";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "../ui/sidebar";
import { GroupConfirmDialog, GroupTextDialog } from "./GroupActionDialogs";
import {
  GroupContextMenu,
  useGroupContextMenu,
  type GroupContextMenuItem,
} from "./GroupContextMenu";
import { CreatePageDialog, CreateSpaceDialog } from "./GroupCreateDialogs";
import { GroupPageTrashDialog } from "./GroupPageTrashDialog";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-2xs font-semibold tracking-wider text-sidebar-muted-foreground uppercase">
      {children}
    </span>
  );
}

function SectionHeader({ label, count }: { label: string; count?: number }) {
  return (
    <div className="flex items-baseline justify-between gap-2 px-2">
      <SectionLabel>{label}</SectionLabel>
      {count === undefined ? null : (
        <span className="text-2xs tabular-nums text-sidebar-muted-foreground">{count}</span>
      )}
    </div>
  );
}

function PageRow({
  page,
  active,
  onOpenPage,
  onContextMenu,
}: {
  page: GroupPage;
  active: boolean;
  onOpenPage: (pageId: string) => void;
  onContextMenu: (event: React.MouseEvent, page: GroupPage) => void;
}) {
  return (
    <SidebarMenuButton
      isActive={active}
      onClick={() => onOpenPage(page.id)}
      onContextMenu={(event) => onContextMenu(event, page)}
    >
      <span aria-hidden className="w-4 shrink-0 text-center text-sm leading-none">
        {page.icon}
      </span>
      <span className="truncate">{page.title}</span>
      {page.dailyKey !== null ? (
        <span className="ml-auto shrink-0 text-2xs text-sidebar-muted-foreground">Diário</span>
      ) : null}
      {page.favorite ? (
        <StarIcon
          className={cn("size-3 shrink-0 text-warning", page.dailyKey === null && "ml-auto")}
        />
      ) : null}
    </SidebarMenuButton>
  );
}

function TreeBranch({
  node,
  depth,
  activePageId,
  onOpenPage,
  onPageContextMenu,
}: {
  node: PageTreeNode;
  depth: number;
  activePageId: string | null;
  onOpenPage: (pageId: string) => void;
  onPageContextMenu: (event: React.MouseEvent, page: GroupPage) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  return (
    <SidebarMenuItem>
      <div className="flex items-center">
        {hasChildren ? (
          <button
            aria-expanded={expanded}
            aria-label={expanded ? "Recolher subpáginas" : "Expandir subpáginas"}
            className="flex size-5 shrink-0 items-center justify-center rounded-sm text-sidebar-muted-foreground outline-hidden hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            onClick={() => setExpanded((value) => !value)}
            style={{ marginLeft: `${depth * 12}px` }}
            type="button"
          >
            <ChevronRightIcon
              className={cn("size-3 transition-transform", expanded && "rotate-90")}
            />
          </button>
        ) : (
          <span aria-hidden className="size-5 shrink-0" style={{ marginLeft: `${depth * 12}px` }} />
        )}
        <div className="min-w-0 flex-1">
          <PageRow
            active={node.page.id === activePageId}
            onContextMenu={onPageContextMenu}
            onOpenPage={onOpenPage}
            page={node.page}
          />
        </div>
      </div>
      {hasChildren && expanded ? (
        <div className="mt-0.5 flex flex-col gap-0.5">
          {node.children.map((child) => (
            <TreeBranch
              activePageId={activePageId}
              depth={depth + 1}
              key={child.page.id}
              node={child}
              onOpenPage={onOpenPage}
              onPageContextMenu={onPageContextMenu}
            />
          ))}
        </div>
      ) : null}
    </SidebarMenuItem>
  );
}

type PageDraft = { spaceId: string; parentId: string | null; templateId?: string };

type RenameTarget =
  | { kind: "page"; id: string; value: string; label: string }
  | { kind: "space"; id: string; value: string; label: string };

type DeleteTarget =
  | { kind: "page"; id: string; name: string }
  | { kind: "space"; id: string; name: string };

export function GroupPagesSidebar({
  group,
  activePageId,
  onOpenPage,
  onClearPage,
}: {
  group: Group;
  activePageId: string | null;
  onOpenPage: (pageId: string) => void;
  onClearPage: () => void;
}) {
  const updatePage = useGroupsStore((store) => store.updatePage);
  const deletePage = useGroupsStore((store) => store.deletePage);
  const togglePageFavorite = useGroupsStore((store) => store.togglePageFavorite);
  const updateSpace = useGroupsStore((store) => store.updateSpace);
  const deleteSpace = useGroupsStore((store) => store.deleteSpace);
  const ensureDailyPage = useGroupsStore((store) => store.ensureDailyPage);
  const duplicatePage = useGroupsStore((store) => store.duplicatePage);
  // `minuteTick` is a UTC ISO string; the `Z` makes the local day come out right.
  const nowMinute = useNowMinute();

  const [query, setQuery] = useState("");
  const [trashOpen, setTrashOpen] = useState(false);
  const [spaceDialogOpen, setSpaceDialogOpen] = useState(false);
  const [pageDraft, setPageDraft] = useState<PageDraft | null>(null);
  const [collapsedSpaces, setCollapsedSpaces] = useState<Record<string, boolean>>({});
  const [rename, setRename] = useState<RenameTarget | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<DeleteTarget | null>(null);
  const pageMenu = useGroupContextMenu<GroupPage>();
  const spaceMenu = useGroupContextMenu<GroupSpace>();
  const sectionMenu = useGroupContextMenu<null>();

  const livePages = group.pages.filter((page) => page.deletedAt === null);
  const favorites = favoritePages(group);
  const recents = recentPages(group, 4);
  const results = query.trim().length > 0 ? searchPages(group.pages, query, 12) : [];
  const searching = query.trim().length > 0;
  const todayKey = dailyKeyFor(new Date(`${nowMinute}Z`));
  const today = livePages.find((page) => page.dailyKey === todayKey);
  const dailies = dailyPages(group)
    .filter((page) => page.dailyKey !== todayKey)
    .slice(0, 3);
  const trashCount = trashedPages(group).length;
  const firstSpaceId = group.spaces[0]?.id ?? "";

  const openToday = () => {
    const pageId = ensureDailyPage(group.id);
    if (pageId !== null) onOpenPage(pageId);
  };

  const startPage = (draft: PageDraft) => {
    setPageDraft(draft);
  };

  const pageItems = (page: GroupPage): GroupContextMenuItem[] => [
    {
      id: "open",
      label: "Abrir página",
      icon: <FileTextIcon />,
      onSelect: () => onOpenPage(page.id),
    },
    {
      id: "rename",
      label: "Renomear página",
      icon: <FileTextIcon />,
      onSelect: () =>
        setRename({ kind: "page", id: page.id, value: page.title, label: "Título da página" }),
    },
    {
      id: "subpage",
      label: "Nova subpágina",
      icon: <FilePlus2Icon />,
      onSelect: () => startPage({ spaceId: page.spaceId, parentId: page.id }),
    },
    {
      id: "favorite",
      label: page.favorite ? "Remover dos favoritos" : "Favoritar página",
      icon: <StarIcon />,
      onSelect: () => togglePageFavorite(group.id, page.id),
    },
    {
      id: "duplicate",
      label: "Duplicar página",
      icon: <CopyIcon />,
      onSelect: () => {
        const created = duplicatePage(group.id, page.id);
        if (created !== null) onOpenPage(created);
      },
    },
    {
      id: "copy-link",
      label: "Copiar link",
      icon: <FileTextIcon />,
      onSelect: () => void copyPageLink(group.id, page.id),
    },
    {
      id: "export",
      label: "Exportar markdown",
      icon: <DownloadIcon />,
      onSelect: () => exportPageMarkdown(page),
    },
    {
      id: "delete",
      label: "Mover para a lixeira",
      icon: <Trash2Icon />,
      separatorBefore: true,
      variant: "destructive",
      onSelect: () => setConfirmDelete({ kind: "page", id: page.id, name: page.title }),
    },
  ];

  const spaceItems = (space: GroupSpace): GroupContextMenuItem[] => [
    {
      id: "new-page",
      label: "Nova página",
      icon: <FilePlus2Icon />,
      onSelect: () => startPage({ spaceId: space.id, parentId: null }),
    },
    {
      id: "new-board",
      label: "Novo quadro",
      icon: <FilePlus2Icon />,
      onSelect: () => startPage({ spaceId: space.id, parentId: null, templateId: "board" }),
    },
    {
      id: "rename",
      label: "Renomear espaço",
      icon: <FileTextIcon />,
      onSelect: () =>
        setRename({ kind: "space", id: space.id, value: space.name, label: "Nome do espaço" }),
    },
    {
      id: "delete",
      label: "Excluir espaço",
      icon: <Trash2Icon />,
      separatorBefore: true,
      variant: "destructive",
      disabled: group.spaces.length <= 1,
      onSelect: () => setConfirmDelete({ kind: "space", id: space.id, name: space.name }),
    },
  ];

  const submitRename = (value: string) => {
    if (rename === null) return;
    if (rename.kind === "page") updatePage(group.id, rename.id, { title: value });
    else updateSpace(group.id, rename.id, { name: value });
    setRename(null);
  };

  const submitDelete = () => {
    if (confirmDelete === null) return;
    if (confirmDelete.kind === "page") {
      const doomed = pageSubtree(group.pages, confirmDelete.id);
      deletePage(group.id, confirmDelete.id);
      if (activePageId !== null && doomed.has(activePageId)) onClearPage();
    } else {
      const space = group.spaces.find((candidate) => candidate.id === confirmDelete.id) ?? null;
      const activePage =
        activePageId === null
          ? null
          : (group.pages.find((page) => page.id === activePageId) ?? null);
      if (
        deleteSpace(group.id, confirmDelete.id) &&
        space !== null &&
        activePage?.spaceId === space.id
      ) {
        onClearPage();
      }
    }
    setConfirmDelete(null);
  };

  return (
    <div className="flex flex-col gap-5 pb-2">
      <div className="flex flex-col gap-2 px-2">
        <SectionHeader count={livePages.length} label="Páginas" />
        <Button
          className="w-full justify-start"
          onClick={() => startPage({ spaceId: firstSpaceId, parentId: null })}
          size="sm"
          variant="outline"
        >
          <PlusIcon />
          Nova página
        </Button>
        <span className="w-full">
          <Input
            aria-label="Buscar páginas e tags"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar páginas e tags"
            size="sm"
            value={query}
          />
        </span>
      </div>

      {searching ? (
        <div className="flex flex-col gap-1 px-2">
          <SectionHeader count={results.length} label="Resultados" />
          <SidebarMenu>
            {results.length === 0 ? (
              <p className="px-1 py-1 text-xs leading-relaxed text-sidebar-muted-foreground">
                Nenhuma página encontrada para “{query.trim()}”.
              </p>
            ) : (
              results.map((page) => (
                <SidebarMenuItem key={page.id}>
                  <PageRow
                    active={page.id === activePageId}
                    onContextMenu={pageMenu.openMenu}
                    onOpenPage={onOpenPage}
                    page={page}
                  />
                </SidebarMenuItem>
              ))
            )}
          </SidebarMenu>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1 px-2">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={today?.id === activePageId}
                  onClick={openToday}
                  onContextMenu={
                    today === undefined ? undefined : (event) => pageMenu.openMenu(event, today)
                  }
                >
                  <CalendarDaysIcon />
                  <span className="truncate">Diário de hoje</span>
                  {today === undefined ? (
                    <span className="ml-auto shrink-0 text-2xs text-sidebar-muted-foreground">
                      criar
                    </span>
                  ) : null}
                </SidebarMenuButton>
              </SidebarMenuItem>
              {dailies.map((page) => (
                <SidebarMenuItem key={page.id}>
                  <PageRow
                    active={page.id === activePageId}
                    onContextMenu={pageMenu.openMenu}
                    onOpenPage={onOpenPage}
                    page={page}
                  />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </div>

          {livePages.length === 0 ? (
            <div className="mx-2 rounded-lg border border-dashed border-sidebar-border p-3">
              <p className="text-xs font-medium text-sidebar-foreground">Nenhuma página ainda</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Button
                  onClick={() => startPage({ spaceId: firstSpaceId, parentId: null })}
                  size="xs"
                >
                  <PlusIcon />
                  Nova página
                </Button>
                <Button
                  onClick={() =>
                    startPage({ spaceId: firstSpaceId, parentId: null, templateId: "board" })
                  }
                  size="xs"
                  variant="outline"
                >
                  <LayoutGridIcon />
                  Quadro
                </Button>
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-3">
            {group.spaces.map((space) => {
              const tree = buildPageTree(group.pages, space.id);
              const spacePages = livePages.filter((page) => page.spaceId === space.id).length;
              const expanded = collapsedSpaces[space.id] !== true;
              return (
                <div className="flex flex-col gap-1" key={space.id}>
                  <div
                    className="flex h-8 items-center gap-1 rounded-md pr-1 pl-1 hover:bg-sidebar-row-hover"
                    onContextMenu={(event) => spaceMenu.openMenu(event, space)}
                  >
                    <button
                      aria-expanded={expanded}
                      aria-label={expanded ? `Recolher ${space.name}` : `Expandir ${space.name}`}
                      className="flex size-5 shrink-0 items-center justify-center rounded-sm text-sidebar-muted-foreground outline-hidden hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                      onClick={() =>
                        setCollapsedSpaces((current) => ({
                          ...current,
                          [space.id]: expanded,
                        }))
                      }
                      type="button"
                    >
                      <ChevronRightIcon
                        className={cn("size-3.5 transition-transform", expanded && "rotate-90")}
                      />
                    </button>
                    <span aria-hidden className="text-sm leading-none">
                      {space.icon}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold text-sidebar-foreground">
                      {space.name}
                    </span>
                    <span className="text-2xs tabular-nums text-sidebar-muted-foreground">
                      {spacePages}
                    </span>
                    <Button
                      aria-label={`Nova página em ${space.name}`}
                      onClick={() => startPage({ spaceId: space.id, parentId: null })}
                      size="icon-xs"
                      variant="ghost"
                    >
                      <PlusIcon />
                    </Button>
                  </div>
                  {expanded ? (
                    tree.length === 0 ? (
                      <button
                        className="ml-7 flex h-7 items-center gap-1 rounded-md px-1 text-left text-xs text-sidebar-muted-foreground outline-hidden hover:bg-sidebar-row-hover hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                        onClick={() => startPage({ spaceId: space.id, parentId: null })}
                        type="button"
                      >
                        <PlusIcon className="size-3" />
                        Nova página em {space.name}
                      </button>
                    ) : (
                      <SidebarMenu>
                        {tree.map((node) => (
                          <TreeBranch
                            activePageId={activePageId}
                            depth={0}
                            key={node.page.id}
                            node={node}
                            onOpenPage={onOpenPage}
                            onPageContextMenu={pageMenu.openMenu}
                          />
                        ))}
                      </SidebarMenu>
                    )
                  ) : null}
                </div>
              );
            })}

            <div className="px-2">
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={() => setSpaceDialogOpen(true)} size="sm">
                    <FolderPlusIcon />
                    <span>Novo espaço</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </div>
          </div>

          {favorites.length > 0 ? (
            <div className="flex flex-col gap-1 px-2">
              <SectionHeader count={favorites.length} label="Favoritos" />
              <SidebarMenu>
                {favorites.map((page) => (
                  <SidebarMenuItem key={page.id}>
                    <PageRow
                      active={page.id === activePageId}
                      onContextMenu={pageMenu.openMenu}
                      onOpenPage={onOpenPage}
                      page={page}
                    />
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </div>
          ) : null}

          {recents.length > 0 ? (
            <div className="flex flex-col gap-1 px-2">
              <div className="flex items-center gap-1.5 px-2">
                <ClockIcon className="size-3 text-sidebar-muted-foreground" />
                <SectionLabel>Recentes</SectionLabel>
              </div>
              <SidebarMenu>
                {recents.map((page) => (
                  <SidebarMenuItem key={page.id}>
                    <PageRow
                      active={page.id === activePageId}
                      onContextMenu={pageMenu.openMenu}
                      onOpenPage={onOpenPage}
                      page={page}
                    />
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </div>
          ) : null}

          <div className="flex flex-col gap-0.5 px-2">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setTrashOpen(true)} size="sm">
                  <Trash2Icon />
                  <span>Lixeira</span>
                  {trashCount === 0 ? null : (
                    <span className="ml-auto text-2xs tabular-nums text-sidebar-muted-foreground">
                      {trashCount}
                    </span>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </div>
        </>
      )}

      <GroupPageTrashDialog
        group={group}
        onOpenChange={setTrashOpen}
        onRestored={onOpenPage}
        open={trashOpen}
      />

      <GroupContextMenu
        items={pageMenu.state === null ? [] : pageItems(pageMenu.state.target)}
        onClose={pageMenu.closeMenu}
        point={pageMenu.state?.point ?? null}
      />
      <GroupContextMenu
        items={spaceMenu.state === null ? [] : spaceItems(spaceMenu.state.target)}
        onClose={spaceMenu.closeMenu}
        point={spaceMenu.state?.point ?? null}
      />
      <GroupContextMenu
        items={[
          {
            id: "new-space",
            label: "Novo espaço",
            icon: <FolderPlusIcon />,
            onSelect: () => setSpaceDialogOpen(true),
          },
          {
            id: "new-page",
            label: "Nova página",
            icon: <FilePlus2Icon />,
            disabled: group.spaces.length === 0,
            onSelect: () => startPage({ spaceId: firstSpaceId, parentId: null }),
          },
          {
            id: "new-board",
            label: "Novo quadro",
            icon: <FilePlus2Icon />,
            disabled: group.spaces.length === 0,
            onSelect: () =>
              startPage({ spaceId: firstSpaceId, parentId: null, templateId: "board" }),
          },
        ]}
        onClose={sectionMenu.closeMenu}
        point={sectionMenu.state?.point ?? null}
      />

      <CreateSpaceDialog
        group={group}
        onCreated={() => {
          setSpaceDialogOpen(false);
        }}
        onOpenChange={setSpaceDialogOpen}
        open={spaceDialogOpen}
      />
      <CreatePageDialog
        defaultParentId={pageDraft?.parentId ?? null}
        defaultSpaceId={pageDraft?.spaceId}
        defaultTemplateId={pageDraft?.templateId}
        group={group}
        onCreated={(pageId) => {
          setPageDraft(null);
          onOpenPage(pageId);
        }}
        onOpenChange={(open) => {
          if (!open) setPageDraft(null);
        }}
        open={pageDraft !== null}
      />
      <GroupTextDialog
        confirmLabel="Salvar"
        description={
          rename?.kind === "space"
            ? "O nome aparece no sidebar e no cabeçalho das páginas."
            : "O título aparece no sidebar, nos links e no cabeçalho da página."
        }
        initialValue={rename?.value ?? ""}
        label={rename?.label ?? "Nome"}
        onOpenChange={(open) => {
          if (!open) setRename(null);
        }}
        onSubmit={submitRename}
        open={rename !== null}
        placeholder={rename?.kind === "space" ? "Produto" : "Sem título"}
        title={rename?.kind === "space" ? "Renomear espaço" : "Renomear página"}
      />
      <GroupConfirmDialog
        confirmLabel={confirmDelete?.kind === "space" ? "Excluir espaço" : "Mover para a lixeira"}
        description={
          confirmDelete?.kind === "space"
            ? "Todas as páginas deste espaço serão removidas. Esta ação não pode ser desfeita."
            : "A página e as subpáginas vão para a lixeira e podem ser restauradas depois."
        }
        onConfirm={submitDelete}
        onOpenChange={(open) => {
          if (!open) setConfirmDelete(null);
        }}
        open={confirmDelete !== null}
        title={
          confirmDelete === null
            ? "Excluir?"
            : confirmDelete.kind === "space"
              ? `Excluir espaço ${confirmDelete.name}?`
              : `Mover ${confirmDelete.name} para a lixeira?`
        }
      />
    </div>
  );
}
