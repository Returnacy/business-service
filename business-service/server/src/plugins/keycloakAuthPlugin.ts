// @ts-nocheck
import fp from 'fastify-plugin';
import { createRemoteJWKSet, jwtVerify, decodeJwt } from 'jose';
import type { JWTVerifyOptions } from 'jose';

export default fp(async (fastify) => {
  const KEYCLOAK_BASE_URL = process.env.KEYCLOAK_BASE_URL;
  const REALM = process.env.KEYCLOAK_REALM;
  if (!KEYCLOAK_BASE_URL || !REALM) {
    fastify.log.error('Missing KEYCLOAK_BASE_URL or KEYCLOAK_REALM env vars');
    throw new Error('Keycloak configuration missing');
  }

  const keycloakJwksUrl = `${KEYCLOAK_BASE_URL}/realms/${REALM}/protocol/openid-connect/certs`;
  const keycloakIssuer = `${KEYCLOAK_BASE_URL}/realms/${REALM}`;
  fastify.log.info({ keycloakJwksUrl }, '[business-service] Keycloak JWKS URL');

  const KEYCLOAK_JWKS = createRemoteJWKSet(new URL(keycloakJwksUrl));

  const selfIssuer = process.env.SELF_ISSUER?.trim();
  const selfIssuerJwksUrl = process.env.SELF_ISSUER_JWKS_URL?.trim();
  const SELF_JWKS = (selfIssuer && selfIssuerJwksUrl)
    ? createRemoteJWKSet(new URL(selfIssuerJwksUrl))
    : null;
  if (SELF_JWKS) {
    fastify.log.info({ selfIssuer, selfIssuerJwksUrl }, '[business-service] Dual-issuer mode: also accepting self-issued tokens');
  }

  const configuredIssuersEnv = process.env.KEYCLOAK_ISSUER;
  const baseIssuers: string[] = configuredIssuersEnv
    ? configuredIssuersEnv.split(',').map((s) => s.trim()).filter(Boolean)
    : [
        keycloakIssuer,
        `http://localhost:8080/realms/${REALM}`,
        `http://keycloak:8080/realms/${REALM}`,
      ];
  const validIssuers: string[] = SELF_JWKS && selfIssuer
    ? [...baseIssuers, selfIssuer]
    : baseIssuers;

  const audienceEnv = process.env.KEYCLOAK_AUDIENCE || process.env.KEYCLOAK_ALLOWED_AUDIENCES || '';
  const allowedAudiences = audienceEnv.split(',').map((s) => s.trim()).filter(Boolean);

  const CLOCK_TOLERANCE_SECONDS = Number(process.env.KEYCLOAK_CLOCK_TOLERANCE_SECONDS || 60);

  fastify.decorateRequest('auth', null as any);

  fastify.addHook('preHandler', async (request, reply) => {
    try {
      const authHeader = request.headers['authorization'];
      if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
        return reply.status(401).send({ error: 'Missing or invalid Authorization header' });
      }
      const token = authHeader.substring(7).trim();
      if (!token) return reply.status(401).send({ error: 'Missing token' });

      let tokenIss: string | undefined;
      try {
        tokenIss = decodeJwt(token).iss;
      } catch {
        // fall through; jwtVerify will reject below
      }

      if (process.env.NODE_ENV !== 'production') {
        try {
          const decoded = decodeJwt(token);
          fastify.log.debug({
            iss: decoded.iss,
            azp: (decoded as any).azp,
            aud: decoded.aud,
            exp: decoded.exp,
            sub: decoded.sub,
          }, '[business-service] decoded token payload (debug)');
        } catch (err) {
          fastify.log.debug({ err }, '[business-service] failed to decode token payload');
        }
      }

      const jwksToUse = (SELF_JWKS && tokenIss && tokenIss === selfIssuer) ? SELF_JWKS : KEYCLOAK_JWKS;

      const verifyOptions: JWTVerifyOptions = {
        issuer: validIssuers,
        clockTolerance: CLOCK_TOLERANCE_SECONDS,
      };

      const { payload } = await jwtVerify(token, jwksToUse, verifyOptions);

      if (allowedAudiences.length > 0) {
        const audClaim = payload.aud;
        const azpClaim = (payload as any).azp;
        const audList: string[] = Array.isArray(audClaim) ? audClaim : typeof audClaim === 'string' ? [audClaim] : [];
        const azpList: string[] = typeof azpClaim === 'string' ? [azpClaim] : Array.isArray(azpClaim) ? azpClaim : [];
        const combined = [...audList, ...azpList];
        const match = combined.some((value) => allowedAudiences.includes(value));
        if (!match) {
          return reply.status(401).send({ error: 'Invalid audience' });
        }
      }

      request.auth = payload;
      return;
    } catch (err) {
      fastify.log.debug({ err }, '[business-service] JWT verification failed');
      return reply.status(401).send({ error: 'Invalid or expired token' });
    }
  });
});
