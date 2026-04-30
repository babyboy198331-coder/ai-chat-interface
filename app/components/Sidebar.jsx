"use client";

import Image from "next/image";
import React, { useState } from "react";

const Sidebar = ({
  expand,
  setExpand,
  onNewChat,
  chatSessions,
  activeChatId,
  onSelectChat,
  onDeleteChat
}) => {

  const [search, setSearch] = useState("");

  const filteredChats = chatSessions.filter(chat =>
    chat.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div
      className={`flex flex-col justify-between bg-[#212327] pt-7 transition-all duration-300 z-50
      max-md:absolute max-md:h-screen max-md:left-0
      ${expand ? "p-4 w-64" : "w-20"} overflow-hidden`}
    >
      {/* TOP */}
      <div>
        <div
          className={`flex ${
            expand ? "flex-row gap-10" : "flex-col items-center gap-8"
          }`}
        >
          <Image
            src={expand ? "/assets/logo_text.svg" : "/assets/logo_icon.svg"}
            alt="logo"
            width={expand ? 140 : 40}
            height={40}
            className="object-contain"
          />

          <div
            onClick={() => setExpand(!expand)}
            className="flex items-center justify-center h-9 w-9 rounded-lg cursor-pointer hover:bg-gray-500/20 transition"
          >
            <Image
              src="/assets/menu_icon.svg"
              alt="menu"
              width={28}
              height={28}
              className="md:hidden"
            />

            <Image
              src={
                expand
                  ? "/assets/sidebar_close_icon.svg"
                  : "/assets/sidebar_icon.svg"
              }
              alt="toggle"
              width={30}
              height={30}
              className="hidden md:block"
            />
          </div>
        </div>

        {/* NEW CHAT */}
        <button
          onClick={onNewChat}
          className={`mt-8 flex items-center justify-center cursor-pointer transition
          ${
            expand
              ? "bg-blue-500 rounded-2xl gap-2 p-2.5"
              : "h-9 w-9 mx-auto bg-[#2A2C30] rounded-lg relative group"
          }`}
        >
          <Image
            src={expand ? "/assets/chat_icon.svg" : "/assets/chat_icon_dull.svg"}
            alt="new chat"
            width={26}
            height={26}
          />

          {expand && <p className="text-white font-medium">New Chat</p>}
        </button>

        {/* SEARCH BAR */}
        {expand && (
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chats..."
            className="mt-6 w-full bg-[#2A2C30] text-white p-2 rounded-lg outline-none"
          />
        )}

        {/* CHAT LIST */}
        {expand && (
          <div className="mt-4 text-white/30 text-sm">
            <p>Chats</p>

            <div className="mt-3 max-h-64 overflow-y-auto pr-2 space-y-2">
              {filteredChats.map((chat) => (
                <div
                  key={chat.id}
                  className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition ${
                    chat.id === activeChatId
                      ? "bg-blue-600 text-white"
                      : "bg-[#2A2C30] text-white/80 hover:bg-[#3A3C40]"
                  }`}
                >
                  <div onClick={() => onSelectChat(chat.id)} className="flex-1">
                    {chat.title || "New Chat"}
                  </div>

                  {/* DELETE BUTTON */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteChat(chat.id);
                    }}
                    className="text-red-400 hover:text-red-600 ml-2"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM */}
      <div className="flex flex-col items-center gap-4 pb-4 relative">
        <Image
          src={
            expand
              ? "/assets/phone_icon.svg"
              : "/assets/phone_icon_dull.svg"
          }
          alt="phone"
          width={30}
          height={30}
          className="cursor-pointer relative group"
        />
      </div>
    </div>
  );
};

export default Sidebar;
