import { Hono } from 'hono';
import { generateNonce } from 'siwe';
import { verifySiweSignature, createSessionToken } from '../auth';

const auth = new Hono<{ Bindings: Env }>();

// GET /api/auth/nonce - Get nonce for SIWE
auth.get('/nonce', async (c) => {
	try {
		const nonce = generateNonce();

		// Create KV adapter for nonce storage
		const nonceStore = {
			async get(key: string) {
				return await c.env.AUTH_KV.get(key);
			},
			async put(key: string, value: string, options?: { expirationTtl?: number }) {
				return await c.env.AUTH_KV.put(key, value, options);
			},
			async delete(key: string) {
				return await c.env.AUTH_KV.delete(key);
			},
		};

		// Store nonce with 5 minute expiration
		await nonceStore.put(`nonce:${nonce}`, 'valid', { expirationTtl: 300 });

		return c.json({
			nonce,
			message: `Welcome to Scablanders!\\n\\nSign this message to authenticate with your wallet.\\n\\nNonce: ${nonce}`,
		});
	} catch (error) {
		console.error('Nonce generation error:', error);
		return c.json({ error: 'Failed to generate nonce' }, 500);
	}
});

// POST /api/auth/verify - Verify SIWE signature
auth.post('/verify', async (c) => {
	try {
		const { message, signature } = await c.req.json();

		if (!message || !signature) {
			return c.json(
				{
					success: false,
					error: 'Message and signature required',
				},
				400,
			);
		}

		// Create KV adapter for nonce storage
		const nonceStore = {
			async get(key: string) {
				return await c.env.AUTH_KV.get(key);
			},
			async put(key: string, value: string, options?: { expirationTtl?: number }) {
				return await c.env.AUTH_KV.put(key, value, options);
			},
			async delete(key: string) {
				return await c.env.AUTH_KV.delete(key);
			},
		};

		const result = await verifySiweSignature(message, signature, nonceStore);

		if (!result.success) {
			return c.json(
				{
					success: false,
					error: result.error,
				},
				401,
			);
		}

		// Create session token
		const token = createSessionToken(result.address!);

		// Set secure HTTP-only cookie
		c.header('Set-Cookie', `CF_ACCESS_TOKEN=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=86400; Path=/`);

		return c.json({
			success: true,
			address: result.address,
		});
	} catch (error) {
		console.error('Auth verification error:', error);
		return c.json(
			{
				success: false,
				error: 'Authentication failed',
			},
			500,
		);
	}
});

// POST /api/auth/logout - Clear authentication
auth.post('/logout', async (c) => {
	// Clear the auth cookie
	c.header('Set-Cookie', 'CF_ACCESS_TOKEN=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/');

	return c.json({ success: true });
});

export default auth;
