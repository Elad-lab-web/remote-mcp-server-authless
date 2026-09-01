import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";

type ImageMetadata = {
  mimeType: string;
};

type Env = {
  GEMINI_API_KEY: string;
  IMAGE_STORE: KVNamespace;
};

function createServer(env: Env) {
  const server = new McpServer({
    name: "Nano Banana Image Generator",
    version: "2.0.0",
  });

  server.registerTool(
    "generate_image",
    {
      description:
        "Generate an image with Google's Nano Banana 2. Use this whenever the user asks to create, generate, design, draw, render, or visualize an image.",
      inputSchema: z.object({
        prompt: z
          .string()
          .describe("Detailed description of the image to generate"),
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
        console.error(`Gemini generation error ${response.status}: ${error}`);
        throw new Error(
          `Gemini generation error ${response.status}: ${error}`
        );
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
        "Gemini completed the request but returned no image."
      );
    }
  );

  server.registerTool(
    "edit_image",
    {
      description:
        "Edit or transform an existing image using Google's Nano Banana 2. Use this whenever the user provides an image URL and asks to modify, transform, restyle, reposition, change the setting, change clothing, add objects, change pose, or place the subject in a new scene while preserving relevant visual characteristics.",
      inputSchema: z.object({
        prompt: z
          .string()
          .describe(
            "Detailed instructions describing how the source image should be edited"
          ),
        image_url: z
          .string()
          .url()
          .describe(
            "A directly accessible HTTPS URL of the source image"
          ),
        aspect_ratio: z
          .enum(["1:1", "16:9", "9:16", "4:3", "3:4"])
          .optional()
          .describe("Optional aspect ratio for the edited output"),
      }),
    },
    async ({ prompt, image_url, aspect_ratio }) => {
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

      if (!response.ok) {
        const error = await response.text();
        console.error(`Gemini edit error ${response.status}: ${error}`);
        throw new Error(
          `Gemini edit error ${response.status}: ${error}`
        );
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

function uploadPage(): Response {
  const html = `
<!doctype html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Nano Banana Upload</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 620px;
      margin: 80px auto;
      padding: 24px;
      background: #fafafa;
    }
    .card {
      background: white;
      border: 1px solid #ddd;
      border-radius: 16px;
      padding: 32px;
    }
    h1 {
      margin-top: 0;
    }
    input {
      display: block;
      margin: 24px 0;
      width: 100%;
    }
    button {
      border: 0;
      border-radius: 10px;
      padding: 14px 24px;
      font-size: 16px;
      cursor: pointer;
    }
    .note {
      color: #666;
      font-size: 14px;
      margin-top: 18px;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>Nano Banana</h1>
    <p>העלה תמונה וקבל קישור זמני שאפשר להדביק ב-Claude.</p>

    <form method="POST" enctype="multipart/form-data">
      <input
        type="file"
        name="image"
        accept="image/png,image/jpeg,image/webp"
        required
      >
      <button type="submit">העלה תמונה</button>
    </form>

    <p class="note">
      התמונות נשמרות באופן זמני ונמחקות אוטומטית לאחר 24 שעות.
    </p>
  </div>
</body>
</html>
`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}

async function uploadImage(
  request: Request,
  env: Env
): Promise<Response> {
  const formData = await request.formData();
  const image = formData.get("image");

  if (!(image instanceof File)) {
    return new Response("No image uploaded", {
      status: 400,
    });
  }

  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
  ];

  if (!allowedTypes.includes(image.type)) {
    return new Response(
      "Only JPEG, PNG and WebP images are supported.",
      { status: 400 }
    );
  }

  const maxSize = 10 * 1024 * 1024;

  if (image.size > maxSize) {
    return new Response(
      "Image is too large. Maximum size is 10 MB.",
      { status: 400 }
    );
  }

  const id = crypto.randomUUID();
  const key = `image:${id}`;
  const buffer = await image.arrayBuffer();

  await env.IMAGE_STORE.put(key, buffer, {
    expirationTtl: 86400,
    metadata: {
      mimeType: image.type,
    },
  });

  const origin = new URL(request.url).origin;
  const imageUrl = `${origin}/image/${id}`;

  const html = `
<!doctype html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Image uploaded</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 700px;
      margin: 80px auto;
      padding: 24px;
      background: #fafafa;
    }
    .card {
      background: white;
      border: 1px solid #ddd;
      border-radius: 16px;
      padding: 32px;
    }
    img {
      max-width: 100%;
      max-height: 360px;
      border-radius: 12px;
      display: block;
      margin: 20px 0;
    }
    .url {
      direction: ltr;
      text-align: left;
      background: #f3f3f3;
      padding: 14px;
      border-radius: 8px;
      overflow-wrap: anywhere;
      user-select: all;
    }
    a {
      display: inline-block;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>התמונה הועלתה בהצלחה</h1>

    <img src="${imageUrl}" alt="Uploaded image">

    <p>העתק את הקישור הבא והדבק אותו ב-Claude:</p>

    <div class="url">${imageUrl}</div>

    <p>
      לדוגמה:
      "השתמש ב-Nano Banana כדי לקחת את האדם שבתמונה בקישור הזה
      ולשים אותו יושב באולם קולנוע."
    </p>

    <a href="/upload">העלה תמונה נוספת</a>
  </div>
</body>
</html>
`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}

async function serveImage(
  id: string,
  env: Env
): Promise<Response> {
  const key = `image:${id}`;

  const result =
    await env.IMAGE_STORE.getWithMetadata<ImageMetadata>(
      key,
      "arrayBuffer"
    );

  if (!result.value) {
    return new Response("Image not found or expired", {
      status: 404,
    });
  }

  return new Response(result.value, {
    headers: {
      "Content-Type":
        result.metadata?.mimeType || "image/jpeg",
      "Cache-Control": "private, max-age=3600",
    },
  });
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ) {
    const url = new URL(request.url);

    if (url.pathname === "/upload") {
      if (request.method === "GET") {
        return uploadPage();
      }

      if (request.method === "POST") {
        return uploadImage(request, env);
      }

      return new Response("Method not allowed", {
        status: 405,
      });
    }

    if (
      url.pathname.startsWith("/image/") &&
      request.method === "GET"
    ) {
      const id = url.pathname.slice("/image/".length);

      if (!id) {
        return new Response("Invalid image ID", {
          status: 400,
        });
      }

      return serveImage(id, env);
    }

    if (url.pathname === "/mcp") {
      const handler = createMcpHandler(
        () => createServer(env)
      );

      return handler(request, env, ctx);
    }

    return new Response("Not Found", {
      status: 404,
    });
  },
};
