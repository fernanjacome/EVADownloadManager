import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FaClock,
  FaFileAlt,
  FaFilter,
  FaFolderOpen,
  FaQuestionCircle,
  FaSortAmountDown,
  FaSortAmountUp,
} from "react-icons/fa";
import { FaRotateRight } from "react-icons/fa6";
import "./logs.css";

const LINE_RE =
  /^\[(?<time>\d{2}:\d{2}:\d{2}\.\d{3})\]\[(?<level>[^\]]+)\]-\[(?<ip>[^\]]+)\]\[(?<direction>[<>])\]-(?<payload>.*)$/;

const COMMAND_LABELS = {
  1: "Poner en servicio",
  2: "Fuera de servicio",
  3: "Solicitar configuracion",
  4: "Solicitar estado",
  5: "Enviar configuracion",
  6: "Confirmar ConfID",
  7: "Cambiar llave",
  9: "Desconectar",
  10: "Asignar usuario",
  11: "Reset dispositivo",
  12: "Reset forzado",
  13: "Salir de idle",
  128: "Abrir OAR",
  256: "Ejecutar funcion / respuesta host",
};

const AUX_GROUPS = {
  1: "Screens",
  2: "States",
  3: "Fits / BIN",
  4: "Terminal / EMV",
};

const DEVICE_LABELS = {
  0: "ATM",
  1: "Lector de tarjeta",
  2: "PIN Pad",
  3: "Impresora journal",
  4: "Impresora recibos",
  5: "Impresora libreta",
  6: "Dispensador de efectivo",
  7: "Sensores e indicadores",
  8: "Deposito de efectivo",
  9: "Camara",
  10: "Vendor Mode",
  11: "Lector codigo barras",
  12: "Impresora passbook",
  13: "Lector contactless",
  99: "COM",
};

const ACCOUNT_LABELS = {
  A: "Ahorros",
  B: "Corriente",
  C: "Credito",
};

const RESULT_LABELS = {
  0: "Rechazado",
  1: "Ready / OK",
  2: "Fault / Atencion",
};

const FUNCTION_LABELS = {
  0: "Ninguna",
  1: "Actualizar buffer",
  2: "Expulsar tarjeta",
  3: "Dispensar efectivo",
  4: "Presentar efectivo",
  5: "Enviar efectivo a dump",
  6: "Imprimir",
  7: "Depositar",
  8: "Rollback deposito",
  9: "Retraer deposito",
};

const EVENT_LABELS = {
  105: "Bandeja de papeles rechazados de impresora casi llena",
  106: "Recibo tomado",
  107: "Impresora con poco papel o sin papel",
  108: "Impresora con poco toner/tinta",
  109: "Papel de impresora insertado",
  110: "Lampara de impresora fallando o inoperativa",
  111: "Poca o nula tinta de estampado",
  112: "Papel de impresora detectado",
  113: "Bandeja de papeles retraidos cambio de estado",
  115: "Definicion de impresion cargada",
  117: "Papel de impresora presentado",
  118: "Papel retraido automaticamente",
  119: "Impresora cambio de posicion",
  120: "Power save de impresora cambio",
  204: "Tarjeta removida",
  205: "Tarjeta expulsada o retenida por encendido/apagado",
  206: "Bandeja de tarjetas retenidas llena",
  209: "Tarjeta detectada en lectora",
  210: "Tarjeta insertada en bandeja de retencion",
  211: "Tarjeta removida de bandeja de retencion",
  213: "Lectora de tarjetas cambio de posicion",
  214: "Power save de lectora cambio",
  301: "Puerta de boveda abierta",
  302: "Puerta de boveda cerrada",
  303: "Cartucho alcanzando limite maximo/minimo",
  304: "Informacion de cartucho cambio",
  305: "Informacion de teller creada/modificada/eliminada",
  309: "Billetes tomados",
  313: "Billetes presentados",
  314: "Contadores cambiados CDM/CIM",
  317: "Billetes encontrados en dispensador",
  319: "Dispensador cambio de posicion",
  320: "Power save de dispensador cambio",
  323: "Estado de shutter cambio",
  402: "PIN Pad inicializado",
  403: "Acceso ilegal de llave",
  404: "Fecha/hora del HSM alcanzada",
  405: "Data del HSM cambio",
  406: "Certificado cambio primario/secundario",
  407: "HSM logica actual cambio",
  410: "Power save de PIN Pad cambio",
  801: "Estado de sensor cambio",
  802: "Sensor detecto error",
  803: "Power save de sensores/indicadores cambio",
};

const ERROR_LABELS = {
  "-102": "No hay papel presente",
  "-107": "Error en valor de campo durante impresion",
  "-108": "No se detecta papel en impresora",
  "-119": "Medio atascado dentro de la impresora",
  "-122": "Papel atascado en impresora de tickets/recibos",
  "-123": "Sin papel",
  "-124": "Sin tinta",
  "-125": "Sin toner",
  "-200": "Tarjeta atascada",
  "-201": "No hay tarjeta presente",
  "-202": "Tarjeta retenida",
  "-203": "Bandeja de retencion llena",
  "-209": "Falla del shutter",
  "-300": "Moneda invalida",
  "-302": "Error en cartucho",
  "-303": "Denominacion invalida",
  "-304": "Algoritmo de dispensado invalido",
  "-306": "No dispensable",
  "-307": "Muchos billetes",
  "-310": "Puerta de boveda abierta",
  "-312": "Shutter no abierto",
  "-316": "No hay billetes",
  "-320": "No hay billetes que presentar",
  "-321": "Error al presentar billetes",
  "-322": "Error desconocido al presentar billetes",
  "-323": "Billetes ya tomados",
  "-335": "Billetes sin tomar",
  "-336": "Billetes abandonados",
  "-341": "No se pudo completar retraccion",
  "-408": "No se ingreso PIN",
  "-434": "Verificacion EMV/chip fallo",
  "-801": "Puerto invalido SIU",
  "-802": "Error de sintaxis SIU",
  "-803": "Error de puerto SIU",
  "-900": "Interfaz Vendor no disponible",
  "-1302": "Error en unidad de efectivo CIM",
  "-1307": "Muchos billetes CIM",
  "-1310": "Puerta de boveda abierta CIM",
  "-1317": "No hay billetes CIM",
  "-1337": "Objetos extranos en unidad de deposito",
};

const COMPLETION_LABELS = {
  180: "Error al dispensar",
  185: "Cliente no retiro tarjeta antes de dispensacion",
  186: "Orden de dispensacion no llego por perdida de comunicacion",
  187: "Chip niega transaccion, no dispensa",
  194: "Dispensacion fallo, billetes retraidos",
  195: "Dispensacion fallo, billetes no retraidos",
  196: "Error al presentar, cliente no tuvo acceso",
  198: "Cliente no tomo billetes presentados",
  199: "Error al presentar billetes",
};

const GUIDE_EVENT_CODES = [
  107, 119, 204, 209, 301, 309, 313, 323, 402, 801, 802,
];
const GUIDE_ERROR_CODES = [
  -119, -122, -123, -200, -203, -312, -316, -321, -335, -408, -434,
];

const FILTER_FIELDS = [
  {
    key: "text",
    label: "Texto libre",
    placeholder: "Comando, IP, buffer, mensaje...",
  },
  { key: "timeRange", label: "Rango de horas" },
  { key: "ip", label: "IP", placeholder: "" },
  { key: "command", label: "Comando", placeholder: "5, 256, capabilities..." },
  { key: "result", label: "Resultado", placeholder: "0, 1, 2" },
  { key: "trx", label: "Transaccion", placeholder: "DEP, RET, CON..." },
  { key: "amount", label: "Monto", placeholder: "75" },
  { key: "serial", label: "Serial", placeholder: "947" },
  { key: "state", label: "NextState", placeholder: "200" },
  { key: "event", label: "Evento", placeholder: "304, 801" },
  {
    key: "device",
    label: "Dispositivo",
    placeholder: "Sensores, Cash In, 7...",
  },
];

const ENTRY_TYPE_META = {
  transaction: { token: "TX", label: "Transaccion" },
  event: { token: "EV", label: "Evento" },
  config: { token: "CFG", label: "Config" },
  marker: { token: "ON", label: "Online" },
  command: { token: "CMD", label: "Comando" },
  message: { token: "MSG", label: "Mensaje" },
  malformed: { token: "BAD", label: "No leida" },
};

const LOG_ENTRY_ROW_HEIGHT = 76;
const LOG_SESSION_ROW_HEIGHT = 118;
const LOG_ENTRY_OVERSCAN = 10;
const ERROR_STATES = new Set([900, 998, 999]);

