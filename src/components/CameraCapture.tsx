import { useEffect, useRef, useState, useCallback } from "react";

type Props = {
  onCapture: (dataUrl: string) => void;
  autoStart?: boolean;
};

export function CameraCapture({ onCapture, autoStart = true }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined);
  const STORAGE_KEY = "cameraCapture.deviceId";

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setActive(false);
  }, []);

  const refreshDevices = useCallback(async () => {
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      setDevices(list.filter((d) => d.kind === "videoinput"));
    } catch {
      /* ignore */
    }
  }, []);

  const start = useCallback(async (id?: string) => {
    setError(null);
    try {
      // stop any existing stream before starting a new one
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: id
          ? {
              deviceId: { exact: id },
              width: { ideal: 640 },
              height: { ideal: 480 },
              frameRate: { ideal: 30 },
            }
          : { facingMode: "user", width: { ideal: 720 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        // Detach first — reusing the same <video> element with a new stream
        // can produce a green frame on virtual cameras (DroidCam, OBS).
        videoRef.current.srcObject = null;
        videoRef.current.srcObject = stream;
        // Wait for metadata so dimensions are known before play (fixes green frame on virtual cams like DroidCam)
        await new Promise<void>((resolve) => {
          const v = videoRef.current!;
          if (v.readyState >= 1) return resolve();
          const onLoaded = () => {
            v.removeEventListener("loadedmetadata", onLoaded);
            resolve();
          };
          v.addEventListener("loadedmetadata", onLoaded);
        });
        await videoRef.current.play().catch(() => {});
        // Some virtual cams deliver a green first frame until the decoder
        // primes. If the video hasn't produced pixels yet, nudge it.
        await new Promise((r) => setTimeout(r, 150));
        if (videoRef.current && videoRef.current.videoWidth === 0) {
          videoRef.current.load();
          await videoRef.current.play().catch(() => {});
        }
      }
      // pick up the actual device id in use
      const track = stream.getVideoTracks()[0];
      const settingsId = track?.getSettings().deviceId;
      if (settingsId) {
        setDeviceId(settingsId);
        try {
          localStorage.setItem(STORAGE_KEY, settingsId);
        } catch {
          /* ignore */
        }
      }
      setActive(true);
      // labels are populated after permission is granted
      void refreshDevices();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not access the camera. Please allow camera permission.",
      );
    }
  }, [refreshDevices]);

  useEffect(() => {
    if (autoStart) {
      let saved: string | undefined;
      try {
        saved = localStorage.getItem(STORAGE_KEY) ?? undefined;
      } catch {
        /* ignore */
      }
      void start(saved);
    }
    const onChange = () => void refreshDevices();
    navigator.mediaDevices?.addEventListener?.("devicechange", onChange);
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !active) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;
    // Crop to 3:4 portrait center
    const targetRatio = 3 / 4;
    let sw = w;
    let sh = h;
    if (w / h > targetRatio) {
      sw = h * targetRatio;
    } else {
      sh = w / targetRatio;
    }
    const sx = (w - sw) / 2;
    const sy = (h - sh) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 800;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    onCapture(dataUrl);
    stop();
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-muted aspect-[3/4] w-full max-w-sm shadow-sm">
        <video
          ref={videoRef}
          playsInline
          muted
          className="h-full w-full object-cover"
        />
        {!active && !error && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            Starting camera…
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-destructive">
            {error}
          </div>
        )}
      </div>
      {devices.length > 0 && (
        <div className="flex w-full max-w-sm flex-col gap-1">
          <label htmlFor="camera-select" className="text-xs font-medium text-muted-foreground">
            Camera
          </label>
          <select
            id="camera-select"
            value={deviceId ?? ""}
            onChange={(e) => {
              const id = e.target.value;
              setDeviceId(id);
              try {
                localStorage.setItem(STORAGE_KEY, id);
              } catch {
                /* ignore */
              }
              void start(id);
            }}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {devices.map((d, i) => (
              <option key={d.deviceId || i} value={d.deviceId}>
                {d.label || `Camera ${i + 1}`}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="flex gap-2">
        {!active ? (
          <button
            type="button"
            onClick={() => start(deviceId)}
            className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Start camera
          </button>
        ) : (
          <button
            type="button"
            onClick={capture}
            className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Take photo
          </button>
        )}
      </div>
    </div>
  );
}