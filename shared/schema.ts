import { pgTable, text, serial, integer, boolean, timestamp, jsonb, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const streams = pgTable("streams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  description: text("description"),
  category: text("category").default("Police"),
  status: text("status").default("inactive"),
  thumbnailUrl: text("thumbnail_url"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  city: text("city"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const transcriptions = pgTable("transcriptions", {
  id: serial("id").primaryKey(),
  streamId: integer("stream_id").notNull(),
  content: text("content").notNull(),
  confidence: integer("confidence"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  address: text("address"),
  callType: text("call_type"),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const insertStreamSchema = createInsertSchema(streams).omit({ 
  id: true, 
  createdAt: true,
  status: true 
});

export const insertTranscriptionSchema = createInsertSchema(transcriptions).omit({ 
  id: true, 
  timestamp: true 
});

export type Stream = typeof streams.$inferSelect;
export type InsertStream = z.infer<typeof insertStreamSchema>;
export type Transcription = typeof transcriptions.$inferSelect;
export type InsertTranscription = z.infer<typeof insertTranscriptionSchema>;

export type TranscriptionUpdate = {
  streamId: number;
  content: string;
  timestamp: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  callType?: string;
};
