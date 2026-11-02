"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api/client";
import { normalizeBoxTagId } from "@/lib/api/box-tag-store";

type Detector = { detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]> };
type DetectorCtor = new (opts: { formats: string[] }) => Detector;

/** Pulls a box ID out of a scan, whether it's the Code 128 ID or the QR code URL. */
function boxIdFrom(raw: string) {
  const fromUrl = raw.match(/\/boxes\/(BT-\d+)/i);
  return normalizeBoxTagId(fromUrl ? fromUrl[1] : raw);
}

export default function ScanPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [camera, setCamera] = useState<"off" | "on" | "unsupported">("off");

  useEffect(() => {
    inputRef.current?.focus();
    if (!("BarcodeDetector" in window)) setCamera("unsupported");
  }, []);

  async function open(raw: string) {
    const id = boxIdFrom(raw);
    if (!id) return;
    const box = await api.getBoxTag(id);
    if (box) {
      router.push(`/boxes/${box.box_tag_id}`);
    } else {
      setError(`No box found for “${raw.trim()}”. Check the label and try again.`);
      setCode("");
      inputRef.current?.focus();
    }
  }

  async function startCamera() {
    const Ctor = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
    if (!Ctor || !videoRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play();
      setCamera("on");
      const detector = new Ctor({ formats: ["code_128", "qr_code"] });
      const tick = async () => {
        if (!video.srcObject) return;
        const found = await detector.detect(video).catch(() => []);
        if (found[0]) {
          stream.getTracks().forEach((t) => t.stop());
          video.srcObject = null;
          setCamera("off");
          open(found[0].rawValue);
          return;
        }
        requestAnimationFrame(tick);
      };
      tick();
    } catch {
      setError("Couldn’t open the camera. You can still type the box ID or use a scanner.");
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Scan a box</h1>
        <p className="mt-1 text-sm text-navy-soft">
          Use a barcode scanner, your camera, or type the ID from the label. You’ll see what’s
          inside without opening it.
        </p>
      </div>

      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          open(code);
        }}
      >
        <label className="label" htmlFor="code">
          Box ID
        </label>
        <div className="flex gap-2">
          <input
            id="code"
            ref={inputRef}
            className="input font-mono text-lg"
            placeholder="BT-000101"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="off"
          />
          <button className="btn-primary shrink-0" disabled={!code.trim()}>
            Open
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-red-brand">{error}</p>}
        <p className="mt-3 text-xs text-navy-soft">
          Scanners type the code and press Enter for you, so you can just scan.
        </p>
      </form>

      <div className="card text-center">
        <video
          ref={videoRef}
          className={`mx-auto aspect-video w-full rounded-[4px] bg-navy object-cover ${camera === "on" ? "" : "hidden"}`}
          muted
          playsInline
        />
        {camera === "off" && (
          <button className="btn-ghost" onClick={startCamera}>
            Use camera instead
          </button>
        )}
        {camera === "unsupported" && (
          <p className="text-sm text-navy-soft">
            Camera scanning works in Chrome on Android and desktop. In this browser, use a scanner
            or type the ID.
          </p>
        )}
      </div>

      <p className="text-center text-xs text-navy-soft">
        Try one of the demo boxes:{" "}
        {["BT-000101", "BT-000102", "BT-000103"].map((id, n) => (
          <button key={id} className="font-mono font-semibold text-navy underline-offset-2 hover:underline" onClick={() => open(id)}>
            {id}
            {n < 2 ? ", " : ""}
          </button>
        ))}
      </p>
    </div>
  );
}
