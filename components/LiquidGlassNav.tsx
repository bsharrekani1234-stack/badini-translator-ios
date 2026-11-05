"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { TabBar } from "glisse";
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  // Ordered visually from Left to Right so `glisse` LTR lens physics work 100% accurately
  // while keeping "وەرگێڕان" on the far right for Kurdish RTL layout!
  const glisseItems = [
    { value: "export", label: "ڕێکخستن", icon: <Settings size={16} /> },
    { value: "chat", label: "شیرەتکار", icon: <Sparkles size={16} /> },
    { value: "audio", label: "دەنگ", icon: <Headphones size={16} /> },
    { value: "reader", label: "خویندن", icon: <BookOpen size={16} /> },
    { value: "library", label: "پەرتووکخانە", icon: <Library size={16} /> },
    { value: "upload", label: "وەرگێڕان", icon: <Languages size={16} /> },
  ];

  return createPortal(
    <div
      dir="ltr"
      className="no-print md:hidden flex justify-center px-3 pointer-events-none select-none touch-none"
      style={{
        position: "fixed",
        bottom: "calc(12px + env(safe-area-inset-bottom, 0px))",
        left: 0,
        right: 0,
        zIndex: 99999,
      }}
    >
      <div
        dir="ltr"
        className="pointer-events-auto touch-none flex justify-center w-full max-w-[356px] [&>*]:!max-w-full [&_button]:!min-w-[52px] [&_button]:!px-1 [&_button]:!text-[10px] [&_[role=tab]]:!min-w-[52px] [&_[role=tab]]:!px-1 [&_[role=tab]]:!text-[10px]"
      >
        <TabBar
          aria-label="Navigation"
          items={glisseItems}
          value={activeTab}
          onValueChange={onChangeTab}
        />
      </div>
    </div>,
    document.body
  );
}
