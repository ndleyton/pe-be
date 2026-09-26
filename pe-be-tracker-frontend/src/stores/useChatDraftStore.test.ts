import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => ({
  getItem: vi.fn<() => Promise<string | null>>().mockResolvedValue(null),
  setItem: vi.fn().mockResolvedValue(undefined),
  removeItem: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("./indexedDBStorage", () => ({ createIndexedDBStorage: () => storage }));

import { useChatDraftStore } from "./useChatDraftStore";

describe("chat draft persistence", () => {
  beforeEach(async () => {
    storage.getItem.mockResolvedValue(null);
    await useChatDraftStore.persist.rehydrate();
    useChatDraftStore.setState({ texts: {}, attachments: {}, hydrated: true });
    vi.clearAllMocks();
  });

  it("persists text only and restores it from storage", async () => {
    useChatDraftStore.getState().setText("1:12", "Saved draft");
    useChatDraftStore.getState().setAttachments("1:12", [{
      localId: "image", file: new File(["image"], "form.png"), previewUrl: "blob:preview",
    }]);
    const saved = storage.setItem.mock.lastCall?.[1] as string;
    expect(JSON.parse(saved).state).toEqual({ texts: { "1:12": "Saved draft" } });
    useChatDraftStore.setState({ texts: {}, attachments: {} });
    storage.getItem.mockResolvedValue(saved);
    await useChatDraftStore.persist.rehydrate();
    expect(useChatDraftStore.getState().texts["1:12"]).toBe("Saved draft");
    expect(useChatDraftStore.getState().attachments).toEqual({});
  });

  it("does not overwrite edits made during asynchronous hydration", async () => {
    let resolveRead!: (value: string) => void;
    storage.getItem.mockReturnValue(new Promise((resolve) => { resolveRead = resolve; }));
    const hydration = useChatDraftStore.persist.rehydrate();
    useChatDraftStore.getState().setText("1:12", "New edit");
    resolveRead(JSON.stringify({ state: { texts: { "1:12": "Old edit", "1:new": "Other draft" } }, version: 0 }));
    await hydration;
    expect(useChatDraftStore.getState().texts).toEqual({ "1:12": "New edit", "1:new": "Other draft" });
  });
});
