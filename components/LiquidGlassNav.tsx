"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
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
  const rectRef = useRef<DOMRect | null>(null);
  const isPressedRef = useRef(false);
  const hoveredIdxRef = useRef(0);

  const [mounted, setMounted] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState(0);

  // Smooth 120fps spring physics without lag
  const pillX = useSpring(0, { stiffness: 480, damping: 32, mass: 0.45 });
  const pillScale = useSpring(1, { stiffness: 520, damping: 26, mass: 0.4 });
  const stretchX = useSpring(1, { stiffness: 460, damping: 24, mass: 0.4 });

  useEffect(() => {
    setMounted(true);
  }, []);

  // Calculate visual LTR index (0 = leftmost on screen, N-1 = rightmost on screen)
  // Since we render in RTL order (index 0 on right), visual LTR position for tab index `idx` is `(tabs.length - 1 - idx)`
  const getVisualLtrIndex = (tabIdx: number, count: number) => {
    return count - 1 - tabIdx;
  };

  const getTabIndexFromVisualLtr = (visualIdx: number, count: number) => {
    return count - 1 - visualIdx;
  };

  // Sync pill position ONLY when activeTab changes and user is NOT touching
  useEffect(() => {
    if (!mounted || !navRef.current || isPressedRef.current) return;
    const foundIdx = tabs.findIndex((t) => t.id === activeTab);
    const tabIdx = foundIdx >= 0 ? foundIdx : 0;

    const rect = navRef.current.getBoundingClientRect();
    if (rect.width === 0) return;

    const innerWidth = rect.width - 12; // 6px padding each side
    const tabWidth = innerWidth / tabs.length;
    const visualIdx = getVisualLtrIndex(tabIdx, tabs.length);

    pillX.set(visualIdx * tabWidth);
    hoveredIdxRef.current = tabIdx;
    setHoveredIndex(tabIdx);
  }, [activeTab, tabs.length, mounted, pillX]);

  const updateFromClientX = (clientX: number, instant = false) => {
    const rect = rectRef.current || navRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;

    const count = tabs.length;
    const innerWidth = rect.width - 12;
    const tabWidth = innerWidth / count;

    // Position relative to left inner edge (0 to maxPos)
    const rawX = clientX - rect.left - 6 - tabWidth / 2;
    const maxPos = (count - 1) * tabWidth;
    const clampedX = Math.max(0, Math.min(maxPos, rawX));

    if (instant) {
      pillX.set(clampedX);
    } else {
      const diff = Math.abs(clampedX - pillX.get());
      stretchX.set(1 + Math.min(diff / 220, 0.14));
      pillX.set(clampedX);
    }

    // Determine which visual slot (from left) the finger is over
    const visualIdx = Math.max(0, Math.min(count - 1, Math.round(clampedX / tabWidth)));
    const actualTabIdx = getTabIndexFromVisualLtr(visualIdx, count);

    if (actualTabIdx !== hoveredIdxRef.current) {
      hoveredIdxRef.current = actualTabIdx;
      setHoveredIndex(actualTabIdx);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!navRef.current) return;
    rectRef.current = navRef.current.getBoundingClientRect();
    e.currentTarget.setPointerCapture(e.pointerId);

    isPressedRef.current = true;
    setIsPressed(true);
    pillScale.set(1.12);
    updateFromClientX(e.clientX, false);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPressedRef.current) return;
    updateFromClientX(e.clientX, false);
  };

  const handlePointerUp = () => {
    if (!isPressedRef.current || !navRef.current) return;
    isPressedRef.current = false;
    setIsPressed(false);
    pillScale.set(1);
    stretchX.set(1);

    const rect = rectRef.current || navRef.current.getBoundingClientRect();
    const count = tabs.length;
    const innerWidth = rect.width - 12;
    const tabWidth = innerWidth / count;

    const targetTabIdx = hoveredIdxRef.current;
    const visualIdx = getVisualLtrIndex(targetTabIdx, count);
    pillX.set(visualIdx * tabWidth);

    const selectedTab = tabs[targetTabIdx];
    if (selectedTab) {
      onChangeTab(selectedTab.id);
    }
  };

  if (!mounted) return null;

  // Render tabs from left-to-right visually (reversed array inside dir="ltr")
  // so index 0 ("وەرگێڕان") is on the far RIGHT, matching RTL expectation AND exact LTR pixel math!
  const visualTabsLtr = [...tabs].reverse();

  return createPortal(
    <div
      style={{
        position: "fixed",
        bottom: "calc(12px + env(safe-area-inset-bottom, 0px))",
        left: 0,
        right: 0,
        zIndex: 99999,
      }}
      className="no-print md:hidden flex justify-center px-3.5 pointer-events-none"
    >
      <div
        ref={navRef}
        dir="ltr"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          background: "rgba(24, 21, 18, 0.82)",
          backdropFilter: "blur(20px) saturate(160%)",
          WebkitBackdropFilter: "blur(20px) saturate(160%)",
        }}
        className="relative flex flex-row items-center justify-between w-full max-w-[348px] h-[56px] p-1.5 rounded-full border border-white/14 shadow-[0_12px_32px_rgba(0,0,0,0.55)] select-none touch-none pointer-events-auto cursor-pointer overflow-hidden"
      >
        {/* LIQUID GLASS LENS PILL */}
        <motion.div
          style={{
            x: pillX,
            scale: pillScale,
            scaleX: stretchX,
            width: `calc((100% - 12px) / ${tabs.length})`,
          }}
          className="absolute top-1.5 bottom-1.5 left-1.5 rounded-full pointer-events-none z-10"
        >
          <div
            className="w-full h-full rounded-full transition-colors duration-150"
            style={{
              background: isPressed
                ? "radial-gradient(120% 120% at 50% 15%, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.08) 60%, rgba(59,130,246,0.14) 100%)"
                : "rgba(255, 255, 255, 0.11)",
              boxShadow: isPressed
                ? "inset 0 1.5px 2px rgba(255, 255, 255, 0.7), inset 0 -1px 3px rgba(59, 130, 246, 0.45), 0 4px 14px rgba(0, 0, 0, 0.35)"
                : "inset 0 1px 1px rgba(255, 255, 255, 0.25), 0 2px 6px rgba(0, 0, 0, 0.2)",
              border: isPressed
                ? "1px solid rgba(255, 255, 255, 0.45)"
                : "1px solid rgba(255, 255, 255, 0.14)",
            }}
          />
        </motion.div>

        {/* TABS (Laid out deterministically in LTR so X-coordinates match 100%) */}
        {visualTabsLtr.map((tab, visualIdx) => {
          const actualTabIdx = getTabIndexFromVisualLtr(visualIdx, tabs.length);
          const Icon = tab.icon;
          const isFocused = hoveredIndex === actualTabIdx;

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
                transition={{ type: "spring", stiffness: 500, damping: 26 }}
                className="relative flex flex-col items-center justify-center gap-0.5 min-w-0 w-full"
              >
                <div className="relative">
                  <Icon
                    size={17}
                    strokeWidth={isFocused ? 2.3 : 1.8}
                    className={`transition-colors duration-150 ${
                      isFocused
                        ? "text-[#3897F0] drop-shadow-[0_0_8px_rgba(56,151,240,0.45)]"
                        : "text-white/75"
                    }`}
                  />
                  {tab.badge !== undefined && (
                    <span className="absolute -top-1 -right-2 px-1 py-0 text-[8px] font-bold text-white bg-[#FF3B30] rounded-full shadow-sm">
                      {tab.badge}
                    </span>
                  )}
                </div>

                <span
                  className={`text-[10px] font-semibold tracking-tight truncate max-w-full leading-tight transition-colors duration-150 ${
                    isFocused ? "text-white" : "text-white/65"
                  }`}
                >
                  {tab.label}
                </span>
              </motion.div>
            </div>
          );
        })}
      </div>
    </div>,
    document.body
  );
}
