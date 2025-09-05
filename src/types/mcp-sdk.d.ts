declare module '@modelcontextprotocol/sdk/server' {
  export class Server {
    constructor(opts: { name: string; version: string });
    tool(def: any, handler: (input: any) => Promise<any> | any): void;
    connect(transport: any): Promise<void>;
  }
}

declare module '@modelcontextprotocol/sdk/transports/stdio' {
  export class StdioServerTransport {
    constructor(...args: any[]);
  }
}

