import { useState } from "react";
import {
  createFileRoute,
  Link,
  useRouter,
  useNavigate,
} from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { CameraCapture } from "@/components/CameraCapture";
import { getPerson, updatePerson } from "@/lib/people.functions";

const personQuery = (id: string) =>
  queryOptions({
    queryKey: ["person", id],
    queryFn: () => getPerson({ data: { id } }),
  });

export const Route = createFileRoute("/people/$id")({
  head: () => ({
    meta: [
      { title: "Edit person — Registry" },
      { name: "description", content: "Edit a person's name, email, or photo." },
    ],
  }),
  loader: ({ params, context }) =>
    context.queryClient.ensureQueryData(personQuery(params.id)),
  component: EditPersonPage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-sm text-destructive">
      {error.message}
    </div>
  ),
  notFoundComponent: () => (
    <div className="p-8 text-center text-sm">Person not found.</div>
  ),
});

function EditPersonPage() {
  const { id } = Route.useParams();
  const { data: person } = useSuspenseQuery(personQuery(id));
  const router = useRouter();
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState(person.firstName);
  const [lastName, setLastName] = useState(person.lastName);
  const [email, setEmail] = useState(person.email ?? "");
  const [newPhoto, setNewPhoto] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraKey, setCameraKey] = useState(0);
  const [saving, setSaving] = useState(false);

  const updateFn = useServerFn(updatePerson);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return;
    setSaving(true);
    try {
      await updateFn({
        data: {
          id,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          ...(newPhoto ? { photoDataUrl: newPhoto } : {}),
        },
      });
      toast.success("Saved");
      await router.invalidate();
      navigate({ to: "/people" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Edit person</h1>
          <Link
            to="/people"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
          >
            Back
          </Link>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="flex flex-col items-center gap-3">
            {showCamera && !newPhoto ? (
              <CameraCapture
                key={cameraKey}
                onCapture={(url) => {
                  setNewPhoto(url);
                  setShowCamera(false);
                }}
              />
            ) : (
              <>
                <div className="overflow-hidden rounded-2xl border border-border shadow-sm aspect-[3/4] w-full max-w-sm bg-muted">
                  <img
                    src={newPhoto ?? person.photoUrl}
                    alt={`${person.firstName} ${person.lastName}`}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="flex gap-2">
                  {newPhoto ? (
                    <button
                      type="button"
                      onClick={() => {
                        setNewPhoto(null);
                        setShowCamera(true);
                        setCameraKey((k) => k + 1);
                      }}
                      className="rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
                    >
                      Retake
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setShowCamera(true);
                        setCameraKey((k) => k + 1);
                      }}
                      className="rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
                    >
                      Retake photo
                    </button>
                  )}
                  {newPhoto && (
                    <button
                      type="button"
                      onClick={() => setNewPhoto(null)}
                      className="rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
                    >
                      Keep original
                    </button>
                  )}
                </div>
              </>
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
              disabled={saving}
              className="mt-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}