import { Button } from "@/shared/components/ui/button";

interface DownloadImageButtonProps {
  onDownload: () => Promise<void>;
  disabled?: boolean;
}

const DownloadImageButton = ({ onDownload, disabled = false }: DownloadImageButtonProps) => {
  const handleClick = async () => {
    try {
      await onDownload();
    } catch (error) {
      console.error("Error downloading image:", error);
    }
  };

  return (
    <Button onClick={handleClick} disabled={disabled}>
      Download Image
    </Button>
  );
};

export default DownloadImageButton;
