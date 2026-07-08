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

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setActive(false);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setActive(true);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not access the camera. Please allow camera permission.",
      );
    }
  }, []);

  useEffect(() => {
    if (autoStart) void start();
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
      <div className="flex gap-2">
        {!active ? (
          <button
            type="button"
            onClick={start}
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