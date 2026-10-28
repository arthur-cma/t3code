import { describe, expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";

import type { GroupPage } from "../../groups/types";
import { render } from "../../../test/render";
import { GroupPageCanvas } from "./GroupPageCanvas";

const PAGE: GroupPage = {
  id: "page_1",
  spaceId: "space_1",
  parentId: null,
  title: "Quadro",
  icon: "🧩",
  content: "",
  favorite: false,
  cover: "",
  tags: [],
  mode: "canvas",
  canvas: { nodes: [] },
  dailyKey: null,
  deletedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("GroupPageCanvas", () => {
  it("creates a sticky note on double click and saves its text", async () => {
    const onChange = vi.fn();
    await using screen = await render(<GroupPageCanvas onChange={onChange} page={PAGE} />);

    await userEvent.dblClick(screen.getByRole("application", { name: "Quadro da página" }));

    const note = screen.getByRole("textbox", { name: "Nota do quadro" });
    await expect.element(note).toBeVisible();
    await userEvent.type(note, "Ideia");
    await userEvent.keyboard("{Escape}");

    const saved = onChange.mock.lastCall?.[0] as { nodes: Array<{ text: string }> } | undefined;
    expect(saved?.nodes).toHaveLength(1);
    expect(saved?.nodes[0]?.text).toBe("Ideia");
  });

  it("adds shapes and zooms the board", async () => {
    const onChange = vi.fn();
    await using screen = await render(<GroupPageCanvas onChange={onChange} page={PAGE} />);

    await userEvent.click(screen.getByRole("button", { name: "Forma" }));

    const saved = onChange.mock.lastCall?.[0] as { nodes: Array<{ kind: string }> } | undefined;
    expect(saved?.nodes[0]?.kind).toBe("shape");

    await expect.element(screen.getByText("100%")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Aumentar zoom" }));
    await expect.element(screen.getByText("118%")).toBeVisible();
  });
});
