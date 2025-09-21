import { Router } from "express";
import type {Request, Response} from "express";
import { authenticateWithRefresh } from "../middlewares/auth.middleware";
import prisma from "../libs/prisma";
import { cmdLogger } from "../utils/logger";
import { oa } from "../utils/openai";
import system_prompt from '../utils/system_prompt';
import { ChatCompletionMessageParam } from "openai/resources";
import { $Enums } from "../../generated/prisma";
import { InputJsonObject } from "@prisma/client/runtime/library";
import { encoding_for_model, get_encoding } from "tiktoken";

const router: Router = Router();

function scoreQuality(jsonStr: string): number {
  // Cheap heuristic: valid JSON + has subject/body keys gets high score
  try {
    const obj = JSON.parse(jsonStr);
    const hasKeys = typeof obj?.subject === "string" && typeof obj?.body === "string";
    return hasKeys ? 0.95 : 0.7;
  } catch {
    return 0.3;
  }
}

function generatePrompt(message: string, prompt: string) {
    return `
        User email: ${message},
        User suggestion: ${prompt}
    `;
}

function getEncoderFor(model: string) {
  try {
    // Works for OpenAI-listed models
    // (cast is fine; we catch unsupported models below)
    return encoding_for_model(model as any);
  } catch {
    // Fallback for models tiktoken doesn't know (e.g., Groq Llama)
    return get_encoding("cl100k_base");
  }
}

function countTokensForModel(messages: ChatCompletionMessageParam[], model: string) {
    const encoder = getEncoderFor(model);

    // Sum up tokens for all message contents + role overhead
    let tokens = 0;
    for (const msg of messages) {
        // Role & metadata framing cost ~3 tokens per message
        tokens += 3;

        if (typeof msg.content === "string") {
        // If content is a plain string
        tokens += encoder.encode(msg.content).length;
        } else if (Array.isArray(msg.content)) {
        // If content is rich (e.g. { type: "text" })
        for (const block of msg.content) {
            if (block.type === "text" && block.text) {
            tokens += encoder.encode(block.text).length;
            }
        }
        }
    }

    // Every chat completion has a reply priming overhead of ~3 tokens
    tokens += 3;

    encoder.free();
    return tokens;
}

//MODIFY TO ALLOW COMPOSING MESSAGES
router.post("/chat", authenticateWithRefresh(),
    async (req: Request, res: Response) => {
        cmdLogger.info(JSON.stringify(req.body));

        if (!req.body.message_id && !req.body.prompt) {
            return res.status(400).json({error: "Request body missing message_id and prompt - Atleast 1 required"});
        }
        cmdLogger.info("Inside POST /api/ai/chat", {user_info: req.user!.id});

        const message_id = req.body.message_id as string ?? null;
        const body_prompt = req.body.prompt as string ?? ""; //Helps change get to post later

        //Check if message belongs to user
        try {
            const message = message_id ? await prisma.message.findUnique({
                where: {id: message_id},
                include: {connected_account: true}
            }) : null;

            if (!message && message_id) {
                return res.status(400).json({error: "Invalid message id"});
            }

            if (message && message.connected_account.user_id !== req.user!.id) {
                return res.status(401).json({error: "Unauthorized"});
            }

            if (message) cmdLogger.info("Message retreived", {user_info: req.user!.id});

            try {
                const user_prompt = generatePrompt((message ? (message.body_text ? message.body_text : message.body_html!) : ""), body_prompt);

                cmdLogger.info("Sending prompt to groq", {user_info: req.user!.id});

                const prompt_messages: ChatCompletionMessageParam[] = [
                        {role: "system", content: system_prompt},
                        {role: "user", content: user_prompt},
                ];

                if (!process.env.GROQ_MODEL) {
                    cmdLogger.error("Set environment variable GROQ_MODEL", {user_info: req.user!.id});
                    return res.status(500).json({error: "Internal server error"});
                }

                const groq_model = process.env.GROQ_MODEL;

                const input_tokens = countTokensForModel(prompt_messages, groq_model);

                //Depends on api inference subscription (free tier has max 6000 input tokens)
                if (input_tokens > 5800) {
                    cmdLogger.error("Input tokens over 6000", {user_info: req.user!.id});
                    return res.status(401).json({error: "Input tokens should be under 6000"});
                }

                const started = Date.now();

                const resp = await oa.chat.completions.create({
                    model: groq_model,
                    messages: prompt_messages,
                    temperature: 0.8,
                    max_completion_tokens: 600,
                    response_format: {type: "json_object"}
                });

                const latency_ms = Date.now() - started;

                cmdLogger.info("Response received", {user_info: req.user!.id});
                
                try {
                    const newPrompt = await prisma.prompt.create({
                        data: {
                            user_id: req.user!.id,
                            target_type: $Enums.TargetType.MESSAGE,
                            ...( message ? {target_message_id: message.id} : {}),
                            prompt_text: user_prompt,
                            context_json: system_prompt
                        }
                    });

                    // 5) Extract content & make sure it’s JSON
                    const rawContent = resp.choices?.[0]?.message?.content ?? "";
                    let parsed: any = null;
                    try {
                        parsed = JSON.parse(rawContent);
                    } catch (e) {
                        // store raw and mark low quality; still return to client for visibility
                        cmdLogger.warn("LLM returned non-JSON content; storing raw", {
                        user_info: req.user!.id,
                        preview: rawContent.slice(0, 120),
                    });
                    }

                    // Make a plain JSON usage object
                    const usagePlain =
                        (resp).usage
                        ? {
                            prompt_tokens: resp.usage.prompt_tokens as number,
                            completion_tokens: resp.usage.completion_tokens as number,
                            total_tokens: resp.usage.total_tokens as number,
                        }
                        : null;

                    const quality = scoreQuality(rawContent);

                    const meta: InputJsonObject = {
                        provider: "groq",
                        model: resp.model,
                        response: {
                            id: resp.id,
                            finish_reason: resp.choices[0]?.finish_reason ?? null,
                            latency_ms: latency_ms,
                            ...(usagePlain ? {usage: usagePlain} : {}),
                        },
                        raw_json: rawContent,
                    };

                    try {
                    const newResponse = await prisma.aIResponse.create({
                        data: {
                            prompt_id: newPrompt.id,
                            meta: meta,
                            quality_score: quality
                        }
                    });

                    const reply = resp.choices[0]?.message.content;

                    res.json({response: reply});
                    } catch (err) {
                        cmdLogger.error(`Error while inserting ai response to db (ERR: ${JSON.stringify(err)})`, {user_info: req.user!.id});
                        return res.status(500).json({ message: "Internal server error" });
                    }
                } catch (err) {
                    cmdLogger.error(`Error while inserting prompt to db (ERR: ${JSON.stringify(err)})`, {user_info: req.user!.id});
                    return res.status(500).json({ message: "Internal server error" });
                }
            } catch(err: any) {
                cmdLogger.error(`Error while retreiving prompt response (ERR: ${JSON.stringify(err)})`, {user_info: req.user!.id});
                if (err?.failed_generation) {
                    cmdLogger.error(`Failed Generation: ${err.failed_generation}`, {user_info: req.user!.id});
                }
                return res.status(500).json({ message: "Internal server error" });
            }

        } catch(err) {
            cmdLogger.error(`Error while retreiving message (ERR: ${JSON.stringify(err)})`, {user_info: req.user!.id});
            return res.status(500).json({ message: "Internal server error" });
        }
});

export default router;