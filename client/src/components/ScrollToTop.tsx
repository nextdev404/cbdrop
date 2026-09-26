import { useState, useEffect } from "react";
import { ArrowUp } from "lucide-react";

export function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function toggleVisible() {
      if (window.scrollY > 280) {
        setVisible(true);
      } else {
        setVisible(false);
      }
    }

    window.addEventListener("scroll", toggleVisible, { passive: true });
    toggleVisible();

    return () => window.removeEventListener("scroll", toggleVisible);
  }, []);

  function scrollToTop() {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Scroll to top"
      className={`fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-40 flex size-11 sm:size-12 items-center justify-center rounded-full border border-[#dfe0d8] bg-white/85 text-[#686b75] shadow-[0_8px_24px_rgba(17,18,24,0.08)] backdrop-blur-md transition-all duration-300 ease-out hover:border-[#5e5ce6]/50 hover:bg-[#5e5ce6] hover:text-white hover:shadow-[0_10px_28px_rgba(94,92,230,0.35)] active:scale-90 dark:border-white/10 dark:bg-[#16181f]/85 dark:text-[#9ea1ad] dark:hover:border-[#5e5ce6]/60 dark:hover:bg-[#5e5ce6] dark:hover:text-white ${
        visible
          ? "translate-y-0 scale-100 opacity-100 pointer-events-auto"
          : "translate-y-4 scale-90 opacity-0 pointer-events-none"
      }`}
    >
      <ArrowUp size={20} strokeWidth={2.5} className="transition-transform duration-200 group-hover:-translate-y-0.5" />
    </button>
  );
}
export default ScrollToTop;
