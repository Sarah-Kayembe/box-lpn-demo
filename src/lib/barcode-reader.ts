/*
 * Camera barcode reading that works in every browser.
 * Chrome on Android and Mac has a built-in reader (BarcodeDetector). Safari,
 * Firefox and every iPhone browser don't, so there we load an open-source
 * reader (ZXing compiled to WebAssembly) the first time the camera is used.
 * Its .wasm file is served from this app (public/zxing), not from a CDN.
 */

export type BarcodeReader = { detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]> };

const FORMATS = ["code_128", "qr_code"];

type NativeCtor = (new (opts: { formats: string[] }) => BarcodeReader) & {
  getSupportedFormats?: () => Promise<string[]>;
};

export async function getBarcodeReader(): Promise<BarcodeReader> {
  const Native = (window as unknown as { BarcodeDetector?: NativeCtor }).BarcodeDetector;
  if (Native) {
    try {
      const supported = (await Native.getSupportedFormats?.()) ?? [];
      if (FORMATS.every((f) => supported.includes(f))) return new Native({ formats: FORMATS });
    } catch {
      /* fall back to the WebAssembly reader */
    }
  }

  const { BarcodeDetector, prepareZXingModule } = await import("barcode-detector/ponyfill");
  prepareZXingModule({
    overrides: {
      locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? `/zxing/${path}` : prefix + path),
    },
  });
  return new BarcodeDetector({ formats: ["code_128", "qr_code"] });
}

/** True when the browser can use a camera at all. */
export const canUseCamera = () => typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
