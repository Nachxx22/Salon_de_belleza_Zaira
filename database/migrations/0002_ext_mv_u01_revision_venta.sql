/* =============================================================================
   0002_ext_mv_u01_revision_venta.sql
   -----------------------------------------------------------------------------
   EXTENSIÓN ACORDADA POR EL EQUIPO — NO forma parte del ERS.
   EXT-MV-U01 "Actualizar venta": el ERS solo define registrar (MV-01),
   consultar (MV-02) y anular (MV-03). El equipo decidió agregar la edición
   para mostrar el CRUD completo de Ventas (ver docs/DECISIONES.md, D-008).

   Reglas de la extensión (las aplica la lógica del servidor):
   - Solo se editan ventas en estado Registrada; nunca una Anulada.
   - La edición revierte el efecto anterior sobre el stock y aplica el nuevo
     dentro de la misma transacción.
   - Cada edición guarda aquí una revisión con el motivo y el detalle anterior,
     para conservar la trazabilidad de la corrección.
   Dueño: Persona B (Ignacio).
============================================================================= */

CREATE TABLE dbo.RevisionVenta (
    IdRevision       INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_RevisionVenta PRIMARY KEY,
    IdVenta          INT            NOT NULL CONSTRAINT FK_RevisionVenta_Venta REFERENCES dbo.Venta (IdVenta),
    FechaHora        DATETIME2(0)   NOT NULL CONSTRAINT DF_RevisionVenta_FechaHora DEFAULT SYSDATETIME(),
    Motivo           NVARCHAR(250)  NOT NULL,
    TotalAnterior    DECIMAL(12,2)  NOT NULL,
    DetalleAnterior  NVARCHAR(MAX)  NOT NULL,  -- JSON con productos y servicios antes del cambio
    CONSTRAINT CK_RevisionVenta_Detalle CHECK (ISJSON(DetalleAnterior) = 1)
);
GO

CREATE INDEX IX_RevisionVenta_Venta ON dbo.RevisionVenta (IdVenta);
GO
