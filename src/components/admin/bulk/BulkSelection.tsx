"use client";

import { createContext, useContext, useCallback, useRef, useState } from "react";
import type { ReactNode } from "react";

/* ============================================================
 * BulkSelectionContext — manages row-level selection across
 * table/list pages without requiring URL state for every toggle.
 * ============================================================ */

type ActionState = {
  loading: boolean;
  message: string | null;
  kind: "success" | "error" | "partial" | null;
  runningAction: string | null;
};

type ActionResult = {
  ok: boolean;
  message: string;
  partial?: boolean;
};

type BulkSelectionCtx = {
  selected: Set<string>;
  allOnPage: Set<string>;
  pageTotal: number;
  isSelected: (id: string) => boolean;
  isAllOnPageSelected: boolean;
  isSomeOnPageSelected: boolean;
  toggle: (id: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  setPage: (ids: string[], total: number) => void;
  selectAllFiltered: (ids: string[]) => void;
  clearAndRefresh: () => void;
  actionState: ActionState;
  runningAction: string | null;
  runAction: (label: string, fn: () => Promise<ActionResult>) => Promise<void>;
  resetAction: () => void;
};

const BulkSelectionContext = createContext<BulkSelectionCtx | null>(null);

export function BulkSelectionProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allOnPage, setAllOnPage] = useState<Set<string>>(new Set());
  const [pageTotal, setPageTotal] = useState(0);
  const [actionState, setActionState] = useState<ActionState>({
    loading: false,
    message: null,
    kind: null,
    runningAction: null,
  });
  const actionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearActionTimeout = () => {
    if (actionTimeoutRef.current) {
      clearTimeout(actionTimeoutRef.current);
      actionTimeoutRef.current = null;
    }
  };

  const runAction = useCallback(async (label: string, fn: () => Promise<ActionResult>) => {
    clearActionTimeout();
    setActionState({ loading: true, message: null, kind: null, runningAction: label });
    let result: ActionResult;
    try {
      result = await Promise.race([
        fn(),
        new Promise<ActionResult>((_, reject) =>
          setTimeout(() => reject(new Error("Request timed out after 30 seconds. Please try again.")), 30_000)
        ),
      ]);
    } catch (err) {
      result = { ok: false, message: err instanceof Error ? err.message : "Action failed. Please try again." };
    }
    setActionState({
      loading: false,
      message: result.message,
      kind: result.partial ? "partial" : result.ok ? "success" : "error",
      runningAction: null,
    });
    actionTimeoutRef.current = setTimeout(() => {
      setActionState({ loading: false, message: null, kind: null, runningAction: null });
    }, 5_000);
    if (result.ok || result.partial) {
      setSelected(new Set());
    }
  }, []);

  const resetAction = useCallback(() => {
    clearActionTimeout();
    setActionState({ loading: false, message: null, kind: null, runningAction: null });
  }, []);

  const isAllOnPageSelected =
    allOnPage.size > 0 && allOnPage.size === [...selected].filter((id) => allOnPage.has(id)).length;
  const isSomeOnPageSelected =
    [...selected].some((id) => allOnPage.has(id)) && !isAllOnPageSelected;

  // Every function handed out via context is memoized with a stable identity.
  // Consumers (BrandsList, UsersTable, etc.) call setPage from a useEffect
  // keyed on it — an inline closure recreated every render would give that
  // effect a new dependency every render, re-firing it, re-triggering the
  // setState inside, re-rendering the provider, and looping forever
  // ("Maximum update depth exceeded"). isSelected also must not be recreated
  // per render: it's called from JSX during the row map, not from an effect,
  // but keeping it referentially stable avoids needlessly invalidating any
  // memoized row component that takes it as a prop.
  const isSelected = useCallback((id: string) => selected.has(id), [selected]);
  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const selectAll = useCallback(() => {
    setSelected((prev) => new Set([...prev, ...allOnPage]));
  }, [allOnPage]);
  const deselectAll = useCallback(() => setSelected(new Set()), []);
  const setPage = useCallback((ids: string[], total: number) => {
    const keep = new Set(ids);
    setSelected((prev) => new Set([...prev].filter((id) => keep.has(id))));
    setAllOnPage(new Set(ids));
    setPageTotal(total);
  }, []);
  const selectAllFiltered = useCallback((ids: string[]) => setSelected(new Set(ids)), []);
  const clearAndRefresh = useCallback(() => setSelected(new Set()), []);

  const ctx: BulkSelectionCtx = {
    selected,
    allOnPage,
    pageTotal,
    isSelected,
    isAllOnPageSelected,
    isSomeOnPageSelected,
    toggle,
    selectAll,
    deselectAll,
    setPage,
    selectAllFiltered,
    clearAndRefresh,
    actionState,
    runningAction: actionState.runningAction,
    runAction,
    resetAction,
  };

  return <BulkSelectionContext.Provider value={ctx}>{children}</BulkSelectionContext.Provider>;
}

export function useBulkSelection(): BulkSelectionCtx {
  const ctx = useContext(BulkSelectionContext);
  if (!ctx) throw new Error("useBulkSelection must be used inside <BulkSelectionProvider>");
  return ctx;
}
