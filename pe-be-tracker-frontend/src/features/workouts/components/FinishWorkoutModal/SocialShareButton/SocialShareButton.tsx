import React from 'react';
import { Button } from '@/shared/components/ui/button';

interface SocialShareButtonProps {
  onShare: () => Promise<void>;
  disabled?: boolean;
}

const SocialShareButton: React.FC<SocialShareButtonProps> = ({
  onShare,
  disabled = false,
}) => {
  const handleClick = async () => {
    try {
      await onShare();
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  return (
    <Button onClick={handleClick} disabled={disabled}>
      Share on Social Media
    </Button>
  );
};

export default SocialShareButton;