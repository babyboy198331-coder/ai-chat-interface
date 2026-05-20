"use client";

import Sidebar from "./components/Sidebar";
import { useState, useEffect, useRef } from "react";

export default function Home() {
  const [expand, setExpand] = useState(false);
  const [chatSessions, setChatSessions] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [text, setText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  // Load saved chats
  useEffect(() => {
    const saved = localStorage.getItem("chatSessions");
    const savedActive = localStorage.getItem("activeChatId");

    if (saved) setChatSessions(JSON.parse(saved));
    if (savedActive) setActiveChatId(savedActive);
  }, []);

  // Save chats
  useEffect(() => {
    localStorage.setItem("chatSessions", JSON.stringify(chatSessions));
  }, [chatSessions]);

  // Save active chat
  useEffect(() => {
    if (activeChatId) {
      localStorage.setItem("activeChatId", activeChatId);
    }
  }, [activeChatId]);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatSessions, isTyping]);

  const getActiveChat = () =>
    chatSessions.find((c) => c.id === activeChatId) || null;

  const updateActiveChat = (messages) => {
    setChatSessions((prev) =>
      prev.map((c) =>
        c.id === activeChatId ? { ...c, messages } : c
      )
    );
  };

  const startNewChat = () => {
    const id = crypto.randomUUID();
    const newChat = {
      id,
      messages: [
        {
          role: "assistant",
          content: "Hi, I'm Gemma‑2‑9B. How can I help you today?",
        },
      ],
    };

    setChatSessions((prev) => [...prev, newChat]);
    setActiveChatId(id);
  };

  const sendMessage = async () => {
    if (!text.trim() || !activeChatId) return;

    const userMsg = { role: "user", content: text.trim() };
    const chat = getActiveChat();
    const updatedMessages = [...chat.messages, userMsg];

    updateActiveChat(updatedMessages);
    setText("");
    setIsTyping(true);

    try {
      const res = await fetch("/api/OpenRouter", {
        method: "POST",
        body: JSON.stringify({ messages: updatedMessages }),
      });

      if (!res.body) {
        updateActiveChat([
          ...updatedMessages,
          { role: "assistant", content: "No response stream." },
        ]);
        setIsTyping(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let aiMessage = "";

      updateActiveChat([
        ...updatedMessages,
        { role: "assistant", content: "" },
      ]);

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        aiMessage += chunk;

        updateActiveChat((prev => {
          const chat = getActiveChat();
          const msgs = [...chat.messages];
          msgs[msgs.length - 1].content = aiMessage;
          return msgs;
        })(chatSessions));
      }
    } catch (err) {
      updateActiveChat([
        ...updatedMessages,
        { role: "assistant", content: "Error talking to the model." },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const chat = getActiveChat();

  return (
    <main className="flex h-screen bg-black text-white">
      <Sidebar
        expand={expand}
        setExpand={setExpand}
        chatSessions={chatSessions}
        activeChatId={activeChatId}
        setActiveChatId={setActiveChatId}
        startNewChat={startNewChat}
      />

      <section className="flex-1 flex flex-col">
        {/* Header */}
        <header className="px-4 py-3 border-b border-neutral-800 bg-black/40 backdrop-blur-md flex justify-between items-center">
          <h1 className="text-lg font-semibold">DeepSeek Clone</h1>
          <div className="flex items-center gap-3">
            <select className="bg-neutral-900 px-3 py-1 rounded-md border border-neutral-700">
              <option>Gemma‑2‑9B</option>
              <option>DeepSeek‑R1</option>
              <option>Qwen‑2.5</option>
            </select>
          </div>
        </header>

        {/* Chat */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {chat?.messages?.map((m, i) => (
            <div
              key={i}
              className={`max-w-2xl ${
                m.role === "user" ? "ml-auto text-right" : "mr-auto text-left"
              }`}
            >
              <div
                className={`inline-block px-3 py-2 rounded-2xl text-sm ${
                  m.role === "user"
                    ? "bg-blue-600"
                    : "bg-neutral-800"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="text-xs text-neutral-400">Gemma is thinking…</div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-neutral-800 p-3">
          <div className="max-w-2xl mx-auto flex gap-2">
            <textarea
              className="flex-1 bg-neutral-900 text-sm rounded-lg px-3 py-2 h-12 resize-none border border-neutral-700 focus:border-blue-500 outline-none"
              placeholder="Ask anything..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKey}
            />
            <button
              onClick={sendMessage}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium"
            >
              Send
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
