import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, ChevronDown, ChevronLeft, ChevronRight, Sparkles, Check } from "lucide-react";
import { GeneratedPlanResult } from "@/types/trainingPlan";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DEFAULT_DAYS = ["Tue", "Thu", "Sat", "Sun"];

const GEN_STEPS = [
  "Analyzing 90 days of training data...",
  "Calculating phase structure...",
  "Building Base → Build → Peak → Taper...",
  "Generating workouts...",
  "Syncing to Intervals.icu calendar...",
];

const GEN_DELAYS = [1500, 1500, 2000, 2000, 1500];

interface Props {
  onPlanGenerated: (eventDate: Date) => void;
  onScrollToCalendar: () => void;
  result: GeneratedPlanResult | null;
}

export function PlanGenerator({ onPlanGenerated, onScrollToCalendar, result }: Props) {
  const [open, setOpen] = useState(false);
  const [formStep, setFormStep] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [generatingStep, setGeneratingStep] = useState(0);
  const [done, setDone] = useState(false);

  // Form state
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState<Date>();
  const [eventType, setEventType] = useState("granfondo");
  const [difficulty, setDifficulty] = useState("moderate");
  const [trainingDays, setTrainingDays] = useState<string[]>(DEFAULT_DAYS);
  const [hoursPerWeek, setHoursPerWeek] = useState([10]);
  const [longestRide, setLongestRide] = useState("4h");
  const [philosophy, setPhilosophy] = useState("polarized");
  const [fitnessContext, setFitnessContext] = useState("consistent");
  const [priority, setPriority] = useState("a-race");

  const toggleDay = (day: string) => {
    setTrainingDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  const handleGenerate = async () => {
    if (!eventDate) return;
    setGenerating(true);
    setGeneratingStep(0);
    for (let i = 0; i < GEN_STEPS.length; i++) {
      setGeneratingStep(i);
      await new Promise((r) => setTimeout(r, GEN_DELAYS[i]));
    }
    setGeneratingStep(GEN_STEPS.length);
    setGenerating(false);
    setDone(true);
    onPlanGenerated(eventDate);
  };

  const philosophyOptions = [
    { value: "polarized", label: "Polarized", desc: "80% easy, 20% hard — science-backed for endurance athletes" },
    { value: "sweetspot", label: "Sweet Spot", desc: "Threshold-focused — time-efficient for busy athletes" },
    { value: "pyramidal", label: "Pyramidal", desc: "Progressive intensity distribution — balanced approach" },
    { value: "ai", label: "Let AI Decide", desc: "Claude analyzes your data and chooses the optimal approach" },
  ];

  // Step indicator
  const StepDots = () => (
    <div className="flex items-center justify-center gap-2 mb-4">
      {[1, 2, 3].map((s) => (
        <div
          key={s}
          className={cn(
            "w-2.5 h-2.5 rounded-full transition-colors",
            s === formStep ? "bg-primary" : s < formStep ? "bg-primary/50" : "bg-muted-foreground/30"
          )}
        />
      ))}
    </div>
  );

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            ✨ Generate AI Training Plan
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
                {GEN_STEPS.map((s, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                      i < generatingStep ? "bg-success text-success-foreground" :
                      i === generatingStep ? "bg-primary text-primary-foreground animate-pulse" :
                      "bg-muted text-muted-foreground"
                    )}>
                      {i < generatingStep ? <Check className="h-3 w-3" /> : i + 1}
                    </div>
                    <p className={cn("text-sm", i <= generatingStep ? "text-foreground" : "text-muted-foreground")}>{s}</p>
                  </div>
                ))}
                <Progress value={(generatingStep / (GEN_STEPS.length)) * 100} className="mt-4" />
              </div>
            ) : done && result ? (
              <div className="space-y-4 text-center py-4">
                <div className="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center mx-auto">
                  <Check className="h-6 w-6 text-success" />
                </div>
                <h3 className="font-semibold text-lg">Plan Generated!</h3>
                <div className="flex justify-center gap-2 text-sm flex-wrap">
                  {result.phases.map((p) => (
                    <span
                      key={p.id}
                      className="rounded-full px-3 py-1 text-xs font-medium"
                      style={{ backgroundColor: `${p.type === "BASE" ? "#3B82F6" : p.type === "BUILD" ? "#F97316" : p.type === "PEAK" ? "#EF4444" : p.type === "TAPER" ? "#22C55E" : "#6B7280"}22`, color: p.type === "BASE" ? "#3B82F6" : p.type === "BUILD" ? "#F97316" : p.type === "PEAK" ? "#EF4444" : p.type === "TAPER" ? "#22C55E" : "#6B7280" }}
                    >
                      {p.type} {p.weeks}w
                    </span>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">{result.totalWorkouts} workouts added to your Intervals.icu calendar</p>
                <p className="text-sm text-muted-foreground">CTL projection: Current: {result.currentCTL} → Peak: {result.projectedCTL} at event</p>
                <Button onClick={() => { onScrollToCalendar(); setOpen(false); }}>View Plan</Button>
              </div>
            ) : (
              <>
                <StepDots />

                {/* STEP 1 - Goal */}
                {formStep === 1 && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold">Step 1: Goal</h4>
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs">Event Name</Label>
                        <Input placeholder="e.g. L'Etape du Tour 2026" value={eventName} onChange={(e) => setEventName(e.target.value)} />
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
                            <Calendar mode="single" selected={eventDate} onSelect={setEventDate} disabled={(d) => d < new Date()} className="p-3 pointer-events-auto" />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div>
                        <Label className="text-xs">Event Type</Label>
                        <Select value={eventType} onValueChange={setEventType}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="granfondo">Gran Fondo</SelectItem>
                            <SelectItem value="climbing">Climbing Challenge</SelectItem>
                            <SelectItem value="stage">Stage Race</SelectItem>
                            <SelectItem value="century">Century Ride</SelectItem>
                            <SelectItem value="custom">Custom</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Estimated Difficulty</Label>
                        <RadioGroup value={difficulty} onValueChange={setDifficulty} className="mt-1 grid grid-cols-2 gap-2">
                          {[
                            { value: "easy", label: "Easy", desc: "< 100km" },
                            { value: "moderate", label: "Moderate", desc: "100-150km" },
                            { value: "hard", label: "Hard", desc: "150-200km" },
                            { value: "extreme", label: "Extreme", desc: "> 200km / mountains" },
                          ].map((o) => (
                            <Label
                              key={o.value}
                              htmlFor={`diff-${o.value}`}
                              className={cn(
                                "flex items-center gap-2 rounded-lg border p-3 cursor-pointer transition-colors",
                                difficulty === o.value ? "border-primary bg-primary/5" : "border-border hover:bg-accent"
                              )}
                            >
                              <RadioGroupItem value={o.value} id={`diff-${o.value}`} />
                              <div>
                                <span className="text-xs font-medium">{o.label}</span>
                                <span className="text-[10px] text-muted-foreground block">{o.desc}</span>
                              </div>
                            </Label>
                          ))}
                        </RadioGroup>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button onClick={() => setFormStep(2)}>
                        Next <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* STEP 2 - Availability */}
                {formStep === 2 && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold">Step 2: Availability</h4>
                    <div className="space-y-3">
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
                        <Slider min={5} max={20} step={0.5} value={hoursPerWeek} onValueChange={setHoursPerWeek} className="mt-2" />
                      </div>
                      <div>
                        <Label className="text-xs">Longest single ride</Label>
                        <Select value={longestRide} onValueChange={setLongestRide}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="2h">2 hours</SelectItem>
                            <SelectItem value="3h">3 hours</SelectItem>
                            <SelectItem value="4h">4 hours</SelectItem>
                            <SelectItem value="5h">5 hours</SelectItem>
                            <SelectItem value="6h+">6+ hours</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <Button variant="outline" onClick={() => setFormStep(1)}>
                        <ChevronLeft className="h-4 w-4 mr-1" /> Back
                      </Button>
                      <Button onClick={() => setFormStep(3)}>
                        Next <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* STEP 3 - Preferences */}
                {formStep === 3 && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold">Step 3: Preferences</h4>
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs">Training Philosophy</Label>
                        <RadioGroup value={philosophy} onValueChange={setPhilosophy} className="mt-2 space-y-2">
                          {philosophyOptions.map((o) => (
                            <Label
                              key={o.value}
                              htmlFor={`phil-${o.value}`}
                              className={cn(
                                "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                                philosophy === o.value ? "border-primary bg-primary/5" : "border-border hover:bg-accent"
                              )}
                            >
                              <RadioGroupItem value={o.value} id={`phil-${o.value}`} className="mt-0.5" />
                              <div>
                                <span className="text-sm font-medium">{o.label}</span>
                                <span className="text-xs text-muted-foreground block">{o.desc}</span>
                              </div>
                            </Label>
                          ))}
                        </RadioGroup>
                      </div>
                      <div>
                        <Label className="text-xs">Fitness Context</Label>
                        <Select value={fitnessContext} onValueChange={setFitnessContext}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="reentry">Re-entry after a break (capacity exceeds CTL)</SelectItem>
                            <SelectItem value="consistent">Consistent training (CTL reflects fitness)</SelectItem>
                            <SelectItem value="building">Building phase (progressive overload)</SelectItem>
                            <SelectItem value="postpeak">Post-peak / recovering</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Race Priority</Label>
                        <RadioGroup value={priority} onValueChange={setPriority} className="mt-1 space-y-1">
                          {[
                            { value: "a-race", label: "A-Race", desc: "Full taper, peak for this event" },
                            { value: "b-race", label: "B-Race", desc: "Partial taper" },
                            { value: "training", label: "Training Event", desc: "No taper, use as workout" },
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
                    <div className="flex justify-between">
                      <Button variant="outline" onClick={() => setFormStep(2)}>
                        <ChevronLeft className="h-4 w-4 mr-1" /> Back
                      </Button>
                      <Button onClick={handleGenerate} disabled={!eventDate}>
                        <Sparkles className="h-4 w-4 mr-2" /> Generate Plan
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
}
