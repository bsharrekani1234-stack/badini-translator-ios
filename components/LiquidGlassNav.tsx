"use client";

import React, { useState, useRef } from "react";
import { motion, useSpring } from "motion/react";
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

const DEFAULT_TABS: TabItem[] = [
  { id: "upload", label: "وەرگێڕان", icon: Languages },
  { id: "library", label: "پەرتووکخانە", icon: Library },
  { id: "reader", label: "خویندن", icon: BookOpen },
  { id: "audio", label: "دەنگ", icon: Headphones },
  { id: "chat", label: "شیرەتکار", icon: Sparkles },
  { id: "export", label: "ڕێکخستن", icon: Settings },
];

export default function LiquidGlassNav({
  activeTab,
  onChangeTab,
  tabs = DEFAULT_TABS,
}: LiquidGlassNavProps) {
  const navRef = useRef<HTMLDivElement>(null);
  const [isPressed, setIsPressed] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number>(() =>
    Math.max(0, tabs.findIndex((t) => t.id === activeTab))
  );

  const pillX = useSpring(0, { stiffness: 560, damping: 34, mass: 0.4 });
  const pillScale = useSpring(1, { stiffness: 580, damping: 28, mass: 0.4 });
  const stretchX = useSpring(1, { stiffness: 520, damping: 26, mass: 0.4 });

  React.useEffect(() => {
    if (!navRef.current || isPressed) return;
    const idx = Math.max(0, tabs.findIndex((t) => t.id === activeTab));
    const rect = navRef.current.getBoundingClientRect();
    const tabWidth = (rect.width - 8) / tabs.length;
    pillX.set(idx * tabWidth);
    setHoveredIndex(idx);
  }, [activeTab, isPressed, pillX, tabs]);

  const updatePointerPosition = (clientX: number) => {
    if (!navRef.current) return;
    const rect = navRef.current.getBoundingClientRect();
    const tabWidth = (rect.width - 8) / tabs.length;
    const relativeX = clientX - rect.left - 4 - tabWidth / 2;

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
    pillScale.set(1.12);
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
    const tabWidth = (rect.width - 8) / tabs.length;
    pillX.set(hoveredIndex * tabWidth);

    const selectedTab = tabs[hoveredIndex];
    if (selectedTab) {
      onChangeTab(selectedTab.id);
    }
  };

  return (
    <div className="no-print md:hidden fixed bottom-2.5 left-0 right-0 z-50 flex justify-center px-3 pointer-events-none">
      <div
        ref={navRef}
        dir="ltr"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          background: "rgba(22, 22, 24, 0.22)",
          backdropFilter: "blur(1px)",
          WebkitBackdropFilter: "blur(1px)",
        }}
        className="relative flex items-center justify-between w-full max-w-[330px] h-[46px] p-1 rounded-full border border-white/15 shadow-[0_8px_24px_rgba(0,0,0,0.22)] select-none touch-none pointer-events-auto cursor-pointer overflow-visible"
      >
        <motion.div
          style={{
            x: pillX,
            scale: pillScale,
            scaleX: stretchX,
            width: `calc((100% - 8px) / ${tabs.length})`,
          }}
          className="absolute top-1 bottom-1 left-1 rounded-full pointer-events-none z-10"
        >
          <div
            className="w-full h-full rounded-full transition-all duration-200"
            style={{
              background: isPressed
                ? "radial-gradient(120% 120% at 50% 20%, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 55%, rgba(10,132,255,0.05) 100%)"
                : "rgba(255, 255, 255, 0.02)",
              backdropFilter: "blur(1px)",
              WebkitBackdropFilter: "blur(1px)",
              boxShadow: isPressed
                ? `
                  inset 0 1px 2px rgba(255, 255, 255, 0.45),
                  inset 0 -1px 2px rgba(0, 170, 255, 0.3),
                  0 6px 16px rgba(0, 0, 0, 0.2),
                  0 0 12px rgba(10, 132, 255, 0.15)
                `
                : `
                  inset 0 1px 1px rgba(255, 255, 255, 0.22),
                  0 2px 8px rgba(0, 0, 0, 0.12)
                `,
              border: isPressed
                ? "1px solid rgba(255, 255, 255, 0.32)"
                : "1px solid rgba(255, 255, 255, 0.14)",
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
                  scale: isFocused && isPressed ? 1.1 : isFocused ? 1.03 : 1,
                  y: isFocused && isPressed ? -1 : 0,
                }}
                transition={{ type: "spring", stiffness: 450, damping: 22 }}
                className="relative flex flex-col items-center justify-center gap-0.5 min-w-0 w-full"
              >
                <div className="relative">
                  <Icon
                    size={14}
                    strokeWidth={isFocused ? 2.2 : 1.75}
                    className={`transition-colors duration-150 ${
                      isFocused
                        ? "text-[#0A84FF] drop-shadow-[0_0_8px_rgba(10,132,255,0.5)]"
                        : "text-white/90"
                    }`}
                  />
                  {tab.badge !== undefined && (
                    <span className="absolute -top-1 -right-2 px-1 py-0 text-[7px] font-bold text-white bg-[#FF3B30] rounded-full shadow-sm">
                      {tab.badge}
                    </span>
                  )}
                </div>

                <span
                  className={`text-[8.5px] font-semibold tracking-tight truncate max-w-full leading-none transition-colors duration-150 ${
                    isFocused ? "text-[#0A84FF]" : "text-white/85"
                  }`}
                >
                  {tab.label}
                </span>
              </motion.div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
