/* =============================================================================
   0001_base.sql — Esquema base del Salón de Belleza Zaira
   -----------------------------------------------------------------------------
   Aprobado por los dos el 5 nov 2026 (docs/DECISIONES.md, D-013 a D-016).
   Crea 13 tablas; 0002 crea RevisionVenta (extensión EXT-MV-U01). Total: 14.

   Fuente: ERS final, sección 3.4 (texto 3.4.1 a 3.4.4) y casos de uso.
   - Citas y Agenda (Persona A): tablas de su propuesta
     PROPUESTA_BD_ZAIRA_PARA_REVISION_IGNACIO.md, con los CHECK acordados.
   - Acceso, Servicios, Proveedores, Productos y Ventas (Ignacio).

   Reglas del equipo:
   - NO editar este archivo: ya está aprobado. Cualquier cambio va en una
     migración nueva (AAAAMMDD_HHMM_<inicial>_<descripcion>.sql). El ejecutor
     detecta si un archivo ya aplicado cambió y se detiene.
   - Nada se borra en cascada. Servicios, productos y proveedores se
     desactivan; citas se cancelan; ventas se anulan.

   Convenciones:
   - PK "Id"; FK "<Tabla>Id"; nombres de tabla del texto 3.4.2.
   - Estados guardados sin tilde; la interfaz los muestra con tilde.
   - Citas: DATE + TIME(0) con la fecha y hora que elige la persona.
   - Fecha y hora de registro (solicitudes y ventas): hora de Costa Rica
     calculada desde UTC con DATEADD(HOUR, -6, SYSUTCDATETIME()). Costa Rica
     está en UTC-6 todo el año, así que no depende de la zona horaria
     configurada en la computadora (D-015).
   - Teléfonos de Cliente y Proveedor: 8 dígitos seguidos, sin guion ni
     código de país; la interfaz los muestra como 8888-8888 (D-016).
   - Montos en colones: DECIMAL(10,2) por elemento y DECIMAL(12,2) en totales.
============================================================================= */

/* ---------------------------------------------------------------------------
   Administradora (MA-01, MA-02). Ignacio.
   ContrasenaHash guarda el hash bcrypt, nunca la contraseña.
   MA-01: no hay límite de intentos fallidos ni recuperación de contraseña.
--------------------------------------------------------------------------- */
CREATE TABLE dbo.Administradora (
    Id              INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Administradora PRIMARY KEY,
    Usuario         NVARCHAR(50)  NOT NULL CONSTRAINT UQ_Administradora_Usuario UNIQUE,
    ContrasenaHash  NVARCHAR(100) NOT NULL
);
GO

/* ---------------------------------------------------------------------------
   Cliente. Persona A. Sin cuentas: el teléfono identifica al cliente (3.4.4).
--------------------------------------------------------------------------- */
CREATE TABLE dbo.Cliente (
    Id                 INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Cliente PRIMARY KEY,
    Nombre             NVARCHAR(150) NOT NULL,
    Telefono           NVARCHAR(20)  NOT NULL CONSTRAINT UQ_Cliente_Telefono UNIQUE,
    CorreoElectronico  NVARCHAR(254) NULL,
    CONSTRAINT CK_Cliente_Telefono CHECK (Telefono LIKE N'[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]')
);
GO

