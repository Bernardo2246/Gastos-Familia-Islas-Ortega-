// Clase de color del monto restante de un sobre según su semáforo
// (lib/finance.js → semaforo): ámbar 80–100 %, rojo > 100 %.
export const remainClass = (c) => (c.status === 'over' ? 'neg' : c.status === 'warn' ? 'warn' : '')
