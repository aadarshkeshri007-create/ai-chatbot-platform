"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useState,
} from "react";

export type Theme = "system" | "light" | "dark";

type ThemeContextValue = {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    resolvedTheme: "light" | "dark";
    toggleTheme: () => void;
};

const STORAGE_KEY = "supportai-theme";

const ThemeContext = createContext<ThemeContextValue>({
    theme: "system",
    setTheme: () => {},
    resolvedTheme: "light",
    toggleTheme: () => {},
});

function getSystemTheme(): "light" | "dark" {
    if (typeof window === "undefined") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
}

function resolveTheme(theme: Theme): "light" | "dark" {
    if (theme === "system") return getSystemTheme();
    return theme;
}

function applyTheme(resolved: "light" | "dark") {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (resolved === "dark") {
        root.classList.add("dark");
    } else {
        root.classList.remove("dark");
    }
}

export function ThemeProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const [theme, setThemeState] = useState<Theme>("system");
    const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

    /* Initialize from localStorage */
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
            if (stored && ["light", "dark", "system"].includes(stored)) {
                setThemeState(stored);
                const resolved = resolveTheme(stored);
                setResolvedTheme(resolved);
                applyTheme(resolved);
            } else {
                const resolved = resolveTheme("system");
                setResolvedTheme(resolved);
                applyTheme(resolved);
            }
        } catch {
            const resolved = resolveTheme("system");
            setResolvedTheme(resolved);
            applyTheme(resolved);
        }
    }, []);

    /* Listen for OS system theme changes when theme === "system" */
    useEffect(() => {
        if (typeof window === "undefined") return;
        const mql = window.matchMedia("(prefers-color-scheme: dark)");
        const handler = () => {
            if (theme === "system") {
                const resolved = getSystemTheme();
                setResolvedTheme(resolved);
                applyTheme(resolved);
            }
        };
        mql.addEventListener("change", handler);
        return () => mql.removeEventListener("change", handler);
    }, [theme]);

    const setTheme = useCallback((newTheme: Theme) => {
        setThemeState(newTheme);
        const resolved = resolveTheme(newTheme);
        setResolvedTheme(resolved);
        applyTheme(resolved);
        try {
            localStorage.setItem(STORAGE_KEY, newTheme);
        } catch {
            // localStorage unavailable
        }
    }, []);

    const toggleTheme = useCallback(() => {
        // Toggle between light and dark (or system -> opposite of resolved)
        setTheme(resolvedTheme === "dark" ? "light" : "dark");
    }, [resolvedTheme, setTheme]);

    return (
        <ThemeContext.Provider
            value={{ theme, setTheme, resolvedTheme, toggleTheme }}
        >
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    return useContext(ThemeContext);
}
