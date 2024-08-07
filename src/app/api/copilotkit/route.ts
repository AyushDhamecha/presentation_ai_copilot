import { researchWithLangGraph } from "./research";
import { Action } from "@copilotkit/shared";
import { NextRequest } from "next/server";
import {
  CopilotRuntime,
  copilotRuntimeNextJSAppRouterEndpoint,
  OpenAIAdapter,
} from "@copilotkit/runtime";
import OpenAI from "openai/index.mjs";

const UNSPLASH_ACCESS_KEY_ENV = "UNSPLASH_ACCESS_KEY";
const UNSPLASH_ACCESS_KEY = process.env[UNSPLASH_ACCESS_KEY_ENV];

const researchAction: Action<any> = {
  name: "research",
  description: "Call this function to conduct research on a certain topic. Respect other notes about when to call this function",
  parameters: [
    {
      name: "topic",
      type: "string",
      description: "The topic to research. 5 characters or longer.",
    },
  ],
  handler: async ({ topic }) => {
    console.log("Researching topic: ", topic);
    return await researchWithLangGraph(topic);
  },
};

export const POST = async (req: NextRequest) => {
  const actions: Action<any>[] = [
    {
      name: "getImageUrl",
      description: "Get an image url for a topic",
      parameters: [
        {
          name: "topic",
          description: "The topic of the image",
        },
      ],
      handler: async ({ topic }) => {
        if (UNSPLASH_ACCESS_KEY) {
          const response = await fetch(
            `https://api.unsplash.com/search/photos?query=${encodeURIComponent(
              topic
            )}&per_page=10&order_by=relevant&content_filter=high`,
            {
              headers: {
                Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`,
              },
            }
          );
          const data = await response.json();
          if (data.results && data.results.length > 0) {
            const randomIndex = Math.floor(Math.random() * data.results.length);
            return data.results[randomIndex].urls.regular;
          }
        }
        return (
          'url("https://loremflickr.com/800/600/' +
          encodeURIComponent(topic) +
          '")'
        );
      },
    },
  ];

  if (
    process.env["TAVILY_API_KEY"] &&
    process.env["TAVILY_API_KEY"] !== "NONE"
  ) {
    actions.push(researchAction);
  }

  const AZURE_OPENAI_API_KEY = process.env["AZURE_OPENAI_API_KEY"];
  if (!AZURE_OPENAI_API_KEY) {
    throw new Error("The AZURE_OPENAI_API_KEY environment variable is missing or empty.");
  }

  // The name of your Azure OpenAI Instance and model deployment
  const instance = "viresh";
  const model = "gpt-4o";

  const openai = new OpenAI({
    apiKey: AZURE_OPENAI_API_KEY,
    baseURL: `https://${instance}.openai.azure.com/openai/deployments/${model}`,
    defaultQuery: { "api-version": "2023-03-15-preview" },
    defaultHeaders: { "api-key": AZURE_OPENAI_API_KEY },
  });

  const runtime = new CopilotRuntime({ actions });
  const serviceAdapter = new OpenAIAdapter({ openai });

  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter,
    endpoint: req.nextUrl.pathname,
  });

  return handleRequest(req);
};
