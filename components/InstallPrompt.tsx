"use client";

import { useEffect, useState } from "react";
import { Download, Share, SquarePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isIOS, isStandalone } from "@/lib/push";

// Chrome/Edge/Android only. Not in the TS DOM lib, and absent on iOS Safari —
// which is why iPhone gets written instructions instead of a button.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "raoms:install-dismissed";
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000; // ask again after a week

function snoozed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return at > 0 && Date.now() - at < SNOOZE_MS;
  } catch {
    return false;
  }
}

/**
 * A dismissible "Install RAOMS" card. Mounted in the two signed-in shells next
 * to PushRegistrar. Never shown when the app is already installed, and once
 * dismissed it stays away for a week.
 *
 * It is a banner, not a blocking modal: staff are mid-task on operations, and a
 * modal that must be closed before they can approve a BDN would be worse than
 * no prompt at all.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOS, setShowIOS] = useState(false);

  useEffect(() => {
    if (isStandalone() || snoozed()) return;

    if (isIOS()) {
      // iOS never fires beforeinstallprompt — show the manual steps instead.
      // Deferred a beat so the banner appears after the page settles, and so
      // state isn't set synchronously inside the effect body.
      const t = setTimeout(() => setShowIOS(true), 1500);
      return () => clearTimeout(t);
    }

    const onPrompt = (e: Event) => {
      e.preventDefault(); // keep the event so our button can trigger it
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferred(null);
      setShowIOS(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* private mode — it just comes back next visit */
    }
    setDeferred(null);
    setShowIOS(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    if (outcome === "dismissed") dismiss();
  };

  if (!deferred && !showIOS) return null;

  return (
    <div
      role="dialog"
      aria-label="Install RAOMS"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-2xl border border-slate-200/80 bg-card p-4 shadow-xl dark:border-border md:bottom-6 md:left-auto md:right-6 md:mx-0"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Not now"
        className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground hover:bg-muted"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3 pr-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" className="h-12 w-12 shrink-0 rounded-xl" />
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground">Install RAOMS</p>
          {deferred ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Open it straight from your home screen, and get alerts when
              something needs you.
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Tap <Share className="inline h-3.5 w-3.5" /> Share in Safari, then{" "}
              <SquarePlus className="inline h-3.5 w-3.5" /> Add to Home Screen.
              Open RAOMS from the new icon to turn on alerts.
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={dismiss}>
          Not now
        </Button>
        {deferred && (
          <Button size="sm" onClick={() => void install()}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Install
          </Button>
        )}
      </div>
    </div>
  );
}
