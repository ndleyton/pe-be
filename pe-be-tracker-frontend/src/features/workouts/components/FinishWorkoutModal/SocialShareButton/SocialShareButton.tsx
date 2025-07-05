import React from 'react';
import { Button } from '@/components/ui/button';

interface SocialShareButtonProps {
  onShare: () => void;
  disabled?: boolean;
}

const SocialShareButton: React.FC<SocialShareButtonProps> = ({
  onShare,
  disabled = false,
}) => {
  return (
    <Button onClick={onShare} disabled={disabled}>
      Share on Social Media
    </Button>
  );
};

export default SocialShareButton;