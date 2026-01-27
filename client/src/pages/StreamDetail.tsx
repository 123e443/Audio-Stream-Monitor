import { useStream, useTranscriptions, useDeleteStream } from "@/hooks/use-streams";
import { useParams, useLocation } from "wouter";
import { Header } from "@/components/Header";
import { ArrowLeft, Trash2, Mic, Volume2, Clock, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function StreamDetail() {
  const { id } = useParams();
  const [_, setLocation] = useLocation();
  const streamId = Number(id);
  
  const { data: stream, isLoading: streamLoading } = useStream(streamId);
  const { data: transcriptions, isLoading: transLoading } = useTranscriptions(streamId);
  const deleteStream = useDeleteStream();

  const scrollRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Auto-scroll to bottom of log
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcriptions]);

  const handleDelete = async () => {
    try {
      await deleteStream.mutateAsync(streamId);
      setLocation("/");
    } catch (error) {
      console.error(error);
    }
  };

  if (streamLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full"/></div>;
  if (!stream) return <div>Stream not found</div>;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      
      {/* Top Controls Bar */}
      <div className="border-b border-border/50 bg-card/50 backdrop-blur p-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setLocation("/")}
              className="hover:bg-white/5 text-muted-foreground hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                {stream.name}
                {stream.status === 'active' && <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_#22c55e]" />}
              </h1>
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono mt-1">
                <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded">{stream.category}</span>
                <span>•</span>
                <span>{stream.url}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
             {/* Audio Player Control */}
             <div className="bg-background/50 rounded-lg p-2 flex items-center gap-3 border border-border">
                <audio 
                  ref={audioRef}
                  src={stream.url} 
                  controls 
                  className="h-8 w-64 opacity-80 hover:opacity-100 transition-opacity"
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                />
             </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="icon" className="bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-card border-border">
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Stream?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently remove monitoring for this channel. History will be lost.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="border-border hover:bg-secondary">Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

      {/* Main Content: Split View */}
      <div className="flex-1 container mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-140px)]">
        
        {/* Left: Visualizer/Stats (Placeholder for visualizer) */}
        <div className="hidden lg:flex flex-col gap-6">
          <div className="bg-card rounded-xl border border-border/50 p-6 flex-1 flex flex-col items-center justify-center relative overflow-hidden">
             {/* Fake visualizer bars */}
             <div className="flex items-end gap-1 h-32 mb-4">
                {[...Array(20)].map((_, i) => (
                  <div 
                    key={i} 
                    className={`w-2 bg-primary/50 rounded-t-sm transition-all duration-100 ${isPlaying ? 'animate-pulse' : ''}`}
                    style={{ 
                      height: isPlaying ? `${Math.random() * 100}%` : '10%',
                      animationDelay: `${i * 0.05}s` 
                    }} 
                  />
                ))}
             </div>
             <p className="text-xs font-mono text-muted-foreground tracking-widest uppercase">
               {isPlaying ? "LIVE AUDIO FEED" : "AUDIO PAUSED"}
             </p>
          </div>
          
          <div className="bg-card rounded-xl border border-border/50 p-6 h-1/3">
             <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
               <AlertCircle className="w-4 h-4 text-primary" />
               Stream Health
             </h3>
             <div className="space-y-4">
               <div className="flex justify-between text-sm">
                 <span className="text-muted-foreground">Bitrate</span>
                 <span className="font-mono text-white">128 kbps</span>
               </div>
               <div className="flex justify-between text-sm">
                 <span className="text-muted-foreground">Listeners</span>
                 <span className="font-mono text-white">42</span>
               </div>
               <div className="flex justify-between text-sm">
                 <span className="text-muted-foreground">Uptime</span>
                 <span className="font-mono text-green-400">99.9%</span>
               </div>
             </div>
          </div>
        </div>

        {/* Right: Live Log */}
        <div className="lg:col-span-2 bg-black rounded-xl border border-border/50 flex flex-col overflow-hidden shadow-2xl relative">
          <div className="bg-secondary/20 p-3 border-b border-border/50 flex items-center justify-between">
             <div className="flex items-center gap-2">
               <Mic className="w-4 h-4 text-primary animate-pulse" />
               <h3 className="text-sm font-semibold text-white">Live Transcription Log</h3>
             </div>
             <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
               <div className="w-2 h-2 rounded-full bg-green-500" />
               REAL-TIME
             </div>
          </div>

          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 space-y-1 font-mono text-sm custom-scrollbar bg-black/50"
          >
            {transLoading ? (
               <div className="h-full flex items-center justify-center text-muted-foreground">
                 Loading history...
               </div>
            ) : transcriptions?.length === 0 ? (
               <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
                 <Mic className="w-8 h-8 mb-2" />
                 <p>Waiting for audio...</p>
               </div>
            ) : (
              transcriptions?.map((item) => (
                <div key={item.id} className="group hover:bg-white/5 p-2 rounded transition-colors flex gap-4">
                  <span className="text-primary/60 text-xs py-1 min-w-[70px]">
                    {item.timestamp ? format(new Date(item.timestamp), 'HH:mm:ss') : '--:--:--'}
                  </span>
                  <p className="text-gray-300 leading-relaxed">
                    {item.content}
                  </p>
                </div>
              ))
            )}
            
            {/* Blinking cursor at bottom */}
            <div className="h-4 w-2 bg-primary/50 animate-pulse mt-2 ml-2" />
          </div>
          
          {/* Scanline overlay */}
          <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-10 bg-[length:100%_2px,3px_100%] opacity-20" />
        </div>
      </div>
    </div>
  );
}
