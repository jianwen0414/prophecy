import * as dotenv from "dotenv";
dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY || "AIzaSyC3gadqRgnJUcNebb_IRNr8dznuCJjrZks";

async function listModels() {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;
    console.log(`Querying: ${url}`);
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`Error ${response.status}: ${await response.text()}`);
            return;
        }
        const data: any = await response.json();
        console.log("AVAILABLE MODELS:");
        if (data.models) {
            data.models.forEach((m: any) => console.log(`- ${m.name} (${m.supportedGenerationMethods})`));
        } else {
            console.log("No models field in response:", data);
        }
    } catch (e) {
        console.error("Error listing models:", e);
    }
}

listModels();
