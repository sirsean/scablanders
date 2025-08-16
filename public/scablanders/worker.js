import { DurableObject } from "cloudflare:workers";
class MyDurableObject extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
  }
  // Placeholder method - will be replaced with proper game logic
  async sayHello(name) {
    return `Hello from the Scablands, ${name}! The harsh desert awaits your expeditions.`;
  }
  // Placeholder for future world state methods
  async getWorldState() {
    return {
      resources: [],
      activeMissions: [],
      townMetrics: {
        prosperity: 50,
        security: 50,
        population: 100,
        upgradeLevel: 1
      },
      lastUpdate: /* @__PURE__ */ new Date()
    };
  }
}
async function handleApiRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
  if (method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    if (path.startsWith("/api/")) {
      const response = await routeApiCall(path, method, request, env);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return response;
    }
    return new Response("Not found", { status: 404, headers: corsHeaders });
  } catch (error) {
    console.error("API Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
}
async function routeApiCall(path, method, request, env) {
  const segments = path.split("/").filter((s) => s.length > 0);
  const [, ...apiPath] = segments;
  switch (apiPath[0]) {
    case "health":
      return handleHealthCheck(env);
    case "auth":
      return handleAuth(apiPath, method);
    case "profile":
      return handleProfile(method);
    case "world":
      return handleWorld(apiPath, method, request, env);
    case "mission":
      return handleMission(apiPath, method);
    default:
      return new Response(
        JSON.stringify({ error: "API endpoint not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
  }
}
async function handleHealthCheck(env) {
  const id = env.MY_DURABLE_OBJECT.idFromName("world");
  const stub = env.MY_DURABLE_OBJECT.get(id);
  const greeting = await stub.sayHello("health-check");
  return new Response(
    JSON.stringify({
      status: "healthy",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      message: greeting
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}
async function handleAuth(path, method, request, env) {
  const endpoint = path[1];
  switch (endpoint) {
    case "nonce":
      if (method !== "GET") {
        return new Response("Method not allowed", { status: 405 });
      }
      return new Response(
        JSON.stringify({
          nonce: Math.random().toString(36).substring(7),
          message: "Sign this message to authenticate with Scablanders"
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    case "verify":
      if (method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
      }
      return new Response(
        JSON.stringify({ success: false, error: "Not implemented yet" }),
        { headers: { "Content-Type": "application/json" } }
      );
    default:
      return new Response("Auth endpoint not found", { status: 404 });
  }
}
async function handleProfile(method, request, env) {
  if (method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }
  const mockProfile = {
    address: "0x0000000000000000000000000000000000000000",
    balance: 500,
    ownedDrifters: [],
    discoveredNodes: [],
    upgrades: [],
    lastLogin: /* @__PURE__ */ new Date()
  };
  return new Response(
    JSON.stringify(mockProfile),
    { headers: { "Content-Type": "application/json" } }
  );
}
async function handleWorld(path, method, request, env) {
  const endpoint = path[1];
  switch (endpoint) {
    case "state":
      if (method !== "GET") {
        return new Response("Method not allowed", { status: 405 });
      }
      const id = env.MY_DURABLE_OBJECT.idFromName("world");
      const stub = env.MY_DURABLE_OBJECT.get(id);
      const worldState = await stub.getWorldState();
      return new Response(
        JSON.stringify(worldState),
        { headers: { "Content-Type": "application/json" } }
      );
    default:
      return new Response("World endpoint not found", { status: 404 });
  }
}
async function handleMission(path, method, request, env) {
  const endpoint = path[1];
  switch (endpoint) {
    case "start":
      if (method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
      }
      return new Response(
        JSON.stringify({ success: false, error: "Not implemented yet" }),
        { headers: { "Content-Type": "application/json" } }
      );
    default:
      return new Response("Mission endpoint not found", { status: 404 });
  }
}
const worker = {
  async fetch(request, env, ctx) {
    return handleApiRequest(request, env);
  }
};
export {
  MyDurableObject,
  worker as default
};
