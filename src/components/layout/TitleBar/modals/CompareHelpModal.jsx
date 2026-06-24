import React from "react";
import { FaExchangeAlt, FaFileCode } from "react-icons/fa";
import HelpModal from "./HelpModal";

export default function CompareHelpModal(props) {
  return <HelpModal {...props} title="Comparador XML" icon={FaExchangeAlt}
    summary="Revisa diferencias entre dos XML sin modificar ninguno de los archivos."
    quickStart={["Carga el XML base en un lado.", "Selecciona el segundo archivo.", "Recorre los cambios y decide qué conservar."]}
    sections={[
      { title: "Lectura de cambios", icon: FaExchangeAlt, items: ["Las altas, bajas y cambios se resaltan en línea.", "El scroll sincronizado conserva el contexto.", "El minimapa ayuda a ubicar cambios lejanos."] },
      { title: "Uso seguro", icon: FaFileCode, items: ["Comparar no edita los archivos por sí mismo.", "Guarda solo después de revisar los bloques necesarios.", "Úsalo antes de compilar o distribuir una versión."] },
    ]}
    tip="Si los archivos son muy distintos, empieza por las diferencias de estructura y luego revisa los atributos." />;
}
