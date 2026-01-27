import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertStreamSchema, type InsertStream } from "@shared/schema";
import { useCreateStream } from "@/hooks/use-streams";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export function CreateStreamDialog() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const createStream = useCreateStream();

  const form = useForm<InsertStream>({
    resolver: zodResolver(insertStreamSchema),
    defaultValues: {
      name: "",
      url: "",
      description: "",
      category: "Police",
    },
  });

  const onSubmit = async (data: InsertStream) => {
    try {
      await createStream.mutateAsync(data);
      toast({ title: "Stream Created", description: "Monitoring initialized successfully." });
      setOpen(false);
      form.reset();
    } catch (error) {
      toast({ 
        title: "Error", 
        description: error instanceof Error ? error.message : "Failed to create stream",
        variant: "destructive"
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20">
          <Plus className="w-4 h-4 mr-2" />
          Add Stream
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-card border-border shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">New Audio Stream</DialogTitle>
          <DialogDescription>
            Connect a new Broadcastify stream URL for real-time transcription.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="name">Stream Name</Label>
            <Input
              id="name"
              placeholder="e.g. Chicago Police Zone 1"
              {...form.register("name")}
              className="bg-secondary/30 border-input focus:border-primary"
            />
            {form.formState.errors.name && (
              <span className="text-xs text-destructive">{form.formState.errors.name.message}</span>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="url">Stream URL (MP3/AAC)</Label>
            <Input
              id="url"
              placeholder="https://broadcastify..."
              {...form.register("url")}
              className="bg-secondary/30 border-input font-mono text-xs focus:border-primary"
            />
            {form.formState.errors.url && (
              <span className="text-xs text-destructive">{form.formState.errors.url.message}</span>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select 
              onValueChange={(val) => form.setValue("category", val)}
              defaultValue={form.getValues("category") || "Police"}
            >
              <SelectTrigger className="bg-secondary/30 border-input">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Police">Police</SelectItem>
                <SelectItem value="Fire">Fire</SelectItem>
                <SelectItem value="EMS">EMS</SelectItem>
                <SelectItem value="Weather">Weather</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Input
              id="description"
              placeholder="Area coverage details..."
              {...form.register("description")}
              className="bg-secondary/30 border-input focus:border-primary"
            />
          </div>

          <div className="flex justify-end pt-4">
            <Button 
              type="submit" 
              disabled={createStream.isPending}
              className="w-full bg-primary hover:bg-primary/90"
            >
              {createStream.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                "Initialize Stream"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
