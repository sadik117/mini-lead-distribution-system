// Server-Sent Events (SSE) manager.

import { Response } from "express";

// Store all currently connected SSE clients
const clients = new Set<Response>();

/**
 * Register a new SSE client connection.
 * Called when browser connects to GET /api/events.
 */
export function addClient(res: Response): void {
  clients.add(res);
  // console.log(`SSE client connected. Total: ${clients.size}`);
}


//  Remove an SSE client when client disconnect (tab closed, navigation, etc.)
 
export function removeClient(res: Response): void {
  clients.delete(res);
  // console.log(`SSE client disconnected. Total: ${clients.size}`);
}

export function broadcast(eventName: string, payload: unknown): void {
  const message = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;

  let deadClients = 0;
  clients.forEach((client) => {
    try {
      client.write(message);
    } catch {
      // Client disconnected without cleanup — remove it
      clients.delete(client);
      deadClients++;
    }
  });

  if (deadClients > 0) {
    console.log(`Removed ${deadClients} dead SSE clients`);
  }

  console.log(
    `Broadcast "${eventName}" to ${clients.size} clients`
  );
}
