/* =============================================================================
   0001_base.sql — Esquema inicial del Salón de Belleza Zaira
   -----------------------------------------------------------------------------
   Fuente: ERS final, sección 3.4. Las tablas y columnas siguen el diagrama de
   entidades de la 3.4 (mismos nombres, en PascalCase) y las restricciones
   siguen el texto de 3.4.1 a 3.4.4. Donde el texto pide algo que el diagrama
   no tiene, se agregó como se indica en cada tabla (docs/DECISIONES.md, D-002).

   Reglas del equipo:
   - NO editar este archivo después de que esté en main. Cualquier cambio va en
     una migración nueva (0003_..., 0004_...). El ejecutor detecta si un archivo
     ya aplicado cambió y se detiene.
   - No hay borrados físicos de historial: servicios, productos y proveedores se
     desactivan; citas se cancelan; ventas se anulan.

   Dueños de tablas (plan de desarrollo, sección 5.2):
   - Persona A (Citas y Agenda): Cliente, Cita, Cita_Servicio, Horario,
     BloqueoAgenda, SolicitudCita.
   - Persona B (Ignacio): Usuario_Admin, Servicio, Proveedor, Producto, Venta,
     Detalle_Venta.

   Convenciones:
   - Fechas y horas en hora local de Costa Rica (DATE, TIME(0), DATETIME2(0)).
   - Estados: códigos sin tildes; la interfaz muestra el texto con tildes.
   - Montos en colones: DECIMAL(10,2) por elemento y DECIMAL(12,2) en totales.
============================================================================= */

/* ---------------------------------------------------------------------------
   Usuario_Admin — acceso administrativo (MA-01, MA-02)
   Contrasena guarda el hash bcrypt, nunca la contraseña en texto plano.
--------------------------------------------------------------------------- */
CREATE TABLE dbo.Usuario_Admin (
    IdAdmin     INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Usuario_Admin PRIMARY KEY,
    Usuario     NVARCHAR(50)  NOT NULL CONSTRAINT UQ_Usuario_Admin_Usuario UNIQUE,
    Contrasena  NVARCHAR(100) NOT NULL
);
GO

/* ---------------------------------------------------------------------------
   Cliente — sin cuentas; el teléfono identifica al cliente (3.4.4)
--------------------------------------------------------------------------- */
CREATE TABLE dbo.Cliente (
    IdCliente  INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Cliente PRIMARY KEY,
    Nombre     NVARCHAR(100) NOT NULL,
    Telefono   NVARCHAR(20)  NOT NULL CONSTRAINT UQ_Cliente_Telefono UNIQUE,
    Correo     NVARCHAR(150) NULL
);
GO

/* ---------------------------------------------------------------------------
   Servicio (MS-01 a MS-05)
   PrecioAprox es el monto mínimo aproximado ("desde"), según MS-01.
   DuracionMin la usa Citas para calcular la disponibilidad.
--------------------------------------------------------------------------- */
CREATE TABLE dbo.Servicio (
    IdServicio   INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Servicio PRIMARY KEY,
    Nombre       NVARCHAR(100) NOT NULL,
    Descripcion  NVARCHAR(500) NOT NULL,
    PrecioAprox  DECIMAL(10,2) NOT NULL,
    DuracionMin  INT           NOT NULL,
    Categoria    NVARCHAR(60)  NULL,
    ADomicilio   BIT           NOT NULL CONSTRAINT DF_Servicio_ADomicilio DEFAULT 0,
    Activo       BIT           NOT NULL CONSTRAINT DF_Servicio_Activo DEFAULT 1,
    CONSTRAINT CK_Servicio_PrecioAprox CHECK (PrecioAprox >= 0),
    CONSTRAINT CK_Servicio_DuracionMin CHECK (DuracionMin > 0)
);
GO