/* ---------------------------------------------------------------------------
   Servicio (MS-01 a MS-05). Ignacio. Lo leen Citas (CitaServicio) y Ventas.
   PrecioAproximado: un solo monto, sin valores negativos. El catálogo avisa
   que el precio final puede variar según el tipo y el largo del cabello
   (MS-01, supuesto 1; D-014).
   Contrato con Citas: Id, Nombre, DuracionMinutos, PermiteDomicilio, Estado.
--------------------------------------------------------------------------- */
CREATE TABLE dbo.Servicio (
    Id                INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Servicio PRIMARY KEY,
    Nombre            NVARCHAR(100) NOT NULL,
    Descripcion       NVARCHAR(500) NOT NULL,
    PrecioAproximado  DECIMAL(10,2) NOT NULL,
    DuracionMinutos   INT           NOT NULL,
    PermiteDomicilio  BIT           NOT NULL CONSTRAINT DF_Servicio_PermiteDomicilio DEFAULT 0,
    Estado            NVARCHAR(15)  NOT NULL CONSTRAINT DF_Servicio_Estado DEFAULT N'Activo',
    CONSTRAINT CK_Servicio_Precio   CHECK (PrecioAproximado >= 0),
    CONSTRAINT CK_Servicio_Duracion CHECK (DuracionMinutos > 0),
    CONSTRAINT CK_Servicio_Estado   CHECK (Estado IN (N'Activo', N'Desactivado'))
);
GO

/* ---------------------------------------------------------------------------
   Proveedor (MPV-01 a MPV-04). Ignacio.
   Nombre, teléfono y correo obligatorios; teléfono y correo únicos (3.4.4).
--------------------------------------------------------------------------- */
CREATE TABLE dbo.Proveedor (
    Id                 INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Proveedor PRIMARY KEY,
    Nombre             NVARCHAR(150) NOT NULL,
    Telefono           NVARCHAR(20)  NOT NULL CONSTRAINT UQ_Proveedor_Telefono UNIQUE,
    CorreoElectronico  NVARCHAR(254) NOT NULL CONSTRAINT UQ_Proveedor_CorreoElectronico UNIQUE,
    Estado             NVARCHAR(15)  NOT NULL CONSTRAINT DF_Proveedor_Estado DEFAULT N'Activo',
    CONSTRAINT CK_Proveedor_Telefono CHECK (Telefono LIKE N'[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'),
    CONSTRAINT CK_Proveedor_Correo   CHECK (CorreoElectronico LIKE N'%_@_%._%'),
    CONSTRAINT CK_Proveedor_Estado   CHECK (Estado IN (N'Activo', N'Desactivado'))
);
GO

/* ---------------------------------------------------------------------------
   Producto (MPD-01 a MPD-06). Ignacio.
   Un solo proveedor; debe estar activo al asociarlo (lo valida el API).
   Disponibilidad es calculada: Disponible si Stock > 0, si no Agotado.
--------------------------------------------------------------------------- */
CREATE TABLE dbo.Producto (
    Id              INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Producto PRIMARY KEY,
    ProveedorId     INT           NOT NULL CONSTRAINT FK_Producto_Proveedor REFERENCES dbo.Proveedor (Id),
    Nombre          NVARCHAR(150) NOT NULL,
    Marca           NVARCHAR(100) NOT NULL,
    Categoria       NVARCHAR(100) NOT NULL,
    Descripcion     NVARCHAR(500) NOT NULL,
    Precio          DECIMAL(10,2) NOT NULL,
    Stock           INT           NOT NULL CONSTRAINT DF_Producto_Stock DEFAULT 0,
    Estado          NVARCHAR(15)  NOT NULL CONSTRAINT DF_Producto_Estado DEFAULT N'Activo',
    Disponibilidad  AS (CASE WHEN Stock > 0 THEN N'Disponible' ELSE N'Agotado' END),
    CONSTRAINT CK_Producto_Precio CHECK (Precio >= 0),
    CONSTRAINT CK_Producto_Stock  CHECK (Stock >= 0),
    CONSTRAINT CK_Producto_Estado CHECK (Estado IN (N'Activo', N'Desactivado'))
);
GO

CREATE INDEX IX_Producto_Proveedor ON dbo.Producto (ProveedorId);
GO

