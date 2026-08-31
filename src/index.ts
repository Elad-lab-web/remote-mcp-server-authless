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

      if (!response.ok) {
        const error = await response.text();
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

  return server;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const server = createServer(env);
    return createMcpHandler(server)(request, env, ctx);
  },
};
