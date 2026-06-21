import { useEffect, useState } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { useSession } from "@/app/session";

// ─────────────────────────────────────────────────────────────────────────
//  Standalone page opened by the browser extension's popup ("Connect to
//  LexiFlow"). It piggybacks on this tab's existing Auth0 session: once
//  signed in, it posts the access token to the page itself, where the
//  extension's auth-relay content script (matched only to this origin)
//  picks it up and forwards it to the extension's background worker.
//  Refreshes the token every 5 minutes so a long-lived tab keeps the
//  extension's copy from expiring.
// ─────────────────────────────────────────────────────────────────────────
export function ExtensionAuthView() {
  const session = useSession();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!session.isAuthenticated) return;
    let cancelled = false;
    const post = async () => {
      const token = await session.getToken();
      if (cancelled || !token) return;
      window.postMessage({ type: "LEXIFLOW_EXT_TOKEN", token }, window.location.origin);
      setConnected(true);
    };
    post();
    const t = window.setInterval(post, 5 * 60_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [session.isAuthenticated, session.getToken]);

  return (
    <div className="h-screen grid place-items-center bg-background text-foreground">
      <div className="paper p-8 max-w-sm text-center">
        <span className="seal grid h-12 w-12 mx-auto mb-4 place-items-center text-xl font-bold">流</span>
        {session.isLoading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-3 text-secondary" />
            <p className="text-sm text-muted-foreground">Checking your session…</p>
          </>
        ) : !session.isAuthenticated ? (
          <>
            <h1 className="font-display text-lg font-semibold mb-2">Sign in to connect</h1>
            <p className="text-sm text-muted-foreground mb-4">
              Sign in to LexiFlow to link this browser to the extension.
            </p>
            <button
              onClick={session.login}
              className="w-full rounded-md bg-primary text-primary-foreground py-2 text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Sign in
            </button>
          </>
        ) : connected ? (
          <>
            <CheckCircle2 className="h-8 w-8 mx-auto mb-3 text-hsk-1" />
            <h1 className="font-display text-lg font-semibold mb-1">Connected</h1>
            <p className="text-sm text-muted-foreground">
              The LexiFlow extension is linked to your account. You can close this tab.
            </p>
          </>
        ) : (
          <>
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-3 text-secondary" />
            <p className="text-sm text-muted-foreground">Linking the extension…</p>
          </>
        )}
      </div>
    </div>
  );
}
