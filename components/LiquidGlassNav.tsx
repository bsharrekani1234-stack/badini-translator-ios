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

  return createPortal(
    <div
      dir="ltr"
      data-theme="dark"
      className="no-print md:hidden flex justify-center px-1.5 pointer-events-none select-none"
      style={{
        position: "fixed",
        bottom: "calc(12px + env(safe-area-inset-bottom, 0px))",
        left: 0,
        right: 0,
        zIndex: 99999,
        overflow: "visible",
      }}
    >
      <div
        className="pointer-events-auto max-w-full"
        style={{ overflow: "visible" }}
      >
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
      </div>
    </div>,
    document.body
  );
}
