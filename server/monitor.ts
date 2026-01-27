import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";

interface StreamLocation {
  latitude: number;
  longitude: number;
  city: string;
}

const STREAM_LOCATIONS: Record<number, StreamLocation> = {};

export class MonitorManager {
  private activeMonitors: Map<number, any> = new Map();
  private wss: WebSocketServer;

  constructor(wss: WebSocketServer) {
    this.wss = wss;
  }

  async startMonitoring(streamId: number, streamUrl: string) {
    if (this.activeMonitors.has(streamId)) {
      console.log(`Stream ${streamId} already being monitored`);
      return;
    }

    console.log(`Starting monitor for stream ${streamId}: ${streamUrl}`);

    const stream = await storage.getStream(streamId);
    if (stream && stream.latitude && stream.longitude && stream.city) {
      STREAM_LOCATIONS[streamId] = {
        latitude: stream.latitude,
        longitude: stream.longitude,
        city: stream.city
      };
    }

    storage.updateStreamStatus(streamId, 'active');

    const interval = setInterval(async () => {
      await this.generateMockTranscription(streamId);
    }, 5000);

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
    const mockCalls = [
      { content: "Unit 10-4, proceeding to location.", callType: "Dispatch" },
      { content: "Dispatch, we have a code 3 on Main St.", callType: "Emergency" },
      { content: "Suspect described as male, late 20s, red hoodie.", callType: "BOLO" },
      { content: "Fire department arriving on scene.", callType: "Fire" },
      { content: "EMS requested at 405 highway.", callType: "Medical" },
      { content: "Status check on unit 4.", callType: "Status" },
      { content: "Clear the channel for emergency traffic.", callType: "Priority" },
      { content: "Suspect in custody.", callType: "Arrest" },
      { content: "Traffic stop at 5th and Elm.", callType: "Traffic" },
      { content: "Copy that, 10-4.", callType: "Acknowledgment" },
      { content: "Structure fire reported, multiple units responding.", callType: "Fire" },
      { content: "Medical emergency, cardiac arrest.", callType: "Medical" },
      { content: "Vehicle collision, requesting traffic control.", callType: "Traffic" },
      { content: "Burglary in progress, silent approach.", callType: "Crime" },
    ];
    
    const mockAddresses = [
      "123 Main Street",
      "456 Oak Avenue",
      "789 Park Boulevard",
      "101 First Street",
      "202 Second Avenue",
      "303 Third Street",
      "404 Fourth Avenue",
      "505 Fifth Street",
      "1200 Industrial Way",
      "850 Commerce Drive",
    ];

    const call = mockCalls[Math.floor(Math.random() * mockCalls.length)];
    const address = mockAddresses[Math.floor(Math.random() * mockAddresses.length)];
    
    const location = STREAM_LOCATIONS[streamId];
    let lat: number | undefined;
    let lng: number | undefined;
    
    if (location) {
      lat = location.latitude + (Math.random() - 0.5) * 0.05;
      lng = location.longitude + (Math.random() - 0.5) * 0.05;
    }
    
    const transcription = await storage.createTranscription({
      streamId,
      content: call.content,
      confidence: 90 + Math.floor(Math.random() * 10),
      latitude: lat,
      longitude: lng,
      address: address,
      callType: call.callType,
    });

    this.broadcast({
      type: 'transcription',
      payload: {
        streamId,
        content: transcription.content,
        timestamp: transcription.timestamp?.toISOString(),
        latitude: transcription.latitude,
        longitude: transcription.longitude,
        address: transcription.address,
        callType: transcription.callType,
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
