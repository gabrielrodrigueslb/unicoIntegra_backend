type Listener = (...args: unknown[]) => void;

class EventBus {
  private listeners: { [key: string]: Listener[] } = {};

  // Método para um componente "escutar" um evento
  on<TArgs extends unknown[]>(event: string, listener: (...args: TArgs) => void) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(listener as Listener);
  }

  // Método para parar de escutar
  off<TArgs extends unknown[]>(event: string, listener: (...args: TArgs) => void) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter((l) => l !== listener);
  }

  // Método para "disparar" um evento para todos os ouvintes
  emit(event: string, ...args: unknown[]) {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(listener => listener(...args));
  }
}

// Exportamos uma única instância para toda a aplicação usar o mesmo "mural"
export const eventBus = new EventBus();