/* ---------------------------------------------------------------------------
   Horario. Persona A. DiaSemana: 1 = lunes ... 7 = domingo.
   Varios tramos por día; las superposiciones las valida el API.
--------------------------------------------------------------------------- */
CREATE TABLE dbo.Horario (
    Id          INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Horario PRIMARY KEY,
    DiaSemana   TINYINT NOT NULL,
    HoraInicio  TIME(0) NOT NULL,
    HoraFin     TIME(0) NOT NULL,
    CONSTRAINT CK_Horario_DiaSemana CHECK (DiaSemana BETWEEN 1 AND 7),
    CONSTRAINT CK_Horario_Horas     CHECK (HoraFin > HoraInicio)
);
GO

/* ---------------------------------------------------------------------------
   BloqueoAgenda. Persona A. Fecha específica, sin enlace a Horario.
--------------------------------------------------------------------------- */
CREATE TABLE dbo.BloqueoAgenda (
    Id          INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_BloqueoAgenda PRIMARY KEY,
    Fecha       DATE    NOT NULL,
    HoraInicio  TIME(0) NOT NULL,
    HoraFin     TIME(0) NOT NULL,
    CONSTRAINT CK_BloqueoAgenda_Horas CHECK (HoraFin > HoraInicio)
);
GO

CREATE INDEX IX_BloqueoAgenda_Fecha ON dbo.BloqueoAgenda (Fecha);
GO

/* ---------------------------------------------------------------------------
   Cita. Persona A. Estados: Pendiente, Confirmada, Completada, Cancelada.
   - Hora = inicio, con minutos 00 o 30 y segundos 00. El fin es Hora + suma
     de CitaServicio.DuracionAplicadaMinutos.
   - MotivoCancelacion solo existe en citas Canceladas. Es obligatorio cuando
     cancela la administradora (MCA-14, lo valida el API) y queda NULL si la
     cancelación viene de una solicitud del cliente aprobada.
   - El Codigo lo genera el API de Citas: corto y difícil de adivinar, porque
     el cliente lo usa junto con su teléfono (D-016).
--------------------------------------------------------------------------- */
CREATE TABLE dbo.Cita (
    Id                 INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Cita PRIMARY KEY,
    Codigo             NVARCHAR(30)  NOT NULL CONSTRAINT UQ_Cita_Codigo UNIQUE,
    ClienteId          INT           NOT NULL CONSTRAINT FK_Cita_Cliente REFERENCES dbo.Cliente (Id),
    Fecha              DATE          NOT NULL,
    Hora               TIME(0)       NOT NULL,
    Estado             NVARCHAR(20)  NOT NULL,
    EsDomicilio        BIT           NOT NULL CONSTRAINT DF_Cita_EsDomicilio DEFAULT 0,
    Direccion          NVARCHAR(300) NULL,
    Observaciones      NVARCHAR(500) NULL,
    MotivoCancelacion  NVARCHAR(500) NULL,
    CONSTRAINT CK_Cita_Estado    CHECK (Estado IN (N'Pendiente', N'Confirmada', N'Completada', N'Cancelada')),
    CONSTRAINT CK_Cita_Domicilio CHECK (EsDomicilio = 0 OR Direccion IS NOT NULL),
    CONSTRAINT CK_Cita_Motivo    CHECK (MotivoCancelacion IS NULL OR Estado = N'Cancelada'),
    CONSTRAINT CK_Cita_Hora      CHECK (DATEPART(MINUTE, Hora) IN (0, 30) AND DATEPART(SECOND, Hora) = 0)
);
GO

CREATE INDEX IX_Cita_Fecha   ON dbo.Cita (Fecha, Hora) INCLUDE (Estado);
CREATE INDEX IX_Cita_Cliente ON dbo.Cita (ClienteId);
GO

