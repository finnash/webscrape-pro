import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Calls the consume_credits RPC. Returns true if the user is allowed to proceed.
 * Surfaces blocked / out-of-credit toasts automatically.
 */
export const gateAndConsume = async (amount = 1): Promise<boolean> => {
  const { data, error } = await supabase.rpc("consume_credits", { _amount: amount });
  if (error) {
    toast.error(error.message);
    return false;
  }
  const res = data as any;
  if (!res?.ok) {
    if (res?.reason === "blocked") {
      toast.error("Your account is suspended. Contact support.");
    } else if (res?.reason === "insufficient_credits") {
      toast.error(`Out of credits — ${res.remaining ?? 0} left today. Upgrade your plan.`);
    } else if (res?.reason === "unauthenticated") {
      toast.error("Please sign in again.");
    } else {
      toast.error("Could not start request");
    }
    return false;
  }
  return true;
};