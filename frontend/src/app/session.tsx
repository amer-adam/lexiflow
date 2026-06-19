import { useCallback, type ReactNode } from "react";
import {
  Auth0Provider,
  useAuth0,
} from "@auth0/auth0-react";

// ── Environment ─────────────────────────────────────────────────────────────
export const ENV = {
  apiBase: import.meta.env.VITE_API_BASE_URL || "http://localhost:4556",
  auth0Domain: import.meta.env.VITE_AUTH0_DOMAIN || "",
  auth0ClientId: import.meta.env.VITE_AUTH0_CLIENT_ID || "",
  auth0Audience: import.meta.env.VITE_AUTH0_AUDIENCE || "http://localhost:4556",
};

export const AUTH_CONFIGURED = Boolean(ENV.auth0Domain && ENV.auth0ClientId);

/**
 * Wraps the app in Auth0 when credentials are configured. When they aren't
 * (e.g. a reviewer just running `npm run dev` with no .env), we skip Auth0 so
 * the app still boots — it simply stays in demo mode.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  if (!AUTH_CONFIGURED) return <>{children}</>;
  return (
    <Auth0Provider
      domain={ENV.auth0Domain}
      clientId={ENV.auth0ClientId}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: ENV.auth0Audience,
      }}
      cacheLocation="localstorage"
    >
      {children}
    </Auth0Provider>
  );
}

export interface Session {
  isAuthenticated: boolean;
  isLoading: boolean;
  configured: boolean;
  name?: string;
  email?: string;
  picture?: string;
  login: () => void;
  logout: () => void;
  getToken: () => Promise<string | null>;
}

/** Unified session hook — safe to call whether or not Auth0 is mounted. */
export function useSession(): Session {
  if (!AUTH_CONFIGURED) {
    return {
      isAuthenticated: false,
      isLoading: false,
      configured: false,
      login: () =>
        alert(
          "Auth0 is not configured in this build.\n\nSet VITE_AUTH0_DOMAIN, VITE_AUTH0_CLIENT_ID and VITE_AUTH0_AUDIENCE in frontend/.env.local to enable live sign-in. The app runs in demo mode without it."
        ),
      logout: () => {},
      getToken: async () => null,
    };
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useAuth0Session();
}

function useAuth0Session(): Session {
  const {
    isAuthenticated,
    isLoading,
    user,
    loginWithRedirect,
    logout,
    getAccessTokenSilently,
  } = useAuth0();

  // Stable identities — otherwise the API client / useQuery effects re-run
  // every render and loop forever.
  const login = useCallback(() => loginWithRedirect(), [loginWithRedirect]);
  const logoutCb = useCallback(
    () => logout({ logoutParams: { returnTo: window.location.origin } }),
    [logout]
  );
  const getToken = useCallback(async () => {
    try {
      return await getAccessTokenSilently();
    } catch {
      return null;
    }
  }, [getAccessTokenSilently]);

  return {
    isAuthenticated,
    isLoading,
    configured: true,
    name: user?.name,
    email: user?.email,
    picture: user?.picture,
    login,
    logout: logoutCb,
    getToken,
  };
}
