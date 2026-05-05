export const EVA_SNIPPET_DEFINITIONS = [
  {
    label: "State",
    detail: "Elemento State",
    info: "State base con Id, Type y Comment.",
    template: `<State Id="\${id}" Type="\${type}" Comment="\${comment}">\n\t\${0}\n</State>`,
    tagTemplate: `State Id="\${id}" Type="\${type}" Comment="\${comment}">\n\t\${0}\n</State>`,
  },
  {
    label: "state:select",
    detail: "SELECT con pantalla y botones",
    template: `<State Id="\${id}" Type="SELECT" Comment="\${comment}">\n\t<Param Key="Screen">\${screen}</Param>\n\t<Param Key="KeyAState">\${stateA}</Param>\n\t<Param Key="KeyBState">\${stateB}</Param>\n\t<Param Key="CancelState">900</Param>\n\t<Param Key="TimeoutState">900</Param>\n</State>`,
  },
  {
    label: "state:set",
    detail: "SET Buffer/Valor",
    template: `<State Id="\${id}" Type="SET" Comment="\${comment}">\n\t<Param Key="BuffName">\${buffer}</Param>\n\t<Param Key="BuffValue">\${value}</Param>\n\t<Param Key="GoodState">\${next}</Param>\n\t<Param Key="ErrorState">900</Param>\n</State>`,
  },
  {
    label: "state:setwhen",
    detail: "SETWHEN por valores",
    template: `<State Id="\${id}" Type="SETWHEN" Comment="\${comment}">\n\t<Param Key="WhenBuffer">\${whenBuffer}</Param>\n\t<Param Key="SetBuffer">\${setBuffer}</Param>\n\t<Param Key="When1">\${whenValue}</Param>\n\t<Param Key="Set1">\${setValue}</Param>\n\t<Param Key="GoodState">\${next}</Param>\n\t<Param Key="ErrorState">900</Param>\n</State>`,
  },
  {
    label: "state:switch",
    detail: "SWITCH por Buffer",
    template: `<State Id="\${id}" Type="SWITCH" Comment="\${comment}">\n\t<Param Key="Buffer">\${buffer}</Param>\n\t<Param Key="Mode">0</Param>\n\t<Param Key="Value1">\${value1}</Param>\n\t<Param Key="State1">\${state1}</Param>\n\t<Param Key="DefaultState">\${defaultState}</Param>\n\t<Param Key="ErrorState">900</Param>\n</State>`,
  },
  {
    label: "state:send",
    detail: "SEND transaccional",
    template: `<State Id="\${id}" Type="SEND" Comment="\${comment}">\n\t<Param Key="GoodState">\${next}</Param>\n\t<Param Key="ErrorState">900</Param>\n</State>`,
  },
  {
    label: "state:entry",
    detail: "ENTRY captura buffer",
    template: `<State Id="\${id}" Type="ENTRY" Comment="\${comment}">\n\t<Param Key="Screen">\${screen}</Param>\n\t<Param Key="Buffer">\${buffer}</Param>\n\t<Param Key="GoodState">\${next}</Param>\n\t<Param Key="CancelState">900</Param>\n\t<Param Key="TimeoutState">900</Param>\n</State>`,
  },
  {
    label: "state:pin",
    detail: "PIN desde pinpad",
    template: `<State Id="\${id}" Type="PIN" Comment="\${comment}">\n\t<Param Key="Screen">\${screen}</Param>\n\t<Param Key="Buffer">PIN</Param>\n\t<Param Key="MinLen">4</Param>\n\t<Param Key="MaxLen">4</Param>\n\t<Param Key="GoodState">\${next}</Param>\n\t<Param Key="ErrorState">900</Param>\n</State>`,
  },
  {
    label: "state:crd",
    detail: "CRD lector tarjeta",
    template: `<State Id="\${id}" Type="CRD" Comment="\${comment}">\n\t<Param Key="ReadFlags">11</Param>\n\t<Param Key="Screen">\${screen}</Param>\n\t<Param Key="Timeout">0</Param>\n\t<Param Key="GoodState">\${goodState}</Param>\n\t<Param Key="CardLessState">\${cardLessState}</Param>\n\t<Param Key="NoMatchState">\${noMatchState}</Param>\n\t<Param Key="TimeoutState">998</Param>\n\t<Param Key="ErrorState">900</Param>\n\t<Param Key="InvalidCardScreen">\${invalidCardScreen}</Param>\n\t<Param Key="RemoveCardScreen">\${removeCardScreen}</Param>\n</State>`,
  },
  {
    label: "state:crdsrc",
    detail: "CRDSRC origen tarjeta",
    template: `<State Id="\${id}" Type="CRDSRC" Comment="\${comment}">\n\t<Param Key="Chip">\${chipState}</Param>\n\t<Param Key="Track">\${trackState}</Param>\n</State>`,
  },
  {
    label: "state:end",
    detail: "END fin de flujo",
    template: `<State Id="\${id}" Type="END" Comment="\${comment}">\n\t<Param Key="Screen">\${screen}</Param>\n\t<Param Key="Timeout">5</Param>\n</State>`,
  },
  {
    label: "Screen",
    detail: "Elemento Screen",
    template: `<Screen Id="\${id}" Comment="\${comment}">\n\t<Param Key="Resource">\${resource}.html</Param>\n</Screen>`,
    tagTemplate: `Screen Id="\${id}" Comment="\${comment}">\n\t<Param Key="Resource">\${resource}.html</Param>\n</Screen>`,
  },
  {
    label: "Tran",
    detail: "Transaction",
    template: `<Tran Code="\${code}" Comment="\${comment}">\n\t<Param Key="OperCodeKey">\${operCode}</Param>\n\t<Param Key="NextStateContinue">\${next}</Param>\n</Tran>`,
    tagTemplate: `Tran Code="\${code}" Comment="\${comment}">\n\t<Param Key="OperCodeKey">\${operCode}</Param>\n\t<Param Key="NextStateContinue">\${next}</Param>\n</Tran>`,
  },
  {
    label: "TranMap",
    detail: "Mapeo de transaccion",
    template: `<TranMap Id="\${id}" Comment="\${comment}">\n\t<Param Key="OperationCodeKey">\${operCode}</Param>\n\t<Param Key="FieldName1">\${field}</Param>\n\t<Param Key="FieldValue1">\${value}</Param>\n</TranMap>`,
    tagTemplate: `TranMap Id="\${id}" Comment="\${comment}">\n\t<Param Key="OperationCodeKey">\${operCode}</Param>\n\t<Param Key="FieldName1">\${field}</Param>\n\t<Param Key="FieldValue1">\${value}</Param>\n</TranMap>`,
  },
  {
    label: "Error",
    detail: "Error por RetCode",
    template: `<Error RetCode="\${retCode}" Comment="\${comment}">\n\t<Param Key="NextState">\${state}</Param>\n</Error>`,
    tagTemplate: `Error RetCode="\${retCode}" Comment="\${comment}">\n\t<Param Key="NextState">\${state}</Param>\n</Error>`,
  },
  {
    label: "Param",
    detail: "Parametro XML",
    template: `<Param Key="\${key}">\${value}</Param>`,
    tagTemplate: `Param Key="\${key}">\${value}</Param>`,
  },
  ...[
    "Screen", "SelScreen", "GoodState", "ErrorState", "TimeoutState", "CancelState",
    "NoMatchState", "DefaultState", "Buffer", "BuffName", "BuffValue", "Mode",
    "WhenBuffer", "SetBuffer", "OperationCodeKey", "OperCodeKey", "NextStateContinue",
    "FieldName1", "FieldValue1", "Value1", "State1",
    "KeyAState", "KeyBState", "KeyCState", "KeyDState", "KeyFState",
    "KeyGState", "KeyHState", "KeyIState",
  ].map((key) => ({
    label: `param:${key}`,
    detail: "Param comun",
    template: `<Param Key="${key}">\${value}</Param>`,
  })),
];
