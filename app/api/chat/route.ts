import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
    const body = await request.json();
    const message = body.message;

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not set");
    }

    try {
        const ai = new GoogleGenAI({
            apiKey,
        });

        const result = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: message,
        });

        return NextResponse.json({
            response: result.text,
        });
    } catch (error) {
        console.error("Error generating content:", error);

        return NextResponse.json(
            {
                response: "Something went wrong while generating the AI response.",
            },
            {
                status: 500,
            }
        );
    }
}