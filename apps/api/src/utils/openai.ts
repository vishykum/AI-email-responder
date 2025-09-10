import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) {
    throw Error("Please set OPENAI_API_KEY environment variable");
}

export const oa = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
});