import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { WebSocketServer, WebSocket } from "ws";
import { MonitorManager } from "./monitor";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const monitorManager = new MonitorManager(wss);

  // Restore active streams on startup & SEED if empty
  const streams = await storage.getStreams();
  
  if (streams.length === 0) {
    console.log("Seeding initial streams...");
    const seedStreams = [
      {
        name: "Chicago Police Zone 10",
        url: "https://broadcastify.cdnstream1.com/31652", // Example URL
        category: "Police",
        description: "Districts 10 and 11",
        status: "active"
      },
      {
        name: "FDNY Brooklyn",
        url: "https://broadcastify.cdnstream1.com/9358",
        category: "Fire",
        description: "Brooklyn Fire Dispatch",
        status: "active"
      },
      {
        name: "LA Fire Department",
        url: "https://broadcastify.cdnstream1.com/2846", 
        category: "Fire",
        description: "Metro Fire",
        status: "inactive"
      }
    ];

    for (const s of seedStreams) {
      const created = await storage.createStream(s);
      if (created.status === 'active') {
        monitorManager.startMonitoring(created.id, created.url);
      }
    }
  } else {
    for (const stream of streams) {
      if (stream.status === 'active') {
        monitorManager.startMonitoring(stream.id, stream.url);
      }
    }
  }

  app.get(api.streams.list.path, async (req, res) => {
    const streams = await storage.getStreams();
    res.json(streams);
  });

  app.get(api.streams.get.path, async (req, res) => {
    const stream = await storage.getStream(Number(req.params.id));
    if (!stream) {
      return res.status(404).json({ message: 'Stream not found' });
    }
    res.json(stream);
  });

  app.post(api.streams.create.path, async (req, res) => {
    try {
      const input = api.streams.create.input.parse(req.body);
      const stream = await storage.createStream(input);
      // Auto-start monitoring if created
      monitorManager.startMonitoring(stream.id, stream.url);
      res.status(201).json(stream);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.patch(api.streams.updateStatus.path, async (req, res) => {
    const id = Number(req.params.id);
    const { status } = req.body;
    
    const stream = await storage.updateStreamStatus(id, status);
    
    if (status === 'active') {
      monitorManager.startMonitoring(id, stream.url);
    } else {
      monitorManager.stopMonitoring(id);
    }
    
    res.json(stream);
  });

  app.delete(api.streams.delete.path, async (req, res) => {
    monitorManager.stopMonitoring(Number(req.params.id));
    res.status(204).send();
  });

  app.get(api.transcriptions.list.path, async (req, res) => {
    const streamId = Number(req.params.id);
    const limit = Number(req.query.limit) || 50;
    const items = await storage.getTranscriptions(streamId, limit);
    res.json(items);
  });

  return httpServer;
}
