import { s as siweExports } from "../worker.js";
import "node:events";
import "node:stream";
import "cloudflare:workers";
import "buffer";
import "node:net";
import "zlib";
import "net";
import "stream";
import "path";
import "url";
import "assert";
import "events";
async function verifySiweSignature(message, signature, nonceStore) {
  try {
    const siweMessage = new siweExports.SiweMessage(message);
    const address = siweMessage.address;
    const storedNonce = await nonceStore.get(`nonce:${siweMessage.nonce}`);
    if (!storedNonce) {
      return { success: false, error: "Invalid or expired nonce" };
    }
    const verification = await siweMessage.verify({ signature });
    if (!verification.success) {
      return { success: false, error: "Invalid signature" };
    }
    if (siweMessage.issuedAt) {
      const issuedAt = new Date(siweMessage.issuedAt);
      const now = /* @__PURE__ */ new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1e3);
      if (issuedAt < fiveMinutesAgo) {
        return { success: false, error: "Message expired" };
      }
    }
    await nonceStore.delete(`nonce:${siweMessage.nonce}`);
    return {
      success: true,
      address: address.toLowerCase()
    };
  } catch (error) {
    console.error("SIWE verification error:", error);
    return {
      success: false,
      error: "Verification failed"
    };
  }
}
function createSessionToken(address) {
  const session = {
    address: address.toLowerCase(),
    issuedAt: Date.now(),
    random: Math.random().toString(36).substring(7)
  };
  return btoa(JSON.stringify(session));
}
function parseSessionToken(token) {
  try {
    const session = JSON.parse(atob(token));
    const dayAgo = Date.now() - 24 * 60 * 60 * 1e3;
    if (session.issuedAt < dayAgo) {
      return null;
    }
    if (!session.address || typeof session.address !== "string") {
      return null;
    }
    return { address: session.address };
  } catch {
    return null;
  }
}
function createAuthMiddleware(sessionStore) {
  return async (request) => {
    const cookieHeader = request.headers.get("Cookie");
    const authHeader = request.headers.get("Authorization");
    let token = null;
    if (cookieHeader) {
      const cookies = cookieHeader.split(";").map((c) => c.trim());
      const authCookie = cookies.find((c) => c.startsWith("CF_ACCESS_TOKEN="));
      if (authCookie) {
        token = authCookie.split("=")[1];
      }
    }
    if (!token && authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    }
    if (!token) {
      return { error: "No authentication token provided" };
    }
    const session = parseSessionToken(token);
    if (!session) {
      return { error: "Invalid or expired token" };
    }
    return { address: session.address };
  };
}
const generateNonce = siweExports.generateNonce;
export {
  createAuthMiddleware,
  createSessionToken,
  generateNonce,
  parseSessionToken,
  verifySiweSignature
};
