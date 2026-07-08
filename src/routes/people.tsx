import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { listPeople, deletePerson } from "@/lib/people.functions";

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
                <div className="aspect-[3/4] w-full bg-muted">
                  {p.photoUrl && (
                    <img
                      src={p.photoUrl}
                      alt={`${p.firstName} ${p.lastName}`}
                      className="h-full w-full object-cover"
                    />
                  )}
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
                    <Link
                      to="/people/$id"
                      params={{ id: p.id }}
                      className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-center text-xs font-medium hover:bg-accent"
                    >
                      Edit
                    </Link>
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
    </main>
  );
}