function normalizeLogLine(line) {
  return String(line || "")
    .replace(/^\uFEFF/, "")
    .trim();
}

function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(ms) {
  if (!ms) return "";
  return new Date(ms).toLocaleString();
}

function getDirectionLabel(direction) {
  if (direction === ">") return "> Del cajero";
  if (direction === "<") return "< Del servidor";
  return "-";
}

function padTimePart(value, max) {
  const digits = String(value ?? "")
    .replace(/\D/g, "")
    .slice(0, 2);
  if (!digits) return "";
  const number = Math.max(0, Math.min(Number(digits), max));
  return String(number);
}

function mergeTimePart(current, part, value) {
  const [hours = "", minutes = ""] = String(current || "").split(":");
  const nextHours = part === "hours" ? padTimePart(value, 23) : hours;
  const nextMinutes = part === "minutes" ? padTimePart(value, 59) : minutes;
  if (!nextHours && !nextMinutes) return "";
  return `${nextHours || "00"}:${nextMinutes || "00"}`;
}

function safeJsonParse(value) {
  if (typeof value !== "string" || !value.trim().startsWith("{")) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function parseLooseJson(value) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text.startsWith("{") && !text.startsWith("[")) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function normalizeDeviceStatus(status) {
  if (!Array.isArray(status)) return [];
  return status.map((item) => {
    const data = parseLooseJson(item?.Data) || {};
    return {
      name: item?.Name,
      label: DEVICE_LABELS[item?.Name] || `Dispositivo ${item?.Name ?? "?"}`,
      error: item?.Error ?? data?.Error ?? 0,
      data,
    };
  });
}

function parseAuxiliar1(value) {
  if (typeof value !== "string" || !value) return null;

  if (/^Whttps?:\/\//i.test(value)) {
    return {
      type: "url",
      label: "URL de pantallas",
      preview: value.slice(1),
    };
  }

  const match = value.match(/^(\d)(\[.*\])$/);
  if (!match) {
    return {
      type: "value",
      label: "Auxiliar1",
      preview: value.length > 160 ? `${value.slice(0, 160)}...` : value,
    };
  }

  try {
    const items = JSON.parse(match[2]);
    return {
      type: "chunk",
      group: match[1],
      label: AUX_GROUPS[match[1]] || `Grupo ${match[1]}`,
      count: Array.isArray(items) ? items.length : 0,
      items,
      preview: Array.isArray(items)
        ? items
            .slice(0, 4)
            .map((item) => {
              const id = item.Id ?? item.Type ?? "";
              const text =
                item.Comment || item.Type || item.Param?.[0]?.Value || "";
              return [id, text].filter(Boolean).join(" - ");
            })
            .join(" | ")
        : "",
    };
  } catch {
    return {
      type: "value",
      label: "Auxiliar1",
      preview: value.length > 160 ? `${value.slice(0, 160)}...` : value,
    };
  }
}

function parseLogLine(line, index, fileName) {
  const normalizedLine = normalizeLogLine(line);
  const match = normalizedLine.match(LINE_RE);
  if (!match) {
    return {
      id: `${fileName}-${index}`,
      fileName,
      index,
      raw: normalizedLine,
      type: "malformed",
      level: "WARN",
      title: "Linea no reconocida",
      searchable: normalizedLine.toLowerCase(),
    };
  }

  const { time, level, ip, direction, payload } = match.groups;
  const entry = {
    id: `${fileName}-${index}`,
    fileName,
    index,
    time,
    level: level.trim(),
    ip: ip.trim(),
    direction,
    payload,
    raw: normalizedLine,
    type: "message",
    title: payload,
    subtitle: "",
    parsed: null,
    aux: null,
    issue: false,
    issueReason: "",
    deviceStatuses: [],
    searchable: normalizedLine.toLowerCase(),
  };

  if (payload === "_ONLINE_" || payload === "_OFFLINE_" || payload === "Init") {
    entry.type = "marker";
    entry.title = payload.replace(/_/g, "");
    return entry;
  }

  const parsed = safeJsonParse(payload);
  if (!parsed) return entry;

  entry.parsed = parsed;
  entry.command = parsed.Command;
  entry.commandLabel =
    parsed.Command === undefined
      ? ""
      : COMMAND_LABELS[parsed.Command] || `Command ${parsed.Command}`;
  entry.result = parsed.Result;
  entry.seq = parsed.Seq;
  entry.serial = parsed.Serial;
  entry.nextState = parsed.NextState;
  entry.failure = parsed.FailureDetail;
  entry.aux = parseAuxiliar1(parsed.Auxiliar1);
  entry.deviceStatuses = normalizeDeviceStatus(parsed.Info?.Status);

  const buffers = Array.isArray(parsed.Buffer)
    ? Object.fromEntries(parsed.Buffer.map((item) => [item.Key, item.Value]))
    : {};
  entry.buffers = buffers;
  entry.event = parsed.Event || null;
  entry.logMsg = parsed.LogMsg || "";
  entry.eventData = parseLooseJson(parsed.Event?.Data) || null;
  entry.issue = Boolean(
    parsed.FailureDetail ||
    Number(parsed.Result) > 1 ||
    Number(parsed.Event?.ErrorCode || 0) !== 0,
  );
  entry.issueReason = parsed.FailureDetail
    ? "FailureDetail"
    : Number(parsed.Result) > 1
      ? `Result ${parsed.Result}`
      : Number(parsed.Event?.ErrorCode || 0) !== 0
        ? `Event Error ${formatErrorCode(parsed.Event.ErrorCode)}`
        : "";

  if (parsed.Event) {
    entry.type = "event";
    const eventLabel = formatEventCode(parsed.Event.EventID);
    const errorLabel = Number(parsed.Event.ErrorCode || 0)
      ? `Error ${formatErrorCode(parsed.Event.ErrorCode)}`
      : "";
    const deviceId = parsed.DevName ?? parsed.Event.DeviceType;
    const deviceLabel =
      DEVICE_LABELS[deviceId] || `Dispositivo ${deviceId ?? "?"}`;
    entry.title = eventLabel ? `Evento ${eventLabel}` : "Evento";
    entry.subtitle = [
      deviceLabel,
      parsed.Event.EventMsg !== undefined ? `Msg ${parsed.Event.EventMsg}` : "",
      errorLabel,
    ]
      .filter(Boolean)
      .join(" | ");
  } else if (
    Object.keys(buffers).length ||
    parsed.LogMsg ||
    parsed.Command === 256
  ) {
    entry.type = "transaction";
    const transactionTitle = [
      buffers.TrxType ? `Trx ${buffers.TrxType}` : null,
      buffers.Ammount ? `$${buffers.Ammount}` : null,
      parsed.Serial ? `Serial ${parsed.Serial}` : null,
      parsed.NextState ? `Next ${parsed.NextState}` : null,
    ]
      .filter(Boolean)
      .join(" | ");
    entry.title =
      transactionTitle ||
      getReceiptTitle(parsed.LogMsg) ||
      entry.issueReason ||
      entry.commandLabel ||
      "Movimiento de transaccion";
    entry.subtitle = parsed.LogMsg
      ? String(parsed.LogMsg)
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean)[0]
      : "Movimiento de transaccion";
  } else if (parsed.Command === 5 && entry.aux) {
    entry.type = "config";
    entry.title = entry.aux.label;
    entry.subtitle = entry.aux.count
      ? `${entry.aux.count} elementos`
      : entry.aux.preview;
  } else {
    entry.type = "command";
    entry.title = entry.commandLabel;
    entry.subtitle = parsed.Result != null ? `Result ${parsed.Result}` : "";
  }

  entry.searchable = [
    entry.raw,
    entry.title,
    entry.subtitle,
    entry.commandLabel,
    entry.logMsg,
    entry.issueReason,
    entry.eventData ? JSON.stringify(entry.eventData) : "",
    entry.deviceStatuses
      .map((status) => `${status.label} ${status.error}`)
      .join(" "),
    Object.entries(buffers)
      .map(([key, value]) => `${key}:${value}`)
      .join(" "),
  ]
    .join(" ")
    .toLowerCase();

  return entry;
}

