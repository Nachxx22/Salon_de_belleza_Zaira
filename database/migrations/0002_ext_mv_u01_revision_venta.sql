/* =============================================================================
   0002_ext_mv_u01_revision_venta.sql — tabla 14: RevisionVenta
   -----------------------------------------------------------------------------
   EXTENSIÓN EXT-MV-U01 "Actualizar venta". NO es parte del ERS: el ERS indica
   anular la venta y registrar otra. El equipo la agrega para mostrar el CRUD
   completo de Ventas (docs/DECISIONES.md, D-008 y D-013).

   Reglas de la extensión (las aplica el API en una sola transacción):
   - Solo se corrigen ventas en estado Registrada.
   - Se revierte el stock de la versión anterior y se aplica el de la nueva.
   - Antes de cambiar la venta se guarda cómo estaba en RevisionVenta.
   - Nunca se borra una venta.
   FechaHora: hora de Costa Rica calculada desde UTC (D-015).
============================================================================= */

CREATE TABLE dbo.RevisionVenta (
    Id               INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_RevisionVenta PRIMARY KEY,
    VentaId          INT           NOT NULL CONSTRAINT FK_RevisionVenta_Venta REFERENCES dbo.Venta (Id),
    FechaHora        DATETIME2(0)  NOT NULL CONSTRAINT DF_RevisionVenta_FechaHora
                                           DEFAULT (CONVERT(DATETIME2(0), DATEADD(HOUR, -6, SYSUTCDATETIME()))),
    Motivo           NVARCHAR(500) NOT NULL,
    -- JSON con la venta antes del cambio: referencia, método, total y detalle
    DatosAnteriores  NVARCHAR(MAX) NOT NULL,
    CONSTRAINT CK_RevisionVenta_Motivo CHECK (LEN(Motivo) > 0),
    CONSTRAINT CK_RevisionVenta_Datos  CHECK (ISJSON(DatosAnteriores) = 1)
);
GO

CREATE INDEX IX_RevisionVenta_Venta ON dbo.RevisionVenta (VentaId);
GO
