import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { spawn } from "child_process";
import ffmpeg from "fluent-ffmpeg";
import path from "path";
import fs from "fs";

// Mocking the Whisper node wrapper for now to ensure stability in the initial build
// In a production environment with proper C++ build tools, we would import 'nodejs-whisper'
// or use the 'whisper-node' package.
// For this MVP, we will simulate transcription to demonstrate the architecture 
// or try to use a CLI if available.

export class MonitorManager {
  private activeMonitors: Map<number, any> = new Map();
  private wss: WebSocketServer;

  constructor(wss: WebSocketServer) {
    this.wss = wss;
  }

  startMonitoring(streamId: number, streamUrl: string) {
    if (this.activeMonitors.has(streamId)) {
      console.log(`Stream ${streamId} already being monitored`);
      return;
    }

    console.log(`Starting monitor for stream ${streamId}: ${streamUrl}`);

    // Update status to active
    storage.updateStreamStatus(streamId, 'active');

    // In a real whisper.cpp implementation:
    // 1. ffmpeg stream -> convert to 16khz wav chunks
    // 2. feed chunks to whisper process
    // 3. get stdout text -> db

    // Simulation for reliability in this demo environment:
    const interval = setInterval(async () => {
      // Mock transcription generation
      // In reality, this would be the callback from the whisper process
      await this.generateMockTranscription(streamId);
    }, 5000); // New line every 5 seconds

    this.activeMonitors.set(streamId, interval);
  }

  stopMonitoring(streamId: number) {
    const monitor = this.activeMonitors.get(streamId);
    if (monitor) {
      clearInterval(monitor);
      this.activeMonitors.delete(streamId);
      storage.updateStreamStatus(streamId, 'inactive');
      console.log(`Stopped monitoring stream ${streamId}`);
    }
  }

  private async generateMockTranscription(streamId: number) {
    // Simulated radio chatter
    const mockPhrases = [
      "Unit 10-4, proceeding to location.",
      "Dispatch, we have a code 3 on Main St.",
      "Suspect describes as male, late 20s, red hoodie.",
      "Fire department arriving on scene.",
      "EMS requested at 405 highway.",
      "Status check on unit 4.",
      "Clear the channel for emergency traffic.",
      "Suspect in custody.",
      "Traffic stop at 5th and Elm.",
      "Copy that, 10-4."
    ];
    
    const content = mockPhrases[Math.floor(Math.random() * mockPhrases.length)];
    
    const transcription = await storage.createTranscription({
      streamId,
      content,
      confidence: 95,
    });

    // Broadcast to connected clients
    this.broadcast({
      type: 'transcription',
      payload: {
        streamId,
        content: transcription.content,
        timestamp: transcription.timestamp?.toISOString()
      }
    });
  }

  private broadcast(data: any) {
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  }
}
