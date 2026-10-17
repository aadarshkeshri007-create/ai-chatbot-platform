import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(request: NextRequest) {
    const response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    });
    const pathname = request.nextUrl.pathname;

    // The public chat route validates its own POST body and authentication
    // does not apply. Keep the exception exact; all other paths still use the
    // existing session checks below.
    if (
        pathname === "/widget.js" ||
        pathname === "/widget-frame" ||
        pathname === "/api/public/handoff" ||
        (pathname === "/api/public/chat" &&
            (request.method === "POST" || request.method === "OPTIONS"))
    ) {
        return response;
    }

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        request.cookies.set(name, value);
                        response.cookies.set(name, value, {
                            ...options,
                            secure: process.env.NODE_ENV === "production",
                        });
                    });
                },
            },
        }
    );

    const {
        data: { user },
    } = await supabase.auth.getUser();

    const isPublicPage =
        pathname === "/" ||
        pathname === "/login" ||
        pathname === "/signup";

    const hasAuthCookie = request.cookies.getAll().some((c) => c.name.startsWith("sb-"));
    if (process.env.NODE_ENV !== "production" && !isPublicPage) {
        console.log(`[Proxy] ${request.method} ${pathname} | Auth cookie: ${hasAuthCookie} | User: ${!!user}`);
    }

    if (!user && !isPublicPage) {
        const redirectUrl = new URL("/login", request.url);
        const redirectResponse = NextResponse.redirect(redirectUrl);
        response.cookies.getAll().forEach((cookie) => {
            redirectResponse.cookies.set(cookie.name, cookie.value);
        });
        return redirectResponse;
    }

    if (
        user &&
        (pathname === "/login" || pathname === "/signup")
    ) {
        const redirectUrl = new URL("/chat", request.url);
        const redirectResponse = NextResponse.redirect(redirectUrl);
        response.cookies.getAll().forEach((cookie) => {
            redirectResponse.cookies.set(cookie.name, cookie.value);
        });
        return redirectResponse;
    }

    return response;
}

export const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico).*)",
    ],
};