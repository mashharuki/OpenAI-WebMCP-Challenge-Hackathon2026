import "react";

// These declarations cover the experimental WebMCP surface used by this demo
// until the attributes and browser APIs ship in React and TypeScript's DOM types.
declare module "react" {
  interface FormHTMLAttributes<T> {
    toolname?: string;
    tooldescription?: string;
    toolautosubmit?: "";
  }

  interface InputHTMLAttributes<T> {
    toolparamdescription?: string;
  }
}

declare global {
  interface WebMCPToolExecuteOptions {
    readonly signal: AbortSignal;
  }

  interface WebMCPTool {
    name: string;
    title?: string;
    description: string;
    inputSchema: object;
    annotations?: {
      readOnlyHint?: boolean;
      untrustedContentHint?: boolean;
    };
    execute(
      input: unknown,
      options: WebMCPToolExecuteOptions,
    ): Promise<unknown>;
  }

  interface WebMCPRegisterToolOptions {
    exposedTo?: readonly string[];
    signal?: AbortSignal;
  }

  interface WebMCPModelContext {
    registerTool(
      tool: WebMCPTool,
      options?: WebMCPRegisterToolOptions,
    ): Promise<void>;
  }

  interface Document {
    readonly modelContext?: WebMCPModelContext;
  }

  interface Navigator {
    readonly modelContext?: WebMCPModelContext;
  }

  interface SubmitEvent {
    readonly agentInvoked: boolean;
    respondWith(response: Promise<unknown>): void;
  }
}
