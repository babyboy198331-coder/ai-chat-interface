"use client";

import Sidebar from "./components/Sidebar";
import MessageBubble from "./components/MessageBubble";
import { useState, useEffect, useRef, useCallback } from "react";

const MODELS = {
  "deepseek-v3.2": "DeepSeek V3.2",
  "gemma-4-31b":   "Gemma 4 31B",
  "llama-3.3-70b": "Llama 3.3 70B",
  "ministral-8b":  "Ministral 8B",
};

const SUGGESTIONS = [
  { icon: "💡", text: "Explain JavaScript closures with an example" },
  { icon: "⚛️", text: "Write a custom React hook for debouncing input" },
  { icon: "✉️", text: "Draft a professional follow-up email after an interview" },
  { icon: "🗺️", text: "Plan a 3-day weekend trip itinerary" },
];

export default function Home() {
  const [expand, setExpand] = useState(false);
  const [chatSessions, setChatSessions] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [text, setText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [model, setModel] = useState("deepseek-v3.2");

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const abortRef = useRef(null);
  const activeChatIdRef = useRef(activeChatId);

  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  // Load saved state on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("chatSessions");
      const savedActive = localStorage.getItem("activeChatId");
      const savedModel = localStorage.getItem("model");
      if (saved) setChatSessions(JSON.parse(saved));
      if (savedActive) setActiveChatId(savedActive);
      if (savedModel && MODELS[savedModel]) setModel(savedModel);
    } catch {
      /* corrupted storage — start fresh */
    }
  }, []);

  // Persist state
  useEffect(() => {
    localStorage.setItem("chatSessions", JSON.stringify(chatSessions));
  }, [chatSessions]);

  useEffect(() => {
    if (activeChatId) localStorage.setItem("activeChatId", activeChatId);
  }, [activeChatId]);

  useEffect(() => {
    localStorage.setItem("model", model);
  }, [model]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatSessions, isStreaming]);

  const activeChat = chatSessions.find((c) => c.id === activeChatId) ?? null;

  const updateChatMessages = useCallback((chatId, updater) => {
    setChatSessions((prev) =>
      prev.map((c) => {
        if (c.id !== chatId) return c;
        const newMessages =
          typeof updater === "function" ? updater(c.messages) : updater;
        return { ...c, messages: newMessages };
      })
    );
  }, []);

  const setChatTitle = useCallback((chatId, title) => {
    setChatSessions((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, title } : c))
    );
  }, []);

  /* Create a chat and return its id synchronously */
  const createChat = useCallback(() => {
    const id = crypto.randomUUID();
    const newChat = { id, title: "New Chat", messages: [] };
    setChatSessions((prev) => [...prev, newChat]);
    setActiveChatId(id);
    activeChatIdRef.current = id;
    return id;
  }, []);

  /* Core: send a message list to the API and stream the reply into the chat */
  const streamCompletion = useCallback(
    async (chatId, history) => {
      setIsStreaming(true);
      const controller = new AbortController();
      abortRef.current = controller;

      // placeholder assistant message
      updateChatMessages(chatId, [...history, { role: "assistant", content: "" }]);

      try {
        const res = await fetch("/api/OpenRouter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history, model }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) throw new Error(`HTTP error: ${res.status}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let aiContent = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          aiContent += decoder.decode(value, { stream: true });

          updateChatMessages(chatId, (msgs) => {
            const updated = [...msgs];
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              content: aiContent,
            };
            return updated;
          });
        }

        if (!aiContent) {
          updateChatMessages(chatId, (msgs) => {
            const updated = [...msgs];
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              content: "I didn't get a response — please try again.",
            };
            return updated;
          });
        }
      } catch (err) {
        if (err?.name === "AbortError") {
          // user pressed Stop — keep whatever streamed in
          updateChatMessages(chatId, (msgs) => {
            const updated = [...msgs];
            const last = updated[updated.length - 1];
            if (last?.role === "assistant" && last.content === "") {
              updated.pop(); // nothing streamed; remove empty bubble
            }
            return updated;
          });
        } else {
          console.error("stream error:", err);
          updateChatMessages(chatId, (msgs) => {
            const updated = [...msgs];
            updated[updated.length - 1] = {
              role: "assistant",
              content: "Something went wrong. Please try again.",
            };
            return updated;
          });
        }
      } finally {
        abortRef.current = null;
        setIsStreaming(false);
      }
    },
    [model, updateChatMessages]
  );

  /* Public: send the user's text (or a suggestion chip) */
  const sendMessage = useCallback(
    async (overrideText) => {
      const trimmed = (overrideText ?? text).trim();
      if (!trimmed || isStreaming) return;

      let chatId = activeChatIdRef.current;
      let history;

      if (!chatId) {
        chatId = createChat();
        history = [{ role: "user", content: trimmed }];
      } else {
        const chat = chatSessions.find((c) => c.id === chatId);
        history = [...(chat?.messages ?? []), { role: "user", content: trimmed }];
      }

      updateChatMessages(chatId, history);
      setText("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";

      // Auto-title from the first user message
      const isFirstUserMsg = history.filter((m) => m.role === "user").length === 1;
      if (isFirstUserMsg) {
        const title = trimmed.length > 34 ? `${trimmed.slice(0, 34)}…` : trimmed;
        setChatTitle(chatId, title);
      }

      await streamCompletion(chatId, history);
    },
    [text, isStreaming, chatSessions, createChat, updateChatMessages, setChatTitle, streamCompletion]
  );

  /* Regenerate the last assistant reply */
  const regenerate = useCallback(() => {
    if (!activeChat || isStreaming) return;
    const msgs = [...activeChat.messages];
    if (msgs[msgs.length - 1]?.role === "assistant") msgs.pop();
    if (msgs.length === 0) return;
    streamCompletion(activeChat.id, msgs);
  }, [activeChat, isStreaming, streamCompletion]);

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleKey = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage]
  );

  const autoGrow = useCallback((e) => {
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  const showWelcome = !activeChat || activeChat.messages.length === 0;

  return (
    <main className="flex h-screen bg-neutral-950 text-white">
      <Sidebar
        expand={expand}
        setExpand={setExpand}
        chatSessions={chatSessions}
        activeChatId={activeChatId}
        onSelectChat={(id) => {
          setActiveChatId(id);
          if (window.innerWidth < 768) setExpand(false);
        }}
        onNewChat={() => createChat()}
        onDeleteChat={(id) => {
          setChatSessions((prev) => prev.filter((c) => c.id !== id));
          if (activeChatId === id) setActiveChatId(null);
        }}
      />

      {/* Mobile backdrop while sidebar is open */}
      {expand && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={() => setExpand(false)}
        />
      )}

      <section className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="px-4 py-3 border-b border-neutral-800/80 bg-neutral-950/70 backdrop-blur-md flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            {/* Mobile menu */}
            <button
              onClick={() => setExpand(true)}
              className="md:hidden h-9 w-9 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Open menu"
            >
              <span className="text-lg">☰</span>
            </button>
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center text-sm">
                ✦
              </div>
              <h1 className="text-lg font-semibold tracking-tight">Nimbus</h1>
            </div>
          </div>

          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="bg-neutral-900 px-3 py-1.5 rounded-lg border border-neutral-700 text-sm outline-none focus:border-indigo-500 transition-colors cursor-pointer"
          >
            {Object.entries(MODELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </header>

        {/* Messages / Welcome */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          {showWelcome ? (
            <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto text-center">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center text-2xl mb-5">
                ✦
              </div>
              <h2 className="text-2xl font-semibold mb-1.5">
                How can I help you today?
              </h2>
              <p className="text-sm text-neutral-400 mb-8">
                Chatting with <span className="text-neutral-200">{MODELS[model]}</span> — switch models any time, mid-conversation.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.text}
                    onClick={() => sendMessage(s.text)}
                    className="text-left p-4 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-indigo-500/60 hover:bg-neutral-900/60 transition-colors text-sm text-neutral-300"
                  >
                    <span className="mr-2">{s.icon}</span>
                    {s.text}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-5">
              {activeChat.messages.map((m, i) => (
                <MessageBubble
                  key={i}
                  message={m}
                  isStreaming={isStreaming && i === activeChat.messages.length - 1}
                  canRegenerate={i === activeChat.messages.length - 1}
                  onRegenerate={regenerate}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-neutral-800/80 p-3 shrink-0">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-end gap-2 bg-neutral-900 border border-neutral-700 rounded-2xl p-2 focus-within:border-indigo-500 transition-colors">
              <textarea
                ref={textareaRef}
                rows={1}
                className="flex-1 bg-transparent text-sm px-2 py-2 resize-none outline-none max-h-40 placeholder:text-neutral-500"
                placeholder="Ask anything…"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onInput={autoGrow}
                onKeyDown={handleKey}
              />
              {isStreaming ? (
                <button
                  onClick={stopGeneration}
                  className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 rounded-xl text-sm font-medium transition-colors shrink-0"
                >
                  ◼ Stop
                </button>
              ) : (
                <button
                  onClick={() => sendMessage()}
                  disabled={!text.trim()}
                  className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-sm font-medium transition-all shrink-0"
                >
                  Send
                </button>
              )}
            </div>
            <p className="text-[11px] text-neutral-600 text-center mt-2">
              Nimbus can make mistakes. Built with Next.js — live token streaming via OpenRouter.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
