import express, { Application } from "express";
import cors from "cors";
import { errorHandler } from "./middleware/errorHandler";

import leadsRouter from "./routes/leads";
import providersRouter from "./routes/providers";
import webhookRouter from "./routes/webhook";
import sseRouter from "./routes/sse";
import testRouter from "./routes/test";

const app: Application = express();
// const PORT = process.env.PORT || 5000;

app.use(express.json());

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  })
);

app.get("/", (_req, res) => {
  res.send("Lead Distribution System is running..");
});

// Health Check 
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});


// Routes 
app.use("/api/leads", leadsRouter);       
app.use("/api/providers", providersRouter); 
app.use("/api/webhook", webhookRouter);   
app.use("/api/events", sseRouter);       
app.use("/api/test", testRouter);

// Global Error Handler
app.use(errorHandler);


// app.listen(PORT, () => {
//   console.log(`Server running on http://localhost:${PORT}`);
//   console.log(`SSE endpoint: http://localhost:${PORT}/api/events`);
// });


export default app;
