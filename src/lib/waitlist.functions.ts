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
  const signature = createSign("RSA-SHA256").update(signInput).sign(privateKey).toString("base64url");
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
    const clientEmail = process.env["receitas-da-margarida@asreceitasdamargarida.iam.gserviceaccount.com"];
    const privateKeyRaw = process.env["-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCuoEEkHuPbWDGU\nN7SElPbQ1pou2j6XBgZDtJkaLd0mfnxDx1eARYs3U071nkpFE0fJ54F7J7Yvo/Pj\nCFap/+sDlTXGMQmSfAsgfwSKiurMfpVU9qoaXcb9ES+U84EM1gcmcPbMQZsYO9E5\nvH5JIITTdWk2iMEoZganpF+zmL5x3VN4YSqEHiVBP2y2LQkgh3ncEiQfxyemiW6v\nTjkU/Qc5e1xh482KqfYBKsvdWPQEmCnhqGNisn6zXzPkJTW2UN8gMWG60keVtHRP\nMPegSWXwBLSyAtj0yhPmv0/IdY9SCC5d0v+H7IVH/YA8CkjqwPxsVpWFxICPSQqV\nKsCXXFxfAgMBAAECggEAO2J2JKF4nWw1mBEFi5zY/pYsYsiHRnafBMFS24tDTMbw\n3V/aCt4bhNoI3RBSc4EmBax75PTRSQw5cTixuCg2tMY2PksI1U7nvcpUMgUh6h8W\nC4nCuSqw8/i3NLFGbqYOUm1SEI4y/x/AfCD01UuAwCSKfigtf96KXtJQVVQZV8D7\nxf24mhBRBgy9O/T5o1CG6oBAgI4Dyt687km37O/bIb4w1dKmUGbsU7AClImch5kW\na08WLO4Xg9HO8myU3DjwOl4mrFAvzydvDgEZI7/OtgttHJwjl6a4TEoQNUTpkFFC\nwQ/rRnTuo6xuA4bPpKZp9bvbpMbZ4AZq3Mc9OI5e+QKBgQDUnD215esG/UGU0XxU\nevW4mCMhHvtERjEZnUJds/PemVw3tMr6STrSXS2d+Otk51iRvytqx+LxKzXJy7VJ\nrbXlKUOlcdmLg2YhE60nRss9SVhybWBd39GpTcNRJvfIamIpK02q6hwCXr+H6fnJ\njxTPz1Vg1SYAd+9+3/9PF+md5QKBgQDSQ4jRNpec3aNQmN2H24UGdbbapzf46jYs\ndyG2nVqeyriwOcc8I226wAvypmj5o0cJjzyYWPeLNm52avY1JcWe5VyFwNLT5vEK\nbQgRZkQ0Oy40Oy2sDST8EwBgdSnYz0miKCnqvaz7gzfRGykxCah92CC+U1fLGX6R\nbPy9OxXM8wKBgEjqPI/BhlUjTfaH0af3c4YXRxT41xuXJwet0zDnol9ZITNJocMs\nkivLIPXohHJalRmHApDgdIhZVV0bq9TU6mjpOfXnkcAzFDeL0/qAYPtnyBmWQVJw\njCsQLEgMoTXupjOQUlana2u0quMl7zCdDXonlRRchWfrugs9LwYlIU2xAoGATvGo\nRtS2a+ETVklus3mKInjD5Khv7XcSS/OWptfBlGkMmq22zi+HHVzJn5s3QrM5Eq/C\n0nhkyNHw+2kBc8bwwc3fxSA2h/Tnf0CcjNvWs72chWPKrBRrVHFV7OFQiuSZAtcN\nleMNNYl4xXvrJUw5BLbG5G6qQckaqkM/SVULxF0CgYB/hGOAvny7Ch13rUtHtt/F\n15ytLxj43kvxA0/Yn1HmxdLRsSsdshCcsRtB1/ZRjDiwkShDu39HRHEzYg5kL8Xs\nRyBqaeyj52eZNFLhWOzEbt5oqC6rC1NcdeJ8v7MvLUmBVC7Zhmfex19s/oALlwPb\nWivONtH+P0OTAg6h5KSzKw==\n-----END PRIVATE KEY-----\n"];
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
