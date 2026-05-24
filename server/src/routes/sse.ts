// server-sent events endpoint.

import { Router, Request, Response } from "express";
import { addClient, removeClient } from "../services/sseService";

const router = Router();

router.get("/", (req: Request, res: Response) => {

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  res.flushHeaders();


  // This confirms SSE connection is established.
  res.write(`event: connected\ndata: ${JSON.stringify({ message: "SSE connected" })}\n\n`);

  // Register this client with the SSE manager 
  addClient(res);

  // Keep-alive ping every 30 seconds
  // Prevents proxies and load balancers from closing idle connections.
  // SSE comments (lines starting with ':') are ignored by the client.
  const pingInterval = setInterval(() => {
    try {
      res.write(": ping\n\n");
    } catch {
      clearInterval(pingInterval);
    }
  }, 30_000);

  // Cleanup on disconnect
  // When the client closes the tab or navigates away, 'close' fires.
  req.on("close", () => {
    clearInterval(pingInterval);
    removeClient(res);
  });
});

export default router;
