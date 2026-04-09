const getScrollContainer = (element: HTMLElement | null): HTMLElement | Window => {
  let current = element;

  while (current) {
    const { overflowY } = window.getComputedStyle(current);
    const isScrollable = /(auto|scroll|overlay)/.test(overflowY);

    if (isScrollable && current.scrollHeight > current.clientHeight) {
      return current;
    }

    current = current.parentElement;
  }

  return window;
};

export const scrollPrimaryContentToTop = (
  behavior: ScrollBehavior = "auto",
) => {
  requestAnimationFrame(() => {
    const mainContent = document.getElementById("main-content");
    const scrollContainer = getScrollContainer(mainContent);

    if (scrollContainer === window) {
      window.scrollTo({ top: 0, behavior });
      return;
    }

    scrollContainer.scrollTo({ top: 0, behavior });
  });
};
