"use client";

import React, { useState } from "react";
import { api } from "@/lib/api";

export default function RequestServicePage() {
  const [formData, setFormData] = useState({
    customerName: "",
    phone: "",
    city: "",
    serviceId: 1,
    description: "",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<{
    type: "success" | "error" | null;
    message: string;
    assignedProviders?: string[];
  }>({ type: null, message: "" });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "serviceId" ? parseInt(value) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setStatus({ type: null, message: "" });

    // Client-side phone validation
    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(formData.phone)) {
      setStatus({
        type: "error",
        message: "Phone number must be exactly 10 digits.",
      });
      setIsLoading(false);
      return;
    }

    try {
      const response = await api.post("/leads", formData);
      setStatus({
        type: "success",
        message: "Lead created and assigned successfully!",
        assignedProviders: response.data.assignedProviders,
      });
      // Clear form on success
      setFormData({
        customerName: "",
        phone: "",
        city: "",
        serviceId: 1,
        description: "",
      });
    } catch (err: any) {
      const errMsg =
        err.response?.data?.message || err.response?.data?.error || "An error occurred.";
      setStatus({
        type: "error",
        message: errMsg,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-12 sm:px-6 lg:py-16">
      <div className="overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-6 shadow-2xl backdrop-blur-sm sm:p-8">
        
        {/* Title */}
        <div className="mb-8 text-center">
          <h1 className="bg-gradient-to-r from-teal-400 to-emerald-300 bg-clip-text text-2xl font-bold tracking-tight text-transparent sm:text-3xl">
            Request a Service
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Submit your enquiry and we will assign the top available providers to your request instantly.
          </p>
        </div>

        {/* Status Alerts */}
        {status.type && (
          <div
            className={`mb-6 rounded-xl p-4 border text-sm transition-all duration-300 ${
              status.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                : "bg-rose-500/10 border-rose-500/20 text-rose-300"
            }`}
          >
            <p className="font-semibold">{status.message}</p>
            {status.assignedProviders && status.assignedProviders.length > 0 && (
              <div className="mt-3">
                <span className="text-zinc-400 text-xs block mb-1">Assigned Providers:</span>
                <div className="flex flex-wrap gap-1.5">
                  {status.assignedProviders.map((name) => (
                    <span
                      key={name}
                      className="rounded bg-emerald-500/20 px-2 py-0.5 text-xs font-mono font-bold text-emerald-400 border border-emerald-500/30"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Lead Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Customer Name */}
          <div>
            <label htmlFor="customerName" className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
              Full Name
            </label>
            <input
              type="text"
              id="customerName"
              name="customerName"
              required
              value={formData.customerName}
              onChange={handleChange}
              placeholder="e.g. John Doe"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 transition-all focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>

          {/* Phone Number */}
          <div>
            <label htmlFor="phone" className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
              Phone Number (10 digits)
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              required
              value={formData.phone}
              onChange={handleChange}
              placeholder="e.g. 9876543210"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 transition-all focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>

          {/* City */}
          <div>
            <label htmlFor="city" className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
              City
            </label>
            <input
              type="text"
              id="city"
              name="city"
              required
              value={formData.city}
              onChange={handleChange}
              placeholder="e.g. Mumbai"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 transition-all focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>

          {/* Service Type (Dropdown) */}
          <div>
            <label htmlFor="serviceId" className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
              Service Type
            </label>
            <div className="relative">
              <select
                id="serviceId"
                name="serviceId"
                value={formData.serviceId}
                onChange={handleChange}
                className="w-full appearance-none rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 transition-all focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                <option value={1}>Service 1</option>
                <option value={2}>Service 2</option>
                <option value={3}>Service 3</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-zinc-500">
                <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                  <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
              Enquiry Description
            </label>
            <textarea
              id="description"
              name="description"
              required
              rows={4}
              value={formData.description}
              onChange={handleChange}
              placeholder="Please describe the service you require in detail..."
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 transition-all focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 resize-none"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center items-center rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 py-3 text-sm font-semibold text-zinc-950 shadow-lg shadow-teal-500/25 transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed mt-2"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4 text-zinc-950" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Processing...
              </span>
            ) : (
              "Submit Enquiry"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
