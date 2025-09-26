// src/utils/sidebarConfig.js
export const sidebarConfig = {
    States: {
        label: "States",
        childTag: "State",
        idAttr: "Id", // los hijos usan atributo Id
    },
    Screens: {
        label: "Screens",
        childTag: "Screen",
        idAttr: "Id",
    },
    Fits: {
        label: "Fits",
        childTag: "Fit",
        idAttr: "Id",
    },
    General: {
        label: "General",
        childTag: "Param", // solo parámetros
        idAttr: "Key", // cada Param tiene Key
        special: true, // se maneja como bloque único
    },
    Transactions: {
        label: "Transactions",
        childTag: "Tran",
        idAttr: "Code",
    },
    TranMaps: {
        label: "TranMaps",
        childTag: "TranMap",
        idAttr: "Id",
    },
    Errors: {
        label: "Errors",
        childTag: "Error",
        idAttr: "RetCode",
    },
};
