// Skaner kodów kreskowych/QR przesyłek. Używa natywnego BarcodeDetector API
// (Android WebView/Chrome) + kamery; fallback: ręczne wpisanie kodu.
import { useEffect, useRef, useState } from 'react';

interface Props {
  onDetected: (code: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [manual, setManual] = useState('');
  const [supported, setSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastCode = useRef<string>('');
  // Trzymaj najświeższy callback w refie — efekt kamery ma puste deps, więc
  // strumień nie restartuje się przy każdym renderze rodzica (migotanie/prompt).
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  useEffect(() => {
    const Detector = (window as any).BarcodeDetector;
    if (!Detector || !navigator.mediaDevices?.getUserMedia) {
      setSupported(false);
      return;
    }
    let active = true;
    const detector = new Detector({
      formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'qr_code', 'upc_a', 'upc_e', 'itf'],
    });

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        const tick = async () => {
          if (!active) return;
          try {
            const codes = await detector.detect(video);
            if (codes && codes.length > 0) {
              const value = codes[0].rawValue as string;
              if (value && value !== lastCode.current) {
                lastCode.current = value;
                onDetectedRef.current(value);
              }
            }
          } catch {
            /* klatka pominięta */
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Brak dostępu do kamery');
        setSupported(false);
      }
    };
    void start();

    return () => {
      active = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="scanner-overlay" role="dialog" aria-label="Skaner kodów">
      <div className="scanner-head">
        <strong>Skanuj kod przesyłki</strong>
        <button className="pill" onClick={onClose}>
          ✕
        </button>
      </div>

      {supported ? (
        <div className="scanner-viewport">
          <video ref={videoRef} className="scanner-video" muted playsInline />
          <div className="scanner-frame" />
        </div>
      ) : (
        <p className="scanner-hint">
          {error
            ? `Kamera niedostępna: ${error}.`
            : 'Skaner sprzętowy niedostępny na tym urządzeniu.'}{' '}
          Wpisz kod ręcznie:
        </p>
      )}

      <div className="scanner-manual">
        <input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="Kod przesyłki…"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && manual.trim()) {
              onDetected(manual.trim());
              setManual('');
            }
          }}
        />
        <button
          className="btn-primary"
          onClick={() => {
            if (manual.trim()) {
              onDetected(manual.trim());
              setManual('');
            }
          }}
        >
          OK
        </button>
      </div>
    </div>
  );
}
