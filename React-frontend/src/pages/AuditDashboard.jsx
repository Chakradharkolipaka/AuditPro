import React, { useEffect, useMemo, useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Toaster, toast } from "@/components/ui/sonner";
import { Info } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { BrowserProvider } from "ethers";

import ContractUploader from "@/components/ContractUploader";
import RiskCard from "@/components/RiskCard";
import ChatWindow from "@/components/ChatWindow";
import AuditTimeline from "@/components/AuditTimeline";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { auth, signInWithGoogle, signOutGoogle } from "@/lib/firebase";
import { apiClient } from "@/lib/apiClient";

export default function AuditDashboard() {
  const [busy, setBusy] = useState(false);
  const [contract, setContract] = useState(null);
  const [report, setReport] = useState(null);
  const [job, setJob] = useState(null);
  const [history, setHistory] = useState([]);
  const [idToken, setIdToken] = useState("");
  const [user, setUser] = useState(null);
  const [walletAddress, setWalletAddress] = useState("");
  const [languageFilter, setLanguageFilter] = useState("");
  const [protocolFilter, setProtocolFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [sortDescRisk, setSortDescRisk] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Upload a smart contract and ask me security questions. I’ll provide risk signals and explain patterns in plain English.",
      disclaimer:
        "Disclaimer: This tool provides security insights and test signals, not a professional audit.",
    },
  ]);

  const steps = useMemo(() => {
    const pct = typeof job?.progress === "number" ? job.progress : null;
    const jobStatus = job?.status;

    return [
      { id: "upload", label: "Contract uploaded", status: contract ? "done" : "queued" },
      {
        id: "queue",
        label: "Queued job",
        status: jobStatus === "queued" ? "running" : jobStatus ? "done" : contract ? "running" : "queued",
        detail: pct != null ? `Progress: ${pct}%` : undefined,
      },
      {
        id: "pipeline",
        label: "Analysis + AI report",
        status: report ? "done" : jobStatus === "running" ? "running" : contract ? "queued" : "queued",
      },
      { id: "rag", label: "RAG context (optional)", status: "queued", detail: "Used for chat answers if ChromaDB is running" },
    ];
  }, [contract, report, job]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u || null);
      if (!u) {
        setIdToken("");
        setHistory([]);
        return;
      }
      const token = await u.getIdToken();
      setIdToken(token);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!idToken) return;
    const loadHistory = async () => {
      try {
        const params = {
          sortBy: "securityScore",
          sortOrder: sortDescRisk ? "desc" : "asc",
        };
        if (languageFilter) params.language = languageFilter;
        if (protocolFilter) params.protocol = protocolFilter;
        if (dateFilter) {
          params.fromDate = `${dateFilter}T00:00:00.000Z`;
          params.toDate = `${dateFilter}T23:59:59.999Z`;
        }

        const res = await apiClient.get(`/audit`, {
          headers: { Authorization: `Bearer ${idToken}` },
          params,
        });
        setHistory(Array.isArray(res.data?.history) ? res.data.history : []);
      } catch {
        setHistory([]);
      }
    };
    loadHistory();
  }, [idToken, languageFilter, protocolFilter, dateFilter, sortDescRisk]);

  const authHeaders = useMemo(() => {
    return idToken ? { Authorization: `Bearer ${idToken}` } : {};
  }, [idToken]);

  const filteredHistory = useMemo(() => history, [history]);

  const pollJob = async (jobId) => {
    const started = Date.now();
    const timeoutMs = 25_000;

    while (true) {
      if (Date.now() - started > timeoutMs) {
        throw new Error("Audit timed out. Try again.");
      }

    const res = await apiClient.get(`/audit`, { params: { jobId }, headers: authHeaders });
      const status = res.data?.status;
      setJob(res.data?.job || null);

      if (status === "completed") {
        setReport(res.data?.report || null);
        return;
      }

      if (status === "failed") {
        throw new Error(res.data?.job?.error || "Audit failed");
      }

      // simple backoff
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 1200));
    }
  };

  const analyze = async ({ filename, source }) => {
    if (!idToken) {
      toast("Sign in required", { description: "Please sign in with Google before submitting an audit." });
      return;
    }

    setBusy(true);
    setContract({ filename, source });
    setReport(null);
    setJob(null);

    try {
      // Prefer serverless upload endpoint (multipart/form-data).
      const blob = new Blob([source], { type: "text/plain" });
      const file = new File([blob], filename || "Contract.sol", { type: "text/plain" });
      const fd = new FormData();
      fd.append("file", file);

      const protocol = window.prompt("Optional protocol label (e.g., EVM, Sui, Aptos, ICP):", "EVM") || "unknown";
      fd.append("protocol", protocol);

      const queued = await apiClient.post(`/audit`, fd, {
        headers: { "Content-Type": "multipart/form-data", ...authHeaders },
      });

      if (queued.data?.status === "completed") {
        setReport(queued.data.report);
        toast.success("Analysis complete", { description: "Loaded cached report from database." });
        return;
      }

      const jobId = queued.data?.jobId;
      if (!jobId) throw new Error("Missing jobId from server");

      toast("Audit queued", { description: "Processing… this can take up to ~20s." });
      await pollJob(jobId);
      const historyRes = await apiClient.get(`/audit`, {
        headers: authHeaders,
        params: {
          sortBy: "securityScore",
          sortOrder: sortDescRisk ? "desc" : "asc",
          ...(languageFilter ? { language: languageFilter } : {}),
          ...(protocolFilter ? { protocol: protocolFilter } : {}),
        },
      });
  setHistory(Array.isArray(historyRes.data?.history) ? historyRes.data.history : []);
      toast.success("Analysis complete", { description: "Review vulnerabilities, gas tips, and recommendations." });
    } catch (e) {
      console.error(e);
      toast.error("Analysis failed", { description: e?.userMessage || "Unknown error" });
    } finally {
      setBusy(false);
    }
  };

  const onToggleHelp = () => {
    setShowHelp((v) => !v);
    toast("Quick start", {
      description:
        "1) Upload/paste a .sol contract → Analyze. 2) Review cards. 3) Use chat for explanations. (Runs locally via Ollama)",
    });
  };

  const sendChat = async (prompt) => {
    if (!idToken) {
      toast("Sign in required", { description: "Please sign in with Google first." });
      return;
    }
    if (!contract?.source) {
      toast("Upload a contract first", { description: "The assistant needs contract context." });
      return;
    }

    const userMsg = { id: `${Date.now()}-u`, role: "user", content: prompt };
    setMessages((m) => [...m, userMsg]);

    try {
      const res = await apiClient.post(`/chat`, {
        contractSource: contract.source,
        messages: [...messages, userMsg].map(({ role, content }) => ({ role, content })),
      }, { headers: authHeaders });

      setMessages((m) => [
        ...m,
        {
          id: `${Date.now()}-a`,
          role: "assistant",
          content: res.data.answer,
          disclaimer: res.data.disclaimer,
        },
      ]);
    } catch (e) {
      console.error(e);
      toast.error("Chat failed", { description: e?.userMessage || "Unknown error" });
    }
  };

  const onSignIn = async () => {
    try {
      await signInWithGoogle();
      toast.success("Signed in successfully");
    } catch (e) {
      toast.error("Sign in failed", { description: e?.message || "Unknown error" });
    }
  };

  const onSignOut = async () => {
    await signOutGoogle();
    setContract(null);
    setReport(null);
    setJob(null);
    setHistory([]);
    toast("Signed out");
  };

  const onConnectWallet = async () => {
    try {
      if (!window.ethereum) {
        toast("Wallet not detected", { description: "Install MetaMask or a compatible wallet." });
        return;
      }
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      setWalletAddress(address);

      if (idToken) {
        await apiClient.post(`/auth/wallet`, { walletAddress: address }, { headers: authHeaders });
      }

      toast.success("Wallet connected", { description: address });
    } catch (e) {
      toast.error("Wallet connect failed", { description: e?.message || "Unknown error" });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors />
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="flex items-start justify-between gap-4 mb-8">
          <div className="flex flex-col gap-2">
            <div className="text-2xl font-bold tracking-tight">AuditPro (Local Auditor)</div>
            <div className="text-sm text-muted-foreground">
              AI-powered smart contract auditor with Google sign-in, optional wallet linking, queue-based reports, and multi-language uploads.
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
                "bg-card shadow-sm hover:shadow-md transition-shadow"
              )}
              onClick={onToggleHelp}
              aria-label="Help"
            >
              <Info className="h-4 w-4" />
              How to use
            </button>
            {user ? (
              <>
                <button type="button" className="rounded-md border px-3 py-2 text-sm" onClick={onConnectWallet}>
                  {walletAddress ? "Wallet Linked" : "Connect Wallet"}
                </button>
                <button type="button" className="rounded-md border px-3 py-2 text-sm" onClick={onSignOut}>
                  Sign out
                </button>
              </>
            ) : (
              <button type="button" className="rounded-md border px-3 py-2 text-sm" onClick={onSignIn}>
                Sign in with Google
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-6">
            {/* Contract Upload Card */}
            <div className="transition-all duration-300">
              <ContractUploader onUpload={analyze} isBusy={busy} />
            </div>

            <AuditTimeline steps={steps} />

            {/* Vulnerabilities Card */}
            <Card className="shadow-sm hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Vulnerabilities</CardTitle>
                <CardDescription>
                  Pattern-based findings (and optional Slither findings if enabled later).
                </CardDescription>
              </CardHeader>
              <CardContent>
                {busy ? (
                  <div className="text-sm text-muted-foreground">Analyzing…</div>
                ) : report?.vulnerabilities?.length ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {report.vulnerabilities.map((r, idx) => (
                      <RiskCard
                        key={`${r.id || idx}`}
                        title={r.title || r.type || "Security finding"}
                        summary={r.summary || r.description || "Potential vulnerability detected."}
                        severity={r.severity}
                        tags={r.tags || [r.source || "analysis"]}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Upload a contract and click Analyze to see vulnerabilities.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Gas Optimization Card */}
            <Card className="shadow-sm hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Gas Optimizations</CardTitle>
                <CardDescription>Low-risk heuristics you can apply and benchmark.</CardDescription>
              </CardHeader>
              <CardContent>
                {report?.gas?.gasIssues?.length ? (
                  <ul className="space-y-2 text-sm">
                    {report.gas.gasIssues.map((s, idx) => (
                      <li key={`${idx}`} className="rounded-lg border p-3 bg-card/50">
                        <div className="font-medium">{s.problem}</div>
                        <div className="text-muted-foreground mt-1">{s.improvement}</div>
                        <div className="text-xs text-muted-foreground mt-2">Estimated saving: {s.estimatedGasSaving || "n/a"}</div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-muted-foreground">No gas suggestions yet.</div>
                )}
              </CardContent>
            </Card>

            {/* Security Recommendation Card */}
            <Card className="shadow-sm hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Security Recommendations</CardTitle>
                <CardDescription>
                  Practical next steps. (Chat can expand on each recommendation.)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="rounded-lg border p-3 bg-card/50">
                  <div className="font-medium">Security</div>
                  <div className="text-muted-foreground mt-1">{report?.recommendations?.security || "—"}</div>
                </div>
                <div className="rounded-lg border p-3 bg-card/50">
                  <div className="font-medium">Gas</div>
                  <div className="text-muted-foreground mt-1">{report?.recommendations?.gas || "—"}</div>
                </div>
              </CardContent>
            </Card>

            {/* Explainable Notes (existing reusable accordion) */}
            {report?.explanations?.length ? (
              <div className="rounded-xl border bg-card shadow-sm p-6 transition-all duration-300">
                <div className="text-sm font-semibold mb-4">Explainable notes</div>
                <Accordion type="single" collapsible>
                  {report.explanations.map((e, idx) => (
                    <AccordionItem value={`item-${idx}`} key={idx}>
                      <AccordionTrigger>{e.title}</AccordionTrigger>
                      <AccordionContent>
                        <div className="text-sm text-muted-foreground whitespace-pre-wrap">{e.body}</div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            ) : null}
          </div>

          <div className="lg:col-span-5 space-y-6">
            {/* Bootstrap-ish guidance card (without changing folder structure) */}
            {showHelp ? (
              <div className="rounded-xl border bg-card p-4 shadow-sm animate-in fade-in">
                <div className="text-sm font-semibold">Using AuditPro</div>
                <ul className="mt-2 text-sm text-muted-foreground list-disc pl-5 space-y-1">
                  <li>Sign in with Google to create and view your audit history.</li>
                  <li>Upload a supported contract file (.sol/.rs/.move/.mo) or paste code.</li>
                  <li>Click Analyze — results appear as dashboard cards.</li>
                  <li>Ask the assistant about each finding (“Why is this risky?”).</li>
                  <li>Optional: run ChromaDB to enable retrieval-augmented answers.</li>
                </ul>
              </div>
            ) : null}

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">My Audit History</CardTitle>
                <CardDescription>Recent audits linked to your account.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                  <select
                    className="rounded border bg-background px-2 py-1 text-xs"
                    value={languageFilter}
                    onChange={(e) => setLanguageFilter(e.target.value)}
                  >
                    <option value="">All Languages</option>
                    {[...new Set(history.map((h) => h.language).filter(Boolean))].map((lang) => (
                      <option value={lang} key={lang}>{lang}</option>
                    ))}
                  </select>
                  <select
                    className="rounded border bg-background px-2 py-1 text-xs"
                    value={protocolFilter}
                    onChange={(e) => setProtocolFilter(e.target.value)}
                  >
                    <option value="">All Protocols</option>
                    {[...new Set(history.map((h) => h.protocol).filter(Boolean))].map((p) => (
                      <option value={p} key={p}>{p}</option>
                    ))}
                  </select>
                  <input
                    type="date"
                    className="rounded border bg-background px-2 py-1 text-xs"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                  />
                  <button
                    type="button"
                    className="rounded border bg-background px-2 py-1 text-xs"
                    onClick={() => setSortDescRisk((v) => !v)}
                  >
                    Sort by Risk Score {sortDescRisk ? "↓" : "↑"}
                  </button>
                </div>

                {filteredHistory.length ? (
                  <div className="space-y-2">
                    {filteredHistory.slice(0, 12).map((h) => (
                      <div key={h._id} className="rounded-md border p-3 text-sm">
                        <div className="font-medium">{h.contractName} ({h.language})</div>
                        <div className="text-muted-foreground text-xs mt-1">
                          Protocol: {h.protocol || "unknown"} • Score: {h.securityScore ?? "n/a"} • {new Date(h.createdAt).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">No matching audits yet. Sign in and run your first audit.</div>
                )}
              </CardContent>
            </Card>

            <ChatWindow messages={messages} onSend={sendChat} disabled={busy} />
          </div>
        </div>
      </div>
    </div>
  );
}
