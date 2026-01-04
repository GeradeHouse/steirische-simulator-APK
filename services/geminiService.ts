import { GoogleGenAI } from "@google/genai";
import { ChordAnalysis } from "../types";

// Safe initialization
const apiKey = process.env.API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export const analyzeChord = async (notes: string[], direction: string): Promise<ChordAnalysis> => {
  if (!ai) {
    return {
      chordName: "No API Key",
      description: "AI functionality disabled.",
      notes: notes
    };
  }

  try {
    const prompt = `
      I am playing a Steirische Harmonika (Styrian Accordion).
      Bellows direction: ${direction}.
      The currently pressed notes are: ${notes.join(', ')}.
      
      Please analyze this combination. 
      1. What chord is this? (e.g., "Eb Major", "Bb Dominant 7th").
      2. Provide a very short description (1 sentence) in Dutch.
      
      Return JSON format:
      {
        "chordName": "Name",
        "description": "Dutch description",
        "notes": ["List", "Of", "Notes"]
      }
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");
    return JSON.parse(text) as ChordAnalysis;

  } catch (error) {
    console.error("Gemini Error:", error);
    return {
      chordName: "Onbekend",
      description: "Kon de harmonie niet analyseren.",
      notes: notes
    };
  }
};
