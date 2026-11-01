import { useEffect, useRef } from 'react';
import type { SkiPage } from '../lib/page';

interface Props {
  page: SkiPage;
  selectedId: string;
  route: string;
  selectedRun?: string;
}

interface ChatWidget {
  title: string;
  buttonTitle: string;
  sessionId: string;
  welcomeHtml: string;
  inputPlaceholder: string;
  onMessageReceived: ((text: string) => void) | null;
}

declare global {
  interface Window {
    AIChatWidget?: new (config: Record<string, unknown>) => ChatWidget;
    aiChatWidget?: ChatWidget;
    skiApexSpeak?: (text: string) => void;
  }
}

const RIDGE = {
  title: 'Ridge',
  buttonTitle: 'Ask Ridge',
  sessionId: 'ski-ridge',
  placeholder: 'Weather, chains, drive stops, or “a north-facing blue under 20°”…',
  welcome:
    'Ridge here — SoCal ski-road desk. Weather and the drive on one side, the 3D trail map on the other. Ask me for a run by pitch, facing, or difficulty.',
};

const APEX = {
  title: 'Apex',
  buttonTitle: 'Ask Apex',
  sessionId: 'ski-apex',
  placeholder: 'A cruiser, a race line, or “which blue can I stand on?”…',
  welcome:
    'Apex here — ski racer, super cruiser. Point me at a run and I’ll tell you if it’s a carved line or too much speed.',
};

let widgetReady: Promise<void> | null = null;

function ensureWidget() {
  if (window.AIChatWidget) return Promise.resolve();
  if (!widgetReady) {
    widgetReady = new Promise((resolve, reject) => {
      window.addEventListener('ski-chat-ready', () => resolve(), { once: true });
      const script = document.createElement('script');
      script.type = 'module';
      script.textContent =
        "import AIChatWidget from '/shared/ai-chat-widget.js'; window.AIChatWidget = AIChatWidget; window.dispatchEvent(new Event('ski-chat-ready'));";
      script.onerror = () => reject(new Error('chat widget failed'));
      document.head.appendChild(script);
    });
  }
  return widgetReady;
}

function paintGuide(widget: ChatWidget, page: SkiPage) {
  const guide = page === 'areas' ? APEX : RIDGE;
  widget.title = guide.title;
  widget.buttonTitle = guide.buttonTitle;
  widget.sessionId = guide.sessionId;
  widget.welcomeHtml = `<p>${guide.welcome}</p>`;
  widget.inputPlaceholder = guide.placeholder;
  widget.onMessageReceived = page === 'areas' ? (text) => window.skiApexSpeak?.(text) : null;
  const heading = document.querySelector('#aiChatPanel h5');
  if (heading) heading.textContent = guide.title;
  const button = document.getElementById('aiChatButton');
  if (button) {
    button.title = guide.buttonTitle;
    button.setAttribute('aria-label', guide.buttonTitle);
  }
  const input = document.getElementById('aiChatInput') as HTMLInputElement | null;
  if (input) input.placeholder = guide.placeholder;
  const welcome = document.querySelector('.ai-chat-welcome');
  if (welcome) welcome.innerHTML = `<p>${guide.welcome}</p>`;
}

export default function GuideChat({ page, selectedId, route, selectedRun = '' }: Props) {
  const ctx = useRef({ page, selectedId, route, selectedRun });
  ctx.current = { page, selectedId, route, selectedRun };

  useEffect(() => {
    let cancel = false;
    ensureWidget().then(() => {
      if (cancel) return;
      const Widget = window.AIChatWidget;
      if (!Widget) return;
      if (!window.aiChatWidget) {
      const guide = page === 'areas' ? APEX : RIDGE;
      window.aiChatWidget = new Widget({
        apiEndpoint: '/api/ski/assistant/chat',
        userId: 'ski-guest',
        sessionId: guide.sessionId,
        title: guide.title,
        buttonTitle: guide.buttonTitle,
        inputPlaceholder: guide.placeholder,
        welcomeHtml: `<p>${guide.welcome}</p>`,
        getContext: () => ({
          page: ctx.current.page,
          selectedDestination: ctx.current.selectedId,
          route: ctx.current.route,
          selectedRun: ctx.current.selectedRun || undefined,
        }),
        onMessageReceived: page === 'areas' ? (text: string) => window.skiApexSpeak?.(text) : null,
      });
        return;
      }
      paintGuide(window.aiChatWidget, page);
    }).catch(() => undefined);
    return () => {
      cancel = true;
    };
  }, [page]);

  return null;
}
