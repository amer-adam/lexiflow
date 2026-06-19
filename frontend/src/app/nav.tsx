import { createContext, useContext } from "react";

export type ViewId =
  | "dashboard"
  | "request"
  | "library"
  | "watch"
  | "vocab"
  | "flashcards"
  | "quiz"
  | "profile";

export interface NavState {
  view: ViewId;
  params: Record<string, string>;
  go: (view: ViewId, params?: Record<string, string>) => void;
}

export const NavContext = createContext<NavState>({
  view: "dashboard",
  params: {},
  go: () => {},
});

export const useNav = () => useContext(NavContext);
