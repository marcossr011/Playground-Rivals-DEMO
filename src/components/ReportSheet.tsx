import { useEffect, useState } from 'react';
import { Sheet } from './Sheet';
import { REPORT_REASONS } from '../lib/chat';

interface ReportSheetProps {
  open: boolean;
  targetName: string;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}

export function ReportSheet({ open, targetName, onClose, onSubmit }: ReportSheetProps) {
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [detail, setDetail] = useState('');

  useEffect(() => {
    if (open) {
      setReason(REPORT_REASONS[0]);
      setDetail('');
    }
  }, [open]);

  return (
    <Sheet open={open} onClose={onClose} label="Reportar a un jugador">
      <h2>Reportar a {targetName}</h2>
      <p className="lead">Cuéntanos qué ha pasado. Revisamos los reportes y podemos limitar el chat.</p>
      <div className="filters" style={{ marginTop: 12 }}>
        {REPORT_REASONS.map((option) => (
          <button
            key={option}
            type="button"
            className={`chip ${reason === option ? 'active' : ''}`}
            onClick={() => setReason(option)}
            aria-pressed={reason === option}
          >
            {option}
          </button>
        ))}
      </div>
      <input
        className="input"
        value={detail}
        onChange={(event) => setDetail(event.target.value)}
        placeholder="Detalle opcional"
        maxLength={120}
        style={{ marginTop: 12 }}
      />
      <div className="sheet-actions">
        <button
          type="button"
          className="btn btn-primary btn-wide"
          onClick={() => {
            onSubmit(detail.trim() ? `${reason}: ${detail.trim()}` : reason);
            onClose();
          }}
        >
          Enviar reporte
        </button>
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Cancelar
        </button>
      </div>
    </Sheet>
  );
}
