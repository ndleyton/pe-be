import { type ChangeEvent, type FormEvent, type RefObject } from "react";
import { ImagePlus, MessageCircle, X } from "lucide-react";

import { CHAT_ATTACHMENT_ACCEPT } from "../lib/chatAttachments";
import { type PendingAttachment } from "../types";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";

interface ChatComposerProps {
  attachmentError: string | null;
  canAddAttachments: boolean;
  canSubmit: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  inputValue: string;
  isLoading: boolean;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onInputChange: (value: string) => void;
  onRemoveAttachment: (localId: string) => void;
  onSubmit: () => void;
  pendingAttachments: PendingAttachment[];
}

export const ChatComposer = ({
  attachmentError,
  canAddAttachments,
  canSubmit,
  fileInputRef,
  inputValue,
  isLoading,
  onFileChange,
  onInputChange,
  onRemoveAttachment,
  onSubmit,
  pendingAttachments,
}: ChatComposerProps) => {
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <div className="border-border/20 bg-card shrink-0 border-t p-3 shadow-sm">
      <div className="mx-auto max-w-4xl">
        {pendingAttachments.length > 0 && (
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
            {pendingAttachments.map((attachment) => (
              <div
                key={attachment.localId}
                className="bg-muted relative h-20 w-20 flex-none overflow-hidden rounded-2xl border"
              >
                <img
                  src={attachment.previewUrl}
                  alt={attachment.file.name}
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => onRemoveAttachment(attachment.localId)}
                  className="bg-background/80 absolute right-1 top-1 rounded-full p-1"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        {attachmentError && (
          <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {attachmentError}
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept={CHAT_ATTACHMENT_ACCEPT}
            multiple
            className="hidden"
            onChange={onFileChange}
          />
          <Button
            type="button"
            variant="outline"
            className="h-11 w-11 shrink-0 rounded-xl p-0"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading || !canAddAttachments}
          >
            <ImagePlus className="h-5 w-5" />
          </Button>
          <Input
            value={inputValue}
            onChange={(event) => onInputChange(event.target.value)}
            placeholder="Message..."
            className="border-border/30 bg-muted/30 focus:bg-background h-11 flex-1 rounded-xl transition-colors"
            disabled={isLoading}
          />
          <Button
            type="submit"
            disabled={!canSubmit}
            className="h-11 w-11 shrink-0 rounded-xl p-0"
          >
            <MessageCircle className="h-5 w-5" />
          </Button>
        </form>
      </div>
    </div>
  );
};
