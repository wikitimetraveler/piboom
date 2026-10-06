import { useEffect, useRef } from 'react';
import type { SkiPage } from '../lib/page';

interface Props {
  page: SkiPage;
  selectedId: string;
  route: string;
  selectedRun?: string;
}

export default function GuideChat({ page, selectedId, route, selectedRun = '' }: Props) {
  const ctx = useRef({ page, selectedId, route, selectedRun });
  ctx.current = { page, selectedId, route, selectedRun };

  useEffect(() => {
    const Widget = window.AIChatWidget;
    if (!Widget || window.aiChatWidget) return;
    window.aiChatWidget = new Widget({
      apiEndpoint: '/api/ski/assistant/chat',
      userId: 'ski-guest',
      sessionId: 'ski-ridge',
      title: 'Ridge',
      buttonTitle: 'Ask Ridge',
      inputPlaceholder: 'Weather, chains, drive stops, or “a north-facing blue under 20°”…',
      welcomeHtml:
        '<p>Ridge here — SoCal ski-road desk. Weather and the drive on one side, the 3D trail map on the other. Ask me for a run by pitch, facing, or difficulty.</p>',
      getContext: () => ({
        page: ctx.current.page,
        selectedDestination: ctx.current.selectedId,
        route: ctx.current.route,
        selectedRun: ctx.current.selectedRun || undefined,
      }),
    });
  }, []);

  return null;
}
