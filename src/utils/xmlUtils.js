import { sidebarConfig } from "./sidebarConfig";

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
    let xmlString = serializer.serializeToString(xmlDoc);

    // Asegurar encabezado
    if (!xmlString.startsWith("<?xml")) {
        xmlString = '<?xml version="1.0" encoding="utf-8"?>\n' + xmlString;
    }
    return xmlString;
}

export function formatXml(xmlString) {
    try {
        const parser = new DOMParser();
        const xml = parser.parseFromString(xmlString, "application/xml");

        if (xml.getElementsByTagName("parsererror").length > 0) {
            return null;
        }

        const xslt = `
      <xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0">
        <xsl:output method="xml" indent="yes" encoding="UTF-8"/>
        <xsl:strip-space elements="*"/>
        <xsl:template match="@*|node()">
          <xsl:copy>
            <xsl:apply-templates select="@*|node()"/>
          </xsl:copy>
        </xsl:template>
      </xsl:stylesheet>
    `;
        const xsltDoc = parser.parseFromString(xslt, "application/xml");
        const processor = new XSLTProcessor();
        processor.importStylesheet(xsltDoc);
        const resultDoc = processor.transformToDocument(xml);

        let result = new XMLSerializer().serializeToString(resultDoc);

        // Encabezado explícito
        if (!result.startsWith("<?xml")) {
            result = '<?xml version="1.0" encoding="utf-8"?>\n' + result;
        }
        return result;
    } catch {
        return null;
    }
}

/**
 * Valida que los IDs dentro de cada esquema sean únicos
 * @returns {Array} lista de errores encontrados
 */
export function validateUniqueIds(xmlDoc) {
    const errors = [];

    Object.entries(sidebarConfig).forEach(([key, cfg]) => {
        const parent = xmlDoc.querySelector(key);
        if (!parent) return;

        const seen = new Map();

        Array.from(parent.getElementsByTagName(cfg.childTag)).forEach((el) => {
            const id = el.getAttribute(cfg.idAttr);
            if (!id) return;

            if (seen.has(id)) {
                errors.push(
                    `[${cfg.label}] ID duplicado "${id}" en elementos <${cfg.childTag}>`
                );
            } else {
                seen.set(id, true);
            }
        });
    });

    return errors;
}

/**
 * Extrae nodos con un selector CSS simple
 * Ejemplo: extractNodes(xmlDoc, "States > State")
 */
export function extractNodes(xmlDoc, selector) {
    return Array.from(xmlDoc.querySelectorAll(selector));
}
