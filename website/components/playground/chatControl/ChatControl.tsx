"use client";
import React, { useState, useEffect, useRef } from "react";
import { generateText, tool } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { SettingsModal } from "./SettingsModal";
import { z } from "zod";
import {
  getApiKeyFromLocalStorage,
  getBaseURLFromLocalStorage,
  getSystemPromptFromLocalStorage,
  getModelFromLocalStorage,
} from "../../../lib/settings";

type ChatControlProps = {
  robotName?: string;
  systemPrompt?: string;
};

export function ChatControl({
  robotName,
  systemPrompt: configSystemPrompt,
}: ChatControlProps) {
  const [input, setInput] = useState("");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [messages, setMessages] = useState<{ sender: string; text: string }[]>(
    []
  );
  const [showSettings, setShowSettings] = useState(false);

  const apiKey = getApiKeyFromLocalStorage();
  const baseURL = getBaseURLFromLocalStorage() || "https://api.openai.com/v1/";
  const model = getModelFromLocalStorage() || "gpt-4.1-nano";
  const systemPrompt =
    getSystemPromptFromLocalStorage(robotName) ||
    configSystemPrompt || // <-- Use configSystemPrompt if present
    `You can help control a robot by pressing keyboard keys. Use the keyPress tool to simulate key presses. Each key will be held down for 1 second by default. If the user describes roughly wanting to make it longer or shorter, adjust the duration accordingly.`;

  // Create openai instance with current apiKey and baseURL
  const openai = createOpenAI({
    apiKey,
    baseURL,
  });

  const handleCommand = async (command: string) => {
    setMessages((prev) => [...prev, { sender: "User", text: command }]);
    try {
      const result = await generateText({
        model: openai(model),
        prompt: command,
        system: systemPrompt,
        tools: {
          keyPress: tool({
            description:
              "Press and hold a keyboard key for a specified duration (in milliseconds) to control the robot",
            parameters: z.object({
              key: z
                .string()
                .describe(
                  "The key to press (e.g., 'w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight')"
                ),
              duration: z
                .number()
                .int()
                .min(100)
                .max(5000)
                .default(1000)
                .describe(
                  "How long to hold the key in milliseconds (default: 1000, min: 100, max: 5000)"
                ),
            }),
            execute: async ({
              key,
              duration,
            }: {
              key: string;
              duration?: number;
            }) => {
              const holdTime = duration ?? 1000;
              const keydownEvent = new KeyboardEvent("keydown", {
                key,
                bubbles: true,
              });
              window.dispatchEvent(keydownEvent);

              // Wait for the specified duration
              await new Promise((resolve) => setTimeout(resolve, holdTime));

              // Simulate keyup event
              const keyupEvent = new KeyboardEvent("keyup", {
                key,
                bubbles: true,
              });
              window.dispatchEvent(keyupEvent);
              return `Held key "${key.toUpperCase()}" for ${holdTime} ms`;
            },
          }),
        },
      });
      let text = result.text.trim();
      const content = result.response?.messages[1]?.content;
      for (const element of content ?? []) {
        text += `\n\n${element.result}`;
      }
      setMessages((prev) => [...prev, { sender: "AI", text }]);
    } catch (error) {
      console.error("Error generating text:", error);
      setMessages((prev) => [
        ...prev,
        { sender: "AI", text: "Error: Unable to process your request." },
      ]);
    }
  };

  const handleSend = () => {
    if (input.trim()) {
      if (!apiKey) {
        // setShowSettings(true);
        // return;
      }
      handleCommand(input.trim());
      setInput(""); // Clear input after sending
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
  e.stopPropagation();
  if (e.key === "Enter") {
    e.preventDefault();   
    handleSend();
  }
};


  if (isCollapsed) {
    return (
      <div className="absolute bottom-5 right-5 z-50">
        <button
          onClick={() => setIsCollapsed(false)}
          className="bg-gray-700 hover:bg-gray-600 text-white text-sm px-3 py-1.5 rounded"
        >
          Show AI Controls
        </button>
      </div>
    );
  } 
  return (   
    <>
      <div className="fixed bottom-5 right-5 bg-zinc-900 bg-opacity-80 text-white p-4 rounded-lg shadow-lg w-80 z-50">
        <h4 className="border-b border-zinc-600 pb-2 font-bold mb-2 flex items-center justify-between">
          <span>AI Control Robot</span>
          <button
            onClick={() => setShowSettings(true)}
            className="ml-2 bg-zinc-700 hover:bg-zinc-600 text-white py-1 px-2 rounded text-sm"
          >
            Settings
          </button>
        <button
          onClick={() => setIsCollapsed(true)}
          className="ml-2 text-xl hover:bg-zinc-800 px-2 rounded-full"
          title="Collapse"
        >
          ×
        </button>          
        </h4>
        <div className="mb-2 max-h-[60vh] overflow-y-auto">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`mb-2 ${
                msg.sender === "AI" ? "text-green-400" : "text-blue-400"
              }`}
            >
              <strong>{msg.sender}:</strong> {msg.text}
            </div>
          ))}
        </div>
        {messages.length > 0 && (
          <div className="mb-2 flex justify-end">
            <button
              onClick={() => setMessages([])}
              className="text-xs bg-zinc-700 hover:bg-zinc-600 text-white px-2 py-1 rounded"
            >
              Clear
            </button>
          </div>
        )}
        <div className="flex items-center space-x-2">
          <div className="relative flex items-center w-full">
            <button
              onClick={() => alert("Camera support coming soon")}
              className="absolute left-0 bg-zinc-700 hover:bg-zinc-600 text-zinc-400 p-2 rounded"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-5 h-5"
                aria-hidden="true"
              >
                <path d="M16 4C16.5523 4 17 4.44772 17 5V9.2L22.2133 5.55071C22.4395 5.39235 22.7513 5.44737 22.9096 5.6736C22.9684 5.75764 23 5.85774 23 5.96033V18.0397C23 18.3158 22.7761 18.5397 22.5 18.5397C22.3974 18.5397 22.2973 18.5081 22.2133 18.4493L17 14.8V19C17 19.5523 16.5523 20 16 20H2C1.44772 20 1 19.5523 1 19V5C1 4.44772 1.44772 4 2 4H16ZM15 6H3V18H15V6ZM7.4 8.82867C7.47607 8.82867 7.55057 8.85036 7.61475 8.8912L11.9697 11.6625C12.1561 11.7811 12.211 12.0284 12.0924 12.2148C12.061 12.2641 12.0191 12.306 11.9697 12.3375L7.61475 15.1088C7.42837 15.2274 7.18114 15.1725 7.06254 14.9861C7.02169 14.9219 7 14.8474 7 14.7713V9.22867C7 9.00776 7.17909 8.82867 7.4 8.82867ZM21 8.84131L17 11.641V12.359L21 15.1587V8.84131Z"></path>{" "}
              </svg>
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onKeyUp={(e) => e.stopPropagation()}
              placeholder="Type a command..."
              className="flex-1 pl-10 p-2 rounded bg-zinc-700 text-white outline-none"
            />
          </div>
        </div>
      </div>
      <SettingsModal
        show={showSettings}
        onClose={() => setShowSettings(false)}
        robotName={robotName}
        systemPrompt={configSystemPrompt} // <-- Pass systemPrompt to SettingsModal
      />
    </>
  );
}
