import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { genAI } from "@/lib/gemini";

export async function POST(req: Request) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: "Missing URL" }, { status: 400 });
    }

    const response = await fetch(url);
    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch URL" }, { status: response.status });
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    $('script, style, nav, footer, header').remove();
    const articleText = $('p, h1, h2, h3, h4, li').map((_, el) => $(el).text()).get().join('\n');

    if (!articleText.trim()) {
      return NextResponse.json({ error: "No text found on page" }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "Gemini API Key is not configured." }, { status: 500 });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
      Role: You are a Senior Content Strategist. Your goal is to deconstruct a professional HR blog post into a high-impact, sequential educational framework suitable for a LinkedIn carousel.

      Task: Analyze the provided text and extract the core "Action Plan."

      Structural Requirements for the Carousel Slides:
      - The Hook (Slide 1): Create a compelling title that identifies a common small business pain point addressed in the text (e.g., "Why [Topic] is Essential" or "How to Stop [Problem]"). Title should go in the 'title' field, body in the 'body' field.
      - The Stakes (Slide 2): Briefly summarize the risks of ignoring this topic (e.g., wasted time, legal risks, or low morale).
      - The Framework (Slides 3+): Break the content down into a numbered sequence of 5–8 actionable steps. Each step must have a clear, punchy title. Each step must include 1–2 tactical "How-To" details or reflective questions found in the text (e.g., "Ask yourself: X?" or "Ensure you do Y").
      - The Conclusion (Final Slide): Provide a final summary statement on how this sequence leads to long-term success.

      Tone & Style:
      - Use professional yet accessible language.
      - Prioritize "scannability"—keep sentences short and direct.
      - Focus on "Reactive vs. Proactive" transitions.

      Output Format:
      Return ONLY a pure JSON array of objects, where each object represents a slide and has a 'title' string and a 'body' string (e.g., [{"title": "...", "body": "..."}, ...]).
      Do NOT wrap in markdown code blocks. DO NOT include explanations.

      Input Material:
      ---
      ${articleText.substring(0, 30000)}
      ---
    `;

    const result = await model.generateContent(prompt);
    let outputText = result.response.text();
    outputText = outputText.replace(/^```json\n?/i, '').replace(/```$/i, '').trim();

    try {
      const slides = JSON.parse(outputText);
      if (Array.isArray(slides)) {
        return NextResponse.json({ slides });
      } else {
         return NextResponse.json({ error: "Invalid response format from Gemini" }, { status: 500 });
      }
    } catch {
      console.error("Failed to parse Gemini output:", outputText);
      return NextResponse.json({ error: "Failed to parse Gemini output" }, { status: 500 });
    }
  } catch {
    console.error("API Error");
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
