declare module 'fastify' {
  export type FastifyInstance = any;
  const Fastify: any;
  export default Fastify;
}

declare module '@fastify/cors' {
  const cors: any;
  export default cors;
}

declare module 'fastify-plugin' {
  const fp: any;
  export default fp;
}

declare var process: any;
