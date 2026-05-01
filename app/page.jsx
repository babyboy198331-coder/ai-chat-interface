'use client';

import Sidebar from "./components/Sidebar";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";

export default function Home() {
  const [expand, setExpand] = useState(false);
  const [chatSessions, setChatSessions] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [text, setText] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const messagesEndRef = useRef(null);

  // Load from localStorage (client-safe)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const saved = localStorage.getItem("chatSessions");
    const savedActive = localStorage.getItem("activeChatId");

    if (saved) setChatSessions(JSON.parse(saved));
    if (savedActive) setActiveChatId(savedActive);
  }, []);

  // Save sessions
  useEffect(() => {
    localStorage.setItem("chatSessions", JSON.stringify(chatSessions));
  }, [chatSessions]);

  // Save active chat
  useEffect(() => {
    if (activeChatId) {
      localStorage.setItem("activeChatId", activeChatId);
    }
  }, [activeChatId]);

  const activeChat = chatSessions.find(c => c.id === activeChatId);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatSessions, isTyping]);

  const createNewChat = () => {
    const id = crypto.randomUUID();

    const newChat = {
      id,
      title: "New Chat",
      messages: []
    };

    setChatSessions(prev => [newChat, ...prev]);
    setActiveChatId(id);
    setIsTyping(false);
  };

  const updateChatMessages = (id, message) => {
    setChatSessions(prev =>
      prev.map(chat =>
        chat.id === id
          ? { ...chat, messages: [...chat.messages, message] }
          : chat
      )
    );
  };

  const updateChatTitle = (id, title) => {
    setChatSessions(prev =>
      prev.map(chat =>
        chat.id === id ? { ...chat, title } : chat
      )
    );
  };

  // ⭐ FIXED SEND FUNCTION
  const handleSend = async () => {
    if (!text.trim() || !activeChatId) return;

    const userMessage = {
      role: "user",
      text,
      time: new Date()
    };

    const chat = chatSessions.find(c => c.id === activeChatId);
    const previousMessages = chat?.messages || [];

    // Build updated message list immediately (FIX)
    const updatedMessages = [...previousMessages, userMessage];

    updateChatMessages(activeChatId, userMessage);

    if (previousMessages.length === 0) {
      updateChatTitle(activeChatId, text.slice(0, 30));
    }

    setText("");
    setIsTyping(true);

    try {
      const ormMessages = updatedMessages.map(m => ({
        role: m.role === "ai" ? "assistant" : m.role,
        content: m.text
      }));

      const res = await fetch("/api/OpenRouter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: ormMessages })
      });

      const data = await res.json();

      const aiMessage = {
        role: "ai",
        text: data.reply || "⚠️ No response from AI",
        time: new Date()
      };

      updateChatMessages(activeChatId, aiMessage);

    } catch (err) {
      updateChatMessages(activeChatId, {
        role: "ai",
        text: "Error: Could not reach OpenRouter API.",
        time: new Date()
      });
    } finally {
      setIsTyping(false);
    }
  };

  const deleteChat = (id) => {
    setChatSessions(prev => {
      const updated = prev.filter(chat => chat.id !== id);

      if (id === activeChatId) {
        setActiveChatId(updated.length ? updated[0].id : null);
      }

      return updated;
    });
  };

  return (
    <div className="flex h-screen">

      <Sidebar
        expand={expand}
        setExpand={setExpand}
        onNewChat={createNewChat}
        chatSessions={chatSessions}
        activeChatId={activeChatId}
        onSelectChat={setActiveChatId}
        onDeleteChat={deleteChat}
      />

      {/* CHAT AREA */}
      <div className="flex-1 flex flex-col px-4 py-8 bg-[#292a2d] text-white relative">

        {/* MESSAGES */}
        <div className="flex-1 overflow-y-auto w-full max-w-3xl mx-auto mt-10 space-y-4 pb-20">

          {!activeChat || activeChat.messages.length === 0 ? (
            <div className="text-center mt-20">
              <div className="flex items-center gap-3 justify-center">
                <Image src="/assets/logo_icon.svg" alt="" width={64} height={64} />
                <p className="text-2xl font-medium">Hi, I'm Gemma-2-9B.</p>
              </div>
              <p className="text-sm mt-2">How can I help you today?</p>
            </div>
          ) : (
            activeChat.messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "ai" && (
                  <Image src="/assets/logo_icon.svg" width={32} height={32} alt="ai" />
                )}

                <div className={`p-3 rounded-xl max-w-xl ${
                  msg.role === "user" ? "bg-blue-600" : "bg-[#3a3b3d]"
                }`}>
                  {msg.text}
                </div>
              </div>
            ))
          )}

          {isTyping && (
            <div className="flex gap-3 items-center">
              <Image src="/assets/logo_icon.svg" width={32} height={32} alt="ai" />
              <div className="bg-[#3a3b3d] p-3 rounded-xl flex gap-1">
                <span className="animate-pulse">●</span>
                <span className="animate-pulse delay-150">●</span>
                <span className="animate-pulse delay-300">●</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* INPUT */}
        <div className="w-full max-w-3xl mx-auto absolute bottom-6 left-1/2 -translate-x-1/2">
          <div className="flex items-center gap-3 bg-[#1f1f21] p-3 rounded-xl">

            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Ask anything..."
              className="flex-1 bg-transparent outline-none text-white"
            />

            <button
              onClick={handleSend}
              className="bg-blue-600 px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Send
            </button>

          </div>
        </div>

      </div>
    </div>
  );
}