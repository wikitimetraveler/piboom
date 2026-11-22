import { useEffect } from 'react';

export type DeskConfirm = {
  tone: 'end' | 'delete';
  kicker: string;
  title: string;
  eventName: string;
  body: string;
  confirmLabel: string;
  run: () => Promise<void>;
};

type Props = {
  confirm: DeskConfirm;
  onClose: () => void;
};

export default function ConfirmDialog({ confirm, onClose }: Props) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div className="dp-dialog-backdrop">
      <div
        className={`dp-dialog dp-dialog--${confirm.tone}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dp-confirm-title"
        aria-describedby="dp-confirm-body"
      >
        <p className="dp-dialog-kicker">{confirm.kicker}</p>
        <h2 id="dp-confirm-title">{confirm.title}</h2>
        <p className="dp-dialog-event">{confirm.eventName}</p>
        <p id="dp-confirm-body" className="dp-dialog-body">
          {confirm.body}
        </p>
        <div className="dp-dialog-actions">
          <button type="button" className="btn btn-outline-secondary" onClick={onClose} autoFocus>
            Cancel
          </button>
          <button
            type="button"
            className={`btn ${confirm.tone === 'delete' ? 'btn-danger' : 'btn-dark'}`}
            onClick={() => {
              onClose();
              void confirm.run();
            }}
          >
            {confirm.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
