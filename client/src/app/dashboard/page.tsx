"use client";

import React, { useEffect } from "react";
import { useDashboardStore } from "@/store/dashboardStore";

export default function DashboardPage() {
  const { providers, isLoading, error, fetchProviders, initializeSSE, disconnectSSE } =
    useDashboardStore();

  useEffect(() => {
    // Initial fetch of provider data
    fetchProviders();

    // Setup real-time updates via Server-Sent Events (SSE)
    initializeSSE();

    // Cleanup on unmount
    return () => {
      disconnectSSE();
    };
  }, [fetchProviders, initializeSSE, disconnectSSE]);

  // Color mappings for Service badges
  const getServiceBadgeStyles = (serviceId: number) => {
    switch (serviceId) {
      case 1:
        return "bg-teal-500/10 border-teal-500/20 text-teal-400";
      case 2:
        return "bg-violet-500/10 border-violet-500/20 text-violet-400";
      case 3:
        return "bg-amber-500/10 border-amber-500/20 text-amber-400";
      default:
        return "bg-zinc-500/10 border-zinc-500/20 text-zinc-400";
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
      
      {/* Header Panel */}
      <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-900 pb-8">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-100 sm:text-3xl">
              Provider Dashboard
            </h1>
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-400">
            Real-time lead assignments and provider monthly quota limits.
          </p>
        </div>

        {/* Live Indicator Badges */}
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center rounded-md border border-zinc-800 bg-zinc-900/60 px-2.5 py-1 text-zinc-400">
            Active Connection: <strong className="ml-1 text-emerald-400 font-mono">SSE Stream</strong>
          </span>
          <button
            onClick={() => fetchProviders()}
            className="inline-flex items-center rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-1 text-zinc-300 transition-colors hover:bg-zinc-800"
          >
            Refresh Data
          </button>
        </div>
      </div>

      {/* Loading & Error States */}
      {isLoading && providers.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <svg className="animate-spin h-8 w-8 text-teal-400 mb-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-zinc-400 text-sm">Synchronizing dashboard...</span>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300 mb-8">
          <strong>Sync Error:</strong> {error}
        </div>
      )}

      {/* Providers Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {providers.map((provider) => {
          const quotaPercent = Math.min(
            100,
            (provider.leadsReceivedThisMonth / provider.monthlyQuota) * 100
          );
          
          // Color progress bar depending on percentage
          const getProgressBarColor = (percent: number) => {
            if (percent >= 100) return "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]";
            if (percent >= 80) return "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]";
            return "bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.4)]";
          };

          return (
            <div
              key={provider.id}
              className="flex flex-col rounded-2xl border border-zinc-800/80 bg-zinc-900/30 p-5 shadow-lg shadow-black/10 backdrop-blur-sm transition-all duration-300 hover:border-zinc-700/80 hover:bg-zinc-900/40"
            >
              
              {/* Card Header */}
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-mono font-bold text-zinc-100 tracking-wider">
                  {provider.name}
                </h3>
                <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs font-mono font-bold text-zinc-400">
                  ID: {provider.id}
                </span>
              </div>

              {/* Quota Section */}
              <div className="mb-5 space-y-2">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>Monthly Quota Limit</span>
                  <span className="font-semibold text-zinc-200">
                    {provider.leadsReceivedThisMonth} / {provider.monthlyQuota}
                  </span>
                </div>
                {/* Progress Bar Track */}
                <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${getProgressBarColor(quotaPercent)}`}
                    style={{ width: `${quotaPercent}%` }}
                  />
                </div>
                {/* Quota Status Indicator */}
                <div className="flex justify-between text-[11px]">
                  <span
                    className={`font-semibold ${
                      provider.remainingQuota > 0 ? "text-teal-400" : "text-rose-400"
                    }`}
                  >
                    {provider.remainingQuota > 0
                      ? `${provider.remainingQuota} remaining slots`
                      : "Quota Exhausted"}
                  </span>
                </div>
              </div>

              {/* Assigned Leads Section */}
              <div className="flex-1 flex flex-col border-t border-zinc-900 pt-4">
                <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                  Assigned Leads ({provider.assignments.length})
                </h4>

                {provider.assignments.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center py-8 rounded-xl border border-dashed border-zinc-800 bg-zinc-950/20 text-center">
                    <span className="text-xs text-zinc-600">No leads assigned this month</span>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                    {provider.assignments.map((assignment) => {
                      const lead = assignment.lead;
                      return (
                        <div
                          key={assignment.id}
                          className="rounded-xl border border-zinc-800/60 bg-zinc-950/60 p-3 text-xs transition-colors hover:border-zinc-700/60"
                        >
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <span className="font-bold text-zinc-200 truncate">
                              {lead.customerName}
                            </span>
                            <span
                              className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold ${getServiceBadgeStyles(
                                lead.serviceId
                              )}`}
                            >
                              {lead.service?.name || `Service ${lead.serviceId}`}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-zinc-500 font-mono mb-2">
                            <span>Phone: <strong className="text-zinc-400">{lead.phone}</strong></span>
                            <span>City: <strong className="text-zinc-400">{lead.city}</strong></span>
                          </div>

                          <p className="text-zinc-400 line-clamp-2 leading-relaxed bg-zinc-900/30 p-1.5 rounded border border-zinc-900/60">
                            {lead.description}
                          </p>

                          <div className="mt-2 text-right text-[10px] text-zinc-600 font-mono">
                            {new Date(lead.createdAt).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
}
