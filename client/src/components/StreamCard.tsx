import { Play, Pause, Activity, Radio, Signal, Wifi } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import type { Stream } from "@shared/schema";

interface StreamCardProps {
  stream: Stream;
}

export function StreamCard({ stream }: StreamCardProps) {
  const isActive = stream.status === "active";
  const isError = stream.status === "error";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      className="group relative overflow-hidden rounded-xl bg-card border border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-[0_0_30px_-5px_rgba(59,130,246,0.15)]"
    >
      {/* Background decoration */}
      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
        <Wifi className="w-24 h-24 -mr-8 -mt-8" />
      </div>

      <div className="p-6 relative z-10">
        <div className="flex justify-between items-start mb-4">
          <div className={`
            inline-flex items-center px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider border
            ${isActive 
              ? "bg-green-500/10 text-green-400 border-green-500/20 shadow-[0_0_10px_rgba(34,197,94,0.1)]" 
              : isError 
                ? "bg-red-500/10 text-red-400 border-red-500/20"
                : "bg-slate-500/10 text-slate-400 border-slate-500/20"}
          `}>
            {stream.status === 'active' && <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-2 animate-pulse" />}
            {stream.status}
          </div>
          
          <div className="text-xs font-mono text-muted-foreground bg-secondary/50 px-2 py-1 rounded">
            {stream.category}
          </div>
        </div>

        <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-primary transition-colors truncate">
          {stream.name}
        </h3>
        <p className="text-sm text-muted-foreground line-clamp-2 mb-6 h-10">
          {stream.description || "No description available"}
        </p>

        <div className="flex items-center justify-between mt-auto">
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
            <Activity className="w-3 h-3 text-primary" />
            <span>98% UPTIME</span>
          </div>

          <Link href={`/streams/${stream.id}`}>
            <button className="
              px-4 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium
              hover:bg-primary hover:text-white hover:shadow-lg hover:shadow-primary/25
              active:scale-95 transition-all duration-200 flex items-center gap-2
            ">
              <Play className="w-3.5 h-3.5 fill-current" />
              Monitor
            </button>
          </Link>
        </div>
      </div>
      
      {/* Active scanning line effect */}
      {isActive && (
        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />
      )}
    </motion.div>
  );
}
