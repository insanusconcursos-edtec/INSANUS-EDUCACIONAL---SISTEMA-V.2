/**
 * Utilitários para lidar com objetos do Firestore e evitar erros de estrutura circular.
 */

const isFirestoreObject = (obj: any): boolean => {
  if (!obj || typeof obj !== 'object') return false;
  
  // Robust check for Firestore objects even when minified
  return (
    // Timestamp
    (typeof obj.toDate === 'function' && typeof obj.toMillis === 'function') ||
    // DocumentReference
    (typeof obj.path === 'string' && (obj.id || obj.parent) && (obj.type === 'document' || obj.firestore)) ||
    // FieldValue
    (obj.constructor?.name === 'FieldValue' || (typeof obj.isEqual === 'function' && !obj.path)) ||
    // GeoPoint
    (obj._lat !== undefined && obj._long !== undefined) ||
    // CollectionReference / Query
    (typeof obj.where === 'function' && typeof obj.orderBy === 'function')
  );
};

/**
 * Converte objetos do Firestore (ou qualquer objeto) em um objeto "Plain" (apenas dados).
 * Transforma Timestamps em strings ISO e remove DocumentReferences ou métodos.
 * Útil para evitar erros de estrutura circular e garantir compatibilidade com JSON.stringify.
 */
export const toPlainObject = (obj: any, seen = new WeakSet()): any => {
  if (obj === null || obj === undefined) return obj;

  // Se não for um objeto ou array, retorna o valor primitivo
  if (typeof obj !== 'object') return obj;

  // Proteção contra estrutura circular
  if (seen.has(obj)) {
    return "[Circular]";
  }

  // Se for Date
  if (obj instanceof Date) return obj.toISOString();

  // Se for Timestamp do Firestore (tem toDate())
  if (typeof obj.toDate === 'function') {
    try {
      return obj.toDate().toISOString();
    } catch (e) {
      return String(obj);
    }
  }

  // Se for um DocumentReference ou algo com path (Firebase)
  if (obj.path && typeof obj.path === 'string' && (obj.id || obj.parent)) {
    return obj.path;
  }

  // Se for array, limpa cada item
  if (Array.isArray(obj)) {
    seen.add(obj);
    return obj.map(item => toPlainObject(item, seen));
  }

  // Se chegar aqui e não for um "Plain Object" (ex: Snapshot, Query), mas tiver dados
  if (typeof obj.data === 'function' && typeof obj.get === 'function') {
    try {
      const data = obj.data();
      return toPlainObject({ id: obj.id, ...data }, seen);
    } catch (e) {
      // Ignora erro
    }
  }

  // Se for um objeto normal {}
  seen.add(obj);
  const plainObj: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const val = obj[key];
      // Ignora funções e campos privados (que começam com _)
      if (typeof val !== 'function' && !key.startsWith('_')) {
        plainObj[key] = toPlainObject(val, seen);
      }
    }
  }
  return plainObj;
};

/**
 * Remove campos 'undefined' de um objeto recursivamente e realiza uma clonagem profunda segura.
 * Preserva objetos especiais do Firestore (Timestamp, FieldValue, DocumentReference) e Dates.
 * Inclui proteção contra estrutura circular.
 */
export const sanitizeData = (obj: any, seen = new WeakSet()): any => {
  if (obj === null || obj === undefined || typeof obj !== 'object') return obj;

  // Proteção contra estrutura circular
  if (seen.has(obj)) {
    return null; // Ou poderíamos retornar uma referência se necessário, mas para Firestore dados circulares são inválidos
  }

  // Se for um objeto especial do Firestore ou Date, retorna como está (não recursivo)
  if (isFirestoreObject(obj) || obj instanceof Date) {
    return obj;
  }

  if (Array.isArray(obj)) {
    seen.add(obj);
    return obj
      .filter(item => item !== undefined)
      .map(item => sanitizeData(item, seen));
  }

  seen.add(obj);
  const newObj: any = {};
  Object.keys(obj).forEach(key => {
    if (obj[key] !== undefined) {
      newObj[key] = sanitizeData(obj[key], seen);
    }
  });
  return newObj;
};

/**
 * Alias para sanitizeData, usado para clonagem profunda segura.
 */
export const deepCloneSafe = <T>(obj: T): T => {
  return sanitizeData(obj) as T;
};
