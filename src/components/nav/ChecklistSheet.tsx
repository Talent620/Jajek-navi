// Bottom-sheet na przystanku — INTUICYJNY: podstawy na wierzchu (zadania,
// duży „Dostarczono", pobranie, telefon), a dowód dostawy i inne wyniki ukryte
// w rozwijanych sekcjach.
import { useEffect, useRef, useState } from 'react';
import type { Stop } from '../../types';
import { TaskItem } from './TaskItem';
import { SignaturePad } from './SignaturePad';
import { BarcodeScanner } from './BarcodeScanner';
import { Collapsible } from '../Collapsible';
import { useTripStore } from '../../store/tripStore';
import { useSettingsStore } from '../../store/settingsStore';
import { callNumber, smsNumber } from '../../services/commsService';
import { haptic } from '../../services/deviceService';
import { sound } from '../../services/soundService';
import { formatMoney } from '../../lib/format';

interface Props {
  stop: Stop | null;
  onToggleTask: (taskId: string, done: boolean) => void;
  onAddTask: (text: string) => void;
  onTaskPhoto: (taskId: string, photoUri: string) => void;
  onSkip: (reason: string) => void;
  onClose: () => void;
  onNext: () => void;
  hasNext: boolean;
}

export function ChecklistSheet({
  stop,
  onToggleTask,
  onAddTask,
  onTaskPhoto,
  onSkip,
  onClose,
  onNext,
  hasNext,
}: Props) {
  const [newTask, setNewTask] = useState('');
  const [listening, setListening] = useState(false);
  const [showSig, setShowSig] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const recRef = useRef<any>(null);

  const currency = useSettingsStore((s) => s.currency);
  const setParcelScanned = useTripStore((s) => s.setParcelScanned);
  const addParcel = useTripStore((s) => s.addParcel);
  const removeParcel = useTripStore((s) => s.removeParcel);
  const setRecipient = useTripStore((s) => s.setRecipient);
  const setSignature = useTripStore((s) => s.setSignature);
  const collectCod = useTripStore((s) => s.collectCod);
  const setOutcome = useTripStore((s) => s.setOutcome);

  useEffect(() => {
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR || !stop) return;
    const rec = new SR();
    rec.lang = 'pl-PL';
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      const text = String(e.results[e.results.length - 1][0].transcript).toLowerCase();
      if (text.includes('zrobione') || text.includes('gotowe')) {
        const next = stop.tasks.find((t) => !t.done);
        if (next) onToggleTask(next.id, true);
      }
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    return () => {
      try {
        rec.stop();
      } catch {
        /* ignoruj */
      }
    };
  }, [stop, onToggleTask]);

  if (!stop) return null;

  const parcels = stop.parcels ?? [];
  const parcelsScanned = parcels.filter((p) => p.scanned).length;
  const voiceAvailable =
    typeof window !== 'undefined' &&
    ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  const toggleListen = () => {
    const rec = recRef.current;
    if (!rec) return;
    if (listening) {
      rec.stop();
      setListening(false);
    } else {
      try {
        rec.start();
        setListening(true);
      } catch {
        setListening(false);
      }
    }
  };

  const onScan = (code: string) => {
    const found = (stop.parcels ?? []).find((p) => p.code === code);
    if (found) {
      setParcelScanned(stop.id, found.id, true);
    } else {
      addParcel(stop.id, code);
      const justAdded = (
        useTripStore.getState().current()?.stops.find((s) => s.id === stop.id)?.parcels ?? []
      ).find((p) => p.code === code);
      if (justAdded) setParcelScanned(stop.id, justAdded.id, true);
    }
  };

  const deliver = () => {
    void haptic('success');
    sound.success();
    setOutcome(stop.id, 'delivered');
    onClose();
    if (hasNext) onNext();
  };

  return (
    <div className="checklist-sheet" role="dialog" aria-label={`Przystanek: ${stop.label}`}>
      <div className="sheet-handle" onClick={onClose} />

      {/* Nagłówek + szybki telefon */}
      <div className="sheet-header">
        <div>
          <h2>{stop.label}</h2>
          <p className="sheet-address">{stop.address}</p>
          {(stop.windowStart || stop.windowEnd) && (
            <span className="window-chip">🕒 {stop.windowStart || '—'}–{stop.windowEnd || '—'}</span>
          )}
        </div>
        {stop.phone && (
          <button className="btn-call round" onClick={() => callNumber(stop.phone!)} aria-label="Zadzwoń">
            📞
          </button>
        )}
      </div>

      {/* Notatka „co tu zrobić" — istotna, na wierzchu */}
      {stop.notes && (
        <div className="sheet-notes">
          <strong>Co tu zrobić:</strong> {stop.notes}
        </div>
      )}

      {/* Pobranie — gdy jest, pokazujemy od razu */}
      {stop.codAmount != null && stop.codAmount > 0 && (
        <div className={`pod-cod ${stop.codCollected ? 'collected' : ''}`}>
          <span>
            💰 Pobierz: <strong>{formatMoney(stop.codAmount, currency)}</strong>
          </span>
          <button
            className={stop.codCollected ? 'btn-secondary' : 'btn-primary'}
            onClick={() => collectCod(stop.id, !stop.codCollected)}
          >
            {stop.codCollected ? 'Pobrane ✓' : 'Pobrane?'}
          </button>
        </div>
      )}

      {/* Zadania — rdzeń check-listy */}
      {stop.tasks.length > 0 && (
        <div className="task-list">
          {stop.tasks.map((t) => (
            <TaskItem
              key={t.id}
              task={t}
              onToggle={(done) => onToggleTask(t.id, done)}
              onPhoto={(uri) => onTaskPhoto(t.id, uri)}
            />
          ))}
        </div>
      )}

      {/* GŁÓWNA AKCJA */}
      <button className="btn-deliver" onClick={deliver}>
        ✅ Dostarczono{hasNext ? ' — następny' : ''}
      </button>

      {/* DOWÓD DOSTAWY — ukryty, auto-otwarty gdy są paczki */}
      <Collapsible
        title="Dowód dostawy"
        icon="✍"
        subtitle="paczki · podpis · odbiorca"
        defaultOpen={parcels.length > 0}
        badge={parcels.length ? `${parcelsScanned}/${parcels.length}` : undefined}
      >
        {/* Paczki */}
        <div className="pod-section-head">
          <strong>Paczki ({parcelsScanned}/{parcels.length})</strong>
          <button className="btn-scan" onClick={() => setShowScanner(true)}>
            📷 Skanuj
          </button>
        </div>
        {parcels.map((p) => (
          <div key={p.id} className={`parcel-row ${p.scanned ? 'scanned' : ''}`}>
            <button className="task-toggle" onClick={() => setParcelScanned(stop.id, p.id, !p.scanned)}>
              {p.scanned ? '✓' : '○'}
            </button>
            <span className="parcel-code">{p.code}</span>
            {p.label && <span className="parcel-label">{p.label}</span>}
            <button className="task-del" onClick={() => removeParcel(stop.id, p.id)}>
              ✕
            </button>
          </div>
        ))}

        {/* Odbiorca + podpis */}
        <input
          className="pod-recipient"
          value={stop.recipientName ?? ''}
          onChange={(e) => setRecipient(stop.id, e.target.value)}
          placeholder="Imię i nazwisko odbiorcy…"
        />
        {stop.signatureDataUrl ? (
          <div className="pod-sign-done">
            <img src={stop.signatureDataUrl} alt="Podpis odbiorcy" className="pod-sign-thumb" />
            <button className="btn-secondary" onClick={() => setShowSig(true)}>
              Zmień podpis
            </button>
          </div>
        ) : (
          <button className="btn-secondary" onClick={() => setShowSig(true)}>
            ✍ Podpis odbiorcy
          </button>
        )}

        {/* Dodaj zadanie + komenda głosowa */}
        <div className="sheet-add-task">
          <input
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            placeholder="Dodaj zadanie…"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newTask.trim()) {
                onAddTask(newTask.trim());
                setNewTask('');
              }
            }}
          />
          <button
            onClick={() => {
              if (newTask.trim()) {
                onAddTask(newTask.trim());
                setNewTask('');
              }
            }}
          >
            +
          </button>
        </div>
        {voiceAvailable && (
          <button className={`btn-voice ${listening ? 'active' : ''}`} onClick={toggleListen}>
            {listening ? '🎙 Słucham… („Zrobione")' : '🎙 Komenda głosowa „Zrobione"'}
          </button>
        )}
      </Collapsible>

      {/* INNY WYNIK — ukryty */}
      <Collapsible title="Inny wynik / problem" icon="⚠️">
        {stop.phone && (
          <button className="btn-secondary" onClick={() => smsNumber(stop.phone!)}>
            ✉ Wyślij SMS do klienta
          </button>
        )}
        <button
          className="outcome partial"
          onClick={() => {
            const reason = prompt('Co dostarczono częściowo / czego brakuje?', '');
            if (reason !== null) setOutcome(stop.id, 'partial', reason);
          }}
        >
          🟡 Dostawa częściowa
        </button>
        <button
          className="outcome failed"
          onClick={() => {
            const reason = prompt('Powód nieudanej dostawy:', 'Klient nieobecny');
            if (reason !== null) {
              setOutcome(stop.id, 'failed', reason);
              onClose();
              if (hasNext) onNext();
            }
          }}
        >
          ❌ Nieudane
        </button>
        <button
          className="btn-skip"
          onClick={() => {
            const reason = prompt('Powód pominięcia / przełożenia:', 'Klient nieobecny');
            if (reason !== null) {
              onSkip(reason);
              onClose();
              if (hasNext) onNext();
            }
          }}
        >
          ⏭ Pomiń / przełóż
        </button>
      </Collapsible>

      <button className="btn-secondary sheet-collapse" onClick={onClose}>
        Zwiń
      </button>

      {showSig && (
        <div className="modal-backdrop" onClick={() => setShowSig(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Podpis odbiorcy</h3>
            <SignaturePad
              initial={stop.signatureDataUrl}
              onSave={(dataUrl) => {
                setSignature(stop.id, dataUrl);
                setShowSig(false);
              }}
            />
          </div>
        </div>
      )}

      {showScanner && (
        <BarcodeScanner onDetected={onScan} onClose={() => setShowScanner(false)} />
      )}
    </div>
  );
}
