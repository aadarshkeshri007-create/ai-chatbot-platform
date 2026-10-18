import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    const code = request.nextUrl.searchParams.get("code");
    if (!code) {
        return NextResponse.redirect(new URL("/reset-password?error=link", request.url));
    }

    const response = NextResponse.redirect(new URL("/reset-password", request.url));
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        {
            cookieOptions: {
                sameSite: "lax",
                path: "/",
                secure: process.env.NODE_ENV === "production",
            },
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
        },
    );

    let exchanged = false;
    try {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        exchanged = !error;
    } catch {
        // Do not log callback codes or auth error objects.
    }
    if (!exchanged) {
        return NextResponse.redirect(new URL("/reset-password?error=link", request.url));
    }
    return response;
}
