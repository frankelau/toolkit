// AnimatedText — 逐字符动画文字
// 对齐 cc-gui 的 AnimatedText/index.tsx
// 文字变化时：旧文字从右到左消失，新文字从左到右出现

import { useEffect, useRef, useState } from "react";

interface AnimatedTextProps {
  text: string;
}

export function AnimatedText({ text }: AnimatedTextProps) {
  const [displayContent, setDisplayContent] = useState(text);
  const [mode, setMode] = useState<"visible" | "hidden">("visible");
  const [animDirection, setAnimDirection] = useState<"in" | "out">("in");
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (text !== displayContent) {
      // 步骤 1：旧文字从右到左消失
      setAnimDirection("out");
      setMode("hidden");
      const step = 8; // ms 每字符
      const duration = 35; // 过渡时长
      const exitTime = displayContent.length * step + duration;
      const timer = setTimeout(() => {
        // 步骤 2：切换内容，新文字从左到右出现
        setDisplayContent(text);
        setAnimDirection("in");
        setMode("visible");
      }, exitTime);
      return () => clearTimeout(timer);
    }
  }, [text, displayContent]);

  const chars = displayContent.split("");

  return (
    <div className="cc-animated-text">
      {chars.map((char, i) => {
        let delay = 0;
        const step = 10;
        if (animDirection === "out") {
          // 从右到左消失：最后一个字符先消失
          delay = (chars.length - 1 - i) * step;
        } else {
          // 从左到右出现：第一个字符先出现
          delay = i * step;
        }
        return (
          <span
            key={i}
            className={`cc-animated-char ${mode === "visible" ? "cc-char-visible" : "cc-char-hidden"}`}
            style={{ transitionDelay: `${delay}ms` }}
          >
            {char}
          </span>
        );
      })}
    </div>
  );
}
