import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
  type FormEvent,
} from "react";
import type {
  LeaderboardResponse,
  PublicConfig,
  LeaderboardEntry,
  WeeklyLeaderboardResponse,
  WeeklyLeaderboardEntry,
} from "@molty/shared";
import { formatDuration } from "@molty/shared";

const initialOnboardingState = { wakawarsUsername: "", apiKey: "" };
const initialLoginState = { username: "", password: "" };
const initialPasswordState = { password: "", confirm: "" };

type SessionState = {
  authenticated: boolean;
  passwordSet: boolean;
  wakawarsUsername?: string;
  hasUser: boolean;
};

type AddFriendCardProps = {
  docked?: boolean;
  dismissible?: boolean;
  onDismiss?: () => void;
  friendInput: string;
  onFriendInputChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  loading: boolean;
  errorMessage?: string | null;
};

const AddFriendCard = ({
  docked,
  dismissible,
  onDismiss,
  friendInput,
  onFriendInputChange,
  onSubmit,
  loading,
  errorMessage,
}: AddFriendCardProps) => (
  <section className={`card ${docked ? "add-friend-dock" : ""}`}>
    <div className="section-header">
      <h2>Add a friend</h2>
      {dismissible && (
        <button
          type="button"
          className="icon-button small dismiss-button"
          onClick={onDismiss}
          aria-label="Dismiss"
        >
          x
        </button>
      )}
    </div>
    <form className="row add-friend-row" onSubmit={onSubmit}>
      <input
        type="text"
        value={friendInput}
        onChange={(event) => onFriendInputChange(event.target.value)}
        placeholder="username"
        disabled={loading}
      />
      <button className="primary" type="submit" disabled={loading}>
        Add
      </button>
    </form>
    {errorMessage && <p className="form-error">{errorMessage}</p>}
  </section>
);

