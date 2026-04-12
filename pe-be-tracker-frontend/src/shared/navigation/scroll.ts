export const scrollPrimaryContentToTop = (
  behavior: ScrollBehavior = "auto",
) => {
  requestAnimationFrame(() => {
    window.scrollTo({ top: 0, behavior });
  });
};
