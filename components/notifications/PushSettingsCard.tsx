"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BellRing, Share, SquarePlus } from "lucide-react";
import { toast } from "sonner";
import { api, extractData, getErrorMessage } from "@/lib/api";
import { PanelCard } from "@/components/dashboard/PanelCard";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { ApiResponse } from "@/types";
import {
  disablePush,
  enablePush,
  getPushState,
  type PushState,
} from "@/lib/push";

interface PushSubscriptionOut {
  id: string;
  endpoint: string;
  user_agent: string | null;
  created_at: string;
  last_success_at: string | null;
}

/**
 * The only place in the app to turn push on or off — there's no settings or
 * profile page (UserMenu is a dropdown, the wrong affordance for a permission
 * gesture), and this is the one page that's already about notifications.
 * Rendered on both /notifications and the portal.
 */
export function PushSettingsCard() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => void getPushState().then(setState);
  useEffect(refresh, []);

  const { data: devices } = useQuery({
    queryKey: ["push-subscriptions"],
    enabled: state?.permission === "granted",
    // No refetchInterval — this list only changes on an explicit
    // enable/disable/test action here, never in the background.
    queryFn: async () => {
      const res = await api.get<ApiResponse<PushSubscriptionOut[]>>("/push/subscriptions");
      return extractData(res);
    },
  });

  if (!state) return null;

  const handleToggle = async (checked: boolean) => {
    setBusy(true);
    try {
      if (checked) {
        const result = await enablePush();
        if (!result.ok) {
          if (result.reason === "denied") {
            toast.error("Notifications are blocked for this site in your browser.");
          } else if (result.reason === "not-configured") {
            toast.error("Push notifications aren't set up on the server yet.");
          } else {
            toast.error("Couldn't enable notifications. Please try again.");
          }
        } else {
          toast.success("Notifications enabled on this device");
        }
      } else {
        await disablePush();
        toast.success("Notifications turned off for this device");
      }
    } finally {
      setBusy(false);
      refresh();
    }
  };

  const handleTest = async () => {
    setBusy(true);
    try {
      const res = await api.post<ApiResponse<{ sent: number; failed: number; devices: number }>>(
        "/push/test"
      );
      const result = extractData(res);
      if (result.sent > 0) {
        toast.success(`Test notification sent to ${result.sent} device(s)`);
      } else {
        toast.error("Test notification could not be delivered");
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PanelCard icon={BellRing} title="Push Notifications" tone="blue" className="mb-4">
      {!state.supported && (
        <p className="text-sm text-muted-foreground">
          Push notifications aren&apos;t supported in this browser.
        </p>
      )}

      {state.supported && state.ios && !state.standalone && (
        <div className="flex items-start gap-3 text-sm text-muted-foreground">
          <SquarePlus className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
          <p>
            On iPhone and iPad, push only works once RAOMS is added to your Home
            Screen. Tap the Share icon <Share className="inline h-3.5 w-3.5" /> in
            Safari, then &quot;Add to Home Screen,&quot; and open RAOMS from that
            icon.
          </p>
        </div>
      )}

      {state.supported && (!state.ios || state.standalone) && state.permission === "denied" && (
        <p className="text-sm text-muted-foreground">
          Notifications are blocked for this site. Re-enable them in your
          browser&apos;s site settings — this page can&apos;t ask again.
        </p>
      )}

      {state.supported && (!state.ios || state.standalone) && state.permission !== "denied" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">
                Notify this device
              </p>
              <p className="text-xs text-muted-foreground">
                Get an alert for things assigned to you, even when RAOMS isn&apos;t open.
              </p>
            </div>
            <Switch
              checked={state.subscribed}
              disabled={busy}
              onCheckedChange={(checked) => void handleToggle(checked)}
            />
          </div>

          {state.subscribed && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
              <p className="text-xs text-muted-foreground">
                {devices?.length ?? 1} device{(devices?.length ?? 1) === 1 ? "" : "s"} enabled
              </p>
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => void handleTest()}
              >
                Send a test notification
              </Button>
            </div>
          )}
        </div>
      )}
    </PanelCard>
  );
}
