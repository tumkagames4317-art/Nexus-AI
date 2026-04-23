/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, memo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Send, 
  Bot, 
  User, 
  Trash2, 
  Sparkles, 
  Terminal, 
  Cpu, 
  Command,
  ChevronRight,
  Menu,
  X,
  Loader2,
  Paperclip,
  Brain,
  Zap,
  Image as ImageIcon,
  FileText,
  Eye,
  Info,
  Maximize,
  Minimize,
  Download
} from "lucide-react";
import { sendMessageStream, getSuggestions, generateChatTitle, generateFollowUpSuggestions, Message, FileAttachment } from "./services/geminiService";
import { ThinkingLevel } from "@google/genai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { 
  Palette,
  Mic,
  MicOff,
  UserCheck,
  Code2,
  PenTool,
  Globe
} from "lucide-react";

interface Persona {
  id: string;
  name: string;
  icon: React.ElementType;
  description: string;
  instruction: string;
}

const PERSONAS: Persona[] = [
  { 
    id: 'gemini', 
    name: 'Gemini 1.5 Flash', 
    icon: Bot, 
    description: 'Официальная модель Google', 
    instruction: 'Ты - Gemini 1.5 Flash, мощная языковая модель от Google. Отвечай честно, прямо и без выдуманных имен.' 
  },
  { 
    id: 'coder', 
    name: 'Программист', 
    icon: Code2, 
    description: 'Эксперт по коду', 
    instruction: 'Ты - ИИ-эксперт в программировании. Пиши чистый, оптимизированный код и объясняй архитектурные решения.' 
  },
  { 
    id: 'creative', 
    name: 'Креатор', 
    icon: PenTool, 
    description: 'Творчество и тексты', 
    instruction: 'Ты - творческий помощник. Помогай с текстами, сценариями и идеями, используя богатый словарный запас.' 
  }
];

const ACCENT_COLORS = [
  { name: 'Blue', class: 'text-blue-500', bg: 'bg-blue-600', shadow: 'shadow-blue-600/30', glow: 'bg-blue-600/10' },
  { name: 'Purple', class: 'text-purple-500', bg: 'bg-purple-600', shadow: 'shadow-purple-600/30', glow: 'bg-purple-600/10' },
  { name: 'Green', class: 'text-emerald-500', bg: 'bg-emerald-600', shadow: 'shadow-emerald-600/30', glow: 'bg-emerald-600/10' },
  { name: 'Pink', class: 'text-rose-500', bg: 'bg-rose-600', shadow: 'shadow-rose-600/30', glow: 'bg-rose-600/10' },
];

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  personaId: string;
  colorName: string;
  timestamp: number;
}

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text);
};

