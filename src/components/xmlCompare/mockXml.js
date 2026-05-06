export const mockXmlLeft = `<?xml version="1.0" encoding="UTF-8"?>
<EVAConfig>
  <!-- Base bancaria productiva -->
  <General>
    <Param Key="CardLessState">79</Param>
    <Param Key="HostTimeout">30</Param>
    <Param Key="Currency">USD</Param>
  </General>
  <States>
    <State Id="79" Comment="Ingreso sin tarjeta">
      <Screen Id="SCR_CARDLESS" />
      <Next State="120" />
    </State>
    <State Id="120" Comment="Confirmacion">
      <Param Key="Retries">3</Param>
    </State>
  </States>
  <Transactions>
    <Tran Code="0100" Comment="Retiro">
      <Host>CORE01</Host>
    </Tran>
  </Transactions>
</EVAConfig>`;

export const mockXmlRight = `<?xml version="1.0" encoding="UTF-8"?>
<EVAConfig>
  <!-- Base bancaria homologacion -->
  <General>
    <Param Key="CardLessState">400</Param>
    <Param Key="HostTimeout">45</Param>
    <Param Key="Currency">USD</Param>
    <Param Key="AuditEnabled">true</Param>
  </General>
  <States>
    <State Id="120" Comment="Confirmacion">
      <Param Key="Retries">5</Param>
    </State>
    <State Id="79" Comment="Ingreso sin tarjeta">
      <Screen Id="SCR_CARDLESS_V2" />
      <Next State="120" />
    </State>
  </States>
  <Transactions>
    <Tran Code="0100" Comment="Retiro">
      <Host>CORE02</Host>
    </Tran>
    <Tran Code="0200" Comment="Consulta saldo">
      <Host>CORE02</Host>
    </Tran>
  </Transactions>
</EVAConfig>`;