/* ---------------------------------------------------------------------------
   Cita (MCA-01 a MCA-07, MCA-12 a MCA-14)
   Estados: Pendiente, Confirmada, Completada, Cancelada (ERS 3.7.3).
   HoraFin = HoraInicio + suma de DuracionAplicadaMinutos de Cita_Servicio.
--------------------------------------------------------------------------- */
CREATE TABLE dbo.Cita (
    IdCita              INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Cita PRIMARY KEY,
    Codigo              NVARCHAR(20)  NOT NULL CONSTRAINT UQ_Cita_Codigo UNIQUE,
    IdCliente           INT           NOT NULL CONSTRAINT FK_Cita_Cliente REFERENCES dbo.Cliente (IdCliente),
    Fecha               DATE          NOT NULL,
    HoraInicio          TIME(0)       NOT NULL,
    HoraFin             TIME(0)       NOT NULL,
    Estado              NVARCHAR(20)  NOT NULL CONSTRAINT DF_Cita_Estado DEFAULT N'Pendiente',
    DireccionDomicilio  NVARCHAR(250) NULL,
    Observaciones       NVARCHAR(500) NULL,
    ADomicilio          BIT           NOT NULL CONSTRAINT DF_Cita_ADomicilio DEFAULT 0,
    CONSTRAINT CK_Cita_Estado    CHECK (Estado IN (N'Pendiente', N'Confirmada', N'Completada', N'Cancelada')),
    CONSTRAINT CK_Cita_Horas     CHECK (HoraFin > HoraInicio),
    CONSTRAINT CK_Cita_Domicilio CHECK (ADomicilio = 0 OR DireccionDomicilio IS NOT NULL)
);
GO

CREATE INDEX IX_Cita_Fecha ON dbo.Cita (Fecha, HoraInicio) INCLUDE (HoraFin, Estado);
CREATE INDEX IX_Cita_Cliente ON dbo.Cita (IdCliente);
GO

/* Cita_Servicio — servicios de cada cita. La duración se copia al registrar la
   cita para que cambios posteriores en el servicio no alteren citas (3.4.4). */
CREATE TABLE dbo.Cita_Servicio (
    IdCitaServicio           INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Cita_Servicio PRIMARY KEY,
    IdCita                   INT NOT NULL CONSTRAINT FK_Cita_Servicio_Cita     REFERENCES dbo.Cita (IdCita),
    IdServicio               INT NOT NULL CONSTRAINT FK_Cita_Servicio_Servicio REFERENCES dbo.Servicio (IdServicio),
    DuracionAplicadaMinutos  INT NOT NULL,
    CONSTRAINT UQ_Cita_Servicio UNIQUE (IdCita, IdServicio),
    CONSTRAINT CK_Cita_Servicio_Duracion CHECK (DuracionAplicadaMinutos > 0)
);
GO

CREATE INDEX IX_Cita_Servicio_Servicio ON dbo.Cita_Servicio (IdServicio);
GO

/* ---------------------------------------------------------------------------
   Horario — horario regular de atención (MCA-08 a MCA-11)
   DiaSemana: 1 = lunes ... 7 = domingo.
   Las superposiciones se validan en la lógica del servidor (MCA-08, 5 y 6).
--------------------------------------------------------------------------- */
CREATE TABLE dbo.Horario (
    IdHorario     INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Horario PRIMARY KEY,
    DiaSemana     TINYINT NOT NULL,
    HoraApertura  TIME(0) NOT NULL,
    HoraCierre    TIME(0) NOT NULL,
    CONSTRAINT CK_Horario_Dia   CHECK (DiaSemana BETWEEN 1 AND 7),
    CONSTRAINT CK_Horario_Horas CHECK (HoraCierre > HoraApertura)
);
GO

/* BloqueoAgenda — períodos no disponibles.
   Fecha se agregó porque el texto (3.4.2) y MCA-08 piden una fecha específica
   y el diagrama no la tenía. IdHorario es opcional, como en el diagrama. */
CREATE TABLE dbo.BloqueoAgenda (
    IdBloqueo      INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_BloqueoAgenda PRIMARY KEY,
    IdHorario      INT     NULL CONSTRAINT FK_BloqueoAgenda_Horario REFERENCES dbo.Horario (IdHorario) ON DELETE SET NULL,
    Fecha          DATE    NOT NULL,
    HorarioInicio  TIME(0) NOT NULL,
    HorarioFin     TIME(0) NOT NULL,
    CONSTRAINT CK_BloqueoAgenda_Horas CHECK (HorarioFin > HorarioInicio)
);
GO

CREATE INDEX IX_BloqueoAgenda_Fecha ON dbo.BloqueoAgenda (Fecha);
GO