const App = () => {
  const [apiBase, setApiBase] = useState<string | null>(null);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [stats, setStats] = useState<LeaderboardResponse | null>(null);
  const [weeklyStats, setWeeklyStats] =
    useState<WeeklyLeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(() =>
    localStorage.getItem("wakawarsSession")
  );
  const [session, setSession] = useState<SessionState | null>(null);
  const [onboarding, setOnboarding] = useState(initialOnboardingState);
  const [login, setLogin] = useState(initialLoginState);
  const [passwordForm, setPasswordForm] = useState(initialPasswordState);
  const [friendInput, setFriendInput] = useState("");
  const [addFriendError, setAddFriendError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"league" | "settings">("league");
  const [activeLeagueTab, setActiveLeagueTab] = useState<
    "today" | "weekly"
  >("today");
  const [authView, setAuthView] = useState<"welcome" | "signin" | "signup">(
    "welcome"
  );
  const authViewInitialized = useRef(false);
  const [showDockedAddFriend, setShowDockedAddFriend] = useState(true);
  const [launchAtLogin, setLaunchAtLogin] = useState<boolean | null>(null);
  const [launchAtLoginStatus, setLaunchAtLoginStatus] = useState<string | null>(
    null
  );
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const stored = localStorage.getItem("wakawarsTheme");
    if (stored === "light" || stored === "dark") return stored;
    if (window.matchMedia?.("(prefers-color-scheme: light)").matches) {
      return "light";
    }
    return "dark";
  });

  const isAuthenticated = Boolean(session?.authenticated);
  const isConfigured = Boolean(config?.wakawarsUsername && config?.hasApiKey);
  const shouldIncludeWeekly =
    activeLeagueTab === "weekly" || Boolean(weeklyStats);

  const request = useCallback(
    async <T,>(path: string, options?: RequestInit): Promise<T> => {
      if (!apiBase) {
        throw new Error("Network error. Please try again.");
      }

      try {
        const response = await fetch(`${apiBase}${path}`, {
          ...options,
          headers: {
            "content-type": "application/json",
            ...(sessionId ? { "x-wakawars-session": sessionId } : {}),
            ...(options?.headers || {}),
          },
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          const message =
            payload?.error || `Request failed (${response.status})`;
          throw new Error(message);
        }

        return response.json() as Promise<T>;
      } catch (error) {
        if (error instanceof TypeError) {
          throw new Error("Network error. Please try again.");
        }
        throw error;
      }
    },
    [apiBase, sessionId]
  );

  const loadSession = useCallback(async () => {
    try {
      const payload = await request<SessionState>("/session");
      setSession(payload);
      if (!payload.authenticated) {
        setSessionId(null);
        localStorage.removeItem("wakawarsSession");
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load session");
    }
  }, [request]);

  const loadConfig = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const payload = await request<PublicConfig>("/config");
      setConfig(payload);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load config");
    }
  }, [isAuthenticated, request]);

  const loadStats = useCallback(
    async ({
      silent = false,
      includeWeekly = false,
    }: {
      silent?: boolean;
      includeWeekly?: boolean;
    } = {}) => {
      if (!isConfigured || !isAuthenticated) return;
      if (!silent) {
        setLoading(true);
      }
      try {
        const tasks: Array<
          Promise<LeaderboardResponse | WeeklyLeaderboardResponse>
        > = [request<LeaderboardResponse>("/stats/today")];

        if (includeWeekly) {
          tasks.push(request<WeeklyLeaderboardResponse>("/stats/weekly"));
        }

        const results = await Promise.allSettled(tasks);
        let nextError: string | null = null;

        const dailyResult = results[0];
        if (dailyResult.status === "fulfilled") {
          setStats(dailyResult.value as LeaderboardResponse);
        } else {
          nextError =
            dailyResult.reason instanceof Error
              ? dailyResult.reason.message
              : "Failed to load stats";
        }

        if (includeWeekly) {
          const weeklyResult = results[1];
          if (weeklyResult?.status === "fulfilled") {
            setWeeklyStats(weeklyResult.value as WeeklyLeaderboardResponse);
          } else if (weeklyResult?.status === "rejected") {
            if (activeLeagueTab === "weekly") {
              nextError =
                weeklyResult.reason instanceof Error
                  ? weeklyResult.reason.message
                  : "Failed to load weekly stats";
            }
          }
        }

        setError(nextError);
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [isConfigured, isAuthenticated, request, activeLeagueTab]
  );

  useEffect(() => {
    const envBase = import.meta.env.VITE_API_BASE as string | undefined;
    if (envBase) {
      setApiBase(envBase);
      return;
    }

    if (window.molty?.getApiBase) {
      window.molty
        .getApiBase()
        .then((base) => setApiBase(base))
        .catch((err) =>
          setError(err instanceof Error ? err.message : "Network error")
        );
      return;
    }

    const defaultBase = import.meta.env.DEV
      ? "http://localhost:3000/wakawars/v0"
      : "https://core.molty.cool/wakawars/v0";
    setApiBase(defaultBase);
  }, []);

  useEffect(() => {
    if (!window.molty?.getLoginItemSettings) return;
    window.molty
      .getLoginItemSettings()
      .then((settings) => {
        setLaunchAtLogin(settings.openAtLogin);
        setLaunchAtLoginStatus(settings.status ?? null);
      })
      .catch(() => {
        setLaunchAtLogin(null);
        setLaunchAtLoginStatus(null);
      });
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("wakawarsTheme", theme);
  }, [theme]);

  useEffect(() => {
    if (!apiBase) return;
    loadSession();
  }, [apiBase, loadSession]);

  useEffect(() => {
    if (!session) return;
    if (session.authenticated) {
      loadConfig();
    }
  }, [session, loadConfig]);

  useEffect(() => {
    if (!isConfigured || !isAuthenticated) return;
    loadStats({ includeWeekly: shouldIncludeWeekly });
  }, [isConfigured, isAuthenticated, shouldIncludeWeekly, loadStats]);

  useEffect(() => {
    if (!isConfigured || !isAuthenticated) return;
    const intervalId = window.setInterval(() => {
      loadStats({ silent: true, includeWeekly: shouldIncludeWeekly });
    }, 15 * 60 * 1000);

    return () => window.clearInterval(intervalId);
  }, [isConfigured, isAuthenticated, shouldIncludeWeekly, loadStats]);

  useEffect(() => {
    if (session?.wakawarsUsername && !login.username) {
      setLogin((prev) => ({
        ...prev,
        username: session.wakawarsUsername ?? prev.username,
      }));
    }
  }, [session?.wakawarsUsername, login.username]);

  useEffect(() => {
    if (!session || authViewInitialized.current) return;
    if (session.hasUser && !session.authenticated) {
      setAuthView("signin");
    } else {
      setAuthView("welcome");
    }
    authViewInitialized.current = true;
  }, [session]);

  const handleOnboardingSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const payload = await request<{
        sessionId?: string;
        config: PublicConfig;
      }>("/config", {
        method: "POST",
        body: JSON.stringify(onboarding),
      });
      setConfig(payload.config);
      if (payload.sessionId) {
        setSessionId(payload.sessionId);
        localStorage.setItem("wakawarsSession", payload.sessionId);
        setSession({
          authenticated: true,
          passwordSet: false,
          wakawarsUsername: payload.config.wakawarsUsername,
          hasUser: true,
        });
      }
      setOnboarding(initialOnboardingState);
      setError(null);
      await loadStats({ silent: true, includeWeekly: shouldIncludeWeekly });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save config");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const payload = await request<{
        sessionId: string;
        wakawarsUsername: string;
        passwordSet: boolean;
      }>("/session/login", {
        method: "POST",
        body: JSON.stringify({
          username: login.username,
          password: login.password,
        }),
      });
      setSessionId(payload.sessionId);
      localStorage.setItem("wakawarsSession", payload.sessionId);
      setSession({
        authenticated: true,
        passwordSet: payload.passwordSet,
        wakawarsUsername: payload.wakawarsUsername,
        hasUser: true,
      });
      setLogin(initialLoginState);
      setError(null);
      await loadConfig();
      await loadStats({ silent: true, includeWeekly: shouldIncludeWeekly });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to login");
    } finally {
      setLoading(false);
    }
  };

  const handleSetPassword = async (event: FormEvent) => {
    event.preventDefault();
    if (passwordForm.password !== passwordForm.confirm) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      await request<{ passwordSet: boolean }>("/password", {
        method: "POST",
        body: JSON.stringify({ password: passwordForm.password }),
      });
      setSession((prev) =>
        prev
          ? {
              ...prev,
              authenticated: true,
              passwordSet: true,
              hasUser: true,
            }
          : prev
      );

      setPasswordForm(initialPasswordState);
      await loadConfig();
      await loadStats({ silent: true, includeWeekly: shouldIncludeWeekly });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set password");
    } finally {
      setLoading(false);
    }
  };

  const handleAddFriend = async (event: FormEvent) => {
    event.preventDefault();
    if (!friendInput.trim()) return;

    setLoading(true);
    setAddFriendError(null);
    try {
      const payload = await request<PublicConfig>("/friends", {
        method: "POST",
        body: JSON.stringify({
          username: friendInput.trim(),
        }),
      });
      setConfig(payload);
      setFriendInput("");
      setError(null);
      setAddFriendError(null);
      await loadStats({ silent: true, includeWeekly: shouldIncludeWeekly });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to add friend";
      if (message === "Friend not found") {
        setAddFriendError(message);
        setError(null);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLaunchToggle = async (nextValue: boolean) => {
    const previousValue = launchAtLogin;
    setLaunchAtLogin(nextValue);
    if (!window.molty?.setLoginItemSettings) {
      return;
    }

    try {
      const settings = await window.molty.setLoginItemSettings(nextValue);
      setLaunchAtLogin(settings.openAtLogin);
      setLaunchAtLoginStatus(settings.status ?? null);
    } catch {
      setLaunchAtLogin(previousValue);
      setLaunchAtLoginStatus(null);
      setError("Unable to update settings.");
    }
  };

  const handleCheckUpdates = async () => {
    if (!window.molty?.checkForUpdates) {
      setUpdateStatus("Updates are available in the macOS app.");
      return;
    }

    setCheckingUpdates(true);
    try {
      const result = await window.molty.checkForUpdates();
      if (result.status === "disabled") {
        setUpdateStatus("Updates are checked in production builds.");
      } else if (result.status === "error") {
        setUpdateStatus("Unable to check updates right now.");
      } else {
        setUpdateStatus("Checking for updates...");
      }
    } catch {
      setUpdateStatus("Unable to check updates right now.");
    } finally {
      setCheckingUpdates(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    loadSession();
    loadConfig();
    loadStats({ silent: true, includeWeekly: shouldIncludeWeekly });
  };

  const lastUpdated = useMemo(() => {
    const updatedAt =
      activeLeagueTab === "weekly" ? weeklyStats?.updatedAt : stats?.updatedAt;
    if (!updatedAt) return "";
    const date = new Date(updatedAt);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }, [activeLeagueTab, stats?.updatedAt, weeklyStats?.updatedAt]);

  const hasStoredSession = Boolean(sessionId);
  const showMainLoading =
    hasStoredSession && (!session || (session.authenticated && !config));

  const weeklyRangeLabel = useMemo(() => {
    if (!weeklyStats?.range) return "Last 7 days";
    if (weeklyStats.range === "last_7_days") return "Last 7 days";
    if (weeklyStats.range === "this_week") return "This week";
    return weeklyStats.range.replace(/_/g, " ");
  }, [weeklyStats?.range]);

  const showLogin = Boolean(session?.hasUser && !session?.authenticated);
  const showAuth = !isAuthenticated;
  const showWelcome = showAuth && authView === "welcome";
  const showSignIn = showAuth && authView === "signin";
  const showSignUp = showAuth && authView === "signup";
  const canShowSettings = Boolean(isConfigured && isAuthenticated);
  const showSettings = Boolean(canShowSettings && activeTab === "settings");
  const passwordActionLabel = "Set password";

  if (showMainLoading) {
    return (
      <div className="app">
        <header className="header">
          <div>
            <h1>WakaWars</h1>
          </div>
          <div className="header-meta" />
        </header>
        {error && (
          <div className="error">
            <span>{error}</span>
            <button className="ghost tiny" onClick={handleRetry}>
              Retry
            </button>
          </div>
        )}
        <section className="card">
          <div className="section-header">
            <div className="section-title">
              <h2>Today</h2>
              <span className="muted">Restoring session</span>
            </div>
          </div>
          <p className="muted">Loading your league...</p>
        </section>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="app">
        <header className="header">
          <div>
            <h1>WakaWars</h1>
          </div>
          <div className="header-meta" />
        </header>
        <section className="card">
          <h2>Loading</h2>
          <p className="muted">Preparing your WakaWars session...</p>
        </section>
      </div>
    );
  }

  const showDockedAdd = Boolean(
    showDockedAddFriend && isConfigured && isAuthenticated && !showSettings
  );

  return (
    <div className={`app ${showDockedAdd ? "has-docked-add" : ""}`}>
      <header className="header">
        <div>
          <h1>WakaWars</h1>
        </div>
        <div className="header-meta">
          {canShowSettings && (
            <button
              type="button"
              className={`icon-button ghost-button ${
                activeTab === "settings" ? "active" : ""
              }`}
              onClick={() =>
                setActiveTab((prev) =>
                  prev === "settings" ? "league" : "settings"
                )
              }
              aria-label="Settings"
            >
              ⚙︎
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="error">
          <span>{error}</span>
          <button className="ghost tiny" onClick={handleRetry}>
            Retry
          </button>
        </div>
      )}

      {showWelcome ? (
        <section className="card welcome-card">
          <div className="app-logo" aria-hidden="true">
            <div className="logo-orbit" />
            <div className="logo-core">W</div>
          </div>
          <h2>Welcome to WakaWars</h2>
          <p className="muted">
            Start a rivalry with friends and track your WakaTime focus.
          </p>
          <div className="row welcome-actions">
            <button
              className="primary"
              type="button"
              onClick={() => setAuthView("signup")}
            >
              Sign up
            </button>
            <button
              className="ghost"
              type="button"
              onClick={() => setAuthView("signin")}
            >
              Sign in
            </button>
          </div>
        </section>
      ) : showSignIn ? (
        <section className="card">
          <div className="section-header">
            <h2>Sign in</h2>
            {!showLogin && (
              <button
                className="ghost tiny"
                type="button"
                onClick={() => setAuthView("welcome")}
              >
                Back
              </button>
            )}
          </div>
          <p className="muted">
            Enter your WakaWars credentials to unlock this device.
          </p>
          <form className="stack" onSubmit={handleLogin}>
            <label>
              WakaWars username
              <input
                type="text"
                value={login.username}
                onChange={(event) =>
                  setLogin((prev) => ({
                    ...prev,
                    username: event.target.value,
                  }))
                }
                placeholder="wakawars-username"
                required
                disabled={loading}
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={login.password}
                onChange={(event) =>
                  setLogin((prev) => ({
                    ...prev,
                    password: event.target.value,
                  }))
                }
                placeholder="password (optional)"
                disabled={loading}
              />
            </label>
            <button className="primary" type="submit" disabled={loading}>
              Sign in
            </button>
          </form>
          <div className="inline-action">
            <span className="muted">New here?</span>
            <button
              className="ghost tiny"
              type="button"
              onClick={() => setAuthView("signup")}
            >
              Create account
            </button>
          </div>
        </section>
      ) : showSignUp ? (
        <section className="card">
          <div className="section-header">
            <h2>Create account</h2>
            <button
              className="ghost tiny"
              type="button"
              onClick={() => setAuthView(showLogin ? "signin" : "welcome")}
            >
              Back
            </button>
          </div>
          <p className="muted">
            Set your WakaWars username and connect your WakaTime token.
          </p>
          <form className="stack" onSubmit={handleOnboardingSubmit}>
            <label>
              WakaWars username
              <input
                type="text"
                value={onboarding.wakawarsUsername}
                onChange={(event) =>
                  setOnboarding((prev) => ({
                    ...prev,
                    wakawarsUsername: event.target.value,
                  }))
                }
                placeholder="wakawars-username"
                required
                disabled={loading}
              />
            </label>
            <label>
              WakaTime token
              <input
                type="password"
                value={onboarding.apiKey}
                onChange={(event) =>
                  setOnboarding((prev) => ({
                    ...prev,
                    apiKey: event.target.value,
                  }))
                }
                placeholder="wakatime_token"
                required
                disabled={loading}
              />
            </label>
            <button className="primary" type="submit" disabled={loading}>
              Create account
            </button>
          </form>
          <div className="inline-action">
            <span className="muted">Already have an account?</span>
            <button
              className="ghost tiny"
              type="button"
              onClick={() => setAuthView("signin")}
            >
              Sign in
            </button>
          </div>
        </section>
      ) : showSettings ? (
        <>
          <section className="card">
            <h2>Account</h2>
            <div className="settings-row">
              <span className="muted">WakaWars username</span>
              <span>{config?.wakawarsUsername}</span>
            </div>
            <div className="settings-row">
              <span className="muted">API key</span>
              <span>{config?.hasApiKey ? "Connected" : "Missing"}</span>
            </div>
          </section>

          <section className="card">
            <h2>Security</h2>
            {session?.passwordSet ? (
              <div className="settings-row">
                <span className="muted">Password</span>
                <span>Set</span>
              </div>
            ) : (
              <>
                <p className="muted">
                  Set a password to keep this Mac logged in.
                </p>
                <form className="stack" onSubmit={handleSetPassword}>
                  <label>
                    {passwordActionLabel}
                    <input
                      type="password"
                      value={passwordForm.password}
                      onChange={(event) =>
                        setPasswordForm((prev) => ({
                          ...prev,
                          password: event.target.value,
                        }))
                      }
                      placeholder="password"
                      required
                      disabled={loading}
                    />
                  </label>
                  <label>
                    Confirm password
                    <input
                      type="password"
                      value={passwordForm.confirm}
                      onChange={(event) =>
                        setPasswordForm((prev) => ({
                          ...prev,
                          confirm: event.target.value,
                        }))
                      }
                      placeholder="confirm password"
                      required
                      disabled={loading}
                    />
                  </label>
                  <button className="primary" type="submit" disabled={loading}>
                    {passwordActionLabel}
                  </button>
                </form>
              </>
            )}
          </section>

          <section className="card">
            <h2>System</h2>
            <div className="settings-row">
              <span className="muted">Launch at login</span>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={Boolean(launchAtLogin)}
                  onChange={(event) => handleLaunchToggle(event.target.checked)}
                  disabled={launchAtLogin === null}
                />
                <span className="toggle-ui" />
              </label>
            </div>
            <div className="settings-row">
              <span className="muted">Light theme</span>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={theme === "light"}
                  onChange={(event) =>
                    setTheme(event.target.checked ? "light" : "dark")
                  }
                />
                <span className="toggle-ui" />
              </label>
            </div>
            <div className="settings-row">
              <span className="muted">Updates</span>
              <button
                type="button"
                className="ghost"
                onClick={handleCheckUpdates}
                disabled={checkingUpdates}
              >
                {checkingUpdates ? "Checking..." : "Check for updates"}
              </button>
            </div>
            {updateStatus && <p className="muted">{updateStatus}</p>}
            {launchAtLoginStatus === "requires-approval" && (
              <p className="muted">
                macOS needs approval in System Settings &gt; General &gt; Login
                Items.
              </p>
            )}
            {launchAtLogin === null && (
              <p className="muted">
                Launch at login is available in the macOS app.
              </p>
            )}
          </section>

          <AddFriendCard
            friendInput={friendInput}
            onFriendInputChange={(value) => {
              setFriendInput(value);
              if (addFriendError) {
                setAddFriendError(null);
              }
            }}
            onSubmit={handleAddFriend}
            loading={loading}
            errorMessage={addFriendError}
          />
        </>
      ) : (
        <>
          <section className="card">
            <div className="section-header">
              <div className="section-title">
                <h2>{activeLeagueTab === "weekly" ? "Weekly" : "Today"}</h2>
                {activeLeagueTab === "weekly" && (
                  <span className="muted">{weeklyRangeLabel}</span>
                )}
              </div>
              <div className="section-actions">
                {lastUpdated && (
                  <span className="muted">Updated {lastUpdated}</span>
                )}
                <div className="tab-group">
                  <button
                    type="button"
                    className={`tab-button ${
                      activeLeagueTab === "today" ? "active" : ""
                    }`}
                    onClick={() => setActiveLeagueTab("today")}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    className={`tab-button ${
                      activeLeagueTab === "weekly" ? "active" : ""
                    }`}
                    onClick={() => setActiveLeagueTab("weekly")}
                  >
                    Week
                  </button>
                </div>
              </div>
            </div>
            {activeLeagueTab === "weekly" ? (
              weeklyStats ? (
                <div className="list">
                  {weeklyStats.entries.map((entry) => (
                    <WeeklyLeaderboardRow
                      key={entry.username}
                      entry={entry}
                      isSelf={entry.username === config?.wakawarsUsername}
                    />
                  ))}
                </div>
              ) : (
                <p className="muted">No weekly stats yet.</p>
              )
            ) : stats ? (
              <div className="list">
                {stats.entries.map((entry) => (
                  <LeaderboardRow
                    key={entry.username}
                    entry={entry}
                    isSelf={entry.username === config?.wakawarsUsername}
                  />
                ))}
              </div>
            ) : (
              <p className="muted">No stats yet.</p>
            )}
          </section>
          {showDockedAdd && (
            <AddFriendCard
              docked
              dismissible
              onDismiss={() => setShowDockedAddFriend(false)}
              friendInput={friendInput}
              onFriendInputChange={(value) => {
                setFriendInput(value);
                if (addFriendError) {
                  setAddFriendError(null);
                }
              }}
              onSubmit={handleAddFriend}
              loading={loading}
              errorMessage={addFriendError}
            />
          )}
        </>
      )}
    </div>
  );
};

const statusLabel = (
  status: LeaderboardEntry["status"],
  totalSeconds: number
): string | null => {
  if (status === "ok") {
    return formatDuration(totalSeconds);
  }
  if (status === "private") {
    return null;
  }
  if (status === "not_found") {
    return "Not found";
  }
  return "Error";
};

const rankDisplay = (rank: number | null) => {
  const medal =
    rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
  return {
    rankLabel: medal ?? (rank ? `#${rank}` : "—"),
    podiumClass: rank && rank <= 3 ? `podium podium-${rank}` : ""
  };
};

const LeaderboardRow = ({
  entry,
  isSelf,
}: {
  entry: LeaderboardEntry;
  isSelf: boolean;
}) => {
  const { rankLabel, podiumClass } = rankDisplay(entry.rank);
  const timeLabel = statusLabel(entry.status, entry.totalSeconds);

  return (
    <div className={`row-item ${isSelf ? "self" : ""} ${podiumClass}`}>
      <div className="row-item-left">
        <div className="avatar">{entry.username.slice(0, 1).toUpperCase()}</div>
        <div className="row-content">
          <div className="row-title">
            <span>{entry.username}</span>
            {isSelf && <span className="badge">YOU</span>}
          </div>
        </div>
      </div>
      <div className="row-meta">
        <div className="row-meta-top">
          <span className="rank-display">{rankLabel}</span>
          {timeLabel && <span className="time">{timeLabel}</span>}
        </div>
      </div>
    </div>
  );
};

const WeeklyLeaderboardRow = ({
  entry,
  isSelf,
}: {
  entry: WeeklyLeaderboardEntry;
  isSelf: boolean;
}) => {
  const { rankLabel, podiumClass } = rankDisplay(entry.rank);
  const timeLabel = statusLabel(entry.status, entry.totalSeconds);
  const averageLabel =
    entry.status === "ok" ? formatDuration(entry.dailyAverageSeconds) : null;

  return (
    <div className={`row-item ${isSelf ? "self" : ""} ${podiumClass}`}>
      <div className="row-item-left">
        <div className="avatar">{entry.username.slice(0, 1).toUpperCase()}</div>
        <div className="row-content">
          <div className="row-title">
            <span>{entry.username}</span>
            {isSelf && <span className="badge">YOU</span>}
          </div>
          {averageLabel && (
            <div className="row-sub">
              <span>Avg {averageLabel}/day</span>
            </div>
          )}
        </div>
      </div>
      <div className="row-meta">
        <div className="row-meta-top">
          <span className="rank-display">{rankLabel}</span>
          {timeLabel && <span className="time">{timeLabel}</span>}
        </div>
      </div>
    </div>
  );
};

export default App;
