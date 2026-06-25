// Udostępnianie raportu końca dnia (@capacitor/share) z fallbackiem na
// navigator.share / kopiowanie do schowka / pobranie pliku .txt.

function isNative(): boolean {
  return (
    typeof window !== 'undefined' &&
    (window as any).Capacitor?.isNativePlatform?.() === true
  );
}

export async function shareText(title: string, text: string): Promise<void> {
  if (isNative()) {
    try {
      const { Share } = await import('@capacitor/share');
      await Share.share({ title, text, dialogTitle: title });
      return;
    } catch {
      /* fallback poniżej */
    }
  }
  // Web Share API
  if (typeof navigator !== 'undefined' && (navigator as any).share) {
    try {
      await (navigator as any).share({ title, text });
      return;
    } catch {
      /* user anulował / brak — fallback */
    }
  }
  // Schowek
  try {
    await navigator.clipboard.writeText(text);
    alert('Raport skopiowano do schowka.');
    return;
  } catch {
    /* ostateczny fallback: pobranie pliku */
  }
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/\s+/g, '_')}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}
