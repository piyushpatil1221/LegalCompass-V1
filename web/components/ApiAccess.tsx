"use client";

import { useEffect, useState } from "react";
import { API_BASE, API_KEY } from "@/lib/api";

const WRAP = "mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-10";
const NARRATIVE = "On 12 March 2025 someone called pretending to be from my bank and I lost Rs 45,000 through UPI.";

type Endpoint = {
  id: string;
  method: "GET" | "POST";
  path: string;
  desc: string;
  query?: string;                    // editable query string, e.g. "q=IPC 420"
  body?: Record<string, unknown>;    // JSON body
  file?: boolean;                    // multipart upload
  binary?: boolean;                  // response is a .docx file
  open?: boolean;                    // no key needed
};

const ENDPOINTS: Endpoint[] = [
  { id: "lookup", method: "GET", path: "/api/lookup", query: "q=IPC 420",
    desc: "Convert a section between old and new codes: IPC↔BNS, CrPC↔BNSS, IEA↔BSA. Accepts 420, IPC 302, BNS 103(1), CrPC 154, IEA 65B." },
  { id: "applicable-law", method: "GET", path: "/api/applicable-law", query: "date=2025-03-12&lang=en",
    desc: "Which penal code applies to an offence on a date (IPC before 1 July 2024, BNS on or after)." },
  { id: "analyze", method: "POST", path: "/api/analyze", body: { narrative: NARRATIVE, answers: {}, finalize: true, lang: "en" },
    desc: "Full analysis of an incident description: facts, applicable code, sections with old/new counterparts, next steps, masked lawyer summary." },
  { id: "document-text", method: "POST", path: "/api/document-text",
    body: { text: "FIR registered under section 420 IPC and 120B IPC on 3 May 2023 at Pune.", lang: "en" },
    desc: "Find old citations in plain text (e.g. an FIR) and convert them to the new codes." },
  { id: "document", method: "POST", path: "/api/document", query: "lang=en", file: true,
    desc: "Upload an FIR / charge-sheet / complaint (PDF, DOCX, TXT) and convert its citations. Max one file per request." },
  { id: "complaint", method: "POST", path: "/api/complaint", body: { narrative: NARRATIVE, answers: {}, kind: "fir" }, binary: true,
    desc: "Download a .docx complaint draft. kind = fir (police station), sp (Superintendent of Police) or magistrate." },
  { id: "status", method: "GET", path: "/api/status", desc: "Service status: mapping API reachable, optional models, number of offence types." },
  { id: "health", method: "GET", path: "/health", open: true, desc: "Liveness check. No API key needed." },
];

/** Python literal for a JSON value (True/False/None instead of true/false/null). */
function py(v: unknown, ind = ""): string {
  if (v === null || v === undefined) return "None";
  if (typeof v === "boolean") return v ? "True" : "False";
  if (typeof v === "number" || typeof v === "string") return JSON.stringify(v);
  const next = ind + "    ";
  if (Array.isArray(v)) return v.length ? `[\n${v.map((x) => next + py(x, next)).join(",\n")}\n${ind}]` : "[]";
  const e = Object.entries(v as Record<string, unknown>);
  return e.length ? `{\n${e.map(([k, x]) => `${next}${JSON.stringify(k)}: ${py(x, next)}`).join(",\n")}\n${ind}}` : "{}";
}

function params(q?: string): Record<string, string> {
  return q ? Object.fromEntries(new URLSearchParams(q)) : {};
}

function fullUrl(base: string, ep: Endpoint, q = ep.query): string {
  const qs = q ? new URLSearchParams(q).toString() : "";
  return `${base}${ep.path}${qs ? `?${qs}` : ""}`;
}

