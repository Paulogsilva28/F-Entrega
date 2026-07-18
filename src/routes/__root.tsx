import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "F-Entrega — Controle Financeiro" },
      { name: "description", content: "Acompanhe seus saques 99Food, Uber e gastos da moto em um só lugar." },
      { property: "og:title", content: "F-Entrega — Controle Financeiro" },
      { property: "og:description", content: "Acompanhe seus saques 99Food, Uber e gastos da moto em um só lugar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "F-Entrega — Controle Financeiro" },
      { name: "twitter:description", content: "Acompanhe seus saques 99Food, Uber e gastos da moto em um só lugar." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/9cfd9753-51d3-4d6d-b8a6-f96aa9fd6427/id-preview-d7b340fe--368dc34b-055f-48ed-8714-6fad6dadd762.lovable.app-1777671916039.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/9cfd9753-51d3-4d6d-b8a6-f96aa9fd6427/id-preview-d7b340fe--368dc34b-055f-48ed-8714-6fad6dadd762.lovable.app-1777671916039.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "icon",
        type: "image/svg+xml",
        href: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='25' fill='%23ffd000'/><path d='M54 12 L16 58 h29 v29 l37 -46 h-29 Z' fill='%23000000'/></svg>",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="bg-background text-foreground">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as any;
    if (w.__serverFnFetchPatched) return;
    w.__serverFnFetchPatched = true;
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input: any, init: any = {}) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input?.url ?? "";
      if (url.includes("/_serverFn/")) {
        try {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          if (token) {
            const headers = new Headers(init.headers || (input?.headers ?? {}));
            if (!headers.has("authorization")) {
              headers.set("Authorization", `Bearer ${token}`);
            }
            init = { ...init, headers };
          }
        } catch {}
      }
      return originalFetch(input, init);
    };
  }, []);
  return <Outlet />;
}
