import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, ChevronDown, Sparkles, Check } from "lucide-react";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DEFAULT_DAYS = ["Tue", "Thu", "Sat", "Sun"];

const STEPS = [
  "Analyzing 90 days of training history...",
  "Calculating phase structure...",
  "Building Base → Build → Peak → Taper phases...",
  "Generating weekly workouts in Intervals.icu format...",
  "Syncing workouts to your calendar...",
];

interface Props {
  onScrollToCalendar: () => void;
}

export function PlanGenerator({ onScrollToCalendar }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0); // 0 = form, 1-3 = form steps
  const [generating, setGenerating] = useState(false);
  const [generatingStep, setGeneratingStep] = useState(0);
  const [done, setDone] = useState(false);

  // Form state
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState<Date>();
  const [eventType, setEventType] = useState("granfondo");
  const [trainingDays, setTrainingDays] = useState<string[]>(DEFAULT_DAYS);
  const [hoursPerWeek, setHoursPerWeek] = useState([10]);
  const [longestRide, setLongestRide] = useState("4h");
  const [philosophy, setPhilosophy] = useState("polarized");
  const [fitnessContext, setFitnessContext] = useState("steady");
  const [priority, setPriority] = useState("a-race");

  const toggleDay = (day: string) => {
    setTrainingDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setGeneratingStep(0);
    for (let i = 0; i < STEPS.length; i++) {
      setGeneratingStep(i);
      await new Promise((r) => setTimeout(r, 1200));
    }
    setGenerating(false);
    setDone(true);
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Generate AI Training Plan
          </span>
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-4">
        <Card>
          <CardContent className="p-6 space-y-6">
            {generating ? (
              <div className="space-y-4 py-4">
                <p className="text-sm font-medium text-center">Generating your plan...</p>
                {STEPS.map((s, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                      i < generatingStep ? "bg-success text-success-foreground" :
                      i === generatingStep ? "bg-primary text-primary-foreground animate-pulse" :
                      "bg-muted text-muted-foreground"
                    )}>
                      {i < generatingStep ? <Check className="h-3 w-3" /> : i + 1}
                    </div>
                    <p className={cn("text-sm", i <= generatingStep ? "text-foreground" : "text-muted-foreground")}>{s}</p>
                  </div>
                ))}
                <Progress value={(generatingStep / (STEPS.length - 1)) * 100} className="mt-4" />
              </div>
            ) : done ? (
              <div className="space-y-4 text-center py-4">
                <div className="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center mx-auto">
                  <Check className="h-6 w-6 text-success" />
                </div>
                <h3 className="font-semibold text-lg">Plan Generated!</h3>
                <div className="flex justify-center gap-2 text-sm">
                  <span className="rounded-full bg-primary/20 text-primary px-3 py-1">Base 6w</span>
                  <span className="rounded-full bg-warning/20 text-warning px-3 py-1">Build 8w</span>
                  <span className="rounded-full bg-destructive/20 text-destructive px-3 py-1">Peak 3w</span>
                  <span className="rounded-full bg-success/20 text-success px-3 py-1">Taper 2w</span>
                </div>
                <p className="text-sm text-muted-foreground">19 workouts added to your Intervals.icu calendar</p>
                <Button onClick={() => { onScrollToCalendar(); setOpen(false); }}>View in Calendar</Button>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">Based on your current fitness data and a target event</p>

                {/* Step 1: Goal Setup */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold">Step 1: Goal Setup</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Goal Event</Label>
                      <Input placeholder="L'Etape du Tour 2026" value={eventName} onChange={(e) => setEventName(e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Event Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className={cn("w-full justify-start text-left", !eventDate && "text-muted-foreground")}>
                            <CalendarIcon className="h-4 w-4 mr-2" />
                            {eventDate ? format(eventDate, "PPP") : "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={eventDate} onSelect={setEventDate} className="p-3 pointer-events-auto" />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div>
                      <Label className="text-xs">Event Type</Label>
                      <Select value={eventType} onValueChange={setEventType}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="granfondo">Gran Fondo</SelectItem>
                          <SelectItem value="stage">Stage Race</SelectItem>
                          <SelectItem value="century">Century Ride</SelectItem>
                          <SelectItem value="climbing">Climbing Challenge</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Step 2: Availability */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold">Step 2: Availability</h4>
                  <div>
                    <Label className="text-xs">Training Days</Label>
                    <div className="flex gap-2 mt-1">
                      {DAYS.map((d) => (
                        <button
                          key={d}
                          onClick={() => toggleDay(d)}
                          className={cn(
                            "rounded-md px-3 py-1.5 text-xs font-medium border transition-colors",
                            trainingDays.includes(d)
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-card text-muted-foreground border-border hover:bg-accent"
                          )}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Hours per week: {hoursPerWeek[0]}h</Label>
                    <Slider min={5} max={20} step={1} value={hoursPerWeek} onValueChange={setHoursPerWeek} className="mt-2" />
                  </div>
                  <div>
                    <Label className="text-xs">Longest single ride</Label>
                    <Select value={longestRide} onValueChange={setLongestRide}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["2h", "3h", "4h", "5h", "6h+"].map((v) => (
                          <SelectItem key={v} value={v}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Step 3: Preferences */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold">Step 3: Training Preferences</h4>
                  <div>
                    <Label className="text-xs">Training Philosophy</Label>
                    <RadioGroup value={philosophy} onValueChange={setPhilosophy} className="mt-1 space-y-1">
                      {[
                        { value: "polarized", label: "Polarized", desc: "80% easy / 20% hard" },
                        { value: "sweetspot", label: "Sweet Spot", desc: "Threshold-focused, time-efficient" },
                        { value: "pyramidal", label: "Pyramidal", desc: "Most volume easy, some moderate" },
                        { value: "ai", label: "Let AI decide", desc: "Based on your data" },
                      ].map((o) => (
                        <div key={o.value} className="flex items-center gap-2">
                          <RadioGroupItem value={o.value} id={o.value} />
                          <Label htmlFor={o.value} className="text-xs font-normal">
                            {o.label} <span className="text-muted-foreground">— {o.desc}</span>
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                  <div>
                    <Label className="text-xs">Fitness Context</Label>
                    <Select value={fitnessContext} onValueChange={setFitnessContext}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="reentry">Re-entry after a break</SelectItem>
                        <SelectItem value="steady">Steady-state / consistent</SelectItem>
                        <SelectItem value="building">Building phase</SelectItem>
                        <SelectItem value="fatigued">Coming off a peak / fatigued</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Race Priority</Label>
                    <RadioGroup value={priority} onValueChange={setPriority} className="mt-1 space-y-1">
                      {[
                        { value: "a-race", label: "A-Race", desc: "Full taper" },
                        { value: "b-race", label: "B-Race", desc: "Partial taper" },
                        { value: "training", label: "Training ride", desc: "No taper" },
                      ].map((o) => (
                        <div key={o.value} className="flex items-center gap-2">
                          <RadioGroupItem value={o.value} id={`pri-${o.value}`} />
                          <Label htmlFor={`pri-${o.value}`} className="text-xs font-normal">
                            {o.label} <span className="text-muted-foreground">— {o.desc}</span>
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                </div>

                <Button onClick={handleGenerate} className="w-full">
                  <Sparkles className="h-4 w-4 mr-2" /> Generate Plan
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
}
