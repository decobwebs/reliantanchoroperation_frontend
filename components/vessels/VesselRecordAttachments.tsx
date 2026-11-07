"use client";

import { useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Paperclip, Upload } from "lucide-react";
import { toast } from "sonner";
import { api, getErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { ApiResponse, VesselRecordAttachment } from "@/types";

/** Files on an incident or maintenance record. Files are only ever added —
 *  the API has no delete. Links are signed on click, not on every list. */
export function VesselRecordAttachments({
  basePath,
  attachments,
  canUpload,
  onUploaded,
}: {
  /** `/vessel-incidents/{id}` or `/vessel-maintenance/{id}` */
  basePath: string;
  attachments: VesselRecordAttachment[];
  canUpload: boolean;
  onUploaded: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      await api.post(`${basePath}/attachments`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
    onSuccess: () => {
      toast.success("File attached");
      onUploaded();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const openFile = async (a: VesselRecordAttachment) => {
    // Open the tab first so the browser does not treat it as a pop-up.
    const tab = window.open("", "_blank");
    try {
      const res = await api.get<ApiResponse<{ url: string }>>(`${basePath}/attachments/${a.id}`);
      if (tab) tab.location.href = res.data.data.url;
    } catch (err) {
      tab?.close();
      toast.error(getErrorMessage(err));
    }
  };

  if (attachments.length === 0 && !canUpload) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {attachments.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={() => openFile(a)}
          className="inline-flex max-w-[220px] items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[11px] text-brand-600 hover:bg-muted"
          title={`Added by ${a.uploaded_by_name ?? "unknown"}`}
        >
          <Paperclip className="h-3 w-3 shrink-0" />
          <span className="truncate">{a.file_name}</span>
        </button>
      ))}
      {canUpload && (
        <>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept="image/jpeg,image/png,image/webp,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload.mutate(file);
              e.target.value = "";
            }}
          />
          <Button
            size="sm"
            variant="ghost"
            className="h-7 rounded-lg px-2 text-[11px]"
            disabled={upload.isPending}
            onClick={() => inputRef.current?.click()}
          >
            {upload.isPending ? <Spinner size={12} /> : <Upload className="h-3 w-3" />}
            Add photo or file
          </Button>
        </>
      )}
    </div>
  );
}