/* ---------------------------------------------------------------------------
   SolicitudCita — solicitudes de los clientes (MCA-01 a MCA-03, MCA-05, MCA-06)
   TipoSolicitud: Creacion, Reprogramacion, Cancelacion.
   Estado: Pendiente, Aprobada, Rechazada. Se conservan después de procesarse.
--------------------------------------------------------------------------- */
CREATE TABLE dbo.SolicitudCita (
    IdSolicitud     INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SolicitudCita PRIMARY KEY,
    IdCita          INT           NOT NULL CONSTRAINT FK_SolicitudCita_Cita REFERENCES dbo.Cita (IdCita),
    TipoSolicitud   NVARCHAR(20)  NOT NULL,
    Fecha           DATETIME2(0)  NOT NULL CONSTRAINT DF_SolicitudCita_Fecha DEFAULT SYSDATETIME(),
    Estado          NVARCHAR(20)  NOT NULL CONSTRAINT DF_SolicitudCita_Estado DEFAULT N'Pendiente',
    FechaPropuesta  DATE          NULL,  -- solo reprogramación
    HoraPropuesta   TIME(0)       NULL,  -- solo reprogramación
    CONSTRAINT CK_SolicitudCita_Tipo   CHECK (TipoSolicitud IN (N'Creacion', N'Reprogramacion', N'Cancelacion')),
    CONSTRAINT CK_SolicitudCita_Estado CHECK (Estado IN (N'Pendiente', N'Aprobada', N'Rechazada')),
    CONSTRAINT CK_SolicitudCita_Propuesta CHECK (
        (TipoSolicitud = N'Reprogramacion' AND FechaPropuesta IS NOT NULL AND HoraPropuesta IS NOT NULL)
        OR (TipoSolicitud <> N'Reprogramacion' AND FechaPropuesta IS NULL AND HoraPropuesta IS NULL)
    )
);
GO

CREATE INDEX IX_SolicitudCita_Cita ON dbo.SolicitudCita (IdCita);
/* Una cita no puede tener dos solicitudes pendientes al mismo tiempo. */
CREATE UNIQUE INDEX UX_SolicitudCita_PendientePorCita
    ON dbo.SolicitudCita (IdCita)
    WHERE Estado = N'Pendiente';
GO

/* ---------------------------------------------------------------------------
   Proveedor (MPV-01 a MPV-04): nombre, teléfono y correo obligatorios;
   teléfono y correo únicos (3.4.4).
--------------------------------------------------------------------------- */
CREATE TABLE dbo.Proveedor (
    IdProveedor  INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Proveedor PRIMARY KEY,
    Nombre       NVARCHAR(100) NOT NULL,
    Telefono     NVARCHAR(20)  NOT NULL CONSTRAINT UQ_Proveedor_Telefono UNIQUE,
    Correo       NVARCHAR(150) NOT NULL CONSTRAINT UQ_Proveedor_Correo UNIQUE,
    Activo       BIT           NOT NULL CONSTRAINT DF_Proveedor_Activo DEFAULT 1
);
GO

/* ---------------------------------------------------------------------------
   Producto (MPD-01 a MPD-06). Disponible si Stock > 0; Agotado si Stock = 0.
--------------------------------------------------------------------------- */
CREATE TABLE dbo.Producto (
    IdProducto   INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Producto PRIMARY KEY,
    IdProveedor  INT           NOT NULL CONSTRAINT FK_Producto_Proveedor REFERENCES dbo.Proveedor (IdProveedor),
    Nombre       NVARCHAR(100) NOT NULL,
    Marca        NVARCHAR(60)  NOT NULL,
    Categoria    NVARCHAR(60)  NOT NULL,
    Descripcion  NVARCHAR(500) NOT NULL,
    Precio       DECIMAL(10,2) NOT NULL,
    Stock        INT           NOT NULL CONSTRAINT DF_Producto_Stock DEFAULT 0,
    Activo       BIT           NOT NULL CONSTRAINT DF_Producto_Activo DEFAULT 1,
    CONSTRAINT CK_Producto_Precio CHECK (Precio >= 0),
    CONSTRAINT CK_Producto_Stock  CHECK (Stock >= 0)
);
GO

CREATE INDEX IX_Producto_Proveedor ON dbo.Producto (IdProveedor);
GO

