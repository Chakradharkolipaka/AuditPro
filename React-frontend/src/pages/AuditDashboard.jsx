import React, { useMemo, useState } from "react";
import axios from "axios";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Toaster, toast } from "@/components/ui/sonner";

import ContractUploader from "@/components/ContractUploader";
import RiskCard from "@/components/RiskCard";
import ChatWindow from "@/components/ChatWindow";
import AuditTimeline from "@/components/AuditTimeline";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function AuditDashboard() {
  const [busy, setBusy] = useState(false);
  const [contract, setContract] = useState(null);
  const [report, setReport] = useState(null);
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
    const base = [
      { id: "upload", label: "Contract received", status: contract ? "done" : "queued" },
      { id: "rules", label: "Pattern checks", status: report ? "done" : contract ? "running" : "queued" },
      { id: "tests", label: "Foundry tests (optional)", status: report?.tests ? "done" : contract ? "queued" : "queued" },
      { id: "proof", label: "On-chain proof (optional)", status: report?.proof ? "done" : "queued" },
    ];
    return base;
  }, [contract, report]);

  const analyze = async ({ filename, source }) => {
    setBusy(true);
    setContract({ filename, source });
    setReport(null);
    try {
      const res = await axios.post(`${API}/audit/analyze`, { filename, source });
      setReport(res.data);
      toast.success("Analysis complete", { description: "Review risk signals and explanations below." });
    } catch (e) {
      console.error(e);
      toast.error("Analysis failed", { description: e?.message || "Unknown error" });
    } finally {
      setBusy(false);
    }
  };

  const sendChat = async (prompt) => {
    if (!contract?.source) {
      toast("Upload a contract first", { description: "The assistant needs contract context." });
      return;
    }

    const userMsg = { id: `${Date.now()}-u`, role: "user", content: prompt };
    setMessages((m) => [...m, userMsg]);

    try {
      const res = await axios.post(`${API}/chat`, {
        contractSource: contract.source,
        messages: [...messages, userMsg].map(({ role, content }) => ({ role, content })),
      });

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
      toast.error("Chat failed", { description: e?.message || "Unknown error" });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors />
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="flex flex-col gap-2 mb-8">
          <div className="text-2xl font-bold tracking-tight">AuditPro</div>
          <div className="text-sm text-muted-foreground">
            AI-assisted smart contract risk signals, explainable patterns, and optional verification.
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-6">
            <ContractUploader onUpload={analyze} isBusy={busy} />

            <AuditTimeline steps={steps} />

            {report?.risks?.length ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {report.risks.map((r, idx) => (
                  <RiskCard
                    key={`${r.id || idx}`}
                    title={r.title}
                    summary={r.summary}
                    severity={r.severity}
                    tags={r.tags}
                  />
                ))}
              </div>
            ) : null}

            {report?.explanations?.length ? (
              <div className="rounded-xl border bg-card shadow-sm p-6">
                <div className="text-sm font-semibold mb-4">Explainable notes</div>
                <Accordion type="single" collapsible>
                  {report.explanations.map((e, idx) => (
                    <AccordionItem value={`item-${idx}`} key={idx}>
                      <AccordionTrigger>{e.title}</AccordionTrigger>
                      <AccordionContent>
                        <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {e.body}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            ) : null}
          </div>

          <div className="lg:col-span-5">
            <ChatWindow messages={messages} onSend={sendChat} disabled={busy} />
          </div>
        </div>
      </div>
    </div>
  );
}
