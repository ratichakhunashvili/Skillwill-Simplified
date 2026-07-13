// Server-only helpers for writing to the user's Google Drive + Sheet
// via the Lovable connector gateway.

const DRIVE_GW = "https://connector-gateway.lovable.dev/google_drive";
const SHEETS_GW = "https://connector-gateway.lovable.dev/google_sheets/v4";

export const DRIVE_PHOTOS_FOLDER_ID = "1Y5fIoaZqFwPGsTqhl7yMU0jEd5rs4j5u"; // ფოტოები
export const SHEET_ID = "1mcmSQMidz4Ad0HxeS5N4bKlQ7e6FKjxjXax7wAileYM"; // სახელები, გვარები.
export const SHEET_TAB = "Sheet1";

function driveHeaders(): HeadersInit {
  const lk = process.env.LOVABLE_API_KEY;
  const ck = process.env.GOOGLE_DRIVE_API_KEY;
  if (!lk || !ck) throw new Error("Google Drive connector not configured");
  return {
    Authorization: `Bearer ${lk}`,
    "X-Connection-Api-Key": ck,
  };
}

function sheetsHeaders(): HeadersInit {
  const lk = process.env.LOVABLE_API_KEY;
  const ck = process.env.GOOGLE_SHEETS_API_KEY;
  if (!lk || !ck) throw new Error("Google Sheets connector not configured");
  return {
    Authorization: `Bearer ${lk}`,
    "X-Connection-Api-Key": ck,
  };
}

export async function uploadPhotoToDrive(opts: {
  bytes: Uint8Array;
  contentType: string;
  filename: string;
}): Promise<{ id: string; webViewLink: string }> {
  const metadata = {
    name: opts.filename,
    parents: [DRIVE_PHOTOS_FOLDER_ID],
  };
  const boundary = "----lovable" + Math.random().toString(36).slice(2);
  const enc = new TextEncoder();
  const pre = enc.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${opts.contentType}\r\n\r\n`,
  );
  const post = enc.encode(`\r\n--${boundary}--`);
  const body = new Uint8Array(pre.length + opts.bytes.length + post.length);
  body.set(pre, 0);
  body.set(opts.bytes, pre.length);
  body.set(post, pre.length + opts.bytes.length);

  const res = await fetch(
    `${DRIVE_GW}/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink`,
    {
      method: "POST",
      headers: {
        ...driveHeaders(),
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Drive upload failed [${res.status}]: ${t}`);
  }
  return res.json();
}

async function ensureSheetHeaders(): Promise<void> {
  const res = await fetch(
    `${SHEETS_GW}/spreadsheets/${SHEET_ID}/values/${SHEET_TAB}!A1:F1`,
    { headers: sheetsHeaders() },
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Sheets read failed [${res.status}]: ${t}`);
  }
  const data = (await res.json()) as { values?: string[][] };
  if (data.values && data.values.length > 0) return;
  const put = await fetch(
    `${SHEETS_GW}/spreadsheets/${SHEET_ID}/values/${SHEET_TAB}!A1:F1?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: { ...sheetsHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        values: [["#", "სახელი", "გვარი", "Email", "თარიღი", "ფოტოს ლინკი"]],
      }),
    },
  );
  if (!put.ok) {
    const t = await put.text();
    throw new Error(`Sheets header write failed [${put.status}]: ${t}`);
  }
}

export async function appendPersonRow(row: {
  number: string;
  firstName: string;
  lastName: string;
  email: string;
  photoLink: string;
}): Promise<void> {
  await ensureSheetHeaders();
  const res = await fetch(
    `${SHEETS_GW}/spreadsheets/${SHEET_ID}/values/${SHEET_TAB}!A:F:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      headers: { ...sheetsHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        values: [[
          row.number,
          row.firstName,
          row.lastName,
          row.email,
          new Date().toISOString(),
          row.photoLink,
        ]],
      }),
    },
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Sheets append failed [${res.status}]: ${t}`);
  }
}

export function safeDriveFilename(
  number: string,
  first: string,
  last: string,
  ext: string,
): string {
  const clean = (s: string) => s.replace(/[\\/:*?"<>|]/g, "").trim();
  return `${number} - ${clean(first)} ${clean(last)}.${ext}`;
}