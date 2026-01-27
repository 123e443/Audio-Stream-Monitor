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

  const streams = await storage.getStreams();
  
  if (streams.length === 0) {
    console.log("Seeding initial streams...");
    const seedStreams = [
      {
        name: "Chicago Police Zone 10",
        url: "https://broadcastify.cdnstream1.com/31652",
        category: "Police",
        description: "Districts 10 and 11",
        latitude: 41.8781,
        longitude: -87.6298,
        city: "Chicago, IL"
      },
      {
        name: "FDNY Brooklyn",
        url: "https://broadcastify.cdnstream1.com/9358",
        category: "Fire",
        description: "Brooklyn Fire Dispatch",
        latitude: 40.6782,
        longitude: -73.9442,
        city: "Brooklyn, NY"
      },
      {
        name: "LA Fire Department",
        url: "https://broadcastify.cdnstream1.com/2846", 
        category: "Fire",
        description: "Metro Fire",
        latitude: 34.0522,
        longitude: -118.2437,
        city: "Los Angeles, CA"
      },
      {
        name: "Calgary Municipal Radio Network",
        url: "https://broadcastify.cdnstream1.com/38040",
        category: "Fire",
        description: "Calgary Fire Department dispatch and scene communications",
        latitude: 51.0447,
        longitude: -114.0719,
        city: "Calgary, AB"
      }
    ];

    for (const s of seedStreams) {
      const created = await storage.createStream(s);
      if (s.name !== "LA Fire Department") {
        await monitorManager.startMonitoring(created.id, created.url);
      }
    }
  } else {
    for (const stream of streams) {
      if (stream.status === 'active') {
        await monitorManager.startMonitoring(stream.id, stream.url);
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
      await monitorManager.startMonitoring(stream.id, stream.url);
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
      await monitorManager.startMonitoring(id, stream.url);
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

  app.get(api.transcriptions.all.path, async (req, res) => {
    const limit = Number(req.query.limit) || 100;
    const withLocation = req.query.withLocation === 'true';
    const items = await storage.getAllTranscriptions(limit, withLocation);
    res.json(items);
  });

  return httpServer;
}
