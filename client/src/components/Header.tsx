import { Link, useLocation } from "wouter";
import { Radio, Activity, LayoutDashboard, Settings, Map } from "lucide-react";

export function Header() {
  const [location] = useLocation();

  return (
    <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
            <Radio className="w-5 h-5 text-primary animate-pulse" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white leading-none">
              Aether<span className="text-primary">Monitor</span>
            </h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono">
              Public Safety Intelligence
            </p>
          </div>
        </div>

        <nav className="flex items-center gap-1">
          <Link href="/" className={`
            px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2
            ${location === "/" 
              ? "bg-primary/10 text-primary" 
              : "text-muted-foreground hover:text-white hover:bg-white/5"}
          `}>
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </Link>
          <Link href="/map" className={`
            px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2
            ${location === "/map" 
              ? "bg-primary/10 text-primary" 
              : "text-muted-foreground hover:text-white hover:bg-white/5"}
          `}>
            <Map className="w-4 h-4" />
            Map
          </Link>
          <div className="w-px h-4 bg-border/50 mx-2" />
          <div className="px-3 py-1.5 rounded-full bg-secondary/50 border border-white/5 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)] animate-pulse" />
            <span className="text-xs font-mono text-muted-foreground">SYSTEM ONLINE</span>
          </div>
        </nav>
      </div>
    </header>
  );
}
