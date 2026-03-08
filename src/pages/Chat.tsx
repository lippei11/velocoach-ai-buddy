import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, Plus, Send, MoreVertical, Trash2, Pencil, Menu, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import ReactMarkdown from "react-markdown";
import { useIsMobile } from "@/hooks/use-mobile";

interface Conversation {
  id: string;
  title: string;
  created_at: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

const SUGGESTION_CHIPS = [
  "How should I train this week given my current form?",
  "What are my biggest limiters based on my power data?",
  "I'm tired today — should I do the planned hard session?",
];

export default function Chat() {
  const isMobile = useIsMobile();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [editTitleValue, setEditTitleValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Load conversations
  useEffect(() => {
    loadConversations();
  }, []);

  // Load messages when conversation changes
  useEffect(() => {
    if (activeConvId) {
      loadMessages(activeConvId);
    } else {
      setMessages([]);
    }
  }, [activeConvId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  async function loadConversations() {
    setLoadingConvs(true);
    const { data, error } = await supabase
      .from("conversations")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Failed to load conversations:", error);
    } else {
      setConversations(data ?? []);
    }
    setLoadingConvs(false);
  }

  async function loadMessages(convId: string) {
    setLoadingMsgs(true);
    const { data, error } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true });
    if (error) {
      console.error("Failed to load messages:", error);
    } else {
      setMessages((data ?? []) as Message[]);
    }
    setLoadingMsgs(false);
  }

  function handleNewChat() {
    setActiveConvId(null);
    setMessages([]);
    if (isMobile) setSidebarOpen(false);
  }

  function selectConversation(id: string) {
    setActiveConvId(id);
    if (isMobile) setSidebarOpen(false);
  }

  async function deleteConversation(id: string) {
    await supabase.from("chat_messages").delete().eq("conversation_id", id);
    await supabase.from("conversations").delete().eq("id", id);
    if (activeConvId === id) {
      setActiveConvId(null);
      setMessages([]);
    }
    loadConversations();
    toast.success("Conversation deleted");
  }

  async function renameConversation(id: string, newTitle: string) {
    await supabase.from("conversations").update({ title: newTitle }).eq("id", id);
    setEditingTitle(null);
    loadConversations();
  }

  async function sendMessage(text?: string) {
    const msg = text ?? input.trim();
    if (!msg || isStreaming) return;
    setInput("");

    // Optimistic user message
    const tempUserMsg: Message = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: msg,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setIsStreaming(true);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in to use the AI Coach");
        setIsStreaming(false);
        return;
      }

      const res = await fetch(`${supabaseUrl}/functions/v1/ai-coach`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
          apikey: supabaseKey,
        },
        body: JSON.stringify({
          message: msg,
          conversationId: activeConvId,
          history: messages.filter((m) => m.id !== tempUserMsg.id).map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Coach is unavailable");
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantContent = "";
      let newConvId = activeConvId;

      // Create placeholder assistant message
      const assistantMsgId = `assistant-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        { id: assistantMsgId, role: "assistant", content: "", created_at: new Date().toISOString() },
      ]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);

          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6);
          try {
            const event = JSON.parse(jsonStr);
            if (event.type === "meta" && event.conversationId) {
              newConvId = event.conversationId;
              if (!activeConvId) {
                setActiveConvId(newConvId);
              }
            } else if (event.type === "delta" && event.text) {
              assistantContent += event.text;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId ? { ...m, content: assistantContent } : m
                )
              );
            }
          } catch {
            // partial JSON
          }
        }
      }

      // Reload conversations to get the new one
      loadConversations();
      // Reload messages to get real IDs
      if (newConvId) {
        setTimeout(() => loadMessages(newConvId!), 500);
      }
    } catch (e: any) {
      console.error("Chat error:", e);
      toast.error(e.message || "Coach is unavailable — try again", {
        action: {
          label: "Retry",
          onClick: () => sendMessage(msg),
        },
      });
      // Remove optimistic messages on error
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
    } finally {
      setIsStreaming(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const activeConv = conversations.find((c) => c.id === activeConvId);
  const showSuggestions = messages.length === 0 && !loadingMsgs;

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden -m-6">
      {/* Sidebar */}
      {(sidebarOpen || !isMobile) && (
        <div
          className={`${
            isMobile ? "absolute inset-0 z-50 bg-background" : "relative"
          } flex flex-col border-r border-border bg-sidebar-background`}
          style={{ width: isMobile ? "100%" : 280, minWidth: isMobile ? "100%" : 280 }}
        >
          <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
            <h2 className="text-sm font-semibold text-foreground">Conversations</h2>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleNewChat}>
                <Plus className="h-4 w-4" />
              </Button>
              {isMobile && (
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSidebarOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          <ScrollArea className="flex-1">
            {loadingConvs ? (
              <div className="p-3 space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-6 text-center">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Start your first conversation</p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => selectConversation(conv.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-md transition-colors text-sm ${
                      activeConvId === conv.id
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                    }`}
                  >
                    {editingTitle === conv.id ? (
                      <input
                        autoFocus
                        className="w-full bg-transparent border-b border-primary outline-none text-foreground"
                        value={editTitleValue}
                        onChange={(e) => setEditTitleValue(e.target.value)}
                        onBlur={() => renameConversation(conv.id, editTitleValue)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") renameConversation(conv.id, editTitleValue);
                          if (e.key === "Escape") setEditingTitle(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <>
                        <div className="truncate font-medium">{conv.title}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {formatDistanceToNow(new Date(conv.created_at!), { addSuffix: true })}
                        </div>
                      </>
                    )}
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      )}

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
          <div className="flex items-center gap-2">
            {isMobile && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSidebarOpen(true)}>
                <Menu className="h-4 w-4" />
              </Button>
            )}
            <span className="text-lg">🚴</span>
            <h1 className="text-sm font-semibold truncate">
              {activeConv?.title ?? "VeloCoach AI"}
            </h1>
          </div>
          {activeConvId && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    setEditingTitle(activeConvId);
                    setEditTitleValue(activeConv?.title ?? "");
                  }}
                >
                  <Pencil className="h-4 w-4 mr-2" /> Rename
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => deleteConversation(activeConvId)}
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 px-4 py-4">
          {loadingMsgs ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
                  <Skeleton className="h-16 w-3/5 rounded-xl" />
                </div>
              ))}
            </div>
          ) : showSuggestions ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-6">
              <div className="text-center">
                <span className="text-4xl mb-3 block">🚴</span>
                <h2 className="text-lg font-semibold text-foreground">VeloCoach AI</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Your personal cycling coach, powered by your training data
                </p>
              </div>
              <div className="flex flex-col gap-2 w-full max-w-md">
                {SUGGESTION_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    onClick={() => sendMessage(chip)}
                    className="text-left px-4 py-3 rounded-lg border border-border bg-card hover:bg-accent transition-colors text-sm text-foreground"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4 max-w-3xl mx-auto">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div className="flex gap-2 max-w-[70%]">
                    {msg.role === "assistant" && (
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-accent flex items-center justify-center text-sm mt-1">
                        🚴
                      </div>
                    )}
                    <div>
                      <div
                        className={`rounded-2xl px-4 py-2.5 text-sm ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground rounded-br-md"
                            : "bg-accent text-accent-foreground rounded-bl-md"
                        }`}
                      >
                        {msg.role === "assistant" ? (
                          <div className="prose prose-sm prose-invert max-w-none [&>p]:my-1 [&>ul]:my-1 [&>ol]:my-1">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1 px-1">
                        {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
                <div className="flex justify-start">
                  <div className="flex gap-2">
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-accent flex items-center justify-center text-sm">
                      🚴
                    </div>
                    <div className="rounded-2xl rounded-bl-md bg-accent px-4 py-3 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        {/* Input */}
        <div className="border-t border-border bg-card p-4">
          <div className="max-w-3xl mx-auto flex gap-2 items-end">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask your coach..."
              disabled={isStreaming}
              className="resize-none min-h-[44px] max-h-[120px] bg-background border-border"
              rows={1}
            />
            <Button
              size="icon"
              onClick={() => sendMessage()}
              disabled={!input.trim() || isStreaming}
              className="h-11 w-11 shrink-0"
            >
              {isStreaming ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
