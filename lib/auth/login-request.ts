export function createLoginRequest(email: string, password: string) {
    return {
        url: "/api/auth/login",
        init: {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        } satisfies RequestInit,
    };
}
