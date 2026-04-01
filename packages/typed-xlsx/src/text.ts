export type LazyText = string | (() => string);

export interface ValidationMessage {
  title?: LazyText;
  message: LazyText;
}

export interface ResolvedValidationMessage {
  title?: string;
  message: string;
}

export function resolveLazyText(value?: LazyText) {
  if (typeof value === "function") {
    return value();
  }

  return value;
}

export function resolveValidationMessage(
  message?: string | ValidationMessage,
): ResolvedValidationMessage | undefined {
  if (!message) {
    return undefined;
  }

  if (typeof message === "string") {
    return { message };
  }

  const resolvedMessage = resolveLazyText(message.message);
  if (!resolvedMessage) {
    return undefined;
  }

  return {
    title: resolveLazyText(message.title),
    message: resolvedMessage,
  };
}
