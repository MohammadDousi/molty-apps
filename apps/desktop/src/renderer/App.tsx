import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { LeaderboardResponse, PublicConfig, LeaderboardEntry } from "@molty/shared";
import { formatDelta, formatDuration } from "@molty/shared";

const initialFormState = { username: "", apiKey: "" };

const App = () => {
  const [apiBase, setApiBase] = useState<string | null>(null);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [stats, setStats] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onboarding, setOnboarding] = useState(initialFormState);
  const [friendInput, setFriendInput] = useState("");

  const isConfigured = Boolean(config?.username && config?.hasApiKey);

  const request = useCallback(
    async <T,>(path: string, options?: RequestInit): Promise<T> => {
      if (!apiBase) {
        throw new Error("Server not ready");
      }

      const response = await fetch(`${apiBase}${path}`, {
        ...options,
        headers: {
          "content-type": "application/json",
          ...(options?.headers || {})
        }
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message = payload?.error || `Request failed (${response.status})`;
        throw new Error(message);
      }

      return response.json() as Promise<T>;
    },
    [apiBase]
  );

  const loadConfig = useCallback(async () => {
    try {
      const payload = await request<PublicConfig>("/config");
      setConfig(payload);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load config");
    }
  }, [request]);

  const loadStats = useCallback(async () => {
    if (!isConfigured) return;
    setLoading(true);
    try {
      const payload = await request<LeaderboardResponse>("/stats/today");
      setStats(payload);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load stats");
    } finally {
      setLoading(false);
    }
  }, [isConfigured, request]);

  useEffect(() => {
    window.molty
      .getApiBase()
      .then((base) => setApiBase(base))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to connect"));
  }, []);

  useEffect(() => {
    if (!apiBase) return;
    loadConfig();
  }, [apiBase, loadConfig]);

  useEffect(() => {
    if (!isConfigured) return;
    loadStats();
  }, [isConfigured, loadStats]);

  const handleOnboardingSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const payload = await request<PublicConfig>("/config", {
        method: "POST",
        body: JSON.stringify(onboarding)
      });
      setConfig(payload);
      setOnboarding(initialFormState);
      setError(null);
      await loadStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save config");
    } finally {
      setLoading(false);
    }
  };

  const handleAddFriend = async (event: FormEvent) => {
    event.preventDefault();
    if (!friendInput.trim()) return;

    setLoading(true);
    try {
      const payload = await request<PublicConfig>("/friends", {
        method: "POST",
        body: JSON.stringify({ username: friendInput.trim() })
      });
      setConfig(payload);
      setFriendInput("");
      setError(null);
      await loadStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add friend");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFriend = async (username: string) => {
    setLoading(true);
    try {
      const payload = await request<PublicConfig>(`/friends/${encodeURIComponent(username)}`, {
        method: "DELETE"
      });
      setConfig(payload);
      setError(null);
      await loadStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove friend");
    } finally {
      setLoading(false);
    }
  };

  const lastUpdated = useMemo(() => {
    if (!stats?.updatedAt) return "";
    const date = new Date(stats.updatedAt);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }, [stats?.updatedAt]);

  return (
    <div className="app">
      <header className="header">
        <div>
          <p className="eyebrow">Molty</p>
          <h1>WakaTime Bar</h1>
        </div>
        {isConfigured && (
          <button className="ghost" onClick={loadStats} disabled={loading}>
            Refresh
          </button>
        )}
      </header>

      {error && <div className="error">{error}</div>}

      {!isConfigured ? (
        <section className="card">
          <h2>Get started</h2>
          <p className="muted">
            Add your WakaTime username and API key. Everything stays local on this Mac.
          </p>
          <form className="stack" onSubmit={handleOnboardingSubmit}>
            <label>
              Username
              <input
                type="text"
                value={onboarding.username}
                onChange={(event) =>
                  setOnboarding((prev) => ({ ...prev, username: event.target.value }))
                }
                placeholder="your-wakatime-username"
                required
              />
            </label>
            <label>
              WakaTime API key
              <input
                type="password"
                value={onboarding.apiKey}
                onChange={(event) =>
                  setOnboarding((prev) => ({ ...prev, apiKey: event.target.value }))
                }
                placeholder="api_key"
                required
              />
            </label>
            <button className="primary" type="submit" disabled={loading}>
              Save
            </button>
          </form>
        </section>
      ) : (
        <>
          <section className="card">
            <div className="section-header">
              <h2>Today</h2>
              {lastUpdated && <span className="muted">Updated {lastUpdated}</span>}
            </div>
            {stats ? (
              <div className="list">
                {stats.entries.map((entry) => (
                  <LeaderboardRow
                    key={entry.username}
                    entry={entry}
                    isSelf={entry.username === config?.username}
                    onRemove={handleRemoveFriend}
                  />
                ))}
              </div>
            ) : (
              <p className="muted">No stats yet.</p>
            )}
          </section>

          <section className="card">
            <h2>Add a friend</h2>
            <form className="row" onSubmit={handleAddFriend}>
              <input
                type="text"
                value={friendInput}
                onChange={(event) => setFriendInput(event.target.value)}
                placeholder="friend username"
              />
              <button className="primary" type="submit" disabled={loading}>
                Add
              </button>
            </form>
          </section>
        </>
      )}
    </div>
  );
};

const statusLabel = (entry: LeaderboardEntry): string => {
  if (entry.status === "ok") {
    return formatDuration(entry.totalSeconds);
  }
  if (entry.status === "private") {
    return "Private";
  }
  if (entry.status === "not_found") {
    return "Not found";
  }
  return "Error";
};

const LeaderboardRow = ({
  entry,
  isSelf,
  onRemove
}: {
  entry: LeaderboardEntry;
  isSelf: boolean;
  onRemove: (username: string) => void;
}) => {
  return (
    <div className={`row-item ${isSelf ? "self" : ""}`}>
      <div className="avatar">
        {entry.username.slice(0, 1).toUpperCase()}
      </div>
      <div className="row-content">
        <div className="row-title">
          <span>{entry.username}</span>
          {isSelf && <span className="badge">You</span>}
        </div>
        <div className="row-sub">
          <span className="muted">{entry.rank ? `#${entry.rank}` : "—"}</span>
          <span className="delta">
            {entry.status === "ok" ? formatDelta(entry.deltaSeconds) : "—"}
          </span>
        </div>
      </div>
      <div className="row-meta">
        <span className="time">{statusLabel(entry)}</span>
        {!isSelf && (
          <button className="ghost tiny" onClick={() => onRemove(entry.username)}>
            Remove
          </button>
        )}
      </div>
    </div>
  );
};

export default App;
