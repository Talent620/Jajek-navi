// Zdjęcie jako dowód wykonania zadania (@capacitor/camera) z fallbackiem
// na <input type=file capture> w przeglądarce. Zwraca dataURL/URI do zapisania.

function isNative(): boolean {
  return (
    typeof window !== 'undefined' &&
    (window as any).Capacitor?.isNativePlatform?.() === true
  );
}

/** Robi zdjęcie i zwraca URI (dataURL na webie, file/content URI natywnie). */
export async function capturePhoto(): Promise<string | null> {
  if (isNative()) {
    try {
      const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
      const photo = await Camera.getPhoto({
        quality: 60,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        saveToGallery: false,
      });
      return photo.dataUrl ?? null;
    } catch {
      return null;
    }
  }
  // Fallback web: ukryty input z aparatem.
  return new Promise<string | null>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    };
    input.click();
  });
}
