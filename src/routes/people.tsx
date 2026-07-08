import { useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Download } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { CameraCapture } from "@/components/CameraCapture";
import {
  listPeople,
  deletePerson,
  updatePerson,
  type PersonDTO,
} from "@/lib/people.functions";

const peopleQuery = queryOptions({
  queryKey: ["people"],
  queryFn: () => listPeople(),
});

export const Route = createFileRoute("/people")({
  head: () => ({
    meta: [
      { title: "All People — Registry" },
      {
        name: "description",
        content: "All registered people, shown as ID-card portraits.",
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(peopleQuery),
  component: PeoplePage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-sm text-destructive">
      {error.message}
    </div>
  ),
  notFoundComponent: () => (
    <div className="p-8 text-center text-sm">No people found.</div>
  ),
});

function PeoplePage() {
  const { data: people } = useSuspenseQuery(peopleQuery);
  const router = useRouter();
  const deleteFn = useServerFn(deletePerson);
  const [editing, setEditing] = useState<PersonDTO | null>(null);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remove ${name}? This cannot be undone.`)) return;
    try {
      await deleteFn({ data: { id } });
      toast.success("Removed");
      router.invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove");
    }
  };

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">People</h1>
            <p className="text-sm text-muted-foreground">
              {people.length}{" "}
              {people.length === 1 ? "person" : "people"} registered
            </p>
          </div>
          <Link
            to="/"
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            + Add person
          </Link>
        </header>

        {people.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
            No one here yet. Add the first person from the home page.
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {people.map((p) => (
              <li
                key={p.id}
                className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm"
              >
                <div className="relative aspect-[3/4] w-full bg-muted">
                  {p.photoUrl && (
                    <img
                      src={p.photoUrl}
                      alt={`${p.firstName} ${p.lastName}`}
                      className="h-full w-full object-cover"
                    />
                  )}
                  <a
                    href={p.downloadUrl}
                    className="absolute right-2 top-2 rounded-full bg-background/90 p-1.5 text-foreground shadow hover:bg-background"
                    title="Download photo"
                    aria-label="Download photo"
                  >
                    <Download className="h-4 w-4" />
                  </a>
                </div>
                <div className="flex flex-col gap-1 p-3">
                  <div className="text-sm font-semibold leading-tight">
                    {p.firstName} {p.lastName}
                  </div>
                  {p.email && (
                    <div className="truncate text-xs text-muted-foreground">
                      {p.email}
                    </div>
                  )}
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditing(p)}
                      className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-center text-xs font-medium hover:bg-accent"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleDelete(p.id, `${p.firstName} ${p.lastName}`)
                      }
                      className="rounded-md border border-input bg-background px-2 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <EditDialog
        person={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          router.invalidate();
        }}
      />
    </main>
  );
}

function EditDialog({
  person,
  onClose,
  onSaved,
}: {
  person: PersonDTO | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const updateFn = useServerFn(updatePerson);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [newPhoto, setNewPhoto] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraKey, setCameraKey] = useState(0);
  const [saving, setSaving] = useState(false);

  const open = person !== null;

  // Reset form each time a different person is opened
  const [lastId, setLastId] = useState<string | null>(null);
  if (person && person.id !== lastId) {
    setLastId(person.id);
    setFirstName(person.firstName);
    setLastName(person.lastName);
    setEmail(person.email ?? "");
    setNewPhoto(null);
    setShowCamera(false);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!person) return;
    if (!firstName.trim() || !lastName.trim()) return;
    setSaving(true);
    try {
      await updateFn({
        data: {
          id: person.id,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          ...(newPhoto ? { photoDataUrl: newPhoto } : {}),
        },
      });
      toast.success("Saved");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit person</DialogTitle>
        </DialogHeader>
        {person && (
          <form onSubmit={handleSubmit} className="grid gap-5 md:grid-cols-2">
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
                  <div className="aspect-[3/4] w-full max-w-[220px] overflow-hidden rounded-xl border border-border bg-muted">
                    <img
                      src={newPhoto ?? person.photoUrl}
                      alt={`${person.firstName} ${person.lastName}`}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setNewPhoto(null);
                        setShowCamera(true);
                        setCameraKey((k) => k + 1);
                      }}
                      className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
                    >
                      Retake photo
                    </button>
                    {newPhoto && (
                      <button
                        type="button"
                        onClick={() => setNewPhoto(null)}
                        className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
                      >
                        Keep original
                      </button>
                    )}
                    <a
                      href={person.downloadUrl}
                      className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
                    >
                      Download
                    </a>
                  </div>
                </>
              )}
            </div>

            <div className="flex flex-col gap-3">
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
                  Email{" "}
                  <span className="text-muted-foreground">(optional)</span>
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
            </div>

            <DialogFooter className="md:col-span-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}