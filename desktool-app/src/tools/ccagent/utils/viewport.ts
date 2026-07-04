// viewport.ts — 视口工具

export function isElementInViewport(el: HTMLElement, container?: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  if (container) {
    const cRect = container.getBoundingClientRect();
    return rect.top >= cRect.top && rect.bottom <= cRect.bottom;
  }
  return rect.top >= 0 && rect.bottom <= window.innerHeight;
}

export function scrollToElement(el: HTMLElement, behavior: ScrollBehavior = "smooth"): void {
  el.scrollIntoView({ behavior, block: "start" });
}

export function scrollToBottom(container: HTMLElement, behavior: ScrollBehavior = "smooth"): void {
  container.scrollTo({ top: container.scrollHeight, behavior });
}

export function isScrolledToBottom(container: HTMLElement, threshold = 50): boolean {
  const distFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
  return distFromBottom <= threshold;
}

export function isScrolledToTop(container: HTMLElement, threshold = 50): boolean {
  return container.scrollTop <= threshold;
}
