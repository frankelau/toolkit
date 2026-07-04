// WaitingIndicator — 等待响应指示器
// 对齐 cc-gui 的 WaitingIndicator.tsx
// 展示旋转图标 + "正在生成响应..." + 省略号动画 + 已耗时计时

import { useState, useEffect } from "react";

interface WaitingIndicatorProps {
  size?: number;
  /** 加载开始时间戳（ms），用于跨视图切换保持计时连续 */
  startTime?: number;
}

export function WaitingIndicator({ size = 18, startTime }: WaitingIndicatorProps) {
  const [dotCount, setDotCount] = useState(1);
  const [elapsedSeconds, setElapsedSeconds] = useState(() => {
    if (startTime) return Math.floor((Date.now() - startTime) / 1000);
    return 0;
  });

  // 省略号动画（1→2→3 循环）
  useEffect(() => {
    const timer = setInterval(() => {
      setDotCount(prev => (prev % 3) + 1);
    }, 500);
    return () => clearInterval(timer);
  }, []);

  // 计时器
  useEffect(() => {
    const timer = setInterval(() => {
      if (startTime) {
        setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
      } else {
        setElapsedSeconds(prev => prev + 1);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [startTime]);

  const dots = ".".repeat(dotCount);
  const spinnerStyle: React.CSSProperties = { width: size, height: size };

  // 格式化耗时：<60s 显示 "X 秒"，>=60s 显示 "X 分 Y 秒"
  const formatElapsedTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds} 秒`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes} 分 ${remainingSeconds} 秒`;
  };

  return (
    <div className="cc-waiting-indicator">
      <span className="cc-waiting-spinner" style={spinnerStyle} />
      <span className="cc-waiting-text">
        正在生成响应<span className="cc-waiting-dots">{dots}</span>
        <span className="cc-waiting-seconds">（已耗时 {formatElapsedTime(elapsedSeconds)}）</span>
      </span>
    </div>
  );
}

export default WaitingIndicator;
