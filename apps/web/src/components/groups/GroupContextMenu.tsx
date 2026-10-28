import { Fragment, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";

import { Menu, MenuItem, MenuPopup, MenuSeparator } from "../ui/menu";

export interface GroupContextMenuPoint {
  x: number;
  y: number;
}

export interface GroupContextMenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  variant?: "default" | "destructive";
  disabled?: boolean;
  separatorBefore?: boolean;
  onSelect: () => void;
}

export interface GroupContextMenuState<T> {
  point: GroupContextMenuPoint;
  target: T;
}

/**
 * Tracks a right-click target and the cursor position so a menu can be rendered
 * anchored at the pointer.
 */
export function useGroupContextMenu<T>() {
  const [state, setState] = useState<GroupContextMenuState<T> | null>(null);

  const openMenu = (event: ReactMouseEvent, target: T) => {
    event.preventDefault();
    event.stopPropagation();
    setState({ point: { x: event.clientX, y: event.clientY }, target });
  };

  const closeMenu = () => {
    setState(null);
  };

  return { state, openMenu, closeMenu };
}

export function GroupContextMenu({
  point,
  items,
  onClose,
}: {
  point: GroupContextMenuPoint | null;
  items: ReadonlyArray<GroupContextMenuItem>;
  onClose: () => void;
}) {
  const anchor =
    point === null
      ? null
      : {
          getBoundingClientRect: () => ({
            x: point.x,
            y: point.y,
            top: point.y,
            left: point.x,
            right: point.x,
            bottom: point.y,
            width: 0,
            height: 0,
          }),
        };

  return (
    <Menu
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      open={point !== null}
    >
      {point === null ? null : (
        <MenuPopup align="start" anchor={anchor} className="min-w-56" side="bottom" sideOffset={2}>
          {items.map((item) => (
            <Fragment key={item.id}>
              {item.separatorBefore ? <MenuSeparator /> : null}
              <MenuItem
                disabled={item.disabled ?? false}
                onClick={() => {
                  onClose();
                  item.onSelect();
                }}
                {...(item.variant === undefined ? {} : { variant: item.variant })}
              >
                {item.icon}
                {item.label}
              </MenuItem>
            </Fragment>
          ))}
        </MenuPopup>
      )}
    </Menu>
  );
}
