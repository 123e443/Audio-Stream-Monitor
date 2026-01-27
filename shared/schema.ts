import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const streams = pgTable("streams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(), // Stream URL (MP3/AAC)
  description: text("description"),
  category: text("category").default("Police"), // Police, Fire, EMS
  status: text("status").default("inactive"), // active, inactive, error
  thumbnailUrl: text("thumbnail_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const transcriptions = pgTable("transcriptions", {
  id: serial("id").primaryKey(),
  streamId: integer("stream_id").notNull(),
  content: text("content").notNull(),
  confidence: integer("confidence"), // 0-100
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
};
