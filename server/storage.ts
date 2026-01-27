import { streams, transcriptions, type Stream, type InsertStream, type Transcription, type InsertTranscription } from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  getStreams(): Promise<Stream[]>;
  getStream(id: number): Promise<Stream | undefined>;
  createStream(stream: InsertStream): Promise<Stream>;
  updateStreamStatus(id: number, status: string): Promise<Stream>;
  
  getTranscriptions(streamId: number, limit?: number): Promise<Transcription[]>;
  createTranscription(transcription: InsertTranscription): Promise<Transcription>;
}

export class DatabaseStorage implements IStorage {
  async getStreams(): Promise<Stream[]> {
    return await db.select().from(streams).orderBy(desc(streams.createdAt));
  }

  async getStream(id: number): Promise<Stream | undefined> {
    const [stream] = await db.select().from(streams).where(eq(streams.id, id));
    return stream;
  }

  async createStream(insertStream: InsertStream): Promise<Stream> {
    const [stream] = await db.insert(streams).values(insertStream).returning();
    return stream;
  }

  async updateStreamStatus(id: number, status: string): Promise<Stream> {
    const [stream] = await db.update(streams)
      .set({ status })
      .where(eq(streams.id, id))
      .returning();
    return stream;
  }

  async getTranscriptions(streamId: number, limit = 50): Promise<Transcription[]> {
    return await db.select()
      .from(transcriptions)
      .where(eq(transcriptions.streamId, streamId))
      .orderBy(desc(transcriptions.timestamp))
      .limit(limit);
  }

  async createTranscription(insertTranscription: InsertTranscription): Promise<Transcription> {
    const [transcription] = await db.insert(transcriptions)
      .values(insertTranscription)
      .returning();
    return transcription;
  }
}

export const storage = new DatabaseStorage();
