import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

function serverClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        storage: undefined,
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

const BUCKET = "people-photos";
const SIGN_TTL = 60 * 60 * 24 * 365; // 1 year

export type PersonDTO = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  photoUrl: string;
  downloadUrl: string;
  photoPath: string;
  createdAt: string;
};

async function signPhoto(
  supabase: ReturnType<typeof serverClient>,
  path: string,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGN_TTL);
  if (error || !data) return "";
  return data.signedUrl;
}

async function signDownload(
  supabase: ReturnType<typeof serverClient>,
  path: string,
  filename: string,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGN_TTL, { download: filename });
  if (error || !data) return "";
  return data.signedUrl;
}

function safeFilename(first: string, last: string, path: string): string {
  const ext = path.split(".").pop() || "jpg";
  const base = `${first}_${last}`.replace(/[^a-zA-Z0-9_-]+/g, "_");
  return `${base || "photo"}.${ext}`;
}

function decodeDataUrl(dataUrl: string): {
  bytes: Uint8Array;
  contentType: string;
  ext: string;
} {
  const match = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("Invalid image data");
  const contentType = match[1];
  const b64 = match[2];
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const ext =
    contentType === "image/png"
      ? "png"
      : contentType === "image/webp"
        ? "webp"
        : "jpg";
  return { bytes, contentType, ext };
}

export const listPeople = createServerFn({ method: "GET" }).handler(
  async (): Promise<PersonDTO[]> => {
    const supabase = serverClient();
    const { data, error } = await supabase
      .from("people")
      .select("id, first_name, last_name, email, photo_path, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return Promise.all(
      (data ?? []).map(async (row) => ({
        id: row.id,
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        photoUrl: await signPhoto(supabase, row.photo_path),
        downloadUrl: await signDownload(
          supabase,
          row.photo_path,
          safeFilename(row.first_name, row.last_name, row.photo_path),
        ),
        photoPath: row.photo_path,
        createdAt: row.created_at,
      })),
    );
  },
);

export const getPerson = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }): Promise<PersonDTO> => {
    const supabase = serverClient();
    const { data: row, error } = await supabase
      .from("people")
      .select("id, first_name, last_name, email, photo_path, created_at")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Person not found");
    return {
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      photoUrl: await signPhoto(supabase, row.photo_path),
      downloadUrl: await signDownload(
        supabase,
        row.photo_path,
        safeFilename(row.first_name, row.last_name, row.photo_path),
      ),
      photoPath: row.photo_path,
      createdAt: row.created_at,
    };
  });

const personInputSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z
    .string()
    .trim()
    .max(255)
    .email()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  photoDataUrl: z.string().startsWith("data:image/"),
});

export const createPerson = createServerFn({ method: "POST" })
  .inputValidator((d) => personInputSchema.parse(d))
  .handler(async ({ data }): Promise<{ id: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { bytes, contentType, ext } = decodeDataUrl(data.photoDataUrl);
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType, upsert: false });
    if (upErr) throw new Error(upErr.message);
    const { data: inserted, error } = await supabaseAdmin
      .from("people")
      .insert({
        first_name: data.firstName,
        last_name: data.lastName,
        email: data.email ?? null,
        photo_path: path,
      })
      .select("id")
      .single();
    if (error) {
      await supabaseAdmin.storage.from(BUCKET).remove([path]);
      throw new Error(error.message);
    }
    return { id: inserted.id };
  });

const updateSchema = z.object({
  id: z.string().uuid(),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z
    .string()
    .trim()
    .max(255)
    .email()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  photoDataUrl: z
    .string()
    .startsWith("data:image/")
    .optional(),
});

export const updatePerson = createServerFn({ method: "POST" })
  .inputValidator((d) => updateSchema.parse(d))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from("people")
      .select("photo_path")
      .eq("id", data.id)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!existing) throw new Error("Person not found");

    let newPath: string | null = null;
    if (data.photoDataUrl) {
      const { bytes, contentType, ext } = decodeDataUrl(data.photoDataUrl);
      newPath = `${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(newPath, bytes, { contentType, upsert: false });
      if (upErr) throw new Error(upErr.message);
    }

    const { error } = await supabaseAdmin
      .from("people")
      .update({
        first_name: data.firstName,
        last_name: data.lastName,
        email: data.email ?? null,
        ...(newPath ? { photo_path: newPath } : {}),
      })
      .eq("id", data.id);
    if (error) {
      if (newPath) await supabaseAdmin.storage.from(BUCKET).remove([newPath]);
      throw new Error(error.message);
    }

    if (newPath && existing.photo_path) {
      await supabaseAdmin.storage.from(BUCKET).remove([existing.photo_path]);
    }
    return { ok: true };
  });

export const deletePerson = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("people")
      .select("photo_path")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await supabaseAdmin.from("people").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    if (existing?.photo_path) {
      await supabaseAdmin.storage.from(BUCKET).remove([existing.photo_path]);
    }
    return { ok: true };
  });