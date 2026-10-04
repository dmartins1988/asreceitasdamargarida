import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Google Sheet "Lista de Espera" (tab "Inscricoes"). Change this ID to use another sheet.
const SPREADSHEET_ID = "1v62JSfmWWqg9SvYM3UO8UFyWBL2K1ssf7GToe6oGntg";
const RANGE = "Inscricoes!A:D";
const SHEETS_API_URL = "https://sheets.googleapis.com/v4";

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

export const joinWaitlist = createServerFn({ method: "POST" })
  .inputValidator((data) => waitlistSchema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env["GOOGLE_SHEETS_API_KEY"];
    if (!apiKey) throw new Error("Google Sheets não está configurado");

    const timestamp = new Date().toLocaleString("pt-PT", { timeZone: "Europe/Lisbon" });
    const res = await fetch(
      `${SHEETS_API_URL}/spreadsheets/${SPREADSHEET_ID}/values/${RANGE}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS&key=${apiKey}`,
      {
        method: "POST",
        headers: {
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
