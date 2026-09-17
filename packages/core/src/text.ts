export type LazyText<TContext = void> = string | ((context: TContext) => string);

export interface ValidationMessage<TContext = void> {
  title?: LazyText<TContext>;
  message: LazyText<TContext>;
}

export interface ResolvedValidationMessage {
  title?: string;
  message: string;
}

export function resolveLazyText<TContext>(
  value: LazyText<TContext> | undefined,
  context: TContext,
) {
  if (typeof value === "function") {
    return value(context);
  }

  return value;
}

export function resolveValidationMessage<TContext>(
  message: string | ValidationMessage<TContext> | undefined,
  context: TContext,
): ResolvedValidationMessage | undefined {
  if (!message) {
    return undefined;
  }

  if (typeof message === "string") {
    return { message };
  }

  const resolvedMessage = resolveLazyText(message.message, context);
  if (!resolvedMessage) {
    return undefined;
  }

  return {
    title: resolveLazyText(message.title, context),
    message: resolvedMessage,
  };
}
