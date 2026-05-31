import { EventType, AnyEvent, EventHandler, BaseEvent } from './EventTypes';

type EventMap = Map<EventType, Set<EventHandler>>;

class EventBusClass {
  private listeners: EventMap = new Map();
  private eventHistory: AnyEvent[] = [];
  private maxHistorySize = 1000;
  private isLogging = true;

  subscribe<T extends AnyEvent>(
    eventType: EventType,
    handler: EventHandler<T>
  ): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }

    const handlers = this.listeners.get(eventType)!;
    handlers.add(handler as EventHandler);

    return () => {
      handlers.delete(handler as EventHandler);
      if (handlers.size === 0) {
        this.listeners.delete(eventType);
      }
    };
  }

  async emit<T extends AnyEvent>(event: T): Promise<void> {
    if (this.isLogging) {
      this.addToHistory(event);
    }

    const handlers = this.listeners.get(event.type);
    if (!handlers || handlers.size === 0) return;

    const promises: Promise<void>[] = [];

    handlers.forEach((handler) => {
      try {
        const result = handler(event);
        if (result instanceof Promise) {
          promises.push(result);
        }
      } catch (error) {
        console.error(`Error in event handler for ${event.type}:`, error);
      }
    });

    await Promise.allSettled(promises);
  }

  emitSync<T extends AnyEvent>(event: T): void {
    if (this.isLogging) {
      this.addToHistory(event);
    }

    const handlers = this.listeners.get(event.type);
    if (!handlers || handlers.size === 0) return;

    handlers.forEach((handler) => {
      try {
        handler(event);
      } catch (error) {
        console.error(`Error in event handler for ${event.type}:`, error);
      }
    });
  }

  once<T extends AnyEvent>(
    eventType: EventType,
    handler: EventHandler<T>
  ): () => void {
    const wrappedHandler: EventHandler = async (event) => {
      this.removeListener(eventType, wrappedHandler);
      await (handler as EventHandler)(event);
    };

    return this.subscribe(eventType, wrappedHandler);
  }

  private removeListener(eventType: EventType, handler: EventHandler): void {
    const handlers = this.listeners.get(eventType);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.listeners.delete(eventType);
      }
    }
  }

  private addToHistory(event: AnyEvent): void {
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
  }

  getHistory(eventType?: EventType, limit?: number): AnyEvent[] {
    let events = this.eventHistory;
    if (eventType) {
      events = events.filter((e) => e.type === eventType);
    }
    if (limit !== undefined && limit > 0) {
      events = events.slice(-limit);
    }
    return events;
  }

  clearHistory(): void {
    this.eventHistory = [];
  }

  enableLogging(): void {
    this.isLogging = true;
  }

  disableLogging(): void {
    this.isLogging = false;
  }

  getSubscriberCount(eventType: EventType): number {
    return this.listeners.get(eventType)?.size ?? 0;
  }

  removeAllListeners(eventType?: EventType): void {
    if (eventType) {
      this.listeners.delete(eventType);
    } else {
      this.listeners.clear();
    }
  }
}

export const eventBus = new EventBusClass();

export function createEvent(
  type: EventType,
  source: string,
  data: Record<string, unknown>,
  correlationId?: string
): BaseEvent {
  return {
    type,
    timestamp: new Date(),
    source,
    correlationId,
    ...(data as any),
  } as AnyEvent;
}
