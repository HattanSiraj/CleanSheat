import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const MENU_GAP = 4;
const MENU_MAX_HEIGHT = 260;

export function PixelSelectOverlay() {
  const [menu, setMenu] = useState(null);
  const menuRef = useRef(null);
  const menuStateRef = useRef(null);

  useEffect(() => {
    menuStateRef.current = menu;
  }, [menu]);

  useEffect(() => {
    function openSelect(select, direction = 0) {
      if (!select || select.disabled || select.multiple) return;
      const items = readSelectItems(select);
      const selectableIndexes = getSelectableIndexes(items);
      if (!selectableIndexes.length) return;
      const selectedIndex = items.findIndex((item) => item.type === "option" && item.selected && !item.disabled);
      const activeIndex = direction < 0
        ? selectableIndexes.at(-1)
        : direction > 0
          ? selectableIndexes[0]
          : selectedIndex >= 0
            ? selectedIndex
            : selectableIndexes[0];
      setMenu({
        select,
        items,
        activeIndex,
        position: getMenuPosition(select, items),
      });
    }

    function closeMenu({ restoreFocus = false } = {}) {
      const select = menuStateRef.current?.select;
      setMenu(null);
      if (restoreFocus && select?.isConnected) select.focus({ preventScroll: true });
    }

    function chooseItem(item) {
      const select = menuStateRef.current?.select;
      if (!select || item?.type !== "option" || item.disabled) return;
      if (select.value !== item.value) {
        const valueSetter = Object.getOwnPropertyDescriptor(
          HTMLSelectElement.prototype,
          "value",
        )?.set;
        valueSetter?.call(select, item.value);
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
      closeMenu({ restoreFocus: true });
    }

    function handlePointerDown(event) {
      if (event.target.closest?.(".pixel-select-menu")) return;
      const select = event.target.closest?.("select:not([multiple])");
      if (!select) {
        if (menuStateRef.current) closeMenu();
        return;
      }
      if (select.disabled) return;
      event.preventDefault();
      event.stopPropagation();
      select.focus({ preventScroll: true });
      if (menuStateRef.current?.select === select) closeMenu({ restoreFocus: true });
      else openSelect(select);
    }

    function handleClick(event) {
      const select = event.target.closest?.("select:not([multiple])");
      if (!select) return;
      event.preventDefault();
      event.stopPropagation();
    }

    function handleKeyDown(event) {
      const select = event.target.closest?.("select:not([multiple])");
      if (!select || select.disabled) return;
      const current = menuStateRef.current;
      if (!current || current.select !== select) {
        if (!["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) return;
        event.preventDefault();
        openSelect(
          select,
          event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0,
        );
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu({ restoreFocus: true });
        return;
      }
      if (event.key === "Tab") {
        closeMenu();
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        chooseItem(current.items[current.activeIndex]);
        return;
      }
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;

      event.preventDefault();
      setMenu((activeMenu) => {
        if (!activeMenu) return activeMenu;
        const selectableIndexes = getSelectableIndexes(activeMenu.items);
        const currentPosition = Math.max(0, selectableIndexes.indexOf(activeMenu.activeIndex));
        const nextPosition = event.key === "Home"
          ? 0
          : event.key === "End"
            ? selectableIndexes.length - 1
            : event.key === "ArrowDown"
              ? (currentPosition + 1) % selectableIndexes.length
              : (currentPosition - 1 + selectableIndexes.length) % selectableIndexes.length;
        return { ...activeMenu, activeIndex: selectableIndexes[nextPosition] };
      });
    }

    function updatePosition() {
      setMenu((activeMenu) => {
        if (!activeMenu) return activeMenu;
        if (!activeMenu.select.isConnected) return null;
        return {
          ...activeMenu,
          position: getMenuPosition(activeMenu.select, activeMenu.items),
        };
      });
    }

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("click", handleClick, true);
    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, []);

  useEffect(() => {
    if (!menuRef.current || !menu) return;
    menuRef.current
      .querySelector(`[data-option-index="${menu.activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [menu]);

  if (!menu) return null;

  return createPortal(
    <div
      ref={menuRef}
      className="pixel-select-menu"
      role="listbox"
      aria-label={menu.select.getAttribute("aria-label") || menu.select.name || "Choose an option"}
      style={{
        left: `${menu.position.left}px`,
        top: `${menu.position.top}px`,
        width: `${menu.position.width}px`,
        maxHeight: `${menu.position.maxHeight}px`,
      }}
    >
      {menu.items.map((item, index) => (
        item.type === "group" ? (
          <div className="pixel-select-group" key={`${item.label}:${index}`}>{item.label}</div>
        ) : (
          <button
            type="button"
            role="option"
            aria-selected={item.selected}
            className={`pixel-select-option ${item.selected ? "selected" : ""} ${menu.activeIndex === index ? "active" : ""}`}
            data-option-index={index}
            disabled={item.disabled}
            key={`${item.value}:${index}`}
            title={item.label}
            onPointerEnter={() => {
              if (item.disabled) return;
              setMenu((activeMenu) => (
                activeMenu ? { ...activeMenu, activeIndex: index } : activeMenu
              ));
            }}
            onClick={() => {
              if (item.disabled) return;
              const select = menu.select;
              if (select.value !== item.value) {
                const valueSetter = Object.getOwnPropertyDescriptor(
                  HTMLSelectElement.prototype,
                  "value",
                )?.set;
                valueSetter?.call(select, item.value);
                select.dispatchEvent(new Event("change", { bubbles: true }));
              }
              setMenu(null);
              select.focus({ preventScroll: true });
            }}
          >
            <span aria-hidden="true">{item.selected ? ">" : ""}</span>
            <strong>{item.label}</strong>
          </button>
        )
      ))}
    </div>,
    document.body,
  );
}

function readSelectItems(select) {
  const items = [];
  for (const child of select.children) {
    if (child instanceof HTMLOptGroupElement) {
      items.push({ type: "group", label: child.label });
      for (const option of child.children) {
        items.push(readOption(option, child.disabled));
      }
    } else if (child instanceof HTMLOptionElement) {
      items.push(readOption(child, false));
    }
  }
  return items;
}

function readOption(option, groupDisabled) {
  return {
    type: "option",
    value: option.value,
    label: option.label || option.textContent || option.value,
    selected: option.selected,
    disabled: groupDisabled || option.disabled,
  };
}

function getSelectableIndexes(items) {
  return items.reduce((indexes, item, index) => {
    if (item.type === "option" && !item.disabled) indexes.push(index);
    return indexes;
  }, []);
}

function getMenuPosition(select, items) {
  const rect = select.getBoundingClientRect();
  const viewportPadding = 8;
  const width = Math.min(
    Math.max(rect.width, 190),
    Math.max(190, window.innerWidth - viewportPadding * 2),
  );
  const estimatedHeight = Math.min(
    MENU_MAX_HEIGHT,
    items.reduce((height, item) => height + (item.type === "group" ? 27 : 37), 6),
  );
  const roomBelow = window.innerHeight - rect.bottom - viewportPadding;
  const roomAbove = rect.top - viewportPadding;
  const openAbove = roomBelow < estimatedHeight && roomAbove > roomBelow;
  const maxHeight = Math.max(90, Math.min(MENU_MAX_HEIGHT, openAbove ? roomAbove - MENU_GAP : roomBelow - MENU_GAP));
  const top = openAbove
    ? Math.max(viewportPadding, rect.top - Math.min(estimatedHeight, maxHeight) - MENU_GAP)
    : Math.min(window.innerHeight - viewportPadding - Math.min(estimatedHeight, maxHeight), rect.bottom + MENU_GAP);
  const left = Math.min(
    Math.max(viewportPadding, rect.left),
    Math.max(viewportPadding, window.innerWidth - width - viewportPadding),
  );
  return { left, top, width, maxHeight };
}