/* ---------------------------------------------------------------------------
   CitaServicio. Persona A. Une Citas con el Servicio de Ignacio.
   La duración se copia al agendar: cambios posteriores en Servicio no alteran
   citas existentes (3.4.4, MS-03).
--------------------------------------------------------------------------- */
CREATE TABLE dbo.CitaServicio (
    CitaId                   INT NOT NULL CONSTRAINT FK_CitaServicio_Cita     REFERENCES dbo.Cita (Id),
    ServicioId               INT NOT NULL CONSTRAINT FK_CitaServicio_Servicio REFERENCES dbo.Servicio (Id),
    DuracionAplicadaMinutos  INT NOT NULL,
    CONSTRAINT PK_CitaServicio PRIMARY KEY (CitaId, ServicioId),
    CONSTRAINT CK_CitaServicio_Duracion CHECK (DuracionAplicadaMinutos > 0)
);
GO

CREATE INDEX IX_CitaServicio_Servicio ON dbo.CitaServicio (ServicioId);
GO

/* ---------------------------------------------------------------------------
   SolicitudCita. Persona A.
   Tipo: Creacion, Reprogramacion, Cancelacion. Estado: Pendiente, Aprobada,
   Rechazada. FechaPropuesta y HoraPropuesta solo en reprogramación (si no,
   NULL); HoraPropuesta con minutos 00 o 30 y segundos 00.
   FechaSolicitud: hora de Costa Rica (D-015).
--------------------------------------------------------------------------- */
CREATE TABLE dbo.SolicitudCita (
    Id              INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SolicitudCita PRIMARY KEY,
    CitaId          INT          NOT NULL CONSTRAINT FK_SolicitudCita_Cita REFERENCES dbo.Cita (Id),
    Tipo            NVARCHAR(20) NOT NULL,
    FechaSolicitud  DATETIME2(0) NOT NULL CONSTRAINT DF_SolicitudCita_FechaSolicitud
                                          DEFAULT (CONVERT(DATETIME2(0), DATEADD(HOUR, -6, SYSUTCDATETIME()))),
    Estado          NVARCHAR(20) NOT NULL CONSTRAINT DF_SolicitudCita_Estado DEFAULT N'Pendiente',
    FechaPropuesta  DATE         NULL,
    HoraPropuesta   TIME(0)      NULL,
    CONSTRAINT CK_SolicitudCita_Tipo   CHECK (Tipo IN (N'Creacion', N'Reprogramacion', N'Cancelacion')),
    CONSTRAINT CK_SolicitudCita_Estado CHECK (Estado IN (N'Pendiente', N'Aprobada', N'Rechazada')),
    CONSTRAINT CK_SolicitudCita_Propuesta CHECK (
        (Tipo = N'Reprogramacion' AND FechaPropuesta IS NOT NULL AND HoraPropuesta IS NOT NULL)
        OR (Tipo <> N'Reprogramacion' AND FechaPropuesta IS NULL AND HoraPropuesta IS NULL)
    ),
    CONSTRAINT CK_SolicitudCita_HoraPropuesta CHECK (
        HoraPropuesta IS NULL OR (DATEPART(MINUTE, HoraPropuesta) IN (0, 30) AND DATEPART(SECOND, HoraPropuesta) = 0)
    )
);
GO

CREATE INDEX IX_SolicitudCita_Cita ON dbo.SolicitudCita (CitaId);
/* Una cita no puede tener dos solicitudes pendientes al mismo tiempo. */
CREATE UNIQUE INDEX UX_SolicitudCita_PendientePorCita
    ON dbo.SolicitudCita (CitaId)
    WHERE Estado = N'Pendiente';
GO

