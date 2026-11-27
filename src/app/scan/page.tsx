"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Alert } from "@/components/Alert";
import { Required } from "@/components/Required";
import { Icon } from "@/components/Icon";
import { api } from "@/lib/api/client";
import { normalizeBoxTagId } from "@/lib/api/box-tag-store";
import { canUseCamera, getBarcodeReader } from "@/lib/barcode-reader";
import { IS_DEMO } from "@/lib/mode";


type CameraProblem = "blocked" | "busy" | "missing" | "other";

/** Turns a getUserMedia error into something a person can act on. */
function problemFrom(error: unknown): CameraProblem {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "blocked";
  if (name === "NotReadableError" || name === "AbortError") return "busy";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "missing";
  return "other";
}

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
  const [permission, setPermission] = useState<PermissionState | null>(null);
  const [problem, setProblem] = useState<CameraProblem | null>(null);
  const [isMac, setIsMac] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    if (!canUseCamera()) setCamera("unsupported");
    setIsMac(/Mac/i.test(navigator.userAgent));

    // Find out ahead of time whether the browser will ask, has said yes, or is blocking the camera
    let status: PermissionStatus | null = null;
    const update = () => {
      if (!status) return;
      setPermission(status.state);
      if (status.state === "denied") setProblem("blocked");
      if (status.state === "granted") setProblem((p) => (p === "blocked" ? null : p));
    };
    navigator.permissions
      ?.query({ name: "camera" as PermissionName })
      .then((s) => {
        status = s;
        update();
        s.addEventListener("change", update);
      })
      .catch(() => {
        /* some browsers can't report camera permission; the error message covers it */
      });
    return () => {
      status?.removeEventListener("change", update);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCamera("off");
  }

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
    if (!videoRef.current) return;
    setProblem(null);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play();
      setCamera("on");
      const reader = await getBarcodeReader();
      // Check a few frames a second, which is plenty for a label held in front of the camera
      const tick = async () => {
        if (!video.srcObject) return;
        const found = await reader.detect(video).catch(() => []);
        if (found[0]) {
          stopCamera();
          open(found[0].rawValue);
          return;
        }
        setTimeout(tick, 150);
      };
      tick();
    } catch (e) {
      setProblem(problemFrom(e));
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
          <Required />
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
            <Icon name="arrow" />
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
        {camera === "on" && (
          <button className="btn-ghost mt-3" onClick={stopCamera}>
            Stop camera
          </button>
        )}
        {camera === "off" && !problem && (
          <>
            <button className="btn-ghost" onClick={startCamera}>
              <Icon name="camera" />
              Use camera instead
            </button>
            {permission !== "granted" && (
              <p className="mt-2 text-sm text-navy-soft">
                Your browser will ask to use your camera. Choose <span className="font-bold">Allow</span>.
              </p>
            )}
          </>
        )}
        {camera === "off" && problem && (
          <div className="text-left">
            <CameraHelp problem={problem} isMac={isMac} />
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <button className="btn-primary" onClick={startCamera}>
                <Icon name="camera" />
                Try again
              </button>
              <button className="btn-ghost" onClick={() => inputRef.current?.focus()}>
                Type the ID instead
              </button>
            </div>
          </div>
        )}
        {camera === "unsupported" && (
          <p className="text-sm text-navy-soft">
            This browser can’t use a camera. Use a barcode scanner or type the ID.
          </p>
        )}
      </div>

      {IS_DEMO && (
        <p className="text-center text-xs text-navy-soft">
          Try one of the demo boxes:{" "}
          {["BT-000101", "BT-000102", "BT-000103"].map((id, n) => (
            <span key={id}>
              {n > 0 && ", "}
              <button className="font-mono font-semibold text-navy underline-offset-2 hover:underline" onClick={() => open(id)}>
                {id}
              </button>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

/** Plain steps for each kind of camera problem. */
function CameraHelp({ problem, isMac }: { problem: CameraProblem; isMac: boolean }) {
  if (problem === "blocked") {
    return (
      <Alert tone="warning" title="The camera is blocked for this site">
        <ol className="mt-1 list-decimal space-y-1 pl-5">
          <li>
            Click the <span className="font-bold">camera</span> or <span className="font-bold">lock</span> icon at the
            left of the address bar.
          </li>
          <li>
            Set Camera to <span className="font-bold">Allow</span>, then press Try again.
          </li>
          {isMac && (
            <li>
              Still blocked? On your Mac, open System Settings, then Privacy &amp; Security, then Camera, and turn on
              your browser. You may need to restart the browser after.
            </li>
          )}
        </ol>
      </Alert>
    );
  }
  if (problem === "busy") {
    return (
      <Alert tone="warning" title="Another app is using the camera">
        Close apps like Zoom, Teams or FaceTime that might have the camera open, then press Try again.
      </Alert>
    );
  }
  if (problem === "missing") {
    return (
      <Alert tone="warning" title="No camera was found">
        This device doesn’t seem to have a camera. Type the box ID or use a barcode scanner instead.
      </Alert>
    );
  }
  return (
    <Alert tone="warning" title="The camera didn’t start">
      Press Try again. If it still doesn’t work, type the box ID or use a barcode scanner.
    </Alert>
  );
}
