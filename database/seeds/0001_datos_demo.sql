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

/* Servicios (Persona B). PrecioAprox = monto mínimo aproximado. */
IF NOT EXISTS (SELECT 1 FROM dbo.Servicio WHERE Nombre = N'Corte de cabello')
    INSERT INTO dbo.Servicio (Nombre, Descripcion, PrecioAprox, DuracionMin, Categoria, ADomicilio)
    VALUES (N'Corte de cabello', N'Corte y secado. El precio final depende del largo del cabello.', 6000, 45, N'Cabello', 1);

IF NOT EXISTS (SELECT 1 FROM dbo.Servicio WHERE Nombre = N'Tinte completo')
    INSERT INTO dbo.Servicio (Nombre, Descripcion, PrecioAprox, DuracionMin, Categoria, ADomicilio)
    VALUES (N'Tinte completo', N'Aplicación de color en todo el cabello. El precio depende del largo y del volumen.', 25000, 120, N'Color', 0);

IF NOT EXISTS (SELECT 1 FROM dbo.Servicio WHERE Nombre = N'Manicure')
    INSERT INTO dbo.Servicio (Nombre, Descripcion, PrecioAprox, DuracionMin, Categoria, ADomicilio)
    VALUES (N'Manicure', N'Limpieza, forma y esmaltado de uñas de las manos.', 8000, 60, N'Uñas', 1);

IF NOT EXISTS (SELECT 1 FROM dbo.Servicio WHERE Nombre = N'Pedicure')
    INSERT INTO dbo.Servicio (Nombre, Descripcion, PrecioAprox, DuracionMin, Categoria, ADomicilio)
    VALUES (N'Pedicure', N'Limpieza, exfoliación y esmaltado de uñas de los pies.', 9000, 60, N'Uñas', 1);

IF NOT EXISTS (SELECT 1 FROM dbo.Servicio WHERE Nombre = N'Peinado para evento')
    INSERT INTO dbo.Servicio (Nombre, Descripcion, PrecioAprox, DuracionMin, Categoria, ADomicilio)
    VALUES (N'Peinado para evento', N'Peinado formal para bodas, graduaciones u otras actividades.', 12000, 60, N'Cabello', 1);

IF NOT EXISTS (SELECT 1 FROM dbo.Servicio WHERE Nombre = N'Alisado')
    INSERT INTO dbo.Servicio (Nombre, Descripcion, PrecioAprox, DuracionMin, Categoria, ADomicilio, Activo)
    VALUES (N'Alisado', N'Tratamiento de alisado. Está inactivo para probar que no aparece en el catálogo público.', 40000, 180, N'Cabello', 0, 0);
GO

/* Horario regular de atención (Persona A puede ajustarlo).
   DiaSemana: 1 = lunes ... 7 = domingo. */
DECLARE @dia TINYINT = 1;
WHILE @dia <= 5
BEGIN
    IF NOT EXISTS (SELECT 1 FROM dbo.Horario WHERE DiaSemana = @dia)
        INSERT INTO dbo.Horario (DiaSemana, HoraApertura, HoraCierre) VALUES (@dia, '09:00', '18:00');
    SET @dia = @dia + 1;
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Horario WHERE DiaSemana = 6)
    INSERT INTO dbo.Horario (DiaSemana, HoraApertura, HoraCierre) VALUES (6, '08:00', '14:00');
GO

/* Proveedores y productos (Persona B). Correos con dominio de ejemplo. */
IF NOT EXISTS (SELECT 1 FROM dbo.Proveedor WHERE Telefono = N'2222-0001')
    INSERT INTO dbo.Proveedor (Nombre, Telefono, Correo)
    VALUES (N'Distribuidora Belleza Total', N'2222-0001', N'ventas@bellezatotal.example');

IF NOT EXISTS (SELECT 1 FROM dbo.Proveedor WHERE Telefono = N'2222-0002')
    INSERT INTO dbo.Proveedor (Nombre, Telefono, Correo)
    VALUES (N'Insumos Capilares del Valle', N'2222-0002', N'pedidos@capilaresvalle.example');
GO

DECLARE @prov1 INT = (SELECT IdProveedor FROM dbo.Proveedor WHERE Telefono = N'2222-0001');
DECLARE @prov2 INT = (SELECT IdProveedor FROM dbo.Proveedor WHERE Telefono = N'2222-0002');

IF NOT EXISTS (SELECT 1 FROM dbo.Producto WHERE Nombre = N'Shampoo hidratante')
    INSERT INTO dbo.Producto (IdProveedor, Nombre, Marca, Categoria, Descripcion, Precio, Stock)
    VALUES (@prov1, N'Shampoo hidratante', N'Marca Demo', N'Cuidado del cabello', N'Shampoo para cabello seco, 500 ml.', 7500, 12);

IF NOT EXISTS (SELECT 1 FROM dbo.Producto WHERE Nombre = N'Acondicionador reparador')
    INSERT INTO dbo.Producto (IdProveedor, Nombre, Marca, Categoria, Descripcion, Precio, Stock)
    VALUES (@prov1, N'Acondicionador reparador', N'Marca Demo', N'Cuidado del cabello', N'Acondicionador para cabello dañado, 500 ml.', 8200, 5);

IF NOT EXISTS (SELECT 1 FROM dbo.Producto WHERE Nombre = N'Mascarilla capilar')
    INSERT INTO dbo.Producto (IdProveedor, Nombre, Marca, Categoria, Descripcion, Precio, Stock)
    VALUES (@prov2, N'Mascarilla capilar', N'Línea Ejemplo', N'Tratamientos', N'Mascarilla nutritiva de uso semanal. Sin stock para probar el estado Agotado.', 11000, 0);
GO
