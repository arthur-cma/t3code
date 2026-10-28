import { useState } from "react";
import { describe, expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";

import { act, render } from "../../../test/render";
import {
  GroupContextMenu,
  useGroupContextMenu,
  type GroupContextMenuItem,
} from "./GroupContextMenu";

function Harness({ onSelect }: { onSelect: () => void }) {
  const menu = useGroupContextMenu<string>();
  const [last, setLast] = useState("");
  const items: GroupContextMenuItem[] = [
    {
      id: "open",
      label: "Abrir canal",
      onSelect: () => {
        setLast("open");
        onSelect();
      },
    },
    {
      id: "delete",
      label: "Excluir canal",
      separatorBefore: true,
      variant: "destructive",
      onSelect: () => setLast("delete"),
    },
  ];

  return (
    <div>
      <button onContextMenu={(event) => menu.openMenu(event, "geral")} type="button">
        Canal geral
      </button>
      <p data-testid="last">{last}</p>
      <GroupContextMenu
        items={menu.state === null ? [] : items}
        onClose={menu.closeMenu}
        point={menu.state?.point ?? null}
      />
    </div>
  );
}

describe("GroupContextMenu", () => {
  it("opens at the pointer and runs the chosen action", async () => {
    const onSelect = vi.fn();
    await using screen = await render(<Harness onSelect={onSelect} />);

    await act(async () => {
      page
        .getByRole("button", { name: "Canal geral" })
        .element()
        .dispatchEvent(
          new MouseEvent("contextmenu", {
            bubbles: true,
            cancelable: true,
            clientX: 12,
            clientY: 16,
          }),
        );
    });

    await expect.element(page.getByRole("menuitem", { name: "Abrir canal" })).toBeVisible();
    await userEvent.click(page.getByRole("menuitem", { name: "Abrir canal" }));

    await expect.element(screen.getByTestId("last")).toHaveTextContent("open");
    expect(onSelect).toHaveBeenCalledOnce();
  });
});
