export async function register() {
  if (process.env.NODE_ENV !== "production") {
    const { neonConfig } = await import("@neondatabase/serverless");
    neonConfig.fetchEndpoint = (host: string) => {
      const proxyHost = host === "localhost" ? "db.localtest.me" : host;
      const [protocol, port] =
        host === "localhost" ? ["http", 4444] : ["https", 443];
      return `${protocol}://${proxyHost}:${port}/sql`;
    };
    neonConfig.wsProxy = (host: string) =>
      host === "localhost" ? `db.localtest.me:4444/v1` : `${host}/v1`;
    neonConfig.useSecureWebSocket = false;
    neonConfig.pipelineTLS = false;
    neonConfig.pipelineConnect = false;
  }
}
