import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(request: NextRequest) {
    const response = NextResponse.next();
    const pathname = request.nextUrl.pathname;

    // The public chat route validates its own POST body and authentication
    // does not apply. Keep the exception exact; all other paths still use the
    // existing session checks below.
    if (
        pathname === "/widget.js" ||
        pathname === "/widget-frame" ||
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
                        response.cookies.set(name, value, options);
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

    if (!user && !isPublicPage) {
        return NextResponse.redirect(
            new URL("/login", request.url)
        );
    }

    if (
        user &&
        (pathname === "/login" || pathname === "/signup")
    ) {
        return NextResponse.redirect(
            new URL("/chat", request.url)
        );
    }

    return response;
}

export const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico).*)",
    ],
};