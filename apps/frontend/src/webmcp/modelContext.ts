export type ModelContextNamespace = {
  readonly modelContext?: WebMCPModelContext;
};

export type ModelContextSelection =
  | {
      readonly supported: true;
      readonly source: "document" | "navigator";
      readonly context: WebMCPModelContext;
    }
  | { readonly supported: false };

export function selectModelContext(
  documentNamespace: ModelContextNamespace,
  navigatorNamespace: ModelContextNamespace,
): ModelContextSelection {
  if (documentNamespace.modelContext) {
    return {
      supported: true,
      source: "document",
      context: documentNamespace.modelContext,
    };
  }

  if (navigatorNamespace.modelContext) {
    return {
      supported: true,
      source: "navigator",
      context: navigatorNamespace.modelContext,
    };
  }

  return { supported: false };
}
