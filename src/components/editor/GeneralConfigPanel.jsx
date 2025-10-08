import React, { useEffect, useState } from "react";
import {
  FaPlus,
  FaMinus,
  FaSave,
  FaTimes,
  FaTimesCircle,
} from "react-icons/fa";
import "./GeneralConfigPanel.css";
import { formatXml, serializeXML } from "../../utils/xmlUtils";

export default function GeneralConfigPanel({
  xmlDoc,
  setXmlDoc,
  setCode,
  onClose,
  setNotification,
}) {
  const [params, setParams] = useState([]);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!xmlDoc) return;
    const generalNode = xmlDoc.querySelector("General");
    if (!generalNode) return;

    const parsed = Array.from(generalNode.querySelectorAll("Param")).map(
      (p) => ({
        key: p.getAttribute("Key") || "",
        value: p.textContent || "",
      })
    );

    setParams(parsed);
  }, [xmlDoc]);

  const handleChange = (index, field, value) => {
    setParams((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleAdd = () =>
    setParams((prev) => [...prev, { key: "", value: "" }]);
  const handleDelete = (index) =>
    setParams((prev) => prev.filter((_, i) => i !== index));

  const handleSave = () => {
    if (!xmlDoc) return;
    const newDoc = xmlDoc.cloneNode(true);
    const generalNode = newDoc.querySelector("General");

    while (generalNode.firstChild) {
      generalNode.removeChild(generalNode.firstChild);
    }

    params.forEach(({ key, value }) => {
      if (!key.trim()) return;
      const p = newDoc.createElement("Param");
      p.setAttribute("Key", key);
      p.textContent = value;
      generalNode.appendChild(p);
    });

    let newCode = serializeXML(newDoc);
    const formatted = formatXml(newCode);
    if (formatted) newCode = formatted;

    setXmlDoc(newDoc);
    setCode(newCode);
    setNotification(
      "success",
      "Se guardaron los cambios en la configuración General."
    );
    startClose();
  };

  const startClose = () => {
    setClosing(true);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  return (
    <div className={`gconfig-overlay ${closing ? "closing" : "open"}`}>
      <div className={`gconfig-panel ${closing ? "closing" : "open"}`}>
        <div className="gconfig-header">
          <h3>Configuración general</h3>
          <div className="gconfig-actions">
            <button
              className="gconfig-btn primary"
              onClick={handleSave}
              title="Guardar"
            >
              <FaSave /> <span className="gconfig-btn-text">Guardar</span>
            </button>
            <button
              className="gconfig-btn secondary"
              onClick={startClose}
              title="Cancelar"
            >
              <FaTimesCircle />{" "}
              <span className="gconfig-btn-text">Cancelar</span>
            </button>
          </div>
        </div>

        <div className="gconfig-body">
          {params.map((param, i) => (
            <div key={i} className="gconfig-row">
              <input
                type="text"
                className="gconfig-input key"
                placeholder="Key"
                value={param.key}
                onChange={(e) => handleChange(i, "key", e.target.value)}
              />
              <input
                type="text"
                className="gconfig-input value"
                placeholder="Value"
                value={param.value}
                onChange={(e) => handleChange(i, "value", e.target.value)}
              />
              <button
                className="gconfig-btn-icon danger"
                onClick={() => handleDelete(i)}
                title="Eliminar"
              >
                <FaMinus />
              </button>
            </div>
          ))}

          <button className="gconfig-btn-add" onClick={handleAdd}>
            <FaPlus /> Agregar
          </button>
        </div>
      </div>
    </div>
  );
}
