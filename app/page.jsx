"use client";

import Sidebar from "./components/Sidebar";
import { useState, useEffect, useRef, useCallback } from "react";

export default function Home() {
  const [expand, setExpand] = useState(false);
  const [chatSessions, setChatSessions] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [text, setText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const activeChatIdRef = useRef(activeChatId);

  // Keep ref in sync so streaming callbacks always have the latest id
  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  // Load saved chats on mount
  useEffect(() => {
    const saved = localStorage.getItem("chatSessions");
    const savedActive = localStorage.getItem("activeChatId");
    if (saved) setChatSessions(JSON.parse(saved));
    if (savedActive) setActiveChatId(savedActive);
  }, []);

  // Persist chat sessions
  useEffect(() => {
    localStorage.setItem("chatSessions", JSON.stringify(chatSessions));
  }, [chatSessions]);

  // Persist active chat id
  useEffect(() => {
    if (activeChatId) {
      localStorage.setItem("activeChatId", activeChatId);
    }
  }, [activeChatId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatSessions, isTyping]);

  const getActiveChat = useCallback(
    () => chatSessions.find((c) => c.id === activeChatId) ?? null,
    [chatSessions, activeChatId]
  );

  // Always use functional updater to avoid stale closures
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

  const startNewChat = useCallback(() => {
    const id = crypto.randomUUID();
    const newChat = {
      id,
      title: "New Chat",
      messages: [
        {
          role: "assistant",
          content: "Hi, I'm Gemma‑2‑9B. How can I help you today?",
        },
      ],
    };

    setChatSessions((prev) => {
      const updated = [...prev, newChat];
      localStorage.setItem("chatSessions", JSON.stringify(updated));
      return updated;
    });

    setActiveChatId(id);
    localStorage.setItem("activeChatId", id);
  }, []);

  const sendMessage = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const chatId = activeChatIdRef.current;
    if (!chatId) return;

    const chat = chatSessions.find((c) => c.id === chatId);
    if (!chat) return;

    const userMsg = { role: "user", content: trimmed };
    const messagesWithUser = [...chat.messages, userMsg];

    updateChatMessages(chatId, messagesWithUser);
    setText("");
    setIsTyping(true);

    try {
      const res = await fetch("/api/OpenRouter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: messagesWithUser }),
      });

      if (!res.ok) throw new Error(`HTTP error: ${res.status}`);

      if (!res.body) {
        updateChatMessages(chatId, [
          ...messagesWithUser,
          { role: "assistant", content: "No response stream received." },
        ]);
        return;
      }

      // Add empty assistant message placeholder
      updateChatMessages(chatId, [
        ...messagesWithUser,
        { role: "assistant", content: "" },
      ]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let aiContent = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        aiContent += decoder.decode(value, { stream: true });

        // Use functional updater — always operates on latest state
        updateChatMessages(chatId, (msgs) => {
          const updated = [...msgs];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: aiContent,
          };
          return updated;
        });
      }
    } catch (err) {
      console.error("sendMessage error:", err);
      updateChatMessages(chatId, (msgs) => [
        ...msgs,
        { role: "assistant", content: "Something went wrong. Please try again." },
      ]);
    } finally {
      setIsTyping(false);
    }
  }, [text, chatSessions, updateChatMessages]);

  const handleKey = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage]
  );

  const chat = getActiveChat();

  return (
    <main className="flex h-screen bg-black text-white">
      <Sidebar
        expand={expand}
        setExpand={setExpand}
        chatSessions={chatSessions}
        activeChatId={activeChatId}
        onSelectChat={setActiveChatId}
        onNewChat={startNewChat}
        onDeleteChat={(id) => {
          setChatSessions((prev) => prev.filter((c) => c.id !== id));
          if (activeChatId === id) setActiveChatId(null);
        }}
      />

      <section className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="px-4 py-3 border-b border-neutral-800 bg-black/40 backdrop-blur-md flex justify-between items-center shrink-0">
          <h1 className="text-lg font-semibold">DeepSeek Clone</h1>
          <select className="bg-neutral-900 px-3 py-1 rounded-md border border-neutral-700 text-sm">
            <option>Gemma‑2‑9B</option>
            <option>DeepSeek‑R1</option>
            <option>Qwen‑2.5</option>
          </select>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {chat ? (
            chat.messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-2xl ${
                  m.role === "user" ? "ml-auto text-right" : "mr-auto text-left"
                }`}
              >
                <div
                  className={`inline-block px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap ${
                    m.role === "user" ? "bg-blue-600" : "bg-neutral-800"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))
          ) : (
            <div className="flex items-center justify-center h-full text-neutral-500 text-sm">
              Start a new chat to begin.
            </div>
          )}

          {isTyping && (
            <div className="text-xs text-neutral-400 animate-pulse">
              Gemma is thinking…
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-neutral-800 p-3 shrink-0">
          <div className="max-w-2xl mx-auto flex gap-2">
            <textarea
              className="flex-1 bg-neutral-900 text-sm rounded-lg px-3 py-2 h-12 resize-none border border-neutral-700 focus:border-blue-500 outline-none"
              placeholder={chat ? "Ask anything…" : "Start a new chat first"}
              value={text}
              disabled={!activeChatId}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKey}
            />
            <button
              onClick={sendMessage}
              disabled={!activeChatId || !text.trim() || isTyping}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
            >
              Send
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

