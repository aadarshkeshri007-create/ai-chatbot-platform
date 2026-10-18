import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

type LoginCredentials = { email: string; password: string };

function invalidCredentialsResponse(request: NextRequest, isForm: boolean) {
    if (isForm) {
        return NextResponse.redirect(new URL("/login", request.url), 303);
    }

    return NextResponse.json(
        { error: "Unable to sign in. Check your email and password and try again." },
        { status: 401, headers: { "Cache-Control": "no-store" } },
    );
}

export async function POST(request: NextRequest) {
    // This endpoint is same-origin only because successful sign-in sets the
    // browser's authenticated cookies.
    if (request.headers.get("origin") !== request.nextUrl.origin) {
        return NextResponse.json({ error: "Unable to sign in." }, {
            status: 403,
            headers: { "Cache-Control": "no-store" },
        });
    }

    const isForm = request.headers.get("content-type")?.includes("form") ?? false;
    let credentials: LoginCredentials;

    try {
        if (isForm) {
            const formData = await request.formData();
            credentials = {
                email: String(formData.get("email") ?? "").trim(),
                password: String(formData.get("password") ?? ""),
            };
        } else {
            const body: unknown = await request.json();
            if (!body || typeof body !== "object") return invalidCredentialsResponse(request, false);
            const values = body as Record<string, unknown>;
            credentials = {
                email: typeof values.email === "string" ? values.email.trim() : "",
                password: typeof values.password === "string" ? values.password : "",
            };
        }
    } catch {
        return invalidCredentialsResponse(request, isForm);
    }

    if (!credentials.email || !credentials.password) {
        return invalidCredentialsResponse(request, isForm);
    }

    const response = isForm
        ? NextResponse.redirect(new URL("/chat", request.url), 303)
        : NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    response.headers.set("Cache-Control", "no-store");

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

    let signInSucceeded = false;
    try {
        const { data, error } = await supabase.auth.signInWithPassword(credentials);
        signInSucceeded = !error && !!data.session;
    } catch {
        // Auth failures stay generic; never log request data or SDK error objects.
    } finally {
        credentials.password = "";
    }

    if (!signInSucceeded) {
        const failure = invalidCredentialsResponse(request, isForm);
        response.cookies.getAll().forEach(({ name, value, ...options }) => {
            failure.cookies.set(name, value, options);
        });
        return failure;
    }

    return response;
}