/* ---------------------------------------------------------------------------
   Venta (MV-01 a MV-03)
   - IdCliente e IdCita vienen del diagrama y son opcionales: el texto dice que
     una venta no requiere relación con Cliente (3.4.3).
   - ClienteReferencia se agregó porque MV-01 pide guardar en la venta la
     referencia del cliente, ingresada opcionalmente por la administradora.
   - EstadoPago solo admite 'Confirmado': la venta solo se registra cuando la
     administradora confirma el pago recibido fuera del sistema (MV-01, 8).
   - Anulada es una columna calculada a partir de Estado, para que los dos
     datos del diagrama nunca se contradigan.
   - Una venta anulada conserva sus datos; solo cambian Estado y MotivoAnulacion.
--------------------------------------------------------------------------- */
CREATE TABLE dbo.Venta (
    IdVenta            INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Venta PRIMARY KEY,
    IdCliente          INT           NULL CONSTRAINT FK_Venta_Cliente REFERENCES dbo.Cliente (IdCliente),
    IdCita             INT           NULL CONSTRAINT FK_Venta_Cita    REFERENCES dbo.Cita (IdCita),
    ClienteReferencia  NVARCHAR(150) NULL,
    Fecha              DATE          NOT NULL CONSTRAINT DF_Venta_Fecha DEFAULT CAST(SYSDATETIME() AS DATE),
    Hora               TIME(0)       NOT NULL CONSTRAINT DF_Venta_Hora  DEFAULT CAST(SYSDATETIME() AS TIME(0)),
    Subtotal           DECIMAL(12,2) NOT NULL,
    Total              DECIMAL(12,2) NOT NULL,
    EstadoPago         NVARCHAR(20)  NOT NULL CONSTRAINT DF_Venta_EstadoPago DEFAULT N'Confirmado',
    CodigoVenta        NVARCHAR(20)  NOT NULL CONSTRAINT UQ_Venta_CodigoVenta UNIQUE,
    MetodoPago         NVARCHAR(20)  NOT NULL,
    Estado             NVARCHAR(20)  NOT NULL CONSTRAINT DF_Venta_Estado DEFAULT N'Registrada',
    Anulada            AS CAST(CASE WHEN Estado = N'Anulada' THEN 1 ELSE 0 END AS BIT),
    MotivoAnulacion    NVARCHAR(250) NULL,
    CONSTRAINT CK_Venta_Montos     CHECK (Subtotal >= 0 AND Total >= 0),
    CONSTRAINT CK_Venta_EstadoPago CHECK (EstadoPago = N'Confirmado'),
    CONSTRAINT CK_Venta_MetodoPago CHECK (MetodoPago IN (N'Efectivo', N'SINPE', N'Transferencia')),
    CONSTRAINT CK_Venta_Estado     CHECK (Estado IN (N'Registrada', N'Anulada')),
    CONSTRAINT CK_Venta_Anulacion  CHECK (
        (Estado = N'Registrada' AND MotivoAnulacion IS NULL)
        OR (Estado = N'Anulada' AND MotivoAnulacion IS NOT NULL)
    )
);
GO

CREATE INDEX IX_Venta_Fecha ON dbo.Venta (Fecha, Hora);
GO

/* ---------------------------------------------------------------------------
   Detalle_Venta — una fila por producto o por servicio de la venta.
   Cubre lo que el texto llama VentaProducto y VentaServicio:
   - Fila de producto: IdProducto, Cantidad > 0, Precio = precio del catálogo
     al momento de la venta (se conserva aunque el catálogo cambie).
   - Fila de servicio: IdServicio, Cantidad = 1, Precio = precio final > 0
     ingresado por la administradora.
--------------------------------------------------------------------------- */
CREATE TABLE dbo.Detalle_Venta (
    IdDetalle   INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Detalle_Venta PRIMARY KEY,
    IdVenta     INT           NOT NULL CONSTRAINT FK_Detalle_Venta_Venta    REFERENCES dbo.Venta (IdVenta),
    IdProducto  INT           NULL     CONSTRAINT FK_Detalle_Venta_Producto REFERENCES dbo.Producto (IdProducto),
    IdServicio  INT           NULL     CONSTRAINT FK_Detalle_Venta_Servicio REFERENCES dbo.Servicio (IdServicio),
    Cantidad    INT           NOT NULL,
    Precio      DECIMAL(10,2) NOT NULL,
    CONSTRAINT CK_Detalle_Venta_Elemento CHECK (
        (IdProducto IS NOT NULL AND IdServicio IS NULL AND Cantidad > 0 AND Precio >= 0)
        OR (IdServicio IS NOT NULL AND IdProducto IS NULL AND Cantidad = 1 AND Precio > 0)
    )
);
GO

CREATE INDEX IX_Detalle_Venta_Venta ON dbo.Detalle_Venta (IdVenta);
CREATE INDEX IX_Detalle_Venta_Producto ON dbo.Detalle_Venta (IdProducto) WHERE IdProducto IS NOT NULL;
CREATE INDEX IX_Detalle_Venta_Servicio ON dbo.Detalle_Venta (IdServicio) WHERE IdServicio IS NOT NULL;
GO
