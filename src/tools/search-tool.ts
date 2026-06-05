import { ToolDefinition } from "../base-agent";
import { WEB_SEARCH_NAME } from "../Constants";

export const searchTool: ToolDefinition = {
    name: WEB_SEARCH_NAME,
    description: "Search the web for recent information relevant to a query. Use this tool when you need up-to-date information or to find specific facts.",
    parameters: {
        type: "object",
        properties: {
            query: {
                type: "string",
                description: "The search query, phrased as a question or keywords.",
            }
        },
        required: ["query"],
    },
    run: async (args) => {
        const query = args.query as string;
        return await searchWeb(query);
    }
};

async function searchWeb(query: string): Promise<string> {
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=3`;

  const response = await fetch(url, {
    headers: {
      "Accept": "application/json",
      "X-Subscription-Token": process.env.BRAVE_API_KEY ?? "",
    },
  });

  const data = await response.json() as any;
  const results = data.web?.results ?? [];

  return results
    .map((r: any) => `${r.title}\n${r.url}\n${r.description}`)
    .join("\n\n");
}