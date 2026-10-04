import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Google Sheet "Lista de Espera" (tab "Inscricoes"). Change this ID to use another sheet.
const SPREADSHEET_ID = "1v62JSfmWWqg9SvYM3UO8UFyWBL2K1ssf7GToe6oGntg";
const RANGE = "Inscricoes!A:D";
const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_sheets/v4";

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
    const lovableKey = process.env["LOVABLE_API_KEY"];
    const sheetsKey = process.env["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"];
    if (!lovableKey || !sheetsKey) throw new Error("Google Sheets não está configurado");

    const timestamp = new Date().toLocaleString("pt-PT", { timeZone: "Europe/Lisbon" });
    const res = await fetch(
      `${GATEWAY_URL}/spreadsheets/${SPREADSHEET_ID}/values/${RANGE}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": sheetsKey,
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
