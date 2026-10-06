/// <reference types="vite/client" />

interface Window {
  AIChatWidget?: new (config: Record<string, unknown>) => {
    open?: () => void;
    toggle?: () => void;
  };
  aiChatWidget?: unknown;
}
