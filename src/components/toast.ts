import { toast } from "sonner";

/**
 * Confirms a successful action. Only for success – errors stay visible inline (ProblemAlert),
 * per docs/design-system.md.
 */
export function showSuccessToast(message: string) {
  toast.success(message);
}
