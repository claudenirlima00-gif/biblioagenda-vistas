
import { GoogleGenAI } from "@google/genai";

// Fix: Use process.env.API_KEY directly in the constructor as per the coding guidelines.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateObjectiveSuggestion = async (turma: string, institution: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Sugira um objetivo sucinto e pedagógico para uma visita guiada de uma turma de ${turma} da instituição ${institution} a uma biblioteca municipal. Foque em incentivo à leitura e conhecimento do espaço público.`,
      config: {
        temperature: 0.7,
      }
    });
    // Fix: Access the .text property directly instead of as a function.
    return response.text || "Incentivar o hábito da leitura e apresentar o acervo da biblioteca.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Incentivar o hábito da leitura e apresentar o acervo da biblioteca.";
  }
};