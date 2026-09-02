import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, Clipboard, KeyRound, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { usePersonalAccessTokens } from "@/features/mcp/hooks/usePersonalAccessTokens";
import type { PersonalAccessTokenSummary } from "@/features/mcp/types";
import {
  Alert,
  AlertDescription,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  AlertTitle,
  Badge,
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui";

const MCP_PATH = "/api/mcp/trainer/";

const formatDate = (value: string): string =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const getTokenStatus = (
  token: PersonalAccessTokenSummary,
): "active" | "expired" | "revoked" => {
  if (token.revoked_at) return "revoked";
  if (new Date(token.expires_at).getTime() <= Date.now()) return "expired";
  return "active";
};

const copyText = async (value: string, label: string) => {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied.`);
  } catch {
    toast.error(`Could not copy ${label.toLowerCase()}.`);
  }
};

const TokenRow = ({
  token,
  isRevoking,
  onRevoke,
}: {
  token: PersonalAccessTokenSummary;
  isRevoking: boolean;
  onRevoke: (id: number) => void;
}) => {
  const status = getTokenStatus(token);

  return (
    <li className="rounded-xl border border-border/50 bg-background/40 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-bold text-foreground">{token.name}</p>
            <Badge
              variant={status === "active" ? "secondary" : "outline"}
              className="capitalize"
            >
              {status}
            </Badge>
          </div>
          <code className="block truncate text-xs text-muted-foreground">
            pebe_pat_{token.token_prefix}_…
          </code>
          <div className="flex flex-wrap gap-1.5">
            {token.scopes.map((scope) => (
              <Badge key={scope} variant="outline">
                {scope === "trainer:read" ? "Read" : "Write"}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Expires <time dateTime={token.expires_at}>{formatDate(token.expires_at)}</time>
            {token.last_used_at ? (
              <>
                {" · Last used "}
                <time dateTime={token.last_used_at}>
                  {formatDate(token.last_used_at)}
                </time>
              </>
            ) : (
              " · Never used"
            )}
          </p>
        </div>

        {status === "active" ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isRevoking}
                className="shrink-0 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                Revoke
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Revoke “{token.name}”?</AlertDialogTitle>
                <AlertDialogDescription>
                  Any MCP client using this token will immediately lose access.
                  This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onRevoke(token.id)}
                  className="bg-destructive text-white hover:bg-destructive/90"
                >
                  Revoke token
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </div>
    </li>
  );
};

export const PersonalAccessTokensSettings = ({
  enabled,
}: {
  enabled: boolean;
}) => {
  const [name, setName] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("90");
  const [writeEnabled, setWriteEnabled] = useState(true);
  const {
    tokens,
    createdToken,
    dismissCreatedToken,
    createToken,
    revokeToken,
    isLoading,
    loadError,
    createError,
    revokeError,
    isCreating,
    revokingTokenId,
  } = usePersonalAccessTokens(enabled);

  const mcpEndpoint = useMemo(() => {
    if (typeof window === "undefined") return MCP_PATH;
    return new URL(MCP_PATH, window.location.origin).toString();
  }, []);

  useEffect(() => {
    if (createdToken) setName("");
  }, [createdToken]);

  if (!enabled) return null;

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    createToken({
      name: trimmedName,
      scopes: writeEnabled
        ? ["trainer:read", "trainer:write"]
        : ["trainer:read"],
      expires_in_days: Number(expiresInDays),
    });
  };

  return (
    <section className="mx-auto mt-10 max-w-2xl border-t border-border/50 pt-8 text-left">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-primary/10 p-2 text-primary">
          <KeyRound className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-black text-foreground">
            Personal Access Tokens / MCP
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect an MCP-compatible assistant to your PersonalBestie trainer.
            Tokens act like passwords, so only paste them into clients you trust.
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-border/50 bg-background/40 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              MCP server URL
            </p>
            <code className="mt-1 block truncate text-sm text-foreground">
              {mcpEndpoint}
            </code>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => copyText(mcpEndpoint, "Server URL")}
            aria-label="Copy MCP server URL"
          >
            <Clipboard className="h-4 w-4" />
            Copy
          </Button>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          Available tools: recent workout summary, workout by date, exercise
          performance, log workout, create routine, and generate workout recap.
          Configure your client for remote Streamable HTTP and authenticate with
          this token as a Bearer token.
        </p>
      </div>

      {createdToken ? (
        <Alert className="mt-5 border-primary/40 bg-primary/5">
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Copy this token now</AlertTitle>
          <AlertDescription>
            <p className="mb-3">
              For security, the full value is shown only once and cannot be
              recovered later.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                readOnly
                value={createdToken.token}
                aria-label="New personal access token"
                className="font-mono text-xs"
                onFocus={(event) => event.currentTarget.select()}
              />
              <Button
                type="button"
                onClick={() => copyText(createdToken.token, "Token")}
              >
                <Clipboard className="h-4 w-4" />
                Copy token
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={dismissCreatedToken}
              >
                Done
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      <form className="mt-6 space-y-4" onSubmit={handleCreate}>
        <div>
          <label htmlFor="pat-name" className="text-sm font-bold text-foreground">
            Token name
          </label>
          <Input
            id="pat-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Claude Desktop on MacBook"
            maxLength={100}
            required
            disabled={isCreating}
            className="mt-1.5"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-bold text-foreground" htmlFor="pat-expiry">
              Expiration
            </label>
            <Select value={expiresInDays} onValueChange={setExpiresInDays}>
              <SelectTrigger id="pat-expiry" className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
                <SelectItem value="180">180 days</SelectItem>
                <SelectItem value="365">1 year</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <fieldset>
            <legend className="text-sm font-bold text-foreground">Permissions</legend>
            <div className="mt-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm">
              <div className="flex items-center gap-3">
                <Check className="h-4 w-4 text-primary" />
                <span>
                  <span className="block font-semibold">Read workout data</span>
                  <span className="block text-xs text-muted-foreground">
                    Always included
                  </span>
                </span>
              </div>
            </div>
            <label className="mt-2 flex cursor-pointer items-center gap-3 rounded-md border border-input bg-background px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={writeEnabled}
                onChange={(event) => setWriteEnabled(event.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              <span>
                <span className="block font-semibold">Allow changes</span>
                <span className="block text-xs text-muted-foreground">
                  Log workouts, create routines, and generate recaps
                </span>
              </span>
            </label>
          </fieldset>
        </div>

        {createError ? (
          <p role="alert" className="text-sm font-semibold text-destructive">
            {createError}
          </p>
        ) : null}

        <Button type="submit" disabled={isCreating || !name.trim()}>
          {isCreating ? "Creating..." : "Create token"}
        </Button>
      </form>

      <div className="mt-8">
        <h4 className="text-sm font-black uppercase tracking-wider text-muted-foreground">
          Your tokens
        </h4>
        {isLoading ? (
          <p className="mt-3 text-sm text-muted-foreground">Loading tokens...</p>
        ) : loadError ? (
          <p role="alert" className="mt-3 text-sm font-semibold text-destructive">
            {loadError}
          </p>
        ) : tokens.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            No personal access tokens yet.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {tokens.map((token) => (
              <TokenRow
                key={token.id}
                token={token}
                isRevoking={revokingTokenId === token.id}
                onRevoke={revokeToken}
              />
            ))}
          </ul>
        )}
        {revokeError ? (
          <p role="alert" className="mt-3 text-sm font-semibold text-destructive">
            {revokeError}
          </p>
        ) : null}
      </div>
    </section>
  );
};
