import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { render } from "@/test/testUtils";
import { usePersonalAccessTokens } from "@/features/mcp/hooks/usePersonalAccessTokens";
import { PersonalAccessTokensSettings } from "./PersonalAccessTokensSettings";

vi.mock("@/features/mcp/hooks/usePersonalAccessTokens", () => ({
  usePersonalAccessTokens: vi.fn(),
}));

const mockUsePersonalAccessTokens = vi.mocked(usePersonalAccessTokens);
const createToken = vi.fn();

const hookResult = {
  tokens: [],
  createdToken: null,
  dismissCreatedToken: vi.fn(),
  createToken,
  revokeToken: vi.fn(),
  isLoading: false,
  loadError: null,
  createError: null,
  revokeError: null,
  isCreating: false,
  revokingTokenId: null,
};

describe("PersonalAccessTokensSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePersonalAccessTokens.mockReturnValue(hookResult);
  });

  it("creates a 90-day read/write token by default", () => {
    render(<PersonalAccessTokensSettings enabled />);

    expect(screen.getByText("Personal Access Tokens / MCP")).toBeInTheDocument();
    expect(screen.getByText(/recent workout summary/)).toBeInTheDocument();
    expect(screen.getByText(/\/api\/mcp\/trainer\//)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Token name"), {
      target: { value: "Claude Desktop" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create token" }));

    expect(createToken).toHaveBeenCalledWith({
      name: "Claude Desktop",
      scopes: ["trainer:read", "trainer:write"],
      expires_in_days: 90,
    });
  });

  it("supports a read-only token", () => {
    render(<PersonalAccessTokensSettings enabled />);

    fireEvent.click(screen.getByRole("checkbox", { name: /Allow changes/ }));
    fireEvent.change(screen.getByLabelText("Token name"), {
      target: { value: "Read-only client" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create token" }));

    expect(createToken).toHaveBeenCalledWith({
      name: "Read-only client",
      scopes: ["trainer:read"],
      expires_in_days: 90,
    });
  });

  it("shows a newly created secret and the one-time warning", () => {
    mockUsePersonalAccessTokens.mockReturnValue({
      ...hookResult,
      createdToken: {
        id: 7,
        name: "Claude Desktop",
        token_prefix: "abc123def456",
        token: "pebe_pat_abc123def456_secret",
        scopes: ["trainer:read", "trainer:write"],
        expires_at: "2027-01-01T00:00:00Z",
        revoked_at: null,
        last_used_at: null,
        created_at: "2026-09-02T00:00:00Z",
      },
    });

    render(<PersonalAccessTokensSettings enabled />);

    expect(screen.getByText("Copy this token now")).toBeInTheDocument();
    expect(screen.getByLabelText("New personal access token")).toHaveValue(
      "pebe_pat_abc123def456_secret",
    );
  });
});
