import React, { useEffect, useMemo, useRef, useState } from "react";
import { Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function ChatWindow({ messages, onSend, disabled }) {
  const [text, setText] = useState("");
  const listRef = useRef(null);

  const safeMessages = useMemo(() => (Array.isArray(messages) ? messages : []), [messages]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [safeMessages.length]);

  const submit = async (e) => {
    e.preventDefault();
    const prompt = text.trim();
    if (!prompt) return;
    setText("");
    await onSend?.(prompt);
  };

  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Security assistant</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div
          ref={listRef}
          className={cn(
            "h-[360px] overflow-auto rounded-lg border bg-background/50 p-3",
            "shadow-inner"
          )}
        >
          <div className="space-y-3">
            {safeMessages.map((m, idx) => {
              const isUser = m.role === "user";
              return (
                <div
                  key={`${m.id || idx}`}
                  className={cn(
                    "flex",
                    isUser ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed",
                      isUser
                        ? "bg-primary text-primary-foreground shadow"
                        : "bg-card border shadow-sm"
                    )}
                  >
                    <div className="whitespace-pre-wrap">{m.content}</div>
                    {m.disclaimer ? (
                      <div className="mt-2 text-[11px] opacity-80">
                        {m.disclaimer}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <form onSubmit={submit} className="flex gap-2">
          <input
            className={cn(
              "flex-1 h-9 rounded-md border bg-background px-3 text-sm",
              "focus:outline-none focus:ring-1 focus:ring-ring",
              "shadow-sm"
            )}
            placeholder="Ask about reentrancy, access control, modifiers..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={disabled}
          />
          <Button type="submit" disabled={disabled || !text.trim()}>
            <Send className="h-4 w-4" />
            Send
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
