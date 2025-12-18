
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

async function listModels() {
    if (!GEMINI_API_KEY) {
        console.error("No API Key found!");
        return;
    }

    try {
        // There isn't a direct listModels in the high-level SDK easily accessible for some versions,
        // but let's try a standard model to verify connection first, 
        // or use the model manager if available in this SDK version.
        // Actually, simply try 'gemini-pro' (1.0) generation as a connectivity test.

        console.log("Attempting to connect with 'gemini-pro'...");
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const result = await model.generateContent("Hello?");
        console.log("Success! 'gemini-pro' is available.");
        console.log("Response:", result.response.text());

    } catch (error) {
        console.error("Detailed Error:", error);
    }
}

listModels();
