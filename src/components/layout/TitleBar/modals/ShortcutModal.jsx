import React from "react";
import { FaKeyboard } from "react-icons/fa";
import HelpModal from "./HelpModal";

export default function ShortcutModal(props) {
  return <HelpModal {...props} title="Atajos de teclado" icon={FaKeyboard}
    summary="Accesos rápidos para editar y navegar sin apartar las manos del teclado."
    shortcuts={[
      { keys: "Ctrl + S", label: "Guardar XML o recurso activo" },
      { keys: "Ctrl + F", label: "Abrir búsqueda" },
      { keys: "Ctrl + /", label: "Comentar o descomentar" },
      { keys: "Ctrl + B", label: "Enfocar búsqueda lateral" },
      { keys: "Ctrl + rueda", label: "Cambiar zoom del editor" },
      { keys: "F2", label: "Renombrar recurso en Pantallas" },
    ]}
    tip="Si un atajo no funciona, primero haz clic en el editor o módulo donde esperas usarlo." />;
}
