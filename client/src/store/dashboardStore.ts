import { create } from "zustand";
import { Provider } from "@/types";
import { api } from "@/lib/api";

interface DashboardState {
  providers: Provider[];
  isLoading: boolean;
  error: string | null;
  eventSource: EventSource | null;
  fetchProviders: () => Promise<void>;
  initializeSSE: () => void;
  disconnectSSE: () => void;
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  providers: [],
  isLoading: false,
  error: null,
  eventSource: null,

  fetchProviders: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get<Provider[]>("/providers");
      set({ providers: response.data, isLoading: false });
    } catch (err: any) {
      set({
        error: err.response?.data?.error || "Failed to fetch providers",
        isLoading: false,
      });
    }
  },

  initializeSSE: () => {
    // If connection already exists, don't duplicate it
    if (get().eventSource) return;

    const sseUrl = process.env.NEXT_PUBLIC_SSE_URL || "http://localhost:5000/api/events";
    // console.log(`[SSE] Connecting to ${sseUrl}...`);
    const source = new EventSource(sseUrl);

    source.addEventListener("connected", (event) => {
      // console.log("[SSE] Connected:", JSON.parse(event.data));
    });

    source.addEventListener("dashboard_update", (event) => {
      try {
        const data = JSON.parse(event.data);
        // console.log("[SSE] Dashboard update received:", data);
        if (data.providers) {
          // Normalize providers to add remainingQuota
          const normalized = data.providers.map((p: any) => ({
            ...p,
            remainingQuota: Math.max(0, p.monthlyQuota - p.leadsReceivedThisMonth),
          }));
          set({ providers: normalized });
        }
      } catch (err) {
        console.error("[SSE] Failed to parse dashboard update event:", err);
      }
    });

    source.onerror = (err) => {
      // console.error("[SSE] EventSource failed:", err);
    };

    set({ eventSource: source });
  },

  disconnectSSE: () => {
    const source = get().eventSource;
    if (source) {
      // console.log("[SSE] Disconnecting event source...");
      source.close();
      set({ eventSource: null });
    }
  },
}));
