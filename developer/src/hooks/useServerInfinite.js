/**
 * useServerInfinite — infinite scroll for server-paginated lists (Super Admin console + Developer Panel).
 * Same idea and UI as the Admin Panel's useInfiniteScroll (sentinel + <InfiniteScrollLoader/> + overlay), but the rows come
 * from the API one page at a time: when the sentinel at the end of the table scrolls into view the next page is fetched
 * and appended. Changing `key` (the filters / sort / search) starts again from page 1.
 *
 *   const list = useServerInfinite((page, limit) => api.list({ ...filters, page, limit }), filtersKey, { pageSize: 25, pollMs: 30000 });
 *   list.rows / list.total / list.loaded / list.busy / list.loadingMore / list.hasMore / list.error
 *   list.sentinelRef  -> <InfiniteScrollLoader sentinelRef={list.sentinelRef} hasMore={list.hasMore} colSpan={n} />
 *   list.refresh()    -> reload from page 1 (e.g. after creating a record)
 * `fetchPage` must resolve to { rows, total }.
 *
 * SORTING: keep the sort OUT of `key` and pass it as `sort: { id, compare }` instead (id = e.g. "createdAt:desc",
 * compare = a row comparator; see makeSorter). Changing the sort then
 *   - re-orders the rows already on screen instantly when the whole list is loaded (same feel as the Categories /
 *     Dishes pages: no loader, no delay), or
 *   - otherwise re-fetches silently while the current rows stay visible (no loader overlay, no blank table).
 * Changing `key` (filters / search) still shows the normal loader.
 */
import { useCallback, useEffect, useRef, useState } from "react";

/** Row comparator for a column: getValue(row) -> string | number | null. Strings compare case-insensitively, empty values sort first (like the API). */
export function makeSorter(getValue, dir = "asc") {
  const m = dir === "desc" ? -1 : 1;
  const norm = (v) => (v === null || v === undefined ? "" : typeof v === "string" ? v.toLowerCase() : v);
  return (a, b) => {
    const x = norm(getValue(a));
    const y = norm(getValue(b));
    return (x < y ? -1 : x > y ? 1 : 0) * m;
  };
}

export default function useServerInfinite(fetchPage, key, { pageSize = 25, pollMs = 0, sort = null } = {}) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loaded, setLoaded] = useState(false); // the first page has arrived at least once
  const [busy, setBusy] = useState(false); // (re)loading from page 1 — filters changed / first load
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const pageRef = useRef(1);
  const seq = useRef(0);
  const moreRef = useRef(false);
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;
  const sentinelRef = useRef(null);
  const containerRef = useRef(null);

  // Load pages 1..upTo and replace the list (upTo > 1 = a silent background refresh that keeps what was scrolled in).
  const reload = useCallback(async (upTo = 1, silent = false) => {
    const mine = ++seq.current;
    if (upTo === 1 && !silent) setBusy(true);
    try {
      let all = [];
      let t = 0;
      let p = 1;
      for (; p <= upTo; p += 1) {
        const r = await fetchRef.current(p, pageSize);
        if (mine !== seq.current) return;
        all = all.concat(r.rows || []);
        t = r.total || 0;
        if (all.length >= t) break;
      }
      pageRef.current = Math.min(p, upTo);
      setRows(all); setTotal(t); setError(""); setLoaded(true);
    } catch (e) {
      if (mine === seq.current) setError(e.message || "Could not load the list.");
    } finally {
      if (mine === seq.current) setBusy(false);
    }
  }, [pageSize]);

  useEffect(() => { reload(1); }, [key, reload]);

  // Sort changes: no loader. Whole list on screen -> re-order it in place; otherwise re-fetch silently.
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const totalRef = useRef(total);
  totalRef.current = total;
  const sortRef = useRef(sort);
  sortRef.current = sort;
  const sortId = sort ? sort.id : "";
  const lastSortId = useRef(sortId);
  useEffect(() => {
    if (lastSortId.current === sortId) return;
    lastSortId.current = sortId;
    if (!sortRef.current) return;
    if (rowsRef.current.length > 0 && rowsRef.current.length >= totalRef.current) {
      seq.current += 1; // drop any in-flight page load that would overwrite this order
      setBusy(false);
      setRows((prev) => [...prev].sort(sortRef.current.compare));
    } else {
      reload(1, true);
    }
  }, [sortId, reload]);

  useEffect(() => {
    if (!pollMs) return undefined;
    const t = setInterval(() => { if (!moreRef.current) reload(pageRef.current); }, pollMs);
    return () => clearInterval(t);
  }, [pollMs, reload]);

  const loadMore = useCallback(async () => {
    if (moreRef.current) return;
    moreRef.current = true; setLoadingMore(true);
    const mine = seq.current;
    try {
      const next = pageRef.current + 1;
      const r = await fetchRef.current(next, pageSize);
      if (mine !== seq.current) return;
      pageRef.current = next;
      setRows((prev) => prev.concat(r.rows || [])); setTotal(r.total || 0);
    } catch (e) {
      if (mine === seq.current) setError(e.message || "Could not load more.");
    } finally { moreRef.current = false; setLoadingMore(false); }
  }, [pageSize]);

  const refresh = useCallback(() => reload(1), [reload]);
  const hasMore = rows.length < total;
  // (Re)observe the sentinel whenever the list changes, so a list shorter than the screen keeps loading too.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || busy || loadingMore) return undefined;
    const io = new IntersectionObserver((entries) => { if (entries[0].isIntersecting) loadMore(); }, { rootMargin: "150px", threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, [rows.length, hasMore, busy, loadingMore, loadMore]);

  return { rows, total, loaded, busy, loadingMore, hasMore, error, sentinelRef, containerRef, refresh };
}
