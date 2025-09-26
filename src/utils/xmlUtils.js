/**
 * Convierte un string XML en un Document
 */
export function parseXML(xmlString) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "application/xml");

    // Verificar errores de parseo
    if (xmlDoc.getElementsByTagName("parsererror").length > 0) {
        throw new Error("Error al parsear el XML");
    }

    return xmlDoc;
}

/**
 * Convierte un Document XML de nuevo a string
 */
export function serializeXML(xmlDoc) {
    const serializer = new XMLSerializer();
    return serializer.serializeToString(xmlDoc);
}

/**
 * Extrae nodos con un selector CSS simple
 * Ejemplo: extractNodes(xmlDoc, "States > State")
 */
export function extractNodes(xmlDoc, selector) {
    return Array.from(xmlDoc.querySelectorAll(selector));
}
