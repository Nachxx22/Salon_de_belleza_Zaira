/* =============================================================================
   0001_datos_demo.sql — Datos de prueba ficticios
   -----------------------------------------------------------------------------
   - Se puede ejecutar varias veces: cada inserción revisa si el dato ya existe.
   - Solo datos inventados; nunca datos reales de clientes.
   - La cuenta de la administradora NO se crea aquí (no se suben contraseñas):
     se crea con `npm run db:admin` usando los valores de backend/.env.
   - Los cambios que se muestran en la demostración deben hacerse desde la
     interfaz, no con este archivo.
============================================================================= */

/* Servicios (Ignacio). PrecioAproximado es un solo monto; el catálogo avisa
   que el precio final puede variar según el tipo y el largo del cabello. */
IF NOT EXISTS (SELECT 1 FROM dbo.Servicio WHERE Nombre = N'Corte de cabello')
    INSERT INTO dbo.Servicio (Nombre, Descripcion, PrecioAproximado, DuracionMinutos, PermiteDomicilio)
    VALUES (N'Corte de cabello', N'Corte y secado.', 6000, 45, 1);

IF NOT EXISTS (SELECT 1 FROM dbo.Servicio WHERE Nombre = N'Tinte completo')
    INSERT INTO dbo.Servicio (Nombre, Descripcion, PrecioAproximado, DuracionMinutos, PermiteDomicilio)
    VALUES (N'Tinte completo', N'Aplicación de color en todo el cabello.', 25000, 120, 0);

IF NOT EXISTS (SELECT 1 FROM dbo.Servicio WHERE Nombre = N'Manicure')
    INSERT INTO dbo.Servicio (Nombre, Descripcion, PrecioAproximado, DuracionMinutos, PermiteDomicilio)
    VALUES (N'Manicure', N'Limpieza, forma y esmaltado de uñas de las manos.', 8000, 60, 1);

IF NOT EXISTS (SELECT 1 FROM dbo.Servicio WHERE Nombre = N'Pedicure')
    INSERT INTO dbo.Servicio (Nombre, Descripcion, PrecioAproximado, DuracionMinutos, PermiteDomicilio)
    VALUES (N'Pedicure', N'Limpieza, exfoliación y esmaltado de uñas de los pies.', 9000, 60, 1);

IF NOT EXISTS (SELECT 1 FROM dbo.Servicio WHERE Nombre = N'Peinado para evento')
    INSERT INTO dbo.Servicio (Nombre, Descripcion, PrecioAproximado, DuracionMinutos, PermiteDomicilio)
    VALUES (N'Peinado para evento', N'Peinado formal para bodas, graduaciones u otras actividades.', 12000, 60, 1);

IF NOT EXISTS (SELECT 1 FROM dbo.Servicio WHERE Nombre = N'Alisado')
    INSERT INTO dbo.Servicio (Nombre, Descripcion, PrecioAproximado, DuracionMinutos, PermiteDomicilio, Estado)
    VALUES (N'Alisado', N'Tratamiento de alisado. Está desactivado para probar que no aparece en el catálogo público.', 40000, 180, 0, N'Desactivado');
GO

/* Horario regular de atención (Persona A puede ajustarlo).
   DiaSemana: 1 = lunes ... 7 = domingo. */
DECLARE @dia TINYINT = 1;
WHILE @dia <= 5
BEGIN
    IF NOT EXISTS (SELECT 1 FROM dbo.Horario WHERE DiaSemana = @dia)
        INSERT INTO dbo.Horario (DiaSemana, HoraInicio, HoraFin) VALUES (@dia, '09:00', '18:00');
    SET @dia = @dia + 1;
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Horario WHERE DiaSemana = 6)
    INSERT INTO dbo.Horario (DiaSemana, HoraInicio, HoraFin) VALUES (6, '08:00', '14:00');
GO

/* Proveedores y productos (Ignacio). Teléfonos de 8 dígitos y correos de ejemplo. */
IF NOT EXISTS (SELECT 1 FROM dbo.Proveedor WHERE Telefono = N'22220001')
    INSERT INTO dbo.Proveedor (Nombre, Telefono, CorreoElectronico)
    VALUES (N'Distribuidora Belleza Total', N'22220001', N'ventas@bellezatotal.example');

IF NOT EXISTS (SELECT 1 FROM dbo.Proveedor WHERE Telefono = N'22220002')
    INSERT INTO dbo.Proveedor (Nombre, Telefono, CorreoElectronico)
    VALUES (N'Insumos Capilares del Valle', N'22220002', N'pedidos@capilaresvalle.example');
GO

DECLARE @prov1 INT = (SELECT Id FROM dbo.Proveedor WHERE Telefono = N'22220001');
DECLARE @prov2 INT = (SELECT Id FROM dbo.Proveedor WHERE Telefono = N'22220002');

IF NOT EXISTS (SELECT 1 FROM dbo.Producto WHERE Nombre = N'Shampoo hidratante')
    INSERT INTO dbo.Producto (ProveedorId, Nombre, Marca, Categoria, Descripcion, Precio, Stock)
    VALUES (@prov1, N'Shampoo hidratante', N'Marca Demo', N'Cuidado del cabello', N'Shampoo para cabello seco, 500 ml.', 7500, 12);

IF NOT EXISTS (SELECT 1 FROM dbo.Producto WHERE Nombre = N'Acondicionador reparador')
    INSERT INTO dbo.Producto (ProveedorId, Nombre, Marca, Categoria, Descripcion, Precio, Stock)
    VALUES (@prov1, N'Acondicionador reparador', N'Marca Demo', N'Cuidado del cabello', N'Acondicionador para cabello dañado, 500 ml.', 8200, 5);

IF NOT EXISTS (SELECT 1 FROM dbo.Producto WHERE Nombre = N'Mascarilla capilar')
    INSERT INTO dbo.Producto (ProveedorId, Nombre, Marca, Categoria, Descripcion, Precio, Stock)
    VALUES (@prov2, N'Mascarilla capilar', N'Línea Ejemplo', N'Tratamientos', N'Mascarilla nutritiva de uso semanal. Sin stock para probar el estado Agotado.', 11000, 0);
GO
