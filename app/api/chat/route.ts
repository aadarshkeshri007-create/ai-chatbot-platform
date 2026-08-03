import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { message } = await request.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required." },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set");
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { timeout: 30_000 },
    });

    const result = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: message,
    });

    return NextResponse.json({
      response: result.text,
    });
  } catch (error) {
    console.error("Error generating content:", error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      {
        status: 500,
      }
    );
  }
}
