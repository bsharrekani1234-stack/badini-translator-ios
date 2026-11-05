"use client";

<<<<<<< HEAD
import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { TabBar } from "glisse";
=======
import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, useSpring } from "motion/react";
>>>>>>> 73b42a5c40ad4694633d04a6b3f10361b69b7ead
import {
  BookOpen,
  Library,
  Languages,
  Headphones,
  Sparkles,
  Settings,
} from "lucide-react";

export interface TabItem {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: string | number;
}

interface LiquidGlassNavProps {
  activeTab: string;
  onChangeTab: (id: string) => void;
  tabs?: TabItem[];
}

export default function LiquidGlassNav({
  activeTab,
  onChangeTab,
}: LiquidGlassNavProps) {
<<<<<<< HEAD
  const [mounted, setMounted] = useState(false);
=======
  const navRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number>(() =>
    Math.max(0, tabs.findIndex((t) => t.id === activeTab))
  );
>>>>>>> 73b42a5c40ad4694633d04a6b3f10361b69b7ead

  useEffect(() => {
    setMounted(true);
  }, []);

<<<<<<< HEAD
  if (!mounted) return null;

  return createPortal(
    <div
      className="no-print md:hidden flex justify-center px-2 pointer-events-none"
=======
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!navRef.current || isPressed) return;
    const idx = Math.max(0, tabs.findIndex((t) => t.id === activeTab));
    const rect = navRef.current.getBoundingClientRect();
    const tabWidth = (rect.width - 10) / tabs.length;
    pillX.set(idx * tabWidth);
    setHoveredIndex(idx);
  }, [activeTab, isPressed, pillX, tabs, mounted]);

  const updatePointerPosition = (clientX: number) => {
    if (!navRef.current) return;
    const rect = navRef.current.getBoundingClientRect();
    const tabWidth = (rect.width - 10) / tabs.length;
    const relativeX = clientX - rect.left - 5 - tabWidth / 2;

    const maxPos = (tabs.length - 1) * tabWidth;
    const clampedX = Math.max(0, Math.min(maxPos, relativeX));

    const diff = Math.abs(clampedX - pillX.get());
    stretchX.set(1 + Math.min(diff / 180, 0.16));

    pillX.set(clampedX);

    const currentIdx = Math.round(clampedX / tabWidth);
    const validIdx = Math.max(0, Math.min(tabs.length - 1, currentIdx));
    setHoveredIndex(validIdx);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!navRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsPressed(true);
    pillScale.set(1.14);
    updatePointerPosition(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPressed || !navRef.current) return;
    updatePointerPosition(e.clientX);
  };

  const handlePointerUp = () => {
    if (!isPressed || !navRef.current) return;
    setIsPressed(false);
    pillScale.set(1);
    stretchX.set(1);

    const rect = navRef.current.getBoundingClientRect();
    const tabWidth = (rect.width - 10) / tabs.length;
    pillX.set(hoveredIndex * tabWidth);

    const selectedTab = tabs[hoveredIndex];
    if (selectedTab) {
      onChangeTab(selectedTab.id);
    }
  };

  const navContent = (
    <div
>>>>>>> 73b42a5c40ad4694633d04a6b3f10361b69b7ead
      style={{
        position: "fixed",
        bottom: "calc(12px + env(safe-area-inset-bottom, 0px))",
        left: 0,
        right: 0,
        zIndex: 99999,
      }}
<<<<<<< HEAD
    >
      <div className="pointer-events-auto max-w-full overflow-x-auto no-scrollbar">
        <TabBar
          aria-label="Navigation"
          items={[
            { value: "upload", label: "وەرگێڕان", icon: <Languages size={18} /> },
            { value: "library", label: "پەرتووکخانە", icon: <Library size={18} /> },
            { value: "reader", label: "خویندن", icon: <BookOpen size={18} /> },
            { value: "audio", label: "دەنگ", icon: <Headphones size={18} /> },
            { value: "chat", label: "شیرەتکار", icon: <Sparkles size={18} /> },
            { value: "export", label: "ڕێکخستن", icon: <Settings size={18} /> },
          ]}
          value={activeTab}
          onValueChange={onChangeTab}
        />
=======
      className="no-print md:hidden flex justify-center px-3 pointer-events-none"
    >
      <div
        ref={navRef}
        dir="ltr"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          background: "rgba(22, 22, 24, 0.28)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
        className="relative flex items-center justify-between w-full max-w-[356px] h-[54px] p-1.5 rounded-full border border-white/15 shadow-[0_8px_24px_rgba(0,0,0,0.28)] select-none touch-none pointer-events-auto cursor-pointer overflow-visible"
      >
        <motion.div
          style={{
            x: pillX,
            scale: pillScale,
            scaleX: stretchX,
            width: `calc((100% - 10px) / ${tabs.length})`,
          }}
          className="absolute top-1 bottom-1 left-1.5 rounded-full pointer-events-none z-10"
        >
          <div
            className="w-full h-full rounded-full transition-all duration-200"
            style={{
              background: isPressed
                ? "radial-gradient(120% 120% at 50% 20%, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 55%, rgba(10,132,255,0.06) 100%)"
                : "rgba(255, 255, 255, 0.04)",
              backdropFilter: "blur(2px)",
              WebkitBackdropFilter: "blur(2px)",
              boxShadow: isPressed
                ? `
                  inset 0 1px 2px rgba(255, 255, 255, 0.5),
                  inset 0 -1px 2px rgba(0, 170, 255, 0.35),
                  0 6px 16px rgba(0, 0, 0, 0.22),
                  0 0 12px rgba(10, 132, 255, 0.18)
                `
                : `
                  inset 0 1px 1px rgba(255, 255, 255, 0.25),
                  0 2px 8px rgba(0, 0, 0, 0.14)
                `,
              border: isPressed
                ? "1px solid rgba(255, 255, 255, 0.35)"
                : "1px solid rgba(255, 255, 255, 0.16)",
            }}
          />
        </motion.div>

        {tabs.map((tab, index) => {
          const Icon = tab.icon;
          const isFocused = hoveredIndex === index;

          return (
            <div
              key={tab.id}
              className="relative z-20 flex flex-col items-center justify-center flex-1 h-full pointer-events-none min-w-0 px-0.5"
            >
              <motion.div
                animate={{
                  scale: isFocused && isPressed ? 1.12 : isFocused ? 1.04 : 1,
                  y: isFocused && isPressed ? -1.5 : 0,
                }}
                transition={{ type: "spring", stiffness: 450, damping: 22 }}
                className="relative flex flex-col items-center justify-center gap-1 min-w-0 w-full"
              >
                <div className="relative">
                  <Icon
                    size={16.5}
                    strokeWidth={isFocused ? 2.2 : 1.8}
                    className={`transition-colors duration-150 ${
                      isFocused
                        ? "text-[#0A84FF] drop-shadow-[0_0_8px_rgba(10,132,255,0.5)]"
                        : "text-white/90"
                    }`}
                  />
                  {tab.badge !== undefined && (
                    <span className="absolute -top-1 -right-2 px-1 py-0 text-[8px] font-bold text-white bg-[#FF3B30] rounded-full shadow-sm">
                      {tab.badge}
                    </span>
                  )}
                </div>

                <span
                  className={`text-[10px] font-semibold tracking-tight truncate max-w-full leading-none transition-colors duration-150 ${
                    isFocused ? "text-[#0A84FF]" : "text-white/85"
                  }`}
                >
                  {tab.label}
                </span>
              </motion.div>
            </div>
          );
        })}
>>>>>>> 73b42a5c40ad4694633d04a6b3f10361b69b7ead
      </div>
    </div>,
    document.body
  );

  if (!mounted) return null;
  return createPortal(navContent, document.body);
}
