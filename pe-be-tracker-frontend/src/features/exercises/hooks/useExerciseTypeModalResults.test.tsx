import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getExerciseTypes, getMuscleGroups } from "@/features/exercises/api";
import { makeExerciseType, makeGuestExerciseType, makePaginatedExerciseTypes } from "@/test/fixtures";
import { useExerciseTypeModalResults } from "./useExerciseTypeModalResults";

vi.mock("@/features/exercises/api", () => ({
  getExerciseTypes: vi.fn(),
  getMuscleGroups: vi.fn(),
}));

type Options = Parameters<typeof useExerciseTypeModalResults>[0];
type Page = ReturnType<typeof makePaginatedExerciseTypes>;
const defaults: Options = {
  isOpen: true,
  isAuthenticated: true,
  deferredSearchTerm: "",
  selectedMuscleGroupId: "all",
  guestExerciseTypes: [],
};
const bench = makeExerciseType({ id: 1, name: "Bench Press", times_used: 10 });
const row = makeExerciseType({ id: 2, name: "Row", times_used: 10 });
function deferredPage() {
  let resolve!: (page: Page) => void;
  const promise = new Promise<Page>((done) => { resolve = done; });
  return { promise, resolve };
}

let client: QueryClient;
function setup(overrides: Partial<Options> = {}) {
  return renderHook(useExerciseTypeModalResults, {
    initialProps: { ...defaults, ...overrides },
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  vi.mocked(getMuscleGroups).mockResolvedValue([]);
  vi.mocked(getExerciseTypes).mockResolvedValue(makePaginatedExerciseTypes([bench]));
});
afterEach(() => client.clear());

describe("useExerciseTypeModalResults", () => {
  it("shows initial loading, retains browse results through filter changes, and reopens from cache", async () => {
    const initial = deferredPage();
    const filtered = deferredPage();
    vi.mocked(getExerciseTypes).mockImplementation((_order, _cursor, _limit, group) =>
      group === 10 ? filtered.promise : initial.promise,
    );
    const { result, rerender } = setup();
    expect(result.current.isInitialBrowseLoading).toBe(true);
    await act(async () => initial.resolve(makePaginatedExerciseTypes([bench])));
    await waitFor(() => expect(result.current.exerciseTypes).toEqual([bench]));
    rerender({ ...defaults, selectedMuscleGroupId: "10" });
    expect(result.current.isInitialBrowseLoading).toBe(false);
    expect(result.current.isResultsPlaceholderData).toBe(true);
    expect(result.current.exerciseTypes).toEqual([bench]);
    await act(async () => filtered.resolve(makePaginatedExerciseTypes([row])));
    await waitFor(() => expect(result.current.exerciseTypes).toEqual([row]));
    expect(result.current.isResultsPlaceholderData).toBe(false);
    rerender({ ...defaults, isOpen: false });
    rerender(defaults);
    expect(result.current.isInitialBrowseLoading).toBe(false);
    expect(result.current.exerciseTypes).toEqual([bench]);
  });

  it("retains settled search results while the next search loads and clears placeholder state on browse", async () => {
    const first = deferredPage();
    const next = deferredPage();
    vi.mocked(getExerciseTypes).mockImplementation((order, _cursor, _limit, _group, name) => {
      if (order === "usage") return Promise.resolve(makePaginatedExerciseTypes([row]));
      return name === "Bench" ? first.promise : next.promise;
    });
    const { result, rerender } = setup();
    await waitFor(() => expect(result.current.exerciseTypes).toEqual([row]));
    rerender({ ...defaults, deferredSearchTerm: "Bench" });
    expect(result.current.isSearchingWithoutResults).toBe(true);
    await act(async () => first.resolve(makePaginatedExerciseTypes([bench])));
    await waitFor(() => expect(result.current.isSearchLoading).toBe(false));
    rerender({ ...defaults, deferredSearchTerm: "Missing" });
    expect(result.current.exerciseTypes).toEqual([bench]);
    expect(result.current.isResultsPlaceholderData).toBe(true);
    expect(result.current.isSearchingWithoutResults).toBe(false);
    await act(async () => next.resolve(makePaginatedExerciseTypes([])));
    await waitFor(() => expect(result.current.exerciseTypes).toEqual([]));
    expect(result.current.isSearchLoading).toBe(false);
    rerender(defaults);
    expect(result.current.exerciseTypes).toEqual([row]);
    expect(result.current.isResultsPlaceholderData).toBe(false);
  });

  it("reports background activity without content loading for a settled empty search", async () => {
    vi.mocked(getExerciseTypes).mockResolvedValue(makePaginatedExerciseTypes([]));
    const { result } = setup({ deferredSearchTerm: "Missing" });
    await waitFor(() => expect(result.current.isSearchFetching).toBe(false));
    expect(result.current.isSearchLoading).toBe(false);

    const refetch = deferredPage();
    vi.mocked(getExerciseTypes).mockReturnValue(refetch.promise);
    act(() => {
      void client.invalidateQueries({ queryKey: ["exerciseTypes", "modal", "search"] });
    });
    await waitFor(() => expect(result.current.isSearchFetching).toBe(true));
    expect(result.current.isSearchLoading).toBe(false);
    expect(result.current.isSearchingWithoutResults).toBe(false);
    expect(result.current.exerciseTypes).toEqual([]);

    await act(async () => refetch.resolve(makePaginatedExerciseTypes([])));
    await waitFor(() => expect(result.current.isSearchFetching).toBe(false));
    expect(result.current.isSearchingWithoutResults).toBe(false);
  });

  it("uses the active query for pagination and preserves page sizes in optimistic usage updates", async () => {
    vi.mocked(getExerciseTypes).mockImplementation((order, cursor) => Promise.resolve(
      order === "name"
        ? makePaginatedExerciseTypes([bench])
        : makePaginatedExerciseTypes(cursor ? [row] : [bench], cursor ? null : 2),
    ));
    const { result, rerender } = setup();
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    await act(async () => { await result.current.fetchNextPage(); });
    await waitFor(() => expect(result.current.exerciseTypes).toEqual([bench, row]));
    act(() => result.current.recordAuthenticatedSelection(row));
    await waitFor(() => expect(result.current.exerciseTypes[0]).toEqual({ ...row, times_used: 11 }));
    const cache = client.getQueryData<{ pages: Page[] }>(["exerciseTypes", "modal", "usage", "all"]);
    expect(cache?.pages.map(page => page.data.length)).toEqual([1, 1]);
    rerender({ ...defaults, deferredSearchTerm: "Bench" });
    await waitFor(() => expect(result.current.exerciseTypes).toEqual([bench]));
    expect(result.current.hasNextPage).toBe(false);
  });

  it("filters guest data locally without fetching authenticated exercise queries", async () => {
    const guest = makeGuestExerciseType({ name: "Row", muscle_groups: ["Back"] });
    const { result, rerender } = setup({
      isAuthenticated: false, guestExerciseTypes: [guest], selectedMuscleGroupId: "Back",
      deferredSearchTerm: "row",
    });
    expect(result.current.filteredExerciseTypes).toEqual([guest]);
    expect(result.current.isResultsPlaceholderData).toBe(false);
    expect(result.current.isInitialBrowseLoading).toBe(false);
    rerender({ ...defaults, isAuthenticated: false, guestExerciseTypes: [guest], deferredSearchTerm: "missing" });
    expect(result.current.filteredExerciseTypes).toEqual([]);
    await waitFor(() => expect(getMuscleGroups).toHaveBeenCalled());
    expect(getExerciseTypes).not.toHaveBeenCalled();
  });
});
