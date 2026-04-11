import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Platform } from "react-native";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { auth } from "../config/firebase";
import {
  requestPushPermissions,
  getPushToken,
  registerPushToken,
  unregisterPushToken,
  attachTokenRefreshListener,
} from "../services/pushNotifications";

interface AuthUser {
  email: string;
  uid: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

function mapFirebaseError(code: string): string {
  switch (code) {
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Invalid email or password.";
    case "auth/user-not-found":
      return "No account found with this email.";
    case "auth/email-already-in-use":
      return "An account with this email already exists.";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/too-many-requests":
      return "Too many attempts. Please try again later.";
    default:
      return "An unexpected error occurred. Please try again.";
  }
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const currentTokenRef = useRef<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser: User | null) => {
        if (firebaseUser && firebaseUser.email) {
          setUser({ email: firebaseUser.email, uid: firebaseUser.uid });
          setIsAuthenticated(true);
        } else {
          setUser(null);
          setIsAuthenticated(false);
        }
        setLoading(false);
      },
    );

    return unsubscribe;
  }, []);

  // Push-token lifecycle: on login, request permission, fetch an Expo push
  // token, register it with the backend, and attach a refresh listener so we
  // re-register whenever the OS rotates the token. Any failure is non-fatal.
  // # Tests R-P2-01, R-P2-02, R-P2-03, R-P2-04
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    let subscription: { remove: () => void } | null = null;
    (async () => {
      try {
        const granted = await requestPushPermissions();
        if (!granted) {
          return;
        }
        const token = await getPushToken();
        if (!token) {
          return;
        }
        currentTokenRef.current = token;
        await registerPushToken(token, Platform.OS);
        subscription = attachTokenRefreshListener((newToken: string) => {
          currentTokenRef.current = newToken;
          registerPushToken(newToken, Platform.OS).catch(() => {
            // Non-fatal: rotation re-register failure is logged by the API layer.
          });
        });
      } catch (_err) {
        // Non-fatal: push registration failure must not block auth.
      }
    })();
    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, [isAuthenticated]);

  async function login(email: string, password: string): Promise<void> {
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: unknown) {
      const firebaseError = err as { code?: string };
      const message = mapFirebaseError(firebaseError.code || "");
      setError(message);
      throw new Error(message);
    }
  }

  async function signup(email: string, password: string): Promise<void> {
    setError(null);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (err: unknown) {
      const firebaseError = err as { code?: string };
      const message = mapFirebaseError(firebaseError.code || "");
      setError(message);
      throw new Error(message);
    }
  }

  // # Tests R-P2-05
  async function logout(): Promise<void> {
    setError(null);
    if (currentTokenRef.current) {
      try {
        await unregisterPushToken(currentTokenRef.current);
      } catch (_err) {
        // Non-fatal: unregister failure must not block sign-out.
      }
      currentTokenRef.current = null;
    }
    await signOut(auth);
  }

  return (
    <AuthContext.Provider
      value={{ isAuthenticated, user, loading, error, login, signup, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
