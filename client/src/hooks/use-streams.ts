import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type InsertStream, type InsertTranscription } from "@shared/routes";

// ============================================
// STREAMS HOOKS
// ============================================

export function useStreams() {
  return useQuery({
    queryKey: [api.streams.list.path],
    queryFn: async () => {
      const res = await fetch(api.streams.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch streams");
      return api.streams.list.responses[200].parse(await res.json());
    },
  });
}

export function useStream(id: number) {
  return useQuery({
    queryKey: [api.streams.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.streams.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch stream");
      return api.streams.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}

export function useCreateStream() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertStream) => {
      const validated = api.streams.create.input.parse(data);
      const res = await fetch(api.streams.create.path, {
        method: api.streams.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 400) {
          const error = api.streams.create.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error("Failed to create stream");
      }
      return api.streams.create.responses[201].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.streams.list.path] }),
  });
}

export function useDeleteStream() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.streams.delete.path, { id });
      const res = await fetch(url, {
        method: api.streams.delete.method,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete stream");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.streams.list.path] }),
  });
}

export function useUpdateStreamStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: number; status: 'active' | 'inactive' | 'error' }) => {
      const url = buildUrl(api.streams.updateStatus.path, { id });
      const res = await fetch(url, {
        method: api.streams.updateStatus.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update status");
      return api.streams.updateStatus.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.streams.list.path] });
    },
  });
}

// ============================================
// TRANSCRIPTION HOOKS
// ============================================

export function useTranscriptions(streamId: number) {
  return useQuery({
    queryKey: [api.transcriptions.list.path, streamId],
    queryFn: async () => {
      const url = buildUrl(api.transcriptions.list.path, { id: streamId });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch transcriptions");
      return api.transcriptions.list.responses[200].parse(await res.json());
    },
    refetchInterval: 2000, // Poll every 2s for "live" feel
    enabled: !!streamId,
  });
}