/* ---------------------------------------------------------------------------
   Venta (MV-01 a MV-03). Ignacio.
   - Codigo lo calcula la base a partir del Id (V-000001 a V-999999): único y
     sin choques entre dos ventas registradas al mismo tiempo.
   - FechaHora: hora de Costa Rica al registrar (MV-01, restricción 7; D-015).
   - ReferenciaCliente es texto opcional; sin FK a Cliente ni a Cita (3.4.3).
   - La confirmación del pago no se guarda: el API no registra la venta sin
     ella (MV-01, restricción 8).
   - Al anular solo cambian Estado y MotivoAnulacion (MV-03, restricción 6).
--------------------------------------------------------------------------- */
CREATE TABLE dbo.Venta (
    Id                 INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Venta PRIMARY KEY,
    Codigo             AS (CAST(N'V-' + RIGHT(N'000000' + CAST(Id AS NVARCHAR(10)), 6) AS NVARCHAR(20))) PERSISTED
                       CONSTRAINT UQ_Venta_Codigo UNIQUE,
    FechaHora          DATETIME2(0)  NOT NULL CONSTRAINT DF_Venta_FechaHora
                                             DEFAULT (CONVERT(DATETIME2(0), DATEADD(HOUR, -6, SYSUTCDATETIME()))),
    ReferenciaCliente  NVARCHAR(150) NULL,
    MetodoPago         NVARCHAR(15)  NOT NULL,
    Total              DECIMAL(12,2) NOT NULL,
    Estado             NVARCHAR(15)  NOT NULL CONSTRAINT DF_Venta_Estado DEFAULT N'Registrada',
    MotivoAnulacion    NVARCHAR(500) NULL,
    CONSTRAINT CK_Venta_MetodoPago CHECK (MetodoPago IN (N'Efectivo', N'SINPE', N'Transferencia')),
    CONSTRAINT CK_Venta_Total      CHECK (Total >= 0),
    CONSTRAINT CK_Venta_Estado     CHECK (Estado IN (N'Registrada', N'Anulada')),
    CONSTRAINT CK_Venta_Anulacion  CHECK (
        (Estado = N'Registrada' AND MotivoAnulacion IS NULL)
        OR (Estado = N'Anulada' AND MotivoAnulacion IS NOT NULL AND LEN(MotivoAnulacion) > 0)
    )
);
GO

CREATE INDEX IX_Venta_FechaHora ON dbo.Venta (FechaHora);
GO

/* ---------------------------------------------------------------------------
   VentaProducto. Ignacio. Productos de cada venta.
   PrecioAplicado = precio del catálogo al vender; no cambia después (3.4.4).
--------------------------------------------------------------------------- */
CREATE TABLE dbo.VentaProducto (
    VentaId         INT           NOT NULL CONSTRAINT FK_VentaProducto_Venta    REFERENCES dbo.Venta (Id),
    ProductoId      INT           NOT NULL CONSTRAINT FK_VentaProducto_Producto REFERENCES dbo.Producto (Id),
    Cantidad        INT           NOT NULL,
    PrecioAplicado  DECIMAL(10,2) NOT NULL,
    CONSTRAINT PK_VentaProducto PRIMARY KEY (VentaId, ProductoId),
    CONSTRAINT CK_VentaProducto_Cantidad CHECK (Cantidad > 0),
    CONSTRAINT CK_VentaProducto_Precio   CHECK (PrecioAplicado >= 0)
);
GO

CREATE INDEX IX_VentaProducto_Producto ON dbo.VentaProducto (ProductoId);
GO

/* ---------------------------------------------------------------------------
   VentaServicio. Ignacio. Servicios de cada venta.
   PrecioFinal lo ingresa la administradora y debe ser mayor que cero.
--------------------------------------------------------------------------- */
CREATE TABLE dbo.VentaServicio (
    VentaId      INT           NOT NULL CONSTRAINT FK_VentaServicio_Venta    REFERENCES dbo.Venta (Id),
    ServicioId   INT           NOT NULL CONSTRAINT FK_VentaServicio_Servicio REFERENCES dbo.Servicio (Id),
    PrecioFinal  DECIMAL(10,2) NOT NULL,
    CONSTRAINT PK_VentaServicio PRIMARY KEY (VentaId, ServicioId),
    CONSTRAINT CK_VentaServicio_Precio CHECK (PrecioFinal > 0)
);
GO

CREATE INDEX IX_VentaServicio_Servicio ON dbo.VentaServicio (ServicioId);
GO