function examples(ep: Endpoint, base: string, key: string): Record<"curl" | "python" | "javascript", string> {
  const url = fullUrl(base, ep);
  const plain = `${base}${ep.path}`;
  const p = params(ep.query);
  const hasParams = Object.keys(p).length > 0;
  const json = ep.body ? JSON.stringify(ep.body, null, 2) : "";

  const curl = [`curl${ep.method === "POST" ? " -X POST" : ""} "${url}"`];
  if (!ep.open) curl.push(`-H "x-api-key: ${key}"`);
  if (ep.body) curl.push(`-H "Content-Type: application/json"`, `-d '${JSON.stringify(ep.body)}'`);
  if (ep.file) curl.push(`-F "file=@fir.pdf"`);
  if (ep.binary) curl.push(`-o legalcompass-draft.docx`);

  const pyArgs = [`"${plain}"`];
  if (hasParams) pyArgs.push(`params=${py(p, "    ")}`);
  if (ep.body) pyArgs.push(`json=${py(ep.body, "    ")}`);
  if (ep.file) pyArgs.push(`files={"file": open("fir.pdf", "rb")}`);
  if (!ep.open) pyArgs.push(`headers={"x-api-key": API_KEY}`);
  const python = [
    "import requests", "",
    ...(ep.open ? [] : [`API_KEY = "${key}"`, ""]),
    `r = requests.${ep.method.toLowerCase()}(\n    ${pyArgs.join(",\n    ")},\n)`,
    "r.raise_for_status()",
    ep.binary ? `open("legalcompass-draft.docx", "wb").write(r.content)` : "print(r.json())",
  ].join("\n");

  const headers = [...(ep.open ? [] : [`"x-api-key": API_KEY`]), ...(ep.body ? [`"Content-Type": "application/json"`] : [])];
  const opts = [
    ...(ep.method === "POST" ? [`method: "POST"`] : []),
    ...(headers.length ? [`headers: { ${headers.join(", ")} }`] : []),
    ...(ep.body ? [`body: JSON.stringify(${json.replace(/\n/g, "\n  ")})`] : []),
    ...(ep.file ? ["body: form"] : []),
  ];
  const javascript = [
    ...(ep.open ? [] : [`const API_KEY = "${key}";`, ""]),
    ...(ep.file ? [`const form = new FormData();`, `form.append("file", fileInput.files[0]); // an <input type="file">`, ""] : []),
    `const r = await fetch("${url}"${opts.length ? `, {\n  ${opts.join(",\n  ")},\n}` : ""});`,
    `if (!r.ok) throw new Error(\`HTTP \${r.status}\`);`,
    ep.binary ? "const blob = await r.blob(); // .docx file" : "console.log(await r.json());",
  ].join("\n");

  return { curl: curl.join(" \\\n  "), python, javascript };
}

function Logo() {
  return (
    <svg aria-hidden="true" viewBox="0 0 40 40" className="h-9 w-9 shrink-0">
      <circle cx="20" cy="20" r="18" fill="#14213d" />
      <circle cx="20" cy="20" r="13" fill="none" stroke="#9aabc7" strokeWidth="1" />
      <path d="M20 6 L24 20 L20 34 L16 20 Z" fill="#f2a93b" />
    </svg>
  );
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* clipboard blocked */ }
  };
  return (
    <button type="button" onClick={copy} className="shrink-0 rounded-lg bg-mist px-3 py-1.5 text-xs font-semibold text-ink-2 hover:bg-sky hover:text-white">
      {done ? "Copied ✓" : label}
    </button>
  );
}

function MethodBadge({ m }: { m: string }) {
  return <span className={`rounded-md px-2 py-0.5 font-mono text-xs font-bold ${m === "GET" ? "bg-ok/10 text-ok" : "bg-amber-soft text-warn"}`}>{m}</span>;
}

function Field({ label, value, copy = true }: { label: string; value: string; copy?: boolean }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <code className="min-w-0 flex-1 break-all rounded-lg bg-mist px-3 py-2 font-mono text-sm text-ink">{value}</code>
        {copy && <CopyButton text={value} />}
      </div>
    </div>
  );
}

type Result = { status: number; ms: number; url: string; body: string };

