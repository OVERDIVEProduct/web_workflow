import { createContext, useContext, type ReactNode } from 'react';

type Actions = { commitText: (id: string, text: string) => void };
const Context = createContext<Actions | null>(null);

export function StickyNoteActionsProvider({
  actions,
  children,
}: { actions: Actions; children: ReactNode }) {
  return <Context.Provider value={actions}>{children}</Context.Provider>;
}

export function useStickyNoteActions() {
  const context = useContext(Context);
  if (!context) throw new Error('StickyNoteActionsProvider 尚未設定');
  return context;
}
