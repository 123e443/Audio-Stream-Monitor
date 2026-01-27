import { useStreams } from "@/hooks/use-streams";
import { CreateStreamDialog } from "@/components/CreateStreamDialog";
import { StreamCard } from "@/components/StreamCard";
import { Header } from "@/components/Header";
import { Radio, Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function Dashboard() {
  const { data: streams, isLoading, error } = useStreams();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");

  const filteredStreams = streams?.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) || 
                          s.description?.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "All" || s.category === filter;
    return matchesSearch && matchesFilter;
  });

  const categories = ["All", "Police", "Fire", "EMS", "Weather"];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">Active Channels</h2>
            <p className="text-muted-foreground">Real-time radio monitoring and transcription</p>
          </div>
          <CreateStreamDialog />
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col md:flex-row gap-4 mb-8 bg-card/30 p-4 rounded-xl border border-border/50 backdrop-blur-sm">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search frequencies..."
              className="pl-9 bg-background/50 border-border focus:border-primary transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`
                  px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap border
                  ${filter === cat 
                    ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20" 
                    : "bg-background/50 text-muted-foreground border-border hover:border-primary/50 hover:text-white"}
                `}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-4">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
                <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
              </div>
              <p className="text-muted-foreground animate-pulse">Scanning frequencies...</p>
            </div>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-8 text-center">
            <Radio className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-bold text-destructive mb-2">Connection Error</h3>
            <p className="text-destructive/80">Unable to reach the broadcast server. Please try again.</p>
          </div>
        ) : filteredStreams?.length === 0 ? (
          <div className="rounded-xl border border-border/50 bg-card/30 p-12 text-center">
            <Radio className="w-16 h-16 text-muted mx-auto mb-6 opacity-20" />
            <h3 className="text-xl font-bold text-white mb-2">No Streams Active</h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-8">
              There are no streams matching your criteria. Add a new stream to begin monitoring.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {filteredStreams?.map((stream) => (
                <StreamCard key={stream.id} stream={stream} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>
    </div>
  );
}
