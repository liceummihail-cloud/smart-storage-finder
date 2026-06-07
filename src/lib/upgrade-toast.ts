import { toast } from "sonner";

/**
 * Shows a toast for any caught error from server functions. If the error
 * message looks like a plan/limit error, includes an "Upgrade" action.
 */
export function showServerError(err: unknown, navigateToUpgrade: () => void) {
  const msg = err instanceof Error ? err.message : String(err);
  const isLimit =
    /ліміт|limit|вичерпано|exhausted|PLAN_/i.test(msg) || /402/.test(msg);
  if (isLimit) {
    toast.error(msg, {
      action: {
        label: "Оновити план",
        onClick: navigateToUpgrade,
      },
      duration: 8000,
    });
  } else {
    toast.error(msg);
  }
}