function formatWrappedLogTime(value) {
  const match = String(value || "").match(/\/Date\((\d+)(?:[+-]\d{4})?\)\//);
  if (!match) return null;
  const date = new Date(Number(match[1]));
  if (Number.isNaN(date.getTime())) return null;
  const pad = (part, size = 2) => String(part).padStart(size, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(
    date.getMilliseconds(),
    3,
  )}`;
}

function unwrapSignedLogLine(line) {
  const text = normalizeLogLine(line);
  if (!text.startsWith("{")) return null;

  try {
    const wrapped = JSON.parse(text);
    const inner = wrapped?.Data?.Data;
    if (typeof inner !== "string") return null;

    const innerText = inner.trim();
    if (LINE_RE.test(innerText)) return innerText;

    const time = formatWrappedLogTime(wrapped.Data.CreatedAt);
    if (!time || !/^\[[^\]]+\]\[[<>]\]-/.test(innerText)) return null;

    return `[${time}][INFO   ]-${innerText}`;
  } catch {
    return null;
  }
}

function isSignatureMetadataLine(line) {
  const text = normalizeLogLine(line);
  return text.startsWith('{"File"') && text.includes('"Signature"');
}

function parseLogText(text, fileName) {
  const entries = [];
  let current = null;

  const flushCurrent = () => {
    if (!current) return;
    entries.push(parseLogLine(current.text, current.lineNumber, fileName));
    current = null;
  };

  text.split(/\r?\n/).forEach((line, index) => {
    const lineNumber = index + 1;
    const normalizedLine = normalizeLogLine(line);
    if (!normalizedLine && !current) return;

    const unwrappedLine = unwrapSignedLogLine(line);
    if (unwrappedLine) {
      flushCurrent();
      entries.push(parseLogLine(unwrappedLine, lineNumber, fileName));
      return;
    }

    if (isSignatureMetadataLine(line)) {
      flushCurrent();
      return;
    }

    if (LINE_RE.test(normalizedLine)) {
      flushCurrent();
      current = { text: normalizedLine, lineNumber };
      return;
    }

    if (current) {
      current.text = `${current.text}\n${line}`;
      return;
    }

    if (normalizedLine) {
      entries.push(parseLogLine(normalizedLine, lineNumber, fileName));
    }
  });

  flushCurrent();
  return entries;
}

function summarizeEntries(entries) {
  const summary = {
    lines: entries.length,
    json: entries.filter((entry) => entry.parsed).length,
    transactions: entries.filter((entry) => entry.type === "transaction")
      .length,
    events: entries.filter((entry) => entry.type === "event").length,
    issues: entries.filter((entry) => entry.issue || entry.type === "malformed")
      .length,
    online: entries.filter((entry) => entry.payload === "_ONLINE_").length,
    offline: entries.filter((entry) => entry.payload === "_OFFLINE_").length,
    ips: {},
  };

  entries.forEach((entry) => {
    if (entry.ip) summary.ips[entry.ip] = (summary.ips[entry.ip] || 0) + 1;
  });

  return summary;
}

function topPairs(obj, limit = 6) {
  return Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

function entryMatchesFilter(entry, filter) {
  if (filter === "all") return true;
  if (filter === "transactions") return entry.type === "transaction";
  if (filter === "events") return entry.type === "event";
  if (filter === "issues") return entry.issue || entry.type === "malformed";
  if (filter === "config") return entry.type === "config";
  if (filter === "markers") return entry.type === "marker";
  return true;
}

function timeToMinutes(value) {
  if (!value) return null;
  const [hours, minutes] = String(value).split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function entryTimeToMinutes(entry) {
  if (!entry.time) return null;
  return timeToMinutes(entry.time.slice(0, 5));
}

function entryTimeToMs(entry) {
  const match = String(entry.time || "").match(
    /^(\d{2}):(\d{2}):(\d{2})\.(\d{3})$/,
  );
  if (!match) return 0;
  const [, hours, minutes, seconds, ms] = match;
  return (
    ((Number(hours) * 60 + Number(minutes)) * 60 + Number(seconds)) * 1000 +
    Number(ms)
  );
}

function getBufferValue(entries, key) {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const value = entries[index].buffers?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return "";
}

function getReceiptTitle(logMsg = "") {
  const lines = String(logMsg)
    .split(/\r?\n|\r/)
    .map((line) => line.trim())
    .filter(Boolean);
  return (
    lines.find((line) => !/^\d{4}\//.test(line) && !line.includes("LOTE")) || ""
  );
}

function formatAccountType(value) {
  if (!value) return "";
  return ACCOUNT_LABELS[value] || value;
}

function formatResult(value) {
  if (value === "" || value === undefined || value === null) return "";
  return RESULT_LABELS[value]
    ? `${value} - ${RESULT_LABELS[value]}`
    : String(value);
}

function formatEventCode(value) {
  if (value === "" || value === undefined || value === null) return "";
  return EVENT_LABELS[value]
    ? `${value} - ${EVENT_LABELS[value]}`
    : String(value);
}

function formatErrorCode(value) {
  if (value === "" || value === undefined || value === null) return "";
  return ERROR_LABELS[String(value)]
    ? `${value} - ${ERROR_LABELS[String(value)]}`
    : String(value);
}

function formatFunctionCode(value) {
  if (value === "" || value === undefined || value === null) return "";
  return FUNCTION_LABELS[value]
    ? `${value} - ${FUNCTION_LABELS[value]}`
    : String(value);
}

function getFailureSummary(failure) {
  if (!failure) return "";
  const device =
    DEVICE_LABELS[failure.Name] || `Dispositivo ${failure.Name ?? "?"}`;
  const error =
    failure.Error !== undefined && failure.Error !== null
      ? `Error ${formatErrorCode(failure.Error)}`
      : "";
  return [device, error].filter(Boolean).join(" | ");
}

function getIssueLabel(entry) {
  if (!entry) return "";
  if (entry.issueReason) return entry.issueReason;
  if (ERROR_STATES.has(Number(entry.nextState)))
    return `NextState ${entry.nextState}`;
  return "";
}

function getEntryStep(entry) {
  if (!entry) return null;

  if (entry.type === "malformed") {
    return {
      entry,
      label: "Linea",
      title: "Formato no reconocido",
      detail: "Revisar payload original",
      tone: "issue",
    };
  }

  if (entry.event) {
    const deviceId = entry.parsed?.DevName ?? entry.event.DeviceType;
    const device = DEVICE_LABELS[deviceId] || `Dispositivo ${deviceId ?? "?"}`;
    const eventLabel = formatEventCode(entry.event.EventID);
    const errorLabel = Number(entry.event.ErrorCode || 0)
      ? `Error ${formatErrorCode(entry.event.ErrorCode)}`
      : "Error 0";
    return {
      entry,
      label: "Evento",
      title: `${device} reporto ${eventLabel || "evento"}`,
      detail: `Msg ${entry.event.EventMsg ?? "-"} | ${errorLabel}`,
      tone: Number(entry.event.ErrorCode || 0) !== 0 ? "issue" : "event",
    };
  }

  if (
    entry.direction === ">" &&
    entry.buffers &&
    Object.keys(entry.buffers).length
  ) {
    const trx = entry.buffers.TrxType || "Operacion";
    const facts = [
      entry.buffers.AccType
        ? `Cuenta ${formatAccountType(entry.buffers.AccType)}`
        : "",
      entry.buffers.Ammount ? `$${entry.buffers.Ammount}` : "",
      entry.buffers.MnuType ? `Menu ${entry.buffers.MnuType}` : "",
    ].filter(Boolean);
    return {
      entry,
      label: "Cajero",
      title: `Solicita ${trx}`,
      detail: facts.length ? facts.join(" | ") : "Envia buffers de operacion",
      tone: "atm",
    };
  }

  if (entry.direction === "<" && entry.command === 256) {
    const functionLabels = (entry.parsed?.FunctionCommands || [])
      .map((command) => formatFunctionCode(command.FunctionID))
      .filter(Boolean);
    const facts = [
      entry.nextState ? `NextState ${entry.nextState}` : "",
      entry.serial ? `Serial ${entry.serial}` : "",
      entry.logMsg ? "Incluye recibo" : "",
      functionLabels.length ? `Funciones ${functionLabels.join(", ")}` : "",
    ].filter(Boolean);
    return {
      entry,
      label: "Servidor",
      title: "Responde la transaccion",
      detail: facts.join(" | ") || "Respuesta host",
      tone: ERROR_STATES.has(Number(entry.nextState)) ? "issue" : "host",
    };
  }

  if (entry.direction === ">" && entry.result !== undefined) {
    return {
      entry,
      label: "Cajero",
      title: "Confirma resultado",
      detail: [
        `Result ${formatResult(entry.result)}`,
        entry.failure ? getFailureSummary(entry.failure) : "",
      ]
        .filter(Boolean)
        .join(" | "),
      tone: Number(entry.result) > 1 || entry.failure ? "issue" : "atm",
    };
  }

  if (entry.type === "marker") {
    return {
      entry,
      label: "Conexion",
      title: entry.title,
      detail: getDirectionLabel(entry.direction),
      tone: "marker",
    };
  }

  return {
    entry,
    label: entry.direction === "<" ? "Servidor" : "Cajero",
    title: entry.title || entry.commandLabel || "Mensaje",
    detail:
      entry.subtitle ||
      entry.commandLabel ||
      getDirectionLabel(entry.direction),
    tone: entry.issue ? "issue" : "message",
  };
}

function buildSessionSteps(session) {
  if (!session) return [];
  return session.entries
    .map(getEntryStep)
    .filter(Boolean)
    .filter((step, index, list) => {
      const previous = list[index - 1];
      return (
        !previous ||
        previous.title !== step.title ||
        previous.detail !== step.detail
      );
    });
}

function getSessionReceiptText(session) {
  return (session?.entries || [])
    .flatMap((entry) => [
      entry.logMsg,
      ...(entry.parsed?.FunctionCommands || []).map((command) => command?.Data),
    ])
    .filter(Boolean)
    .join("\n");
}

function getFailureDataSummary(failure) {
  const data = parseLooseJson(failure?.Data);
  if (!data) return "";
  const parts = [];
  if (data.State !== undefined) parts.push(`Estado entrega ${data.State}`);
  const denos = data.DenoDist?.Denomination || data.Denomination;
  if (Array.isArray(denos)) {
    const cash = denos
      .filter((item) => Number(item.DenoCount) > 0)
      .map((item) => `${item.DenoValue}x${item.DenoCount}`)
      .join(", ");
    if (cash) parts.push(`Denominacion ${cash}`);
  }
  return parts.join(" | ");
}

function diagnoseSession(session) {
  const entries = session?.entries || [];
  const failureEntry = entries.find((entry) => entry.failure);
  const resultFaultEntry = entries.find((entry) => Number(entry.result) > 1);
  const eventErrorEntry = entries.find(
    (entry) => Number(entry.event?.ErrorCode || 0) !== 0,
  );
  const errorStateEntry = entries.find((entry) =>
    ERROR_STATES.has(Number(entry.nextState)),
  );
  const hostResponse = entries.find(
    (entry) => entry.direction === "<" && entry.command === 256,
  );
  const confirmation = entries.find(
    (entry) => entry.direction === ">" && entry.result !== undefined,
  );
  const receiptText = getSessionReceiptText(session);
  const receiptLower = receiptText.toLowerCase();
  const noTaken =
    /cliente no tom|no tomo|no tomÃ³|no tomó|no retiro|no retir/.test(
      receiptLower,
    );
  const reversal = /revers|solicitado|dispensed/.test(receiptLower);
  const cashBreakdown = /\bcash\s*:/.test(receiptLower);
  const failure = failureEntry?.failure;
  const device = failure
    ? DEVICE_LABELS[failure.Name] || `Dispositivo ${failure.Name ?? "?"}`
    : "";
  const failureData = getFailureDataSummary(failure);
  const evidence = [];
  const review = [];

  if (failure) {
    evidence.push(`FailureDetail: ${getFailureSummary(failure)}`);
    if (failureData) evidence.push(failureData);
  }
  if (resultFaultEntry)
    evidence.push(`Result ${formatResult(resultFaultEntry.result)}`);
  if (errorStateEntry) evidence.push(`NextState ${errorStateEntry.nextState}`);
  if (eventErrorEntry) {
    evidence.push(
      `Event ${formatEventCode(eventErrorEntry.event.EventID)} | Error ${formatErrorCode(
        eventErrorEntry.event.ErrorCode,
      )}`,
    );
  }
  if (noTaken) evidence.push("El recibo/texto indica dinero no tomado");
  if (reversal) evidence.push("Hay texto de reverso o solicitado en el recibo");
  if (cashBreakdown) evidence.push("Recibo incluye desglose de efectivo CASH");
  if (!hostResponse)
    evidence.push("No se encontro respuesta del servidor en la secuencia");
  if (!confirmation)
    evidence.push("No se encontro confirmacion final del cajero");

  if (failure) {
    if ([3, 6].includes(Number(failure.Name))) {
      review.push("Revisar dispensador/CDM y presenter.");
      review.push(
        "Comparar monto solicitado contra denominaciones y CASH del recibo.",
      );
      review.push("Validar reject/retract y conteos del cajero.");
      return {
        severity: noTaken ? "critical" : "high",
        title: noTaken ? "Cliente no tomo dinero" : "Falla de dispensador",
        cause:
          "El servidor trata Result Fault con FailureDetail como DeviceFault; en CDM decide reverso, presentacion o dinero no tomado segun error y estado de entrega.",
        confidence: "Alta",
        evidence,
        review,
      };
    }

    if (Number(failure.Name) === 1) {
      review.push("Revisar lector de tarjeta/chip y retiro de tarjeta.");
      review.push(
        "Validar si hubo timeout o falla de chip en el dispositivo IDC.",
      );
      return {
        severity: "high",
        title: "Falla de lector de tarjeta",
        cause:
          "DeviceFault separa las fallas IDC de las fallas de efectivo y fuerza reverso total cuando aplica.",
        confidence: "Alta",
        evidence,
        review,
      };
    }

    if (Number(failure.Name) === 4) {
      review.push("Revisar impresora/recibo y cola de impresion.");
      return {
        severity: "medium",
        title: "Falla de impresora",
        cause: `El payload de confirmacion trae FailureDetail.Name=4 (${device}) y Error ${formatErrorCode(
          failure.Error,
        )}; el visor lo clasifica usando el mapa de dispositivos del proyecto.`,
        confidence: "Alta",
        evidence,
        review,
      };
    }

    review.push(`Revisar ${device}.`);
    review.push("Abrir payload tecnico para ver Error y Data del dispositivo.");
    return {
      severity: "high",
      title: `Falla de dispositivo: ${device}`,
      cause:
        "El cajero devolvio FailureDetail dentro de una confirmacion con problema.",
      confidence: "Alta",
      evidence,
      review,
    };
  }

  if (resultFaultEntry) {
    review.push("Revisar payload de confirmacion del cajero.");
    review.push("Buscar eventos del mismo dispositivo alrededor de la hora.");
    return {
      severity: "high",
      title: "Resultado de cajero con atencion",
      cause:
        "El cajero confirmo Result mayor a 1, equivalente a un resultado Fault/atencion aunque no vino FailureDetail.",
      confidence: "Media",
      evidence,
      review,
    };
  }

  if (eventErrorEntry) {
    const eventDevice =
      DEVICE_LABELS[
        eventErrorEntry.parsed?.DevName ?? eventErrorEntry.event.DeviceType
      ] ||
      `Dispositivo ${eventErrorEntry.parsed?.DevName ?? eventErrorEntry.event.DeviceType ?? "?"}`;
    review.push(`Revisar evento del ${eventDevice}.`);
    return {
      severity: "medium",
      title: `Evento ${formatEventCode(eventErrorEntry.event.EventID)}`,
      cause:
        "EDCService guarda EventID, DeviceType y ErrorCode como evento estructurado; ErrorCode distinto de cero requiere revision segun el manual de eventos/errores.",
      confidence: "Alta",
      evidence,
      review,
    };
  }

  if (errorStateEntry) {
    review.push(
      "Revisar flujo XML para ErrorState, TimeoutState o CancelState.",
    );
    review.push("Comparar el NextState con el modulo de Flujos.");
    return {
      severity: "medium",
      title: "Flujo enviado a estado de error",
      cause:
        "La respuesta del servidor apunta a un estado reservado para error, timeout o cancelacion.",
      confidence: "Media",
      evidence,
      review,
    };
  }

  if (!hostResponse || !confirmation) {
    review.push("Revisar eventos cercanos de la misma IP.");
    review.push(
      "Confirmar si la secuencia continuo con otro log o si hubo desconexion.",
    );
    return {
      severity: "medium",
      title: "Secuencia incompleta",
      cause:
        "Para una transaccion completa normalmente se espera solicitud, respuesta del servidor y confirmacion del cajero.",
      confidence: "Media",
      evidence,
      review,
    };
  }

  return null;
}

function buildLogSessions(entries) {
  const groups = new Map();

  entries.forEach((entry) => {
    const seq = Number(entry.seq);
    if (!entry.ip || !Number.isFinite(seq) || seq <= 0) return;

    const key = `${entry.fileName}|${entry.ip}|${entry.seq}`;
    if (!groups.has(key)) {
      groups.set(key, {
        id: key,
        fileName: entry.fileName,
        ip: entry.ip,
        seq: entry.seq,
        entries: [],
      });
    }
    groups.get(key).entries.push(entry);
  });

  return Array.from(groups.values()).map((session) => {
    const entriesInOrder = [...session.entries].sort(
      (a, b) => a.index - b.index,
    );
    const first = entriesInOrder[0];
    const last = entriesInOrder[entriesInOrder.length - 1];
    const hostResponse = [...entriesInOrder]
      .reverse()
      .find((entry) => entry.direction === "<" && entry.command === 256);
    const confirmation = [...entriesInOrder]
      .reverse()
      .find((entry) => entry.direction === ">" && entry.result !== undefined);
    const issueEntry =
      entriesInOrder.find((entry) => entry.issue) ||
      entriesInOrder.find((entry) =>
        ERROR_STATES.has(Number(entry.nextState)),
      ) ||
      null;
    const logEntry = entriesInOrder.find((entry) => entry.logMsg);
    const trxType = getBufferValue(entriesInOrder, "TrxType");
    const amount = getBufferValue(entriesInOrder, "Ammount");
    const accType = getBufferValue(entriesInOrder, "AccType");
    const serial =
      hostResponse?.serial || confirmation?.serial || last?.serial || "";
    const nextState = hostResponse?.nextState || "";
    const result = confirmation?.result ?? "";
    const issueLabel = getIssueLabel(issueEntry);
    const failureSummary = getFailureSummary(issueEntry?.failure);
    const operationTitle = [trxType, getReceiptTitle(logEntry?.logMsg)]
      .filter(Boolean)
      .join(" - ");
    const titleParts = [
      operationTitle || "Operacion",
      amount ? `$${amount}` : "",
      serial ? `Serial ${serial}` : "",
    ].filter(Boolean);

    const summaryParts = [
      first?.time && last?.time
        ? `${first.time} - ${last.time}`
        : first?.time || "",
      accType ? `Cuenta ${formatAccountType(accType)}` : "",
      nextState ? `Next ${nextState}` : "",
      result !== "" ? `Result ${formatResult(result)}` : "",
    ].filter(Boolean);

    const sessionSummary = {
      ...session,
      entries: entriesInOrder,
      firstEntry: first,
      lastEntry: last,
      primaryEntry:
        issueEntry || hostResponse || logEntry || confirmation || first,
      startTime: first?.time || "",
      endTime: last?.time || "",
      trxType,
      amount,
      accType,
      serial,
      nextState,
      result,
      issue: Boolean(issueLabel),
      issueLabel,
      failureSummary,
      title: titleParts.join(" | "),
      subtitle: summaryParts.join(" | "),
      receiptTitle: getReceiptTitle(logEntry?.logMsg),
      searchable: entriesInOrder.map((entry) => entry.searchable).join(" "),
    };
    return {
      ...sessionSummary,
      diagnosis: diagnoseSession(sessionSummary),
    };
  });
}

function sessionMatchesDynamicFilter(session, mode, value, valueTo) {
  if (mode === "timeRange") {
    return session.entries.some((entry) =>
      entryMatchesDynamicFilter(entry, mode, value, valueTo),
    );
  }

  const query = String(value || "")
    .trim()
    .toLowerCase();
  if (!query) return true;

  const values = {
    text: session.searchable,
    ip: session.ip,
    command: session.entries
      .map((entry) => `${entry.command ?? ""} ${entry.commandLabel ?? ""}`)
      .join(" "),
    result: session.result,
    trx: session.trxType,
    amount: session.amount,
    serial: session.serial,
    state: session.nextState,
    event: session.entries.map((entry) => entry.event?.EventID ?? "").join(" "),
    device: session.entries
      .map(
        (entry) => `${entry.event?.DeviceType ?? ""} ${entry.subtitle ?? ""}`,
      )
      .join(" "),
  };

  return String(values[mode] ?? "")
    .toLowerCase()
    .includes(query);
}

function sessionMatchesFilter(session, filter) {
  if (filter === "all" || filter === "transactions") return true;
  if (filter === "issues") return session.issue;
  return session.entries.some((entry) => entryMatchesFilter(entry, filter));
}

function describeSession(session) {
  if (!session) return "";
  const pieces = [];
  if (session.trxType) {
    pieces.push(
      session.amount
        ? `El cajero solicito ${session.trxType} por $${session.amount}.`
        : `El cajero solicito ${session.trxType}.`,
    );
  } else {
    pieces.push("Operacion agrupada por secuencia del cajero.");
  }
  if (session.nextState)
    pieces.push(`El servidor respondio NextState ${session.nextState}.`);
  if (session.result !== "") {
    pieces.push(
      `La confirmacion volvio con Result ${formatResult(session.result)}.`,
    );
  }
  if (session.issueLabel) {
    pieces.push(
      `Punto de atencion: ${[session.issueLabel, session.failureSummary]
        .filter(Boolean)
        .join(" | ")}.`,
    );
  }
  return pieces.join(" ");
}

function entryMatchesDynamicFilter(entry, mode, value, valueTo) {
  if (mode === "timeRange") {
    const entryMinutes = entryTimeToMinutes(entry);
    const from = timeToMinutes(value);
    const to = timeToMinutes(valueTo);
    if (entryMinutes == null) return false;
    if (from != null && entryMinutes < from) return false;
    if (to != null && entryMinutes > to) return false;
    return true;
  }

  const query = String(value || "")
    .trim()
    .toLowerCase();
  if (!query) return true;

  const values = {
    text: entry.searchable,
    ip: entry.ip,
    command: `${entry.command ?? ""} ${entry.commandLabel ?? ""}`,
    result: entry.result,
    trx: entry.buffers?.TrxType,
    amount: entry.buffers?.Ammount,
    serial: entry.serial,
    state: entry.nextState,
    event: entry.event?.EventID,
    device: `${entry.event?.DeviceType ?? entry.parsed?.DevName ?? ""} ${entry.subtitle ?? ""} ${
      entry.deviceStatuses?.map((status) => status.label).join(" ") ?? ""
    }`,
  };

  return String(values[mode] ?? "")
    .toLowerCase()
    .includes(query);
}

function JsonViewer({ value }) {
  return (
    <pre className="logs-json-viewer">
      <JsonNode value={value} depth={0} />
    </pre>
  );
}

function JsonNode({ value, depth }) {
  if (value === null) return <span className="json-null">null</span>;
  if (typeof value === "string") {
    return <span className="json-string">{JSON.stringify(value)}</span>;
  }
  if (typeof value === "number")
    return <span className="json-number">{value}</span>;
  if (typeof value === "boolean") {
    return <span className="json-boolean">{String(value)}</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="json-punctuation">[]</span>;
    return (
      <span>
        <span className="json-punctuation">[</span>
        {value.map((item, index) => (
          <span
            className="json-line"
            style={{ paddingLeft: (depth + 1) * 10 }}
            key={index}
          >
            <JsonNode value={item} depth={depth + 1} />
            {index < value.length - 1 ? (
              <span className="json-punctuation">,</span>
            ) : null}
          </span>
        ))}
        <span className="json-line" style={{ paddingLeft: depth * 10 }}>
          <span className="json-punctuation">]</span>
        </span>
      </span>
    );
  }

  const entries = Object.entries(value || {});
  if (entries.length === 0)
    return <span className="json-punctuation">{"{}"}</span>;
  return (
    <span>
      <span className="json-punctuation">{"{"}</span>
      {entries.map(([key, item], index) => (
        <span
          className="json-line"
          style={{ paddingLeft: (depth + 1) * 10 }}
          key={key}
        >
          <span className="json-key">"{key}"</span>
          <span className="json-punctuation">: </span>
          <JsonNode value={item} depth={depth + 1} />
          {index < entries.length - 1 ? (
            <span className="json-punctuation">,</span>
          ) : null}
        </span>
      ))}
      <span className="json-line" style={{ paddingLeft: depth * 10 }}>
        <span className="json-punctuation">{"}"}</span>
      </span>
    </span>
  );
}

function ReceiptBlock({ text }) {
  const lines = String(text || "")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(
      (line, index, list) =>
        line.trim() || (index > 0 && index < list.length - 1),
    );

  return (
    <div className="logs-receipt" role="group" aria-label="Texto de recibo">
      {lines.map((line, index) => {
        const clean = line.trim();
        const className = [
          "receipt-line",
          index === 0 ? "receipt-head" : "",
          /TRANS\./i.test(clean) ? "receipt-title" : "",
          /\$\s*[\d,.]+/.test(clean) ? "receipt-amount" : "",
          /LOTE/i.test(clean) ? "receipt-separator" : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <span key={`${line}-${index}`} className={className}>
            {clean || " "}
          </span>
        );
      })}
    </div>
  );
}

function CodeSection({ title, items }) {
  return (
    <section className="logs-code-section">
      <h4>{title}</h4>
      <div className="logs-code-list">
        {items.map(([code, label]) => (
          <div className="logs-code-row" key={`${title}-${code}`}>
            <code>{code}</code>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function CodeGuide() {
  const directionItems = [
    [">", "Cajero a servidor"],
    ["<", "Servidor a cajero"],
  ];
  const eventItems = GUIDE_EVENT_CODES.map((code) => [
    code,
    EVENT_LABELS[code],
  ]);
  const errorItems = GUIDE_ERROR_CODES.map((code) => [
    code,
    ERROR_LABELS[code],
  ]);

  return (
    <div className="logs-code-guide">
      <div className="logs-code-guide-head">
        <strong>Codigos</strong>
        <span>Referencia EVA/XFS del servidor y manuales fISa</span>
      </div>
      <div className="logs-code-note">
        <span>
          <strong>ErrorCode 0</strong> es informativo. Los errores negativos
          vienen del dispositivo; los completion codes explican cierre de
          dispensacion.
        </span>
      </div>
      <div className="logs-code-grid">
        <CodeSection title="Direccion" items={directionItems} />
        <CodeSection title="Resultados" items={Object.entries(RESULT_LABELS)} />
        <CodeSection title="Comandos" items={Object.entries(COMMAND_LABELS)} />
        <CodeSection
          title="Dispositivos"
          items={Object.entries(DEVICE_LABELS)}
        />
        <CodeSection
          title="Funciones ATM"
          items={Object.entries(FUNCTION_LABELS)}
        />
        <CodeSection title="Eventos" items={eventItems} />
        <CodeSection title="Errores" items={errorItems} />
        <CodeSection
          title="Completion"
          items={Object.entries(COMPLETION_LABELS)}
        />
      </div>
    </div>
  );
}

export default function LogsPanel({ logsState, onLogsStateChange, notify }) {
  const [folderInput, setFolderInput] = useState(logsState?.folderInput || "");
  const [folderPath, setFolderPath] = useState(logsState?.folderPath || null);
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(
    logsState?.selectedFile || null,
  );
  const [entries, setEntries] = useState([]);
  const [activeFilter, setActiveFilter] = useState(
    logsState?.activeFilter || "all",
  );
  const [filterMode, setFilterMode] = useState(logsState?.filterMode || "text");
  const [filterValue, setFilterValue] = useState(logsState?.filterValue || "");
  const [filterValueTo, setFilterValueTo] = useState(
    logsState?.filterValueTo || "",
  );
  const [fileSortDirection, setFileSortDirection] = useState(
    logsState?.fileSortDirection || "desc",
  );
  const [entrySortDirection, setEntrySortDirection] = useState(
    logsState?.entrySortDirection || "asc",
  );
  const [viewMode, setViewMode] = useState(logsState?.viewMode || "sessions");
  const [selectedEntryId, setSelectedEntryId] = useState(null);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [showCodeGuide, setShowCodeGuide] = useState(false);
  const [loading, setLoading] = useState(false);
  const listRef = useRef(null);
  const [listViewport, setListViewport] = useState({ scrollTop: 0, height: 0 });

  const resetFilters = () => {
    setActiveFilter("all");
    setFilterMode("text");
    setFilterValue("");
    setFilterValueTo("");
  };

  useEffect(() => {
    onLogsStateChange?.({
      folderInput,
      folderPath,
      selectedFile,
      activeFilter,
      filterMode,
      filterValue,
      filterValueTo,
      fileSortDirection,
      entrySortDirection,
      viewMode,
    });
  }, [
    folderInput,
    folderPath,
    selectedFile,
    activeFilter,
    filterMode,
    filterValue,
    filterValueTo,
    fileSortDirection,
    entrySortDirection,
    viewMode,
    onLogsStateChange,
  ]);

  const loadFolder = async (pathToLoad = folderInput) => {
    const cleanPath = pathToLoad?.trim();
    if (!cleanPath) return;

    const result = await window.electronAPI?.readLogFolder?.(cleanPath);
    if (!result?.success) {
      notify?.("error", result?.error || "No se pudo leer la carpeta de logs.");
      return;
    }

    setFolderPath(cleanPath);
    setFolderInput(cleanPath);
    setFiles(result.files || []);

    const firstFile = result.files?.[0]?.name || null;
    setSelectedFile((current) =>
      current && result.files?.some((file) => file.name === current)
        ? current
        : firstFile,
    );

    if (!result.files?.length) {
      setEntries([]);
      notify?.("warning", "La carpeta no contiene archivos .txt.");
    }
  };

  const selectFolder = async () => {
    const folder = await window.electronAPI?.openFolderDialog?.();
    if (folder) {
      setFolderInput(folder);
      await loadFolder(folder);
    }
  };

  useEffect(() => {
    if (folderPath && files.length === 0) {
      loadFolder(folderPath);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const loadSelectedFile = async () => {
      if (!selectedFile || !folderPath) {
        setEntries([]);
        return;
      }

      const file = files.find((item) => item.name === selectedFile);
      if (!file) return;

      setLoading(true);
      const result = await window.electronAPI?.readFile?.(file.path);
      if (result?.success) {
        const parsedEntries = parseLogText(result.data || "", file.name);
        setEntries(parsedEntries);
        setSelectedEntryId(parsedEntries[0]?.id || null);
        setSelectedSessionId(null);
      } else {
        setEntries([]);
        notify?.("error", result?.error || "No se pudo abrir el log.");
      }
      setLoading(false);
    };

    loadSelectedFile();
  }, [selectedFile, folderPath, files, notify]);

  const summary = useMemo(() => summarizeEntries(entries), [entries]);
  const allSessions = useMemo(() => buildLogSessions(entries), [entries]);
  const sortedFiles = useMemo(
    () =>
      [...files].sort((a, b) =>
        fileSortDirection === "asc"
          ? a.lastModified - b.lastModified
          : b.lastModified - a.lastModified,
      ),
    [files, fileSortDirection],
  );
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      return entryMatchesDynamicFilter(
        entry,
        filterMode,
        filterValue,
        filterValueTo,
      );
    });
  }, [entries, filterMode, filterValue, filterValueTo]);
  const sortedEntries = useMemo(
    () =>
      [...filteredEntries].sort((a, b) => {
        const timeDiff = entryTimeToMs(a) - entryTimeToMs(b);
        const directionDiff =
          entrySortDirection === "asc" ? timeDiff : -timeDiff;
        if (directionDiff !== 0) return directionDiff;
        return a.index - b.index;
      }),
    [filteredEntries, entrySortDirection],
  );
  const filteredSessions = useMemo(() => {
    return allSessions.filter((session) => {
      return sessionMatchesDynamicFilter(
        session,
        filterMode,
        filterValue,
        filterValueTo,
      );
    });
  }, [allSessions, filterMode, filterValue, filterValueTo]);
  const sortedSessions = useMemo(
    () =>
      [...filteredSessions].sort((a, b) => {
        const timeDiff =
          entryTimeToMs(a.firstEntry) - entryTimeToMs(b.firstEntry);
        const directionDiff =
          entrySortDirection === "asc" ? timeDiff : -timeDiff;
        if (directionDiff !== 0) return directionDiff;
        return (a.firstEntry?.index || 0) - (b.firstEntry?.index || 0);
      }),
    [filteredSessions, entrySortDirection],
  );
  const rowHeight =
    viewMode === "sessions" ? LOG_SESSION_ROW_HEIGHT : LOG_ENTRY_ROW_HEIGHT;
  const displayItems = viewMode === "sessions" ? sortedSessions : sortedEntries;
  const virtualStart = Math.max(
    0,
    Math.floor(listViewport.scrollTop / rowHeight) - LOG_ENTRY_OVERSCAN,
  );
  const virtualEnd = Math.min(
    displayItems.length,
    Math.ceil((listViewport.scrollTop + listViewport.height) / rowHeight) +
      LOG_ENTRY_OVERSCAN,
  );
  const virtualItems = displayItems.slice(virtualStart, virtualEnd);
  const virtualHeight = displayItems.length * rowHeight;

  const selectedSession = useMemo(
    () =>
      sortedSessions.find((session) => session.id === selectedSessionId) ||
      sortedSessions[0] ||
      null,
    [sortedSessions, selectedSessionId],
  );

  const selectedEntry = useMemo(() => {
    if (viewMode === "sessions" && selectedSession) {
      return (
        selectedSession.entries.find((entry) => entry.id === selectedEntryId) ||
        selectedSession.firstEntry ||
        selectedSession.primaryEntry
      );
    }
    return (
      sortedEntries.find((entry) => entry.id === selectedEntryId) ||
      sortedEntries[0] ||
      null
    );
  }, [viewMode, selectedSession, selectedEntryId, sortedEntries]);
  const selectedSessionSteps = useMemo(
    () => buildSessionSteps(selectedSession),
    [selectedSession],
  );
  const selectedFilterField =
    FILTER_FIELDS.find((field) => field.key === filterMode) || FILTER_FIELDS[0];

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const updateViewport = () => {
      setListViewport({ scrollTop: list.scrollTop, height: list.clientHeight });
    };

    updateViewport();
    const resizeObserver = new ResizeObserver(updateViewport);
    resizeObserver.observe(list);
    return () => resizeObserver.disconnect();
  }, [displayItems.length]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTop = 0;
    setListViewport({ scrollTop: 0, height: list.clientHeight });
  }, [
    selectedFile,
    activeFilter,
    filterMode,
    filterValue,
    filterValueTo,
    entrySortDirection,
    viewMode,
  ]);

  useEffect(() => {
    const list = listRef.current;
    if (!list || !selectedEntry) return;

    const selectedIndex =
      viewMode === "sessions"
        ? sortedSessions.findIndex(
            (session) => session.id === selectedSession?.id,
          )
        : sortedEntries.findIndex((entry) => entry.id === selectedEntry.id);
    if (selectedIndex < 0) return;

    const entryTop = selectedIndex * rowHeight;
    const entryBottom = entryTop + rowHeight;
    const viewportTop = list.scrollTop;
    const viewportBottom = viewportTop + list.clientHeight;

    if (entryTop < viewportTop || entryBottom > viewportBottom) {
      list.scrollTo({ top: Math.max(0, entryTop - rowHeight * 2) });
    }
  }, [
    selectedEntry?.id,
    selectedSession?.id,
    sortedEntries,
    sortedSessions,
    rowHeight,
    viewMode,
  ]);

  return (
    <div className="logs-layout">
      <aside className="logs-sidebar">
        <div className="logs-folder-row">
          <input
            className="logs-folder-input"
            value={folderInput}
            placeholder="Ruta de logs EVA..."
            onChange={(event) => setFolderInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") loadFolder();
            }}
          />
          <button
            className="logs-icon-btn"
            onClick={selectFolder}
            title="Seleccionar carpeta"
          >
            <FaFolderOpen />
          </button>
        </div>

        <div className="logs-sidebar-tools">
          <button
            type="button"
            className="logs-tool-btn"
            onClick={() => loadFolder(folderPath || folderInput)}
            disabled={!folderPath && !folderInput}
          >
            <FaRotateRight /> Refrescar
          </button>
          <button
            type="button"
            className="logs-tool-btn"
            onClick={() =>
              setFileSortDirection((current) =>
                current === "desc" ? "asc" : "desc",
              )
            }
            disabled={!files.length}
            title="Ordenar logs por fecha"
          >
            {fileSortDirection === "desc" ? (
              <FaSortAmountDown />
            ) : (
              <FaSortAmountUp />
            )}
            Fecha
          </button>
        </div>

        <div className="logs-file-list">
          {sortedFiles.map((file) => (
            <button
              key={file.path}
              className={`logs-file-item ${selectedFile === file.name ? "active" : ""}`}
              onClick={() => {
                if (selectedFile !== file.name) {
                  resetFilters();
                  setSelectedFile(file.name);
                }
              }}
            >
              <span className="logs-file-name">
                <FaFileAlt />
                {file.name}
              </span>
              <span className="logs-file-meta">
                {formatBytes(file.size)} | {formatDate(file.lastModified)}
              </span>
            </button>
          ))}
        </div>
      </aside>

      <main className="logs-main">
        <section className="logs-summary">
          <div className="logs-card">
            <span>Casos</span>
            <strong>{allSessions.length}</strong>
          </div>
          <div className="logs-card">
            <span>Lineas</span>
            <strong>{summary.lines}</strong>
          </div>
          <div className="logs-card">
            <span>Transacciones</span>
            <strong>{summary.transactions}</strong>
          </div>
          <div className="logs-card">
            <span>Eventos</span>
            <strong>{summary.events}</strong>
          </div>
          <div className={`logs-card ${summary.issues ? "warning" : ""}`}>
            <span>Alertas</span>
            <strong>{summary.issues}</strong>
          </div>
        </section>

        <section className="logs-filter-panel">
          <div className="logs-filter-header">
            <div>
              <h3>
                <FaFilter /> Filtros
              </h3>
            </div>
            <div className="logs-filter-actions">
              <button
                type="button"
                className={`logs-code-toggle ${showCodeGuide ? "active" : ""}`}
                onClick={() => setShowCodeGuide((current) => !current)}
                title="Entender codigos de comandos, eventos y dispositivos"
              >
                <FaQuestionCircle />
                Codigos
              </button>
            </div>
            <div className="logs-ip-chips">
              {topPairs(summary.ips, 3).map(([ip, count]) => (
                <button
                  key={ip}
                  type="button"
                  className="logs-chip logs-ip-chip"
                  title={`Filtrar por ${ip}`}
                  onClick={() => {
                    setActiveFilter("all");
                    setFilterMode("ip");
                    setFilterValue(ip);
                    setFilterValueTo("");
                  }}
                >
                  <span>{ip}</span>
                  <strong>{count}</strong>
                </button>
              ))}
            </div>
          </div>

          {showCodeGuide ? <CodeGuide /> : null}

          <div className="logs-filter-controls">
            <label>
              Filtrar por
              <select
                value={filterMode}
                onChange={(event) => {
                  setFilterMode(event.target.value);
                  setFilterValue("");
                  setFilterValueTo("");
                }}
              >
                {FILTER_FIELDS.map((field) => (
                  <option key={field.key} value={field.key}>
                    {field.label}
                  </option>
                ))}
              </select>
            </label>

            {filterMode === "timeRange" ? (
              <div className="logs-time-range">
                <div className="logs-time-group">
                  <span>Desde</span>
                  <input
                    inputMode="numeric"
                    value={(filterValue || "").split(":")[0] || ""}
                    onChange={(event) =>
                      setFilterValue((current) =>
                        mergeTimePart(current, "hours", event.target.value),
                      )
                    }
                    placeholder="HH"
                  />
                  <b>:</b>
                  <input
                    inputMode="numeric"
                    value={(filterValue || "").split(":")[1] || ""}
                    onChange={(event) =>
                      setFilterValue((current) =>
                        mergeTimePart(current, "minutes", event.target.value),
                      )
                    }
                    placeholder="MM"
                  />
                </div>
                <div className="logs-time-group">
                  <span>Hasta</span>
                  <input
                    inputMode="numeric"
                    value={(filterValueTo || "").split(":")[0] || ""}
                    onChange={(event) =>
                      setFilterValueTo((current) =>
                        mergeTimePart(current, "hours", event.target.value),
                      )
                    }
                    placeholder="HH"
                  />
                  <b>:</b>
                  <input
                    inputMode="numeric"
                    value={(filterValueTo || "").split(":")[1] || ""}
                    onChange={(event) =>
                      setFilterValueTo((current) =>
                        mergeTimePart(current, "minutes", event.target.value),
                      )
                    }
                    placeholder="MM"
                  />
                </div>
              </div>
            ) : (
              <label className="logs-filter-value">
                Valor
                <input
                  value={filterValue}
                  onChange={(event) => setFilterValue(event.target.value)}
                  placeholder={
                    selectedFilterField.placeholder || "Valor a buscar..."
                  }
                />
              </label>
            )}

            {(filterValue || filterValueTo) && (
              <button
                type="button"
                className="logs-filter-clear"
                onClick={() => {
                  setActiveFilter("all");
                  setFilterValue("");
                  setFilterValueTo("");
                }}
              >
                Limpiar
              </button>
            )}
          </div>
        </section>

        <div className="logs-content">
          <div className="logs-timeline">
            <div className="logs-list-toolbar">
              <div className="logs-view-toggle" aria-label="Modo de lectura">
                <button
                  type="button"
                  className={viewMode === "sessions" ? "active" : ""}
                  onClick={() => setViewMode("sessions")}
                >
                  Casos
                </button>
                <button
                  type="button"
                  className={viewMode === "lines" ? "active" : ""}
                  onClick={() => setViewMode("lines")}
                >
                  Lineas
                </button>
              </div>
              <span>{displayItems.length} items</span>
              <button
                type="button"
                className="logs-tool-btn compact"
                onClick={() =>
                  setEntrySortDirection((current) =>
                    current === "asc" ? "desc" : "asc",
                  )
                }
                title="Ordenar items por hora"
              >
                {entrySortDirection === "asc" ? (
                  <FaSortAmountUp />
                ) : (
                  <FaSortAmountDown />
                )}
                Hora
              </button>
            </div>
            <div
              className="logs-list-scroll"
              ref={listRef}
              onScroll={(event) =>
                setListViewport({
                  scrollTop: event.currentTarget.scrollTop,
                  height: event.currentTarget.clientHeight,
                })
              }
            >
              {loading ? (
                <div className="logs-empty">Analizando logs...</div>
              ) : null}
              {!loading && displayItems.length === 0 ? (
                <div className="logs-empty">
                  No hay eventos para este filtro.
                </div>
              ) : null}
              {!loading && displayItems.length > 0 ? (
                <div
                  className="logs-virtual-space"
                  style={{ height: virtualHeight }}
                >
                  {virtualItems.map((item, index) => (
                    <div
                      key={item.id}
                      className={`logs-virtual-row ${
                        viewMode === "sessions" ? "session-row" : ""
                      }`}
                      style={{
                        transform: `translateY(${(virtualStart + index) * rowHeight}px)`,
                      }}
                    >
                      {viewMode === "sessions" ? (
                        <button
                          className={`logs-session-item ${item.issue ? "issue" : ""} ${
                            selectedSession?.id === item.id ? "active" : ""
                          }`}
                          onClick={() => {
                            setSelectedSessionId(item.id);
                            setSelectedEntryId(
                              item.firstEntry?.id ||
                                item.primaryEntry?.id ||
                                null,
                            );
                          }}
                        >
                          <span className="logs-entry-top">
                            <span
                              className={`logs-entry-token ${item.issue ? "malformed" : "transaction"}`}
                            >
                              {item.issue ? "!" : "CAS"}
                            </span>
                            <span className="logs-entry-time">
                              <FaClock /> {item.startTime || "-"}
                            </span>
                            {item.issueLabel ? (
                              <span className="logs-entry-reason">
                                {item.issueLabel}
                              </span>
                            ) : null}
                          </span>
                          <span className="logs-session-title">
                            {item.title}
                          </span>
                          <span className="logs-entry-sub">
                            {item.ip} | Seq {item.seq} | {item.entries.length}{" "}
                            lineas
                          </span>
                        </button>
                      ) : (
                        <button
                          className={`logs-entry ${item.type} ${
                            item.issue || item.type === "malformed"
                              ? "issue"
                              : ""
                          } ${selectedEntry?.id === item.id ? "active" : ""}`}
                          onClick={() => setSelectedEntryId(item.id)}
                        >
                          <span className="logs-entry-top">
                            <span className={`logs-entry-token ${item.type}`}>
                              {ENTRY_TYPE_META[item.type]?.token || "LOG"}
                            </span>
                            <span className="logs-entry-time">
                              <FaClock /> {item.time || "-"}
                            </span>
                            {item.issueReason ? (
                              <span className="logs-entry-reason">
                                {item.issueReason}
                              </span>
                            ) : null}
                          </span>
                          <span className="logs-entry-title">
                            {item.title || item.commandLabel}
                          </span>
                          <span className="logs-entry-sub">
                            {item.fileName} | {item.ip || "sin IP"} |{" "}
                            {item.direction || "-"}
                            {item.subtitle ? ` | ${item.subtitle}` : ""}
                          </span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <aside className="logs-detail">
            {!selectedEntry ? (
              <div className="logs-empty">
                Selecciona una linea para ver el detalle.
              </div>
            ) : (
              <>
                <div className="logs-detail-header">
                  <div>
                    <h2>
                      {selectedEntry.title ||
                        selectedEntry.commandLabel ||
                        selectedEntry.issueReason ||
                        "Evento sin titulo"}
                    </h2>
                    <p className="logs-detail-time">
                      <FaClock />
                      {selectedEntry.time || "-"}
                    </p>
                  </div>
                  <span className={`logs-type-badge ${selectedEntry.type}`}>
                    {ENTRY_TYPE_META[selectedEntry.type]?.label ||
                      selectedEntry.type}
                  </span>
                </div>

                {viewMode === "sessions" && selectedSession ? (
                  <div className="logs-case-summary">
                    <p>{describeSession(selectedSession)}</p>
                    <div className="logs-case-facts">
                      <span>IP: {selectedSession.ip}</span>
                      <span>Seq: {selectedSession.seq}</span>
                      {selectedSession.serial ? (
                        <span>Serial: {selectedSession.serial}</span>
                      ) : null}
                      {selectedSession.trxType ? (
                        <span>Trx: {selectedSession.trxType}</span>
                      ) : null}
                      {selectedSession.amount ? (
                        <span>Monto: ${selectedSession.amount}</span>
                      ) : null}
                      {selectedSession.accType ? (
                        <span>
                          Cuenta: {formatAccountType(selectedSession.accType)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {viewMode === "sessions" && selectedSession?.diagnosis ? (
                  <div
                    className={`logs-diagnosis ${selectedSession.diagnosis.severity}`}
                  >
                    <div className="logs-diagnosis-head">
                      <div>
                        <span>Diagnostico</span>
                        <h3>{selectedSession.diagnosis.title}</h3>
                      </div>
                      <strong>{selectedSession.diagnosis.confidence}</strong>
                    </div>
                    <p>{selectedSession.diagnosis.cause}</p>
                    {selectedSession.diagnosis.evidence?.length ? (
                      <div className="logs-diagnosis-section">
                        <span>Evidencia</span>
                        <div className="logs-diagnosis-chips">
                          {selectedSession.diagnosis.evidence.map((item) => (
                            <code key={item}>{item}</code>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {selectedSession.diagnosis.review?.length ? (
                      <div className="logs-diagnosis-section">
                        <span>Revisar</span>
                        <ul>
                          {selectedSession.diagnosis.review.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {viewMode === "sessions" && selectedSessionSteps.length ? (
                  <div className="logs-route-panel">
                    <h3>Recorrido</h3>
                    <div className="logs-route-list">
                      {selectedSessionSteps.map((step, index) => (
                        <button
                          key={`${step.entry.id}-${index}`}
                          type="button"
                          className={`logs-route-step ${step.tone} ${
                            selectedEntry?.id === step.entry.id ? "active" : ""
                          }`}
                          onClick={() => setSelectedEntryId(step.entry.id)}
                        >
                          <span className="route-index">{index + 1}</span>
                          <span className="route-copy">
                            <strong>
                              {step.label}: {step.title}
                            </strong>
                            <small>{step.detail}</small>
                          </span>
                          <span className="route-time">
                            {step.entry.time || "-"}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="logs-detail-grid">
                  <span>IP</span>
                  <strong>{selectedEntry.ip || "-"}</strong>
                  <span>Direccion</span>
                  <strong>{getDirectionLabel(selectedEntry.direction)}</strong>
                </div>

                {selectedEntry.issueReason ? (
                  <div className="logs-alert-inline">
                    <span>Alerta</span>
                    <code>{selectedEntry.issueReason}</code>
                  </div>
                ) : null}

                {selectedEntry.buffers &&
                Object.keys(selectedEntry.buffers).length > 0 ? (
                  <div className="logs-detail-block">
                    <h3>Buffers</h3>
                    <div className="logs-buffer-chips">
                      {Object.entries(selectedEntry.buffers).map(
                        ([key, value]) => (
                          <span key={key} title={`${key}: ${String(value)}`}>
                            <strong>{key}</strong>
                            <code>{String(value ?? "")}</code>
                          </span>
                        ),
                      )}
                    </div>
                  </div>
                ) : null}

                {selectedEntry.logMsg ? (
                  <div className="logs-detail-block receipt-block">
                    <h3>Recibo</h3>
                    <ReceiptBlock text={selectedEntry.logMsg} />
                  </div>
                ) : null}

                <div className="logs-detail-block payload-block">
                  <h3>Payload</h3>
                  {selectedEntry.parsed ? (
                    <JsonViewer value={selectedEntry.parsed} />
                  ) : (
                    <pre>{selectedEntry.payload || selectedEntry.raw}</pre>
                  )}
                </div>
              </>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