function TryIt({ base }: { base: string }) {
  const [id, setId] = useState(ENDPOINTS[0].id);
  const ep = ENDPOINTS.find((e) => e.id === id)!;
  const [query, setQuery] = useState(ep.query ?? "");
  const [body, setBody] = useState(ep.body ? JSON.stringify(ep.body, null, 2) : "");
  const [file, setFile] = useState<File | null>(null);
  const [key, setKey] = useState(API_KEY);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Result | null>(null);
  const [err, setErr] = useState("");

  const pick = (next: string) => {
    const e = ENDPOINTS.find((x) => x.id === next)!;
    setId(next); setQuery(e.query ?? ""); setBody(e.body ? JSON.stringify(e.body, null, 2) : ""); setFile(null); setRes(null); setErr("");
  };

  const send = async () => {
    setErr(""); setRes(null);
    let payload: BodyInit | undefined;
    const headers: Record<string, string> = key.trim() && !ep.open ? { "x-api-key": key.trim() } : {};
    if (ep.body) {
      try { payload = JSON.stringify(JSON.parse(body)); } catch { setErr("The request body is not valid JSON."); return; }
      headers["Content-Type"] = "application/json";
    }
    if (ep.file) {
      if (!file) { setErr("Choose a PDF, DOCX or TXT file first."); return; }
      const fd = new FormData(); fd.append("file", file); payload = fd;
    }
    const url = fullUrl(base, ep, query);
    setBusy(true);
    const t0 = performance.now();
    try {
      const r = await fetch(url, { method: ep.method, headers, body: payload });
      const ms = Math.round(performance.now() - t0);
      const type = r.headers.get("content-type") || "";
      let text: string;
      if (type.includes("json")) text = JSON.stringify(await r.json(), null, 2);
      else if (type.includes("openxml")) text = `(binary .docx file, ${(await r.blob()).size.toLocaleString()} bytes — use the curl/Python example to save it)`;
      else text = await r.text();
      setRes({ status: r.status, ms, url, body: text });
    } catch (e) {
      setErr(`Request failed: ${e instanceof Error ? e.message : String(e)}. Is the backend running?`);
    } finally { setBusy(false); }
  };

  const ok = res && res.status < 300;
  return (
    <section aria-labelledby="try-h" className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink/5 sm:p-6">
      <h2 id="try-h" className="font-display text-2xl text-ink">Try it</h2>
      <p className="mt-1 text-sm text-slate">Paste an API key, call an endpoint from your browser and see the JSON response. Clear the key or paste a wrong one to see the 401 error.</p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <label className="block">
            <span className="text-sm font-semibold text-ink">API key <span className="font-normal text-slate">(sent as x-api-key)</span></span>
            <div className="mt-1 flex gap-2">
              <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="Paste your API key" spellCheck={false} autoComplete="off"
                className="min-w-0 flex-1 rounded-lg border border-ink/15 bg-white px-3 py-2 font-mono text-sm text-ink placeholder:text-slate/60 focus:border-sky focus:outline-none" />
              {key !== API_KEY && (
                <button type="button" onClick={() => setKey(API_KEY)}
                  className="shrink-0 rounded-lg bg-mist px-3 py-2 text-xs font-semibold text-ink-2 hover:bg-sky hover:text-white">Reset</button>
              )}
            </div>
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-ink">Endpoint</span>
            <select value={id} onChange={(e) => pick(e.target.value)}
              className="mt-1 w-full rounded-lg border border-ink/15 bg-white px-3 py-2 font-mono text-sm text-ink focus:border-sky focus:outline-none">
              {ENDPOINTS.map((e) => <option key={e.id} value={e.id}>{e.method} {e.path}</option>)}
            </select>
          </label>
          <p className="text-xs text-slate">{ep.desc}</p>
          {ep.query !== undefined && (
            <label className="block">
              <span className="text-sm font-semibold text-ink">Query parameters</span>
              <input value={query} onChange={(e) => setQuery(e.target.value)} spellCheck={false}
                className="mt-1 w-full rounded-lg border border-ink/15 bg-white px-3 py-2 font-mono text-sm text-ink focus:border-sky focus:outline-none" />
            </label>
          )}
          {ep.body && (
            <label className="block">
              <span className="text-sm font-semibold text-ink">JSON body</span>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} spellCheck={false}
                className="mt-1 w-full rounded-lg border border-ink/15 bg-white px-3 py-2 font-mono text-xs text-ink focus:border-sky focus:outline-none" />
            </label>
          )}
          {ep.file && (
            <label className="block">
              <span className="text-sm font-semibold text-ink">File</span>
              <input type="file" accept=".pdf,.docx,.txt" onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="mt-1 block w-full text-sm text-ink file:mr-3 file:rounded-lg file:border-0 file:bg-mist file:px-3 file:py-2 file:font-semibold file:text-ink-2" />
            </label>
          )}
          <div className="flex flex-wrap items-center gap-4">
            {ep.open && <span className="text-xs text-slate">This endpoint needs no key.</span>}
            <button type="button" onClick={send} disabled={busy}
              className="ml-auto rounded-lg bg-ink px-5 py-2 text-sm font-semibold text-white hover:bg-ink-2 disabled:opacity-50">
              {busy ? "Sending…" : "Send request"}
            </button>
          </div>
          {err && <p role="alert" className="text-sm text-warn">{err}</p>}
        </div>

        <div aria-live="polite" className="min-w-0">
          <p className="text-sm font-semibold text-ink">Response</p>
          {res ? (
            <>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                <span className={`rounded-full px-2.5 py-0.5 font-bold ${ok ? "bg-ok/10 text-ok" : "bg-amber-soft text-warn"}`}>HTTP {res.status}</span>
                <span className="text-slate">{res.ms} ms</span>
                <code className="min-w-0 truncate text-slate" title={res.url}>{res.url}</code>
              </div>
              <pre className="mt-2 max-h-[28rem] overflow-auto rounded-xl bg-ink p-4 font-mono text-xs leading-relaxed text-white/90">{res.body}</pre>
            </>
          ) : (
            <div className="mt-1 flex h-40 items-center justify-center rounded-xl border border-dashed border-ink/15 text-sm text-slate">
              The JSON response will appear here.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Examples({ base }: { base: string }) {
  const [lang, setLang] = useState<"curl" | "python" | "javascript">("curl");
  const labels = { curl: "curl", python: "Python", javascript: "JavaScript" } as const;
  return (
    <section aria-labelledby="ex-h" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="ex-h" className="font-display text-2xl text-ink">Endpoints &amp; examples</h2>
        <div role="tablist" aria-label="Example language" className="inline-flex rounded-lg bg-mist p-0.5">
          {(Object.keys(labels) as (keyof typeof labels)[]).map((l) => (
            <button key={l} type="button" role="tab" aria-selected={lang === l} onClick={() => setLang(l)}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold ${lang === l ? "bg-ink text-white" : "text-ink-2 hover:bg-white"}`}>
              {labels[l]}
            </button>
          ))}
        </div>
      </div>
      {lang === "python" && <p className="text-xs text-slate">Needs <code className="font-mono">pip install requests</code>.</p>}
      <ul className="space-y-4">
        {ENDPOINTS.map((ep) => {
          const code = examples(ep, base, API_KEY)[lang];
          return (
            <li key={ep.id} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink/5">
              <div className="flex flex-wrap items-center gap-2">
                <MethodBadge m={ep.method} />
                <code className="font-mono text-sm font-bold text-ink">{ep.path}</code>
                {ep.open && <span className="rounded-full bg-mist px-2 py-0.5 text-[11px] font-semibold text-slate">no key</span>}
              </div>
              <p className="mt-2 text-sm text-ink-2">{ep.desc}</p>
              <div className="relative mt-3">
                <pre className="overflow-x-auto rounded-xl bg-ink p-4 pr-20 font-mono text-xs leading-relaxed text-white/90">{code}</pre>
                <div className="absolute right-2 top-2"><CopyButton text={code} /></div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function ApiAccess() {
  // Locally the website forwards /api to the backend, so the site's own address is the API's address.
  const [base, setBase] = useState(API_BASE);
  useEffect(() => { if (!API_BASE) setBase(window.location.origin); }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-ink/10 bg-white/90 backdrop-blur">
        <div className={`${WRAP} flex h-16 items-center gap-3`}>
          <a href="/" className="flex items-center gap-2.5" aria-label="LegalCompass — home">
            <Logo />
            <span className="font-display text-xl text-ink sm:text-2xl">LegalCompass</span>
          </a>
          <span className="rounded-full bg-amber-soft px-2.5 py-1 text-xs font-semibold text-warn">API</span>
          <a href="/" className="ml-auto rounded-lg px-3 py-2 text-sm font-semibold text-ink-2 hover:bg-mist hover:text-ink">← Back to app</a>
        </div>
      </header>

      <section className="bg-ink text-white">
        <div className={`${WRAP} py-10`}>
          <p className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide text-amber ring-1 ring-white/15">For lawyers, researchers &amp; developers</p>
          <h1 className="mt-4 font-display text-3xl sm:text-4xl">API Access</h1>
          <p className="mt-3 max-w-2xl text-white/80">
            One shared public key gives you the whole LegalCompass API: IPC↔BNS, CrPC↔BNSS and IEA↔BSA section mapping, date-based applicable law,
            incident analysis and citation conversion.
          </p>
        </div>
      </section>

      <main className={`${WRAP} flex-1 space-y-8 py-8`}>
        <section aria-labelledby="key-h" className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink/5 sm:p-6">
          <h2 id="key-h" className="font-display text-2xl text-ink">Your access details</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="API key" value={API_KEY || "(not configured — set NEXT_PUBLIC_LEGALCOMPASS_API_KEY)"} copy={!!API_KEY} />
            <Field label="Base URL" value={base || "…"} />
            <Field label="Header" value={`x-api-key: ${API_KEY}`} />
            <Field label="Or as a query parameter" value={`?api_key=${API_KEY}`} />
          </div>
          <ul className="mt-5 grid gap-2 text-sm text-ink-2 sm:grid-cols-3">
            <li className="rounded-xl bg-mist p-3"><b className="text-ink">Missing or wrong key</b> → HTTP 401 with a JSON <code className="font-mono">detail</code>.</li>
            <li className="rounded-xl bg-mist p-3"><b className="text-ink">Rate limit</b> → 120 requests/min per IP overall (lower for analysis and uploads); HTTP 429 when exceeded.</li>
            <li className="rounded-xl bg-mist p-3"><b className="text-ink">Interactive docs</b> → OpenAPI at <code className="font-mono">/docs</code> on the backend.</li>
          </ul>
          <p className="mt-4 text-xs text-slate">This key is public by design and only unlocks the LegalCompass API. General legal information, not legal advice.</p>
        </section>

        <TryIt base={base} />
        <Examples base={base} />
      </main>

      <footer className="border-t border-ink/10 bg-white">
        <div className={`${WRAP} py-6 text-xs text-slate`}>
          Mapping data: LegalCompass IPC↔BNS mapping, IEEE DataPort, DOI 10.21227/h4wg-7413 (CC BY 4.0).
        </div>
      </footer>
    </div>
  );
}
