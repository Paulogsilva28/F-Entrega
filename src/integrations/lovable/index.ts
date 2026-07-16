// This file is modified to support standard Supabase OAuth redirects.
import { supabase } from "../supabase/client";

type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

export const lovable = {
  auth: {
    signInWithOAuth: async (provider: "google" | "apple" | "microsoft" | "lovable", opts?: SignInOptions) => {
      // Map 'lovable' to 'google' or default provider as fallback
      const actualProvider = provider === "lovable" ? "google" : provider;

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: actualProvider,
        options: {
          redirectTo: opts?.redirect_uri || (typeof window !== "undefined" ? window.location.origin + "/auth" : undefined),
          queryParams: opts?.extraParams,
        },
      });

      if (error) {
        return { error };
      }

      // Se o Supabase retornou uma URL de redirecionamento, navega até ela
      if (data?.url) {
        if (typeof window !== "undefined") {
          window.location.href = data.url;
        }
        return { redirected: true };
      }

      return { redirected: false };
    },
  },
};
