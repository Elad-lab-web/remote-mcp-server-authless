import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";

type Env = {
  GEMINI_API_KEY: string;
};

function createServer(env: Env) {
  const server = new McpServer({
    name: "Nano Banana Image Generator",
    version: "1.0.0",
  });

  server.registerTool(
    "generate_image",
    {
      description:
        "Generate an image with Google's Nano Banana 2 (Gemini 3.1 Flash Image). Use this whenever the user asks to create, generate, design, draw, render, or visualize an image.",
      inputSchema: z.object({
        prompt: z.string().describe("Detailed description of the image to generate"),
        aspect_ratio: z
          .enum(["1:1", "16:9", "9:16", "4:3", "3:4"])
          .optional()
          .describe("Aspect ratio of the generated image"),
      }),
    },
    async ({ prompt, aspect_ratio }) => {
    console.log("Starting Gemini request");
console.log("API key present:", Boolean(env.GEMINI_API_KEY));

const response = await fetch(
  "https://generativelanguage.googleapis.com/v1beta/interactions",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": env.GEMINI_API_KEY,
    },
    body: JSON.stringify({
      model: "gemini-3.1-flash-image",
      input: [{ type: "text", text: prompt }],
      response_format: {
        type: "image",
        aspect_ratio: aspect_ratio || "1:1",
      },
    }),
  }
);

console.log("Gemini response status:", response.status);

if (!response.ok) {
  const error = await response.text();
  console.error("Gemini response body:", error);
  throw new Error(`Gemini API error ${response.status}: ${error}`);
}

      const result: any = await response.json();

      for (const step of result.steps || []) {
        if (step.type === "model_output") {
          for (const item of step.content || []) {
            if (item.type === "image" && item.data) {
              return {
                content: [
                  {
                    type: "image" as const,
                    data: item.data,
                    mimeType: item.mime_type || "image/png",
                  },
                ],
              };
            }
          }
        }
      }

      throw new Error("Gemini completed the request but returned no image.");
    }
  );

  
server.registerTool(
  "edit_image",
  {
    description:
      "Edit or transform an existing image using Google's Nano Banana 2. Use this whenever the user provides or references an image and asks to modify, transform, restyle, reposition, or place the subject in a new scene while preserving relevant visual characteristics.",
    inputSchema: z.object({
      prompt: z
        .string()
        .describe("Detailed instructions describing how the source image should be edited"),
      image_url: z
        .string()
        .url()
        .describe("A directly accessible HTTPS URL of the source image"),
      aspect_ratio: z
        .enum(["1:1", "16:9", "9:16", "4:3", "3:4"])
        .optional()
        .describe("Optional aspect ratio for the edited output"),
    }),
  },
  async ({ prompt, image_url, aspect_ratio }) => {
    console.log("Downloading reference image");

    const imageResponse = await fetch(image_url);

    if (!imageResponse.ok) {
      throw new Error(
        `Could not download source image: HTTP ${imageResponse.status}`
      );
    }

    const mimeType =
      imageResponse.headers.get("content-type") || "image/jpeg";

    if (!mimeType.startsWith("image/")) {
      throw new Error(
        `The supplied URL did not return an image. Content-Type: ${mimeType}`
      );
    }

    const buffer = await imageResponse.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    let binary = "";
    const chunkSize = 0x8000;

    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(
        ...bytes.subarray(i, Math.min(i + chunkSize, bytes.length))
      );
    }

    const imageBase64 = btoa(binary);

    console.log("Starting Gemini image edit");

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          model: "gemini-3.1-flash-image",
          input: [
            {
              type: "image",
              mime_type: mimeType,
              data: imageBase64,
            },
            {
              type: "text",
              text: prompt,
            },
          ],
          ...(aspect_ratio
            ? {
                response_format: {
                  type: "image",
                  aspect_ratio,
                },
              }
            : {}),
        }),
      }
    );

    console.log("Gemini edit response status:", response.status);

    if (!response.ok) {
      const error = await response.text();
      console.error(`Gemini edit error ${response.status}: ${error}`);
      throw new Error(`Gemini edit error ${response.status}: ${error}`);
    }

    const result: any = await response.json();

    for (const step of result.steps || []) {
      if (step.type === "model_output") {
        for (const item of step.content || []) {
          if (item.type === "image" && item.data) {
            return {
              content: [
                {
                  type: "image" as const,
                  data: item.data,
                  mimeType: item.mime_type || "image/png",
                },
              ],
            };
          }
        }
      }
    }

    throw new Error(
      "Gemini completed the image edit but returned no image."
    );
  }
);
  return server;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const handler = createMcpHandler(() => createServer(env));
    return handler(request, env, ctx);
  },
};
