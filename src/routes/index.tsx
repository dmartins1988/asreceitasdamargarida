import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { joinWaitlist, waitlistSchema } from "@/lib/waitlist.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lista de espera — Lançamento antecipado" },
      { name: "description", content: "Junta-te à lista de espera e garante acesso antecipado com condições especiais." },
      { property: "og:title", content: "Junta-te já à lista de espera" },
      { property: "og:description", content: "Acesso antecipado ao lançamento com condições especiais." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Field = "nome" | "email" | "telefone";
const fields: { id: Field; label: string; type: string; placeholder: string; auto: string }[] = [
  { id: "nome", label: "Nome", type: "text", placeholder: "Como te chamas?", auto: "name" },
  { id: "email", label: "Email", type: "email", placeholder: "tu@exemplo.com", auto: "email" },
  { id: "telefone", label: "Contacto telefónico", type: "tel", placeholder: "+351 912 345 678", auto: "tel" },
];

function Index() {
  const submit = useServerFn(joinWaitlist);
  const [values, setValues] = useState<Record<Field, string>>({ nome: "", email: "", telefone: "" });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [serverError, setServerError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (status === "loading" || status === "done") return;
    const parsed = waitlistSchema.safeParse(values);
    if (!parsed.success) {
      const errs: Partial<Record<Field, string>> = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as Field;
        if (!errs[k]) errs[k] = values[k].trim() ? issue.message : "Campo obrigatório";
      }
      setErrors(errs);
      return;
    }
    setErrors({});
    setStatus("loading");
    try {
      await submit({ data: parsed.data });
      setStatus("done");
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Algo correu mal.");
      setStatus("error");
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-background px-5 pt-8 pb-16 sm:pt-12 sm:pb-24">
      <div aria-hidden className="blob blob-a" />
      <div aria-hidden className="blob blob-b" />
      <div aria-hidden className="blob blob-c" />
      <span aria-hidden className="sparkle left-[6%] top-[4%] sm:left-[12%] sm:top-[14%]">✦</span>
      <span aria-hidden className="sparkle right-[6%] top-[3%] sm:right-[14%] sm:top-[26%] [animation-delay:1.2s]">✺</span>
      <span aria-hidden className="sparkle bottom-[12%] left-[18%] [animation-delay:2s]">✿</span>

      <div className="relative mx-auto flex max-w-xl sm:max-w-2xl flex-col items-center text-center">
        <span className="animate-rise mb-6 inline-flex items-center gap-2 rounded-full bg-card px-4 py-1.5 text-sm font-semibold text-foreground shadow-soft">
          <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
          Em breve · Vagas limitadas
        </span>
        <h1 className="animate-rise font-display text-4xl font-extrabold leading-[0.95] tracking-tight text-foreground sm:text-7xl [animation-delay:80ms]">
          JUNTA-TE JÁ À <span className="text-gradient">LISTA&nbsp;DE&nbsp;ESPERA</span>
        </h1>
        <p className="animate-rise mt-6 max-w-md text-lg text-muted-foreground [animation-delay:160ms]">
          Quem estiver na lista de espera terá acesso ao lançamento antecipado com condições especiais
        </p>

        <div className="animate-rise mt-10 w-full max-w-xl rounded-[2rem] border border-border bg-card p-6 text-left shadow-card sm:p-9 [animation-delay:240ms]">
          {status === "done" ? (
            <div className="py-8 text-center">
              <div className="animate-pop mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full bg-accent text-4xl">🎉</div>
              <h2 className="font-display text-2xl font-extrabold text-foreground">Já estás na lista!</h2>
              <p className="mt-2 text-muted-foreground">Serás dos primeiros a saber quando lançarmos.</p>
            </div>
          ) : (
            <form onSubmit={onSubmit} noValidate className="space-y-5">
              {fields.map((f) => (
                <div key={f.id}>
                  <label htmlFor={f.id} className="mb-2 block text-sm font-bold text-foreground">
                    {f.label}
                  </label>
                  <input
                    id={f.id}
                    type={f.type}
                    autoComplete={f.auto}
                    placeholder={f.placeholder}
                    value={values[f.id]}
                    aria-invalid={!!errors[f.id]}
                    onChange={(e) => {
                      setValues((v) => ({ ...v, [f.id]: e.target.value }));
                      if (errors[f.id]) setErrors((er) => ({ ...er, [f.id]: undefined }));
                    }}
                    className="field"
                  />
                  {errors[f.id] && <p className="mt-1.5 text-sm font-medium text-destructive">{errors[f.id]}</p>}
                </div>
              ))}
              {status === "error" && (
                <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">{serverError}</p>
              )}
              <button type="submit" disabled={status === "loading"} className="btn-hero">
                {status === "loading" ? "A enviar…" : "Submeter"}
                {status !== "loading" && <span className="transition-transform group-hover:translate-x-1">→</span>}
              </button>
              <p className="pt-1 text-center text-xs text-muted-foreground">
                🔒 Os teus dados serão utilizados apenas para te contactar relativamente a este lançamento.
              </p>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
