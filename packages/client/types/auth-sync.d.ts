// Type definitions for @maxipublica/auth-sync

export type ConnectionState =
  | 'CLOSED'
  | 'CONNECTING'
  | 'AUTHENTICATING'
  | 'OPEN'
  | 'RECONNECTING';

export type AuthSyncEventName =
  | 'login'
  | 'logout'
  | 'user-switch'
  | 'token-refreshed'
  | 'session-expired'
  | 'connection-change'
  | 'error'
  | '*';

export interface Auth0User {
  sub?: string;
  email?: string;
  name?: string;
  [key: string]: unknown;
}

export interface LoginEvent          { user: Auth0User | null; }
export interface LogoutEvent         { user: Auth0User | null; reason?: string; }
export interface UserSwitchEvent     { from: Auth0User | null; to: Auth0User | null; }
export interface TokenRefreshedEvent { at: number; }
export interface SessionExpiredEvent { reason?: string; }
export interface ConnectionChangeEvent { state: ConnectionState; previous: ConnectionState; }
export interface AuthSyncErrorEvent  { code: string; cause?: unknown; payload?: unknown; }

export interface AuthAdapter {
  kind?: string;
  getAccessToken(opts?: { ignoreCache?: boolean }): Promise<string>;
  getUser(): Promise<Auth0User | null>;
  isAuthenticated(): Promise<boolean>;
  logout(opts?: { localOnly?: boolean }): Promise<void> | void;
  onAuthStateChanged?(cb: () => void): () => void;
}

export interface ReconnectOptions {
  baseMs?: number;
  maxMs?: number;
  jitter?: boolean;
}

export interface AuthSyncInitOptions {
  socketUrl: string;
  appName?: string;
  auth0Client?: unknown;
  adapter?: 'spa' | 'react' | 'legacy' | 'generic' | AuthAdapter;
  adapterOptions?: Record<string, unknown>;

  onLogin?(event: LoginEvent): void;
  onLogout?(event: LogoutEvent): void;
  onUserSwitch?(event: UserSwitchEvent): void;
  onTokenRefreshed?(event: TokenRefreshedEvent): void;
  onSessionExpired?(event: SessionExpiredEvent): void;
  onConnectionChange?(event: ConnectionChangeEvent): void;
  onError?(event: AuthSyncErrorEvent): void;

  debug?: boolean;
  reconnect?: ReconnectOptions;
  authTimeoutMs?: number;
  tokenRefreshSkewSec?: number;
  pollIntervalMs?: number;
  channelKey?: string;
  forceLocalLogoutOnRemote?: boolean;
}

export interface AuthSyncApi {
  init(options: AuthSyncInitOptions): AuthSyncApi;
  on(event: 'login', handler: (e: LoginEvent) => void): () => void;
  on(event: 'logout', handler: (e: LogoutEvent) => void): () => void;
  on(event: 'user-switch', handler: (e: UserSwitchEvent) => void): () => void;
  on(event: 'token-refreshed', handler: (e: TokenRefreshedEvent) => void): () => void;
  on(event: 'session-expired', handler: (e: SessionExpiredEvent) => void): () => void;
  on(event: 'connection-change', handler: (e: ConnectionChangeEvent) => void): () => void;
  on(event: 'error', handler: (e: AuthSyncErrorEvent) => void): () => void;
  on(event: '*', handler: (payload: unknown, eventName: AuthSyncEventName) => void): () => void;
  off(event: AuthSyncEventName, handler: (...args: unknown[]) => void): void;

  notifyLogin(payload?: { user?: Auth0User }): Promise<void> | void;
  notifyLogout(payload?: { reason?: string }): void;
  notifyUserSwitch(payload?: { from?: Auth0User | null; to?: Auth0User | null }): void;

  getState(): ConnectionState;
  getUser(): Auth0User | null;
  isLeaderTab(): boolean;
  destroy(): void;

  readonly ConnectionState: Readonly<Record<ConnectionState, ConnectionState>>;
  readonly Events: Readonly<Record<string, AuthSyncEventName>>;
}

export const AuthSync: AuthSyncApi;
export default AuthSync;

declare global {
  interface Window {
    AuthSync: AuthSyncApi;
  }
}
