import React, { useCallback, useRef, useState } from "react";
import { Upload, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * ContractUploader
 * - Input: user selects a .sol file OR pastes Solidity code
 * - Output: calls onUpload({ filename, source })
 */
export default function ContractUploader({ onUpload, isBusy }) {
  const fileInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [source, setSource] = useState("");
  const [filename, setFilename] = useState("");

  const readFile = async (file) => {
    const text = await file.text();
    setFilename(file.name);
    setSource(text);
  };

  const onDrop = useCallback(async (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await readFile(file);
  }, []);

  const submit = async () => {
    const trimmed = source.trim();
    if (!trimmed) return;
    await onUpload?.({ filename: filename || "Contract.sol", source: trimmed });
  };

  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" /> Upload contract
        </CardTitle>
        <CardDescription>
          Drop a <span className="font-medium">.sol</span> file or paste the code. We’ll generate an explainable risk summary (not a professional audit).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className={cn(
            "rounded-lg border border-dashed p-6 bg-card/50",
            "transition-colors",
            dragOver ? "border-primary bg-primary/5" : "border-border",
          )}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          <div className="flex flex-col items-center text-center gap-2">
            <Upload className="h-7 w-7 text-muted-foreground" />
            <div className="text-sm text-muted-foreground">
              Drag & drop your contract here, or
            </div>
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".sol,.txt"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  await readFile(f);
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isBusy}
              >
                Choose file
              </Button>
              <Button type="button" onClick={submit} disabled={isBusy || !source.trim()}>
                Analyze
              </Button>
            </div>
            {filename ? (
              <div className="text-xs text-muted-foreground">Selected: {filename}</div>
            ) : null}
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">Or paste Solidity:</div>
          <textarea
            className={cn(
              "w-full min-h-[220px] rounded-lg border bg-background p-3 text-sm",
              "focus:outline-none focus:ring-1 focus:ring-ring",
              "shadow-sm"
            )}
            placeholder={`// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;\n\ncontract Hello {\n  function hi() external pure returns (string memory) {\n    return \"hi\";\n  }\n}`}
            value={source}
            onChange={(e) => setSource(e.target.value)}
            disabled={isBusy}
          />
        </div>
      </CardContent>
    </Card>
  );
}
