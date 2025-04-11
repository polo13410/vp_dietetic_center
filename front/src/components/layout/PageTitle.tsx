import { useEffect } from "react";

interface PageTitleProps {
  title: string;
  suffix?: string;
}

/**
 * Component that updates the document title
 * @param title - The page title
 * @param suffix - Optional suffix to append to the title (default: "Dietetic Center")
 */
const PageTitle = ({
  title,
  suffix = "Dietetic Center 🍏",
}: PageTitleProps) => {
  useEffect(() => {
    // Update the document title when the component mounts or title changes
    document.title = suffix ? `${title} | ${suffix}` : title;

    // Clean up on unmount
    return () => {
      document.title = "Dietetic Center 🍏"; // Reset to default title
    };
  }, [title, suffix]);

  // This component doesn't render anything
  return null;
};

export default PageTitle;
