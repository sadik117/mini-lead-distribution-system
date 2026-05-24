"use client";

import React, { useState } from "react";
import { api } from "@/lib/api";
import { v4 as uuidv4 } from "uuid";

interface LogEntry {
  id: string;
  time: string;
  type: "info" | "success" | "error" | "warn";
  action: string;
  message: string;
  details?: any;
}

export default function TestToolsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState({
    reset: false,
    idempotency: false,
    concurrency: false,
  });

  const addLog = (type: LogEntry["type"], action: string, message: string, details?: any) => {
    const newLog: LogEntry = {
      id: uuidv4(),
      time: new Date().toLocaleTimeString(),
      type,
      action,
      message,
      details,
    };
    setLogs((prev) => [newLog, ...prev]);
  };

  const handleResetQuota = async () => {
    setIsLoading((prev) => ({ ...prev, reset: true }));
    const key = uuidv4();
    addLog("info", "Reset Quota Initiated", `Calling webhook with idempotencyKey: ${key}`);

    try {
      const response = await api.post("/webhook/reset-quota", { idempotencyKey: key });
      addLog("success", "Reset Quota Success", response.data.message, response.data);
    } catch (err: any) {
      const msg = err.response?.data?.error || "Failed to reset quotas.";
      addLog("error", "Reset Quota Failed", msg);
    } finally {
      setIsLoading((prev) => ({ ...prev, reset: false }));
    }
  };

  const handleTestIdempotency = async () => {
    setIsLoading((prev) => ({ ...prev, idempotency: true }));
    const key = uuidv4();
    addLog(
      "info",
      "Idempotency Test Start",
      `Dispatching 5 rapid requests with SAME key: ${key}`
    );

    // Create 5 concurrent calls with exact same idempotencyKey
    const requests = Array.from({ length: 5 }, (_, i) =>
      api
        .post("/webhook/reset-quota", { idempotencyKey: key })
        .then((res) => ({ index: i + 1, status: "fulfilled" as const, data: res.data }))
        .catch((err) => ({
          index: i + 1,
          status: "rejected" as const,
          error: err.response?.data?.error || "Error",
        }))
    );

    try {
      const results = await Promise.all(requests);
      
      results.forEach((res) => {
        if (res.status === "fulfilled") {
          const detail = res.data;
          const logType = detail.processed ? "success" : "warn";
          addLog(
            logType,
            `Request #${res.index} Completed`,
            `Processed: ${detail.processed ? "YES (Reset Executed)" : "NO (Duplicate Blocked)"}. Message: ${detail.message}`,
            detail
          );
        } else {
          addLog("error", `Request #${res.index} Failed`, res.error);
        }
      });
    } catch (err) {
      addLog("error", "Idempotency Batch Error", "Critical failure executing batch.");
    } finally {
      setIsLoading((prev) => ({ ...prev, idempotency: false }));
    }
  };

  const handleTestConcurrency = async () => {
    setIsLoading((prev) => ({ ...prev, concurrency: true }));
    addLog("info", "Concurrency Test Start", "Triggering 10 leads simultaneously on backend...");

    try {
      const response = await api.post("/test/generate-leads");
      const { message, succeeded, failed } = response.data;
      
      addLog(
        failed.length > 0 ? "warn" : "success",
        "Concurrency Test Complete",
        `${message}. Check succeeded/failed list below.`,
        { succeeded, failed }
      );
    } catch (err: any) {
      const msg = err.response?.data?.error || "Concurrency test route failed.";
      addLog("error", "Concurrency Test Failed", msg);
    } finally {
      setIsLoading((prev) => ({ ...prev, concurrency: false }));
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:py-12 flex flex-col gap-8">
      
      {/* Page Header */}
      <div className="border-b border-zinc-900 pb-6">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100 sm:text-3xl">
          Testing Tools & Simulation
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Simulate webhooks, payment quota resets, idempotency behaviors, and parallel lead allocation concurrency.
        </p>
      </div>

      {/* Control Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Reset Quota Card */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6 flex flex-col justify-between">
          <div>
            <h2 className="font-mono font-bold text-zinc-200 text-sm tracking-wider mb-2 uppercase">
              1. Reset Quotas
            </h2>
            <p className="text-xs text-zinc-500 leading-relaxed mb-6">
              Simulates a webhook from payment gateway after a client renews subscription. Sets all provider limits back to 10 leads.
            </p>
          </div>
          <button
            onClick={handleResetQuota}
            disabled={isLoading.reset}
            className="w-full rounded-xl bg-zinc-800 py-3 text-xs font-semibold text-zinc-200 transition-all hover:bg-zinc-700 active:scale-[0.98] disabled:opacity-50"
          >
            {isLoading.reset ? "Processing..." : "Trigger Webhook Reset"}
          </button>
        </div>

        {/* Idempotency Test Card */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6 flex flex-col justify-between">
          <div>
            <h2 className="font-mono font-bold text-zinc-200 text-sm tracking-wider mb-2 uppercase">
              2. Test Idempotency
            </h2>
            <p className="text-xs text-zinc-500 leading-relaxed mb-6">
              Fires 5 webhook quota-reset calls concurrently using the exact same ID key. Checks that only 1 executes and 4 are blocked as duplicates.
            </p>
          </div>
          <button
            onClick={handleTestIdempotency}
            disabled={isLoading.idempotency}
            className="w-full rounded-xl bg-zinc-800 py-3 text-xs font-semibold text-zinc-200 transition-all hover:bg-zinc-700 active:scale-[0.98] disabled:opacity-50"
          >
            {isLoading.idempotency ? "Spamming Webhook..." : "Trigger Concurrent Reset"}
          </button>
        </div>

        {/* Concurrency Test Card */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6 flex flex-col justify-between">
          <div>
            <h2 className="font-mono font-bold text-zinc-200 text-sm tracking-wider mb-2 uppercase">
              3. Test Concurrency
            </h2>
            <p className="text-xs text-zinc-500 leading-relaxed mb-6">
              Generates 10 distinct leads simultaneously. Verifies round-robin allocation stability and locks consistency under high request velocity.
            </p>
          </div>
          <button
            onClick={handleTestConcurrency}
            disabled={isLoading.concurrency}
            className="w-full rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 py-3 text-xs font-semibold text-zinc-950 shadow-md shadow-teal-500/10 transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
          >
            {isLoading.concurrency ? "Generating Leads..." : "Generate 10 Leads Instantly"}
          </button>
        </div>
      </div>

      {/* Log Console Terminal */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5 flex flex-col flex-1 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-900 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-700 border border-zinc-600 block"></span>
            <h3 className="font-mono text-xs font-bold text-zinc-400 tracking-wider">
              TEST_RUNNER_CONSOLE
            </h3>
          </div>
          {logs.length > 0 && (
            <button
              onClick={() => setLogs([])}
              className="text-[10px] text-zinc-500 hover:text-zinc-300 font-mono"
            >
              Clear Logs
            </button>
          )}
        </div>

        {/* Console logs output */}
        {logs.length === 0 ? (
          <div className="text-center py-16 text-xs text-zinc-700 font-mono">
            No test runs registered yet. Click the buttons above to view execution streams.
          </div>
        ) : (
          <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
            {logs.map((log) => {
              const typeColor =
                log.type === "success"
                  ? "text-emerald-400"
                  : log.type === "error"
                  ? "text-rose-400"
                  : log.type === "warn"
                  ? "text-amber-400"
                  : "text-sky-400";

              return (
                <div key={log.id} className="border-b border-zinc-900/60 pb-3 last:border-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] text-zinc-600 font-mono">{log.time}</span>
                    <span className={`text-xs font-bold font-mono ${typeColor}`}>
                      [{log.type.toUpperCase()}]
                    </span>
                    <span className="text-xs font-semibold text-zinc-300 font-mono">
                      {log.action}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 font-mono leading-relaxed pl-1">
                    {log.message}
                  </p>
                  {log.details && (
                    <pre className="mt-2 max-w-full overflow-x-auto rounded-lg border border-zinc-900 bg-zinc-950 p-2.5 text-[10px] text-zinc-500 font-mono leading-normal">
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
