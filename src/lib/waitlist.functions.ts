import { createServerFn } from "@tanstack/react-start";
import { createSign } from "node:crypto";
import { z } from "zod";

// Google Sheet "Lista de Espera" (tab "Inscricoes"). Change this ID to use another sheet.
const SPREADSHEET_ID = "1v62JSfmWWqg9SvYM3UO8UFyWBL2K1ssf7GToe6oGntg";
const RANGE = "Inscricoes!A:D";
const SHEETS_API_URL = "https://sheets.googleapis.com/v4";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

export const waitlistSchema = z.object({
  nome: z.string().trim().min(1, "Indica o teu nome").max(100),
  email: z.string().trim().email("Email inválido").max(255),
  telefone: z
    .string()
    .trim()
    .min(6, "Contacto inválido")
    .max(30)
    .regex(/^[+\d\s()-]+$/, "Contacto inválido"),
});

function base64url(input: string): string {
  return Buffer.from(input).toString("base64url");
}

// Service-account JWT Bearer flow (RFC 7523): plain API keys can't authorize
// writes to Sheets, so we sign our own token instead of a full OAuth consent flow.
async function getAccessToken(clientEmail: string, privateKey: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: clientEmail,
      scope: SHEETS_SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );
  const signInput = `${header}.${claims}`;
  const signature = createSign("RSA-SHA256")
    .update(signInput)
    .sign(privateKey)
    .toString("base64url");
  const jwt = `${signInput}.${signature}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OAuth token request failed [${res.status}]: ${body}`);
  }
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

export const joinWaitlist = createServerFn({ method: "POST" })
  .inputValidator((data) => waitlistSchema.parse(data))
  .handler(async ({ data }) => {
    const clientEmail = process.env["GOOGLE_SERVICE_ACCOUNT_EMAIL"];
    const privateKeyRaw = process.env["GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY"];
    if (!clientEmail || !privateKeyRaw) throw new Error("Google Sheets não está configurado");
    const privateKey = privateKeyRaw.replace(/\\n/g, "\n");

    let accessToken: string;
    try {
      accessToken = await getAccessToken(clientEmail, privateKey);
    } catch (error) {
      console.error("Sheets auth failed:", error);
      throw new Error("Não foi possível guardar. Tenta novamente.");
    }

    const timestamp = new Date().toLocaleString("pt-PT", { timeZone: "Europe/Lisbon" });
    const res = await fetch(
      `${SHEETS_API_URL}/spreadsheets/${SPREADSHEET_ID}/values/${RANGE}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ values: [[timestamp, data.nome, data.email, data.telefone]] }),
      },
    );
    if (!res.ok) {
      const body = await res.text();
      console.error(`Sheets append failed [${res.status}]: ${body}`);
      throw new Error("Não foi possível guardar. Tenta novamente.");
    }
    return { ok: true };
  });