// Memoized Message Component for performance (Defined outside to prevent animation resets)
const ChatMessage = memo(({ 
  message, 
  idx, 
  isLast, 
  isLoading, 
  accentColor, 
  expandedThoughts, 
  toggleThought, 
  showMenu 
}: { 
  message: Message; 
  idx: number; 
  isLast: boolean;
  isLoading: boolean;
  accentColor: any;
  expandedThoughts: Record<number, boolean>;
  toggleThought: (ts: number) => void;
  showMenu: (e: any, idx: number, role: any) => void;
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      onContextMenu={(e) => showMenu(e, idx, message.role as any)}
      className={`flex w-full group ${message.role === "user" ? "justify-end" : "justify-start"}`}
    >
      <div className={`flex gap-3 md:gap-4 max-w-[95%] md:max-w-[85%] ${message.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
        <div 
          onClick={(e) => message.role === "model" && showMenu(e, idx, "model")}
          className={`w-8 h-8 md:w-10 md:h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-lg border border-white/5 cursor-pointer hover:scale-105 transition-transform ${message.role === "model" ? accentColor.bg + ' ' + accentColor.shadow : "bg-neutral-900 text-neutral-400"}`}
        >
          {message.role === "model" ? <Bot className="w-4 h-4 md:w-6 md:h-6" /> : <User className="w-4 h-4 md:w-6 md:h-6" />}
        </div>

        <div className={`flex-1 min-w-0 space-y-4 ${message.role === "user" ? "text-right" : "text-left"}`}>
          {message.files && message.files.length > 0 && (
            <div className={`flex flex-wrap gap-2 mb-4 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              {message.files.map((file, fIdx) => (
                <div key={fIdx} className="relative rounded-xl overflow-hidden border border-white/10 shadow-lg">
                  {file.mimeType.startsWith("image/") ? (
                    <img src={`data:${file.mimeType};base64,${file.data}`} className="w-24 h-24 md:w-32 md:h-32 object-cover" />
                  ) : (
                    <div className="w-24 h-24 md:w-32 md:h-32 bg-neutral-900 flex flex-col items-center justify-center p-3 text-center">
                      <FileText className="w-6 h-6 text-blue-400 mb-2" />
                      <span className="text-[9px] font-bold text-neutral-400 truncate w-full">{file.name}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className={`relative px-4 md:px-6 py-3 md:py-4 rounded-3xl shadow-xl ${
            message.role === "user" 
              ? "bg-white/[0.04] border border-white/5 text-neutral-200 rounded-tr-sm" 
              : "bg-neutral-950/40 border border-white/[0.03] text-neutral-300 rounded-tl-sm"
          }`}>
            {message.thought && (
              <div className="mb-4">
                <button 
                  onClick={() => toggleThought(message.timestamp)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-purple-600/10 hover:bg-purple-600/20 text-purple-400 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all mb-2"
                >
                  <Brain className="w-3 h-3" />
                  <span>{expandedThoughts[message.timestamp] ? "Скрыть размышления" : `Размышления (${Math.ceil(message.thought.length / 5)} токенов)`}</span>
                </button>
                <AnimatePresence>
                  {expandedThoughts[message.timestamp] && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden border-l border-purple-500/20 pl-4 my-2"
                    >
                      <p className="text-xs md:text-sm text-neutral-500 italic leading-relaxed font-mono">
                        {message.thought}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            <div className="markdown-content text-sm md:text-base leading-relaxed">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  code({node, inline, className, children, ...props}: any) {
                    const match = /language-(\w+)/.exec(className || '');
                    return !inline && match ? (
                      <div className="relative mt-4 mb-4 rounded-xl overflow-hidden border border-white/10 shadow-2xl w-full">
                        <div className="flex items-center justify-between px-4 py-2 bg-neutral-900 border-b border-white/5">
                          <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">{match[1]}</span>
                          <button 
                            onClick={() => copyToClipboard(String(children).replace(/\n$/, ''))}
                            className="p-1 hover:text-white transition-colors"
                          >
                            <Command className="w-3 h-3" />
                          </button>
                        </div>
                        <SyntaxHighlighter
                          style={vscDarkPlus}
                          language={match[1]}
                          PreTag="div"
                          {...props}
                          customStyle={{ margin: 0, padding: '1rem', background: 'transparent', fontSize: '13px', overflowX: 'auto' }}
                        >
                          {String(children).replace(/\n$/, '')}
                        </SyntaxHighlighter>
                      </div>
                    ) : (
                      <code className="px-1.5 py-0.5 bg-neutral-800 rounded font-mono text-sm text-blue-400 break-all" {...props}>
                        {children}
                      </code>
                    );
                  },
                  p: ({children}) => <p className="mb-4 last:mb-0 leading-relaxed font-medium break-words overflow-wrap-anywhere">{children}</p>,
                  ul: ({children}) => <ul className="list-disc pl-5 mb-4 space-y-1 break-words">{children}</ul>,
                  ol: ({children}) => <ol className="list-decimal pl-5 mb-4 space-y-1 break-words">{children}</ol>,
                  h1: ({children}) => <h1 className="text-xl md:text-2xl font-bold mb-4 mt-6 break-words tracking-tight leading-tight">{children}</h1>,
                  h2: ({children}) => <h2 className="text-lg md:text-xl font-bold mb-3 mt-5 break-words tracking-tight leading-tight">{children}</h2>,
                  h3: ({children}) => <h3 className="text-base md:text-lg font-bold mb-2 mt-4 break-words tracking-tight leading-tight">{children}</h3>,
                  blockquote: ({children}) => <blockquote className="border-l-4 border-blue-500/50 pl-4 italic bg-white/5 py-2 rounded-r-xl mb-4 break-words">{children}</blockquote>,
                  table: ({children}) => (
                    <div className="overflow-x-auto mb-6 rounded-xl border border-white/10 w-full">
                      <table className="w-full text-left border-collapse">{children}</table>
                    </div>
                  ),
                  th: ({children}) => <th className="px-3 md:px-4 py-2 md:py-3 bg-neutral-900 font-bold border-b border-white/10 text-xs md:text-sm">{children}</th>,
                  td: ({children}) => <td className="px-3 md:px-4 py-2 md:py-3 border-b border-white/5 text-xs md:text-sm break-words">{children}</td>,
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          </div>
          {isLoading && isLast && !message.content && (
            <div className="flex flex-col gap-3">
              {message.thought ? (
                <div className="flex items-center gap-2 text-purple-400 text-[10px] md:text-xs animate-pulse font-bold tracking-widest uppercase">
                  <Brain className="w-3 h-3 md:w-4 md:h-4" />
                  <span>Анализирую данные и строю гипотезы...</span>
                </div>
              ) : (
                <div className="flex gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                </div>
              )}
            </div>
          )}
        </div>

        <div className={`flex items-center gap-3 px-2 text-[10px] text-neutral-600 opacity-40 group-hover:opacity-100 transition-opacity ${message.role === "user" ? "flex-row-reverse" : ""}`}>
          <span className="font-semibold">{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          <span className="w-0.5 h-0.5 bg-neutral-800 rounded-full" />
          <span>{message.role === "user" ? "Вы" : "Nexus"}</span>
        </div>
      </div>
    </motion.div>
  );
});

export default function App() {
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem("nexus_sessions");
    return saved ? JSON.parse(saved) : [];
  });
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(() => {
    return localStorage.getItem("nexus_current_session_id");
  });

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<FileAttachment[]>([]);
  const [thinkingMode, setThinkingMode] = useState<ThinkingLevel>(ThinkingLevel.LOW);
  const [showThinkingModal, setShowThinkingModal] = useState(false);
  const [expandedThoughts, setExpandedThoughts] = useState<Record<number, boolean>>({});
  
  const [activePersona, setActivePersona] = useState<Persona>(PERSONAS[0]);
  const [accentColor, setAccentColor] = useState(ACCENT_COLORS[0]);
  const [isRecording, setIsRecording] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  useEffect(() => {
    const handleResize = () => {
      // Use visualViewport if available (most accurate for keyboard)
      if (window.visualViewport) {
        setViewportHeight(window.visualViewport.height);
      } else {
        setViewportHeight(window.innerHeight);
      }
    };

    window.visualViewport?.addEventListener('resize', handleResize);
    window.visualViewport?.addEventListener('scroll', handleResize);
    window.addEventListener('resize', handleResize);

    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('scroll', handleResize);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    messageIndex: number;
    role: "user" | "model";
  } | null>(null);

  const [sessionContextMenu, setSessionContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    sessionId: string;
  } | null>(null);

  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState("");
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll logic (Optimized)
  const isAutoScrollingRef = useRef(true);
  
  const scrollToBottom = (force = false) => {
    if (force || isAutoScrollingRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: force ? "smooth" : "auto" });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle scroll to determine if auto-scroll should be enabled
  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
    isAutoScrollingRef.current = isAtBottom;
  };

  // Sync state with current session
  useEffect(() => {
    const session = sessions.find(s => s.id === currentSessionId);
    if (session) {
      setMessages(session.messages);
      const persona = PERSONAS.find(p => p.id === session.personaId);
      if (persona) setActivePersona(persona);
      const color = ACCENT_COLORS.find(c => c.name === session.colorName);
      if (color) setAccentColor(color);
    } else {
      setMessages([]);
      setActivePersona(PERSONAS[0]);
    }
  }, [currentSessionId]);

  // Persist sessions
  useEffect(() => {
    localStorage.setItem("nexus_sessions", JSON.stringify(sessions));
    if (currentSessionId) {
      localStorage.setItem("nexus_current_session_id", currentSessionId);
    }
  }, [sessions, currentSessionId]);

  // Debounced session save to prevent lag during streaming
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!currentSessionId && messages.length > 0) {
        const newId = Date.now().toString();
        const newSession: ChatSession = {
          id: newId,
          title: messages[0].content.substring(0, 30) || "Новый чат",
          messages: messages,
          personaId: activePersona.id,
          colorName: accentColor.name,
          timestamp: Date.now()
        };
        setSessions(prev => [newSession, ...prev]);
        setCurrentSessionId(newId);
      } else if (currentSessionId) {
        setSessions(prev => prev.map(s => 
          s.id === currentSessionId 
            ? { ...s, messages, personaId: activePersona.id, colorName: accentColor.name } 
            : s
        ));
      }
    }, 1000); // Only save 1 second after last change

    return () => clearTimeout(timer);
  }, [messages, activePersona, accentColor, currentSessionId]);

  const handleEditMessage = (index: number) => {
    const msg = messages[index];
    setInput(msg.content);
    setAttachedFiles(msg.files || []);
    setMessages(messages.slice(0, index));
    setContextMenu(null);
    inputRef.current?.focus();
  };

  const createNewChat = () => {
    setCurrentSessionId(null);
    setMessages([]);
    setIsSidebarOpen(false);
    setSuggestions([]);
  };

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions(prev => prev.filter(s => s.id !== id));
    if (currentSessionId === id) {
      setCurrentSessionId(null);
    }
  };

  const exportAllData = () => {
    const data = JSON.stringify(sessions, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nexus_export_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newAttachments: FileAttachment[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const base64 = await convertToBase64(file);
      newAttachments.push({
        name: file.name,
        mimeType: file.type,
        data: base64
      });
    }

    setAttachedFiles(prev => [...prev, ...newAttachments]);
  };

  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data:mime/type;base64,
        const base64 = result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSend = async (overridePrompt?: string | any) => {
    const finalInput = (typeof overridePrompt === 'string' ? overridePrompt : input) || "";
    if ((!finalInput.trim() && attachedFiles.length === 0) || isLoading) return;

    const userMessage: Message = {
      role: "user",
      content: finalInput,
      files: attachedFiles,
      timestamp: Date.now(),
    };

    const currentInput = finalInput;
    const currentFiles = attachedFiles;
    const messagesToSync = [...messages]; // Capturing current state before updates
    
    setInput("");
    setAttachedFiles([]);
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      let fullContent = "";
      let fullThought = "";
      const modelMessage: Message = {
        role: "model",
        content: "",
        thought: "",
        timestamp: Date.now(),
      };
      
      setMessages((prev) => [...prev, modelMessage]);

      const stream = sendMessageStream(currentInput, messagesToSync, currentFiles, {
        thinkingLevel: thinkingMode,
        systemInstruction: `SYSTEM: Use your actual identity as a model from Google. 
${thinkingMode === ThinkingLevel.HIGH ? 'IMPORTANT: You are in "Deep Think" mode. Before providing your final answer, you MUST write your step-by-step reasoning process inside <think> and </think> tags. DO NOT SKIP THIS.' : ''}
Persona: ${activePersona.instruction}
Current Date: ${new Date().toLocaleDateString('ru-RU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}.`
      });
      
      for await (const chunk of stream) {
        if (chunk.type === "thought") {
          fullThought += chunk.content;
          setMessages((prev) => {
            const newMessages = [...prev];
            newMessages[newMessages.length - 1].thought = fullThought;
            return newMessages;
          });
        } else if (chunk.type === "text") {
          fullContent += chunk.content;

          setMessages((prev) => {
            const newMessages = [...prev];
            let displayContent = fullContent;
            let extractedThought = fullThought;

            // Pattern matching for <think>...</think>
            const thinkMatch = displayContent.match(/<think>([\s\S]*?)<\/think>/);
            if (thinkMatch) {
              // We have a complete thought tag
              extractedThought = thinkMatch[1].trim();
              displayContent = displayContent.replace(/<think>[\s\S]*?<\/think>/, "").trim();
            } else if (displayContent.includes('<think>')) {
              // We have an opening tag, but not closed yet.
              const parts = displayContent.split('<think>');
              // Content BEFORE <think> is real content, content AFTER is part of thought
              const beforeThink = parts[0];
              const insideThink = parts.slice(1).join('<think>'); // Take everything after first <think>
              
              displayContent = beforeThink.trim();
              extractedThought = insideThink.trim();
            }

            newMessages[newMessages.length - 1].content = displayContent;
            newMessages[newMessages.length - 1].thought = extractedThought;
            return newMessages;
          });
        }
      }

      // Auto-title and suggestions after response
      const updatedMessages = [...messages, userMessage, { ...modelMessage, content: fullContent, thought: fullThought }];
      
      if (currentSessionId) {
        const session = sessions.find(s => s.id === currentSessionId);
        if (session && (session.title === "Новый чат" || updatedMessages.length === 2)) {
          generateChatTitle(updatedMessages).then(title => {
            setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, title } : s));
          });
        }
      }

      generateFollowUpSuggestions(updatedMessages).then(setSuggestions);
      
    } catch (error) {
      console.error("Error sending message:", error);
      // Only show error if we got NO response text at all
      if (fullContent === "") {
        setMessages((prev) => [
          ...prev,
          {
            role: "model",
            content: "Ошибка соединения. Попробуйте еще раз.",
            timestamp: Date.now(),
          },
        ]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    if (window.confirm("Вы уверены, что хотите удалить ВСЕ чаты?")) {
      setSessions([]);
      setCurrentSessionId(null);
      setMessages([]);
      setAttachedFiles([]);
      setContextMenu(null);
      setSessionContextMenu(null);
      setSuggestions([]);
      localStorage.removeItem("nexus_sessions");
      localStorage.removeItem("nexus_current_session_id");
      localStorage.removeItem("nexus_messages");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setContextMenu(null);
  };

  const handleRegenerate = async (index: number, forceFast = false) => {
    const userMsgIndex = messages[index].role === "user" ? index : index - 1;
    if (userMsgIndex < 0 || messages[userMsgIndex].role !== "user") return;

    const userMsg = messages[userMsgIndex];
    const newMessages = messages.slice(0, userMsgIndex + 1);
    
    setMessages(newMessages);
    setContextMenu(null);
    setIsLoading(true);

    try {
      let fullContent = "";
      let fullThought = "";
      const modelMessage: Message = {
        role: "model",
        content: "",
        thought: "",
        timestamp: Date.now(),
      };
      
      setMessages((prev) => [...prev, modelMessage]);

      const stream = sendMessageStream(
        userMsg.content, 
        newMessages.slice(0, -1), 
        userMsg.files || [], 
        { 
          thinkingLevel: forceFast ? ThinkingLevel.LOW : thinkingMode,
          systemInstruction: `SYSTEM: Use your actual identity as a model from Google. 
${(forceFast ? ThinkingLevel.LOW : thinkingMode) === ThinkingLevel.HIGH ? 'IMPORTANT: You are in "Deep Think" mode. Before providing your final answer, you MUST write your step-by-step reasoning process inside <think> and </think> tags. DO NOT SKIP THIS.' : ''}
Persona: ${activePersona.instruction}
Current Date: ${new Date().toLocaleDateString('ru-RU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}.`
        }
      );
      
      for await (const chunk of stream) {
        if (chunk.type === "thought") {
          fullThought += chunk.content;
          setMessages((prev) => {
            const newMessages = [...prev];
            newMessages[newMessages.length - 1].thought = fullThought;
            return newMessages;
          });
        } else if (chunk.type === "text") {
          fullContent += chunk.content;
          setMessages((prev) => {
            const newMessages = [...prev];
            let displayContent = fullContent;
            let extractedThought = fullThought;

            const thinkMatch = displayContent.match(/<think>([\s\S]*?)<\/think>/);
            if (thinkMatch) {
              extractedThought = thinkMatch[1].trim();
              displayContent = displayContent.replace(/<think>[\s\S]*?<\/think>/, "").trim();
            } else if (displayContent.includes('<think>')) {
              const parts = displayContent.split('<think>');
              const beforeThink = parts[0];
              const insideThink = parts.slice(1).join('<think>');
              displayContent = beforeThink.trim();
              extractedThought = insideThink.trim();
            }

            newMessages[newMessages.length - 1].content = displayContent;
            newMessages[newMessages.length - 1].thought = extractedThought;
            return newMessages;
          });
        }
      }
      // Generate follow-up suggestions after regeneration
      const updatedMessages = [...newMessages, { role: "model", content: fullContent, thought: fullThought, timestamp: Date.now() }];
      generateFollowUpSuggestions(updatedMessages).then(setSuggestions);
    } catch (error) {
      console.error("Error regenerating:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleThought = (timestamp: number) => {
    setExpandedThoughts(prev => ({ ...prev, [timestamp]: !prev[timestamp] }));
  };

  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  const handleTouchStart = (e: React.TouchEvent, sessionId: string) => {
    longPressTimer.current = setTimeout(() => {
      showSessionMenu(e, sessionId);
    }, 500); // 500ms for long press
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const showSessionMenu = (e: React.MouseEvent | React.TouchEvent, sessionId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const pos = 'touches' in e ? (e as React.TouchEvent).touches[0] : (e as React.MouseEvent);
    setSessionContextMenu({
      visible: true,
      x: pos.clientX,
      y: pos.clientY,
      sessionId
    });
  };

  const handleRenameSession = () => {
    if (!sessionContextMenu) return;
    const session = sessions.find(s => s.id === sessionContextMenu.sessionId);
    if (session) {
      setRenamingSessionId(session.id);
      setRenamingValue(session.title);
    }
    setSessionContextMenu(null);
  };

  const confirmRename = () => {
    if (!renamingSessionId) return;
    setSessions(prev => prev.map(s => 
      s.id === renamingSessionId ? { ...s, title: renamingValue } : s
    ));
    setRenamingSessionId(null);
  };

  const [isActiveFullscreen, setIsActiveFullscreen] = useState(false);

  // Fullscreen logic
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsActiveFullscreen(true)).catch(e => {
        console.error(`Error attempting to enable full-screen mode: ${e.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => setIsActiveFullscreen(false));
      }
    }
  };

  useEffect(() => {
    const handleFsChange = () => setIsActiveFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    
    const handleFirstClick = () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
      window.removeEventListener('click', handleFirstClick);
    };
    window.addEventListener('click', handleFirstClick);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      window.removeEventListener('click', handleFirstClick);
    }
  }, []);

  const showMenu = (e: React.MouseEvent | React.TouchEvent, index: number, role: "user" | "model") => {
    e.preventDefault();
    const pos = 'touches' in e ? (e as React.TouchEvent).touches[0] : (e as React.MouseEvent);
    setContextMenu({
      visible: true,
      x: pos.clientX,
      y: pos.clientY,
      messageIndex: index,
      role
    });
  };

  // Close menu on click outside
  useEffect(() => {
    const handleClose = () => {
      setContextMenu(null);
      setSessionContextMenu(null);
    };
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, []);

  const toggleThinkingMode = (mode: ThinkingLevel) => {
    if (mode === ThinkingLevel.HIGH && thinkingMode !== ThinkingLevel.HIGH) {
      setShowThinkingModal(true);
    } else {
      setThinkingMode(mode);
    }
  };

  const confirmThinkingMode = () => {
    setThinkingMode(ThinkingLevel.HIGH);
    setShowThinkingModal(false);
  };

  const startSpeechRecognition = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert("Ваш браузер не поддерживает распознавание речи.");
      return;
    }

    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.lang = 'ru-RU';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsRecording(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(prev => prev + (prev ? " " : "") + transcript);
      setIsRecording(false);
    };
    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);

    recognition.start();
  };

  return (
    <div 
      className="flex bg-[#050507] text-neutral-100 font-sans overflow-hidden transition-[height] duration-75"
      style={{ height: viewportHeight }}
    >
      {/* Sidebar Overlay for Mobile */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60] lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Thinking Mode Modal */}
      <AnimatePresence>
        {showThinkingModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="max-w-md w-full bg-[#0d0d0f] border border-white/10 rounded-3xl p-8 shadow-2xl"
            >
              <div className="w-16 h-16 bg-purple-600/20 rounded-2xl flex items-center justify-center mb-6 border border-purple-500/20">
                <Brain className="w-8 h-8 text-purple-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3 tracking-tight">Активация режима Deep Think</h3>
              <p className="text-neutral-400 text-sm leading-relaxed mb-8">
                Эта модель тратит больше времени на размышления, что делает её идеальной для сложных вычислений, 
                кодинга и глубокого анализа. Для обычного общения мы рекомендуем оставить быстрый режим. 
                Включить глубокое размышление?
              </p>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={confirmThinkingMode}
                  className="w-full py-4 bg-purple-600 hover:bg-purple-500 rounded-2xl text-sm font-bold transition-all shadow-lg shadow-purple-600/20"
                >
                  Да, активировать аналитику
                </button>
                <button 
                  onClick={() => setShowThinkingModal(false)}
                  className="w-full py-4 bg-neutral-900 hover:bg-neutral-800 border border-white/5 rounded-2xl text-sm font-bold transition-all"
                >
                  Оставить быстрый режим
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Context Menu Component */}
      <AnimatePresence>
        {contextMenu && contextMenu.visible && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed z-[110] bg-[#121214] border border-white/10 rounded-2xl p-2 w-56 shadow-2xl backdrop-blur-2xl"
            style={{ 
              left: Math.min(contextMenu.x, window.innerWidth - 240), 
              top: Math.min(contextMenu.y, window.innerHeight - 200) 
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-1">
              <button 
                onClick={() => copyToClipboard(messages[contextMenu.messageIndex].content)}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 rounded-xl text-left transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-neutral-900 flex items-center justify-center">
                  <Command className="w-4 h-4 text-neutral-400" />
                </div>
                <span className="text-xs font-semibold">Копировать</span>
              </button>
              
              <button 
                onClick={() => handleRegenerate(contextMenu.messageIndex)}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 rounded-xl text-left transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-600/10 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-blue-500" />
                </div>
                <span className="text-xs font-semibold">Перегенерировать</span>
              </button>

              {contextMenu.role === "model" && (
                <button 
                  onClick={() => handleRegenerate(contextMenu.messageIndex, true)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 rounded-xl text-left transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-yellow-600/10 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-yellow-500" />
                  </div>
                  <span className="text-xs font-semibold text-neutral-200">Сравнить с Fast</span>
                </button>
              )}

              {contextMenu.role === "user" && (
                <button 
                  onClick={() => handleEditMessage(contextMenu.messageIndex)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 rounded-xl text-left transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-green-600/10 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-green-500" />
                  </div>
                  <span className="text-xs font-semibold">Редактировать</span>
                </button>
              )}
            </div>
            <div className="mt-2 pt-2 border-t border-white/5 px-3 py-1 text-center">
              <p className="text-[9px] text-neutral-600 font-bold uppercase tracking-[0.2em] leading-none">Nexus Actions</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {sessionContextMenu && sessionContextMenu.visible && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed z-[120] bg-[#121214] border border-white/10 rounded-2xl p-2 w-56 shadow-2xl backdrop-blur-2xl"
            style={{ 
              left: Math.min(sessionContextMenu.x, window.innerWidth - 240), 
              top: Math.min(sessionContextMenu.y, window.innerHeight - 200) 
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-1">
              <button 
                onClick={handleRenameSession}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 rounded-xl text-left transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-600/10 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-blue-500" />
                </div>
                <span className="text-xs font-semibold">Переименовать</span>
              </button>
              
              <button 
                onClick={() => {
                  deleteSession(sessionContextMenu.sessionId, { stopPropagation: () => {} } as any);
                  setSessionContextMenu(null);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-red-500/10 rounded-xl text-left transition-colors group"
              >
                <div className="w-8 h-8 rounded-lg bg-red-600/10 flex items-center justify-center group-hover:bg-red-600/20">
                  <Trash2 className="w-4 h-4 text-red-500" />
                </div>
                <span className="text-xs font-semibold text-red-400">Удалить чат</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-[70] w-80 bg-[#08080a] border-r border-neutral-800/40 flex flex-col transition-all duration-500 lg:relative lg:translate-x-0 lg:z-50
        ${isSidebarOpen ? "translate-x-0 shadow-[20px_0_50px_rgba(0,0,0,0.5)]" : "-translate-x-full"}
      `}>
        <div className="p-8 border-b border-neutral-800/20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative group">
              <div className="absolute -inset-1 bg-blue-600 rounded-lg blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
              <div className="relative w-10 h-10 bg-neutral-900 border border-neutral-800 rounded-lg flex items-center justify-center">
                <Cpu className="w-6 h-6 text-blue-500" />
              </div>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white leading-none mb-1">Nexus Pro</h1>
              <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest bg-neutral-900 px-1.5 py-0.5 rounded border border-neutral-800">Advanced AI System</span>
            </div>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 text-neutral-500 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-none">
          <section className="space-y-4">
            <h2 className="text-[10px] uppercase tracking-widest font-bold text-neutral-600 flex items-center gap-2">
              <Zap className="w-3 h-3 text-yellow-500" />
              Режим работы
            </h2>
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => setThinkingMode(ThinkingLevel.LOW)}
                className={`p-3 rounded-xl border text-left transition-all ${thinkingMode === ThinkingLevel.LOW ? "bg-blue-600/10 border-blue-600/50 text-blue-400" : "bg-neutral-900/50 border-neutral-800 text-neutral-500 hover:border-neutral-700"}`}
              >
                <Zap className="w-4 h-4 mb-2" />
                <span className="text-xs font-bold block">Быстрый</span>
                <span className="text-[9px] opacity-60">Повседневный</span>
              </button>
              <button 
                onClick={() => toggleThinkingMode(ThinkingLevel.HIGH)}
                className={`p-3 rounded-xl border text-left transition-all ${thinkingMode === ThinkingLevel.HIGH ? "bg-purple-600/10 border-purple-600/50 text-purple-400" : "bg-neutral-900/50 border-neutral-800 text-neutral-500 hover:border-neutral-700"}`}
              >
                <Brain className="w-4 h-4 mb-2" />
                <span className="text-xs font-bold block">Deep Think</span>
                <span className="text-[9px] opacity-60">Размышления</span>
              </button>
            </div>
          </section>

          <section className="space-y-4">
             <button 
              onClick={createNewChat}
              className="w-full py-4 px-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl flex items-center justify-between transition-all group overflow-hidden relative shadow-inner"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-semibold tracking-wide">Новый чат</span>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-600 group-hover:translate-x-1 transition-transform" />
            </button>
          </section>

          <section className="space-y-4">
            <h2 className="text-[10px] uppercase tracking-widest font-bold text-neutral-600">Сохраненные чаты</h2>
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/5">
              {sessions.map(s => (
                <div key={s.id} className="relative group">
                  {renamingSessionId === s.id ? (
                    <motion.div 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-2 p-2 bg-white/10 rounded-xl border border-blue-500/30"
                    >
                      <input 
                        autoFocus
                        value={renamingValue}
                        onBlur={confirmRename}
                        onChange={(e) => setRenamingValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') confirmRename();
                          if (e.key === 'Escape') setRenamingSessionId(null);
                        }}
                        className="bg-transparent text-xs text-white border-none outline-none flex-1 min-w-0"
                      />
                      <button onClick={confirmRename} className="p-1.5 bg-blue-600 rounded-lg text-white hover:bg-blue-500 transition-colors">
                        <Sparkles className="w-3.5 h-3.5" />
                      </button>
                    </motion.div>
                  ) : (
                    <div
                      onClick={() => { setCurrentSessionId(s.id); setIsSidebarOpen(false); }}
                      onContextMenu={(e) => showSessionMenu(e, s.id)}
                      onTouchStart={(e) => handleTouchStart(e, s.id)}
                      onTouchEnd={handleTouchEnd}
                      onTouchMove={handleTouchEnd}
                      role="button"
                      tabIndex={0}
                      className={`w-full flex items-center justify-between gap-3 p-3 rounded-xl border transition-all text-left group cursor-pointer ${currentSessionId === s.id ? 'bg-white/10 border-white/20' : 'border-transparent hover:bg-white/5'}`}
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className={`shrink-0 w-2 h-2 rounded-full ${currentSessionId === s.id ? 'bg-blue-500 animate-pulse' : 'bg-neutral-800'}`} />
                        <span className="text-xs text-neutral-300 truncate font-medium">{s.title || "Новый чат"}</span>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setRenamingSessionId(s.id); setRenamingValue(s.title); }}
                          className="p-1 text-neutral-600 hover:text-blue-400"
                        >
                          <FileText className="w-3 h-3" />
                        </button>
                        <button 
                          onClick={(e) => deleteSession(s.id, e)}
                          className="p-1 text-neutral-600 hover:text-red-400"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {sessions.length === 0 && (
                <div className="text-center p-8 border border-dashed border-neutral-800 rounded-2xl">
                  <Terminal className="w-6 h-6 text-neutral-900 mx-auto mb-2" />
                  <p className="text-[9px] text-neutral-700 uppercase font-mono tracking-widest">Нет чатов</p>
                </div>
              )}
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-[10px] uppercase tracking-widest font-bold text-neutral-600">Система</h2>
            <div className="space-y-2">
              <div className="p-4 bg-neutral-900/50 border border-neutral-800 rounded-2xl space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-neutral-500 uppercase font-bold">Модель:</span>
                  <span className="text-[10px] font-mono font-bold text-blue-400">Flash 3.0</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-neutral-500 uppercase font-bold">Ядро:</span>
                  <span className="text-[10px] font-mono font-bold text-purple-400">Reasoning</span>
                </div>
              </div>

              {deferredPrompt && (
                <button 
                  onClick={handleInstallClick}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 rounded-xl text-[10px] uppercase tracking-widest font-bold text-white transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
                >
                  <Download className="w-3 h-3" />
                  Установить Nexus
                </button>
              )}
            </div>
          </section>
        </div>

        <div className="p-6 bg-[#060608]/50 border-t border-neutral-800/20 backdrop-blur-xl space-y-3">
          <button 
            onClick={exportAllData}
            className="w-full py-3 px-4 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] uppercase tracking-widest font-bold text-neutral-400 transition-all flex items-center justify-center gap-2 border border-white/5"
          >
            <Send className="w-3 h-3 rotate-90" />
            Экспорт данных
          </button>
          <button 
            onClick={clearChat}
            className="w-full py-3 px-4 text-[10px] uppercase tracking-widest font-bold text-neutral-500 hover:text-red-400 transition-all flex items-center justify-center gap-2"
          >
            <Trash2 className="w-3 h-3" />
            Очистить всё
          </button>
        </div>
      </aside>

      {/* Main UI */}
      <main className="flex-1 flex flex-col relative bg-[#050507] overflow-x-hidden w-full max-w-full">
        {/* Animated Background Gradients */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
          <div className={`absolute top-[-10%] left-[-10%] w-[40%] h-[40%] blur-[120px] rounded-full animate-pulse transition-colors duration-1000 ${accentColor.glow}`} />
          <div className={`absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] blur-[120px] rounded-full animate-pulse transition-colors duration-1000 ${accentColor.glow}`} />
        </div>

        {/* Top Header */}
        <header className="h-16 flex items-center justify-between px-6 md:px-8 border-b border-white/[0.03] backdrop-blur-3xl bg-black/20 z-40">
          <div className="flex items-center gap-4 md:gap-6">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="lg:hidden p-2 hover:bg-white/5 rounded-lg active:scale-95 transition-transform">
              <Menu className="w-5 h-5 text-neutral-400" />
            </button>
            <div className="flex items-center gap-3">
              <div className="flex -space-x-1.5">
                <div className="w-6 h-6 rounded-full bg-blue-600 border border-black flex items-center justify-center text-[10px] font-bold shadow-lg shadow-blue-500/20">G</div>
                <div className="w-6 h-6 rounded-full bg-purple-600 border border-black flex items-center justify-center text-[10px] font-bold shadow-lg shadow-purple-500/20">N</div>
              </div>
              <span className="text-[11px] font-bold tracking-wider text-neutral-200 uppercase truncate max-w-[120px] md:max-w-none">Nexus Secure Terminal</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-green-500/5 border border-green-500/10 rounded-full">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping" />
              <span className="text-[10px] text-green-500 font-bold uppercase tracking-wider">Online</span>
            </div>
            <div className="h-4 w-px bg-neutral-800 mx-1" />
            <button 
              onClick={toggleFullscreen}
              className="p-2 text-neutral-500 hover:text-white transition-colors"
              title="Полный экран"
            >
              {isActiveFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
            <button className="p-2 text-neutral-500 hover:text-white transition-colors">
              <Info className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Scrollable Area */}
        <div 
          ref={chatContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto overflow-x-hidden w-full scrollbar-thin scrollbar-thumb-white/5 scrollbar-track-transparent"
        >
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-8 max-w-3xl mx-auto space-y-12">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative"
              >
                <div className="absolute -inset-8 bg-blue-600/10 blur-3xl rounded-full"></div>
                <div className="relative w-28 h-28 bg-neutral-900/50 border border-white/5 rounded-3xl flex items-center justify-center backdrop-blur-2xl">
                  <Cpu className="w-12 h-12 text-blue-500" />
                </div>
              </motion.div>

              <div className="text-center space-y-4">
                <motion.h2 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-3xl md:text-5xl font-bold tracking-tight text-white leading-tight"
                >
                  Добро пожаловать в <br /><span className="text-blue-500 drop-shadow-[0_0_15px_rgba(59,130,246,0.3)] italic">Nexus Pro Edition.</span>
                </motion.h2>
                <motion.p 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="text-sm md:text-lg text-neutral-500 max-w-xl mx-auto font-medium px-4"
                >
                  Продвинутый интерфейс для анализа данных, генерации кода и глубоких размышлений с помощью Gemini AI.
                </motion.p>
              </div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full"
              >
                {[
                  { icon: <ImageIcon />, label: "Проанализируй изображение", prompt: "Что на этом фото?" },
                  { icon: <Terminal />, label: "Оптимизируй алгоритм", prompt: "Как ускорить этот код на Python?" },
                  { icon: <Brain />, label: "Глубокое размышление", prompt: "В чем смысл жизни по версии ИИ?" },
                  { icon: <FileText />, label: "Краткий пересказ", prompt: "Сделай саммари этого текста" }
                ].map((item, idx) => (
                  <button 
                    key={idx}
                    onClick={() => { setInput(item.prompt); inputRef.current?.focus(); }}
                    className="flex items-center gap-4 p-5 bg-[#0d0d0f] border border-white/[0.03] hover:border-blue-600/30 rounded-2xl text-left transition-all hover:bg-blue-600/[0.02] group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-neutral-800 text-neutral-400 group-hover:text-blue-400 group-hover:bg-blue-600/10 flex items-center justify-center transition-all">
                      {item.icon}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-neutral-300 mb-0.5">{item.label}</h4>
                      <p className="text-[11px] text-neutral-600 font-mono tracking-tight uppercase">_FAST_EXECUTION_</p>
                    </div>
                  </button>
                ))}
              </motion.div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto px-4 md:px-8 py-8 md:py-16 space-y-8 md:space-y-16 pb-32">
              {messages.map((message, idx) => (
                <ChatMessage 
                  key={message.timestamp + idx} 
                  message={message} 
                  idx={idx} 
                  isLast={idx === messages.length - 1} 
                  isLoading={isLoading}
                  accentColor={accentColor}
                  expandedThoughts={expandedThoughts}
                  toggleThought={toggleThought}
                  showMenu={showMenu}
                />
              ))}
              <div ref={messagesEndRef} className="h-1" />
            </div>
          )}
        </div>

        {/* Input Dock */}
        <div className="p-4 md:p-8 bg-gradient-to-t from-[#050507] via-[#050507] to-transparent z-50">
          <div className="max-w-4xl mx-auto space-y-4">
            
            {/* Contextual Suggestions */}
            <AnimatePresence>
              {suggestions.length > 0 && !isLoading && (
                <motion.div 
                   initial={{ opacity: 0, scale: 0.9 }}
                   animate={{ opacity: 1, scale: 1 }}
                   exit={{ opacity: 0, scale: 0.9 }}
                   className="flex flex-wrap gap-2 justify-end px-4 pb-2"
                 >
                   {suggestions.map((s, i) => (
                     <button
                       key={i}
                       onClick={() => { setInput(s); setSuggestions([]); handleSend(s); }}
                       className="px-3 py-1.5 rounded-2xl bg-white/5 border border-white/5 text-[11px] font-medium text-neutral-400 hover:text-white hover:bg-blue-600/20 hover:border-blue-500/30 active:scale-95 transition-all whitespace-nowrap backdrop-blur-sm"
                     >
                       {s}
                     </button>
                   ))}
                 </motion.div>
               )}
             </AnimatePresence>

            {/* File Previews */}
            <AnimatePresence>
              {attachedFiles.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex flex-wrap gap-2 md:gap-3 p-3 md:p-4 bg-[#0d0d0f]/80 border border-white/[0.05] rounded-2xl backdrop-blur-xl"
                >
                  {attachedFiles.map((file, idx) => (
                    <div key={idx} className="relative group/att">
                      {file.mimeType.startsWith("image/") ? (
                        <div className="w-12 h-12 md:w-16 md:h-16 rounded-lg overflow-hidden border border-white/10 group-hover/att:border-blue-500/50 transition-all">
                          <img src={`data:${file.mimeType};base64,${file.data}`} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="h-12 md:h-16 px-3 md:px-4 bg-neutral-800 border border-neutral-700 rounded-xl flex items-center gap-2 md:gap-3 group-hover/att:border-blue-500/50 transition-all">
                          <FileText className="w-4 h-4 md:w-5 md:h-5 text-blue-400" />
                          <span className="text-[9px] md:text-[10px] font-bold max-w-[60px] truncate">{file.name}</span>
                        </div>
                      )}
                      <button 
                        onClick={() => removeFile(idx)}
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 md:w-5 md:h-5 bg-red-600 rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform"
                      >
                        <X className="w-2.5 h-2.5 md:w-3 md:h-3 text-white" />
                      </button>
                    </div>
                  ))}
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-12 h-12 md:w-16 md:h-16 border border-dashed border-neutral-800 hover:border-blue-500/30 rounded-xl flex items-center justify-center text-neutral-600 hover:text-blue-500 transition-all"
                  >
                    <Paperclip className="w-4 h-4 md:w-5 md:h-5" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input Wrapper */}
            <div className="relative group focus-within:z-50">
              <div className={`absolute -inset-0.5 bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl opacity-10 blur group-focus-within:opacity-25 transition duration-1000`} />
              <div className="relative bg-[#0d0d0f] border border-white/10 shadow-2xl rounded-3xl overflow-hidden backdrop-blur-3xl group-focus-within:border-blue-500/30 transition-all">
                <div className="flex flex-col">
                  {/* Action Bar */}
                  <div className="flex flex-col px-4 bg-white/[0.02] border-b border-white/[0.03]">
                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => fileInputRef.current?.click()}
                          className="p-2 text-neutral-500 hover:text-blue-400 hover:bg-blue-400/5 rounded-xl transition-all flex items-center gap-2 active:scale-95"
                        >
                          <Paperclip className="w-4 h-4" />
                          <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:block">Файл</span>
                        </button>
                        <div className="w-px h-3 bg-neutral-800 mx-1 md:mx-2" />
                        <button 
                          onClick={() => toggleThinkingMode(thinkingMode === ThinkingLevel.HIGH ? ThinkingLevel.LOW : ThinkingLevel.HIGH)}
                          className={`flex items-center gap-2 px-2 md:px-3 py-1.5 rounded-xl border transition-all active:scale-95 ${thinkingMode === ThinkingLevel.HIGH ? "border-purple-600/30 text-purple-400 bg-purple-600/5" : "border-transparent text-neutral-500 hover:bg-white/5"}`}
                        >
                          <Brain className="w-3 h-3" />
                          <span className="text-[9px] font-bold uppercase tracking-widest">{thinkingMode === ThinkingLevel.HIGH ? "Deep Think ON" : "Normal"}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-end p-2 px-3 md:px-4 gap-2">
                    <textarea
                      ref={inputRef}
                      rows={1}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder="Сообщение..."
                      className="flex-1 bg-transparent border-none text-sm md:text-base text-neutral-200 py-3 px-1 focus:ring-0 resize-none placeholder-neutral-700 min-h-[44px]"
                    />
                    
                    <div className="flex items-center pb-2 px-1 gap-2">
                      <button
                        onClick={startSpeechRecognition}
                        className={`p-2 rounded-xl transition-all active:scale-95 ${isRecording ? 'bg-red-500/20 text-red-500 animate-pulse' : 'hover:bg-white/5 text-neutral-400'}`}
                      >
                        {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                      </button>

                      <button
                        disabled={(!input.trim() && attachedFiles.length === 0) || isLoading}
                        onClick={() => handleSend()}
                        className={`
                          w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center transition-all active:scale-90
                          ${(input.trim() || attachedFiles.length > 0) && !isLoading 
                            ? `${accentColor.bg} text-white shadow-xl ${accentColor.shadow}` 
                            : "bg-neutral-800 text-neutral-600 cursor-not-allowed"
                          }
                        `}
                      >
                        {isLoading ? <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" /> : <Send className="w-4 h-4 md:w-5 md:h-5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              multiple 
              className="hidden" 
            />
          </div>
        </div>
      </main>
    </div>
  );
}



