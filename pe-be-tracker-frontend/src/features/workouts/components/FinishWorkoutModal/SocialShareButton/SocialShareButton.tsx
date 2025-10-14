import { Button } from "@/shared/components/ui/button";

interface SocialShareButtonProps {
  onShare: () => Promise<void>;
  disabled?: boolean;
}

const SocialShareButton = ({ onShare, disabled = false }: SocialShareButtonProps) => {
  const handleClick = async () => {
    try {
      await onShare();
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  return (
    <Button onClick={handleClick} disabled={disabled}>
      Share on Social Media
    </Button>
  );
};

export default SocialShareButton;
