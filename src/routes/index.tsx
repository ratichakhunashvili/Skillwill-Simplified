import { useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { CameraCapture } from "@/components/CameraCapture";
import { createPerson } from "@/lib/people.functions";

export const Route = createFileRoute("/")({
  component: CapturePage,
});

function CapturePage() {
  const [photo, setPhoto] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [cameraKey, setCameraKey] = useState(0);
  const router = useRouter();

  const createFn = useServerFn(createPerson);
  const mutation = useMutation({
    mutationFn: (data: {
      firstName: string;
      lastName: string;
      email: string;
      photoDataUrl: string;
    }) => createFn({ data }),
    onSuccess: () => {
      toast.success("Person saved");
      setPhoto(null);
      setFirstName("");
      setLastName("");
      setEmail("");
      setCameraKey((k) => k + 1);
      router.invalidate();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Could not save");
    },
  });

  const canSave =
    !!photo && firstName.trim().length > 0 && lastName.trim().length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!photo || !canSave) return;
    mutation.mutate({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      photoDataUrl: photo,
    });
  };

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">New person</h1>
            <p className="text-sm text-muted-foreground">
              Take a portrait, fill in the name, and save.
            </p>
          </div>
          <Link
            to="/people"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
          >
            View all people
          </Link>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            {photo ? (
              <div className="flex flex-col items-center gap-3">
                <div className="overflow-hidden rounded-2xl border border-border shadow-sm aspect-[3/4] w-full max-w-sm bg-muted">
                  <img
                    src={photo}
                    alt="Captured portrait"
                    className="h-full w-full object-cover"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPhoto(null);
                    setCameraKey((k) => k + 1);
                  }}
                  className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
                >
                  Retake
                </button>
              </div>
            ) : (
              <CameraCapture key={cameraKey} onCapture={setPhoto} />
            )}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="firstName" className="text-sm font-medium">
                First name
              </label>
              <input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                maxLength={100}
                required
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="lastName" className="text-sm font-medium">
                Last name
              </label>
              <input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                maxLength={100}
                required
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-sm font-medium">
                Email <span className="text-muted-foreground">(optional)</span>
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={255}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={!canSave || mutation.isPending}
              className="mt-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {mutation.isPending
                ? "Saving…"
                : !photo
                  ? "Take a photo first"
                  : "Save & next"}
            </button>
            {!photo && (
              <p className="text-xs text-muted-foreground">
                The camera will re-open automatically after saving.
              </p>
            )}
          </form>
        </div>
      </div>
    </main>
  );
}